import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { createHousehold, db, ensureOnboarding, saveDeviceProfile } from './db/db';
import { hashPin } from './logic/pin';

describe('App', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await ensureOnboarding();
  });
  afterEach(async () => {
    await db.close();
  });

  it('показывает онбординг, если дом ещё не создан', async () => {
    render(<App />);
    expect(await screen.findByLabelText(/имя дома/i)).toBeInTheDocument();
  });

  it('показывает таб-бар из 5 вкладок и переключает активную', async () => {
    await createHousehold({ name: 'Семья Ивановых', deviceLabel: 'Папин iPhone', warnDays: 30 });
    await saveDeviceProfile({
      id: 'me', role: 'admin', pinHash: await hashPin('1234'),
      updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
    });
    render(<App />);

    const dashboard = await screen.findByRole('button', { name: 'Дашборд' });
    const tracks = screen.getByRole('button', { name: 'Треки' });
    const add = screen.getByRole('button', { name: 'Добавить' });
    const spend = screen.getByRole('button', { name: 'Списать' });
    const more = screen.getByRole('button', { name: 'Ещё' });
    expect(dashboard).toBeInTheDocument();
    expect(tracks).toBeInTheDocument();
    expect(add).toBeInTheDocument();
    expect(spend).toBeInTheDocument();
    expect(more).toBeInTheDocument();

    expect(dashboard).toHaveAttribute('aria-current', 'page');
    expect(tracks).not.toHaveAttribute('aria-current');

    await userEvent.click(tracks);
    expect(tracks).toHaveAttribute('aria-current', 'page');
    expect(dashboard).not.toHaveAttribute('aria-current');
  });
});