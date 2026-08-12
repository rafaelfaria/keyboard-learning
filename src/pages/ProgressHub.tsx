import { useSearchParams } from 'react-router-dom';
import Dashboard from './Dashboard';
import Progress from './Progress';
import BadgesPage from './BadgesPage';
import { Ic } from '../components/icons';

/**
 * Progress absorbs the old dashboard and the badge wall (plan §4.2).
 * Nothing is deleted — the dense overview simply stops being the front door.
 */
const TABS = [
  { id: 'overview', label: 'Overview', icon: 'house' },
  { id: 'analytics', label: 'Analytics', icon: 'trending' },
  { id: 'badges', label: 'Badges', icon: 'medal' },
] as const;

export default function ProgressHub() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') ?? 'overview';
  return (
    <div className="proghub">
      <div className="proghub-tabs" role="tablist" aria-label="Progress sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`proghub-tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => setSp({ tab: t.id }, { replace: true })}
          >
            <Ic n={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'analytics' ? <Progress /> : tab === 'badges' ? <BadgesPage /> : <Dashboard />}
    </div>
  );
}
