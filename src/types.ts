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

// v2: место (бывшая категория, способ уезжает в тип)
export interface Place extends SyncFields {
  trackId: string;
  name: string;
  emoji: string;
  sortOrder: number;
}

// v1-совместимая форма категории — ТОЛЬКО для чтения старых бэкапов
export type CategoryV1 = Place & { trackingMethodId: string | null };
export type ItemV1 = Omit<Item, 'placeId' | 'typeId'> & { categoryId: string };

export interface Type extends SyncFields {
  name: string;
  emoji: string;
  trackingMethodId: string; // способ отслеживания (срок/остаток)
  sortOrder: number;
}

export interface Unit extends SyncFields {
  name: string;
  sortOrder: number;
}

export interface Item extends SyncFields {
  placeId: string;       // было categoryId
  typeId: string;        // новое
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
// placeName хранит ИМЯ места, typeName — ИМЯ типа (в целевой базе их ещё нет).
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
  placeName: string;  // было categoryId (имя места в целевом треке)
  typeName: string;   // новое: имя типа (ищется в каталоге дома)
}

export interface HouseholdEnvelopeV1 {
  format: 'household-backup';
  version: 1;
  exportedAt: number;
  deviceId: string;
  deviceLabel: string;
  household: Household;
  trackingMethods: TrackingMethod[];
  tracks: Track[];
  categories: CategoryV1[];
  items: ItemV1[];
  ops: Op[];
}

export interface HouseholdEnvelopeV2 {
  format: 'household-backup';
  version: 2;
  exportedAt: number;
  deviceId: string;
  deviceLabel: string;
  household: Household;
  trackingMethods: TrackingMethod[];
  tracks: Track[];
  types: Type[];
  units: Unit[];
  places: Place[];
  items: Item[];
  ops: Op[];
}

export type HouseholdEnvelope = HouseholdEnvelopeV1 | HouseholdEnvelopeV2;

export interface TrackTemplateEnvelope {
  format: 'track-template';
  version: 2;                       // было 1
  trackName: string;
  trackEmoji: string;
  places: { name: string; emoji: string }[];   // было categories
  items: TemplateItem[];            // placeName/typeName вместо categoryId
}

export interface ImportSummary {
  added: number;
  updated: number;
  conflicts: number;
  deleted: number;
}

export interface LocalState {
  household: Household | null;
  deviceProfile: DeviceProfile | null;
  trackingMethods: TrackingMethod[];
  tracks: Track[];
  types: Type[];
  units: Unit[];
  places: Place[];
  items: Item[];
  ops: Op[];
}

// Результат merge — записи для upsert в базу.
// deviceProfile отсутствует: он устройство-локальный и не входит в envelope.
export interface MergedState {
  household: Household | null;
  trackingMethods: TrackingMethod[];
  tracks: Track[];
  types: Type[];
  units: Unit[];
  places: Place[];
  items: Item[];
  ops: Op[];
}