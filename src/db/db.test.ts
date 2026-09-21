// src/db/db.test.ts
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureOnboarding, spendItem } from './db';
import { listPlaces, listTypes, saveType, softDeleteType } from './catalog';
import { DEFAULT_TRACKING_METHODS, DEFAULT_UNITS } from '../constants';
import { createTestTrack, resetDb } from './test-helpers';

/** Пишет настоящую базу v1 в fake-indexeddb (наш db объявляет v1..v2). */
async function seedLegacyV1(): Promise<void> {
  const legacy = new Dexie('family-stock-tracker');
  legacy.version(1).stores({
    household: 'id, createdAt', deviceProfile: 'id', trackingMethods: 'id', tracks: 'id',
    categories: 'id, trackId', items: 'id, categoryId', ops: 'id, itemId, when', meta: 'key',
  });
  await legacy.open();
  await legacy.table('categories').bulkPut([
    { id: 'cat_1', trackId: 'trk_1', name: 'Аптечка', emoji: '🏠', trackingMethodId: null, sortOrder: 0,
      updatedAt: 1, updatedBy: 'd', deletedAt: null },
  ]);
  await legacy.table('items').bulkPut([
    { id: 'itm_1', categoryId: 'cat_1', name: 'Найз', unit: 'шт', quantity: 4, minThreshold: 1,
      maxThreshold: null, expiresAt: null, packSize: null, trackExpiry: false, trackQuantity: true,
      notes: '', createdAt: 1, updatedAt: 1, updatedBy: 'd', deletedAt: null },
  ]);
  await legacy.table('trackingMethods').bulkPut([
    { id: 'tm_expiry', name: 'Срок годности', flags: { expiry: true, quantity: false }, sortOrder: 0,
      updatedAt: 1, updatedBy: 'seed', deletedAt: null },
  ]);
  await legacy.close();
}

describe('db', () => {
  beforeEach(resetDb);

  it('seed: дефолтные способы отслеживания и единицы появляются без дома', async () => {
    await ensureOnboarding();
    expect(await db.trackingMethods.count()).toBe(DEFAULT_TRACKING_METHODS.length);
    expect(await db.units.count()).toBe(DEFAULT_UNITS.length);
    expect(await db.household.count()).toBe(0);
  });

  it('списание уменьшает количество и пишет op', async () => {
    const [, , item1] = await createTestTrack(); // item1 «Найз»: qty 10 → 9 (фикстура −1)
    await spendItem(item1.id, 3, 'обед');
    const got = await db.items.get(item1.id);
    expect(got!.quantity).toBe(6); // 10 − 1 (фикстура) − 3
    const ops = (await db.ops.toArray()).sort((a, b) => a.deviceSeq - b.deviceSeq);
    expect(ops).toHaveLength(3); // 2 списания фикстуры + 1 наше
    expect(ops[2].type).toBe('spend');
    expect(ops[2].delta).toBe(-3);
  });

  it('миграция v1→v3: категория → место + тип, item получает placeId/typeId, единицы засеяны', async () => {
    await db.delete(); // удалить v2-базу, созданную resetDb (открыть поверх версию 1 нельзя)
    await seedLegacyV1(); // создать чистую v1-базу с данными
    await db.open(); // запускает upgrade v1→v2
    const places = await db.places.toArray();
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ id: 'cat_1', name: 'Аптечка' });
    expect(places[0]).not.toHaveProperty('trackingMethodId');
    const types = await db.types.toArray();
    expect(types).toHaveLength(1);
    expect(types[0].trackingMethodId).toBe('tm_expiry');
    const item = await db.items.get('itm_1') as unknown as { placeId: string; typeId: string };
    expect(item.placeId).toBe('cat_1');
    expect(item.typeId).toBe(types[0].id);
    expect(await db.units.count()).toBe(DEFAULT_UNITS.length);
  });

  it('catalog: listPlaces фильтрует могилки и сортирует по sortOrder', async () => {
    await db.places.bulkPut([
      { id: 'plc_1', trackId: 'trk_1', name: 'З', emoji: '🏠', sortOrder: 2, updatedAt: 1, updatedBy: 'd', deletedAt: null },
      { id: 'plc_2', trackId: 'trk_1', name: 'А', emoji: '🍳', sortOrder: 0, updatedAt: 1, updatedBy: 'd', deletedAt: 5 },
      { id: 'plc_3', trackId: 'trk_1', name: 'Б', emoji: '📦', sortOrder: 1, updatedAt: 1, updatedBy: 'd', deletedAt: null },
    ]);
    const places = await listPlaces('trk_1');
    expect(places.map(p => p.id)).toEqual(['plc_3', 'plc_1']);
  });

  it('catalog: softDeleteType ставит deletedAt и убирает из списка', async () => {
    await saveType({
      id: 'typ_1', name: 'Аптечка', emoji: '🏠', trackingMethodId: 'tm_expiry', sortOrder: 0,
    });
    expect(await listTypes()).toHaveLength(1);
    await softDeleteType('typ_1');
    const rows = await db.types.toArray();
    expect(rows[0].deletedAt).not.toBeNull();
    expect(await listTypes()).toHaveLength(0);
  });
});