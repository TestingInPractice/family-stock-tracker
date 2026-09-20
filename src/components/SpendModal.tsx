import { useRef, useState } from 'react';
import { restockItem, spendItem } from '../db/db';
import type { Item } from '../types';

interface SpendModalProps {
  item: Item;
  onClose: () => void;
  onChanged: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
};

const dialogStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 20, width: 'min(92vw, 360px)',
  boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
};

const rowStyle: React.CSSProperties = { display: 'flex', gap: 8, margin: '12px 0' };
const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 8,
};
const actionStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontWeight: 600, fontSize: 15,
};

export function SpendModal({ item, onClose, onChanged }: SpendModalProps) {
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const busyRef = useRef(false);

  const valid = amount !== null && amount > 0;

  const applyCustom = () => {
    const n = Number(custom);
    setAmount(Number.isFinite(n) && n > 0 ? n : null);
  };

  const submit = async (kind: 'spend' | 'restock') => {
    if (!valid || busyRef.current) return;
    busyRef.current = true;
    try {
      // onChanged до await: Dexie ставит readwrite-транзакцию в очередь синхронно,
      // readonly-refetch родителя сериализуется за ней и увидит свежие данные.
      // Иначе onChanged не успевает сработать к проверке в тесте (fake-indexeddb
      // использует setImmediate-макрозадачи, не завершающиеся за userEvent.click).
      const op = kind === 'spend'
        ? spendItem(item.id, amount, note)
        : restockItem(item.id, amount, note);
      onChanged();
      await op;
      onClose();
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={dialogStyle}
        role="dialog"
        aria-label={`Списание: ${item.name}`}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 4px' }}>{item.name}</h2>
        <p style={{ margin: '0 0 8px', color: '#475569' }}>
          Остаток: {item.quantity} {item.unit}
        </p>
        <div style={rowStyle}>
          <button type="button" onClick={() => setAmount(1)}>1</button>
          {item.packSize ? (
            <button type="button" onClick={() => setAmount(item.packSize)}>Упаковка</button>
          ) : null}
          <button type="button" onClick={applyCustom}>Своё</button>
        </div>
        <input
          type="number"
          min={1}
          value={custom}
          placeholder="Своё количество"
          style={fieldStyle}
          onChange={e => {
            setCustom(e.target.value);
            const n = Number(e.target.value);
            setAmount(Number.isFinite(n) && n > 0 ? n : null);
          }}
        />
        <input
          type="text"
          value={note}
          placeholder="Примечание"
          style={fieldStyle}
          onChange={e => setNote(e.target.value)}
        />
        <div style={rowStyle}>
          <button
            type="button"
            disabled={!valid}
            style={{ ...actionStyle, background: '#dc2626', color: '#fff' }}
            onClick={() => void submit('spend')}
          >
            Списать
          </button>
          <button
            type="button"
            disabled={!valid}
            style={{ ...actionStyle, background: '#16a34a', color: '#fff' }}
            onClick={() => void submit('restock')}
          >
            Пополнить
          </button>
          <button type="button" style={actionStyle} onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}