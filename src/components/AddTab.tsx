import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { addItem, db, listTracks } from '../db/db';
import { listPlaces, listTypes, listUnits } from '../db/catalog';
import { genId } from '../logic/ids';
import {
  actionStyle, chipStyle, emptyRow, fieldStyle, modeFromMethod,
  pluralizePositions, quantityOrOne, rowStyle, toIsoDate,
  type Mode, type Row,
} from '../logic/add-form';
import type { Place, TrackingMethod, Track, Type, Unit } from '../types';

interface AddTabProps {
  onChanged: () => void;
}

export function AddTab({ onChanged }: AddTabProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [types, setTypes] = useState<Type[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [methods, setMethods] = useState<Map<string, TrackingMethod>>(new Map());
  const [trackId, setTrackId] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [allNames, setAllNames] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [loaded, setLoaded] = useState(false);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);

  const currentMode = modeFromMethod(methods.get(types.find(t => t.id === typeId)?.trackingMethodId ?? ''));
  const nonEmptyCount = rows.filter(r => r.name.trim() !== '').length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [trackRows, items, methodRows, typeRows, unitRows] = await Promise.all([
        listTracks(), db.items.toArray(), db.trackingMethods.toArray(), listTypes(), listUnits(),
      ]);
      if (cancelled) return;
      const methodMap = new Map(methodRows.map(m => [m.id, m]));
      setMethods(methodMap);
      setAllNames([...new Set(items.filter(i => i.deletedAt === null).map(i => i.name))]);
      if (trackRows.length === 0) { setTracks([]); setLoaded(true); return; }
      setTracks(trackRows);
      setTypes(typeRows);
      setUnits(unitRows);
      const firstTrackId = trackRows[0].id;
      const plcs = await listPlaces(firstTrackId);
      if (cancelled) return;
      setPlaces(plcs);
      setTrackId(firstTrackId);
      const [lastPlace, lastType] = await Promise.all([
        db.meta.get('lastPlaceId'), db.meta.get('lastTypeId'),
      ]);
      const lastPlaceId = lastPlace ? String(lastPlace.value) : null;
      const defaultPlaceId = lastPlaceId && plcs.some(p => p.id === lastPlaceId)
        ? lastPlaceId
        : (plcs[0]?.id ?? '');
      const lastTypeId = lastType ? String(lastType.value) : null;
      const defaultTypeId = lastTypeId && typeRows.some(t => t.id === lastTypeId)
        ? lastTypeId
        : (typeRows[0]?.id ?? '');
      setPlaceId(defaultPlaceId);
      setTypeId(defaultTypeId);
      const mode = modeFromMethod(methodMap.get(typeRows.find(t => t.id === defaultTypeId)?.trackingMethodId ?? ''));
      setRows(prev => prev.map(r => ({
        ...r, placeId: defaultPlaceId, typeId: defaultTypeId,
        trackExpiry: mode.trackExpiry, trackQuantity: mode.trackQuantity,
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
        return [emptyRow(placeId, typeId, currentMode)];
      }
      return next;
    });
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, emptyRow(placeId, typeId, currentMode)]);
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
    const plcs = await listPlaces(id);
    setPlaces(plcs);
    const defaultPlaceId = plcs[0]?.id ?? '';
    setPlaceId(defaultPlaceId);
    setRows(prev => prev.map(r => ({ ...r, placeId: defaultPlaceId })));
  };

  const handlePlaceChange = (id: string) => {
    setPlaceId(id);
    setRows(prev => prev.map(r => ({ ...r, placeId: id })));
  };

  const handleTypeChange = (id: string) => {
    setTypeId(id);
    const mode = modeFromMethod(methods.get(types.find(t => t.id === id)?.trackingMethodId ?? ''));
    setRows(prev => prev.map(r => ({
      ...r, typeId: id, trackExpiry: mode.trackExpiry, trackQuantity: mode.trackQuantity,
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
          placeId: row.placeId,
          typeId: row.typeId,
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
    const metaPut = db.meta.put({ key: 'lastPlaceId', value: placeId });
    const metaPutType = db.meta.put({ key: 'lastTypeId', value: typeId });
    onChanged();
    await pending;
    await Promise.all([metaPut, metaPutType]);
    setRows([emptyRow(placeId, typeId, currentMode)]);
  };

  if (loaded && (tracks.length === 0 || places.length === 0 || types.length === 0)) {
    return (
      <section>
        <h1>Добавление</h1>
        <p>Сначала создайте трек и место в нём, а тип позиции — в админке</p>
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
          Место
          <select value={placeId} onChange={e => handlePlaceChange(e.target.value)} style={fieldStyle}>
            {places.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 14 }}>
          Тип
          <select value={typeId} onChange={e => handleTypeChange(e.target.value)} style={fieldStyle}>
            {types.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}
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
            {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
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