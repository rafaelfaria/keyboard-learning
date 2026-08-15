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

function Verdict({ r }: { r: SessionResult }) {
  const worst = Object.entries(r.keyAgg)
    .filter(([k, s]) => k.trim() && s.a >= 3)
    .map(([k, s]) => ({ key: k, errRate: s.e / s.a, ms: s.n ? s.ms / s.n : 0 }))
    .sort((a, b) => b.errRate - a.errRate || b.ms - a.ms)
    .slice(0, 5);

  const gap = Math.max(0, Math.round((r.raw - r.wpm) * 10) / 10);

  return (
    <section className="tt-results" aria-live="polite">
      <h2>Your result</h2>
      <div className="tt-score-row">
        <div className="tt-score tt-score-main"><b>{r.wpm}</b><span>WPM</span></div>
        <div className="tt-score"><b>{r.acc}%</b><span>accuracy</span></div>
        <div className="tt-score"><b>{r.raw}</b><span>raw WPM</span></div>
        <div className="tt-score"><b>{r.consistency}</b><span>consistency</span></div>
        <div className="tt-score"><b>{r.hesitations}</b><span>hesitations</span></div>
      </div>

      <p className="tt-read">
        You typed {r.correct} correct characters in {r.seconds} seconds, with {r.uncorrected}{' '}
        {r.uncorrected === 1 ? 'error' : 'errors'} left uncorrected and {r.backspaces}{' '}
        {r.backspaces === 1 ? 'backspace' : 'backspaces'}.
        {gap > 0.5 && ` The ${gap} WPM gap between your raw and net speed is the cost of your mistakes — closing it is usually faster than typing harder.`}
        {r.consistency < 60 && ' Your pace varies a lot between keystrokes; steady rhythm is where the next gain is.'}
        {r.acc < 95 && ' Accuracy below 95% means practice is reinforcing errors. Slow down about 10% until it recovers.'}
        {r.acc >= 97 && r.consistency >= 70 && ' Accuracy and rhythm are both strong — you have earned the right to push pace.'}
      </p>

      {worst.length > 0 && (
        <div className="tt-keys">
          <h3>Keys that cost you the most</h3>
          <ul>
            {worst.map((k) => (
              <li key={k.key}>
                <kbd>{k.key === ' ' ? 'space' : k.key}</kbd>
                <span>{Math.round(k.errRate * 100)}% error rate · {Math.round(k.ms)}ms average</span>
              </li>
            ))}
          </ul>
          <p className="pub-meta">
            A test measures; it does not teach. <Link to="/onboarding">Start a session</Link> and
            these exact keys become the practice text.
          </p>
        </div>
      )}

      {r.slowPairs.length > 0 && (
        <div className="tt-keys">
          <h3>Slowest transitions</h3>
          <ul>
            {r.slowPairs.map(([pair, ms]) => (
              <li key={pair}><kbd>{pair}</kbd><span>{Math.round(ms)}ms between the two keys</span></li>
            ))}
          </ul>
        </div>
      )}
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
      lede="Type the passage below. You get WPM, raw speed, accuracy, consistency and a per-key breakdown — free, no sign-up, and the result never leaves your browser."
      wide
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
              {!session.focused && <p className="tt-hint">Click the text, then start typing — the clock starts on your first keystroke.</p>}
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
          <strong>WPM</strong> is correctly typed characters divided by five — the conventional
          definition of a word — scaled to one minute. <strong>Raw WPM</strong> applies the same
          formula to every keystroke including errors, so the gap between the two is a direct
          measure of what your mistakes cost. <strong>Accuracy</strong> is the share of keystrokes
          correct on the first attempt. <strong>Consistency</strong> is derived from the variation
          in the interval between successive keystrokes: a high score means a steady rhythm rather
          than bursts separated by stalls. A <strong>hesitation</strong> is any interval far longer
          than your own typical pace — the moment you stopped to find a key.
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
          comes from practising the specific keys and transitions that are slow — which is exactly
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
