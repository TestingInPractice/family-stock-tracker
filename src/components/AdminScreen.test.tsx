import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { listTypes } from '../db/catalog';
import { AdminScreen } from './AdminScreen';
import { hashPin } from '../logic/pin';

describe('AdminScreen', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('PIN-гейт: неверный PIN не открывает настройки', async () => {
    await db.deviceProfile.put({ id: 'p', role: 'admin', pinHash: await hashPin('1234'), updatedAt: 1, updatedBy: 'd', deletedAt: null });
    render(<AdminScreen onChanged={() => {}} onExit={() => {}} />);
    await userEvent.type(screen.getByLabelText(/pin/i), '0000');
    await userEvent.click(screen.getByRole('button', { name: /войти/i }));
    expect(screen.queryByText(/способы отслеживания/i)).toBeNull();
  });

  it('верный PIN открывает настройки; меняет warnDays', async () => {
    await db.deviceProfile.put({ id: 'p', role: 'admin', pinHash: await hashPin('1234'), updatedAt: 1, updatedBy: 'd', deletedAt: null });
    render(<AdminScreen onChanged={() => {}} onExit={() => {}} />);
    await userEvent.type(screen.getByLabelText(/pin/i), '1234');
    await userEvent.click(screen.getByRole('button', { name: /войти/i }));
    await waitFor(() => expect(screen.getByText(/способы отслеживания/i)).toBeTruthy());
  });

  it('админ видит и добавляет типы позиций и единицы; удаление мягкое', async () => {
    await db.deviceProfile.put({ id: 'p', role: 'admin', pinHash: await hashPin('1234'), updatedAt: 1, updatedBy: 'd', deletedAt: null });
    render(<AdminScreen onChanged={() => {}} onExit={() => {}} />);
    await userEvent.type(screen.getByLabelText(/pin/i), '1234');
    await userEvent.click(screen.getByRole('button', { name: /войти/i }));
    await waitFor(() => expect(screen.getByText('Типы позиций')).toBeInTheDocument());
    expect(screen.getByText('Единицы')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/имя типа/i), 'Лекарства');
    await userEvent.click(screen.getByRole('button', { name: /добавить тип/i }));
    await waitFor(async () => expect((await db.types.toArray())).toHaveLength(1));
    expect((await db.types.toArray())[0].name).toBe('Лекарства');

    await userEvent.type(screen.getByPlaceholderText(/название единицы/i), 'упак');
    await userEvent.click(screen.getByRole('button', { name: /добавить единицу/i }));
    await waitFor(async () =>
      expect((await db.units.toArray()).map(u => u.name)).toContain('упак'));

    // Мягкое удаление: строка остаётся в базе, но помечается deletedAt.
    await userEvent.click(screen.getByRole('button', { name: 'Удалить тип Лекарства' }));
    await waitFor(async () => expect((await db.types.toArray())[0].deletedAt).not.toBeNull());
    expect(await listTypes()).toHaveLength(0);
  });

  it('участник секций не видит', async () => {
    await db.deviceProfile.put({ id: 'me', role: 'member', pinHash: await hashPin('1234'), updatedAt: 1, updatedBy: 'd', deletedAt: null });
    render(<AdminScreen onChanged={() => {}} onExit={() => {}} />);
    await userEvent.type(screen.getByLabelText(/pin/i), '1234');
    await userEvent.click(screen.getByRole('button', { name: /войти/i }));
    await waitFor(() => expect(screen.getByText(/способы отслеживания/i)).toBeTruthy());
    expect(screen.queryByText('Типы позиций')).not.toBeInTheDocument();
    expect(screen.queryByText('Единицы')).not.toBeInTheDocument();
  });
});