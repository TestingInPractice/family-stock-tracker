import { db } from './db';
import type { Place, Type, Unit } from '../types';

export async function listPlaces(trackId: string): Promise<Place[]> {
  const rows = await db.places.where('trackId').equals(trackId).toArray();
  return rows.filter(p => p.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function savePlace(place: Place): Promise<void> {
  const deviceId = await db.meta.get('deviceId').then(r => String(r?.value ?? 'unknown'));
  await db.places.put({ ...place, updatedAt: Date.now(), updatedBy: deviceId, deletedAt: null });
}

export async function listTypes(): Promise<Type[]> {
  const rows = await db.types.toArray();
  return rows.filter(t => t.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveType(type: Type): Promise<void> {
  const deviceId = await db.meta.get('deviceId').then(r => String(r?.value ?? 'unknown'));
  await db.types.put({ ...type, updatedAt: Date.now(), updatedBy: deviceId, deletedAt: null });
}

export async function softDeleteType(id: string): Promise<void> {
  const row = await db.types.get(id);
  if (!row) return;
  await db.types.put({ ...row, deletedAt: Date.now() });
}

export async function listUnits(): Promise<Unit[]> {
  const rows = await db.units.toArray();
  return rows.filter(u => u.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveUnit(unit: Unit): Promise<void> {
  const deviceId = await db.meta.get('deviceId').then(r => String(r?.value ?? 'unknown'));
  await db.units.put({ ...unit, updatedAt: Date.now(), updatedBy: deviceId, deletedAt: null });
}

export async function softDeleteUnit(id: string): Promise<void> {
  const row = await db.units.get(id);
  if (!row) return;
  await db.units.put({ ...row, deletedAt: Date.now() });
}