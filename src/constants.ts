import type { Item, ItemStatus, TrackingMethod } from './types';

export const UNITS = ['шт', 'таб', 'пак', 'кг', 'г', 'банка', 'мл', 'л'] as const;

/** Временная v2-форма единицы (в types.ts Unit появится в Task 3). */
interface Unit {
  id: string;
  name: string;
  sortOrder: number;
  updatedAt: number;
  updatedBy: string;
  deletedAt: number | null;
}

/** Единицы каталога: фикс. id, чтобы bulkPut при онбординге был идемпотентен. */
export const DEFAULT_UNITS: Unit[] = [
  { id: 'unit_sht', name: 'шт', sortOrder: 0, updatedAt: 0, updatedBy: 'seed', deletedAt: null },
  { id: 'unit_tab', name: 'таб', sortOrder: 1, updatedAt: 0, updatedBy: 'seed', deletedAt: null },
  { id: 'unit_pak', name: 'пак', sortOrder: 2, updatedAt: 0, updatedBy: 'seed', deletedAt: null },
  { id: 'unit_kg', name: 'кг', sortOrder: 3, updatedAt: 0, updatedBy: 'seed', deletedAt: null },
  { id: 'unit_g', name: 'г', sortOrder: 4, updatedAt: 0, updatedBy: 'seed', deletedAt: null },
  { id: 'unit_banka', name: 'банка', sortOrder: 5, updatedAt: 0, updatedBy: 'seed', deletedAt: null },
  { id: 'unit_ml', name: 'мл', sortOrder: 6, updatedAt: 0, updatedBy: 'seed', deletedAt: null },
  { id: 'unit_l', name: 'л', sortOrder: 7, updatedAt: 0, updatedBy: 'seed', deletedAt: null },
];

export const DEFAULT_TRACKING_METHODS: TrackingMethod[] = [
  { id: 'tm_expiry', name: 'Срок годности', flags: { expiry: true, quantity: false }, sortOrder: 0, updatedAt: 0, updatedBy: 'seed', deletedAt: null },
  { id: 'tm_qty_min', name: 'Остаток ниже минимума', flags: { expiry: false, quantity: true }, sortOrder: 1, updatedAt: 0, updatedBy: 'seed', deletedAt: null },
  { id: 'tm_both', name: 'Срок + остаток (min/max)', flags: { expiry: true, quantity: true }, sortOrder: 2, updatedAt: 0, updatedBy: 'seed', deletedAt: null },
];

export const STATUS_META: Record<ItemStatus, { label: string; emoji: string; priority: number }> = {
  expired:   { label: 'Просрочено',     emoji: '🔴', priority: 4 },
  expiring:  { label: 'Истекает',       emoji: '🟠', priority: 3 },
  low:       { label: 'Пора купить',    emoji: '🔵', priority: 2 },
  excess:    { label: 'Избыток',        emoji: '🟣', priority: 1 },
  ok:        { label: 'В норме',        emoji: '⚪', priority: 0 },
};

export const EMPTY_ITEM = (categoryId: string): Item => ({
  id: '', categoryId, name: '', unit: 'шт', quantity: 0, minThreshold: null,
  maxThreshold: null, expiresAt: null, packSize: null, trackExpiry: false,
  trackQuantity: false, notes: '', createdAt: 0, updatedAt: 0, updatedBy: '', deletedAt: null,
});