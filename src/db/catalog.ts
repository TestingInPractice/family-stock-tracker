import { db, type PlaceRow, type TypeRow, type UnitRow } from './db';

function liveRows<T extends { sortOrder: number }>(rows: T[], isLive: (r: T) => boolean): T[] {
  return rows.filter(isLive).sort((a, b) => a.sortOrder - b.sortOrder);
}

function deletedAtField<T>(row: T): number | null {
  return (row as Record<string, unknown>).deletedAt === undefined
    ? null
    : (row as { deletedAt: number | null }).deletedAt;
}

export async function listPlaces(trackId: string): Promise<PlaceRow[]> {
  const rows = await db.places.where('trackId').equals(trackId).toArray();
  return liveRows(rows as unknown as PlaceRow[], p => deletedAtField(p) === null);
}

export async function savePlace(place: PlaceRow): Promise<void> {
  const deviceId = await db.meta.get('deviceId').then(r => String(r?.value ?? 'unknown'));
  await db.places.put({ ...place, updatedAt: Date.now(), updatedBy: deviceId, deletedAt: null });
}

export async function listTypes(): Promise<TypeRow[]> {
  const rows = await db.types.toArray();
  return liveRows(rows as unknown as TypeRow[], t => deletedAtField(t) === null);
}

export async function saveType(type: TypeRow): Promise<void> {
  const deviceId = await db.meta.get('deviceId').then(r => String(r?.value ?? 'unknown'));
  await db.types.put({ ...type, updatedAt: Date.now(), updatedBy: deviceId, deletedAt: null });
}

export async function softDeleteType(id: string): Promise<void> {
  const row = await db.types.get(id);
  if (!row) return;
  await db.types.put({ ...row, deletedAt: Date.now() });
}

export async function listUnits(): Promise<UnitRow[]> {
  const rows = await db.units.toArray();
  return liveRows(rows as unknown as UnitRow[], u => deletedAtField(u) === null);
}

export async function saveUnit(unit: UnitRow): Promise<void> {
  const deviceId = await db.meta.get('deviceId').then(r => String(r?.value ?? 'unknown'));
  await db.units.put({ ...unit, updatedAt: Date.now(), updatedBy: deviceId, deletedAt: null });
}

export async function softDeleteUnit(id: string): Promise<void> {
  const row = await db.units.get(id);
  if (!row) return;
  await db.units.put({ ...row, deletedAt: Date.now() });
}