import { useEffect, useState, type ReactNode } from 'react';
import { Onboarding } from './components/Onboarding';
import { ensureOnboarding, getDeviceProfile, getHousehold } from './db/db';
import type { DeviceProfile, Household, Tab } from './types';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'tracks', label: 'Треки' },
  { id: 'add', label: 'Добавить' },
  { id: 'spend', label: 'Списать' },
  { id: 'more', label: 'Ещё' },
];

// Заглушки экранов: Tasks 11-14 заменят их реальными компонентами
// (DashboardTab, TracksTab, TrackScreen и т.д.), которые получат onChanged.
const PLACEHOLDERS: Record<Tab, string> = {
  dashboard: 'Дашборд появится в следующей задаче',
  tracks: 'Треки появятся в следующей задаче',
  add: 'Добавление появится в следующей задаче',
  spend: 'Списание появится в следующей задаче',
  more: 'Ещё появится в следующей задаче',
};

interface AppState {
  ready: boolean;
  household: Household | null;
  profile: DeviceProfile | null;
}

export function App() {
  const [state, setState] = useState<AppState>({ ready: false, household: null, profile: null });
  const [active, setActive] = useState<Tab>('dashboard');

  const reload = async () => {
    await ensureOnboarding();
    const [household, profile] = await Promise.all([getHousehold(), getDeviceProfile()]);
    setState({ ready: true, household: household ?? null, profile: profile ?? null });
  };

  useEffect(() => {
    void reload();
  }, []);

  if (!state.ready) return null;

  if (state.household === null) {
    return <Onboarding onDone={reload} />;
  }

  return (
    <div className="app-shell">
      <main>{renderTab(active)}</main>
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

function renderTab(tab: Tab): ReactNode {
  // Вкладка «Ещё» (Task 14): вход в админку виден только для role='admin',
  // для role='member' пункт «Админ» скрыт.
  return <div>{PLACEHOLDERS[tab]}</div>;
}