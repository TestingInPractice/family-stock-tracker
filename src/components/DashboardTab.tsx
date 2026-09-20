import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { STATUS_META } from '../constants';
import { computeStatus, isProblem, sortByUrgency } from '../logic/status';
import type { Category, Household, Item, ItemStatus } from '../types';

const PROBLEM_STATUSES: ItemStatus[] = ['expired', 'expiring', 'low', 'excess'];
const URGENT_LIMIT = 15;

interface DashboardTabProps {
  household: Household;
  onChanged: () => void;
  onOpenItem?: (itemId: string) => void;
}

export function DashboardTab({ household, onChanged, onOpenItem }: DashboardTabProps) {
  void onChanged; // контракт интерфейса: App может подписаться на изменения в Task 12
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [allItems, allCats] = await Promise.all([
        db.items.toArray(),
        db.categories.toArray(),
      ]);
      if (cancelled) return;
      setItems(allItems.filter(i => i.deletedAt === null));
      setCategories(allCats.filter(c => c.deletedAt === null));
    })();
    return () => { cancelled = true; };
  }, [household]);

  const today = new Date();
  const warnDays = household.warnDays;

  const counts: Record<ItemStatus, number> = { expired: 0, expiring: 0, low: 0, excess: 0, ok: 0 };
  for (const item of items) counts[computeStatus(item, warnDays, today)] += 1;

  const urgent = sortByUrgency(items, warnDays, today)
    .filter(i => isProblem(computeStatus(i, warnDays, today)))
    .slice(0, URGENT_LIMIT);

  const catById = new Map(categories.map(c => [c.id, c]));
  const openItem = onOpenItem ?? (() => {});

  return (
    <section>
      <h1>Дашборд</h1>
      <div className="status-cards">
        {PROBLEM_STATUSES.map(s => (
          <div key={s} className="status-card">
            <span className="status-card-emoji">{STATUS_META[s].emoji}</span>
            <span className="status-card-label">{STATUS_META[s].label}</span>
            <span className="status-card-count">{counts[s]}</span>
          </div>
        ))}
      </div>
      <h2>Срочное</h2>
      {urgent.length === 0 ? (
        <p>Всё в порядке 👍</p>
      ) : (
        <ul className="urgent-list">
          {urgent.map(item => {
            const cat = catById.get(item.categoryId);
            return (
              <li key={item.id}>
                <button type="button" onClick={() => openItem(item.id)}>
                  <span>{cat?.emoji ?? '📦'}</span>
                  <span>{item.name}</span>
                  <span>{cat?.name ?? ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}