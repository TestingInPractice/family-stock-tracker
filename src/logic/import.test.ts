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