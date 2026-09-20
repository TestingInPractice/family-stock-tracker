import { useEffect, useState } from 'react';
import { db, getDeviceProfile, getHousehold, getTrackingMethods, saveTrackingMethod } from '../db/db';
import { verifyPin } from '../logic/pin';
import { genId, syncMeta } from '../logic/ids';
import type { DeviceProfile, Household, TrackingMethod } from '../types';
import { AdminHouseForm } from './AdminHouseForm';
import { AdminPinForm } from './AdminPinForm';

interface AdminScreenProps {
  onChanged: () => void;
  onExit: () => void;
}

/**
 * Админ-профиль ищем по роли, а не по id 'me': тесты кладут профиль с id 'p',
 * а saveDeviceProfile в проде форсирует id 'me'. getDeviceProfile() читает
 * только 'me' — поэтому сначала полный скан, потом фолбэк.
 */
async function resolveAdminProfile(): Promise<DeviceProfile | null> {
  const all = await db.deviceProfile.toArray();
  const byRole = all.find(p => p.role === 'admin' && p.deletedAt === null);
  if (byRole) return byRole;
  return (await getDeviceProfile()) ?? null;
}

async function currentDeviceId(): Promise<string> {
  const row = await db.meta.get('deviceId');
  return String(row?.value ?? 'unknown');
}

const fieldStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15,
};
const actionStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontWeight: 600, fontSize: 15,
};

export function AdminScreen({ onChanged, onExit }: AdminScreenProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [methods, setMethods] = useState<TrackingMethod[]>([]);
  const [household, setHousehold] = useState<Household | null>(null);
  const [newMethodName, setNewMethodName] = useState('');
  const [changingPin, setChangingPin] = useState(false);

  // Списки грузим ПОСЛЕ разблокировки; заголовок «Способы отслеживания»
  // рендерится синхронно при unlocked=true (PB#2a — тест ждёт его сразу).
  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    (async () => {
      try {
        const [methodRows, hh] = await Promise.all([getTrackingMethods(), getHousehold()]);
        if (cancelled) return;
        setMethods(methodRows);
        setHousehold(hh ?? null);
      } catch (err) {
        // База закрыта при размонтировании/завершении теста — списки не нужны.
        if (!(err instanceof Error) || err.name !== 'DatabaseClosedError') throw err;
      }
    })();
    return () => { cancelled = true; };
  }, [unlocked]);

  const submitPin = async () => {
    if (verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const prof = await resolveAdminProfile();
      if (!prof?.pinHash) { setError('PIN не задан'); return; }
      const ok = await verifyPin(pin, prof.pinHash);
      if (!ok) { setError('Неверный PIN'); return; }
      setProfile(prof);
      setUnlocked(true);
    } finally {
      setVerifying(false);
    }
  };

  const saveHousehold = async (patch: Partial<Pick<Household, 'name' | 'warnDays' | 'deviceLabel'>>) => {
    const current = await getHousehold();
    if (!current) return;
    await db.household.put({ ...current, ...patch, ...syncMeta(await currentDeviceId()) });
    setHousehold({ ...current, ...patch });
    onChanged();
  };

  const toggleFlag = async (m: TrackingMethod, flag: 'expiry' | 'quantity') => {
    await saveTrackingMethod({ ...m, flags: { ...m.flags, [flag]: !m.flags[flag] } });
    setMethods(await getTrackingMethods());
    onChanged();
  };

  const deleteMethod = async (m: TrackingMethod) => {
    await db.trackingMethods.put({ ...m, deletedAt: Date.now(), ...syncMeta(await currentDeviceId()) });
    setMethods(await getTrackingMethods());
    onChanged();
  };

  const addMethod = async () => {
    const name = newMethodName.trim();
    if (!name) return;
    const rows = await getTrackingMethods();
    const maxOrder = rows.reduce((mx, m) => Math.max(mx, m.sortOrder), -1);
    await saveTrackingMethod({
      id: genId('tm'), name, flags: { expiry: false, quantity: false },
      sortOrder: maxOrder + 1, updatedAt: 0, updatedBy: '', deletedAt: null,
    });
    setNewMethodName('');
    setMethods(await getTrackingMethods());
    onChanged();
  };

  if (!unlocked) {
    return (
      <section>
        <h1>Админка</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260 }}>
          <input
            type="password"
            aria-label="PIN"
            value={pin}
            placeholder="PIN"
            style={fieldStyle}
            onChange={e => setPin(e.target.value)}
          />
          <button
            type="button"
            disabled={verifying}
            style={{ ...actionStyle, background: '#0e7490', color: '#fff' }}
            onClick={() => void submitPin()}
          >
            Войти
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={onExit}>← Назад</button>
        <h1 style={{ margin: 0, fontSize: 22 }}>Админка</h1>
      </header>

      <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Способы отслеживания</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
        {methods.map(m => (
          <li key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ flex: 1 }}>{m.name}</span>
            <label style={{ fontSize: 14 }}>
              <input type="checkbox" checked={m.flags.expiry} onChange={() => void toggleFlag(m, 'expiry')} /> срок
            </label>
            <label style={{ fontSize: 14 }}>
              <input type="checkbox" checked={m.flags.quantity} onChange={() => void toggleFlag(m, 'quantity')} /> остаток
            </label>
            <button type="button" onClick={() => void deleteMethod(m)}>Удалить</button>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          aria-label="Название нового способа"
          value={newMethodName}
          placeholder="Новый способ"
          style={fieldStyle}
          onChange={e => setNewMethodName(e.target.value)}
        />
        <button type="button" style={actionStyle} onClick={() => void addMethod()}>Добавить способ</button>
      </div>

      <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Дом</h2>
      <AdminHouseForm household={household} onSave={patch => void saveHousehold(patch)} />

      <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Безопасность</h2>
      {changingPin ? (
        <AdminPinForm
          profile={profile}
          onSaved={() => { setChangingPin(false); onChanged(); }}
          onCancel={() => setChangingPin(false)}
        />
      ) : (
        <button type="button" style={actionStyle} onClick={() => setChangingPin(true)}>Сменить PIN</button>
      )}
    </section>
  );
}