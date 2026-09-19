// src/db/test-helpers.ts
import { db, createHousehold, spendItem } from './db';
import { genId } from '../logic/ids';
import type { Category, Household, Item, Track } from '../types';

export async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}

export async function getOrCreateHouseholdForTest(): Promise<Household> {
  const existing = await db.household.orderBy('createdAt').first();
  if (existing) return existing;
  return createHousehold({ name: 'Тестовый дом', deviceLabel: 'Тест', warnDays: 7 });
}

export async function createTestCategory(trackId: string, name = 'Тестовая категория'): Promise<Category> {
  const cat: Category = {
    id: genId('cat'), trackId, name, emoji: '📦', trackingMethodId: null, sortOrder: 0,
    updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
  };
  await db.categories.put(cat);
  return cat;
}

export async function createTestItem(
  categoryId: string, qty: number, overrides: Partial<Item> = {},
): Promise<Item> {
  const item: Item = {
    id: genId('itm'), categoryId, name: overrides.name ?? 'Тестовая позиция', unit: 'шт',
    quantity: qty, minThreshold: null, maxThreshold: null, expiresAt: null, packSize: null,
    trackExpiry: false, trackQuantity: false, notes: '', createdAt: Date.now(),
    updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
    ...overrides,
  };
  await db.items.put(item);
  return item;
}

/**
 * Кортежная фикстура: [track, cat, item1, item2].
 * Трек «Аптечка» 💊, категория «Аптечка дома» 🏠,
 * item1 «Найз» (qty 10, min 5, просрочена вчера), item2 «Пластыри» (qty 3, min 5).
 * Делает 2 списания (−1 каждому): ops = 2, возвращает СВЕЖИЕ post-spend позиции
 * (Найз 9, Пластыри 2) — для тестов статусов/экспорта/импорта.
 */
export async function createTestTrack(): Promise<[Track, Category, Item, Item]> {
  await getOrCreateHouseholdForTest();
  const track: Track = {
    id: genId('trk'), name: 'Аптечка', emoji: '💊', sortOrder: 0, createdAt: Date.now(),
    updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
  };
  const cat = await createTestCategory(track.id, 'Аптечка дома');
  cat.emoji = '🏠'; // фикстура не создаёт отдельный трек-test-хелпер для эмодзи
  await db.categories.put(cat);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const i1 = await createTestItem(cat.id, 10, {
    name: 'Найз', minThreshold: 5, expiresAt: yesterday, trackExpiry: true, trackQuantity: true,
  });
  const i2 = await createTestItem(cat.id, 3, {
    name: 'Пластыри', minThreshold: 5, trackQuantity: true,
  });
  await spendItem(i1.id, 1, 'фикстура');
  await spendItem(i2.id, 1, 'фикстура');
  const item1 = (await db.items.get(i1.id))!;
  const item2 = (await db.items.get(i2.id))!;
  return [track, cat, item1, item2];
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