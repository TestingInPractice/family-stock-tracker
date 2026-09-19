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