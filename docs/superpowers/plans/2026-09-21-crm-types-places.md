# v2 «Типы + Места» + настраиваемые единицы — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести «Трекер запасов» на модель v2 из спеки `docs/superpowers/specs/2026-09-21-crm-types-places-design.md`: бывшие `categories` становятся `places` (места внутри треков, создаёт любой участник), добавляется глобальный каталог `types` (создаёт только админ, каждый ссылается на способ отслеживания), позиция получает `typeId + placeId`, единицы выносятся из константы `UNITS` в таблицу `units` (каталог админа), на экране добавления появляются селекты Трек→Место→Тип и поля min/max. Вся миграция (база v1→v2 и файл-бэкап v1→v2) идёт через единый чистый конвертер.

**Architecture:** Остаётся «локально-сначала»: Dexie — источник истины, файловый обмен = LWW-слияние тем же движком. Схема v2 сразу готова к будущему серверному синку (все новые таблицы наследуют `SyncFields`). Миграция базы и конвертация файл-бэкапа v1 используют один и тот же чистый модуль `planV2` (DRY). Индексы Dexie перестраиваются в две стадии (версии 2 и 3), чтобы ни на одном промежуточном коммите рантайм не разваливался.

**Tech Stack:** неизменный (React 19 · TS 5.9 · Vite 6 · Dexie 4 · vitest 3 + Testing Library + fake-indexeddb · jspdf · GitHub Pages + Docker для локальной проверки).

## Global Constraints

- Репозиторий: `/Users/halapinvv/Documents/Agents/family-stock-tracker`, ветка `main`
- Base path Vite: `/family-stock-tracker/`; локальная проверка: docker (nginx на `:5173`)
- Язык интерфейса: русский. Все пользовательские строки — в `src/constants.ts`
- Любая запись для синка: `{ id, ..., updatedAt, updatedBy, deletedAt }`; id только через `genId(prefix)` из `src/logic/ids.ts`
- **Исключение из genId:** сид-записи (как `DEFAULT_TRACKING_METHODS`): `DEFAULT_UNITS` и сид-метод «Срок годности» используют фиксированные id — это гарантирует идемпотентность сида и схождение при слиянии
- `src/logic/merge.ts` — единственный источник правды для слияния; таблицы `places`/`types`/`units` обязаны участвовать в `mergeEnvelope`
- Удаление = мягкое (`deletedAt`) для places/types/units/items/tracks/trackingMethods
- Модули ≤ 200 строк; компоненты ≤ 250 строк (превышение → вынос подфайлов: `AddRow.tsx`, `AdminTypesSection.tsx`, `AdminUnitsSection.tsx`)
- TDD: сначала тест (FAIL) → реализация → тест PASS → коммит
- Тесты: `npx vitest run`; типы: `tsc --noEmit`; сборка: `npm run build` (tsc -b + vite build)
- Docker-инфраструктура (Dockerfile, docker-compose.yml, nginx.conf, .dockerignore, demo-backup.json) — коммитится отдельно в Task 0, неизменной остаётся (кроме пересборки образа в Task 7)
- Коммиты: `git -c user.name="Sisyphus" -c user.email="sisyphus@local" commit -m "..."` (глобальный git-config тянет чужой identity — всегда переопределять)

## File Structure (изменения)

```
src/
├── types.ts                        # v2: Place, Type, Unit, Item{placeId,typeId}, CategoryV1/ItemV1, envelopes, LocalState/MergedState
├── constants.ts                    # UNITS → DEFAULT_UNITS (фикс. id), EMPTY_ITEM(placeId,typeId), строки для min/max/«+ Место»
├── db/
│   ├── db.ts                       # version(1..3), CRUD: listPlaces/savePlace, listTypes/saveType/softDeleteType,
│   │                               #   listUnits/saveUnit/softDeleteUnit, ensureUnits в ensureOnboarding,
│   │                               #   addItem/item-мутации по placeId
│   ├── migrate-v2.ts               # (новый) upgrade tx: v1→v2 (через planV2) и v2→v3 (дочистка categoryId)
│   ├── catalog.ts                  # (новый) CRUD places/types/units + listUnits + seedUnitsIfEmpty — выделено, чтобы db.ts ≤ 200 строк
│   └── test-helpers.ts             # createTestType/createTestPlace/createTestItem(placeId, typeId), кортеж [track, place, item1, item2]
├── logic/
│   ├── v2upgrade.ts                # (новый) planV2: категории v1 → {places, types, typeIdByCategoryId, seedExpiryMethod}
│   ├── merge.ts                    # mergeEnvelope: + types/units/places
│   ├── export.ts                   # HouseholdEnvelope v2; TrackTemplateEnvelope v2 (placeName/typeName)
│   ├── import.ts                   # parse v1|v2 (union), upgradeEnvelopeV1 через planV2, importTrackTemplate v2
│   ├── pdf.ts                      # группировка по местам, заголовок «Место»
│   └── add-form.ts                 # Row: + placeId/typeId/min/max, createEmptyRow(placeId, typeId, mode, unit)
└── components/
    ├── TrackScreen.tsx             # «+ Место», группировка по местам, единицы из каталога
    ├── AddTab.tsx + AddRow.tsx     # Трек→Место→Тип, min/max, единицы из каталога
    ├── AdminScreen.tsx + AdminTypesSection.tsx + AdminUnitsSection.tsx
    ├── DashboardTab.tsx            # механический ренейм categories→places
    └── App.tsx                     # openItemTrack: db.places.get(item.placeId)
```

---

### Task 0: Закоммитить накопленные исправления (таб-бар, онбординг, Docker)

**Files:**
- Modify: `src/App.tsx` (фикс переключения таб-бара при открытой карточке трека), онбординг-фиксы
- Add/уже в работе каталога: `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `.dockerignore`, `demo-backup.json` (v1-формат, остаётся как фикстура проверки импорта v1)

**Interfaces:**
- Produces: чистое рабочее дерево до старта v2; docker compose up работает на `:5173`.

- [ ] **Step 1: Проверить текущее состояние**

```bash
git status --short
git diff --stat
```

Ожидание: незакоммичены `src/App.tsx`, онбординг-правки, docker-файлы.

- [ ] **Step 2: Два коммита** (исправления и инфраструктура раздельно)

```bash
git add src/App.tsx  # + файлы онбординг-фиксов
git -c user.name="Sisyphus" -c user.email="sisyphus@local" commit -m "fix: tab bar switching with open track card; onboarding edge cases"

git add Dockerfile docker-compose.yml nginx.conf .dockerignore demo-backup.json
git -c user.name="Sisyphus" -c user.email="sisyphus@local" commit -m "chore: docker deploy setup with nginx"
```

- [ ] **Step 3: Проверить** — `git status --short` пуст; докер-сборка: `docker compose build && docker compose up -d` → `curl -s http://localhost:5173/family-stock-tracker/ | head -5` (отдаёт index.html).

---

### Task 1: Чистый конвертер `planV2` (категории v1 → места + типы)

**Files:**
- Create: `src/logic/v2upgrade.ts`, `src/logic/v2upgrade.test.ts`

**Interfaces:**
- Consumes: `Category`, `TrackingMethod`, `Place`, `Type` (текущие типы из `types.ts`; на этом шаге `types.ts` ещё v1 — `Place`/`Type` объявляются локально во `v2upgrade.ts` через совместимые со спекой формы).
- Produces: `planV2(legacyCategories, trackingMethods, now): V2UpgradeResult`. Чистая функция, без I/O. Используется миграцией Dexie (Task 2) и импортом v1-бэкапа (Task 3).

```ts
export interface V2UpgradeResult {
  places: Array<{ id: string; trackId: string; name: string; emoji: string; sortOrder: number }>;
  types: Array<{ id: string; name: string; emoji: string; trackingMethodId: string; sortOrder: number }>;
  typeIdByCategoryId: Map<string, string>; // ВСЕ категории (включая могилки) → typeId
  seedExpiryMethod: { id: string; name: string; flags: { expiry: boolean; quantity: boolean }; sortOrder: number } | null;
}
```

Правила (спека §4.1, §4.2):
1. `places` = категории без поля `trackingMethodId`; id места = id категории.
2. `types` = по уникальным именам категорий в порядке `sortOrder` (первая с таким именем побеждает, включая могилки — чтобы каждая позиция гарантированно получила `typeId`); `trackingMethodId` = `категория.trackingMethodId`, если он существует и не могилка, иначе сид-метод «Срок годности».
3. Сид-метод создаётся ровно один раз на вызов, если нужен и не существует живого «Срок годности»: id `tm_expiry` (совпадает с `DEFAULT_TRACKING_METHODS[0]` для схождения при мерже), флаги `{expiry: true, quantity: false}`, `sortOrder = max(существующих)+1`.
4. Результат идемпотентен по смыслу: для одинаковых входов возвращает одинаковые места; typeId генерируются через `genId('typ')` (разные id на разных вызовах — допустимо, merge это учитывает).

- [ ] **Step 1: Тест FAIL** — `src/logic/v2upgrade.test.ts`

```ts
// src/logic/v2upgrade.test.ts
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
```

- [ ] **Step 2: Реализовать `src/logic/v2upgrade.ts`**

```ts
// src/logic/v2upgrade.ts
import { genId } from './ids';
import type { Category, TrackingMethod } from '../types';

export interface V2UpgradeResult {
  places: Array<{ id: string; trackId: string; name: string; emoji: string; sortOrder: number }>;
  types: Array<{ id: string; name: string; emoji: string; trackingMethodId: string; sortOrder: number }>;
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
  legacyCategories: Category[],
  trackingMethods: TrackingMethod[],
  now: number,
): V2UpgradeResult {
  const liveMethodId = (id: string | null): string | null =>
    id && trackingMethods.some(m => m.id === id && m.deletedAt === null) ? id : null;

  const seedExpiryMethod: TrackingMethod | null =
    trackingMethods.some(m => m.name === SEED_METHOD_NAME && m.deletedAt === null) || !legacyCategories.some(c => liveMethodId(c.trackingMethodId) === null)
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

  const resolveMethodId = (c: Category): string =>
    liveMethodId(c.trackingMethodId) ?? seedExpiryMethod?.id ?? SEED_METHOD_ID;

  const places: V2UpgradeResult['places'] = legacyCategories.map(({ trackingMethodId: _drop, ...place }) => place);

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
      });
    }
    typeIdByCategoryId.set(c.id, typeId);
  }
  return { places, types, typeIdByCategoryId, seedExpiryMethod };
}
```

- [ ] **Step 3: Проверить** — `npx vitest run src/logic/v2upgrade.test.ts` → PASS; `npm run build` → OK.

- [ ] **Step 4: Commit**

```bash
git add src/logic/v2upgrade.ts src/logic/v2upgrade.test.ts
git -c user.name="Sisyphus" -c user.email="sisyphus@local" commit -m "feat: pure v1-to-v2 converter (categories → places + types)"
```

---

### Task 2: Схема Dexie v2 (добавочно) + миграция + CRUD каталога

> Цель этой задачи — **аддитивное** расширение: старый код (категории, `UNITS`, Item c `categoryId`) продолжает работать, все старые тесты зелёные. Полный ренейм на v2 — отдельная атомарная задача Task 3.

**Files:**
- Create: `src/db/migrate-v2.ts`, `src/db/catalog.ts`
- Modify: `src/db/db.ts`, `src/constants.ts` (+ `DEFAULT_UNITS`), `src/db/test-helpers.ts` (аддитивно: `createTestPlace`/`createTestType` рядом со старыми хелперами)
- Test: `src/db/db.test.ts` (новые кейсы миграции и каталога)

**Interfaces:**
- Consumes: `planV2`, `DEFAULT_UNITS`.
- Produces: `db.version(2).stores` (двойная схема: `categories` остаётся, добавляются `places/types/units`, у `items` дополнительный индекс `placeId`); `.upgrade(migrateV2)`; CRUD каталога; `ensureOnboarding` сидит единицы.

- [ ] **Step 1: `src/constants.ts` — `DEFAULT_UNITS`** (фикс. id, чтобы bulkPut был идемпотентен; рядом с `DEFAULT_TRACKING_METHODS`). `UNITS` пока остаётся (удаляется в Task 3).

```ts
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
```

(`Unit` объявить временно локально в `constants.ts` — `type` добавится в `types.ts` только в Task 3.)

- [ ] **Step 2: Тест FAIL — миграция v1→v2.** Моделируем старую базу отдельным Dexie-инстансом только с version(1), закрываем, потом открываем наш `db` (объявляет version(1)+version(2)) — Dexie прогоняет upgrade.

```ts
// src/db/db.test.ts — добавляем в существующий describe
import Dexie from 'dexie';
import { DEFAULT_UNITS } from '../constants';

/** Пишет настоящую базу v1 в fake-indexeddb (наш db объявляет v1..v2). */
async function seedLegacyV1(): Promise<void> {
  const legacy = new Dexie('family-stock-tracker');
  legacy.version(1).stores({
    household: 'id', deviceProfile: 'id', trackingMethods: 'id', tracks: 'id',
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

it('миграция v1→v2: категория → место + тип, item получает placeId/typeId, единицы засеяны', async () => {
  await db.close();
  await seedLegacyV1();
  await db.open(); // запускает upgrade v1→v2
  const places = await db.places.toArray();
  expect(places).toHaveLength(1);
  expect(places[0]).toMatchObject({ id: 'cat_1', name: 'Аптечка' });
  expect(places[0]).not.toHaveProperty('trackingMethodId');
  const types = await db.types.toArray();
  expect(types).toHaveLength(1);
  expect(types[0].trackingMethodId).toBe('tm_expiry');
  const item = (await db.items.get('itm_1'))!;
  expect(item.placeId).toBe('cat_1');
  expect(item.typeId).toBe(types[0].id);
  expect(await db.units.count()).toBe(DEFAULT_UNITS.length);
});
```

ВАЖНО: `seedLegacyV1` создаёт Dexie-инстанс с ТОЙ ЖЕ базой `family-stock-tracker`; `db.close()` обязателен перед ним, `db.open()` после. В `resetDb` не трогаем.

- [ ] **Step 3: Реализовать `src/db/migrate-v2.ts`** — upgrade-транзакция, работает через `tx.table`, не через API db (внутри upgrade API-хелперы недоступны).

```ts
// src/db/migrate-v2.ts
import type Dexie from 'dexie';
import type { Category, Item, TrackingMethod } from '../types';
import { DEFAULT_UNITS } from '../constants';
import { planV2 } from '../logic/v2upgrade';

type Tx = Parameters<Parameters<Dexie['version']>[0]['upgrade']>[0] extends never
  ? { table<T, K>(name: string): ReturnType<Dexie['table']> }
  : never;

/** v1→v2: категории → места+типы (planV2), items получают placeId/typeId, сид единиц. */
export async function migrateV2(tx: any): Promise<void> {
  const categories = await tx.table<Category, string>('categories').toArray();
  const methods = await tx.table<TrackingMethod, string>('trackingMethods').toArray();
  const result = planV2(categories, methods, Date.now());
  await tx.table('places').bulkPut(result.places);
  await tx.table('types').bulkPut(result.types);
  if (result.seedExpiryMethod) await tx.table('trackingMethods').put(result.seedExpiryMethod);
  if ((await tx.table('units').count()) === 0) {
    await tx.table('units').bulkPut(DEFAULT_UNITS.map(u => ({ ...u, updatedAt: Date.now(), updatedBy: 'seed' })));
  }
  const items = await tx.table<Item, string>('items').toArray();
  await tx.table('items').bulkPut(
    items.map(i => ({
      ...i,
      placeId: i.placeId ?? (i as Item & { categoryId: string }).categoryId,
      typeId: i.typeId ?? result.typeIdByCategoryId.get((i as Item & { categoryId: string }).categoryId) ?? result.types[0]?.id ?? '',
    })),
  );
}
```

Замечание по типизации: на этом шаге `Item` ещё v1 (без `placeId/typeId`), поэтому `migrateV2` временно открывает поля через пересечение. В Task 3 сигнатура упростится (Item уже v2, `categoryId` удалён; tx-типизация заменяется на честную).

- [ ] **Step 4: `src/db/db.ts` — версия 2 + таблицы каталога + сид единиц**

В классе `TrackerDb` после `version(1)`:

```ts
this.version(2).stores({
  household: 'id', deviceProfile: 'id', trackingMethods: 'id', tracks: 'id',
  categories: 'id, trackId',           // остаётся на время Task 2 (старый код жив)
  places: 'id, trackId',
  types: 'id',
  units: 'id',
  items: 'id, categoryId, placeId',    // двойной индекс переходного периода
  ops: 'id, itemId, when', meta: 'key',
}).upgrade(migrateV2);
```

Объявления таблиц в классе: `places!: Table<{ id: string; trackId: string; name: string; emoji: string; sortOrder: number }, string>;` и аналогично `types`/`units` (временные локальные shape-типы до Task 3).

В `ensureOnboarding` добавить единицы (идемпотентно по фикс. id):

```ts
export async function ensureOnboarding(): Promise<void> {
  const now = Date.now();
  await db.trackingMethods.bulkPut(DEFAULT_TRACKING_METHODS.map(m => ({ ...m, updatedAt: now, updatedBy: 'seed' })));
  await db.units.bulkPut(DEFAULT_UNITS.map(u => ({ ...u, updatedAt: now, updatedBy: 'seed' })));
}
```

- [ ] **Step 5: Реализовать `src/db/catalog.ts`** (вынос CRUD каталога — db.ts не растёт)

```ts
// src/db/catalog.ts
import { db } from './db';
import { genId, syncMeta } from '../logic/ids';

export interface PlaceRow { id: string; trackId: string; name: string; emoji: string; sortOrder: number }
export interface TypeRow { id: string; name: string; emoji: string; trackingMethodId: string; sortOrder: number }
export interface UnitRow { id: string; name: string; sortOrder: number }

export async function listPlaces(trackId: string): Promise<PlaceRow[]> {
  const rows = await db.places.where('trackId').equals(trackId).toArray();
  return (rows as PlaceRow[]).filter(p => !('deletedAt' in p) || (p as { deletedAt: number | null }).deletedAt === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function savePlace(place: PlaceRow): Promise<void> {
  const deviceId = await db.meta.get('deviceId').then(r => String(r?.value ?? 'unknown'));
  await db.places.put({ ...place, updatedAt: Date.now(), updatedBy: deviceId, deletedAt: null });
}

export async function listTypes(): Promise<TypeRow[]> { /* аналогично: живое + sortOrder */ }
export async function saveType(type: TypeRow): Promise<void> { /* + sync-поля */ }
export async function softDeleteType(id: string): Promise<void> { /* мягкое удаление, без ops */ }
export async function listUnits(): Promise<UnitRow[]> { /* живое + sortOrder */ }
export async function saveUnit(unit: UnitRow): Promise<void> { /* + sync-поля */ }
export async function softDeleteUnit(id: string): Promise<void> { /* мягкое удаление, без ops */ }
```

Типизация: на Task 2 (пока `types.ts` v1) сигнатуры используют локальные row-типы; в Task 3 заменяются на `Place`/`Type`/`Unit` из `types.ts`. `savePlace/saveType/saveUnit` повторяют паттерн `saveCategory` (syncMeta через meta.deviceId).

- [ ] **Step 6: Тесты CRUD каталога** (в `db.test.ts`): `listPlaces` фильтрует могилки и сортирует по sortOrder; `softDeleteType` ставит deletedAt и убирает из `listTypes`; `ensureOnboarding` сидит ровно `DEFAULT_UNITS.length` единиц.

- [ ] **Step 7: Проверить** — `npx vitest run src/db/db.test.ts src/logic/v2upgrade.test.ts` → PASS (старые кейсы не сломались), `npm run build` → OK.

- [ ] **Step 8: Commit**

```bash
git add src/constants.ts src/db/db.ts src/db/migrate-v2.ts src/db/catalog.ts src/db/db.test.ts
git -c user.name="Sisyphus" -c user.email="sisyphus@local" commit -m "feat: dexie v2 schema with migration and catalog crud"
```

---

### Task 3: Атомарный ренейм на модель v2 (types → db → логика → компоненты → все тесты)

> **Почему один коммит:** `Item.categoryId → placeId` и таблица `categories → places` пронизывают ВСЕ слои (types, db, merge/export/import/pdf, add-form, 4 компонента, 12 тест-файлов). Промежуточных «зелёных» состояний не существует — это единая атомарная трансформация. Поэтому шаги внутри задачи идут по слоям, а полный прогон `vitest`+`tsc` выполняется в финальном шаге.

**Files:**
- Modify: `src/types.ts`, `src/constants.ts`, `src/db/db.ts`, `src/db/migrate-v2.ts`, `src/db/catalog.ts`, `src/db/test-helpers.ts`, `src/logic/v2upgrade.ts`, `src/logic/merge.ts`, `src/logic/export.ts`, `src/logic/import.ts`, `src/logic/pdf.ts`, `src/logic/add-form.ts`, `src/components/App.tsx` (via `DashboardTab` путь), `src/components/DashboardTab.tsx`, `src/components/TrackScreen.tsx` (механика, без «+ Место» — это Task 4), `src/components/AddTab.tsx` (механика ренейма, без Трек→Место→Тип — Task 5), `src/components/AdminScreen.tsx` (ренейм, секции — Task 6)
- Test: `status.test.ts`, `merge.test.ts`, `export.test.ts`, `import.test.ts`, `roundtrip.test.ts`, `pdf.test.ts` (если нужно), `constants.test.ts`, `db.test.ts`, `Onboarding.test.tsx`, `App.test.tsx`, `DashboardTab.test.tsx`, `TracksTab.test.tsx`, `MoreTab.test.tsx`, `SpendModal.test.tsx`, `AddTab.test.tsx` (механика), + новые фикстуры

**Interfaces:**
- Produces: компилируемая и зелёная по тестам модель v2 с ПОВЕДЕНЧЕСКИ эквивалентным UI (новые фичи UI — Tasks 4–6).

- [ ] **Step 1: `src/types.ts` — модель v2 (полная замена)**

```ts
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
  expiresAt: string | null;
  packSize: number | null;
  trackExpiry: boolean;
  trackQuantity: boolean;
  notes: string;
  createdAt: number;
}

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
```

`Category` и `Item.categoryId` удаляются из типов. Все места кода, ссылавшиеся на них, правим в шагах ниже.

- [ ] **Step 2: `src/constants.ts`** — `UNITS` удалить (заменён каталогом); `EMPTY_ITEM`:

```ts
export const EMPTY_ITEM = (placeId: string, typeId: string): Item => ({
  id: '', placeId, typeId, name: '', unit: 'шт', quantity: 0, minThreshold: null,
  maxThreshold: null, expiresAt: null, packSize: null, trackExpiry: false,
  trackQuantity: false, notes: '', createdAt: 0, updatedAt: 0, updatedBy: '', deletedAt: null,
});
```

Строки для новых UI-элементов (в константы):
```ts
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
```

- [ ] **Step 3: `src/db/db.ts` + `src/db/migrate-v2.ts` + `src/db/catalog.ts` — финальная схема**

- `db.ts`: `version(3).stores` заявляет без `categories`, `items: 'id, placeId'`; `migrateV3` (в migrate-v2.ts) дочищает хвосты (для записей, что писались старым кодом в переходный период: `placeId ??= categoryId`, `typeId` через `planV2` оставшихся категорий, удалить ключ `categoryId` из объектов). Таблицы класса: `places!: Table<Place, string>; types!: Table<Type, string>; units!: Table<Unit, string>;`
- `db.ts` rename: `listCategories`→`listPlaces`, `saveCategory`→`savePlace`, `listActiveItems(categoryId)`→`listActiveItems(placeId)` с `where('placeId')`, `softDeleteItem` берёт `db.places.get(item.placeId).trackId`, `mutateQuantity` аналогично, `addItem(item, trackId, note)` — `db.places.get(item.placeId)` внутри транзакции, `loadHouseholdData()` возвращает `places/types/units` (и `deviceProfile`).
- `catalog.ts`: сигнатуры на `Place`/`Type`/`Unit` из `types.ts`, sync-поля через `syncMeta(deviceId)` как `saveCategory` (убрать временные row-типы).
- `migrate-v2.ts`: чистка типа `Tx`; `migrateV3`:

```ts
export async function migrateV3(tx: any): Promise<void> {
  const categories = await tx.table<CategoryV1, string>('categories').toArray();
  const methods = await tx.table<TrackingMethod, string>('trackingMethods').toArray();
  const result = planV2(categories, methods, Date.now());
  const items = await tx.table<Item, string>('items').toArray();
  await tx.table('items').bulkPut(
    items.map(({ categoryId: _drop, ...rest }) => ({
      ...rest,
      placeId: rest.placeId ?? '',   // таблица categories уже удалена схемой: хвостов быть не должно
      typeId: rest.typeId ?? result.typeIdByCategoryId.get(rest.placeId) ?? result.types[0]?.id ?? '',
    })),
  );
}
```

(Хвосты невозможны: v2 upgrade уже проставил placeId/typeId всем записям; v3 — страховочная дочистка + удаление лишнего ключа.)

- [ ] **Step 4: Логика — `merge.ts`, `export.ts`, `import.ts`, `pdf.ts`, `add-form.ts`**

- `merge.ts`: `mergeEnvelope` получает `types/units/places` в `mergeLists` и возвращает их в `records` (`MergedState`).
- `export.ts`:
  - `buildHouseholdEnvelope(): Promise<HouseholdEnvelopeV2>` — version 2, включает `types/units/places` (живые + могилки, как остальные таблицы).
  - `buildTrackTemplate(trackId): Promise<TrackTemplateEnvelope>` — version 2; `places` = живые места трека `{name, emoji}`; `TemplateItem` = `{ ...item, placeName: место.name, typeName: тип.name }` (тип по `item.typeId` из `loadHouseholdData`), `expiresAt: null`, без ops (поведение v1 сохраняется).
- `import.ts`:
  - `parseHouseholdEnvelope(json)`: `version ∈ {1,2}`; возвращает `HouseholdEnvelope` (union).
  - `importHouseholdEnvelope(env)`: если v1 → `upgradeEnvelopeV1(env)` → v2; затем `mergeEnvelope(v2, local)` и запись. `upgradeEnvelopeV1`:

```ts
function upgradeEnvelopeV1(env: HouseholdEnvelopeV1): HouseholdEnvelopeV2 {
  const result = planV2(env.categories, env.trackingMethods, Date.now());
  return {
    format: 'household-backup',
    version: 2,
    exportedAt: env.exportedAt,
    deviceId: env.deviceId,
    deviceLabel: env.deviceLabel,
    household: env.household,
    trackingMethods: result.seedExpiryMethod ? [...env.trackingMethods, result.seedExpiryMethod] : env.trackingMethods,
    tracks: env.tracks,
    types: result.types,
    units: [], // единицы НЕ распространяются из бэкапа: локальный сид (ensureOnboarding) уже есть;
               // иначе каждый импорт v1 плодил бы дублирующие unit-записи, воюющие с локальными правками админа
    places: result.places,
    items: env.items.map(i => {
      const { categoryId, ...rest } = i;
      return { ...rest, placeId: categoryId, typeId: result.typeIdByCategoryId.get(categoryId) ?? result.types[0]?.id ?? '' };
    }),
    ops: env.ops,
  };
}
```

  - `importTrackTemplate(env)`: v2. Места создаются заново (`{ name, emoji }` → `savePlace`, id через `genId('plc')`); типы: `listTypes()` → по `typeName` найти живой, иначе создать через `saveType` с `trackingMethodId` = живой «Срок годности» (или сид `tm_expiry` через `planV2([], methods, now)`); позиции: `TemplateItem.placeName` → id места, `typeName` → id типа, остальные поля как было.
- `pdf.ts`: `db.categories.where('trackId')` → `db.places.where('trackId')`; заголовок колонки «Категория» → «Место»; сортировка/группировка по `placeId`.
- `add-form.ts`: `Row` = `{ name; quantity; unit; placeId; typeId; expiresAt; packSize; trackExpiry; trackQuantity; notes; min; max; }` (`min`/`max` — строки из input, пустые = null); `createEmptyRow(placeId, typeId, mode: {expiry, quantity}, defaultUnit)`, `parseRows` пишет `minThreshold/maxThreshold` (пустая строка → null, запятая → точка), `rowToItem` использует placeId/typeId. (На этом шаге только механика ренейма и полей Row; визуальные селекты — Task 5.)

- [ ] **Step 5: `test-helpers.ts` — фикстуры v2 (кортеж [track, place, item1, item2] — ПОЗИЦИИ ТУПЛА СТАБИЛЬНЫ)**

```ts
export async function createTestType(name = 'Медикаменты', methodId = 'tm_expiry'): Promise<Type> {
  const type: Type = {
    id: genId('typ'), name, emoji: '💊', trackingMethodId: methodId, sortOrder: 0,
    updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
  };
  await db.types.put(type);
  return type;
}

export async function createTestPlace(trackId: string, name = 'Тестовое место'): Promise<Place> {
  const place: Place = {
    id: genId('plc'), trackId, name, emoji: '📦', sortOrder: 0,
    updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
  };
  await db.places.put(place);
  return place;
}

export async function createTestItem(
  placeId: string, typeId: string, qty: number, overrides: Partial<Item> = {},
): Promise<Item> {
  const item: Item = {
    id: genId('itm'), placeId, typeId, name: overrides.name ?? 'Тестовая позиция', unit: 'шт',
    quantity: qty, minThreshold: null, maxThreshold: null, expiresAt: null, packSize: null,
    trackExpiry: false, trackQuantity: false, notes: '', createdAt: Date.now(),
    updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
    ...overrides,
  };
  await db.items.put(item);
  return item;
}

/** [track, place, item1, item2]. Трек «Аптечка» 💊, место «Аптечка дома» 🏠,
 *  тип «Медикаменты» (tm_expiry), item1 «Найз» (qty 10 → 9), item2 «Пластыри» (3 → 2). */
export async function createTestTrack(): Promise<[Track, Place, Item, Item]> {
  await getOrCreateHouseholdForTest();
  await ensureOnboarding();
  const track: Track = { id: genId('trk'), name: 'Аптечка', emoji: '💊', sortOrder: 0, createdAt: Date.now(),
    updatedAt: Date.now(), updatedBy: 'test', deletedAt: null };
  await db.tracks.put(track);
  const place = await createTestPlace(track.id, 'Аптечка дома');
  place.emoji = '🏠';
  await db.places.put(place);
  const type = await createTestType();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const i1 = await createTestItem(place.id, type.id, 10, {
    name: 'Найз', minThreshold: 5, expiresAt: yesterday, trackExpiry: true, trackQuantity: true,
  });
  const i2 = await createTestItem(place.id, type.id, 3, {
    name: 'Пластыри', minThreshold: 5, trackQuantity: true,
  });
  await spendItem(i1.id, 1, 'фикстура');
  await spendItem(i2.id, 1, 'фикстура');
  return [track, place, (await db.items.get(i1.id))!, (await db.items.get(i2.id))!];
}
```

`createTestCategory` удаляется; вызовы меняются на `createTestPlace`/`createTestItem(placeId, typeId, ...)`.

- [ ] **Step 6: Компоненты — механический ренейм** (без новых фич)

- `DashboardTab.tsx`: `catById`/`categories` → места; «по категориям» → «по местам» в строках UI (при их наличии); группировка сводки по местам.
- `App.tsx`: `openItemTrack` — `db.categories.get(item.categoryId)` → `db.places.get(item.placeId)`.
- `TrackScreen.tsx`: `listCategories(track.id)` → `listPlaces(track.id)`; `catById` → `placeById`; отображение единицы: `UNITS.includes(item.unit) ? item.unit : 'шт'` → `unitNames.has(item.unit) ? item.unit : 'шт'` (список имён из `listUnits()`, загружается рядом с данными трека). Кнопки группировки/заголовки секций — «Место».
- `AddTab.tsx` (механика): заменить `db.categories`/`listCategories` на места; мета-ключ `lastCategoryId` → `lastPlaceId`; поля строки из add-form v2 (`placeId/typeId/min/max` — заполняются фолбэками: первое место трека / первый тип / '', чтобы UI не сломался до Task 5).
- `AdminScreen.tsx`: ренейм `Category`-полей (если задействованы) — на этом шаге секции способов/дома не трогаем.

- [ ] **Step 7: Тесты — правки под v2** (сначала FAIL по одному файлу, реализация уже выше, затем PASS)

| Файл | Правка |
|---|---|
| `status.test.ts` | `make()`: `categoryId: 'c'` → `placeId: 'p', typeId: 't'` |
| `merge.test.ts` | `base()`: то же; кейс mergeEnvelope — ожидания по types/units/places |
| `export.test.ts` | `env.version === 2`; `categories`→`places`; наличие `types/units`; трек-шаблон: `version 2`, `placeName/typeName` |
| `import.test.ts` | очистка `db.categories.clear()` → `db.places.clear()`; тест импорта v1-бэкапа (полный round-trip через `upgradeEnvelopeV1`); шаблон v2 |
| `roundtrip.test.ts` | очистка → `db.places` (+ при необходимости `db.types/db.units`) |
| `constants.test.ts` | `UNITS` → `DEFAULT_UNITS` (id уникальны; содержит «шт» и «кг») |
| `db.test.ts` | фикстуры: `createTestItem(placeId, typeId, ...)`; списание через кортеж не меняется |
| `Onboarding.test.tsx` | demoEnvelope → `HouseholdEnvelopeV2` (пустые `types/units/places`) |
| `App/DashboardTab/TracksTab/MoreTab/SpendModal.test.tsx` | без правок (кортеж стабилен) или точечные ренеймы, если использовали `categories` |

- [ ] **Step 8: Проверить всё**

```bash
npx vitest run        # все PASS
npx tsc --noEmit      # без ошибок
npm run build         # сборка OK
```

- [ ] **Step 9: Commit**

```bash
git add src/
git -c user.name="Sisyphus" -c user.email="sisyphus@local" commit -m "feat: v2 data model rename (categories → places, items placeId+typeId, units catalog)"
```

---

### Task 4: Экран трека — «+ Место» и единицы из каталога

**Files:**
- Modify: `src/components/TrackScreen.tsx`
- Create: `src/components/TrackScreen.test.tsx`
- Consumes: `listPlaces/savePlace/listUnits` из каталога, `UI_TEXTS`.

**Interfaces:**
- Produces: группировка позиций по местам (уже в Task 3), кнопка «Добавить место» для всех ролей, select-единиц в оформлении позиций из каталога с фолбэком `'шт'`.

- [ ] **Step 1: Тест FAIL — «Добавить место» создаёт место и перегружает список**

```tsx
// src/components/TrackScreen.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackScreen } from './TrackScreen';
import { createTestTrack, resetDb } from '../db/test-helpers';
import { db } from '../db/db';

describe('TrackScreen', () => {
  beforeEach(resetDb);

  it('кнопка «Добавить место» (admin и member) создаёт место', async () => {
    const [track] = await createTestTrack();
    vi.spyOn(window, 'prompt').mockReturnValueOnce('Аптечка в машине').mockReturnValueOnce('🚗');
    render(<TrackScreen trackId={track.id} onBack={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /добавить место/i }));
    await waitFor(async () => {
      expect(await db.places.where('trackId').equals(track.id).count()).toBe(2);
    });
    expect(screen.getByText('Аптечка в машине')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Реализовать в `TrackScreen.tsx`**

- Состояние: `places`, `units` (`listUnits()`), `items` — перезагрузка после модификации мест.
- Кнопка «Добавить место» (под заголовком, паттерн как у создания трека в TracksTab — два `window.prompt`: имя, эмодзи, дефолт `📦`):

```tsx
async function handleAddPlace(): Promise<void> {
  const name = window.prompt(UI_TEXTS.placeNamePrompt);
  if (!name?.trim()) return;
  const emoji = window.prompt(UI_TEXTS.placeEmojiPrompt) || '📦';
  await savePlace({
    id: genId('plc'), trackId, name: name.trim(), emoji,
    sortOrder: places.length, updatedAt: Date.now(), updatedBy: 'ui', deletedAt: null,
  });
  await reload();
}
```

- Отображение единицы: `const unitNames = new Set(units.map(u => u.name)); const unitName = unitNames.has(item.unit) ? item.unit : 'шт';`
- «−1»/модалка списания и статусы — без изменений (Task 3 их не трогал по поведению).

- [ ] **Step 3: Проверить** — `npx vitest run src/components/TrackScreen.test.tsx` → PASS; `npx tsc --noEmit` → OK.

- [ ] **Step 4: Commit**

```bash
git add src/components/TrackScreen.tsx src/components/TrackScreen.test.tsx src/constants.ts
git -c user.name="Sisyphus" -c user.email="sisyphus@local" commit -m "feat: track screen add-place button and catalog units"
```

---

### Task 5: Экран добавления — Трек→Место→Тип, min/max, единицы, `AddRow`

**Files:**
- Modify: `src/components/AddTab.tsx`, `src/logic/add-form.ts`
- Create: `src/components/AddRow.tsx`
- Test: `src/components/AddTab.test.tsx`

**Interfaces:**
- Produces: каскад селектов Трек→Место→Тип; наследование режима (tracks) и единицы от типа/каталога; поля min/max на строке; add-форма сохраняется ≤ 250 строк за счёт `AddRow`.

- [ ] **Step 1: Тест FAIL** — селекты и min/max влияют на сохранённый item

```tsx
// src/components/AddTab.test.tsx — добавляем кейсы
it('каскад Трек→Место→Тип; min/max попадают в позицию', async () => {
  const [track] = await createTestTrack(); // место + тип уже есть
  render(<AddTab />);
  // выбираем трек (если селект — по роли; в v1 AddTab сам выбирает текущий трек)
  await userEvent.selectOptions(screen.getByLabelText(/трек/i), track.id);
  await userEvent.selectOptions(screen.getByLabelText(/место/i), place.id);
  await userEvent.selectOptions(screen.getByLabelText(/тип/i), type.id);
  await userEvent.type(screen.getByLabelText(/название/i), 'Витамины');
  await userEvent.type(screen.getByPlaceholderText(/купить при/i), '2');
  await userEvent.type(screen.getByPlaceholderText(/избыток при/i), '10');
  await userEvent.click(screen.getByRole('button', { name: /добавить \d+ позици/i }));
  const item = await findTestItem('Витамины');
  expect(item!.placeId).toBe(place.id);
  expect(item!.typeId).toBe(type.id);
  expect(item!.minThreshold).toBe(2);
  expect(item!.maxThreshold).toBe(10);
  expect(item!.trackExpiry).toBe(true);   // из типа tm_expiry
});
```

(Достаём `place`/`type` через `db.places`/`db.types` в тесте.)

- [ ] **Step 2: `src/logic/add-form.ts` — Row v2 и `createEmptyRow`**

```ts
export interface AddRow {
  name: string;
  quantity: string;
  unit: string;
  placeId: string;
  typeId: string;
  min: string;      // «купить, когда ≤ N»
  max: string;      // «избыток, когда ≥ N»
  expiresAt: string | null;
  packSize: string | null;
  trackExpiry: boolean;
  trackQuantity: boolean;
  notes: string;
}

export function createEmptyRow(
  placeId: string, typeId: string,
  mode: { expiry: boolean; quantity: boolean },
  defaultUnit: string,
): AddRow {
  return { name: '', quantity: '', unit: defaultUnit, placeId, typeId,
    min: '', max: '', expiresAt: null, packSize: null,
    trackExpiry: mode.expiry, trackQuantity: mode.quantity, notes: '' };
}

export function toNumberOrNull(raw: string): number | null {
  const v = raw.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
```

`parseRows(rows): Item[]` — как в v1, плюс `minThreshold: toNumberOrNull(row.min)`, `maxThreshold: toNumberOrNull(row.max)`, `placeId/typeId` из строки. Если `typeId === ''` — бросать ошибку «Выберите тип позиции» (валидация перед submit).

- [ ] **Step 3: `src/components/AddRow.tsx` — вынос строки** (пропсы через интерфейс, рендер label-ов «Название позиции», input «кол-во», select единицы из каталога, input min/max с placeholder'ами, кнопки «+1 мес»/«+1 год», checkbox-режимов при необходимости — сохраняя текущую v1-вёрстку строки)

```tsx
interface AddRowProps {
  row: AddRow;
  index: number;
  nameRef: (el: HTMLInputElement | null) => void;
  units: Unit[];
  allNames: string[];   // для автодополнения (datalist)
  onChange: (index: number, patch: Partial<AddRow>) => void;
  onRemove: (index: number) => void;
  onFocusNext: (index: number) => void;
  onSetExpiryOffset: (index: number, months: number) => void;
}
```

- [ ] **Step 4: `AddTab.tsx` — каскад и submit**

- Данные: `tracks`, `places` (для выбранного трека), `types` (`listTypes()`), `units` (`listUnits()`), мета `lastTrackId/lastPlaceId/lastTypeId`.
- Селекторы: «Трек» → «Место» (места выбранного трека) → «Тип» (глобальный, имя+эмодзи).
- При смене типа: `rows = rows.map(r => ({ ...r, typeId, trackExpiry: type.flags.expiry, trackQuantity: type.flags.quantity }))`; при смене места: `rows.map(r => ({ ...r, placeId }))`.
- Единица по умолчанию для новых строк: `units[0]?.name ?? 'шт'`.
- Submit: `parseRows` → `addItem(item, trackId, '')` на каждую; сброс строк в `createEmptyRow(placeId, typeId, mode, defaultUnit)`.
- Пустой-guard (вместо `categories.length === 0`): `places.length === 0 || types.length === 0` → текст `UI_TEXTS.emptyAddForm`.
- Автодополнение, Enter → следующая строка, «+1 мес/год», «Добавить N позиций» — без изменений.

- [ ] **Step 5: Проверить** — `npx vitest run src/components/AddTab.test.tsx src/logic/add-form.test.ts` (если есть) → PASS; `npx tsc --noEmit` → OK.

- [ ] **Step 6: Commit**

```bash
git add src/logic/add-form.ts src/components/AddTab.tsx src/components/AddRow.tsx src/components/AddTab.test.tsx
git -c user.name="Sisyphus" -c user.email="sisyphus@local" commit -m "feat: add form with track-place-type selects and min/max fields"
```

---

### Task 6: Админка — секции «Типы позиций» и «Единицы»

**Files:**
- Create: `src/components/AdminTypesSection.tsx`, `src/components/AdminUnitsSection.tsx`
- Modify: `src/components/AdminScreen.tsx`, `src/components/AdminScreen.test.tsx`
- Consumes: `listTypes/saveType/softDeleteType`, `listUnits/saveUnit/softDeleteUnit`, `getTrackingMethods`, `UI_TEXTS`.

**Interfaces:**
- Produces: две секции за PIN для роли `admin`; участник их не видит (роль проверяется как у секции «Способы отслеживания»/других admin-фич — по `deviceProfile.role`).

- [ ] **Step 1: Тест FAIL**

```tsx
// src/components/AdminScreen.test.tsx — добавляем
it('админ видит и добавляет типы позиций и единицы; удаление мягкое', async () => {
  // настроить устройство: роль admin, PIN верный (паттерн существующих кейсов)
  render(<AdminScreen onExit={() => {}} />);
  await userEvent.click(screen.getByTestId('admin-unlock')) /* или как в v1 — форма PIN */;
  expect(screen.getByText('Типы позиций')).toBeInTheDocument();
  expect(screen.getByText('Единицы')).toBeInTheDocument();
  await userEvent.type(screen.getByPlaceholderText(/имя типа/i), 'Лекарства');
  await userEvent.click(screen.getByRole('button', { name: /добавить тип/i }));
  expect(await db.types.toArray()).toHaveLength(1);
  await userEvent.type(screen.getByPlaceholderText(/название единицы/i), 'упак');
  await userEvent.click(screen.getByRole('button', { name: /добавить единиц/i }));
  expect((await db.units.toArray()).map(u => u.name)).toContain('упак');
});

it('участник секций не видит', async () => {
  // роль member → «Типы позиций»/«Единицы» отсутствуют
  expect(screen.queryByText('Типы позиций')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: `AdminTypesSection.tsx`** (≤ 250 строк)

- Вход: `types: Type[]`, `methods: TrackingMethod[]`, `onChanged: () => void`.
- Рендер: заголовок `UI_TEXTS.typeSection`; список `emoji name — method.name` с кнопкой «🗑»; add-форма: input имя + input эмодзи + select способ; «Добавить тип» → `saveType({ id: genId('typ'), name, emoji, trackingMethodId, sortOrder: types.length, ... sync })` → `onChanged()`.
- Удаление: `softDeleteType(id)` → `onChanged()`.

- [ ] **Step 3: `AdminUnitsSection.tsx`**

- Вход: `units: Unit[]`, `onChanged`.
- Список `name` + «🗑»; add-форма: input название; «Добавить единицу» → `saveUnit` (sortOrder = length), удаление → `softDeleteUnit`.

- [ ] **Step 4: `AdminScreen.tsx`**

- Данные расширяются: `types = await listTypes()`, `units = await listUnits()` (рядом с `methods`).
- Секции рендерятся внутри админ-области ТОЛЬКО при `role === 'admin'` (существующая гейт-логика админки в v1 — секция «Способы отслеживания»).
- `AdminScreen` остаётся ≤ 250 строк: вызов `<AdminTypesSection types={types} methods={methods} onChanged={reload} />` и `<AdminUnitsSection units={units} onChanged={reload} />`.

- [ ] **Step 5: Проверить** — `npx vitest run src/components/AdminScreen.test.tsx` → PASS; `npx tsc --noEmit` → OK.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminScreen.tsx src/components/AdminTypesSection.tsx src/components/AdminUnitsSection.tsx src/components/AdminScreen.test.tsx
git -c user.name="Sisyphus" -c user.email="sisyphus@local" commit -m "feat: admin catalog sections for item types and units"
```

---

### Task 7: Финальная проверка (vitest + tsc + docker + Playwright round-trip)

**Files:**
- Modify: ничего сверх фиксов, если Прогон выявит проблемы.

**Interfaces:**
- Produces: полный зелёный прогон по критериям спеки §7–§8.

- [ ] **Step 1: Полный прогон**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

- [ ] **Step 2: Docker** (пересборка с новым бандлом)

```bash
docker compose build && docker compose up -d
curl -s http://localhost:5173/family-stock-tracker/ | grep -o '<title>[^<]*</title>'
```

- [ ] **Step 3: Playwright smoke (спека §8: критерии 1–4)**

Открыть `http://localhost:5173/family-stock-tracker/` через Playwright MCP:
1. **Импорт старого бэкапа v1** (`demo-backup.json` — фикстура Task 0): после импорта в UI есть треки/позиции; в `indexedDB` появились `places/types/units` с `typeId` у позиций (оценить через `browser_evaluate` c `indexedDB`).
2. **Админ**: PIN → секции «Типы позиций» и «Единицы»; добавить тип «Лекарства» (способ «Срок годности») и единицу «упак»; участник секций не видит.
3. **Место**: в треке кнопка «Добавить место» видна обоим ролям, создаёт место.
4. **Добавление**: каскад Трек→Место→Тип, min/max заполняются; после добавления позиция имеет статус 🔵/🟣 в зависимости от min/max и количества.
5. **Экспорт**: скачать бэкап → файл содержит `"version": 2` и `places/types/units`.

- [ ] **Step 4: При выявленных проблемах** — фикс через тот же TDD-цикл (FAIL-тест → реализация → PASS), отдельный коммит, повторный прогон шагов 1–3.

- [ ] **Step 5: Итоговый коммит (если были фиксы)**

```bash
git -c user.name="Sisyphus" -c user.email="sisyphus@local" commit -m "fix: v2 roundtrip issues found in full verification"
```

---

## Критерии успеха (map к спеке §8)

1. Админ создаёт типы и единицы; участник не видит секций → Task 6 + Playwright (2).
2. Любой участник добавляет место кнопкой «Добавить место» → Task 4 + Playwright (3).
3. Новая позиция — Трек→Место→Тип, min/max влияют на статусы → Task 5 + Playwright (4).
4. Старый бэкап v1 и старая база мигрируют без потерь → Task 1–3 (тесты миграции/импорта) + Playwright (1).
5. vitest зелёный, tsc чистый, docker работает → Task 7.

## Заметки исполнителю

- **Dexie-версии идут по нарастающей** (1→2→3): Task 2 добавляет схему, Task 3 завершает ренейм. Не «перепрыгивать» версии — иначе upgrade-цепочка не запустится в тестах миграции.
- **`seedLegacyV1` в db.test** — единственный тест, создающий второй Dexie-инстанс; обязательно `db.close()` перед и `db.open()` после.
- **Позиции кортежа `createTestTrack`** `[track, place, item1, item2]` — контракт для десятков тестов; не менять порядок.
- **`units: []`** в `upgradeEnvelopeV1` — осознанное решение (нет дублей units при повторных импортах v1); НЕ добавлять туда `DEFAULT_UNITS`.
- **`genId` vs фикс. id**: только сиды (`DEFAULT_UNITS`, `tm_expiry`) имеют фикс. id; пользовательские типы/места/единицы — только `genId('typ'|'plc'|'unt')`.
- Компоненты: таб-бар/навигация не меняются; `MoreTab`, `SpendModal`, `TracksTab`, `JournalScreen`, `ImportPreviewModal`, `Onboarding`, `useBadge`, `pin.ts`, `ids.ts`, `status.ts` — вне изменений (кроме ренейма категорий, где он пробился в тестах).