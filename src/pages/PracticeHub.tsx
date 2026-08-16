import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/store';
import { MODES } from './TrainSession';
import { weakKeys } from '../lib/adaptive';
import { relTime } from '../lib/metrics';
import { Btn, KeyCap } from '../components/ui';
import { Ic } from '../components/icons';

/**
 * Train (plan §4.2, density pass): one recommended session up top, then every
 * mode as a compact row inside four named groups — 15 modes without the wall.
 *
 * Each row carries the learner's own history on the right (best speed, or an
 * unmistakable "New"), because fifteen identically-shaped rows give the eye
 * nothing to sort by. The numbers come from real sessions only: a mode never
 * touched says so rather than showing a zero.
 */

type Group = { title: string; blurb: string; ids: string[] };

/**
 * Two columns of two groups rather than four free-standing cards. Four cards in
 * a 2x2 grid can never line up: the groups hold 3, 3, 4 and 5 modes, so the
 * bottom row is always ragged (or stretched, leaving a band of empty surface).
 * Paired into columns it is 7 rows against 8, close enough that one card border
 * ends level with the other.
 *
 * The group headings carry no icon on purpose. Every icon that would go there
 * already appears on a row directly beneath it, so a "Tune-ups" brain sat on top
 * of "Adaptive practice"'s brain, and a "Speed & precision" bolt on top of
 * "Speed sprint"'s bolt. Repeating a row's icon as its own heading tells the
 * reader nothing and makes the real icons harder to scan.
 */
const COLUMNS: Group[][] = [
  [
    { title: 'Tune-ups', blurb: 'Built from your own typing data', ids: ['adaptive', 'weakkeys', 'checkpoint'] },
    { title: 'Focus & stamina', blurb: 'Longer, calmer, steadier', ids: ['endurance', 'zen', 'recovery', 'blind'] },
  ],
  [
    { title: 'Speed & precision', blurb: 'Measured runs with clear scores', ids: ['speed', 'accuracy', 'rhythm'] },
    { title: 'Real-world', blurb: 'The typing days are made of', ids: ['realworld', 'code', 'numbers', 'dictation', 'copy'] },
  ],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-');

type ModeHistory = { runs: number; best: number; last: number };

export default function PracticeHub() {
  const data = useData();

  const weak = useMemo(() => (data ? weakKeys(data.keyStats).slice(0, 3) : []), [data?.keyStats]);

  /** runs / personal best / last played, per mode id, from real sessions only. */
  const history = useMemo(() => {
    const h: Record<string, ModeHistory> = {};
    for (const s of data?.sessions ?? []) {
      const e = (h[s.mode] ??= { runs: 0, best: 0, last: 0 });
      e.runs++;
      if (s.wpm > e.best) e.best = s.wpm;
      if (s.endedAt > e.last) e.last = s.endedAt;
    }
    return h;
  }, [data?.sessions]);

  if (!data) return null;

  const byId = Object.fromEntries(MODES.map((m) => [m.id, m]));
  const onWeakKeys = weak.length > 0 && weak[0].err > 0.08;
  const rec = onWeakKeys ? byId['weakkeys'] : byId['adaptive'];
  const alt = onWeakKeys ? byId['adaptive'] : byId['weakkeys'];
  const why = onWeakKeys
    ? 'Your Mastery Map has these running soft. Targeted reps there pay off most right now.'
    : 'A balanced set generated from your Mastery Map. The right default for most days.';
  const recHist = history[rec.id];
  const tried = MODES.filter((m) => history[m.id]).length;

  return (
    <div className="trainhub">
      <div className="page-head">
        <div>
          <h1>Train</h1>
          <p>Fifteen ways to practise, one recommendation. Every mode names the skill it builds.</p>
        </div>
        {tried > 0 && (
          <span className="train-tally" title="Modes you have practised at least once">
            <Ic n="tick" size={16} /> {tried} of {MODES.length} modes tried
          </span>
        )}
      </div>

      <section className="train-hero card" aria-labelledby="train-rec">
        <div className="train-hero-main">
          <span className="train-hero-ic"><Ic n={rec.icon} size={28} /></span>
          <div className="train-hero-txt">
            <div className="dash-kicker">Recommended today</div>
            <h2 id="train-rec">{rec.name}</h2>
            <p>{why}</p>
            <div className="train-hero-meta">
              {onWeakKeys
                ? <span className="train-hero-keys">Softest keys {weak.map((w) => <KeyCap key={w.key} ch={w.key.toUpperCase()} />)}</span>
                : <span className="train-tag"><Ic n="sparkles" size={14} /> {rec.skill}</span>}
              {recHist
                ? <span className="train-tag"><Ic n="trophy" size={14} /> Your best {Math.round(recHist.best)} wpm</span>
                : <span className="train-tag"><Ic n="sparkles" size={14} /> Your first run</span>}
            </div>
          </div>
        </div>
        <div className="train-hero-go">
          {/* Straight into the run: this button already said Start, and the mode
              it names has just been explained above it. The rows below still land
              on the intro, because browsing is what they are for. */}
          <Btn big to={`/app/train/${rec.id}?start=1`}><Ic n="play" size={17} /> Start</Btn>
          <Link to={`/app/train/${alt.id}`} className="train-hero-alt">or {alt.name.toLowerCase()}</Link>
        </div>
      </section>

      <div className="train-cols">
        {COLUMNS.map((col, i) => (
          <div key={i} className="card train-col">
            {col.map((g) => (
              <section key={g.title} className="train-group" aria-labelledby={`grp-${slug(g.title)}`}>
                <header className="train-group-head">
                  <h3 id={`grp-${slug(g.title)}`}>{g.title}</h3>
                  <small>{g.blurb}</small>
                </header>
                <div className="train-rows">
                  {g.ids.map((id) => {
                    const m = byId[id];
                    if (!m) return null;
                    const h = history[id];
                    return (
                      <Link
                        key={id}
                        to={`/app/train/${id}`}
                        className={`train-row${id === rec.id ? ' train-row-rec' : ''}`}
                      >
                        <span className="train-row-ic"><Ic n={m.icon} size={18} /></span>
                        <span className="train-row-txt">
                          <strong>{m.name}</strong>
                          <small>{m.skill}</small>
                        </span>
                        {h ? (
                          <span className="train-row-meta">
                            <b>{Math.round(h.best)}<i> wpm</i></b>
                            <small>{relTime(h.last)}</small>
                          </span>
                        ) : tried > 0 ? (
                          /* "New" only means something once something else is old:
                             on a fresh profile all fifteen are new and the badge is noise. */
                          <span className="train-row-new">New</span>
                        ) : null}
                        <Ic n="chevron-right" size={16} className="train-row-go" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ))}
      </div>

      {/* Solid, not dashed. A dashed border is the web's placeholder/drop-target
          convention, and this row read as an unfinished slot rather than a real
          thing you can do. The copy now says why you would want it. */}
      <Link to="/onboarding?retest=1" className="train-retest">
        <span className="train-retest-ic"><Ic n="compass" size={18} /></span>
        <span className="train-retest-txt">
          <strong>Is this plan still right for you?</strong>
          <small>Re-take the placement test and KeyTopia rebuilds your level, your trail and your targets.</small>
        </span>
        <span className="train-retest-time">2 min</span>
        <Ic n="chevron-right" size={16} className="train-row-go" />
      </Link>
    </div>
  );
}
