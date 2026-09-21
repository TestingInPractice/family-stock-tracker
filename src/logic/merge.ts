import type {
  HouseholdEnvelopeV2, ImportSummary, LocalState, MergedState, Op, SyncFields,
} from '../types';

function recordKey<T extends SyncFields>(r: T): string { return r.id; }
function sameFields<T>(a: T, b: T): boolean { return JSON.stringify(a) === JSON.stringify(b); }

/** Слияние списка записей: LWW по updatedAt, могилки, конфликт-эвристика. */
export function mergeLists<T extends SyncFields>(
  local: T[],
  incoming: T[],
  exportedAt: number,
): { records: T[]; summary: ImportSummary } {
  const byId = new Map<string, T>(local.map(r => [recordKey(r), r]));
  const summary: ImportSummary = { added: 0, updated: 0, conflicts: 0, deleted: 0 };
  for (const inc of incoming) {
    const loc = byId.get(recordKey(inc));
    if (!loc) {
      if (inc.deletedAt === null) summary.added++;
      byId.set(recordKey(inc), inc);
      continue;
    }
    if (inc.deletedAt !== null && inc.deletedAt > loc.updatedAt) {
      byId.set(recordKey(loc), { ...loc, deletedAt: inc.deletedAt, updatedAt: inc.deletedAt });
      summary.deleted++;
      continue;
    }
    if (inc.deletedAt !== null) continue; // могилка старше — игнорируем
    if (inc.updatedAt > loc.updatedAt) {
      const localChangedAfterExport = loc.updatedAt > exportedAt && !sameFields(loc, inc);
      if (localChangedAfterExport) summary.conflicts++;
      else summary.updated++;
      byId.set(recordKey(inc), inc);
      continue;
    }
  }
  return { records: [...byId.values()], summary };
}

/** Append-only union журнала по id устройства:seq, без потерь. */
export function mergeOps(local: Op[], incoming: Op[]): Op[] {
  const byId = new Map<string, Op>();
  for (const o of [...local, ...incoming]) byId.set(o.id, o);
  return [...byId.values()].sort((a, b) => a.deviceSeq - b.deviceSeq);
}

/** Полное слияние envelope v2 с локальным срезом (LocalState): результат — MergedState для upsertMany. */
export function mergeEnvelope(
  env: HouseholdEnvelopeV2,
  local: LocalState,
): { records: MergedState; summary: ImportSummary } {
  const trackingMethods = mergeLists(local.trackingMethods, env.trackingMethods, env.exportedAt);
  const tracks = mergeLists(local.tracks, env.tracks, env.exportedAt);
  const types = mergeLists(local.types, env.types, env.exportedAt);
  const units = mergeLists(local.units, env.units, env.exportedAt);
  const places = mergeLists(local.places, env.places, env.exportedAt);
  const items = mergeLists(local.items, env.items, env.exportedAt);
  const household = mergeLists(
    local.household ? [local.household] : [],
    [env.household],
    env.exportedAt,
  );

  const sum = (...parts: ImportSummary[]): ImportSummary => ({
    added: parts.reduce((a, p) => a + p.added, 0),
    updated: parts.reduce((a, p) => a + p.updated, 0),
    conflicts: parts.reduce((a, p) => a + p.conflicts, 0),
    deleted: parts.reduce((a, p) => a + p.deleted, 0),
  });

  return {
    records: {
      household: household.records[0] ?? env.household,
      trackingMethods: trackingMethods.records,
      tracks: tracks.records,
      types: types.records,
      units: units.records,
      places: places.records,
      items: items.records,
      ops: mergeOps(local.ops, env.ops),
    },
    summary: sum(
      trackingMethods.summary, tracks.summary,
      types.summary, units.summary, places.summary, items.summary, household.summary,
    ),
  };
}