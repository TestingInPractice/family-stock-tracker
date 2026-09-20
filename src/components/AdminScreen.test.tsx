import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
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
});