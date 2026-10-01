import { useState } from 'react';
import { UI_TEXTS } from '../constants';
import { saveType, softDeleteType } from '../db/catalog';
import { genId } from '../logic/ids';
import type { TrackingMethod, Type } from '../types';

interface AdminTypesSectionProps {
  types: Type[];
  methods: TrackingMethod[];
  onChanged: () => void;
}

const fieldStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15,
};
const actionStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontWeight: 600, fontSize: 15,
};

const methodName = (methods: TrackingMethod[], id: string): string =>
  methods.find(m => m.id === id)?.name ?? '—';

/** Каталог типов позиций: список «эмодзи имя — способ», добавление и мягкое удаление. */
export function AdminTypesSection({ types, methods, onChanged }: AdminTypesSectionProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [methodId, setMethodId] = useState('');

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await saveType({
      id: genId('typ'),
      name: trimmed,
      emoji: emoji.trim() || '📦',
      trackingMethodId: methodId || methods[0]?.id || '',
      sortOrder: types.length,
      updatedAt: 0,
      updatedBy: '',
      deletedAt: null,
    });
    setName('');
    setEmoji('');
    onChanged();
  };

  const remove = async (id: string) => {
    await softDeleteType(id);
    onChanged();
  };

  return (
    <div>
      <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>{UI_TEXTS.typeSection}</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
        {types.map(t => (
          <li key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ flex: 1 }}>{t.emoji} {t.name} — {methodName(methods, t.trackingMethodId)}</span>
            <button type="button" aria-label={`Удалить тип ${t.name}`} onClick={() => void remove(t.id)}>🗑</button>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          aria-label="Имя типа"
          placeholder="Имя типа"
          value={name}
          style={fieldStyle}
          onChange={e => setName(e.target.value)}
        />
        <input
          type="text"
          aria-label="Эмодзи типа"
          placeholder="Эмодзи"
          value={emoji}
          style={fieldStyle}
          onChange={e => setEmoji(e.target.value)}
        />
        <select
          aria-label="Способ отслеживания"
          value={methodId || methods[0]?.id || ''}
          style={fieldStyle}
          onChange={e => setMethodId(e.target.value)}
        >
          {methods.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <button type="button" style={actionStyle} onClick={() => void add()}>Добавить тип</button>
      </div>
    </div>
  );
}