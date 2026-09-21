import { genId } from './ids';
import type { CategoryV1, Place, TrackingMethod, Type } from '../types';

export interface V2UpgradeResult {
  places: Place[];
  types: Type[];
  typeIdByCategoryId: Map<string, string>;
  seedExpiryMethod: TrackingMethod | null;
}

const SEED_METHOD_NAME = 'Срок годности';
const SEED_METHOD_ID = 'tm_expiry';

/**
 * Единый конвертер v1→v2: категории → (места, типы, маппинг categoryId→typeId).
 * Используется миграцией Dexie (db/migrate-v2.ts) и импортом файл-бэкапа v1 (logic/import.ts).
 * Чистая функция: без I/O, `now` передаётся для тестируемости.
 */
export function planV2(
  legacyCategories: CategoryV1[],
  trackingMethods: TrackingMethod[],
  now: number,
): V2UpgradeResult {
  const liveMethodId = (id: string | null): string | null =>
    id && trackingMethods.some(m => m.id === id && m.deletedAt === null) ? id : null;

  const seedExpiryMethod: TrackingMethod | null =
    trackingMethods.some(m => m.name === SEED_METHOD_NAME && m.deletedAt === null)
    || !legacyCategories.some(c => liveMethodId(c.trackingMethodId) === null)
      ? null
      : {
          id: SEED_METHOD_ID,
          name: SEED_METHOD_NAME,
          flags: { expiry: true, quantity: false },
          sortOrder: trackingMethods.reduce((mx, m) => Math.max(mx, m.sortOrder), -1) + 1,
          updatedAt: now,
          updatedBy: 'seed',
          deletedAt: null,
        };

  const resolveMethodId = (c: CategoryV1): string =>
    liveMethodId(c.trackingMethodId) ?? seedExpiryMethod?.id ?? SEED_METHOD_ID;

  // Места наследуют sync-поля исходной категории (updatedAt/updatedBy/deletedAt).
  const places: V2UpgradeResult['places'] = legacyCategories.map(c => ({
    id: c.id,
    trackId: c.trackId,
    name: c.name,
    emoji: c.emoji,
    sortOrder: c.sortOrder,
    updatedAt: c.updatedAt,
    updatedBy: c.updatedBy,
    deletedAt: c.deletedAt,
  }));

  const typeByIdName = new Map<string, string>();
  const typeIdByCategoryId = new Map<string, string>();
  const types: V2UpgradeResult['types'] = [];
  for (const c of [...legacyCategories].sort((a, b) => a.sortOrder - b.sortOrder)) {
    let typeId = typeByIdName.get(c.name);
    if (!typeId) {
      typeId = genId('typ');
      typeByIdName.set(c.name, typeId);
      types.push({
        id: typeId,
        name: c.name,
        emoji: c.emoji,
        trackingMethodId: resolveMethodId(c),
        sortOrder: types.length,
        updatedAt: now,
        updatedBy: 'seed',
        deletedAt: null,
      });
    }
    typeIdByCategoryId.set(c.id, typeId);
  }
  return { places, types, typeIdByCategoryId, seedExpiryMethod };
}