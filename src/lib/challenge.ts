import { mulberry32, hashStr, pick, pickN, avatarIndexFor, type Rng } from './rng';
import { dayKey, weekKey } from './metrics';
import type { AgeGroup, Mission, ProfileData } from './types';
import { SENTENCES, KID_SENTENCES, PARAGRAPHS, RACER_NAMES, CLASSMATE_NAMES } from './words';

export interface DailySpec {
  key: string;
  title: string;
  desc: string;
  mode: 'speed' | 'accuracy' | 'rhythm';
  text: string;
  icon: string;
}

export function dailyChallenge(age: AgeGroup, date = new Date()): DailySpec {
  const key = dayKey(date);
  const rng = mulberry32(hashStr(`keytopia-daily-${key}`));
  const kinds: DailySpec['mode'][] = ['speed', 'accuracy', 'rhythm'];
  const mode = kinds[Math.floor(rng() * kinds.length)];
  const pool = age === 'kid' ? KID_SENTENCES : SENTENCES;
  const text = mode === 'speed'
    ? pickN(rng, pool, 3).join(' ')
    : mode === 'accuracy'
      ? pickN(rng, pool, 2).join(' ')
      : pick(rng, PARAGRAPHS).split(/(?<=\.)\s+/).slice(0, 2).join(' ');
  const titles = {
    speed: ['The Morning Sprint', 'Comet Run', 'Lightline Dash'],
    accuracy: ['The Steady Path', 'Glass Bridge', 'Still Waters Trial'],
    rhythm: ['The Drumline', 'Tide Walker', 'Pulse of the Roads'],
  };
  const descs = {
    speed: 'Fastest clean run wins the day. Accuracy below 92% is capped on the board.',
    accuracy: 'Precision scoring: every error costs more than any speed gains.',
    rhythm: 'Smoothest rhythm score tops today\'s board. Even beats fast.',
  };
  return {
    key,
    mode,
    title: pick(rng, titles[mode]),
    desc: descs[mode],
    text: age === 'kid' ? text.split(' ').slice(0, 24).join(' ') : text,
    icon: mode === 'speed' ? 'zap' : mode === 'accuracy' ? 'target' : 'waves',
  };
}

export interface BoardRow { name: string; avatar: string; wpm: number; acc: number; score: number; you?: boolean }

/** Deterministic, age-divided daily board with the user's result merged in. */
export function dailyBoard(age: AgeGroup, spec: DailySpec, you?: { name: string; avatar: string; wpm: number; acc: number }): BoardRow[] {
  const rng = mulberry32(hashStr(`board-${spec.key}-${age}`));
  const base = age === 'kid' ? 16 : age === 'teen' ? 34 : 42;
  const names = age === 'kid' ? CLASSMATE_NAMES : RACER_NAMES;
  const rows: BoardRow[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const wpm = Math.max(6, Math.round(base + (rng() - 0.35) * 38));
    const acc = Math.round(90 + rng() * 9.5);
    const score = scoreFor(spec.mode, wpm, acc, 55 + rng() * 40);
    const nm = pick(rng, names) + (age === 'kid' ? '' : String(Math.floor(rng() * 89) + 10));
    rows.push({ name: nm, avatar: `bk:${avatarIndexFor(nm)}`, wpm, acc, score });
  }
  if (you) {
    rows.push({ ...you, score: scoreFor(spec.mode, you.wpm, you.acc, 70), you: true });
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, 15);
}

export function scoreFor(mode: DailySpec['mode'], wpm: number, acc: number, rhythm: number): number {
  if (mode === 'accuracy') return Math.round(acc * 10 + Math.min(wpm, 40));
  if (mode === 'rhythm') return Math.round(rhythm * 8 + wpm + acc);
  const capped = acc < 92 ? wpm * 0.6 : wpm;
  return Math.round(capped * 10 + acc);
}

// ---------- Weekly missions ----------

const MISSION_TEMPLATES: ((age: AgeGroup, rng: Rng) => Mission)[] = [
  (age, rng) => {
    const days = age === 'kid' ? 3 : 4;
    return { id: 'days', label: `Practise on ${days} different days`, goal: days, progress: 0, done: false, icon: 'calendar-check' };
  },
  (age) => {
    const mins = age === 'kid' ? 20 : 40;
    return { id: 'minutes', label: `Train for ${mins} minutes in total`, goal: mins, progress: 0, done: false, icon: 'timer' };
  },
  (age) => {
    const words = age === 'kid' ? 150 : 400;
    return { id: 'cleanwords', label: `Type ${words} words in 95%+ sessions`, goal: words, progress: 0, done: false, icon: 'target' };
  },
  () => ({ id: 'lessons', label: 'Complete 3 lessons', goal: 3, progress: 0, done: false, icon: 'book' }),
  () => ({ id: 'race', label: 'Finish 2 races', goal: 2, progress: 0, done: false, icon: 'rocket' }),
  () => ({ id: 'game', label: 'Play 2 arcade games', goal: 2, progress: 0, done: false, icon: 'gamepad' }),
  () => ({ id: 'weak', label: 'Do 2 weak-key workouts', goal: 2, progress: 0, done: false, icon: 'dumbbell' }),
];

export function rollMissions(age: AgeGroup, date = new Date()): { week: string; list: Mission[] } {
  const wk = weekKey(date);
  const rng = mulberry32(hashStr(`missions-${wk}`));
  const picks = pickN(rng, MISSION_TEMPLATES, 3);
  return { week: wk, list: picks.map((f) => f(age, rng)) };
}

// ---------- CPU racers ----------

export interface RacerSpec {
  name: string;
  avatar: string;
  baseWpm: number;
  volatility: number;   // 0..1 pace noise
  stumbleRate: number;  // pauses per minute
  sprintFinish: boolean;
  personality: string;
}

export const CPU_LEVELS = [
  { id: 'beginner', name: 'Beginner', wpm: 15, desc: 'Gentle pace, frequent wobbles' },
  { id: 'casual', name: 'Casual', wpm: 28, desc: 'Everyday typist energy' },
  { id: 'skilled', name: 'Skilled', wpm: 45, desc: 'Confident and steady' },
  { id: 'expert', name: 'Expert', wpm: 70, desc: 'Relentless. Bring your best' },
  { id: 'adaptive', name: 'Adaptive', wpm: 0, desc: 'Matches your recent average' },
] as const;

export function makeRacers(rng: Rng, targetWpm: number, count = 3): RacerSpec[] {
  const personalities = ['steady', 'streaky', 'slow starter', 'front runner'];
  const names = pickN(rng, RACER_NAMES, count);
  return names.map((name, i) => {
    const p = pick(rng, personalities);
    return {
      name,
      avatar: `bk:${avatarIndexFor(name)}`,
      baseWpm: Math.max(8, targetWpm + (rng() - 0.5) * targetWpm * 0.28),
      volatility: p === 'streaky' ? 0.45 : 0.22,
      stumbleRate: p === 'steady' ? 1.2 : 2.6,
      sprintFinish: p === 'front runner' || rng() > 0.6,
      personality: p,
    };
  });
}

export function recentAvgWpm(data: ProfileData): number {
  const rs = data.sessions.filter((s) => s.typed > 30).slice(-8);
  if (!rs.length) return data.assessment?.wpm ?? 20;
  return rs.reduce((a, s) => a + s.wpm, 0) / rs.length;
}

// ---------- Simulated friends/classroom feed ----------

export function activityFeed(age: AgeGroup): { name: string; avatar: string; what: string; when: string }[] {
  const rng = mulberry32(hashStr(dayKey() + '-feed'));
  const names = age === 'kid' ? CLASSMATE_NAMES : RACER_NAMES;
  const whats = [
    'earned the Steady Hand badge',
    'set a new personal best: 41 WPM',
    'finished the Heartlands region',
    'won a comet race',
    'completed a 7-day streak',
    'mastered the letter R',
  ];
  return pickN(rng, names, 4).map((name) => ({
    name,
    avatar: `bk:${avatarIndexFor(name)}`,
    what: pick(rng, whats),
    when: `${Math.floor(rng() * 5) + 1}h ago`,
  }));
}
