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
    await db.transaction('rw', db.tracks, db.places, db.types, db.units, async () => {
      await Promise.all([
        db.tracks.clear(), db.places.clear(), db.types.clear(), db.units.clear(),
      ]);
    });
    await db.transaction('rw', db.items, db.ops, db.household, async () => {
      await Promise.all([db.items.clear(), db.ops.clear()]);
      await db.household.clear();
    });
    await importHouseholdEnvelope(parseHouseholdEnvelope(JSON.stringify(env)));
    expect(await db.tracks.count()).toBe(1);
    expect(await db.places.count()).toBe(1);
    expect(await db.types.count()).toBe(1);
    expect(await db.units.count()).toBeGreaterThan(0);
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
