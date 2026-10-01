import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { AddTab } from './AddTab';
import { createTestTrack, findTestItem } from '../db/test-helpers';

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

  it('каскад Трек→Место→Тип; min/max попадают в позицию', async () => {
    const [track, place] = await createTestTrack();
    const type = (await db.types.toArray()).find(t => t.deletedAt === null);
    expect(type).toBeDefined();
    render(<AddTab onChanged={vi.fn()} />);
    await waitFor(() => expect(document.querySelector(`option[value="${track.id}"]`)).not.toBeNull());
    await userEvent.selectOptions(screen.getByLabelText(/трек/i), track.id);
    await userEvent.selectOptions(screen.getByLabelText(/место/i), place.id);
    await userEvent.selectOptions(screen.getByLabelText(/тип/i), type!.id);
    await userEvent.type(screen.getByLabelText(/название/i), 'Витамины');
    await userEvent.type(screen.getByPlaceholderText(/купить при/i), '2');
    await userEvent.type(screen.getByPlaceholderText(/избыток при/i), '10');
    await userEvent.click(screen.getByRole('button', { name: /добавить 1 позици/i }));
    const item = await findTestItem('Витамины');
    expect(item).toBeDefined();
    expect(item!.placeId).toBe(place.id);
    expect(item!.typeId).toBe(type!.id);
    expect(item!.minThreshold).toBe(2);
    expect(item!.maxThreshold).toBe(10);
    expect(item!.trackExpiry).toBe(true);
  });
});