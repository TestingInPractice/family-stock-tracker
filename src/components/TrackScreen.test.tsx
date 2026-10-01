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
    // заголовок места рендерится как «<emoji> <name>», поэтому regex, как в AdminScreen.test.tsx
    expect(screen.getByText(/Аптечка в машине/)).toBeInTheDocument();
  });
});
