import { useEffect, useState } from 'react';
import { db, listTracks } from '../db/db';
import type { Op, OpType, Track } from '../types';

interface JournalScreenProps {
  onBack: () => void;
}

const OP_LABELS: Record<OpType, string> = {
  add: 'добавлено',
  spend: 'списание',
  restock: 'пополнение',
  edit: 'изменено',
  delete: 'удалено',
  'import-conflict': 'конфликт импорта',
};

/** Журнал операций: db.ops по убыванию when, фильтр по треку. */
export function JournalScreen({ onBack }: JournalScreenProps) {
  const [ops, setOps] = useState<Op[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [itemNames, setItemNames] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rows, trackRows, items] = await Promise.all([
        db.ops.orderBy('when').reverse().toArray(),
        listTracks(),
        db.items.toArray(),
      ]);
      if (cancelled) return;
      setOps(rows);
      setTracks(trackRows);
      setItemNames(new Map(items.map(i => [i.id, i.name])));
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = filter === 'all' ? ops : ops.filter(o => o.trackId === filter);
  const trackName = (id: string | null) => tracks.find(t => t.id === id)?.name ?? '—';

  return (
    <section>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={onBack}>← Назад</button>
        <h1 style={{ margin: 0, fontSize: 22 }}>Журнал</h1>
      </header>
      <label style={{ fontSize: 14, marginBottom: 8, display: 'block' }}>
        Трек
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ marginLeft: 8 }}>
          <option value="all">Все</option>
          {tracks.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
        </select>
      </label>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {visible.map(o => (
          <li key={o.id} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{new Date(o.when).toLocaleDateString('ru-RU')} · {o.deviceLabel}</span>
              <span>{OP_LABELS[o.type]}</span>
            </div>
            <div>
              {trackName(o.trackId)} · {o.itemId ? itemNames.get(o.itemId) ?? '—' : '—'}
              {o.delta !== null ? ` · ${o.delta > 0 ? '+' : ''}${o.delta}` : ''}
            </div>
            {o.note ? <div style={{ color: '#64748b', fontSize: 13 }}>{o.note}</div> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}