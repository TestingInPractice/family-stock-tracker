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