import { describe, expect, it } from 'vitest';
import { planV2, type V2UpgradeResult } from './v2upgrade';
import type { Category, TrackingMethod } from '../types';

const CATEGORY = (over: Partial<Category>): Category => ({
  id: 'cat_1', trackId: 'trk_1', name: 'Аптечка', emoji: '🏠', trackingMethodId: 'tm_expiry', sortOrder: 0,
  updatedAt: 1, updatedBy: 'd', deletedAt: null, ...over,
});
const METHOD = (over: Partial<TrackingMethod>): TrackingMethod => ({
  id: 'tm_expiry', name: 'Срок годности', flags: { expiry: true, quantity: false }, sortOrder: 0,
  updatedAt: 1, updatedBy: 'seed', deletedAt: null, ...over,
});

describe('planV2', () => {
  it('место = категория без trackingMethodId, id сохраняется', () => {
    const r: V2UpgradeResult = planV2([CATEGORY({})], [METHOD({})], 10);
    expect(r.places).toEqual([{ id: 'cat_1', trackId: 'trk_1', name: 'Аптечка', emoji: '🏠', sortOrder: 0 }]);
  });

  it('тип наследует способ; тип создаётся один на имя; typeIdByCategoryId покрывает все категории', () => {
    const cats = [
      CATEGORY({ id: 'c1', name: 'Аптечка', emoji: '🏠', trackingMethodId: 'tm_expiry', sortOrder: 0 }),
      CATEGORY({ id: 'c2', name: 'Аптечка', emoji: '💊', trackingMethodId: null, sortOrder: 1 }),
    ];
    const r = planV2(cats, [METHOD({})], 10);
    expect(r.types).toHaveLength(1);
    expect(r.types[0]).toMatchObject({ name: 'Аптечка', emoji: '🏠', trackingMethodId: 'tm_expiry', sortOrder: 0 });
    expect(r.typeIdByCategoryId.get('c1')).toBe(r.types[0].id);
    expect(r.typeIdByCategoryId.get('c2')).toBe(r.types[0].id);
    expect(r.seedExpiryMethod).toBeNull();
  });

  it('категория без способа + нет «Срок годности» → создаётся сид-метод tm_expiry', () => {
    const r = planV2([CATEGORY({ trackingMethodId: null })], [], 10);
    expect(r.seedExpiryMethod).toEqual({
      id: 'tm_expiry', name: 'Срок годности', flags: { expiry: true, quantity: false }, sortOrder: 0,
      updatedAt: 10, updatedBy: 'seed', deletedAt: null,
    });
    expect(r.types[0].trackingMethodId).toBe('tm_expiry');
  });

  it('могилка категории тоже получает typeId (маппинг полный)', () => {
    const r = planV2([
      CATEGORY({ id: 'c1', name: 'Аптечка', sortOrder: 0 }),
      CATEGORY({ id: 'c2', name: 'Расходники', sortOrder: 1, deletedAt: 5 }),
    ], [METHOD({})], 10);
    expect(r.typeIdByCategoryId.get('c2')).toBeDefined();
    expect(r.types.map(t => t.name)).toEqual(['Аптечка', 'Расходники']);
  });

  it('ссылка на неживой способ → фолбэк на сид-метод', () => {
    const r = planV2([CATEGORY({ trackingMethodId: 'tm_dead' })], [METHOD({ id: 'tm_dead', deletedAt: 5 })], 10);
    expect(r.types[0].trackingMethodId).toBe('tm_expiry');
    expect(r.seedExpiryMethod).not.toBeNull();
  });
});