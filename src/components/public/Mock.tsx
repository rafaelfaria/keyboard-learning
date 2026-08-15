/**
 * HTML "screenshots" of the product.
 *
 * These are not images. Every mockup below is markup and CSS, which buys three
 * things a PNG cannot: it stays sharp at any density, it costs no bytes beyond
 * the stylesheet, and it never goes stale in the silent way a screenshot does
 * (a redesign that breaks these breaks them visibly, in review).
 *
 * They render inside the prerendered public pages *and* on the landing page, so
 * this module is strictly SSR-safe: no hooks, no browser globals, no store.
 *
 * The palette is deliberately hard-coded to the app's dark chrome rather than
 * inherited from the page theme. A screenshot should look like a foreign object
 * embedded in the page, the way a real one would, instead of quietly recolouring
 * itself to match whatever theme the reader happens to be using.
 */

import type { ReactNode } from 'react';

/** The window chrome every mockup sits in. */
export function Screen({
  app, title, children, tone = 'teal',
}: {
  /** Left-hand label in the title bar, e.g. the product name. */
  app: string;
  /** Right-hand context line, e.g. the screen being shown. */
  title: string;
  children: ReactNode;
  tone?: 'teal' | 'violet' | 'amber';
}) {
  return (
    <figure className={`mk mk-${tone}`} role="img" aria-label={`${app}: ${title}`}>
      <div className="mk-frame">
        <div className="mk-bar" aria-hidden>
          <span className="mk-dots"><i /><i /><i /></span>
          <span className="mk-bar-app">{app}</span>
          <span className="mk-bar-title">{title}</span>
        </div>
        <div className="mk-body" aria-hidden>{children}</div>
      </div>
    </figure>
  );
}

/** The app's left rail, shared by the mockups that show a full screen. */
function Rail({ active }: { active: string }) {
  return (
    <nav className="mk-rail">
      {['Journey', 'Train', 'Arena', 'Progress', 'Family'].map((n) => (
        <span key={n} className={n === active ? 'is-on' : ''}>
          <i /> {n}
        </span>
      ))}
    </nav>
  );
}

const TYPED = 'the quiet library keeps';
const PENDING = ' its own kind of weather';

/** A live practice session: the typing line, the running stats, the key map. */
export function MockPractice() {
  return (
    <Screen app="KeyTopia" title="Train · Adaptive practice">
      <div className="mk-app">
        <Rail active="Train" />
        <div className="mk-main">
          <div className="mk-head">
            <div>
              <span className="mk-eyebrow">Adaptive set 4 of 6</span>
              <strong>Built from your slowest keys</strong>
            </div>
            <span className="mk-pill mk-pill-on">p · o · l</span>
          </div>

          <div className="mk-type">
            <span className="mk-type-done">{TYPED}</span>
            <span className="mk-caret" />
            <span className="mk-type-todo">{PENDING}</span>
          </div>

          <div className="mk-stats">
            <div className="mk-stat"><b>47</b><span>wpm</span></div>
            <div className="mk-stat"><b>97<i>%</i></b><span>accuracy</span></div>
            <div className="mk-stat"><b>91<i>%</i></b><span>consistency</span></div>
            <div className="mk-stat mk-stat-weak"><b>o→l</b><span>slowest pair</span></div>
          </div>

          <MockKeymap />
        </div>
      </div>
    </Screen>
  );
}

/* Rows of the mastery map. The tier per key is fixed sample data: mastered,
   reliable, improving, learning, review. */
const KEYMAP: [string, string][][] = [
  [['q', 'l'], ['w', 'i'], ['e', 'r'], ['r', 'm'], ['t', 'i'], ['y', 'v'], ['u', 'r'], ['i', 'r'], ['o', 'v'], ['p', 'v']],
  [['a', 'm'], ['s', 'm'], ['d', 'm'], ['f', 'm'], ['g', 'r'], ['h', 'r'], ['j', 'm'], ['k', 'm'], ['l', 'i']],
  [['z', 'l'], ['x', 'v'], ['c', 'i'], ['v', 'i'], ['b', 'l'], ['n', 'r'], ['m', 'i']],
];
const TIER: Record<string, string> = { m: 'mastered', r: 'reliable', i: 'improving', l: 'learning', v: 'review' };

export function MockKeymap({ legend = true }: { legend?: boolean }) {
  return (
    <div className="mk-keymap">
      {KEYMAP.map((row, i) => (
        <div className="mk-krow" key={i}>
          {row.map(([k, t]) => <span key={k} className={`mk-key mk-t-${TIER[t]}`}>{k}</span>)}
        </div>
      ))}
      {legend && (
        <div className="mk-legend">
          {['mastered', 'reliable', 'improving', 'learning', 'review'].map((t) => (
            <span key={t}><i className={`mk-t-${t}`} />{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The coach's read-out after a session. */
export function MockCoach() {
  return (
    <Screen app="KeyTopia" title="Session report · Kip" tone="violet">
      <div className="mk-coach">
        <div className="mk-coach-head">
          <span className="mk-avatar">K</span>
          <div>
            <strong>Kip</strong>
            <span className="mk-muted">read 412 keystrokes from this session</span>
          </div>
        </div>
        <p className="mk-coach-say">
          Your accuracy is already strong at <b>97%</b>. The speed you are missing is not in your
          fingers, it is in two reaches: <b>P</b> and <b>O</b> both cost you about 90ms more than
          your average key, and the <b>O→L</b> transition is your slowest pair on the board.
        </p>
        <div className="mk-coach-plan">
          <span className="mk-eyebrow">Prescribed next</span>
          <div className="mk-row"><i className="mk-tick" /> Weak-key workout · P and O · 2 min</div>
          <div className="mk-row"><i className="mk-tick" /> Accuracy Lab · pair drill O→L · 3 min</div>
          <div className="mk-row mk-row-off"><i className="mk-tick" /> Speed sprint · held back, accuracy first</div>
        </div>
      </div>
    </Screen>
  );
}

const MODE_TILES: [string, string, boolean][] = [
  ['Adaptive practice', 'Your weak keys', true],
  ['Weak-key workout', 'One key, repaired', false],
  ['Speed sprint', '15s to 5 min', false],
  ['Accuracy Lab', 'Precision scoring', false],
  ['Rhythm studio', 'Type on the beat', false],
  ['Lights out', 'No key labels', false],
];

/** The mode picker, with a session about to start. */
export function MockModes() {
  return (
    <Screen app="KeyTopia" title="Train · choose a mode">
      <div className="mk-app">
        <Rail active="Train" />
        <div className="mk-main">
          <div className="mk-head">
            <div>
              <span className="mk-eyebrow">Foundations</span>
              <strong>What are we building today?</strong>
            </div>
          </div>
          <div className="mk-tiles">
            {MODE_TILES.map(([n, s, on]) => (
              <span className={`mk-tile${on ? ' is-on' : ''}`} key={n}>
                <b>{n}</b>
                <small>{s}</small>
              </span>
            ))}
          </div>
          <div className="mk-setup">
            <span className="mk-eyebrow">Adaptive practice</span>
            <div className="mk-seg">
              {['1 min', '3 min', '5 min', 'Untimed'].map((d, i) => (
                <span key={d} className={i === 1 ? 'is-on' : ''}>{d}</span>
              ))}
            </div>
            <div className="mk-cta">Start set</div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

const LANES: [string, number, string, string][] = [
  ['You', 78, 'you', '51 wpm'],
  ['Your ghost', 71, 'ghost', 'best run'],
  ['Marbled Fox', 64, 'cpu', 'streaky'],
  ['Copper Wren', 52, 'cpu', 'slow starter'],
];

/** A race in progress: four lanes, a ghost, and the standings rail. */
export function MockRace() {
  return (
    <Screen app="KeyTopia" title="Arena · Lightstream race" tone="amber">
      <div className="mk-app">
        <Rail active="Arena" />
        <div className="mk-main">
          <div className="mk-head">
            <div>
              <span className="mk-eyebrow">Private room · code SUN-ELK-42</span>
              <strong>Heat 2 of 3</strong>
            </div>
            <span className="mk-pill">0:41</span>
          </div>
          <div className="mk-lanes">
            {LANES.map(([n, p, kind, note]) => (
              <div className="mk-lane" key={n}>
                <span className="mk-lane-name">{n}</span>
                <span className="mk-track">
                  <i className={`mk-fill mk-fill-${kind}`} style={{ width: `${p}%` }} />
                  <i className={`mk-comet mk-comet-${kind}`} style={{ left: `calc(${p}% - 9px)` }} />
                </span>
                <span className="mk-lane-note">{note}</span>
              </div>
            ))}
          </div>
          <div className="mk-type mk-type-sm">
            <span className="mk-type-done">a steady hand beats a fast</span>
            <span className="mk-caret" />
            <span className="mk-type-todo"> one over a long road</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}

const SPEED = [108, 100, 96, 84, 88, 70, 58, 52, 38];

/** The analytics screen: trend, rhythm ring and the per-key map. */
export function MockAnalytics() {
  const pts = SPEED.map((y, i) => `${10 + i * 37.5},${y}`).join(' L ');
  return (
    <Screen app="KeyTopia" title="Progress · six weeks" tone="violet">
      <div className="mk-app">
        <Rail active="Progress" />
        <div className="mk-main">
          <div className="mk-stats mk-stats-wide">
            <div className="mk-stat"><b>47</b><span>wpm now</span></div>
            <div className="mk-stat"><b>+19</b><span>since week one</span></div>
            <div className="mk-stat"><b>96<i>%</i></b><span>accuracy held</span></div>
            <div className="mk-stat"><b>23</b><span>day streak</span></div>
          </div>
          <div className="mk-panels">
            <div className="mk-panel">
              <span className="mk-eyebrow">Speed over 6 weeks</span>
              <svg viewBox="0 0 320 130" className="mk-chart">
                <path d={`M ${pts}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="10" y1="120" x2="310" y2="120" stroke="currentColor" opacity="0.18" />
              </svg>
              <small>28 to 47 wpm, accuracy never dropped below 95%</small>
            </div>
            <div className="mk-panel">
              <span className="mk-eyebrow">Rhythm fingerprint</span>
              <svg viewBox="0 0 120 120" className="mk-ring">
                <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                <path
                  d="M60 22 L84 38 L95 62 L86 88 L60 99 L34 89 L23 62 L33 37 Z"
                  fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"
                />
              </svg>
              <small>a round ring means metronome-steady hands</small>
            </div>
          </div>
          <MockKeymap legend={false} />
        </div>
      </div>
    </Screen>
  );
}
