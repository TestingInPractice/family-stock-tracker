import { db, loadHouseholdData, upsertMany } from '../db/db';
import { mergeEnvelope } from './merge';
import { genId, syncMeta } from './ids';
import type {
  Category, HouseholdEnvelope, ImportSummary, Item, Track, TrackTemplateEnvelope,
} from '../types';

export function parseHouseholdEnvelope(json: string): HouseholdEnvelope {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('Файл не является корректным JSON'); }
  const env = raw as HouseholdEnvelope;
  if (env?.format !== 'household-backup' || env.version !== 1 || !env.household?.id) {
    throw new Error('Незнакомый формат файла: нужен бэкап дома (версия 1)');
  }
  return env;
}

export function parseTrackTemplate(json: string): TrackTemplateEnvelope {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('Файл не является корректным JSON'); }
  const tpl = raw as TrackTemplateEnvelope;
  if (tpl?.format !== 'track-template' || tpl.version !== 1 || !tpl.trackName || !Array.isArray(tpl.items)) {
    throw new Error('Незнакомый формат файла: нужен шаблон трека (версия 1)');
  }
  return tpl;
}

/** Двухфазный импорт: предпросмотр счётчиков БЕЗ записи в БД (UI просит подтверждение). */
export async function buildImportPreview(env: HouseholdEnvelope): Promise<ImportSummary> {
  const local = await loadHouseholdData();
  return mergeEnvelope(env, local).summary;
}

export async function importHouseholdEnvelope(env: HouseholdEnvelope): Promise<ImportSummary> {
  const local = await loadHouseholdData();
  const { records, summary } = mergeEnvelope(env, local);
  await db.transaction(
    'rw', [db.household, db.trackingMethods, db.tracks, db.categories, db.items, db.ops],
    async () => {
      if (records.household) await upsertMany(db.household, [records.household]);
      await upsertMany(db.trackingMethods, records.trackingMethods);
      await upsertMany(db.tracks, records.tracks);
      await upsertMany(db.categories, records.categories);
      await upsertMany(db.items, records.items);
      await upsertMany(db.ops, records.ops);
    },
  );
  return summary;
}

export async function importTrackTemplate(tpl: TrackTemplateEnvelope): Promise<string> {
  const device = String((await db.meta.get('deviceId'))?.value ?? 'unknown');
  const trackId = genId('trk');
  const now = Date.now();

  const track: Track = {
    id: trackId, name: `${tpl.trackName} (копия)`, emoji: tpl.trackEmoji, sortOrder: 0,
    createdAt: now, ...syncMeta(device), deletedAt: null,
  };

  // categoryId в TemplateItem — это ИМЯ категории; маппим имя → id новой категории
  const catIdByTemplateName = new Map<string, string>();
  const cats: Category[] = tpl.categories.map((c, i) => {
    const id = genId('cat');
    catIdByTemplateName.set(c.name, id);
    return {
      id, trackId, name: c.name, emoji: c.emoji, trackingMethodId: null, sortOrder: i,
      createdAt: now, ...syncMeta(device), deletedAt: null,
    };
  });
  const firstCatId = cats[0]?.id ?? '';

  const items: Item[] = tpl.items.map(it => ({
    id: genId('itm'),
    categoryId: catIdByTemplateName.get(it.categoryId) ?? firstCatId,
    name: it.name,
    unit: it.unit,
    quantity: it.quantity,
    minThreshold: it.minThreshold,
    maxThreshold: it.maxThreshold,
    expiresAt: null, // шаблон всегда без сроков
    packSize: it.packSize,
    trackExpiry: it.trackExpiry,
    trackQuantity: it.trackQuantity,
    notes: it.notes,
    createdAt: now,
    ...syncMeta(device),
    deletedAt: null,
  }));

  await db.transaction('rw', db.tracks, db.categories, db.items, async () => {
    await db.tracks.put(track);
    await db.categories.bulkPut(cats);
    if (items.length) await db.items.bulkPut(items);
  });
  return trackId;
}