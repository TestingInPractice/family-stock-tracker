import { useRef, useState } from 'react';
import { listTracks } from '../db/db';
import { buildHouseholdEnvelope, buildTrackTemplate } from '../logic/export';
import { buildTrackPdf } from '../logic/pdf';
import {
  buildImportPreview,
  importHouseholdEnvelope,
  importTrackTemplate,
  parseHouseholdEnvelope,
  parseTrackTemplate,
} from '../logic/import';
import type { HouseholdEnvelope, ImportSummary, Track } from '../types';
import { ImportPreviewModal } from './ImportPreviewModal';
import { JournalScreen } from './JournalScreen';
import { AdminScreen } from './AdminScreen';

interface MoreTabProps {
  onChanged: () => void;
  isAdmin: boolean;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename);
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      // Пользователь отменил share или он недоступен — молча падаем на download.
      void err;
    }
  }
  downloadBlob(blob, filename);
}

/** «Ещё»: экспорт/импорт бэкапа и шаблонов, PDF, журнал, админка. */
export function MoreTab({ onChanged, isAdmin }: MoreTabProps) {
  const [view, setView] = useState<'main' | 'journal' | 'admin'>('main');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [pendingEnvelope, setPendingEnvelope] = useState<HouseholdEnvelope | null>(null);
  const [templateTracks, setTemplateTracks] = useState<Track[] | null>(null);
  const [templateTrackId, setTemplateTrackId] = useState('');
  const backupInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const handleBackupFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const env = parseHouseholdEnvelope(text);
      const summary = await buildImportPreview(env);
      setPendingEnvelope(env);
      setPreview(summary);
    } catch (err) {
      setError(`Не удалось импортировать: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const confirmImport = async () => {
    if (!pendingEnvelope) return;
    try {
      await importHouseholdEnvelope(pendingEnvelope);
      setPreview(null);
      setPendingEnvelope(null);
      onChanged();
    } catch (err) {
      setError(`Не удалось импортировать: ${err instanceof Error ? err.message : String(err)}`);
      setPreview(null);
      setPendingEnvelope(null);
    }
  };

  const handleTemplateFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const tpl = parseTrackTemplate(text);
      await importTrackTemplate(tpl);
      onChanged();
    } catch (err) {
      setError(`Не удалось импортировать: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const exportBackup = async () => {
    const env = await buildHouseholdEnvelope();
    const blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' });
    await shareOrDownload(blob, `backup-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const exportPdf = async () => {
    const tracks = await listTracks();
    for (const t of tracks) {
      const blob = await buildTrackPdf(t.id);
      downloadBlob(blob, `${t.name}.pdf`);
    }
  };

  const openTemplatePicker = async () => {
    const tracks = await listTracks();
    if (tracks.length === 0) return;
    setTemplateTracks(tracks);
    setTemplateTrackId(tracks[0].id);
  };

  const downloadTemplate = async () => {
    if (!templateTracks) return;
    const track = templateTracks.find(t => t.id === templateTrackId);
    if (!track) return;
    const tpl = await buildTrackTemplate(track.id);
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
    await shareOrDownload(blob, `${track.name}-template.json`);
    setTemplateTracks(null);
  };

  if (view === 'journal') return <JournalScreen onBack={() => setView('main')} />;
  if (view === 'admin') return <AdminScreen onChanged={onChanged} onExit={() => setView('main')} />;

  return (
    <section>
      <h1 style={{ fontSize: 22 }}>Ещё</h1>
      {error ? <p role="alert">{error}</p> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260 }}>
        <button type="button" onClick={() => void exportBackup()}>Экспорт бэкапа дома (JSON)</button>
        <button type="button" onClick={() => void exportPdf()}>Экспорт PDF</button>
        <button type="button" onClick={() => void openTemplatePicker()}>Экспорт шаблона трека</button>
        <button type="button" onClick={() => backupInputRef.current?.click()}>Импорт бэкапа</button>
        <button type="button" onClick={() => templateInputRef.current?.click()}>Импорт шаблона трека</button>
        <button type="button" onClick={() => setView('journal')}>Журнал</button>
        {isAdmin ? <button type="button" onClick={() => setView('admin')}>Админ</button> : null}
      </div>
      <input
        ref={backupInputRef}
        type="file"
        accept="application/json,.json"
        aria-label="Импорт бэкапа (JSON)"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleBackupFile(f);
          e.target.value = '';
        }}
      />
      <input
        ref={templateInputRef}
        type="file"
        accept="application/json,.json"
        aria-label="Импорт шаблона трека"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleTemplateFile(f);
          e.target.value = '';
        }}
      />
      {templateTracks ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260 }}>
          <div style={{ fontSize: 14 }}>Трек для шаблона</div>
          <select
            aria-label="Выберите трек для шаблона"
            value={templateTrackId}
            onChange={e => setTemplateTrackId(e.target.value)}
          >
            {templateTracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => void downloadTemplate()}>Скачать шаблон</button>
            <button type="button" onClick={() => setTemplateTracks(null)}>Отмена</button>
          </div>
        </div>
      ) : null}
      {preview && pendingEnvelope ? (
        <ImportPreviewModal
          summary={preview}
          onConfirm={() => void confirmImport()}
          onCancel={() => { setPreview(null); setPendingEnvelope(null); }}
        />
      ) : null}
    </section>
  );
}