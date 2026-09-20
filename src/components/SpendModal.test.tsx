import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { SpendModal } from './SpendModal';
import { createTestTrack } from '../db/test-helpers';

describe('SpendModal', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('списание 1: количество уменьшается, пишется op', async () => {
    const [, , item] = await createTestTrack();
    const onChanged = vi.fn();
    render(<SpendModal item={item} onClose={() => {}} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole('button', { name: /^1$/ }));
    await userEvent.click(screen.getByRole('button', { name: /списать/i }));
    expect(onChanged).toHaveBeenCalled();
    const fresh = await db.items.get(item.id);
    expect(fresh!.quantity).toBe(item.quantity - 1);
  });

  it('упаковка: списывает packSize штук', async () => {
    const [, , item] = await createTestTrack();
    const qtyBefore = item.quantity;
    render(<SpendModal item={{ ...item, packSize: 4 }} onClose={() => {}} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /упаковк/i }));
    await userEvent.click(screen.getByRole('button', { name: /списать/i }));
    expect((await db.items.get(item.id))!.quantity).toBe(qtyBefore - 4);
  });
});