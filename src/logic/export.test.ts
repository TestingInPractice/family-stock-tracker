// src/logic/export.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
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