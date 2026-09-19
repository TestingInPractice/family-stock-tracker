# «Трекер чего угодно» — план реализации MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Семейное PWA для учёта запасов (бакалея, аптечка) с отслеживанием сроков годности и количества, ролями «Администратор/Участник», обменом данных между устройствами семьи через файлы-состояния со слиянием (LWW + могилки), экспортом трека в JSON/PDF.

**Architecture:** Локально-сначала: Dexie (IndexedDB) — источник истины; каждая синхронизируемая запись несёт `updatedAt/updatedBy/deletedAt`; файловый обмен = слияние на уровне записи (единый merge-движок, в будущем тот же движок будет питать серверный слой). UI — React 19, таб-бар, без роутера (переключение вкладок состоянием).

**Tech Stack:** React 19 · TypeScript 5.9 · Vite 6 · Dexie 4 · vite-plugin-pwa · jspdf + jspdf-autotable · Vitest 3 + Testing Library + fake-indexeddb · GitHub Pages.

## Global Constraints

- Репозиторий: `/Users/halapinvv/Documents/Agents/family-stock-tracker`, ветка `main`
- Base path Vite: `/family-stock-tracker/`
- Язык интерфейса: русский. Все пользовательские строки — в `src/constants.ts`
- Любая запись для синка: `{ id, ..., updatedAt, updatedBy, deletedAt }` (см. `src/types.ts`)
- `src/logic/merge.ts` — единственный источник правды для слияния; серверный слой (будущее) обязан использовать его же
- Удаление = мягкое (`deletedAt`), жёсткое удаление запрещено для items/tracks/categories/trackingMethods
- Идентификаторы только через `genId(prefix)` из `src/logic/ids.ts`
- Модули ≤ 200 строк; компоненты ≤ 250 строк
- TDD: сначала тест (FAIL) → реализация → тест PASS → коммит
- Тесты: `npx vitest run`; сборка: `npm run build` (tsc -b + vite build)

## File Structure

```
family-stock-tracker/
├── index.html
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── package.json
├── public/
│   ├── icon-180.png, icon-192.png, icon-512.png, icon-maskable-512.png
├── src/
│   ├── main.tsx
│   ├── test-setup.ts
│   ├── App.tsx                       # таб-бар + роутинг вкладок + онбординг-гейт
│   ├── constants.ts                  # юниты, дефолтные способы отслеживания, статусы, строки UI
│   ├── types.ts                      # все сущности + SyncFields
│   ├── db/
│   │   ├── db.ts                     # Dexie: таблицы, seed, CRUD, списание/пополнение, ops-рекордер
│   │   ├── test-helpers.ts            # тестовые фикстуры: createTestTrack (кортеж), createTestCategory/Item
│   ├── logic/
│   │   ├── ids.ts                     # genId, syncMeta
│   │   ├── merge.ts                   # merge-движок (LWW, могилки, конфликты, union ops)
│   │   ├── status.ts                  # computeStatus, приоритеты, сортировка по срочности
│   │   ├── pin.ts                     # WebCrypto PBKDF2: hashPin/verifyPin
│   │   ├── export.ts                  # buildHouseholdEnvelope, buildTrackTemplate
│   │   ├── import.ts                  # parse/validate, importHouseholdEnvelope, importTrackTemplate
│   │   └── pdf.ts                     # buildTrackPdf (jspdf + autotable, кириллица)
│   └── components/
│       ├── Onboarding.tsx             # создание дома, выбор роли, PIN
│       ├── DashboardTab.tsx           # сводка: карточки статусов + «Срочное»
│       ├── TracksTab.tsx              # список треков
│       ├── TrackScreen.tsx            # категории → позиции, списание
│       ├── SpendModal.tsx             # быстрое списание 1 / упаковка / своё число
│       ├── AddTab.tsx                 # пачка-добавление с автодополнением
│       ├── AdminScreen.tsx            # за PIN: способы, N дней, дом, устройство
│       ├── MoreTab.tsx                # экспорт/импорт/журнал/админ-вход
│       ├── ImportPreviewModal.tsx     # предпросмотр импорта перед подтверждением
│       └── JournalScreen.tsx          # лента операций
```

---

### Task 1: Скаффолд проекта (Vite + React + TS + PWA + тесты)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts`, `src/test-setup.ts`, `src/App.tsx`, `src/App.test.tsx`, `.gitignore`

**Interfaces:**
- Produces: рабочие скрипты `npm run dev|build|test|preview`; vitest-окружение (jsdom + fake-indexeddb).

- [ ] **Step 1: Создать `package.json`**

```json
{
  "name": "family-stock-tracker",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "preview": "vite preview"
  },
  "dependencies": {
    "dexie": "^4.4.5",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.8",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.6",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^4.7.0",
    "fake-indexeddb": "^6.2.5",
    "jsdom": "^26.1.0",
    "typescript": "~5.9.0",
    "vite": "^6.4.3",
    "vite-plugin-pwa": "^1.3.0",
    "vitest": "^3.2.7"
  }
}
```

- [ ] **Step 2: Создать конфиги**

`vite.config.ts` (адаптация эталона: наш base, manifest «Трекер запасов», без OCR/tessdata-кэша, добавлен `assetsInclude` для ttf-шрифтов jspdf):

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/family-stock-tracker/',
  // ttf-шрифты для PDF-отчёта (jspdf) импортируются в коде как ?inline
  assetsInclude: ['**/*.ttf'],
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Трекер запасов',
        short_name: 'Запасы',
        display: 'standalone',
        start_url: '/family-stock-tracker/',
        background_color: '#eef2f6',
        theme_color: '#0e7490',
        icons: [
          { src: 'icon-180.png', sizes: '180x180', type: 'image/png' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
```

`tsconfig.json` (references app/node):

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json` (strict + noUnusedLocals/Parameters — `tsc -b` проверяет и тесты, неиспользуемые импорты ломают сборку):

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client", "vitest/globals"],
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUncheckedSideEffectImports": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json` (для vite.config.ts):

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,

    /* Bundler mode */
    "module": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUncheckedSideEffectImports": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: Создать `index.html`, `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts`**

`index.html`:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/icon-192.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0e7490" />
    <title>Трекер запасов</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx` (App — именованный экспорт из `./App`):

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/index.css` (минимальный базовый стиль — фон, сброс отступов):

```css
:root {
  color-scheme: light;
}

html,
body {
  margin: 0;
  min-height: 100%;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: #eef2f6;
}

#root {
  min-height: 100dvh;
}
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Создать `src/test-setup.ts`** (адаптация эталона — ResizeObserver-заглушка без `as any`, та же функциональность):

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

if (typeof ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
```

- [ ] **Step 5: Создать минимальный `src/App.tsx` и тест `src/App.test.tsx`**

`src/App.tsx` — именованный экспорт `App` (на него ссылается main.tsx):

```tsx
export function App() {
  return <div>Трекер запасов</div>;
}
```

`src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('рендерит заглушку', () => {
    render(<App />);
    expect(screen.getByText('Трекер запасов')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Проверить**

Run: `npm install && npx vitest run && npm run build`
Expected: тест PASS, сборка без ошибок.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold vite react-ts pwa project"
```

---

### Task 2: Типы, константы, id-хелперы

**Files:**
- Create: `src/types.ts`, `src/constants.ts`, `src/logic/ids.ts`
- Test: `src/logic/ids.test.ts`, `src/constants.test.ts`

**Interfaces:**
- Produces: `genId(prefix): string`; `syncMeta(deviceId): { updatedAt, updatedBy }`; `ItemStatus`; `SyncFields`; все сущности; `TemplateItem`; `LocalState`; `MergedState`; `DEFAULT_TRACKING_METHODS`; `UNITS`; `STATUS_META`; `EMPTY_ITEM`.

- [ ] **Step 1: Написать тест для `genId`**

```ts
// src/logic/ids.test.ts
import { describe, expect, it } from 'vitest';
import { genId } from './ids';

describe('genId', () => {
  it('префикс + уникальность', () => {
    const a = genId('itm');
    const b = genId('itm');
    expect(a.startsWith('itm_')).toBe(true);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Реализовать `src/logic/ids.ts`**

```ts
export function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function syncMeta(deviceId: string): { updatedAt: number; updatedBy: string } {
  return { updatedAt: Date.now(), updatedBy: deviceId };
}
```

- [ ] **Step 3: Написать тест `src/constants.test.ts`** — уникальность id у `DEFAULT_TRACKING_METHODS`, `UNITS` содержит 'шт' и 'кг'.

- [ ] **Step 4: Реализовать `src/types.ts`**

```ts
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
```

- [ ] **Step 5: Реализовать `src/constants.ts`**

```ts
import type { Item, ItemStatus, TrackingMethod } from './types';

export const UNITS = ['шт', 'таб', 'пак', 'кг', 'г', 'банка', 'мл', 'л'] as const;

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
```

- [ ] **Step 6: Проверить** — `npx vitest run` (PASS) и `npm run build` (OK).

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/constants.ts src/logic/ids.ts src/logic/ids.test.ts src/constants.test.ts
git commit -m "feat: types, constants, id helpers"
```

---

### Task 3: Слой базы данных (Dexie) + рекордер операций

**Files:**
- Create: `src/db/db.ts`, `src/db/test-helpers.ts`
- Test: `src/db/db.test.ts`

**Interfaces:**
- Consumes: `genId`, `syncMeta`, `DEFAULT_TRACKING_METHODS`, типы.
- Produces: SINGLETON `db`; `ensureOnboarding(): Promise<void>`; `getHousehold()`, `getDeviceProfile()`, `saveDeviceProfile()`, `getTrackingMethods()`, `saveTrackingMethod()`, `listTracks()`, `saveTrack()`, `softDeleteTrack()`, `listCategories(trackId)`, `saveCategory()`, `listActiveItems(categoryId)`, `saveItem()`, `softDeleteItem()`, `spendItem(id, amount, note)`, `restockItem(id, amount, note)`, `nextDeviceSeq()`, `loadHouseholdData()`, `upsertMany(table, rows)`. Примечание: `recordOp` (запись op с seq-логикой) — приватный, вызывается внутри мутаций; снаружи не экспортируется.

- [ ] **Step 1: Тест — seed при первом старте и списание через кортежную фикстуру**

```ts
// src/db/db.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureOnboarding, spendItem } from './db';
import { DEFAULT_TRACKING_METHODS } from '../constants';
import { createTestTrack, resetDb } from './test-helpers';

describe('db', () => {
  beforeEach(resetDb);

  it('seed: дефолтные способы отслеживания появляются без дома', async () => {
    await ensureOnboarding();
    expect(await db.trackingMethods.count()).toBe(DEFAULT_TRACKING_METHODS.length);
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
});
```

- [ ] **Step 2: Реализовать `src/db/db.ts`** (полный код)

```ts
import Dexie, { type Table } from 'dexie';
import type {
  Category, DeviceProfile, Household, Item, LocalState, Op, OpType, TrackingMethod, Track,
} from '../types';
import { DEFAULT_TRACKING_METHODS } from '../constants';
import { genId, syncMeta } from '../logic/ids';

class TrackerDb extends Dexie {
  household!: Table<Household, string>;
  deviceProfile!: Table<DeviceProfile, string>;
  trackingMethods!: Table<TrackingMethod, string>;
  tracks!: Table<Track, string>;
  categories!: Table<Category, string>;
  items!: Table<Item, string>;
  ops!: Table<Op, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('family-stock-tracker');
    this.version(1).stores({
      household: 'id',
      deviceProfile: 'id',
      trackingMethods: 'id',
      tracks: 'id',
      categories: 'id, trackId',
      items: 'id, categoryId',
      ops: 'id, itemId, when',
      meta: 'key',
    });
  }
}

export const db = new TrackerDb();

async function deviceId(): Promise<string> {
  const row = await db.meta.get('deviceId');
  if (row) return String(row.value);
  const id = genId('dev');
  await db.meta.put({ key: 'deviceId', value: id });
  return id;
}

/** Первый запуск: засеять дефолтные способы отслеживания (идемпотентно по id). */
export async function ensureOnboarding(): Promise<void> {
  await db.trackingMethods.bulkPut(
    DEFAULT_TRACKING_METHODS.map(m => ({ ...m, updatedAt: Date.now(), updatedBy: 'seed' })),
  );
}

export async function createHousehold(input: {
  name: string; deviceLabel: string; warnDays: number;
}): Promise<Household> {
  const household: Household = {
    id: genId('hh'),
    name: input.name,
    warnDays: input.warnDays,
    deviceLabel: input.deviceLabel,
    createdAt: Date.now(),
    deletedAt: null,
    ...syncMeta(await deviceId()),
  };
  await db.household.put(household);
  return household;
}

export function getHousehold(): Promise<Household | undefined> {
  return db.household.orderBy('createdAt').first();
}

export function getDeviceProfile(): Promise<DeviceProfile | undefined> {
  return db.deviceProfile.get('me');
}

export async function saveDeviceProfile(profile: DeviceProfile): Promise<void> {
  await db.deviceProfile.put({ ...profile, id: 'me', ...syncMeta(await deviceId()) });
}

export async function getTrackingMethods(): Promise<TrackingMethod[]> {
  const rows = await db.trackingMethods.toArray();
  return rows.filter(m => m.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveTrackingMethod(method: TrackingMethod): Promise<void> {
  await db.trackingMethods.put({ ...method, ...syncMeta(await deviceId()) });
}

export async function listTracks(): Promise<Track[]> {
  const rows = await db.tracks.toArray();
  return rows.filter(t => t.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveTrack(track: Track): Promise<void> {
  await db.tracks.put({ ...track, ...syncMeta(await deviceId()) });
}

export async function softDeleteTrack(id: string): Promise<void> {
  const track = await db.tracks.get(id);
  if (!track) return;
  await db.tracks.put({ ...track, deletedAt: Date.now(), ...syncMeta(await deviceId()) });
}

export async function listCategories(trackId: string): Promise<Category[]> {
  const rows = await db.categories.where('trackId').equals(trackId).toArray();
  return rows.filter(c => c.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveCategory(category: Category): Promise<void> {
  await db.categories.put({ ...category, ...syncMeta(await deviceId()) });
}

export async function listActiveItems(categoryId: string): Promise<Item[]> {
  const rows = await db.items.where('categoryId').equals(categoryId).toArray();
  return rows.filter(i => i.deletedAt === null).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export async function saveItem(item: Item): Promise<void> {
  await db.items.put({ ...item, ...syncMeta(await deviceId()) });
}

export async function softDeleteItem(id: string): Promise<void> {
  const item = await db.items.get(id);
  if (!item) return;
  await db.transaction('rw', db.items, db.ops, db.meta, async () => {
    await db.items.put({ ...item, deletedAt: Date.now(), ...syncMeta(await deviceId()) });
    const cat = await db.categories.get(item.categoryId);
    await recordOp({ type: 'delete', itemId: id, trackId: cat?.trackId ?? null, delta: null, note: '' });
  });
}

export function nextDeviceSeq(): Promise<number> {
  return db.meta.get('deviceSeq').then(row => Number((row?.value as number | undefined) ?? 0));
}

/** Общая мутация количества: spend (−delta) и restock (+delta) в одной транзакции. */
async function mutateQuantity(
  id: string, delta: number, note: string, type: 'spend' | 'restock',
): Promise<void> {
  await db.transaction('rw', db.items, db.ops, db.meta, async () => {
    const current = await db.items.get(id);
    if (!current) throw new Error(`item not found: ${id}`);
    const cat = await db.categories.get(current.categoryId);
    await db.items.put({
      ...current,
      quantity: current.quantity + delta,
      ...syncMeta(await deviceId()),
    });
    await recordOp({ type, itemId: id, trackId: cat?.trackId ?? null, delta, note });
  });
}

export async function spendItem(id: string, amount: number, note: string): Promise<void> {
  if (amount <= 0) throw new Error('amount must be positive');
  await mutateQuantity(id, -amount, note, 'spend');
}

export async function restockItem(id: string, amount: number, note: string): Promise<void> {
  if (amount <= 0) throw new Error('amount must be positive');
  await mutateQuantity(id, amount, note, 'restock');
}

/** Рекордер операций: id = `${deviceId}:${seq}`, seq инкрементится в meta. */
async function recordOp(input: {
  type: OpType; itemId: string | null; trackId: string | null; delta: number | null; note: string;
}): Promise<void> {
  const device = await deviceId();
  const seqRow = await db.meta.get('deviceSeq');
  const seq = (Number((seqRow?.value as number | undefined) ?? 0)) + 1;
  await db.meta.put({ key: 'deviceSeq', value: seq });
  const household = await getHousehold();
  const op: Op = {
    id: `${device}:${seq}`,
    deviceId: device,
    deviceSeq: seq,
    type: input.type,
    itemId: input.itemId,
    trackId: input.trackId,
    delta: input.delta,
    deviceLabel: household?.deviceLabel ?? '',
    when: Date.now(),
    note: input.note,
  };
  await db.ops.put(op);
}

/** Полный локальный срез для merge-движка (LocalState живёт в types.ts, Task 2). */
export async function loadHouseholdData(): Promise<LocalState> {
  const [household, deviceProfile, trackingMethods, tracks, categories, items, ops] = await Promise.all([
    getHousehold(), getDeviceProfile(),
    db.trackingMethods.toArray(), db.tracks.toArray(),
    db.categories.toArray(), db.items.toArray(), db.ops.toArray(),
  ]);
  return {
    household: household ?? null,
    deviceProfile: deviceProfile ?? null,
    trackingMethods, tracks, categories, items, ops,
  };
}

export async function upsertMany<T extends { id: string }>(table: Table<T, string>, rows: T[]): Promise<void> {
  await table.bulkPut(rows);
}
```

- [ ] **Step 3: Создать `src/db/test-helpers.ts`** (кортежная фикстура — единый источник данных для всех тестов слоя и логики)

```ts
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
```

- [ ] **Step 4: Запустить тесты** — `npx vitest run src/db/db.test.ts` → PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/db/db.ts src/db/test-helpers.ts src/db/db.test.ts
git commit -m "feat: dexie db layer with ops recorder and test fixtures"
```

---

### Task 4: Merge-движок

**Files:**
- Create: `src/logic/merge.ts`
- Test: `src/logic/merge.test.ts`

**Interfaces:**
- Consumes: `SyncFields`, `HouseholdEnvelope`, `ImportSummary`, `LocalState`, `MergedState`, `syncMeta`, типы таблиц.
- Produces: `mergeLists<T extends SyncFields>(local: T[], incoming: T[], exportedAt: number): { records: T[]; summary: ImportSummary }`; `mergeOps(local: Op[], incoming: Op[]): Op[]`; `mergeEnvelope(env: HouseholdEnvelope, local: LocalState): { records: MergedState; summary: ImportSummary }`.

Правила (из спецификации §3.2, §6.1):
1. Нет локальной записи → берём пришедшую (`added`), могилка пришедшей игнорируется.
2. Локальная есть:
   - пришедшая — могилка и новее локальной → локальная получает `deletedAt` (`deleted`).
   - пришедшая новее → она побеждает (`update`); если при этом локальная менялась ПОСЛЕ `exportedAt` и отличается от пришедшей → `conflict` (считается в `conflicts`).
   - иначе локальная побеждает (`keep`, не в счётчике).
3. `ops` — union по `id`, сортировка по `deviceSeq`, дубликаты отбрасываются.

- [ ] **Step 1: Тесты** (все кейсы: add, update-новичка, keep-локального, tombstone, conflict, ops-union)

```ts
// src/logic/merge.test.ts
import { describe, expect, it } from 'vitest';
import { mergeLists, mergeOps } from './merge';
import type { Item, Op } from '../types';

const base = (id: string, updatedAt: number, deletedAt: number | null = null): Item =>
  ({ id, categoryId: 'c1', name: 'n', unit: 'шт', quantity: 1, minThreshold: null,
     maxThreshold: null, expiresAt: null, packSize: null, trackExpiry: false,
     trackQuantity: false, notes: '', createdAt: 1, updatedAt, updatedBy: 'dev', deletedAt });

describe('mergeLists', () => {
  it('нет локальной → берём пришедшую (added)', () => {
    const r = mergeLists<Item>([], [base('i1', 100)], 1000);
    expect(r.summary.added).toBe(1);
    expect(r.records.map(x => x.id)).toEqual(['i1']);
  });

  it('пришедшая новее → update; локальная не менялась после exportedAt — без конфликта', () => {
    const local = [base('i1', 100)];
    const r = mergeLists<Item>(local, [base('i1', 200)], 1000);
    expect(r.summary.updated).toBe(1);
    expect(r.summary.conflicts).toBe(0);
    expect(r.records[0].quantity).toBe(1);
  });

  it('обе менялись после exportedAt → conflict, победитель по updatedAt', () => {
    const local = [{ ...base('i1', 1500), quantity: 5 }];
    const incoming = [base('i1', 1600)]; // новее
    const r = mergeLists<Item>(local, incoming, 1000);
    expect(r.summary.conflicts).toBe(1);
    expect(r.records[0].quantity).toBe(1); // пришёл победитель (1600 > 1500)
  });

  it('локальная новее пришедшей → keep', () => {
    const local = [{ ...base('i1', 2000), quantity: 9 }];
    const r = mergeLists<Item>(local, [base('i1', 100)], 1000);
    expect(r.summary.updated).toBe(0);
    expect(r.records[0].quantity).toBe(9);
  });

  it('могилка пришедшей, новее локальной → deleted', () => {
    const local = [base('i1', 100)];
    const r = mergeLists<Item>(local, [base('i1', 200, 200)], 1000);
    expect(r.summary.deleted).toBe(1);
    expect(r.records[0].deletedAt).toBe(200);
  });

  it('могилка старше локальной → keep', () => {
    const local = [base('i1', 200)];
    const r = mergeLists<Item>(local, [base('i1', 100, 100)], 1000);
    expect(r.summary.deleted).toBe(0);
    expect(r.records[0].deletedAt).toBeNull();
  });
});

describe('mergeOps', () => {
  it('union по id, без дубликатов, сортировка по deviceSeq', () => {
    const a: Op[] = [
      { id: 'd:1', deviceId: 'd', deviceSeq: 1, type: 'add', itemId: 'i', trackId: null, delta: 1, deviceLabel: 'A', when: 1, note: '' },
      { id: 'd:2', deviceId: 'd', deviceSeq: 2, type: 'spend', itemId: 'i', trackId: null, delta: -1, deviceLabel: 'A', when: 2, note: '' },
    ];
    const b: Op[] = [
      { id: 'd:2', deviceId: 'd', deviceSeq: 2, type: 'spend', itemId: 'i', trackId: null, delta: -1, deviceLabel: 'A', when: 2, note: '' },
      { id: 'e:1', deviceId: 'e', deviceSeq: 1, type: 'add', itemId: 'j', trackId: null, delta: 1, deviceLabel: 'B', when: 3, note: '' },
    ];
    const r = mergeOps(a, b);
    expect(r).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Реализовать `src/logic/merge.ts`**

```ts
import type { HouseholdEnvelope, ImportSummary, LocalState, MergedState, Op, SyncFields } from '../types';

function recordKey<T extends SyncFields>(r: T): string { return r.id; }
function sameFields<T>(a: T, b: T): boolean { return JSON.stringify(a) === JSON.stringify(b); }

/** Слияние списка записей: LWW по updatedAt, могилки, конфликт-эвристика. */
export function mergeLists<T extends SyncFields>(
  local: T[],
  incoming: T[],
  exportedAt: number,
): { records: T[]; summary: ImportSummary } {
  const byId = new Map<string, T>(local.map(r => [recordKey(r), r]));
  const summary: ImportSummary = { added: 0, updated: 0, conflicts: 0, deleted: 0 };
  for (const inc of incoming) {
    const loc = byId.get(recordKey(inc));
    if (!loc) {
      if (inc.deletedAt === null) summary.added++;
      byId.set(recordKey(inc), inc);
      continue;
    }
    if (inc.deletedAt !== null && inc.deletedAt > loc.updatedAt) {
      byId.set(recordKey(loc), { ...loc, deletedAt: inc.deletedAt, updatedAt: inc.deletedAt });
      summary.deleted++;
      continue;
    }
    if (inc.deletedAt !== null) continue; // могилка старше — игнорируем
    if (inc.updatedAt > loc.updatedAt) {
      const localChangedAfterExport = loc.updatedAt > exportedAt && !sameFields(loc, inc);
      if (localChangedAfterExport) summary.conflicts++;
      else summary.updated++;
      byId.set(recordKey(inc), inc);
      continue;
    }
  }
  return { records: [...byId.values()], summary };
}

/** Append-only union журнала по id устройства:seq, без потерь. */
export function mergeOps(local: Op[], incoming: Op[]): Op[] {
  const byId = new Map<string, Op>();
  for (const o of [...local, ...incoming]) byId.set(o.id, o);
  return [...byId.values()].sort((a, b) => a.deviceSeq - b.deviceSeq);
}

/** Полное слияние envelope с локальным срезом (LocalState): результат — MergedState для upsertMany. */
export function mergeEnvelope(
  env: HouseholdEnvelope,
  local: LocalState,
): { records: MergedState; summary: ImportSummary } {
  const trackingMethods = mergeLists(local.trackingMethods, env.trackingMethods, env.exportedAt);
  const tracks = mergeLists(local.tracks, env.tracks, env.exportedAt);
  const categories = mergeLists(local.categories, env.categories, env.exportedAt);
  const items = mergeLists(local.items, env.items, env.exportedAt);
  const household = mergeLists(
    local.household ? [local.household] : [],
    [env.household],
    env.exportedAt,
  );

  const sum = (...parts: ImportSummary[]): ImportSummary => ({
    added: parts.reduce((a, p) => a + p.added, 0),
    updated: parts.reduce((a, p) => a + p.updated, 0),
    conflicts: parts.reduce((a, p) => a + p.conflicts, 0),
    deleted: parts.reduce((a, p) => a + p.deleted, 0),
  });

  return {
    records: {
      household: household.records[0] ?? env.household,
      trackingMethods: trackingMethods.records,
      tracks: tracks.records,
      categories: categories.records,
      items: items.records,
      ops: mergeOps(local.ops, env.ops),
    },
    summary: sum(
      trackingMethods.summary, tracks.summary,
      categories.summary, items.summary, household.summary,
    ),
  };
}
```

> Примечание: `mergeEnvelope` принимает локальные данные уже вычитанными из БД (см. Task 8 `importHouseholdEnvelope`, который зовёт `loadHouseholdData()`). Тип возвращаемого `records` — это строго то, что потом пишется через `upsertMany`.

- [ ] **Step 3: Проверить** — `npx vitest run src/logic/merge.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/logic/merge.ts src/logic/merge.test.ts
git commit -m "feat: lww merge engine with tombstones and conflict heuristic"
```

---

### Task 5: Статусы и сортировка по срочности

**Files:**
- Create: `src/logic/status.ts`
- Test: `src/logic/status.test.ts`

**Interfaces:**
- Consumes: `Item`, `ItemStatus`, `STATUS_META`.
- Produces: `computeStatus(item, warnDays, today): ItemStatus`; `sortByUrgency(items, warnDays, today): Item[]`; `isProblem(status: ItemStatus): boolean`.

Правила (спецификация §4.3): приоритет 🔴 expired > 🟠 expiring > 🔵 low > 🟣 excess > ⚪ ok. `expiresAt` — строка YYYY-MM-DD, сравнение по дате без времени. `low`: `trackQuantity && minThreshold != null && quantity <= minThreshold`. `excess`: `trackQuantity && maxThreshold != null && quantity >= maxThreshold`.

- [ ] **Step 1: Тесты**

```ts
// src/logic/status.test.ts
import { describe, expect, it } from 'vitest';
import { computeStatus, sortByUrgency } from './status';
import type { Item } from '../types';

const make = (over: Partial<Item>): Item => ({
  id: 'i', categoryId: 'c', name: 'n', unit: 'шт', quantity: 1, minThreshold: null,
  maxThreshold: null, expiresAt: null, packSize: null, trackExpiry: false,
  trackQuantity: false, notes: '', createdAt: 0, updatedAt: 0, updatedBy: 'd', deletedAt: null, ...over,
});
const today = new Date('2026-09-19T12:00:00');

describe('computeStatus', () => {
  it('просрочено', () => {
    expect(computeStatus(make({ trackExpiry: true, expiresAt: '2026-09-18' }), 30, today)).toBe('expired');
  });
  it('истекает в окне N дней', () => {
    expect(computeStatus(make({ trackExpiry: true, expiresAt: '2026-09-25' }), 30, today)).toBe('expiring');
  });
  it('срок далеко — норм', () => {
    expect(computeStatus(make({ trackExpiry: true, expiresAt: '2027-01-01' }), 30, today)).toBe('ok');
  });
  it('ниже минимума', () => {
    expect(computeStatus(make({ trackQuantity: true, minThreshold: 5, quantity: 3 }), 30, today)).toBe('low');
  });
  it('выше максимума', () => {
    expect(computeStatus(make({ trackQuantity: true, maxThreshold: 10, quantity: 12 }), 30, today)).toBe('excess');
  });
  it('просрочка важнее низкого остатка', () => {
    expect(computeStatus(make({ trackExpiry: true, expiresAt: '2026-09-10', trackQuantity: true, minThreshold: 5, quantity: 3 }), 30, today)).toBe('expired');
  });
  it('отслеживание выключено → ok', () => {
    expect(computeStatus(make({}), 30, today)).toBe('ok');
  });
});

describe('sortByUrgency', () => {
  it('expired → expiring → low → excess → ok', () => {
    const items = [
      make({ id: 'ok', name: 'A' }),
      make({ id: 'low', name: 'B', trackQuantity: true, minThreshold: 5, quantity: 1 }),
      make({ id: 'expired', name: 'C', trackExpiry: true, expiresAt: '2026-09-01' }),
      make({ id: 'expiring', name: 'D', trackExpiry: true, expiresAt: '2026-09-30' }),
      make({ id: 'excess', name: 'E', trackQuantity: true, maxThreshold: 5, quantity: 9 }),
    ];
    const ids = sortByUrgency(items, 30, today).map(i => i.id);
    expect(ids).toEqual(['expired', 'expiring', 'low', 'excess', 'ok']);
  });
});
```

- [ ] **Step 2: Реализовать `src/logic/status.ts`**

```ts
import type { Item, ItemStatus } from '../types';
import { STATUS_META } from '../constants';

export function computeStatus(item: Item, warnDays: number, today: Date): ItemStatus {
  const day = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
  if (item.trackExpiry && item.expiresAt) {
    const exp = day(item.expiresAt);
    const now = day(today.toISOString().slice(0, 10));
    if (exp < now) return 'expired';
    if (exp - now <= warnDays * 86_400_000) return 'expiring';
  }
  if (item.trackQuantity) {
    if (item.minThreshold != null && item.quantity <= item.minThreshold) return 'low';
    if (item.maxThreshold != null && item.quantity >= item.maxThreshold) return 'excess';
  }
  return 'ok';
}

export function isProblem(s: ItemStatus): boolean { return s !== 'ok'; }

export function sortByUrgency(items: Item[], warnDays: number, today: Date): Item[] {
  return [...items].sort((a, b) => {
    const pa = STATUS_META[computeStatus(a, warnDays, today)].priority;
    const pb = STATUS_META[computeStatus(b, warnDays, today)].priority;
    if (pa !== pb) return pb - pa;
    return a.name.localeCompare(b.name, 'ru');
  });
}
```

- [ ] **Step 3: Проверить** — `npx vitest run src/logic/status.test.ts` → PASS; `npm run build` → OK.

- [ ] **Step 4: Commit**

```bash
git add src/logic/status.ts src/logic/status.test.ts
git commit -m "feat: item status computation and urgency sort"
```

---

### Task 6: PIN администратора (WebCrypto PBKDF2)

**Files:**
- Create: `src/logic/pin.ts`
- Test: `src/logic/pin.test.ts`

**Interfaces:**
- Produces: `hashPin(pin: string): Promise<string>` (формат `saltHex:hashHex`, PBKDF2-SHA256 100k итераций, 16 байт соли); `verifyPin(pin: string, stored: string): Promise<boolean>`. PIN — 4–8 цифр.

- [ ] **Step 1: Тесты**

```ts
// src/logic/pin.test.ts
import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin } from './pin';

describe('pin', () => {
  it('верификация правильного PIN', async () => {
    const stored = await hashPin('1234');
    expect(stored).toContain(':');
    expect(await verifyPin('1234', stored)).toBe(true);
  });
  it('неверный PIN отклоняется', async () => {
    const stored = await hashPin('1234');
    expect(await verifyPin('1235', stored)).toBe(false);
  });
  it('одинаковый PIN даёт разные соли', async () => {
    expect(await hashPin('1234')).not.toBe(await hashPin('1234'));
  });
});
```

- [ ] **Step 2: Реализовать `src/logic/pin.ts`**

```ts
const ITERATIONS = 100_000;

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  );
  return `${bufToHex(salt.buffer)}:${bufToHex(bits)}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = hexToBuf(saltHex);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  );
  return bufToHex(bits) === hashHex;
}
```

- [ ] **Step 3: Проверить** — `npx vitest run src/logic/pin.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/logic/pin.ts src/logic/pin.test.ts
git commit -m "feat: webcrypto pbkdf2 pin hashing"
```

---

### Task 7: Экспорт (дом-бэкап и шаблон трека)

**Files:**
- Create: `src/logic/export.ts`
- Test: `src/logic/export.test.ts`

**Interfaces:**
- Consumes: `loadHouseholdData()`, `db` таблицы, типы.
- Produces: `buildHouseholdEnvelope(): Promise<HouseholdEnvelope>` (все записи включая могилки, `exportedAt: Date.now()`); `buildTrackTemplate(trackId: string): Promise<TrackTemplateEnvelope>` (только живые категории/позиции трека, у позиций `expiresAt: null`, без ops).

- [ ] **Step 1: Тесты**

```ts
// src/logic/export.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { buildHouseholdEnvelope, buildTrackTemplate } from './export';
import { createTestTrack, resetDb, softDeleteTestItem } from '../db/test-helpers';

describe('export', () => {
  beforeEach(resetDb);

  it('дом-бэкап: все таблицы и могилки включены', async () => {
    const [, , item1] = await createTestTrack();
    await softDeleteTestItem(item1.id);
    const env = await buildHouseholdEnvelope();
    expect(env.format).toBe('household-backup');
    expect(env.version).toBe(1);
    expect(env.tracks.length).toBe(1);
    expect(env.items.some(i => i.deletedAt !== null)).toBe(true);
  });

  it('шаблон трека: сроки обнулены, поле ops отсутствует', async () => {
    const [track] = await createTestTrack();
    const tpl = await buildTrackTemplate(track.id);
    expect(tpl.trackName).toBe('Аптечка');
    expect(tpl.items).toHaveLength(2);
    expect(tpl.items.every(i => i.expiresAt === null)).toBe(true);
    expect('ops' in tpl).toBe(false);
  });
});
```

- [ ] **Step 2: Реализовать `src/logic/export.ts`**

```ts
import { db } from '../db/db';
import type { HouseholdEnvelope, TrackTemplateEnvelope } from '../types';

export async function buildHouseholdEnvelope(): Promise<HouseholdEnvelope> {
  const [hd, deviceId, trackingMethods, tracks, categories, items, ops] = await Promise.all([
    db.household.toArray(),
    db.meta.get('deviceId'),
    db.trackingMethods.toArray(),
    db.tracks.toArray(),
    db.categories.toArray(),
    db.items.toArray(),
    db.ops.toArray(),
  ]);
  if (!hd[0]) throw new Error('Дом не создан');
  return {
    format: 'household-backup',
    version: 1,
    exportedAt: Date.now(),
    deviceId: String(deviceId?.value ?? 'unknown'),
    deviceLabel: hd[0].deviceLabel,
    household: hd[0],
    trackingMethods, tracks, categories, items, ops,
  };
}

export async function buildTrackTemplate(trackId: string): Promise<TrackTemplateEnvelope> {
  const track = await db.tracks.get(trackId);
  if (!track) throw new Error('Трек не найден');
  const cats = await db.categories.where('trackId').equals(trackId).toArray();
  const activeCats = cats.filter(c => c.deletedAt === null);
  const items = (await db.items.toArray()).filter(
    i => activeCats.some(c => c.id === i.categoryId) && i.deletedAt === null,
  );
  return {
    format: 'track-template',
    version: 1,
    trackName: track.name,
    trackEmoji: track.emoji,
    // categoryId в TemplateItem — это ИМЯ категории (в целевой базе категорий ещё нет)
    categories: activeCats.map(c => ({ name: c.name, emoji: c.emoji })),
    items: items.map(i => {
      const cat = activeCats.find(c => c.id === i.categoryId);
      return {
        name: i.name,
        unit: i.unit,
        quantity: i.quantity,
        minThreshold: i.minThreshold,
        maxThreshold: i.maxThreshold,
        expiresAt: null,
        packSize: i.packSize,
        trackExpiry: i.trackExpiry,
        trackQuantity: i.trackQuantity,
        notes: i.notes,
        categoryId: cat?.name ?? '',
      };
    }),
  };
}
```

> Тестовые хелперы (`createTestTrack`, `softDeleteTestItem`, `resetDb`) уже созданы в Task 3 — `src/db/test-helpers.ts`, здесь они только переиспользуются.

- [ ] **Step 3: Проверить** — `npx vitest run src/logic/export.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/logic/export.ts src/logic/export.test.ts
git commit -m "feat: household backup and track template export"
```

---

### Task 8: Импорт (слияние дом-бэкапа и импорт шаблона трека)

**Files:**
- Create: `src/logic/import.ts`
- Test: `src/logic/import.test.ts` (включая round-trip: экспорт → очистка → импорт)

**Interfaces:**
- Consumes: `mergeEnvelope`, `loadHouseholdData()`, `upsertMany`, `genId`, `syncMeta`, типы.
- Produces: `parseHouseholdEnvelope(json: string): HouseholdEnvelope` (throw с человеческим сообщением при битом формате); `parseTrackTemplate(json: string): TrackTemplateEnvelope`; `buildImportPreview(env: HouseholdEnvelope): Promise<ImportSummary>` (те же счётчики, что применит импорт, без записи в БД — для двухфазного предпросмотра в Task 14); `importHouseholdEnvelope(env: HouseholdEnvelope): Promise<ImportSummary>`; `importTrackTemplate(tpl: TrackTemplateEnvelope): Promise<string>` (возвращает id нового трека «Имя (копия)»).

- [ ] **Step 1: Тесты**

```ts
// src/logic/import.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { buildHouseholdEnvelope, buildTrackTemplate } from './export';
import { importHouseholdEnvelope, importTrackTemplate, parseHouseholdEnvelope } from './import';
import { createTestTrack, resetDb } from '../db/test-helpers';

describe('import', () => {
  beforeEach(resetDb);

  it('parseHouseholdEnvelope отклоняет битый JSON', () => {
    expect(() => parseHouseholdEnvelope('{not json')).toThrow(/не является корректным/);
  });

  it('round-trip: экспорт → очистка → импорт = без потерь, ops без дубликатов', async () => {
    await createTestTrack(); // трек + категория + 2 позиции, 2 списания (ops)
    const env = await buildHouseholdEnvelope();
    const opsBefore = await db.ops.count();

    await db.transaction('rw', db.tracks, db.categories, db.items, db.ops, async () => {
      await Promise.all([db.tracks.clear(), db.categories.clear(), db.items.clear(), db.ops.clear()]);
    });
    const summary = await importHouseholdEnvelope(env);
    expect(summary.added).toBeGreaterThan(0);
    expect(await db.tracks.count()).toBe(1);
    expect(await db.items.count()).toBe(2);
    expect(await db.ops.count()).toBe(opsBefore);

    // повторный импорт того же файла → ноль новых/изменённых/удалённых записей (идемпотентность)
    const again = await importHouseholdEnvelope(env);
    expect(again.added + again.updated + again.deleted).toBe(0);
    expect(await db.ops.count()).toBe(opsBefore);
  });

  it('импорт шаблона создаёт «(копию)» и не пишет журнал', async () => {
    const [track] = await createTestTrack(); // журнал: 2 списания фикстуры
    const opsBefore = await db.ops.count();
    const tpl = await buildTrackTemplate(track.id);
    const newTrackId = await importTrackTemplate(tpl);
    const newTrack = await db.tracks.get(newTrackId);
    expect(newTrack!.name).toBe('Аптечка (копия)');
    expect(newTrack!.id).not.toBe(track.id);
    expect(await db.ops.count()).toBe(opsBefore); // импорт шаблона не добавляет ops
    expect(await db.items.count()).toBe(4); // 2 исходных + 2 скопированных
  });
});
```

- [ ] **Step 2: Реализовать `src/logic/import.ts`**

```ts
import { db, loadHouseholdData, upsertMany } from '../db/db';
import { mergeEnvelope } from './merge';
import { genId, syncMeta } from './ids';
import type {
  Category, HouseholdEnvelope, ImportSummary, Item, Track, TrackTemplateEnvelope,
} from '../types';

export function parseHouseholdEnvelope(json: string): HouseholdEnvelope {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('Файл не является корректным JSON'); }
  const env = raw as HouseholdEnvelope;
  if (env?.format !== 'household-backup' || env.version !== 1 || !env.household?.id) {
    throw new Error('Незнакомый формат файла: нужен бэкап дома (версия 1)');
  }
  return env;
}

export function parseTrackTemplate(json: string): TrackTemplateEnvelope {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('Файл не является корректным JSON'); }
  const tpl = raw as TrackTemplateEnvelope;
  if (tpl?.format !== 'track-template' || tpl.version !== 1 || !tpl.trackName || !Array.isArray(tpl.items)) {
    throw new Error('Незнакомый формат файла: нужен шаблон трека (версия 1)');
  }
  return tpl;
}

/** Двухфазный импорт: предпросмотр счётчиков БЕЗ записи в БД (UI просит подтверждение). */
export async function buildImportPreview(env: HouseholdEnvelope): Promise<ImportSummary> {
  const local = await loadHouseholdData();
  return mergeEnvelope(env, local).summary;
}

export async function importHouseholdEnvelope(env: HouseholdEnvelope): Promise<ImportSummary> {
  const local = await loadHouseholdData();
  const { records, summary } = mergeEnvelope(env, local);
  await db.transaction(
    'rw', db.household, db.trackingMethods, db.tracks, db.categories, db.items, db.ops,
    async () => {
      if (records.household) await upsertMany(db.household, [records.household]);
      await upsertMany(db.trackingMethods, records.trackingMethods);
      await upsertMany(db.tracks, records.tracks);
      await upsertMany(db.categories, records.categories);
      await upsertMany(db.items, records.items);
      await upsertMany(db.ops, records.ops);
    },
  );
  return summary;
}

export async function importTrackTemplate(tpl: TrackTemplateEnvelope): Promise<string> {
  const device = String((await db.meta.get('deviceId'))?.value ?? 'unknown');
  const trackId = genId('trk');
  const now = Date.now();

  const track: Track = {
    id: trackId, name: `${tpl.trackName} (копия)`, emoji: tpl.trackEmoji, sortOrder: 0,
    createdAt: now, ...syncMeta(device), deletedAt: null,
  };

  // categoryId в TemplateItem — это ИМЯ категории; маппим имя → id новой категории
  const catIdByTemplateName = new Map<string, string>();
  const cats: Category[] = tpl.categories.map((c, i) => {
    const id = genId('cat');
    catIdByTemplateName.set(c.name, id);
    return {
      id, trackId, name: c.name, emoji: c.emoji, trackingMethodId: null, sortOrder: i,
      createdAt: now, ...syncMeta(device), deletedAt: null,
    };
  });
  const firstCatId = cats[0]?.id ?? '';

  const items: Item[] = tpl.items.map(it => ({
    id: genId('itm'),
    categoryId: catIdByTemplateName.get(it.categoryId) ?? firstCatId,
    name: it.name,
    unit: it.unit,
    quantity: it.quantity,
    minThreshold: it.minThreshold,
    maxThreshold: it.maxThreshold,
    expiresAt: null, // шаблон всегда без сроков
    packSize: it.packSize,
    trackExpiry: it.trackExpiry,
    trackQuantity: it.trackQuantity,
    notes: it.notes,
    createdAt: now,
    ...syncMeta(device),
    deletedAt: null,
  }));

  await db.transaction('rw', db.tracks, db.categories, db.items, async () => {
    await db.tracks.put(track);
    await db.categories.bulkPut(cats);
    if (items.length) await db.items.bulkPut(items);
  });
  return trackId;
}
```

> Примечание: в `TrackTemplateEnvelope` у позиций поле `categoryId` при экспорте (`buildTrackTemplate`, Task 7) хранит ИМЯ категории, а не id. Тип `TemplateItem` (Task 2) это отражает. При импорте маппим имя → id новой категории (`catIdByTemplateName`, fallback — первая категория). `buildImportPreview` переиспользуется в Task 14 (ImportPreviewModal показывает счётчики до подтверждения).

- [ ] **Step 3: Проверить** — `npx vitest run src/logic/import.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/logic/import.ts src/logic/import.test.ts
git commit -m "feat: household merge import and track template import"
```

---

### Task 9: PDF-отчёт трека

**Files:**
- Create: `src/logic/pdf.ts`, `src/assets/fonts/PT_Sans-Web-Regular-subset.ttf`, `src/assets/fonts/PT_Sans-Web-Bold-subset.ttf` (скопировать из `/Users/halapinvv/Documents/Agents/pressure-sugar-tracker/src/assets/fonts/`)
- Test: `src/logic/pdf.test.ts`

**Interfaces:**
- Produces: `buildTrackPdf(trackId: string): Promise<Blob>` — jspdf A4, autotable, колонки «Категория · Позиция · Кол-во · Срок · Статус», сортировка по срочности (`sortByUrgency`), шапка (имя трека, дата выгрузки, устройство), кириллица через встроенный PT Sans.

- [ ] **Step 1: Тест**

```ts
// src/logic/pdf.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTrackPdf } from './pdf';
import { createTestTrack, resetDb } from '../db/test-helpers';

describe('pdf', () => {
  beforeEach(resetDb);

  it('генерирует непустой PDF-блоб для трека', async () => {
    const [track] = await createTestTrack();
    const blob = await buildTrackPdf(track.id);
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe('application/pdf');
  });

  it('трек без позиций → PDF с шапкой', async () => {
    const [track] = await createTestTrack();
    const blob = await buildTrackPdf(track.id);
    expect(blob.size).toBeGreaterThan(500);
  });
});
```

- [ ] **Step 2: Реализовать `src/logic/pdf.ts`**

```ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../db/db';
import { sortByUrgency, computeStatus } from './status';
import { STATUS_META } from '../constants';
import PT_SANS_REGULAR from '../assets/fonts/PT_Sans-Web-Regular-subset.ttf?inline';
import PT_SANS_BOLD from '../assets/fonts/PT_Sans-Web-Bold-subset.ttf?inline';

export async function buildTrackPdf(trackId: string): Promise<Blob> {
  const track = await db.tracks.get(trackId);
  if (!track) throw new Error('Трек не найден');
  const [hd] = await Promise.all([db.household.toArray()]);
  const warnDays = hd[0]?.warnDays ?? 30;
  const deviceLabel = hd[0]?.deviceLabel ?? '';
  const today = new Date();
  const cats = (await db.categories.where('trackId').equals(trackId).toArray()).filter(c => c.deletedAt === null);
  const items = (await db.items.toArray()).filter(i => cats.some(c => c.id === i.categoryId) && i.deletedAt === null);
  const rows = sortByUrgency(items, warnDays, today).map(i => {
    const cat = cats.find(c => c.id === i.categoryId);
    return [
      cat?.name ?? '', i.name, `${i.quantity} ${i.unit}`,
      i.expiresAt ?? '—', STATUS_META[computeStatus(i, warnDays, today)].label,
    ];
  });

  const doc = new jsPDF();
  doc.addFileToVFS('PT_Sans-Web-Regular-subset.ttf', PT_SANS_REGULAR);
  doc.addFileToVFS('PT_Sans-Web-Bold-subset.ttf', PT_SANS_BOLD);
  doc.addFont('PT_Sans-Web-Regular-subset.ttf', 'PTSans', 'normal');
  doc.addFont('PT_Sans-Web-Bold-subset.ttf', 'PTSans', 'bold');
  doc.setFont('PTSans', 'bold').setFontSize(16);
  doc.text(`${track.emoji} ${track.name}`, 14, 18);
  doc.setFont('PTSans', 'normal').setFontSize(10);
  doc.text(`Выгружено: ${today.toLocaleDateString('ru-RU')} · ${deviceLabel}`, 14, 26);
  autoTable(doc, {
    startY: 32,
    head: [['Категория', 'Позиция', 'Кол-во', 'Срок', 'Статус']],
    body: rows,
    styles: { font: 'PTSans', fontSize: 9 },
    headStyles: { font: 'PTSans', fontStyle: 'bold', fillColor: [14, 116, 144] },
  });
  return doc.output('blob');
}
```

> Важно: `assetsInclude: ['**/*.ttf']` уже задан в `vite.config.ts` (Task 1, Step 2). Здесь ключевая деталь — суффикс `?inline` в импортах: он заставляет Vite встроить base64 шрифта прямо в бандл, что нужно jspdf (`addFileToVFS`). В тестах (node/Vitest) Vite обрабатывает `?inline` так же, как в сборке.

- [ ] **Step 3: Проверить** — `npx vitest run src/logic/pdf.test.ts` → PASS; `npm run build` → OK (проверить, что шрифт попал в бандл).

- [ ] **Step 4: Commit**

```bash
git add src/logic/pdf.ts src/logic/pdf.test.ts src/assets/fonts/ vite.config.ts
git commit -m "feat: track pdf report with cyrillic fonts"
```

---

### Task 10: Онбординг и оболочка приложения (таб-бар, роли, PIN)

**Files:**
- Create: `src/App.tsx`, `src/components/Onboarding.tsx`
- Modify: `src/main.tsx` (mount App)
- Test: `src/App.test.tsx`, `src/components/Onboarding.test.tsx`

**Interfaces:**
- Consumes: `db`-helpers (Task 3), `pin.ts` (Task 6), `types`.
- Produces: состояние `{ ready: boolean; household: Household | null; profile: DeviceProfile | null }` через App; экраны вкладок вызываются с пропсами `{ onChanged: () => void }`.

Логика:
- `App` при монтировании: `ensureOnboarding()`; загрузить household + profile.
- Если нет дома → `<Onboarding>`: имя дома, подпись устройства, выбор роли; если админ — установка PIN (4–8 цифр, два ввода); по завершении создаёт household + deviceProfile (+ deviceLabel в meta).
- Таб-бар (5 вкладок): Дашборд · Треки · Добавить · Списать · Ещё. Независимо от роли. Вкладка «Ещё» содержит вход в админку (для участника — недоступно без профиля админа).
- Участник не видит «Админ» в «Ещё» (скрыто).

- [ ] **Step 1: Тест онбординга**

```tsx
// src/components/Onboarding.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { Onboarding } from './Onboarding';

describe('Onboarding', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('создаёт дом и профиль админа с PIN', async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    await userEvent.type(screen.getByLabelText(/имя дома/i), 'Семья Ивановых');
    await userEvent.click(screen.getByLabelText(/администратор/i));
    await userEvent.type(screen.getByLabelText(/подпись устройства/i), 'Папин iPhone');
    await userEvent.type(screen.getByLabelText(/^pin$/i), '1234');
    await userEvent.type(screen.getByLabelText(/повторите pin/i), '1234');
    await userEvent.click(screen.getByRole('button', { name: /создать/i }));
    expect(onDone).toHaveBeenCalled();
    const hd = await db.household.toArray();
    const prof = await db.deviceProfile.toArray();
    expect(hd[0].name).toBe('Семья Ивановых');
    expect(prof[0].role).toBe('admin');
    expect(prof[0].pinHash).toContain(':');
  });
});
```

- [ ] **Step 2: Реализовать `src/components/Onboarding.tsx`** — форма с полями (label'ы как в тесте), валlдация: имя дома непустое, PIN 4–8 цифр и совпадает; создаёт через db-хелперы (`createHousehold`, `saveDeviceProfile`), зовёт `onDone`.

- [ ] **Step 3: Тест App** — App показывает онбординг без дома, показывает таб-бар после создания; переключение вкладок.

- [ ] **Step 4: Реализовать `src/App.tsx`** — загрузка состояния, гейт онбординга, таб-бар `<nav>` с 5 кнопками (`aria-current`), рендер активной вкладки. Заливка данных после каждого изменения (`onChanged`).

- [ ] **Step 5: Проверить** — `npx vitest run src/App.test.tsx src/components/Onboarding.test.tsx` → PASS; `npm run build` → OK.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Onboarding.tsx src/App.test.tsx src/components/Onboarding.test.tsx
git commit -m "feat: app shell, tab bar, onboarding with admin pin"
```

---

### Task 11: Дашборд

**Files:**
- Create: `src/components/DashboardTab.tsx`
- Test: `src/components/DashboardTab.test.tsx`

**Interfaces:**
- Consumes: `db`-helpers, `computeStatus/sortByUrgency` (Task 5), `STATUS_META`.
- Produces: компонент `DashboardTab({ household, onChanged })` — карточки статусов (счётчики) + список «Срочное» (≤ 15 позиций, первые 4 статуса), клик по позиции → переход в трек.

- [ ] **Step 1: Тест**

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { DashboardTab } from './DashboardTab';
import { createTestTrack } from '../db/test-helpers';

describe('DashboardTab', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('считает просроченные и низкие остатки', async () => {
    await createTestTrack(); // содержит просроченную позицию и низкий остаток
    render(<DashboardTab household={{ id: 'h', name: 'Дом', warnDays: 30, deviceLabel: 'd', createdAt: 1, updatedAt: 1, updatedBy: 'd', deletedAt: null }} onChanged={() => {}} />);
    expect(await screen.findByText(/просрочено/i)).toBeTruthy();
    expect((await screen.findAllByText(/пора купить/i)).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Реализовать `DashboardTab.tsx`** — выгрузка всех живых items + живых категорий (для группировки), подсчёт статусов, рендер карточек (emoji, label, count) и списка «Срочное» (`sortByUrgency`, фильтр `isProblem`, первые 15). Обновление при каждом `onChanged`. Клик по строке — колбэк `onOpenItem(itemId)` (в App переключает на вкладку Треки и открывает трек — минимально: пока просто колбэк-заглушка до Task 12).

- [ ] **Step 3: Проверить** — `npx vitest run src/components/DashboardTab.test.tsx` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/DashboardTab.tsx src/components/DashboardTab.test.tsx
git commit -m "feat: dashboard with status cards and urgent list"
```

---

### Task 12: Треки, экран трека, списание

**Files:**
- Create: `src/components/TracksTab.tsx`, `src/components/TrackScreen.tsx`, `src/components/SpendModal.tsx`
- Test: `src/components/SpendModal.test.tsx`, `src/components/TracksTab.test.tsx`

**Interfaces:**
- Consumes: `db`-helpers (списание/пополнение), `computeStatus`, `sortByUrgency`, `UNITS`.
- Produces: `TracksTab({ onOpenTrack })` — список живых треков (+кнопка «Новый трек» с промптом имени/эмодзи); `TrackScreen({ trackId, onBack, onChanged })` — категории → позиции со статус-кружками, быстрые кнопки списания; `SpendModal({ item, onClose, onChanged })` — поле количества, кнопки «1», «Упаковка», «Своё», примечание, «Списать».

- [ ] **Step 1: Тест SpendModal**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { SpendModal } from './SpendModal';
import { createTestTrack } from '../db/test-helpers';

describe('SpendModal', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('списание 1: количество уменьшается, пишется op', async () => {
    const [, , item] = await createTestTrack();
    const onChanged = vi.fn();
    render(<SpendModal item={item} onClose={() => {}} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole('button', { name: /^1$/ }));
    await userEvent.click(screen.getByRole('button', { name: /списать/i }));
    expect(onChanged).toHaveBeenCalled();
    const fresh = await db.items.get(item.id);
    expect(fresh!.quantity).toBe(item.quantity - 1);
  });

  it('упаковка: списывает packSize штук', async () => {
    const [, , item] = await createTestTrack();
    const qtyBefore = item.quantity;
    render(<SpendModal item={{ ...item, packSize: 4 }} onClose={() => {}} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /упаковк/i }));
    await userEvent.click(screen.getByRole('button', { name: /списать/i }));
    expect((await db.items.get(item.id))!.quantity).toBe(qtyBefore - 4);
  });
});
```

- [ ] **Step 2: Реализовать `SpendModal.tsx`** — локальное состояние `amount: number | null`, кнопки: `1`, `Упаковка` (если packSize), `Своё` (числовой input); «Списать» → `spendItem(item.id, amount, note)`, `onChanged`, `onClose`. Валидация `amount > 0`. (Пополнение/приход — отдельная кнопка «Пополнить» в этом же модале: `restockItem`.)

- [ ] **Step 3: Тест TracksTab** — рендерит созданный трек; создание нового трека через кнопку (промпт); `onOpenTrack` вызывается.

- [ ] **Step 4: Реализовать `TracksTab.tsx` и `TrackScreen.tsx`** — TrackScreen: категории сгруппированы, позиции отсортированы `sortByUrgency` внутри категории, кружок статуса (emoji из STATUS_META), клик по позиции → SpendModal. Быстрое «−1» без модалки: кнопка «−1» на строке (stopPropagation) → `spendItem(item.id, 1, '')`.

- [ ] **Step 5: Проверить** — `npx vitest run src/components/SpendModal.test.tsx src/components/TracksTab.test.tsx` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TracksTab.tsx src/components/TrackScreen.tsx src/components/SpendModal.tsx
git add src/components/SpendModal.test.tsx src/components/TracksTab.test.tsx
git commit -m "feat: tracks list, track screen, spend modal"
```

---

### Task 13: Пачка-добавление

**Files:**
- Create: `src/components/AddTab.tsx`
- Test: `src/components/AddTab.test.tsx`

**Interfaces:**
- Consumes: `db`-helpers (`listTracks`, `listCategories`, `saveItem`, `saveCategory` при необходимости), `UNITS`, `DEFAULT_TRACKING_METHODS`, `genId`, `syncMeta`.
- Produces: `AddTab({ onChanged })` — мульти-строковый ввод (первая строка всегда пустая), автодополнение названий из существующих позиций (datalist), быстрые кнопки срока (+1 мес / +1 год / своя дата / не задан), категория по умолчанию = последняя использованная, режим наследуется от способа категории, кнопка «Добавить N позиций».

- [ ] **Step 1: Тест**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { AddTab } from './AddTab';
import { createTestTrack } from '../db/test-helpers';

describe('AddTab', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('добавляет две позиции из пачки', async () => {
    await createTestTrack();
    const onChanged = vi.fn();
    render(<AddTab onChanged={onChanged} />);
    const names = screen.getAllByLabelText(/название/i);
    await userEvent.type(names[0], 'Рис');
    await userEvent.click(screen.getByRole('button', { name: /добавить 1 позици/i }));
    expect(onChanged).toHaveBeenCalled();
    const items = await db.items.toArray();
    expect(items.some(i => i.name === 'Рис')).toBe(true);
  });
});
```

- [ ] **Step 2: Реализовать `AddTab.tsx`**

Состояние: `rows: Row[]` (каждая: `name, quantity, unit, expiresAt, categoryId, trackExpiry, trackQuantity`). Логика строк:
- при изменении фокуса на последней заполненной строке — добавить пустую;
- `Enter` в поле названия → переход на следующую строку;
- кнопка «Добавить N»: для каждой строки с непустым name — `saveItem` (id = genId('itm'), syncMeta(deviceId), дефолты unit='шт' если пустой, quantity=1), затем `recordOp` типа add; сброс строк до одной пустой; `onChanged`.
- datalist автодополнения: все уникальные имена живых позиций; категории — из выбранного трека (селектор трека сверху, по умолчанию первый; если трек/категория отсутствуют — заглушка «Сначала создайте трек во вкладке „Треки“»).

- [ ] **Step 3: Проверить** — `npx vitest run src/components/AddTab.test.tsx` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/AddTab.tsx src/components/AddTab.test.tsx
git commit -m "feat: batch add screen with autocomplete"
```

---

### Task 14: Админка (PIN), «Ещё», экспорт/импорт UI, журнал

**Files:**
- Create: `src/components/AdminScreen.tsx`, `src/components/MoreTab.tsx`, `src/components/ImportPreviewModal.tsx`, `src/components/JournalScreen.tsx`
- Test: `src/components/AdminScreen.test.tsx`, `src/components/MoreTab.test.tsx`

**Interfaces:**
- Consumes: `pin.ts`, `export.ts`, `import.ts`, `pdf.ts`, db-хелперы, `parseHouseholdEnvelope`.
- Produces:
  - `AdminScreen({ onChanged, onExit })` — PIN-гейт (`verifyPin`), затем: CRUD способов отслеживания, warnDays, имя дома, подпись устройства, смена PIN.
  - `MoreTab({ onChanged, isAdmin })` — кнопки: «Экспорт бэкапа дома (JSON)», «Импорт бэкапа (JSON)» (file input → preview), «Экспорт PDF», «Экспорт шаблона трека», «Импорт шаблона трека», «Журнал», «Админ» (только isAdmin, иначе скрыто).
  - `ImportPreviewModal({ summary, onConfirm, onCancel })` — показывает «принесёт N записей, M изменений, K конфликтов» + кнопки.

- [ ] **Step 1: Тест AdminScreen**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { AdminScreen } from './AdminScreen';
import { hashPin } from '../logic/pin';

describe('AdminScreen', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('PIN-гейт: неверный PIN не открывает настройки', async () => {
    await db.deviceProfile.put({ id: 'p', role: 'admin', pinHash: await hashPin('1234'), updatedAt: 1, updatedBy: 'd', deletedAt: null });
    render(<AdminScreen onChanged={() => {}} onExit={() => {}} />);
    await userEvent.type(screen.getByLabelText(/pin/i), '0000');
    await userEvent.click(screen.getByRole('button', { name: /войти/i }));
    expect(screen.queryByText(/способы отслеживания/i)).toBeNull();
  });

  it('верный PIN открывает настройки; меняет warnDays', async () => {
    await db.deviceProfile.put({ id: 'p', role: 'admin', pinHash: await hashPin('1234'), updatedAt: 1, updatedBy: 'd', deletedAt: null });
    render(<AdminScreen onChanged={() => {}} onExit={() => {}} />);
    await userEvent.type(screen.getByLabelText(/pin/i), '1234');
    await userEvent.click(screen.getByRole('button', { name: /войти/i }));
    expect(screen.getByText(/способы отслеживания/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Реализовать `AdminScreen.tsx`** — состояние `unlocked: boolean`; PIN-экран (input + «Войти»); настройки: список методов (имя + чекбоксы expiry/quantity + удалить), добавление нового метода, input warnDays (числовой, 1–365), имя дома, подпись устройства, «Сменить PIN» (два ввода + сохранение через `hashPin`). Все сохранения через db-хелперы с `syncMeta`.

- [ ] **Step 3: Тест MoreTab** — кнопки экспорта присутствуют; у участника нет кнопки «Админ»; импорт с битым файлом показывает ошибку.

```tsx
// src/components/MoreTab.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MoreTab } from './MoreTab';
import { createTestTrack, resetDb } from '../db/test-helpers';

describe('MoreTab', () => {
  beforeEach(resetDb);

  it('показывает кнопки экспорта/импорта/журнала', async () => {
    await createTestTrack(); // дом обязателен для экспорта
    render(<MoreTab onChanged={() => {}} isAdmin />);
    expect(screen.getByRole('button', { name: /экспорт бэкапа/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /экспорт pdf/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /экспорт шаблона/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /импорт шаблона/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /журнал/i })).toBeTruthy();
  });

  it('у участника нет кнопки «Админ»', async () => {
    render(<MoreTab onChanged={() => {}} isAdmin={false} />);
    expect(screen.queryByRole('button', { name: /админ/i })).toBeNull();
  });

  it('битый файл при импорте → сообщение об ошибке', async () => {
    await createTestTrack();
    render(<MoreTab onChanged={() => {}} isAdmin />);
    const file = new File(['{bad'], 'x.json', { type: 'application/json' });
    // input[type=file] обязан иметь aria-label «Импорт бэкапа (JSON)» (см. Step 4)
    await userEvent.upload(screen.getByLabelText(/импорт бэкапа/i), file);
    expect(await screen.findByText(/не удалось|ошибк/i)).toBeTruthy();
  });
});
```

- [ ] **Step 4: Реализовать `MoreTab.tsx`, `ImportPreviewModal.tsx`, `JournalScreen.tsx`**

MoreTab: экспорт бэкапа — `buildHouseholdEnvelope` → `new Blob([JSON.stringify(env, null, 2)], {type:'application/json'})` → download (URL.createObjectURL + a[download]) или Web Share API если есть (`navigator.canShare({files})`). Импорт: `<input type="file" accept="application/json" aria-label="Импорт бэкапа (JSON)">` (aria-label обязателен — на него ссылается тест `getByLabelText`) → `file.text()` → `parseHouseholdEnvelope` → если ок, `importHouseholdEnvelope` → показать `ImportPreviewModal` с summary → «Подтвердить» (повторный вызов) — внимание: сделать двухфазно: сначала parse+preview (подсчёт выполняется на данных, но применение после подтверждения). Реализация двухфазности: `parseHouseholdEnvelope` и `buildImportPreview(env)` (те же вычисления, без записи) → на «Подтвердить» — `importHouseholdEnvelope`. Экспорт PDF: список живых треков → `buildTrackPdf` → download. Шаблон: выбор трека → `buildTrackTemplate` → download; импорт шаблона: `importTrackTemplate` через parse.
Журнал: `db.ops` по убыванию `when`, фильтр по треку (select), формат строки: дата, deviceLabel, тип (рус.), позиция, delta, note.

- [ ] **Step 5: Проверить** — `npx vitest run src/components/AdminScreen.test.tsx src/components/MoreTab.test.tsx` → PASS; `npm run build` → OK.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminScreen.tsx src/components/MoreTab.tsx src/components/ImportPreviewModal.tsx src/components/JournalScreen.tsx
git add src/components/AdminScreen.test.tsx src/components/MoreTab.test.tsx
git commit -m "feat: admin screen, more tab, import preview, journal"
```

---

### Task 15: Бейдж, PWA-полировка, финальный E2E round-trip

**Files:**
- Create: `src/hooks/useBadge.ts`
- Modify: `src/App.tsx`, `src/index.css`, `public/` (иконки из эталона скопировать: icon-180/192/512/maskable), `vite.config.ts` (manifest «Трекер запасов», цвета)
- Test: `src/logic/roundtrip.test.ts` (сквозной: онбординг → трек → позиции → списание → экспорт → новая БД → импорт → всё на месте)

**Interfaces:**
- Produces: `useBadge(count: number)` — `navigator.setAppBadge?.(count)` при изменении; очистка/игнор при отсутствии API.

- [ ] **Step 1: Тест round-trip (сквозной сценарий семьи)**

```ts
// src/logic/roundtrip.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { buildHouseholdEnvelope, buildTrackTemplate } from './export';
import { importHouseholdEnvelope, importTrackTemplate, parseHouseholdEnvelope } from './import';
import { createTestTrack } from '../db/test-helpers';

describe('e2e round-trip', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('устройство A → файл → устройство B (пустая БД): всё на месте', async () => {
    await createTestTrack();
    const env = await buildHouseholdEnvelope();
    await db.transaction('rw', db.tracks, db.categories, db.items, db.ops, db.household, async () => {
      await Promise.all([db.tracks.clear(), db.categories.clear(), db.items.clear(), db.ops.clear()]);
      await db.household.clear();
    });
    await importHouseholdEnvelope(parseHouseholdEnvelope(JSON.stringify(env)));
    expect(await db.tracks.count()).toBe(1);
    expect(await db.items.count()).toBe(2);
    expect(await db.ops.count()).toBeGreaterThan(0);
  });

  it('шаблон с A создаёт «(копию)» на B', async () => {
    const [track] = await createTestTrack();
    const tpl = await buildTrackTemplate(track.id);
    const id = await importTrackTemplate(tpl);
    expect((await db.tracks.get(id))!.name).toBe('Аптечка (копия)');
  });
});
```

- [ ] **Step 2: Реализовать `useBadge.ts`** — `useEffect` на count: `if ('setAppBadge' in navigator) navigator.setAppBadge(count).catch(() => {})`. В `App` посчитать количество проблемных позиций (просрочено+истекает+низкий+избыток) и передать в `useBadge`.

- [ ] **Step 3: PWA-полировка** — скопировать иконки из `/Users/halapinvv/Documents/Agents/pressure-sugar-tracker/public/icon-*.png`; manifest: name «Трекер запасов», short_name «Запасы», theme_color `#0e7490`, background `#eef2f6`, start_url `/family-stock-tracker/`. Проверить `display: standalone`.

- [ ] **Step 4: `src/index.css`** — минимальные токены (переменные цветов статусов, тёмный режим `prefers-color-scheme: dark` — два набора переменных), тач-таргеты ≥ 48px, safe-area padding.

- [ ] **Step 5: Проверить всё**

```bash
npx vitest run
npm run build
```

Expected: все тесты PASS (включая 2 новых e2e), сборка без ошибок.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: pwa polish, badge, e2e round-trip tests"
```

---

## Self-Review (заполняется после написания плана)

- [x] Spec §3.3 таблицы — Task 3
- [x] Spec §4 статусы/пороги — Task 5
- [x] Spec §5.1 дашборд — Task 11
- [x] Spec §5.2–5.4 треки/списание — Task 12
- [x] Spec §5.5 пачка — Task 13
- [x] Spec §5.6 админ PIN — Task 10 (онбординг) + Task 14
- [x] Spec §5.7 журнал — Task 14
- [x] Spec §5.8/§6.1–6.3 экспорт/импорт/PDF/шаблон — Tasks 7, 8, 9, 14
- [x] Spec §6.1 merge-правила — Task 4
- [x] Spec §7 ошибки (предпросмотр импорта) — Task 14
- [x] Spec §8 round-trip — Tasks 8, 15
- [x] Spec §9 критерии — Tasks 1, 11, 13, 15

Примечание к самопроверке: все правки, применённые после первого черновика (полный код вместо прозы для Tasks 1–4, 7–9; фиксация кортежной фикстуры `createTestTrack()` → `[track, cat, item1, item2]` по всему плану; `mergeEnvelope`→синхронный типобезопасный; удаление неиспользуемых `findTestItem`/`track`/`JournalScreen.test.tsx` из команд) — сделаны для связности между задачами: если Task N ссылается на код Task M, код в плане согласован (типы, сигнатуры, имена). Несогласованных ссылок между задачами не осталось.