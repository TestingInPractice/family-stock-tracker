import { useEffect, useState, type ReactNode } from 'react';
import { Onboarding } from './components/Onboarding';
import { DashboardTab } from './components/DashboardTab';
import { TracksTab } from './components/TracksTab';
import { TrackScreen } from './components/TrackScreen';
import { AddTab } from './components/AddTab';
import { MoreTab } from './components/MoreTab';
import { db, ensureOnboarding, getDeviceProfile, getHousehold } from './db/db';
import { problemCount, useBadge } from './hooks/useBadge';
import type { DeviceProfile, Household, Tab } from './types';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'tracks', label: 'Треки' },
  { id: 'add', label: 'Добавить' },
  { id: 'spend', label: 'Списать' },
  { id: 'more', label: 'Ещё' },
];

interface AppState {
  ready: boolean;
  household: Household | null;
  profile: DeviceProfile | null;
  problemCount: number;
}

export function App() {
  const [state, setState] = useState<AppState>({
    ready: false, household: null, profile: null, problemCount: 0,
  });
  const [active, setActive] = useState<Tab>('dashboard');
  const [openTrackId, setOpenTrackId] = useState<string | null>(null);

  useBadge(state.problemCount);

  const reload = async () => {
    await ensureOnboarding();
    const [household, profile] = await Promise.all([getHousehold(), getDeviceProfile()]);
    // Бейдж на иконке приложения: число проблемных позиций (просрочено/истекает/низкий/избыток).
    const count = household
      ? problemCount(await db.items.toArray(), household.warnDays, new Date())
      : 0;
    setState({ ready: true, household: household ?? null, profile: profile ?? null, problemCount: count });
  };

  useEffect(() => {
    void reload();
  }, []);

  if (!state.ready) return null;

  if (state.household === null) {
    return <Onboarding onDone={reload} />;
  }

  const household = state.household; // сужено до Household: онбординг-гейт выше

  // Клик по позиции на дашборде → открываем трек этой позиции (Task 11).
  const openItemTrack = async (itemId: string) => {
    const item = await db.items.get(itemId);
    if (!item) return;
    const cat = await db.categories.get(item.categoryId);
    setActive('tracks');
    if (cat) setOpenTrackId(cat.trackId);
  };

  const renderTab = (tab: Tab): ReactNode => {
    switch (tab) {
      case 'dashboard':
        return <DashboardTab household={household} onChanged={reload} onOpenItem={openItemTrack} />;
      case 'tracks':
        return <TracksTab onOpenTrack={id => setOpenTrackId(id)} />;
      case 'add':
        return <AddTab onChanged={reload} />;
      // Отдельного экрана «Списать» нет: списание живёт в TrackScreen/SpendModal.
      // Решение оркестратора Task 15 — вкладка «Списать» показывает список треков.
      case 'spend':
        return <TracksTab onOpenTrack={id => setOpenTrackId(id)} />;
      case 'more':
        return <MoreTab onChanged={reload} isAdmin={state.profile?.role === 'admin'} />;
    }
  };

  return (
    <div className="app-shell">
      <main>
        {openTrackId !== null ? (
          <TrackScreen
            trackId={openTrackId}
            onBack={() => setOpenTrackId(null)}
            onChanged={reload}
          />
        ) : (
          renderTab(active)
        )}
      </main>
      <nav className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            aria-current={active === tab.id ? 'page' : undefined}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
