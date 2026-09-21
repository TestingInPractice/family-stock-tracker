import { describe, expect, it } from 'vitest';
import { DEFAULT_TRACKING_METHODS, DEFAULT_UNITS } from './constants';

describe('DEFAULT_TRACKING_METHODS', () => {
  it('id уникальны', () => {
    const ids = DEFAULT_TRACKING_METHODS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('DEFAULT_UNITS', () => {
  it('содержит шт и кг', () => {
    const names = DEFAULT_UNITS.map(u => u.name);
    expect(names).toContain('шт');
    expect(names).toContain('кг');
  });
});