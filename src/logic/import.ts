import { db, loadHouseholdData, upsertMany } from '../db/db';
import { mergeEnvelope } from './merge';
import { genId, syncMeta } from './ids';
import { planV2 } from './v2upgrade';
import type {
  HouseholdEnvelope, HouseholdEnvelopeV1, HouseholdEnvelopeV2, ImportSummary, Item, Place, Track,
  TrackTemplateEnvelope, Type,
} from '../types';

export function parseHouseholdEnvelope(json: string): HouseholdEnvelope {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('Файл не является корректным JSON'); }
  const env = raw as HouseholdEnvelope;
  if (env?.format !== 'household-backup' || (env.version !== 1 && env.version !== 2) || !env.household?.id) {
    throw new Error('Незнакомый формат файла: нужен бэкап дома (версия 1 или 2)');
  }
  return env;
}

export function parseTrackTemplate(json: string): TrackTemplateEnvelope {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('Файл не является корректным JSON'); }
  const tpl = raw as TrackTemplateEnvelope;
  if (tpl?.format !== 'track-template' || tpl.version !== 2 || !tpl.trackName || !Array.isArray(tpl.items)) {
    throw new Error('Незнакомый формат файла: нужен шаблон трека (версия 2)');
  }
  return tpl;
}

/** v1-бэкап → формат v2: категории → места+типы (planV2), items получают placeId/typeId. */
export function upgradeEnvelopeV1(env: HouseholdEnvelopeV1): HouseholdEnvelopeV2 {
  const result = planV2(env.categories, env.trackingMethods, Date.now());
  const typeIdByCategoryId = result.typeIdByCategoryId;
  return {
    format: 'household-backup',
    version: 2,
    exportedAt: env.exportedAt,
    deviceId: env.deviceId,
    deviceLabel: env.deviceLabel,
    household: env.household,
    trackingMethods: result.seedExpiryMethod
      ? [...env.trackingMethods, result.seedExpiryMethod]
      : env.trackingMethods,
    tracks: env.tracks,
    types: result.types,
    units: [],
    places: result.places,
    items: env.items.map(({ categoryId, ...rest }) => ({
      ...rest,
      placeId: categoryId,
      typeId: typeIdByCategoryId.get(categoryId) ?? result.types[0]?.id ?? '',
    })),
    ops: env.ops,
  };
}

/** Двухфазный импорт: предпросмотр счётчиков БЕЗ записи в БД (UI просит подтверждение). */
export async function buildImportPreview(env: HouseholdEnvelope): Promise<ImportSummary> {
  const envV2 = env.version === 1 ? upgradeEnvelopeV1(env) : env;
  const local = await loadHouseholdData();
  return mergeEnvelope(envV2, local).summary;
}

export async function importHouseholdEnvelope(env: HouseholdEnvelope): Promise<ImportSummary> {
  const envV2 = env.version === 1 ? upgradeEnvelopeV1(env) : env;
  const local = await loadHouseholdData();
  const { records, summary } = mergeEnvelope(envV2, local);
  await db.transaction(
    'rw',
    [db.household, db.trackingMethods, db.tracks, db.types, db.units, db.places, db.items, db.ops],
    async () => {
      if (records.household) await upsertMany(db.household, [records.household]);
      await upsertMany(db.trackingMethods, records.trackingMethods);
      await upsertMany(db.tracks, records.tracks);
      await upsertMany(db.types, records.types);
      await upsertMany(db.units, records.units);
      await upsertMany(db.places, records.places);
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

  // placeName в TemplateItem — это ИМЯ места; новый трек получает свои места (в целевом треке их ещё нет)
  const placeIdByName = new Map<string, string>();
  const places: Place[] = tpl.places.map((p, i) => {
    const id = genId('plc');
    placeIdByName.set(p.name, id);
    return { id, trackId, name: p.name, emoji: p.emoji, sortOrder: i, ...syncMeta(device), deletedAt: null };
  });
  const firstPlaceId = places[0]?.id ?? '';

  // typeName — ИМЯ типа: ищем в каталоге дома, при отсутствии создаём (метод по умолчанию)
  const liveTypes = (await db.types.toArray()).filter(t => t.deletedAt === null);
  const defaultMethodId = (await db.trackingMethods.toArray()).find(m => m.deletedAt === null)?.id ?? 'tm_expiry';
  const typeIdByName = new Map<string, string>();
  const newTypes: Type[] = [];
  const resolveTypeId = (name: string): string => {
    const known = typeIdByName.get(name);
    if (known) return known;
    const live = liveTypes.find(t => t.name === name);
    if (live) {
      typeIdByName.set(name, live.id);
      return live.id;
    }
    const id = genId('typ');
    newTypes.push({
      id, name, emoji: '📦', trackingMethodId: defaultMethodId,
      sortOrder: Math.max(0, ...liveTypes.map(t => t.sortOrder), ...newTypes.map(t => t.sortOrder)) + 1,
      ...syncMeta(device), deletedAt: null,
    });
    typeIdByName.set(name, id);
    return id;
  };
  const typeId = (name: string): string =>
    name ? resolveTypeId(name) : (liveTypes[0]?.id ?? resolveTypeId('Разное'));

  const items: Item[] = tpl.items.map(it => ({
    id: genId('itm'),
    placeId: placeIdByName.get(it.placeName) ?? firstPlaceId,
    typeId: typeId(it.typeName),
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

  await db.transaction('rw', db.tracks, db.places, db.types, db.items, async () => {
    await db.tracks.put(track);
    if (places.length) await db.places.bulkPut(places);
    if (newTypes.length) await db.types.bulkPut(newTypes);
    if (items.length) await db.items.bulkPut(items);
  });
  return trackId;
}