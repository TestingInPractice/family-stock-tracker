import type { CSSProperties } from 'react';
import type { Item, TrackingMethod } from '../types';
import { genId } from './ids';

/** Режим отслеживания позиции, наследуемый от способа отслеживания её типа. */
export interface Mode {
  expiry: boolean;
  quantity: boolean;
}

/** Строка формы добавления (v2: место + тип приходят из каскада селектов). */
export interface AddRow {
  name: string;
  quantity: string;
  unit: string;
  placeId: string;
  typeId: string;
  min: string;   // «купить, когда ≤ N»
  max: string;   // «избыток, когда ≥ N»
  expiresAt: string | null;
  packSize: string | null;
  trackExpiry: boolean;
  trackQuantity: boolean;
  notes: string;
}

export const DEFAULT_MODE: Mode = { expiry: true, quantity: true };
export const DEFAULT_UNIT = 'шт';

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
  return { expiry: method.flags.expiry, quantity: method.flags.quantity };
}

export function createEmptyRow(
  placeId: string, typeId: string, mode: Mode, defaultUnit: string,
): AddRow {
  return {
    name: '', quantity: '', unit: defaultUnit, placeId, typeId,
    min: '', max: '', expiresAt: null, packSize: null,
    trackExpiry: mode.expiry, trackQuantity: mode.quantity, notes: '',
  };
}

/** Пустая/битая строка → null; запятая как десятичный разделитель. */
export function toNumberOrNull(raw: string): number | null {
  const v = raw.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Строки формы → позиции для addItem. Бросает, если у строки не выбран тип. */
export function parseRows(rows: AddRow[]): Item[] {
  return rows
    .filter(r => r.name.trim() !== '')
    .map(r => {
      if (r.typeId === '') throw new Error('Выберите тип позиции');
      return {
        id: genId('itm'),
        placeId: r.placeId,
        typeId: r.typeId,
        name: r.name.trim(),
        unit: r.unit || DEFAULT_UNIT,
        quantity: quantityOrOne(r.quantity),
        minThreshold: toNumberOrNull(r.min),
        maxThreshold: toNumberOrNull(r.max),
        expiresAt: r.expiresAt,
        packSize: r.packSize === null ? null : toNumberOrNull(r.packSize),
        trackExpiry: r.trackExpiry,
        trackQuantity: r.trackQuantity,
        notes: r.notes,
        createdAt: Date.now(),
        updatedAt: 0,
        updatedBy: '',
        deletedAt: null,
      };
    });
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