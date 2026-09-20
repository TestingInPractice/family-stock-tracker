import { useEffect, useState } from 'react';
import { listTracks, saveTrack } from '../db/db';
import { genId } from '../logic/ids';
import type { Track } from '../types';

interface TracksTabProps {
  onOpenTrack: (trackId: string) => void;
}

export function TracksTab({ onOpenTrack }: TracksTabProps) {
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await listTracks();
      if (!cancelled) setTracks(rows);
    })();
    return () => { cancelled = true; };
  }, [onOpenTrack]);

  const createTrack = async () => {
    const name = window.prompt('Название трека');
    if (!name || name.trim() === '') return;
    const emojiRaw = window.prompt('Эмодзи (по умолчанию \u{1F4E6})');
    const emoji = emojiRaw && emojiRaw.trim() !== '' ? emojiRaw : '\u{1F4E6}';
    const rows = await listTracks();
    const maxOrder = rows.reduce((m, t) => Math.max(m, t.sortOrder), -1);
    await saveTrack({
      id: genId('trk'),
      name: name.trim(),
      emoji,
      sortOrder: maxOrder + 1,
      createdAt: Date.now(),
      updatedAt: 0,
      updatedBy: '',
      deletedAt: null,
    });
    setTracks(await listTracks());
  };

  return (
    <section>
      <h1>Треки</h1>
      <button type="button" onClick={() => void createTrack()}>Новый трек</button>
      {tracks.length === 0 ? (
        <p>Пока нет треков. Создайте первый!</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {tracks.map(t => (
            <li key={t.id} style={{ marginBottom: 8 }}>
              <button
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '12px 14px', borderRadius: 10, border: '1px solid #cbd5e1',
                  background: '#fff', fontSize: 16, cursor: 'pointer',
                }}
                onClick={() => onOpenTrack(t.id)}
              >
                <span style={{ fontSize: 22 }}>{t.emoji}</span>
                <span>{t.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}