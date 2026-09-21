import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { createHousehold, db, ensureOnboarding, saveDeviceProfile, saveTrack } from './db/db';
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
    expect(await screen.findByRole('button', { name: /создать новый дом/i })).toBeInTheDocument();
  });

  it('таб-бар переключает вкладку, даже когда открыта карточка трека', async () => {
    await createHousehold({ name: 'Семья Ивановых', deviceLabel: 'Папин iPhone', warnDays: 30 });
    await saveDeviceProfile({
      id: 'me', role: 'admin', pinHash: await hashPin('1234'),
      updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
    });
    await saveTrack({
      id: 'trk-1', name: 'Аптечка', emoji: '💊', sortOrder: 0,
      createdAt: Date.now(), updatedAt: Date.now(), updatedBy: 'test', deletedAt: null,
    });
    render(<App />);

    const tracks = await screen.findByRole('button', { name: 'Треки' });
    await userEvent.click(tracks);
    await userEvent.click(await screen.findByRole('button', { name: '💊 Аптечка' }));

    // given: карточка трека открыта (заголовок трека на экране, таб-бар виден).
    expect(screen.getByRole('heading', { name: 'Аптечка' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Дашборд' })).toBeInTheDocument();
    // when: клик по табу «Дашборд».
    await userEvent.click(screen.getByRole('button', { name: 'Дашборд' }));
    // then: карточка трека закрыта, показан дашборд.
    expect(await screen.findByRole('heading', { name: 'Дашборд' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Аптечка' })).not.toBeInTheDocument();
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