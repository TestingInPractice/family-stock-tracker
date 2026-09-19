import type { Item, ItemStatus } from '../types';
import { STATUS_META } from '../constants';

export function computeStatus(item: Item, warnDays: number, today: Date): ItemStatus {
  const day = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
  if (item.trackExpiry && item.expiresAt) {
    const exp = day(item.expiresAt);
    const now = day(today.toISOString().slice(0, 10));
    if (exp < now) return 'expired';
    if (exp - now <= warnDays * 86_400_000) return 'expiring';
  }
  if (item.trackQuantity) {
    if (item.minThreshold != null && item.quantity <= item.minThreshold) return 'low';
    if (item.maxThreshold != null && item.quantity >= item.maxThreshold) return 'excess';
  }
  return 'ok';
}

export function isProblem(s: ItemStatus): boolean { return s !== 'ok'; }

export function sortByUrgency(items: Item[], warnDays: number, today: Date): Item[] {
  return [...items].sort((a, b) => {
    const pa = STATUS_META[computeStatus(a, warnDays, today)].priority;
    const pb = STATUS_META[computeStatus(b, warnDays, today)].priority;
    if (pa !== pb) return pb - pa;
    return a.name.localeCompare(b.name, 'ru');
  });
}