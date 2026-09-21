import { useCallback, useEffect, useState } from 'react';
import { db, getHousehold, spendItem } from '../db/db';
import { listPlaces, listUnits } from '../db/catalog';
import { STATUS_META } from '../constants';
import { computeStatus, sortByUrgency } from '../logic/status';
import { SpendModal } from './SpendModal';
import type { Household, Item, Place, Track, Unit } from '../types';

interface TrackScreenProps {
  trackId: string;
  onBack: () => void;
  onChanged: () => void;
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
  borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff',
  cursor: 'pointer', marginBottom: 6,
};

export function TrackScreen({ trackId, onBack, onChanged }: TrackScreenProps) {
  const [household, setHousehold] = useState<Household | undefined>();
  const [track, setTrack] = useState<Track | undefined>();
  const [places, setPlaces] = useState<Place[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const load = useCallback(async () => {
    const [hh, trk, plcs, unts, its] = await Promise.all([
      getHousehold(),
      db.tracks.get(trackId),
      listPlaces(trackId),
      listUnits(),
      db.items.toArray(),
    ]);
    setHousehold(hh);
    setTrack(trk);
    setPlaces(plcs);
    setUnits(unts);
    setItems(its.filter(i => i.deletedAt === null));
  }, [trackId]);

  useEffect(() => {
    void load();
  }, [load, onChanged]);

  const warnDays = household?.warnDays ?? 28;
  const today = new Date();

  const trackPlaces = places
    .filter(p => p.trackId === trackId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const unitNames = new Set(units.map(u => u.name));

  const quickSpend = async (id: string) => {
    const op = spendItem(id, 1, '');
    onChanged(); // App пересчитывает бейдж; readonly-refetch сериализуется за rw-транзакцией
    await op;
    await load();
  };

  return (
    <section>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={onBack}>← Назад</button>
        <span style={{ fontSize: 28 }}>{track?.emoji ?? '📦'}</span>
        <h1 style={{ margin: 0, fontSize: 22 }}>{track?.name ?? 'Трек'}</h1>
      </header>
      {trackPlaces.length === 0 ? (
        <p>В этом треке пока нет мест.</p>
      ) : (
        trackPlaces.map(place => {
          const placeItems = sortByUrgency(
            items.filter(i => i.placeId === place.id),
            warnDays,
            today,
          );
          return (
            <section key={place.id} style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>
                {place.emoji} {place.name}
              </h2>
              {placeItems.length === 0 ? (
                <p style={{ color: '#64748b' }}>Пусто</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {placeItems.map(item => {
                    const status = computeStatus(item, warnDays, today);
                    const unit = unitNames.has(item.unit)
                      ? item.unit
                      : 'шт';
                    return (
                      <li key={item.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          style={rowStyle}
                          onClick={() => setSelectedItem(item)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedItem(item);
                            }
                          }}
                        >
                          <span style={{ fontSize: 18 }}>{STATUS_META[status].emoji}</span>
                          <span style={{ flex: 1 }}>{item.name}</span>
                          <span style={{ color: '#475569' }}>
                            {item.quantity} {unit}
                          </span>
                          <button
                            type="button"
                            style={{
                              padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                              background: '#f1f5f9', cursor: 'pointer', fontWeight: 700,
                            }}
                            onClick={e => {
                              e.stopPropagation();
                              void quickSpend(item.id);
                            }}
                          >
                            −1
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}
      {selectedItem ? (
        <SpendModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onChanged={() => { onChanged(); void load(); }}
        />
      ) : null}
    </section>
  );
}