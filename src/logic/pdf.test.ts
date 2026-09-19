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