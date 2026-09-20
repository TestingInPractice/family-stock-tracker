import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { addItem, db, listCategories, listTracks } from '../db/db';
import { UNITS } from '../constants';
import { genId } from '../logic/ids';
import {
  actionStyle, chipStyle, emptyRow, fieldStyle, modeFromMethod,
  pluralizePositions, quantityOrOne, rowStyle, toIsoDate,
} from '../logic/add-form';
import type { Row } from '../logic/add-form';
import type { Category, TrackingMethod, Track } from '../types';

interface AddTabProps {
  onChanged: () => void;
}

export function AddTab({ onChanged }: AddTabProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [methods, setMethods] = useState<Map<string, TrackingMethod>>(new Map());
  const [trackId, setTrackId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [allNames, setAllNames] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [loaded, setLoaded] = useState(false);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);

  const currentMode = modeFromMethod(methods.get(categories.find(c => c.id === categoryId)?.trackingMethodId ?? ''));
  const nonEmptyCount = rows.filter(r => r.name.trim() !== '').length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [trackRows, items, methodRows] = await Promise.all([
        listTracks(), db.items.toArray(), db.trackingMethods.toArray(),
      ]);
      if (cancelled) return;
      const methodMap = new Map(methodRows.map(m => [m.id, m]));
      setMethods(methodMap);
      setAllNames([...new Set(items.filter(i => i.deletedAt === null).map(i => i.name))]);
      if (trackRows.length === 0) { setTracks([]); setLoaded(true); return; }
      setTracks(trackRows);
      const firstTrackId = trackRows[0].id;
      const cats = await listCategories(firstTrackId);
      if (cancelled) return;
      setCategories(cats);
      setTrackId(firstTrackId);
      const lastRow = await db.meta.get('lastCategoryId');
      const lastId = lastRow ? String(lastRow.value) : null;
      const defaultCatId = lastId && cats.some(c => c.id === lastId) ? lastId : (cats[0]?.id ?? '');
      setCategoryId(defaultCatId);
      const mode = modeFromMethod(methodMap.get(cats.find(c => c.id === defaultCatId)?.trackingMethodId ?? ''));
      setRows(prev => prev.map(r => ({
        ...r, categoryId: defaultCatId, trackExpiry: mode.trackExpiry, trackQuantity: mode.trackQuantity,
      })));
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (pendingFocus === null) return;
    nameRefs.current[pendingFocus]?.focus();
    setPendingFocus(null);
  }, [pendingFocus, rows.length]);

  const updateName = (i: number, value: string) => {
    setRows(prev => {
      const next = prev.map((r, idx) => idx === i ? { ...r, name: value } : r);
      if (next.every(r => r.name.trim() === '') && next.length > 1) {
        return [emptyRow(categoryId, currentMode)];
      }
      return next;
    });
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, emptyRow(categoryId, currentMode)]);
  };

  const handleNameFocus = (i: number) => {
    if (i === rows.length - 1 && rows[i].name.trim() !== '') addRow();
  };

  const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (i === rows.length - 1) {
      addRow();
      setPendingFocus(i + 1);
    } else {
      nameRefs.current[i + 1]?.focus();
    }
  };

  const handleTrackChange = async (id: string) => {
    setTrackId(id);
    const cats = await listCategories(id);
    setCategories(cats);
    const defaultCatId = cats[0]?.id ?? '';
    setCategoryId(defaultCatId);
    const mode = modeFromMethod(methods.get(cats.find(c => c.id === defaultCatId)?.trackingMethodId ?? ''));
    setRows(prev => prev.map(r => ({
      ...r, categoryId: defaultCatId, trackExpiry: mode.trackExpiry, trackQuantity: mode.trackQuantity,
    })));
  };

  const handleCategoryChange = (id: string) => {
    setCategoryId(id);
    const mode = modeFromMethod(methods.get(categories.find(c => c.id === id)?.trackingMethodId ?? ''));
    setRows(prev => prev.map(r => ({
      ...r, categoryId: id, trackExpiry: mode.trackExpiry, trackQuantity: mode.trackQuantity,
    })));
  };

  const submit = async () => {
    const nonEmpty = rows.filter(r => r.name.trim() !== '');
    if (nonEmpty.length === 0) return;
    // onChanged до await: fake-indexeddb использует setImmediate-макрозадачи,
    // не завершающиеся за userEvent.click (см. SpendModal). addItem — одна
    // транзакция, ставится в очередь синхронно, поэтому к db.close() в
    // afterEach незавершённых записей не остаётся.
    const pending = (async () => {
      for (const row of nonEmpty) {
        await addItem({
          id: genId('itm'),
          categoryId: row.categoryId,
          name: row.name.trim(),
          unit: row.unit || 'шт',
          quantity: quantityOrOne(row.quantity),
          expiresAt: row.expiresAt,
          minThreshold: null,
          maxThreshold: null,
          packSize: null,
          trackExpiry: row.trackExpiry,
          trackQuantity: row.trackQuantity,
          notes: '',
          createdAt: Date.now(),
          updatedAt: 0,
          updatedBy: '',
          deletedAt: null,
        }, trackId);
      }
    })();
    const metaPut = db.meta.put({ key: 'lastCategoryId', value: categoryId });
    onChanged();
    await pending;
    await metaPut;
    setRows([emptyRow(categoryId, currentMode)]);
  };

  if (loaded && (tracks.length === 0 || categories.length === 0)) {
    return (
      <section>
        <h1>Добавление</h1>
        <p>Сначала создайте трек во вкладке «Треки»</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Добавление</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14 }}>
          Трек
          <select value={trackId} onChange={e => void handleTrackChange(e.target.value)} style={fieldStyle}>
            {tracks.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 14 }}>
          Категория
          <select value={categoryId} onChange={e => handleCategoryChange(e.target.value)} style={fieldStyle}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </label>
      </div>
      <datalist id="addtab-item-names">
        {allNames.map(n => <option key={n} value={n} />)}
      </datalist>
      {rows.map((row, i) => (
        <div key={i} style={rowStyle}>
          <input
            ref={el => { nameRefs.current[i] = el; }}
            type="text"
            aria-label="Название позиции"
            list="addtab-item-names"
            value={row.name}
            placeholder="Название"
            style={fieldStyle}
            onFocus={() => handleNameFocus(i)}
            onChange={e => updateName(i, e.target.value)}
            onKeyDown={e => handleNameKeyDown(e, i)}
          />
          <input
            type="number"
            min={1}
            aria-label="Количество"
            value={row.quantity}
            style={{ ...fieldStyle, width: 70 }}
            onChange={e => updateRow(i, { quantity: e.target.value })}
          />
          <select aria-label="Единица" value={row.unit} style={fieldStyle} onChange={e => updateRow(i, { unit: e.target.value })}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <button type="button" style={chipStyle} onClick={() => updateRow(i, { expiresAt: toIsoDate(1) })}>+1 мес</button>
          <button type="button" style={chipStyle} onClick={() => updateRow(i, { expiresAt: toIsoDate(12) })}>+1 год</button>
          <input
            type="date"
            aria-label="Своя дата"
            value={row.expiresAt ?? ''}
            style={fieldStyle}
            onChange={e => updateRow(i, { expiresAt: e.target.value || null })}
          />
          <button type="button" style={chipStyle} onClick={() => updateRow(i, { expiresAt: null })}>не задан</button>
        </div>
      ))}
      <button type="button" style={actionStyle} disabled={nonEmptyCount === 0} onClick={() => void submit()}>
        Добавить {nonEmptyCount} {pluralizePositions(nonEmptyCount)}
      </button>
    </section>
  );
}