// src/components/AddRow.tsx — строка формы добавления (вынесена из AddTab ради лимита строк)
import type { KeyboardEvent } from 'react';
import { UI_TEXTS } from '../constants';
import {
  chipStyle, fieldStyle, rowStyle,
  type AddRow as AddRowModel,
} from '../logic/add-form';
import type { Unit } from '../types';

export interface AddRowProps {
  row: AddRowModel;
  index: number;
  nameRef: (el: HTMLInputElement | null) => void;
  units: Unit[];
  allNames: string[]; // автодополнение существующих названий (datalist)
  onChange: (index: number, patch: Partial<AddRowModel>) => void;
  onRemove: (index: number) => void;
  onFocusNext: (index: number) => void;
  onNameFocus: (index: number) => void;
  onSetExpiryOffset: (index: number, months: number) => void;
}

export function AddRow({
  row, index, nameRef, units, allNames,
  onChange, onRemove, onFocusNext, onNameFocus, onSetExpiryOffset,
}: AddRowProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    onFocusNext(index);
  };

  return (
    <div style={rowStyle}>
      <datalist id={`addtab-item-names-${index}`}>
        {allNames.map(n => <option key={n} value={n} />)}
      </datalist>
      <input
        ref={nameRef}
        type="text"
        aria-label="Название позиции"
        list={`addtab-item-names-${index}`}
        value={row.name}
        placeholder="Название"
        style={fieldStyle}
        onFocus={() => onNameFocus(index)}
        onChange={e => onChange(index, { name: e.target.value })}
        onKeyDown={handleKeyDown}
      />
      <input
        type="number"
        min={1}
        aria-label="Количество"
        value={row.quantity}
        style={{ ...fieldStyle, width: 70 }}
        onChange={e => onChange(index, { quantity: e.target.value })}
      />
      <select
        aria-label="Единица"
        value={row.unit}
        style={fieldStyle}
        onChange={e => onChange(index, { unit: e.target.value })}
      >
        {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
      </select>
      <input
        type="number"
        aria-label="Минимум"
        placeholder={UI_TEXTS.minPlaceholder}
        value={row.min}
        style={{ ...fieldStyle, width: 130 }}
        onChange={e => onChange(index, { min: e.target.value })}
      />
      <input
        type="number"
        aria-label="Максимум"
        placeholder={UI_TEXTS.maxPlaceholder}
        value={row.max}
        style={{ ...fieldStyle, width: 140 }}
        onChange={e => onChange(index, { max: e.target.value })}
      />
      <button type="button" style={chipStyle} onClick={() => onSetExpiryOffset(index, 1)}>+1 мес</button>
      <button type="button" style={chipStyle} onClick={() => onSetExpiryOffset(index, 12)}>+1 год</button>
      <input
        type="date"
        aria-label="Своя дата"
        value={row.expiresAt ?? ''}
        style={fieldStyle}
        onChange={e => onChange(index, { expiresAt: e.target.value || null })}
      />
      <button type="button" style={chipStyle} onClick={() => onChange(index, { expiresAt: null })}>не задан</button>
      <button
        type="button"
        style={chipStyle}
        aria-label="Удалить строку"
        title="Удалить строку"
        onClick={() => onRemove(index)}
      >✕</button>
    </div>
  );
}