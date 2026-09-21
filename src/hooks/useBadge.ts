import { useEffect } from 'react';
import { computeStatus, isProblem } from '../logic/status';
import type { Item } from '../types';

/**
 * Синхронизирует счётчик проблемных позиций с иконкой приложения (Badging API).
 * Безопасный no-op там, где API нет (jsdom, Safari без поддержки бейджей).
 */
export function useBadge(count: number): void {
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count).catch(() => {});
      } else if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  }, [count]);
}

/** Количество «живых» позиций с не-ok статусом (просрочено/истекает/низкий/избыток). */
export function problemCount(items: Item[], warnDays: number, today: Date): number {
  let count = 0;
  for (const item of items) {
    if (item.deletedAt !== null) continue;
    if (isProblem(computeStatus(item, warnDays, today))) count += 1;
  }
  return count;
}
