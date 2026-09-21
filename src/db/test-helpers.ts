// src/db/test-helpers.ts
import { db, createHousehold, spendItem } from './db';
import { genId } from '../logic/ids';
import type { Household, Item, Place, Track, Type } from '../types';

export async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}

export async function getOrCreateHouseholdForTest(): Promise<Household> {
  const existing = await db.household.orderBy('createdAt').first();
  if (existing) return existing;
  return createHousehold({ name: 'Тестовый дом', deviceLabel: 'Тест', warnDays: 7 });
}

/** Тип позиции каталога; методика по умолчанию — tm_expiry (сидится онбордингом). */
export async function createTestType(name = 'Лекарства', trackingMethodId = 'tm_expiry'): Promise<Type> {
  const type: Type = {
    id: genId('typ'), name, emoji: '💊', trackingMethodId, sortOrder: 0,
    updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
  };
  await db.types.put(type);
  return type;
}

export async function createTestPlace(trackId: string, name = 'Аптечка дома'): Promise<Place> {
  const place: Place = {
    id: genId('plc'), trackId, name, emoji: '📦', sortOrder: 0,
    updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
  };
  await db.places.put(place);
  return place;
}

export async function createTestItem(
  placeId: string, typeId: string, qty: number, overrides: Partial<Item> = {},
): Promise<Item> {
  const item: Item = {
    id: genId('itm'), placeId, typeId, name: overrides.name ?? 'Тестовая позиция', unit: 'шт',
    quantity: qty, minThreshold: null, maxThreshold: null, expiresAt: null, packSize: null,
    trackExpiry: false, trackQuantity: false, notes: '', createdAt: Date.now(),
    updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
    ...overrides,
  };
  await db.items.put(item);
  return item;
}

/**
 * Кортежная фикстура: [track, place, item1, item2].
 * Трек «Аптечка» 💊, место «Аптечка дома» 🏠, тип «Лекарства» 💊,
 * item1 «Найз» (qty 10, min 5, просрочена вчера), item2 «Пластыри» (qty 3, min 5).
 * Делает 2 списания (−1 каждому): ops = 2, возвращает СВЕЖИЕ post-spend позиции
 * (Найз 9, Пластыри 2) — для тестов статусов/экспорта/импорта.
 */
export async function createTestTrack(): Promise<[Track, Place, Item, Item]> {
  await getOrCreateHouseholdForTest();
  const track: Track = {
    id: genId('trk'), name: 'Аптечка', emoji: '💊', sortOrder: 0, createdAt: Date.now(),
    updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
  };
  await db.tracks.put(track); // фикстура должна персистить трек (экспорт читает db.tracks)
  const place = await createTestPlace(track.id, 'Аптечка дома');
  place.emoji = '🏠';
  await db.places.put(place);
  const type = await createTestType('Лекарства');
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const i1 = await createTestItem(place.id, type.id, 10, {
    name: 'Найз', minThreshold: 5, expiresAt: yesterday, trackExpiry: true, trackQuantity: true,
  });
  const i2 = await createTestItem(place.id, type.id, 3, {
    name: 'Пластыри', minThreshold: 5, trackQuantity: true,
  });
  await spendItem(i1.id, 1, 'фикстура');
  await spendItem(i2.id, 1, 'фикстура');
  const item1 = (await db.items.get(i1.id))!;
  const item2 = (await db.items.get(i2.id))!;
  return [track, place, item1, item2];
}

export async function softDeleteTestItem(itemId: string): Promise<void> {
  const item = await db.items.get(itemId);
  if (!item) return;
  await db.items.put({ ...item, deletedAt: Date.now(), updatedAt: Date.now(), updatedBy: 'test' });
}

export async function findTestItem(name: string): Promise<Item | undefined> {
  const all = await db.items.toArray();
  return all.find(i => i.name === name);
}