import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureOnboarding } from '../db/db';
import { DashboardTab } from './DashboardTab';
import { createTestTrack } from '../db/test-helpers';

describe('DashboardTab', () => {
  beforeEach(async () => { await db.delete(); await db.open(); await ensureOnboarding(); });
  afterEach(async () => { await db.close(); });

  it('считает просроченные и низкие остатки', async () => {
    await createTestTrack(); // содержит просроченную позицию и низкий остаток
    render(<DashboardTab household={{ id: 'h', name: 'Дом', warnDays: 30, deviceLabel: 'd', createdAt: 1, updatedAt: 1, updatedBy: 'd', deletedAt: null }} onChanged={() => {}} />);
    expect(await screen.findByText(/просрочено/i)).toBeTruthy();
    expect((await screen.findAllByText(/пора купить/i)).length).toBeGreaterThan(0);
  });
});