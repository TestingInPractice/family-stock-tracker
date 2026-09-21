import type { Transaction } from 'dexie';
import type { Category, Item, TrackingMethod } from '../types';
import { DEFAULT_UNITS } from '../constants';
import { planV2 } from '../logic/v2upgrade';

/** Временное пересечение: на v1 у items нет v2-полей (появляются в Task 3). */
type V1Item = Item & { placeId?: string; typeId?: string; categoryId: string };

/** v1→v2: категории → места+типы (planV2), items получают placeId/typeId, сид единиц. */
export async function migrateV2(tx: Transaction): Promise<void> {
  const now = Date.now();
  const categories = await tx.table<Category, string>('categories').toArray();
  const methods = await tx.table<TrackingMethod, string>('trackingMethods').toArray();
  const result = planV2(categories, methods, now);
  const categoryById = new Map(categories.map(c => [c.id, c]));
  await tx.table('places').bulkPut(
    result.places.map(p => {
      const src = categoryById.get(p.id);
      return src ? { ...p, updatedAt: src.updatedAt, updatedBy: src.updatedBy, deletedAt: src.deletedAt } : p;
    }),
  );
  await tx.table('types').bulkPut(
    result.types.map(t => ({ ...t, updatedAt: now, updatedBy: 'seed', deletedAt: null })),
  );
  if (result.seedExpiryMethod) await tx.table('trackingMethods').put(result.seedExpiryMethod);
  if ((await tx.table('units').count()) === 0) {
    await tx.table('units').bulkPut(DEFAULT_UNITS.map(u => ({ ...u, updatedAt: now, updatedBy: 'seed' })));
  }
  const items = await tx.table<V1Item, string>('items').toArray();
  await tx.table('items').bulkPut(
    items.map(i => ({
      ...i,
      placeId: i.placeId ?? i.categoryId,
      typeId: i.typeId ?? result.typeIdByCategoryId.get(i.categoryId) ?? result.types[0]?.id ?? '',
    })),
  );
}