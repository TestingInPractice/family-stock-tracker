import type { CSSProperties } from 'react';
import type { TrackingMethod } from '../types';

export interface Mode {
  trackExpiry: boolean;
  trackQuantity: boolean;
}

export interface Row {
  name: string;
  quantity: string;
  unit: string;
  expiresAt: string | null;
  categoryId: string;
  trackExpiry: boolean;
  trackQuantity: boolean;
}

export const DEFAULT_MODE: Mode = { trackExpiry: true, trackQuantity: true };

export const fieldStyle: CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15,
};
export const rowStyle: CSSProperties = {
  display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center',
};
export const chipStyle: CSSProperties = {
  padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1',
  background: '#fff', fontSize: 14, cursor: 'pointer',
};
export const actionStyle: CSSProperties = {
  padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontWeight: 600, fontSize: 15, background: '#16a34a', color: '#fff',
};

export function modeFromMethod(method: TrackingMethod | undefined): Mode {
  if (!method) return DEFAULT_MODE;
  return { trackExpiry: method.flags.expiry, trackQuantity: method.flags.quantity };
}

export function emptyRow(categoryId = '', mode: Mode = DEFAULT_MODE): Row {
  return {
    name: '', quantity: '1', unit: 'шт', expiresAt: null, categoryId,
    trackExpiry: mode.trackExpiry, trackQuantity: mode.trackQuantity,
  };
}

export function pluralizePositions(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'позиций';
  if (last > 1 && last < 5) return 'позиции';
  if (last === 1) return 'позицию';
  return 'позиций';
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function toIsoDate(monthsAhead: number): string {
  const d = addMonths(new Date(), monthsAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function quantityOrOne(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}