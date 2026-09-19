import { describe, expect, it } from 'vitest';
import { DEFAULT_TRACKING_METHODS, UNITS } from './constants';

describe('DEFAULT_TRACKING_METHODS', () => {
  it('id уникальны', () => {
    const ids = DEFAULT_TRACKING_METHODS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('UNITS', () => {
  it('содержит шт и кг', () => {
    expect(UNITS).toContain('шт');
    expect(UNITS).toContain('кг');
  });
});