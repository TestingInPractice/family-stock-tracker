import { useState, type FormEvent } from 'react';
import { createHousehold, db, saveDeviceProfile } from '../db/db';
import { hashPin } from '../logic/pin';
import type { Role } from '../types';

const WARN_DAYS = 30;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [houseName, setHouseName] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = houseName.trim();
    const label = deviceLabel.trim();
    if (!name) {
      setError('Введите имя дома');
      return;
    }
    if (role === 'admin') {
      if (!/^\d{4,8}$/.test(pin)) {
        setError('PIN — 4–8 цифр');
        return;
      }
      if (pin !== pin2) {
        setError('PIN не совпадает');
        return;
      }
    }
    const pinHash = role === 'admin' ? await hashPin(pin) : null;
    await Promise.all([
      createHousehold({ name, deviceLabel: label, warnDays: WARN_DAYS }),
      saveDeviceProfile({
        id: 'me', role, pinHash, updatedAt: Date.now(), updatedBy: 'me', deletedAt: null,
      }),
      db.meta.put({ key: 'deviceLabel', value: label }),
    ]);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Создание дома</h1>
      <div>
        <label htmlFor="house-name">Имя дома</label>
        <input
          id="house-name"
          type="text"
          value={houseName}
          onChange={e => setHouseName(e.target.value)}
        />
      </div>
      <fieldset>
        <legend>Роль</legend>
        <label>
          <input
            type="radio"
            name="role"
            value="admin"
            checked={role === 'admin'}
            onChange={() => setRole('admin')}
          />
          Администратор
        </label>
        <label>
          <input
            type="radio"
            name="role"
            value="member"
            checked={role === 'member'}
            onChange={() => setRole('member')}
          />
          Участник
        </label>
      </fieldset>
      <div>
        <label htmlFor="device-label">Подпись устройства</label>
        <input
          id="device-label"
          type="text"
          value={deviceLabel}
          onChange={e => setDeviceLabel(e.target.value)}
        />
      </div>
      {role === 'admin' && (
        <>
          <div>
            <label htmlFor="pin">PIN</label>
            <input
              id="pin"
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pin2">Повторите PIN</label>
            <input
              id="pin2"
              type="password"
              value={pin2}
              onChange={e => setPin2(e.target.value)}
            />
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="submit">Создать</button>
    </form>
  );
}