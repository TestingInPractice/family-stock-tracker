import { useEffect, useRef, useState } from 'react';
import { addItem, db, listTracks } from '../db/db';
import { listPlaces, listTypes, listUnits } from '../db/catalog';
import { UI_TEXTS } from '../constants';
import { AddRow } from './AddRow';
import {
  actionStyle, createEmptyRow, DEFAULT_UNIT, DEFAULT_MODE, fieldStyle, modeFromMethod,
  parseRows, pluralizePositions, toIsoDate,
  type AddRow as AddRowModel,
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
  const [rows, setRows] = useState<AddRowModel[]>(() => [createEmptyRow('', '', DEFAULT_MODE, DEFAULT_UNIT)]);
  const [loaded, setLoaded] = useState(false);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);

  const defaultUnit = units[0]?.name ?? DEFAULT_UNIT;
  const modeOf = (id: string) => modeFromMethod(methods.get(types.find(t => t.id === id)?.trackingMethodId ?? ''));
  const currentMode = modeOf(typeId);
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
      setTypes(typeRows);
      setUnits(unitRows);
      if (trackRows.length === 0) { setTracks([]); setLoaded(true); return; }
      setTracks(trackRows);
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
      const unit = unitRows[0]?.name ?? DEFAULT_UNIT;
      setRows(prev => prev.map(r => ({
        ...r, placeId: defaultPlaceId, typeId: defaultTypeId, unit: r.unit || unit,
        trackExpiry: mode.expiry, trackQuantity: mode.quantity,
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

  const newRow = (place: string, type: string, mode = currentMode) =>
    createEmptyRow(place, type, mode, defaultUnit);

  const updateRow = (i: number, patch: Partial<AddRowModel>) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  const addRow = () => setRows(prev => [...prev, newRow(placeId, typeId)]);

  const removeRow = (i: number) => {
    setRows(prev => (prev.length === 1 ? [newRow(placeId, typeId)] : prev.filter((_, idx) => idx !== i)));
  };

  const handleNameFocus = (i: number) => {
    if (i === rows.length - 1 && rows[i].name.trim() !== '') addRow();
  };

  const handleFocusNext = (i: number) => {
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
    const nextPlaceId = plcs[0]?.id ?? '';
    const nextTypeId = types[0]?.id ?? '';
    const mode = modeOf(nextTypeId);
    setPlaceId(nextPlaceId);
    setTypeId(nextTypeId);
    setRows([newRow(nextPlaceId, nextTypeId, mode)]);
  };

  const handlePlaceChange = (id: string) => {
    setPlaceId(id);
    setRows(prev => prev.map(r => ({ ...r, placeId: id })));
  };

  const handleTypeChange = (id: string) => {
    setTypeId(id);
    const mode = modeOf(id);
    setRows(prev => prev.map(r => ({
      ...r, typeId: id, trackExpiry: mode.expiry, trackQuantity: mode.quantity,
    })));
  };

  const submit = async () => {
    const items = parseRows(rows);
    if (items.length === 0) return;
    // onChanged до await: fake-indexeddb использует setImmediate-макрозадачи,
    // не завершающиеся за userEvent.click (см. SpendModal). addItem — одна
    // транзакция, ставится в очередь синхронно, поэтому к db.close() в
    // afterEach незавершённых записей не остаётся.
    const pending = (async () => {
      for (const item of items) await addItem(item, trackId, '');
    })();
    const metaPut = db.meta.put({ key: 'lastPlaceId', value: placeId });
    const metaPutType = db.meta.put({ key: 'lastTypeId', value: typeId });
    onChanged();
    await pending;
    await Promise.all([metaPut, metaPutType]);
    setRows([newRow(placeId, typeId)]);
  };

  if (loaded && (tracks.length === 0 || places.length === 0 || types.length === 0)) {
    return (
      <section>
        <h1>Добавление</h1>
        <p>{UI_TEXTS.emptyAddForm}</p>
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
      {rows.map((row, i) => (
        <AddRow
          key={i}
          row={row}
          index={i}
          nameRef={el => { nameRefs.current[i] = el; }}
          units={units}
          allNames={allNames}
          onChange={updateRow}
          onRemove={removeRow}
          onFocusNext={handleFocusNext}
          onNameFocus={handleNameFocus}
          onSetExpiryOffset={(idx, months) => updateRow(idx, { expiresAt: toIsoDate(months) })}
        />
      ))}
      <button type="button" style={actionStyle} disabled={nonEmptyCount === 0} onClick={() => void submit()}>
        Добавить {nonEmptyCount} {pluralizePositions(nonEmptyCount)}
      </button>
    </section>
  );
}