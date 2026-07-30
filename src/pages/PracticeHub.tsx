import { Link } from 'react-router-dom';
import { useData } from '../lib/store';
import { MODES } from './TrainSession';
import { weakKeys } from '../lib/adaptive';
import { Card, Chip } from '../components/ui';
import { Ic } from '../components/icons';

export default function PracticeHub() {
  const data = useData();
  if (!data) return null;
  const weak = weakKeys(data.keyStats).slice(0, 3);

  const featured = MODES.filter((m) => ['adaptive', 'weakkeys', 'speed', 'accuracy'].includes(m.id));
  const rest = MODES.filter((m) => !featured.includes(m));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Practise</h1>
          <p>Fourteen ways to train. Every mode names the skill it builds — pick what today needs.</p>
        </div>
      </div>

      {weak.length > 0 && (
        <div className="why-box" style={{ marginBottom: 18 }}>
          <strong>Kip's suggestion:</strong> your map shows {weak.map((w) => w.key.toUpperCase()).join(', ')} running soft —
          a <Link to="/app/train/weakkeys" style={{ color: 'var(--accent)', fontWeight: 700 }}>weak-key workout</Link> would pay off most right now.
        </div>
      )}

      <div className="grid2">
        {featured.map((m) => (
          <Link key={m.id} to={`/app/train/${m.id}`} className="card card-link">
            <div className="row gap">
              <Ic n={m.icon} size={30} />
              <div className="grow">
                <h3 style={{ marginBottom: 2 }}>{m.name}</h3>
                <p className="small muted">{m.desc}</p>
              </div>
            </div>
            <div style={{ marginTop: 10 }}><Chip tone="accent">Trains: {m.skill}</Chip></div>
          </Link>
        ))}
      </div>

      <h2 className="section-title">All modes</h2>
      <div className="grid3">
        <Link to="/onboarding?retest=1" className="card card-link">
          <Ic n="compass" size={26} />
          <h3 style={{ margin: '6px 0 4px' }}>Placement test</h3>
          <p className="small muted" style={{ minHeight: '2.4em' }}>Re-measure your level & refresh your plan</p>
        </Link>
        {rest.map((m) => (
          <Link key={m.id} to={`/app/train/${m.id}`} className="card card-link">
            <Ic n={m.icon} size={26} />
            <h3 style={{ margin: '6px 0 4px' }}>{m.name}</h3>
            <p className="small muted" style={{ minHeight: '2.4em' }}>{m.skill}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
