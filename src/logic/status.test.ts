// src/logic/status.test.ts
import { describe, expect, it } from 'vitest';
import { computeStatus, sortByUrgency } from './status';
import type { Item } from '../types';

const make = (over: Partial<Item>): Item => ({
  id: 'i', placeId: 'p', typeId: 't', name: 'n', unit: 'шт', quantity: 1, minThreshold: null,
  maxThreshold: null, expiresAt: null, packSize: null, trackExpiry: false,
  trackQuantity: false, notes: '', createdAt: 0, updatedAt: 0, updatedBy: 'd', deletedAt: null, ...over,
});
const today = new Date('2026-09-19T12:00:00');

describe('computeStatus', () => {
  it('просрочено', () => {
    expect(computeStatus(make({ trackExpiry: true, expiresAt: '2026-09-18' }), 30, today)).toBe('expired');
  });
  it('истекает в окне N дней', () => {
    expect(computeStatus(make({ trackExpiry: true, expiresAt: '2026-09-25' }), 30, today)).toBe('expiring');
  });
  it('срок далеко — норм', () => {
    expect(computeStatus(make({ trackExpiry: true, expiresAt: '2027-01-01' }), 30, today)).toBe('ok');
  });
  it('ниже минимума', () => {
    expect(computeStatus(make({ trackQuantity: true, minThreshold: 5, quantity: 3 }), 30, today)).toBe('low');
  });
  it('выше максимума', () => {
    expect(computeStatus(make({ trackQuantity: true, maxThreshold: 10, quantity: 12 }), 30, today)).toBe('excess');
  });
  it('просрочка важнее низкого остатка', () => {
    expect(computeStatus(make({ trackExpiry: true, expiresAt: '2026-09-10', trackQuantity: true, minThreshold: 5, quantity: 3 }), 30, today)).toBe('expired');
  });
  it('отслеживание выключено → ok', () => {
    expect(computeStatus(make({}), 30, today)).toBe('ok');
  });
});

describe('sortByUrgency', () => {
  it('expired → expiring → low → excess → ok', () => {
    const items = [
      make({ id: 'ok', name: 'A' }),
      make({ id: 'low', name: 'B', trackQuantity: true, minThreshold: 5, quantity: 1 }),
      make({ id: 'expired', name: 'C', trackExpiry: true, expiresAt: '2026-09-01' }),
      make({ id: 'expiring', name: 'D', trackExpiry: true, expiresAt: '2026-09-30' }),
      make({ id: 'excess', name: 'E', trackQuantity: true, maxThreshold: 5, quantity: 9 }),
    ];
    const ids = sortByUrgency(items, 30, today).map(i => i.id);
    expect(ids).toEqual(['expired', 'expiring', 'low', 'excess', 'ok']);
  });
});