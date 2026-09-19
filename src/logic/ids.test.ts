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