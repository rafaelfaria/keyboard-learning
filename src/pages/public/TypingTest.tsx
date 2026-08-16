/**
 * `/typing-test` — a genuinely working typing test on a crawlable page.
 *
 * The page is prerendered like every other public page, so a crawler (or a
 * reader with JavaScript disabled) gets the full explanatory content and the
 * test passage as real HTML; the interactive engine takes over on mount.
 *
 * SSR-safety note: the typing engine itself is pure (browser APIs are only
 * touched inside effects and event handlers), and the passage is generated
 * from a fixed seed so the prerendered HTML is deterministic across builds.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GhostInput, LiveStats, TypingText, useTypingSession } from '../../components/typing';
import { saveAnonResult } from '../../lib/starter';
import type { SessionResult } from '../../lib/types';
import { COMMON_WORDS } from '../../lib/words';
import { mulberry32 } from '../../lib/rng';
import { NextSteps, PublicPage } from '../../components/public/PublicPage';
import { pageByPath } from '../../lib/seo/site';
import { FAQS, GLOSSARY } from '../../lib/seo/content';

const DURATIONS = [15, 30, 60, 120] as const;
type Duration = (typeof DURATIONS)[number];

/** Deterministic for a given seed, so the prerendered passage is stable. */
function buildPassage(seed: number, words: number): string {
  const rnd = mulberry32(seed);
  const out: string[] = [];
  for (let i = 0; i < words; i++) {
    out.push(COMMON_WORDS[Math.floor(rnd() * COMMON_WORDS.length)]);
  }
  return out.join(' ');
}

/** A key as it should be read aloud: a space is a word, not a blank box. */
function keyLabel(k: string): string {
  if (k === ' ') return 'space';
  if (k === '\n') return 'enter';
  return k;
}

/** A 0–100 meter under a percentage stat. Nothing to read; it is the shape. */
function Meter({ pct, tone }: { pct: number; tone?: 'warn' }) {
  return (
    <span className={`tt-meter${tone ? ` is-${tone}` : ''}`} aria-hidden>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

function Verdict({ r }: { r: SessionResult }) {
  const worst = Object.entries(r.keyAgg)
    .filter(([k, s]) => k.trim() && s.a >= 3)
    .map(([k, s]) => ({ key: k, errRate: s.e / s.a, ms: s.n ? s.ms / s.n : 0 }))
    .sort((a, b) => b.errRate - a.errRate || b.ms - a.ms)
    .slice(0, 5);

  /* Miss rates get the absolute 0–100% scale they already have: normalising
     them to the worst key would draw a full-width bar next to the figure 33%.
     Milliseconds have no such ceiling, so those bars are scaled to the slowest
     transition in the list and are read against each other. */
  const pairPeak = Math.max(1, ...r.slowPairs.map(([, ms]) => ms));

  const gap = Math.max(0, Math.round((r.raw - r.wpm) * 10) / 10);

  /**
   * The read-out, as separate findings rather than one paragraph.
   *
   * These used to be concatenated into a single block of prose, so four
   * unrelated diagnoses ran together and the reader had to unpick which
   * sentence applied to which number. One line per finding is the whole fix.
   */
  const notes: string[] = [];
  if (gap > 0.5) {
    notes.push(`Your mistakes cost you ${gap} WPM. Closing that gap is almost always faster than typing harder.`);
  }
  if (r.acc < 95) {
    notes.push('Below 95% accuracy, practice reinforces the errors. Ease off about 10% until it recovers.');
  }
  if (r.consistency < 60) {
    notes.push('Your pace swings between keystrokes. Evening out the rhythm is the next real gain.');
  }
  if (r.acc >= 97 && r.consistency >= 70) {
    notes.push('Accuracy and rhythm are both strong. You have earned the right to push the pace.');
  }

  return (
    <section className="tt-results" aria-live="polite">
      <h2>Your result</h2>

      {/* The headline number and the sentence that qualifies it, side by side.
          Stacked, the number left a screen-wide void beside it and the sentence
          then wrapped at a measure far narrower than the space it sat in. */}
      <div className="tt-score">
        <b className="tt-score-n">{r.wpm}</b>
        <div className="tt-score-side">
          <span className="tt-score-unit">words per minute</span>
          <p className="tt-summary">
            {r.correct} correct characters in {r.seconds} seconds, with {r.uncorrected}{' '}
            {r.uncorrected === 1 ? 'error' : 'errors'} left uncorrected and {r.backspaces}{' '}
            {r.backspaces === 1 ? 'backspace' : 'backspaces'}.
          </p>
        </div>
      </div>

      {/* Units on everything, and a plain-English gloss under each: "30" told
          the reader nothing, and consistency is the one number nobody guesses.
          The two percentages also carry a meter, so where they fall on their
          own scale is legible before the digits are read. */}
      <dl className="tt-stats">
        <div>
          <dt>{r.acc}<i>%</i></dt>
          <dd>
            Accuracy<span>share of keystrokes that landed</span>
            <Meter pct={r.acc} tone={r.acc < 95 ? 'warn' : undefined} />
          </dd>
        </div>
        <div>
          <dt>{r.raw}</dt>
          <dd>Raw speed<span>every keystroke, mistakes included</span></dd>
        </div>
        <div>
          <dt>{r.consistency}<i>%</i></dt>
          <dd>
            Consistency<span>how even your rhythm was</span>
            <Meter pct={r.consistency} tone={r.consistency < 60 ? 'warn' : undefined} />
          </dd>
        </div>
        <div>
          <dt>{r.hesitations}</dt>
          <dd>Hesitations<span>pauses long enough to notice</span></dd>
        </div>
      </dl>

      {/* Prose on one side, the per-key evidence on the other. Both used to run
          down the full width of a 68rem card, which is why every paragraph
          broke line long before it reached the edge. */}
      <div className="tt-diagnosis">
        <div className="tt-diagnosis-col">
          {notes.length > 0 && (
            <div className="tt-notes">
              <h3>What that means</h3>
              <ul>{notes.map((n) => <li key={n.slice(0, 24)}>{n}</li>)}</ul>
            </div>
          )}
          <p className="tt-handoff">
            A test measures; it does not teach. <Link to="/onboarding">Start a session</Link> and
            these exact keys become the practice text.
          </p>
        </div>

        <div className="tt-diagnosis-col">
          {worst.length > 0 && (
            <div className="tt-panel">
              <h3>Keys that cost you the most</h3>
              <ol className="tt-bars">
                <li className="tt-bars-head" aria-hidden>
                  <span />
                  <span />
                  <span>missed</span>
                  <span>avg time</span>
                </li>
                {worst.map((k) => (
                  <li key={k.key}>
                    <kbd>{keyLabel(k.key)}</kbd>
                    <span className="tt-bar" aria-hidden>
                      {k.errRate > 0 && (
                        <i className="is-warn" style={{ width: `${Math.max(2, k.errRate * 100)}%` }} />
                      )}
                    </span>
                    <span className="tt-bar-v">{Math.round(k.errRate * 100)}%</span>
                    <span className="tt-bar-v is-soft">{Math.round(k.ms)}ms</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {r.slowPairs.length > 0 && (
            <div className="tt-panel">
              <h3>Slowest transitions</h3>
              <ol className="tt-bars tt-bars-pairs">
                {/* Both keys, always. These are pairs, and the slowest are usually
                    letter-then-space, so rendering the raw string showed a lone
                    letter and a caption claiming there were two. */}
                {r.slowPairs.map(([pair, ms]) => (
                  <li key={pair}>
                    <span className="tt-pair">
                      <kbd>{keyLabel(pair[0])}</kbd>
                      <i className="tt-arrow" aria-hidden>→</i>
                      <kbd>{keyLabel(pair[1])}</kbd>
                    </span>
                    <span className="tt-bar" aria-hidden>
                      <i style={{ width: `${(ms / pairPeak) * 100}%` }} />
                    </span>
                    <span className="tt-bar-v">{Math.round(ms)}ms</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function TypingTestPage() {
  const page = pageByPath('/typing-test')!;
  const [duration, setDuration] = useState<Duration>(60);
  const [seed, setSeed] = useState(20260812);
  const [result, setResult] = useState<SessionResult | null>(null);

  const text = useMemo(() => buildPassage(seed, 260), [seed]);

  const cfg = useMemo(
    () => ({
      text,
      mode: 'speed' as const,
      label: `${duration}-second typing test`,
      correction: 'standard' as const,
      timeLimitSec: duration,
      keepTimeline: false,
    }),
    [text, duration],
  );

  // Park the result so that if this visitor later creates an account, their
  // first lesson is pitched at the speed they just demonstrated (lib/starter.ts).
  const onFinish = useCallback((r: SessionResult) => { setResult(r); saveAnonResult(r); }, []);
  const session = useTypingSession(cfg, { onFinish, soundOn: false });

  const restart = useCallback(() => {
    setResult(null);
    setSeed((s) => s + 1);
    session.restart();
  }, [session]);

  const pick = useCallback((d: Duration) => {
    setResult(null);
    setDuration(d);
  }, []);

  return (
    <PublicPage
      page={page}
      lede="Type the passage below. You get WPM, raw speed, accuracy, consistency and a per-key breakdown. Free, no sign-up, and the result never leaves your browser."
    >
      <section className="tt-test" aria-label="Typing test">
        <div className="tt-controls" role="group" aria-label="Test length">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`tt-dur${d === duration ? ' is-on' : ''}`}
              aria-pressed={d === duration}
              onClick={() => pick(d)}
            >
              {d}s
            </button>
          ))}
          <button type="button" className="tt-restart" onClick={restart}>New passage</button>
        </div>

        {!result && (
          <>
            <LiveStats engine={session.engine} showWpm />
            <div className="tt-field" onClick={session.focus}>
              <TypingText engine={session.engine} caret="bar" focused={session.focused} big onClick={session.focus} />
              <GhostInput bind={session.bindInput} />
              {!session.focused && <p className="tt-hint">Click the text, then start typing. The clock starts on your first keystroke.</p>}
            </div>
          </>
        )}

        {result && (
          <>
            <Verdict r={result} />
            <div className="tt-again">
              <button type="button" className="btn btn-primary btn-big" onClick={restart}>Test again</button>
              <Link className="btn btn-soft btn-big" to="/onboarding">Turn this into a training plan</Link>
            </div>
          </>
        )}
      </section>

      <section className="pub-section">
        <h2>How this test is calculated</h2>
        <p>
          <strong>WPM</strong> is correctly typed characters divided by five, the conventional
          definition of a word, scaled to one minute. <strong>Raw WPM</strong> applies the same
          formula to every keystroke including errors, so the gap between the two is a direct
          measure of what your mistakes cost. <strong>Accuracy</strong> is the share of keystrokes
          correct on the first attempt. <strong>Consistency</strong> is derived from the variation
          in the interval between successive keystrokes: a high score means a steady rhythm rather
          than bursts separated by stalls. A <strong>hesitation</strong> is any interval far longer
          than your own typical pace: the moment you stopped to find a key.
        </p>
        <p>
          Every one of these terms is defined in the <Link to="/typing-glossary">typing glossary</Link>.
        </p>
      </section>

      <section className="pub-section">
        <h2>What counts as a good score?</h2>
        <p>{FAQS.find((f) => f.question.startsWith('What is a good typing speed'))?.answer}</p>
      </section>

      <section className="pub-section">
        <h2>Why a test alone will not make you faster</h2>
        <p>
          Retaking a typing test measures the same skill repeatedly without changing it. Improvement
          comes from practising the specific keys and transitions that are slow, which is exactly
          what the per-key breakdown above identifies, and what the{' '}
          <Link to="/learn-to-type">adaptive method</Link> turns into practice text. Two weeks of
          fifteen focused minutes will move this number far more than two weeks of retaking the test.
        </p>
        <p className="pub-meta">
          {GLOSSARY.find((g) => g.slug === 'burst-speed')?.definition}
        </p>
      </section>

      <NextSteps items={[
        { path: '/learn-to-type', label: 'How to learn touch typing', note: 'The method, start to finish.' },
        { path: '/curriculum', label: 'The curriculum', note: 'All 41 lessons in order.' },
        { path: '/faq', label: 'FAQ', note: 'Layouts, ages, data and accessibility.' },
      ]} />
    </PublicPage>
  );
}

export default TypingTestPage;
