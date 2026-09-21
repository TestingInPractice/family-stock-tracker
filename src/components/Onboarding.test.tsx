import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import type { HouseholdEnvelope } from '../types';
import { Onboarding } from './Onboarding';

const demoEnvelope: HouseholdEnvelope = {
  format: 'household-backup',
  version: 2,
  exportedAt: Date.now(),
  deviceId: 'dev_demo',
  deviceLabel: 'Телефон Пети',
  household: {
    id: 'hh_demo01', name: 'Демо-семья', warnDays: 30, deviceLabel: 'Телефон Пети',
    createdAt: Date.now(), updatedAt: Date.now(), updatedBy: 'demo', deletedAt: null,
  },
  trackingMethods: [],
  tracks: [],
  types: [],
  units: [],
  places: [],
  items: [],
  ops: [],
};

describe('Onboarding', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('создаёт дом и профиль админа с PIN', async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: /создать новый дом/i }));
    await userEvent.type(screen.getByLabelText(/имя дома/i), 'Семья Ивановых');
    await userEvent.click(screen.getByLabelText(/администратор/i));
    await userEvent.type(screen.getByLabelText(/подпись устройства/i), 'Папин iPhone');
    await userEvent.type(screen.getByLabelText(/^pin$/i), '1234');
    await userEvent.type(screen.getByLabelText(/повторите pin/i), '1234');
    await userEvent.click(screen.getByRole('button', { name: /создать/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const hd = await db.household.toArray();
    const prof = await db.deviceProfile.toArray();
    expect(hd[0].name).toBe('Семья Ивановых');
    expect(prof[0].role).toBe('admin');
    expect(prof[0].pinHash).toContain(':');
  });

  it('показывает путь импорта бэкапа на первом экране', async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    expect(screen.getByRole('button', { name: /импорт/i })).toBeInTheDocument();
  });

  it('импортирует бэкап, затем сохраняет профиль устройства', async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    const file = new File([JSON.stringify(demoEnvelope)], 'backup.json', { type: 'application/json' });
    await userEvent.upload(screen.getByLabelText(/импорт бэкапа/i), file);
    await userEvent.click(await screen.findByRole('button', { name: /подтвердить/i }));
    expect(await screen.findByRole('heading', { name: /кто вы/i })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/администратор/i));
    await userEvent.type(screen.getByLabelText(/подпись устройства/i), 'Папин iPhone');
    await userEvent.type(screen.getByLabelText(/^pin$/i), '1234');
    await userEvent.type(screen.getByLabelText(/повторите pin/i), '1234');
    await userEvent.click(screen.getByRole('button', { name: /продолжить/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const hd = await db.household.toArray();
    const prof = await db.deviceProfile.toArray();
    expect(hd[0].name).toBe('Демо-семья');
    expect(prof[0].role).toBe('admin');
    expect(prof[0].pinHash).toContain(':');
  });
});