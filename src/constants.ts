import type { Item, ItemStatus, TrackingMethod, Unit } from './types';

// Единицы каталога: фикс. id, чтобы bulkPut при онбординге был идемпотентен.
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

export const EMPTY_ITEM = (placeId: string, typeId: string): Item => ({
  id: '', placeId, typeId, name: '', unit: 'шт', quantity: 0, minThreshold: null,
  maxThreshold: null, expiresAt: null, packSize: null, trackExpiry: false,
  trackQuantity: false, notes: '', createdAt: 0, updatedAt: 0, updatedBy: '', deletedAt: null,
});

export const UI_TEXTS = {
  addPlace: 'Добавить место',
  placeNamePrompt: 'Название места (например, аптечка дома)',
  placeEmojiPrompt: 'Эмодзи места (по умолчанию 📦)',
  minPlaceholder: 'купить при ≤ N',
  maxPlaceholder: 'избыток при ≥ N',
  typeSection: 'Типы позиций',
  unitSection: 'Единицы',
  emptyAddForm: 'Сначала создайте трек и место в нём, а тип позиции — в админке',
} as const;