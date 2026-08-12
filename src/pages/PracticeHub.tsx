import { Link } from 'react-router-dom';
import { useData } from '../lib/store';
import { MODES } from './TrainSession';
import { weakKeys } from '../lib/adaptive';
import { Btn, Chip } from '../components/ui';
import { Ic } from '../components/icons';

/**
 * Train (plan §4.2, density pass): one recommended session up top, then every
 * mode as a compact row inside four named groups — 15 modes without the wall.
 */

const GROUPS: { title: string; icon: string; blurb: string; ids: string[] }[] = [
  { title: 'Tune-ups', icon: 'brain', blurb: 'Built from your own typing data', ids: ['adaptive', 'weakkeys', 'checkpoint'] },
  { title: 'Speed & precision', icon: 'zap', blurb: 'Measured runs with clear scores', ids: ['speed', 'accuracy', 'rhythm'] },
  { title: 'Focus & stamina', icon: 'flower', blurb: 'Longer, calmer, steadier', ids: ['endurance', 'zen', 'recovery', 'blind'] },
  { title: 'Real-world', icon: 'clipboard', blurb: 'The typing days are made of', ids: ['realworld', 'code', 'numbers', 'dictation', 'copy'] },
];

export default function PracticeHub() {
  const data = useData();
  if (!data) return null;
  const weak = weakKeys(data.keyStats).slice(0, 3);

  const byId = Object.fromEntries(MODES.map((m) => [m.id, m]));
  const rec = weak.length && weak[0].err > 0.08 ? byId['weakkeys'] : byId['adaptive'];
  const why = rec.id === 'weakkeys'
    ? `Your map shows ${weak.map((w) => w.key.toUpperCase()).join(', ')} running soft — targeted reps there pay off most right now.`
    : 'A balanced set generated from your Mastery Map — the right default for most days.';

  return (
    <div className="trainhub">
      <div className="page-head">
        <div>
          <h1>Train</h1>
          <p>Fifteen ways to practise, one recommendation. Every mode names the skill it builds.</p>
        </div>
      </div>

      <div className="train-hero card">
        <div className="row gap wrap spread">
          <div className="row gap">
            <span className="train-hero-ic"><Ic n={rec.icon} size={26} /></span>
            <div>
              <div className="dash-kicker">Recommended today</div>
              <h2 style={{ margin: '2px 0 4px' }}>{rec.name}</h2>
              <p className="small muted" style={{ margin: 0 }}>{why}</p>
            </div>
          </div>
          <Btn big to={`/app/train/${rec.id}`}><Ic n="play" size={17} /> Start</Btn>
        </div>
      </div>

      <div className="train-groups">
        {GROUPS.map((g) => (
          <section key={g.title} className="card train-group" aria-label={g.title}>
            <header className="train-group-head">
              <Ic n={g.icon} size={17} />
              <h3>{g.title}</h3>
              <small className="muted">{g.blurb}</small>
            </header>
            {g.ids.map((id) => {
              const m = byId[id];
              if (!m) return null;
              return (
                <Link key={id} to={`/app/train/${id}`} className="train-row">
                  <span className="train-row-ic"><Ic n={m.icon} size={18} /></span>
                  <span className="train-row-txt">
                    <strong>{m.name}</strong>
                    <small>{m.skill}</small>
                  </span>
                  <Ic n="chevron-right" size={16} className="train-row-go" />
                </Link>
              );
            })}
          </section>
        ))}
      </div>

      <Link to="/onboarding?retest=1" className="train-retest">
        <Ic n="compass" size={18} />
        <span><strong>Placement test</strong> — re-measure your level and refresh your plan</span>
        <Chip>2 min</Chip>
      </Link>
    </div>
  );
}
