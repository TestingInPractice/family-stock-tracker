import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { TracksTab } from './TracksTab';
import { createTestTrack } from '../db/test-helpers';

describe('TracksTab', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('показывает созданный трек', async () => {
    const [track] = await createTestTrack();
    render(<TracksTab onOpenTrack={() => {}} />);
    expect(await screen.findByText(track.name)).toBeTruthy();
  });

  it('создаёт новый трек через промпты имени и эмодзи', async () => {
    const promptSpy = vi.spyOn(window, 'prompt')
      .mockReturnValueOnce('X')
      .mockReturnValueOnce('Y');
    render(<TracksTab onOpenTrack={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /новый трек/i }));
    expect(await screen.findByText('X')).toBeTruthy();
    expect(promptSpy).toHaveBeenCalledTimes(2);
    promptSpy.mockRestore();
  });

  it('вызывает onOpenTrack при клике на трек', async () => {
    const [track] = await createTestTrack();
    const onOpenTrack = vi.fn();
    render(<TracksTab onOpenTrack={onOpenTrack} />);
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(track.name) }));
    expect(onOpenTrack).toHaveBeenCalledWith(track.id);
  });
});