import Dexie, { type Table } from 'dexie';
import type {
  Category, DeviceProfile, Household, Item, LocalState, Op, OpType, TrackingMethod, Track,
} from '../types';
import { DEFAULT_TRACKING_METHODS } from '../constants';
import { genId, syncMeta } from '../logic/ids';

class TrackerDb extends Dexie {
  household!: Table<Household, string>;
  deviceProfile!: Table<DeviceProfile, string>;
  trackingMethods!: Table<TrackingMethod, string>;
  tracks!: Table<Track, string>;
  categories!: Table<Category, string>;
  items!: Table<Item, string>;
  ops!: Table<Op, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('family-stock-tracker');
    this.version(1).stores({
      household: 'id, createdAt',
      deviceProfile: 'id',
      trackingMethods: 'id',
      tracks: 'id',
      categories: 'id, trackId',
      items: 'id, categoryId',
      ops: 'id, itemId, when',
      meta: 'key',
    });
  }
}

export const db = new TrackerDb();

async function deviceId(): Promise<string> {
  const row = await db.meta.get('deviceId');
  if (row) return String(row.value);
  const id = genId('dev');
  await db.meta.put({ key: 'deviceId', value: id });
  return id;
}

/** Первый запуск: засеять дефолтные способы отслеживания (идемпотентно по id). */
export async function ensureOnboarding(): Promise<void> {
  await db.trackingMethods.bulkPut(
    DEFAULT_TRACKING_METHODS.map(m => ({ ...m, updatedAt: Date.now(), updatedBy: 'seed' })),
  );
}

export async function createHousehold(input: {
  name: string; deviceLabel: string; warnDays: number;
}): Promise<Household> {
  const household: Household = {
    id: genId('hh'),
    name: input.name,
    warnDays: input.warnDays,
    deviceLabel: input.deviceLabel,
    createdAt: Date.now(),
    deletedAt: null,
    ...syncMeta(await deviceId()),
  };
  await db.household.put(household);
  return household;
}

export function getHousehold(): Promise<Household | undefined> {
  return db.household.orderBy('createdAt').first();
}

export function getDeviceProfile(): Promise<DeviceProfile | undefined> {
  return db.deviceProfile.get('me');
}

export async function saveDeviceProfile(profile: DeviceProfile): Promise<void> {
  await db.deviceProfile.put({ ...profile, id: 'me', ...syncMeta(await deviceId()) });
}

export async function getTrackingMethods(): Promise<TrackingMethod[]> {
  const rows = await db.trackingMethods.toArray();
  return rows.filter(m => m.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveTrackingMethod(method: TrackingMethod): Promise<void> {
  await db.trackingMethods.put({ ...method, ...syncMeta(await deviceId()) });
}

export async function listTracks(): Promise<Track[]> {
  const rows = await db.tracks.toArray();
  return rows.filter(t => t.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveTrack(track: Track): Promise<void> {
  await db.tracks.put({ ...track, ...syncMeta(await deviceId()) });
}

export async function softDeleteTrack(id: string): Promise<void> {
  const track = await db.tracks.get(id);
  if (!track) return;
  await db.tracks.put({ ...track, deletedAt: Date.now(), ...syncMeta(await deviceId()) });
}

export async function listCategories(trackId: string): Promise<Category[]> {
  const rows = await db.categories.where('trackId').equals(trackId).toArray();
  return rows.filter(c => c.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveCategory(category: Category): Promise<void> {
  await db.categories.put({ ...category, ...syncMeta(await deviceId()) });
}

export async function listActiveItems(categoryId: string): Promise<Item[]> {
  const rows = await db.items.where('categoryId').equals(categoryId).toArray();
  return rows.filter(i => i.deletedAt === null).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export async function saveItem(item: Item): Promise<void> {
  await db.items.put({ ...item, ...syncMeta(await deviceId()) });
}

export async function softDeleteItem(id: string): Promise<void> {
  const item = await db.items.get(id);
  if (!item) return;
  await db.transaction('rw', db.items, db.ops, db.meta, db.household, db.categories, async () => {
    await db.items.put({ ...item, deletedAt: Date.now(), ...syncMeta(await deviceId()) });
    const cat = await db.categories.get(item.categoryId);
    await recordOp({ type: 'delete', itemId: id, trackId: cat?.trackId ?? null, delta: null, note: '' });
  });
}

export function nextDeviceSeq(): Promise<number> {
  return db.meta.get('deviceSeq').then(row => Number((row?.value as number | undefined) ?? 0));
}

/** Общая мутация количества: spend (−delta) и restock (+delta) в одной транзакции. */
async function mutateQuantity(
  id: string, delta: number, note: string, type: 'spend' | 'restock',
): Promise<void> {
  await db.transaction('rw', db.items, db.ops, db.meta, db.household, db.categories, async () => {
    const current = await db.items.get(id);
    if (!current) throw new Error(`item not found: ${id}`);
    const cat = await db.categories.get(current.categoryId);
    await db.items.put({
      ...current,
      quantity: current.quantity + delta,
      ...syncMeta(await deviceId()),
    });
    await recordOp({ type, itemId: id, trackId: cat?.trackId ?? null, delta, note });
  });
}

export async function spendItem(id: string, amount: number, note: string): Promise<void> {
  if (amount <= 0) throw new Error('amount must be positive');
  await mutateQuantity(id, -amount, note, 'spend');
}

export async function restockItem(id: string, amount: number, note: string): Promise<void> {
  if (amount <= 0) throw new Error('amount must be positive');
  await mutateQuantity(id, amount, note, 'restock');
}

/** Рекордер операций: id = `${deviceId}:${seq}`, seq инкрементится в meta. */
async function recordOp(input: {
  type: OpType; itemId: string | null; trackId: string | null; delta: number | null; note: string;
}): Promise<void> {
  const device = await deviceId();
  const seqRow = await db.meta.get('deviceSeq');
  const seq = (Number((seqRow?.value as number | undefined) ?? 0)) + 1;
  await db.meta.put({ key: 'deviceSeq', value: seq });
  const household = await getHousehold();
  const op: Op = {
    id: `${device}:${seq}`,
    deviceId: device,
    deviceSeq: seq,
    type: input.type,
    itemId: input.itemId,
    trackId: input.trackId,
    delta: input.delta,
    deviceLabel: household?.deviceLabel ?? '',
    when: Date.now(),
    note: input.note,
  };
  await db.ops.put(op);
}

/** Полный локальный срез для merge-движка (LocalState живёт в types.ts, Task 2). */
export async function loadHouseholdData(): Promise<LocalState> {
  const [household, deviceProfile, trackingMethods, tracks, categories, items, ops] = await Promise.all([
    getHousehold(), getDeviceProfile(),
    db.trackingMethods.toArray(), db.tracks.toArray(),
    db.categories.toArray(), db.items.toArray(), db.ops.toArray(),
  ]);
  return {
    household: household ?? null,
    deviceProfile: deviceProfile ?? null,
    trackingMethods, tracks, categories, items, ops,
  };
}

export async function upsertMany<T extends { id: string }>(table: Table<T, string>, rows: T[]): Promise<void> {
  await table.bulkPut(rows);
}