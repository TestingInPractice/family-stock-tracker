import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackScreen } from './TrackScreen';
import { createTestTrack, resetDb } from '../db/test-helpers';
import { db } from '../db/db';

describe('TrackScreen', () => {
  beforeEach(resetDb);

  it('кнопка «Добавить место» (admin и member) создаёт место', async () => {
    const [track] = await createTestTrack();
    const prompt = vi
      .spyOn(window, 'prompt')
      .mockReturnValueOnce('Аптечка в машине')
      .mockReturnValueOnce('🚗');
    render(<TrackScreen trackId={track.id} onBack={() => {}} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /добавить место/i }));
    // два prompt: сначала имя, потом эмодзи
    expect(prompt).toHaveBeenNthCalledWith(1, 'Название места (например, аптечка дома)');
    expect(prompt).toHaveBeenNthCalledWith(2, 'Эмодзи места (по умолчанию 📦)');
    await waitFor(async () => {
      expect(await db.places.where('trackId').equals(track.id).count()).toBe(2);
    });
    // findBy*, а не getBy*: waitFor выше ждёт только коммит в БД, а список мест
    // перерисовывается позже — синхронный getByText попадал в зазор и тест флакал.
    expect(await screen.findByText(/Аптечка в машине/)).toBeInTheDocument();
  });
});
