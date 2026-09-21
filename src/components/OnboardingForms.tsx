import { useState, type FormEvent } from 'react';
import { createHousehold, db, saveDeviceProfile } from '../db/db';
import { hashPin } from '../logic/pin';
import type { Role } from '../types';

const WARN_DAYS = 30;

interface ProfileFieldsProps {
  role: Role;
  onRoleChange: (role: Role) => void;
  deviceLabel: string;
  onDeviceLabelChange: (value: string) => void;
  pin: string;
  onPinChange: (value: string) => void;
  pin2: string;
  onPin2Change: (value: string) => void;
}

/** Общие поля профиля устройства: роль, подпись, PIN (только для админа). */
function ProfileFields({
  role, onRoleChange, deviceLabel, onDeviceLabelChange, pin, onPinChange, pin2, onPin2Change,
}: ProfileFieldsProps) {
  return (
    <>
      <fieldset>
        <legend>Роль</legend>
        <label>
          <input
            type="radio"
            name="role"
            value="admin"
            checked={role === 'admin'}
            onChange={() => onRoleChange('admin')}
          />
          Администратор
        </label>
        <label>
          <input
            type="radio"
            name="role"
            value="member"
            checked={role === 'member'}
            onChange={() => onRoleChange('member')}
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
          onChange={e => onDeviceLabelChange(e.target.value)}
        />
      </div>
      {role === 'admin' && (
        <>
          <div>
            <label htmlFor="pin">PIN</label>
            <input id="pin" type="password" value={pin} onChange={e => onPinChange(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pin2">Повторите PIN</label>
            <input id="pin2" type="password" value={pin2} onChange={e => onPin2Change(e.target.value)} />
          </div>
        </>
      )}
    </>
  );
}

/** Валидация профиля: PIN обязателен (4–8 цифр) и совпадает для админа. */
function validateProfile(role: Role, pin: string, pin2: string): string | null {
  if (role === 'admin') {
    if (!/^\d{4,8}$/.test(pin)) return 'PIN — 4–8 цифр';
    if (pin !== pin2) return 'PIN не совпадает';
  }
  return null;
}

/** Форма создания дома: дом + профиль устройства одним экраном. */
export function CreateHouseForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
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
    const profileError = validateProfile(role, pin, pin2);
    if (profileError) {
      setError(profileError);
      return;
    }
    const pinHash = role === 'admin' ? await hashPin(pin) : null;
    await Promise.all([
      createHousehold({ name, deviceLabel: label, warnDays: WARN_DAYS }),
      saveDeviceProfile({ id: 'me', role, pinHash, updatedAt: Date.now(), updatedBy: 'me', deletedAt: null }),
      db.meta.put({ key: 'deviceLabel', value: label }),
    ]);
    onDone();
  };

  return (
    <form className="onboarding-form" onSubmit={handleSubmit}>
      <button type="button" className="onboarding-back" onClick={onBack}>← Назад</button>
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
      <ProfileFields
        role={role}
        onRoleChange={setRole}
        deviceLabel={deviceLabel}
        onDeviceLabelChange={setDeviceLabel}
        pin={pin}
        onPinChange={setPin}
        pin2={pin2}
        onPin2Change={setPin2}
      />
      {error && <p className="onboarding-error" role="alert">{error}</p>}
      <button type="submit">Создать</button>
    </form>
  );
}

/** Шаг после импорта бэкапа: профиль устройства (роль/PIN локальны для устройства). */
export function ProfileForm({ onDone }: { onDone: () => void }) {
  const [deviceLabel, setDeviceLabel] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const label = deviceLabel.trim();
    const profileError = validateProfile(role, pin, pin2);
    if (profileError) {
      setError(profileError);
      return;
    }
    const pinHash = role === 'admin' ? await hashPin(pin) : null;
    await Promise.all([
      saveDeviceProfile({ id: 'me', role, pinHash, updatedAt: Date.now(), updatedBy: 'me', deletedAt: null }),
      db.meta.put({ key: 'deviceLabel', value: label }),
    ]);
    onDone();
  };

  return (
    <form className="onboarding-form" onSubmit={handleSubmit}>
      <h1>Кто вы?</h1>
      <p className="onboarding-hint">Дом импортирован из бэкапа. Укажите, кто пользуется этим устройством.</p>
      <ProfileFields
        role={role}
        onRoleChange={setRole}
        deviceLabel={deviceLabel}
        onDeviceLabelChange={setDeviceLabel}
        pin={pin}
        onPinChange={setPin}
        pin2={pin2}
        onPin2Change={setPin2}
      />
      {error && <p className="onboarding-error" role="alert">{error}</p>}
      <button type="submit">Продолжить</button>
    </form>
  );
}