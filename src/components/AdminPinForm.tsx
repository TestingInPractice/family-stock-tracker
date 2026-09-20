import { useState } from 'react';
import { saveDeviceProfile } from '../db/db';
import { hashPin } from '../logic/pin';
import type { DeviceProfile } from '../types';

interface AdminPinFormProps {
  profile: DeviceProfile | null;
  onSaved: () => void;
  onCancel: () => void;
}

const fieldStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15,
};
const actionStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontWeight: 600, fontSize: 15,
};

/** Смена PIN: два ввода, валидация 4–8 цифр + совпадение, сохранение через hashPin. */
export function AdminPinForm({ profile, onSaved, onCancel }: AdminPinFormProps) {
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    if (!/^\d{4,8}$/.test(newPin)) { setError('PIN — 4–8 цифр'); return; }
    if (newPin !== newPin2) { setError('PIN не совпадает'); return; }
    setBusy(true);
    setError(null);
    try {
      const base = profile ?? {
        id: 'me', role: 'admin' as const, pinHash: null, updatedAt: 0, updatedBy: '', deletedAt: null,
      };
      await saveDeviceProfile({ ...base, pinHash: await hashPin(newPin) });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260 }}>
      <input
        type="password"
        aria-label="Новый PIN"
        value={newPin}
        placeholder="Новый PIN (4–8 цифр)"
        style={fieldStyle}
        onChange={e => setNewPin(e.target.value)}
      />
      <input
        type="password"
        aria-label="Повторите новый PIN"
        value={newPin2}
        placeholder="Повторите PIN"
        style={fieldStyle}
        onChange={e => setNewPin2(e.target.value)}
      />
      {error ? <p role="alert">{error}</p> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={busy}
          style={{ ...actionStyle, background: '#0e7490', color: '#fff' }}
          onClick={() => void save()}
        >
          Сохранить PIN
        </button>
        <button type="button" style={actionStyle} onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}