export type Role = 'admin' | 'member';
export type Tab = 'dashboard' | 'tracks' | 'add' | 'spend' | 'more';

export interface SyncFields {
  id: string;
  updatedAt: number;
  updatedBy: string;
  deletedAt: number | null;
}

export interface Household extends SyncFields {
  name: string;
  warnDays: number;
  deviceLabel: string;
  createdAt: number;
}

export interface DeviceProfile extends SyncFields {
  role: Role;
  pinHash: string | null;
}

export interface TrackingMethod extends SyncFields {
  name: string;
  flags: { expiry: boolean; quantity: boolean };
  sortOrder: number;
}

export interface Track extends SyncFields {
  name: string;
  emoji: string;
  sortOrder: number;
  createdAt: number;
}

export interface Category extends SyncFields {
  trackId: string;
  name: string;
  emoji: string;
  trackingMethodId: string | null;
  sortOrder: number;
}

export interface Item extends SyncFields {
  categoryId: string;
  name: string;
  unit: string;
  quantity: number;
  minThreshold: number | null;
  maxThreshold: number | null;
  expiresAt: string | null; // YYYY-MM-DD
  packSize: number | null;  // «упаковка = N шт»
  trackExpiry: boolean;
  trackQuantity: boolean;
  notes: string;
  createdAt: number;
}

export type OpType = 'add' | 'spend' | 'restock' | 'edit' | 'delete' | 'import-conflict';

export interface Op {
  id: string; // `${deviceId}:${deviceSeq}`
  deviceId: string;
  deviceSeq: number;
  type: OpType;
  itemId: string | null;
  trackId: string | null;
  delta: number | null;
  deviceLabel: string;
  when: number;
  note: string;
}

export type ItemStatus = 'expired' | 'expiring' | 'low' | 'excess' | 'ok';

// Позиция шаблона трека (экспорт/импорт вне семейства):
// categoryId хранит ИМЯ категории, а не id (категорий в целевой базе ещё нет).
export interface TemplateItem {
  name: string;
  unit: string;
  quantity: number;
  minThreshold: number | null;
  maxThreshold: number | null;
  expiresAt: string | null;
  packSize: number | null;
  trackExpiry: boolean;
  trackQuantity: boolean;
  notes: string;
  categoryId: string;
}

export interface HouseholdEnvelope {
  format: 'household-backup';
  version: 1;
  exportedAt: number;
  deviceId: string;
  deviceLabel: string;
  household: Household;
  trackingMethods: TrackingMethod[];
  tracks: Track[];
  categories: Category[];
  items: Item[];
  ops: Op[];
}

export interface TrackTemplateEnvelope {
  format: 'track-template';
  version: 1;
  trackName: string;
  trackEmoji: string;
  categories: { name: string; emoji: string }[];
  items: TemplateItem[]; // categoryId = имя категории; без журнала и sync-полей
}

export interface ImportSummary {
  added: number;
  updated: number;
  conflicts: number;
  deleted: number;
}

// Полный локальный срез (используется db.ts и merge.ts; определяем здесь,
// чтобы db.ts (Task 3) мог работать с ним до появления merge.ts — Task 4).
export interface LocalState {
  household: Household | null;
  deviceProfile: DeviceProfile | null;
  trackingMethods: TrackingMethod[];
  tracks: Track[];
  categories: Category[];
  items: Item[];
  ops: Op[];
}

// Результат merge — записи для upsert в базу.
// deviceProfile отсутствует: он устройство-локальный и не входит в envelope.
export interface MergedState {
  household: Household | null;
  trackingMethods: TrackingMethod[];
  tracks: Track[];
  categories: Category[];
  items: Item[];
  ops: Op[];
}