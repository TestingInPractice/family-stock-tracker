// src/components/MoreTab.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MoreTab } from './MoreTab';
import { createTestTrack, resetDb } from '../db/test-helpers';

describe('MoreTab', () => {
  beforeEach(resetDb);

  it('показывает кнопки экспорта/импорта/журнала', async () => {
    await createTestTrack(); // дом обязателен для экспорта
    render(<MoreTab onChanged={() => {}} isAdmin />);
    expect(screen.getByRole('button', { name: /экспорт бэкапа/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /экспорт pdf/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /экспорт шаблона/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /импорт шаблона/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /журнал/i })).toBeTruthy();
  });

  it('у участника нет кнопки «Админ»', async () => {
    render(<MoreTab onChanged={() => {}} isAdmin={false} />);
    expect(screen.queryByRole('button', { name: /админ/i })).toBeNull();
  });

  it('битый файл при импорте → сообщение об ошибке', async () => {
    await createTestTrack();
    render(<MoreTab onChanged={() => {}} isAdmin />);
    const file = new File(['{bad'], 'x.json', { type: 'application/json' });
    // input[type=file] обязан иметь aria-label «Импорт бэкапа (JSON)» (см. Step 4)
    await userEvent.upload(screen.getByLabelText(/импорт бэкапа/i), file);
    expect(await screen.findByText(/не удалось|ошибк/i)).toBeTruthy();
  });
});