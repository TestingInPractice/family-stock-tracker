import { useCallback, useEffect, useState } from 'react';
import { db, getHousehold, spendItem } from '../db/db';
import { STATUS_META, UNITS } from '../constants';
import { computeStatus, sortByUrgency } from '../logic/status';
import { SpendModal } from './SpendModal';
import type { Category, Household, Item, Track } from '../types';

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const load = useCallback(async () => {
    const [hh, trk, cats, its] = await Promise.all([
      getHousehold(),
      db.tracks.get(trackId),
      db.categories.toArray(),
      db.items.toArray(),
    ]);
    setHousehold(hh);
    setTrack(trk);
    setCategories(cats.filter(c => c.deletedAt === null));
    setItems(its.filter(i => i.deletedAt === null));
  }, [trackId]);

  useEffect(() => {
    void load();
  }, [load, onChanged]);

  const warnDays = household?.warnDays ?? 28;
  const today = new Date();

  const trackCats = categories
    .filter(c => c.trackId === trackId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const quickSpend = async (id: string) => {
    await spendItem(id, 1, '');
    await load();
  };

  return (
    <section>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={onBack}>← Назад</button>
        <span style={{ fontSize: 28 }}>{track?.emoji ?? '📦'}</span>
        <h1 style={{ margin: 0, fontSize: 22 }}>{track?.name ?? 'Трек'}</h1>
      </header>
      {trackCats.length === 0 ? (
        <p>В этом треке пока нет категорий.</p>
      ) : (
        trackCats.map(cat => {
          const catItems = sortByUrgency(
            items.filter(i => i.categoryId === cat.id),
            warnDays,
            today,
          );
          return (
            <section key={cat.id} style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>
                {cat.emoji} {cat.name}
              </h2>
              {catItems.length === 0 ? (
                <p style={{ color: '#64748b' }}>Пусто</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {catItems.map(item => {
                    const status = computeStatus(item, warnDays, today);
                    const unit = (UNITS as readonly string[]).includes(item.unit)
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
          onChanged={() => { void load(); }}
        />
      ) : null}
    </section>
  );
}