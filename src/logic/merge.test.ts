import { describe, expect, it } from 'vitest';
import { mergeLists, mergeOps } from './merge';
import type { Item, Op } from '../types';

const base = (id: string, updatedAt: number, deletedAt: number | null = null): Item =>
  ({ id, categoryId: 'c1', name: 'n', unit: 'шт', quantity: 1, minThreshold: null,
     maxThreshold: null, expiresAt: null, packSize: null, trackExpiry: false,
     trackQuantity: false, notes: '', createdAt: 1, updatedAt, updatedBy: 'dev', deletedAt });

describe('mergeLists', () => {
  it('нет локальной → берём пришедшую (added)', () => {
    const r = mergeLists<Item>([], [base('i1', 100)], 1000);
    expect(r.summary.added).toBe(1);
    expect(r.records.map(x => x.id)).toEqual(['i1']);
  });

  it('пришедшая новее → update; локальная не менялась после exportedAt — без конфликта', () => {
    const local = [base('i1', 100)];
    const r = mergeLists<Item>(local, [base('i1', 200)], 1000);
    expect(r.summary.updated).toBe(1);
    expect(r.summary.conflicts).toBe(0);
    expect(r.records[0].quantity).toBe(1);
  });

  it('обе менялись после exportedAt → conflict, победитель по updatedAt', () => {
    const local = [{ ...base('i1', 1500), quantity: 5 }];
    const incoming = [base('i1', 1600)]; // новее
    const r = mergeLists<Item>(local, incoming, 1000);
    expect(r.summary.conflicts).toBe(1);
    expect(r.records[0].quantity).toBe(1); // пришёл победитель (1600 > 1500)
  });

  it('локальная новее пришедшей → keep', () => {
    const local = [{ ...base('i1', 2000), quantity: 9 }];
    const r = mergeLists<Item>(local, [base('i1', 100)], 1000);
    expect(r.summary.updated).toBe(0);
    expect(r.records[0].quantity).toBe(9);
  });

  it('могилка пришедшей, новее локальной → deleted', () => {
    const local = [base('i1', 100)];
    const r = mergeLists<Item>(local, [base('i1', 200, 200)], 1000);
    expect(r.summary.deleted).toBe(1);
    expect(r.records[0].deletedAt).toBe(200);
  });

  it('могилка старше локальной → keep', () => {
    const local = [base('i1', 200)];
    const r = mergeLists<Item>(local, [base('i1', 100, 100)], 1000);
    expect(r.summary.deleted).toBe(0);
    expect(r.records[0].deletedAt).toBeNull();
  });
});

describe('mergeOps', () => {
  it('union по id, без дубликатов, сортировка по deviceSeq', () => {
    const a: Op[] = [
      { id: 'd:1', deviceId: 'd', deviceSeq: 1, type: 'add', itemId: 'i', trackId: null, delta: 1, deviceLabel: 'A', when: 1, note: '' },
      { id: 'd:2', deviceId: 'd', deviceSeq: 2, type: 'spend', itemId: 'i', trackId: null, delta: -1, deviceLabel: 'A', when: 2, note: '' },
    ];
    const b: Op[] = [
      { id: 'd:2', deviceId: 'd', deviceSeq: 2, type: 'spend', itemId: 'i', trackId: null, delta: -1, deviceLabel: 'A', when: 2, note: '' },
      { id: 'e:1', deviceId: 'e', deviceSeq: 1, type: 'add', itemId: 'j', trackId: null, delta: 1, deviceLabel: 'B', when: 3, note: '' },
    ];
    const r = mergeOps(a, b);
    expect(r).toHaveLength(3);
  });
});