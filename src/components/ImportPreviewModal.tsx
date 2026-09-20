import type { ImportSummary } from '../types';

interface ImportPreviewModalProps {
  summary: ImportSummary;
  onConfirm: () => void;
  onCancel: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
};
const dialogStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 20, maxWidth: 360, width: '90%',
};

/** Предпросмотр импорта бэкапа: счётчики + подтверждение/отмена. */
export function ImportPreviewModal({ summary, onConfirm, onCancel }: ImportPreviewModalProps) {
  const deletedPart = summary.deleted > 0 ? `, ${summary.deleted} удалено` : '';
  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={dialogStyle} role="dialog" aria-label="Предпросмотр импорта" onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Импорт бэкапа</h2>
        <p style={{ margin: '0 0 16px' }}>
          Принесёт {summary.added} записей, {summary.updated} изменений, {summary.conflicts} конфликтов{deletedPart}.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel}>Отмена</button>
          <button type="button" onClick={onConfirm}>Подтвердить</button>
        </div>
      </div>
    </div>
  );
}