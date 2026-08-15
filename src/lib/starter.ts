import type { AgeGroup, AssessmentResult, SessionResult } from './types';
import { rankOf } from './metrics';

/**
 * The bridge between the open web and an account.
 *
 * KeyTopia's public pages (/typing-test and friends) are usable by anyone with
 * no sign-up at all. When a visitor takes the test there and later creates an
 * account, throwing that result away would be rude — they just told us exactly
 * how fast they type. So the last public result is parked here and, if it is
 * still fresh, quietly seeds the new profile's starting level.
 *
 * Deliberately quiet: nothing in the UI announces "we saved your anonymous
 * result". It simply means the first lesson is pitched correctly.
 */

const ANON_KEY = 'keytopia-anon-v1';
/** Older than this and it probably isn't the same person at the same keyboard. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface AnonResult { wpm: number; acc: number; consistency: number; t: number }

export function saveAnonResult(r: SessionResult): void {
  try {
    // Only a summary — never the keystroke timeline. There is no account to own
    // this yet, so it stays as small and impersonal as possible.
    const a: AnonResult = { wpm: r.wpm, acc: r.acc, consistency: r.consistency, t: Date.now() };
    localStorage.setItem(ANON_KEY, JSON.stringify(a));
  } catch { /* private mode */ }
}

export function readAnonResult(): AnonResult | null {
  try {
    const raw = localStorage.getItem(ANON_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as AnonResult;
    if (!a?.wpm || Date.now() - a.t > MAX_AGE_MS) return null;
    return a;
  } catch { return null; }
}

export function clearAnonResult(): void {
  try { localStorage.removeItem(ANON_KEY); } catch { /* ignore */ }
}

/** Curriculum stage implied by a typing speed — the same ladder the placement test uses. */
function stageFor(wpm: number): number {
  if (wpm < 12) return 0;
  if (wpm < 20) return 1;
  if (wpm < 30) return 2;
  if (wpm < 40) return 3;
  if (wpm < 55) return 4;
  return 5;
}

/**
 * A starting point for a brand-new profile, without making anyone sit a test
 * first. Uses a real public-test result when we have one, otherwise a gentle
 * default pitched by age — erring slow, because starting too easy is a pleasant
 * surprise and starting too hard makes a beginner quit.
 */
export function starterAssessment(age: AgeGroup, anon: AnonResult | null): AssessmentResult {
  const base = anon
    ? { wpm: anon.wpm, acc: anon.acc, consistency: anon.consistency, reaction: 380 }
    : age === 'kid'
      ? { wpm: 8, acc: 90, consistency: 40, reaction: 560 }
      : age === 'teen'
        ? { wpm: 20, acc: 92, consistency: 45, reaction: 420 }
        : { wpm: 24, acc: 93, consistency: 45, reaction: 400 };

  return {
    wpm: base.wpm, raw: base.wpm + 2, acc: base.acc,
    consistency: base.consistency, rhythm: base.consistency,
    reactionMs: base.reaction, backspaceRate: 4, hesitationRate: 4,
    weakKeys: [], slowKeys: [], weakPairs: [], likelyLooking: false,
    level: stageFor(base.wpm), rank: rankOf(base.wpm, base.acc),
    insight: anon
      ? 'We pitched your plan from the typing test you already took. Retake the full placement any time from Train to sharpen it around your actual keys.'
      : 'A balanced starting plan. Take the placement test from Train whenever you want it tuned to your real keys.',
    t: Date.now(),
  };
}
