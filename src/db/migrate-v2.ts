import type { Transaction } from 'dexie';
import type { CategoryV1, Item, ItemV1, TrackingMethod } from '../types';
import { DEFAULT_UNITS } from '../constants';
import { planV2 } from '../logic/v2upgrade';

/** v1→v2: категории → места+типы (planV2), items получают placeId/typeId, сид единиц. */
export async function migrateV2(tx: Transaction): Promise<void> {
  const now = Date.now();
  const categories = await tx.table<CategoryV1, string>('categories').toArray();
  const methods = await tx.table<TrackingMethod, string>('trackingMethods').toArray();
  const result = planV2(categories, methods, now);
  await tx.table('places').bulkPut(result.places);
  await tx.table('types').bulkPut(result.types);
  if (result.seedExpiryMethod) await tx.table('trackingMethods').put(result.seedExpiryMethod);
  if ((await tx.table('units').count()) === 0) {
    await tx.table('units').bulkPut(DEFAULT_UNITS.map(u => ({ ...u, updatedAt: now, updatedBy: 'seed' })));
  }
  const items = await tx.table<ItemV1, string>('items').toArray();
  await tx.table('items').bulkPut(
    items.map(i => ({
      ...i,
      placeId: i.categoryId,
      typeId: result.typeIdByCategoryId.get(i.categoryId) ?? result.types[0]?.id ?? '',
    })),
  );
}

/** Строка items в переходный период v2: тип уже v2, но на диске может остаться ключ categoryId. */
type ItemMaybeV2 = Item & { categoryId?: string };

/** v2→v3: таблица categories дропнута схемой; из items уходит categoryId, место/тип гарантированы. */
export async function migrateV3(tx: Transaction): Promise<void> {
  const items = await tx.table<ItemMaybeV2, string>('items').toArray();
  await tx.table('items').bulkPut(
    items.map(({ categoryId: _drop, ...rest }) => ({
      ...rest,
      placeId: rest.placeId ?? '',
      typeId: rest.typeId ?? '',
    })),
  );
}