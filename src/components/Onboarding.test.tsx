import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { Onboarding } from './Onboarding';

describe('Onboarding', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('создаёт дом и профиль админа с PIN', async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
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
});