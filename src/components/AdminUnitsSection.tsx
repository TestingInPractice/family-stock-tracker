import { useState } from 'react';
import { UI_TEXTS } from '../constants';
import { saveUnit, softDeleteUnit } from '../db/catalog';
import { genId } from '../logic/ids';
import type { Unit } from '../types';

interface AdminUnitsSectionProps {
  units: Unit[];
  onChanged: () => void;
}

const fieldStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15,
};
const actionStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontWeight: 600, fontSize: 15,
};

/** Каталог единиц: список названий, добавление и мягкое удаление. */
export function AdminUnitsSection({ units, onChanged }: AdminUnitsSectionProps) {
  const [name, setName] = useState('');

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await saveUnit({
      id: genId('unt'),
      name: trimmed,
      sortOrder: units.length,
      updatedAt: 0,
      updatedBy: '',
      deletedAt: null,
    });
    setName('');
    onChanged();
  };

  const remove = async (id: string) => {
    await softDeleteUnit(id);
    onChanged();
  };

  return (
    <div>
      <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>{UI_TEXTS.unitSection}</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
        {units.map(u => (
          <li key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ flex: 1 }}>{u.name}</span>
            <button type="button" aria-label={`Удалить единицу ${u.name}`} onClick={() => void remove(u.id)}>🗑</button>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          aria-label="Название единицы"
          placeholder="Название единицы"
          value={name}
          style={fieldStyle}
          onChange={e => setName(e.target.value)}
        />
        <button type="button" style={actionStyle} onClick={() => void add()}>Добавить единицу</button>
      </div>
    </div>
  );
}