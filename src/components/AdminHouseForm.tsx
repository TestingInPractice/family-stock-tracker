import { useEffect, useState } from 'react';
import type { Household } from '../types';

interface AdminHouseFormProps {
  household: Household | null;
  onSave: (patch: Partial<Pick<Household, 'name' | 'warnDays' | 'deviceLabel'>>) => void;
}

const fieldStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15,
};

/** Поля дома: имя, подпись устройства, warnDays. Сохраняются по blur. */
export function AdminHouseForm({ household, onSave }: AdminHouseFormProps) {
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [warnDays, setWarnDays] = useState('30');

  useEffect(() => {
    if (!household) return;
    setName(household.name);
    setLabel(household.deviceLabel);
    setWarnDays(String(household.warnDays));
  }, [household]);

  const saveWarnDays = () => {
    const n = Number(warnDays);
    if (n >= 1 && n <= 365) onSave({ warnDays: n });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxWidth: 260 }}>
      <label style={{ fontSize: 14 }}>
        Имя дома
        <input
          type="text"
          value={name}
          style={{ ...fieldStyle, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4 }}
          onChange={e => setName(e.target.value)}
          onBlur={() => onSave({ name: name.trim() })}
        />
      </label>
      <label style={{ fontSize: 14 }}>
        Подпись устройства
        <input
          type="text"
          value={label}
          style={{ ...fieldStyle, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4 }}
          onChange={e => setLabel(e.target.value)}
          onBlur={() => onSave({ deviceLabel: label.trim() })}
        />
      </label>
      <label style={{ fontSize: 14 }}>
        Предупреждать за дней
        <input
          type="number"
          min={1}
          max={365}
          value={warnDays}
          style={{ ...fieldStyle, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4 }}
          onChange={e => setWarnDays(e.target.value)}
          onBlur={saveWarnDays}
        />
      </label>
    </div>
  );
}