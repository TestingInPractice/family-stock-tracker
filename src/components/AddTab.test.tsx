import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { AddTab } from './AddTab';
import { createTestTrack } from '../db/test-helpers';

describe('AddTab', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('добавляет две позиции из пачки', async () => {
    await createTestTrack();
    const onChanged = vi.fn();
    render(<AddTab onChanged={onChanged} />);
    const names = screen.getAllByLabelText(/название/i);
    await userEvent.type(names[0], 'Рис');
    await userEvent.click(screen.getByRole('button', { name: /добавить 1 позици/i }));
    expect(onChanged).toHaveBeenCalled();
    const items = await db.items.toArray();
    expect(items.some(i => i.name === 'Рис')).toBe(true);
  });
});