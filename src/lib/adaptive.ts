import type { KeyMastery, KeyStat, ProfileData, SessionMode } from './types';
import { COMMON_WORDS, KID_WORDS, SENTENCES, KID_SENTENCES, PARAGRAPHS, WORK_TEXTS, CODE_SNIPPETS, TRICKY_WORDS, ZEN_LINES, numberDrill } from './words';
import { mulberry32, pick, pickN, shuffle, weightedPick, type Rng } from './rng';
import { median } from './metrics';
import { allLessons, knownKeysAt } from './curriculum';

export function mergeKeyStats(base: Record<string, KeyStat>, agg: Record<string, KeyStat>): void {
  for (const [k, s] of Object.entries(agg)) {
    const cur = base[k] ?? { a: 0, e: 0, ms: 0, n: 0 };
    const a = cur.a + s.a;
    const e = cur.e + s.e;
    let ms = cur.ms;
    if (s.n > 0) {
      const w = Math.min(0.5, s.n / Math.max(1, cur.n + s.n));
      ms = cur.ms === 0 ? s.ms : cur.ms * (1 - w) + s.ms * w;
    }
    base[k] = { a, e, ms: Math.round(ms), n: cur.n + s.n };
  }
}

export function globalMedianMs(stats: Record<string, KeyStat>): number {
  const vals = Object.values(stats).filter((s) => s.n >= 5 && s.ms > 0).map((s) => s.ms);
  return vals.length ? median(vals) : 350;
}

export function masteryOf(stat: KeyStat | undefined, medMs: number): KeyMastery {
  if (!stat || stat.a === 0) return 'new';
  const err = stat.e / Math.max(1, stat.a);
  if (stat.a < 15) return 'learning';
  if (err > 0.14) return 'review';
  if (err <= 0.03 && stat.ms > 0 && stat.ms <= medMs * 1.15 && stat.a >= 50) return 'mastered';
  if (err <= 0.06 && stat.ms <= medMs * 1.45) return 'reliable';
  return 'improving';
}

export const MASTERY_META: Record<KeyMastery, { label: string; weather: string; color: string }> = {
  new:       { label: 'Not met yet', weather: 'cloud-fog', color: 'var(--m-new)' },
  learning:  { label: 'Learning',    weather: 'cloud-drizzle', color: 'var(--m-learning)' },
  improving: { label: 'Improving',   weather: 'cloud', color: 'var(--m-improving)' },
  reliable:  { label: 'Reliable',    weather: 'cloud-sun', color: 'var(--m-reliable)' },
  mastered:  { label: 'Mastered',    weather: 'sun', color: 'var(--m-mastered)' },
  review:    { label: 'Needs review',weather: 'cloud-rain', color: 'var(--m-review)' },
};

export interface WeakKey { key: string; err: number; ms: number; n: number; score: number }

export function weakKeys(stats: Record<string, KeyStat>, minAttempts = 8): WeakKey[] {
  const medMs = globalMedianMs(stats);
  const out: WeakKey[] = [];
  for (const [k, s] of Object.entries(stats)) {
    if (s.a < minAttempts || !/^[a-z0-9;,.'\-/[\]=`\\]$/.test(k)) continue;
    const err = s.e / Math.max(1, s.a);
    const slow = s.ms > 0 ? Math.max(0, s.ms / medMs - 1) : 0;
    const score = err * 3 + Math.min(1.2, slow);
    if (score > 0.08) out.push({ key: k, err, ms: s.ms, n: s.a, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function handBalance(stats: Record<string, KeyStat>, layoutLookup: (c: string) => { hand: string }): { left: number; right: number } {
  let l = 0; let le = 0; let r = 0; let re = 0;
  for (const [k, s] of Object.entries(stats)) {
    if (!/[a-z]/.test(k)) continue;
    const h = layoutLookup(k).hand;
    if (h === 'left') { l += s.a; le += s.e; } else if (h === 'right') { r += s.a; re += s.e; }
  }
  return {
    left: l ? Math.round((1 - le / l) * 1000) / 10 : 0,
    right: r ? Math.round((1 - re / r) * 1000) / 10 : 0,
  };
}

export interface GeneratedText { text: string; why: string; label: string }

function poolFor(data: ProfileData): string[] {
  return data.profile.ageGroup === 'kid' ? [...KID_WORDS, ...COMMON_WORDS.slice(0, 220)] : COMMON_WORDS;
}

function drillChunk(rng: Rng, weak: WeakKey[]): string {
  const parts: string[] = [];
  for (const w of weak.slice(0, 2)) {
    const k = w.key;
    if (!/[a-z]/.test(k)) continue;
    parts.push(pick(rng, [`${k}${k}${k}`, `${k}a${k}`, `${k}e${k}`, `${k}s${k}`]));
  }
  return parts.join(' ');
}

export function buildAdaptiveText(data: ProfileData, seed?: number): GeneratedText {
  const rng = mulberry32(seed ?? Math.floor(Math.random() * 1e9));
  const weak = weakKeys(data.keyStats);
  const pool = poolFor(data);
  const kid = data.profile.ageGroup === 'kid';
  const targetLen = kid ? 18 : 30;

  if (!weak.length) {
    const ws = pickN(rng, pool, targetLen);
    return {
      text: ws.join(' '),
      why: 'No clear weak keys right now: this is a balanced set of common words to keep your whole map warm.',
      label: 'Balanced practice',
    };
  }
  const focus = weak.slice(0, 4);
  const focusSet = new Set(focus.map((w) => w.key));
  const scored = pool.map((w) => {
    let hits = 0;
    for (const c of w) if (focusSet.has(c)) hits++;
    return { w, hits };
  });
  const words: string[] = [];
  for (let i = 0; i < targetLen; i++) {
    if (i % 8 === 5) {
      const d = drillChunk(rng, focus);
      if (d) { words.push(d); continue; }
    }
    const wantFocus = rng() < 0.6;
    const cand = wantFocus ? scored.filter((s) => s.hits > 0) : scored;
    const src = cand.length ? cand : scored;
    words.push(weightedPick(rng, src, (s) => 1 + s.hits * 3).w);
  }
  const names = focus.map((f) => f.key.toUpperCase()).join(', ');
  const worst = focus[0];
  const why = `Built for you: extra reps on ${names}. ${worst.key.toUpperCase()} is your current focus. ${Math.round(worst.err * 100)}% miss rate over your last ${worst.n} attempts${worst.ms ? ` and ${Math.round(worst.ms)}ms average response` : ''}.`;
  return { text: shuffle(rng, words).join(' ').replace(/\s+/g, ' ').trim(), why, label: `Focus: ${names}` };
}

export function buildWeakKeyWorkout(data: ProfileData, seed?: number): GeneratedText {
  const rng = mulberry32(seed ?? Math.floor(Math.random() * 1e9));
  const weak = weakKeys(data.keyStats);
  if (!weak.length) return buildAdaptiveText(data, seed);
  const k = weak[0].key;
  const pool = poolFor(data).filter((w) => w.includes(k));
  const drills: string[] = [];
  for (let i = 0; i < 4; i++) drills.push(pick(rng, [`${k}${k}${k}`, `${k}a${k} a${k}a`, `${k}e ${k}i ${k}o`]));
  const ws = pool.length >= 5 ? pickN(rng, pool, Math.min(14, pool.length)) : pickN(rng, TRICKY_WORDS, 8);
  const text = [drills[0], ...ws.slice(0, 5), drills[1], ...ws.slice(5, 10), drills[2], ...ws.slice(10)].join(' ');
  return {
    text: text.replace(/\s+/g, ' ').trim(),
    why: `A concentrated workout for ${k.toUpperCase()}. ${Math.round(weak[0].err * 100)}% of your recent ${k.toUpperCase()} presses missed. Slow down 10% and aim for zero misses.`,
    label: `Weak key: ${k.toUpperCase()}`,
  };
}

export function buildModeText(mode: SessionMode, data: ProfileData, opts?: { seconds?: number; seed?: number; custom?: string }): GeneratedText {
  const rng = mulberry32(opts?.seed ?? Math.floor(Math.random() * 1e9));
  const kid = data.profile.ageGroup === 'kid';
  const sent = kid ? KID_SENTENCES : SENTENCES;
  switch (mode) {
    case 'adaptive': return buildAdaptiveText(data, opts?.seed);
    case 'weakkeys': return buildWeakKeyWorkout(data, opts?.seed);
    case 'speed': {
      const secs = opts?.seconds ?? 60;
      const count = Math.max(40, Math.round((secs / 60) * 140));
      const ws: string[] = [];
      const pool = poolFor(data);
      for (let i = 0; i < count; i++) ws.push(pick(rng, pool));
      return { text: ws.join(' '), why: 'Common words, endless stream. Pure speed measurement.', label: `${secs}s sprint` };
    }
    case 'accuracy': {
      const s = pickN(rng, sent, 3).join(' ');
      return { text: s, why: 'Scored on precision. Speed is ignored: every clean character builds your streak.', label: 'Accuracy Lab' };
    }
    case 'rhythm': {
      const pool = poolFor(data).filter((w) => w.length >= 3 && w.length <= 6);
      return { text: pickN(rng, pool, kid ? 16 : 26).join(' '), why: 'Evenly sized words. Try to make every keystroke land on the pulse.', label: 'Rhythm ride' };
    }
    case 'zen': {
      const lines = shuffle(rng, ZEN_LINES).join(' · ');
      return { text: lines, why: 'No score chasing here. Just you, the keys, and a quiet line of words.', label: 'Zen garden' };
    }
    case 'endurance': {
      const ps = pickN(rng, PARAGRAPHS, 3).join(' ');
      return { text: ps, why: 'A long passage. The goal is a steady pace from the first line to the last.', label: 'The long walk' };
    }
    case 'realworld': {
      return { text: pick(rng, WORK_TEXTS), why: 'Practical, workplace-style writing: emails, notes and updates.', label: 'Real-world typing' };
    }
    case 'code': {
      const s = pick(rng, CODE_SNIPPETS);
      return { text: s.text, why: `${s.label}. Brackets, symbols and indentation: indentation after a new line is filled in for you.`, label: s.label };
    }
    case 'numbers': {
      return { text: numberDrill(rng, kid ? 12 : 20), why: 'Number-row control: quantities, times and decimals.', label: 'Numeral Peaks drill' };
    }
    case 'dictation': {
      const s = pickN(rng, sent, 2).join(' ');
      return { text: s, why: 'Listen and type. Replay as often as you need: spelling from sound builds deep recall.', label: 'Dictation' };
    }
    case 'blind': {
      const pool = poolFor(data);
      return { text: pickN(rng, pool, kid ? 14 : 22).join(' '), why: 'The on-screen keyboard fades as you go. Trust your fingers: they know the way.', label: 'Lights out' };
    }
    case 'recovery': {
      const pool = poolFor(data);
      const mix: string[] = [];
      for (let i = 0; i < (kid ? 12 : 18); i++) {
        mix.push(i % 4 === 2 ? pick(rng, TRICKY_WORDS) : pick(rng, pool));
      }
      return { text: mix.join(' '), why: 'Tricky words are planted on purpose. When you miss one: exhale, fix it calmly, and rebuild your rhythm within three words.', label: 'Recovery training' };
    }
    case 'checkpoint': {
      // Camp checkpoint (plan §2.6): spaced retrieval over everything learned so
      // far — only keys the learner has actually been introduced to appear.
      const layout = data.profile.layout;
      const done = allLessons(layout).filter((l) => (data.lessons[l.id]?.stars ?? 0) >= 1);
      const last = done[done.length - 1];
      const known = last ? new Set(knownKeysAt(layout, last.id)) : null;
      const base = poolFor(data);
      const pool = known ? base.filter((w) => [...w].every((c) => known.has(c))) : base.slice(0, 60);
      const n = kid ? 16 : 24;
      const ws = pool.length >= 8 ? pickN(rng, pool, Math.min(n, pool.length)) : pickN(rng, base, n);
      return {
        text: shuffle(rng, ws).join(' '),
        why: 'Camp checkpoint: a calm mixed review of every key you\'ve learned so far. Coming back to old ground is exactly what makes it stick.',
        label: 'Camp checkpoint',
      };
    }
    case 'copy': {
      return { text: (opts?.custom ?? '').replace(/\s+/g, ' ').trim(), why: 'Your own text. It stays on this device and is never uploaded.', label: 'Copy desk' };
    }
    default: {
      return { text: pickN(rng, sent, 2).join(' '), why: 'A balanced passage.', label: 'Practice' };
    }
  }
}

export function fingerStats(stats: Record<string, KeyStat>, lookup: (c: string) => { finger: number }): { finger: number; acc: number; n: number; ms: number }[] {
  const agg: Record<number, { a: number; e: number; ms: number; n: number }> = {};
  for (const [k, s] of Object.entries(stats)) {
    if (!/^[a-z;,./'[\]0-9-]$/.test(k)) continue;
    const f = lookup(k).finger;
    if (f < 0 || f > 7) continue;
    const cur = agg[f] ?? { a: 0, e: 0, ms: 0, n: 0 };
    cur.a += s.a; cur.e += s.e;
    if (s.ms > 0) { cur.ms += s.ms * s.n; cur.n += s.n; }
    agg[f] = cur;
  }
  return Object.entries(agg).map(([f, v]) => ({
    finger: Number(f),
    acc: v.a ? Math.round((1 - v.e / v.a) * 1000) / 10 : 0,
    n: v.a,
    ms: v.n ? Math.round(v.ms / v.n) : 0,
  })).sort((a, b) => a.finger - b.finger);
}
