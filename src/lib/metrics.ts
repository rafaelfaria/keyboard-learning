export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
}

/** Filter inter-key intervals to "flow" strokes (drop long thinking pauses). */
export function flowIkis(ikis: number[]): number[] {
  return ikis.filter((x) => x > 15 && x < 2000);
}

/** 0..100 — how even the keystroke intervals are. */
export function consistencyScore(ikis: number[]): number {
  const f = flowIkis(ikis);
  if (f.length < 6) return 0;
  const cv = stddev(f) / Math.max(1, mean(f));
  return Math.round(Math.max(0, Math.min(100, 100 * (1 - cv / 1.15))));
}

export function hesitationCount(ikis: number[]): number {
  const f = ikis.filter((x) => x > 15);
  if (f.length < 4) return 0;
  const med = median(f);
  return f.filter((x) => x > Math.max(650, med * 3)).length;
}

/** 0..100 — consistency penalised by hesitation frequency. */
export function rhythmScore(ikis: number[]): number {
  const f = ikis.filter((x) => x > 15);
  if (f.length < 6) return 0;
  const cons = consistencyScore(ikis);
  const hes = hesitationCount(ikis) / f.length;
  return Math.round(Math.max(0, Math.min(100, cons * (1 - hes * 1.6))));
}

export function wpmOf(correctChars: number, ms: number): number {
  if (ms <= 500) return 0;
  return Math.max(0, (correctChars / 5) / (ms / 60000));
}

export function round1(x: number): number { return Math.round(x * 10) / 10; }

export function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function dayKey(t: number | Date = new Date()): string {
  const d = typeof t === 'number' ? new Date(t) : t;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekKey(t: number | Date = new Date()): string {
  const d = typeof t === 'number' ? new Date(t) : new Date(t.getTime());
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setDate(d.getDate() - day);
  return dayKey(d);
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function relTime(t: number): string {
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Current streak of consecutive active days ending today or yesterday. */
export function streakFrom(days: Record<string, number>): number {
  let streak = 0;
  const today = new Date();
  const todayActive = (days[dayKey(today)] ?? 0) > 0;
  let cursor = new Date(today);
  if (!todayActive) cursor.setDate(cursor.getDate() - 1);
  while ((days[dayKey(cursor)] ?? 0) > 0) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export const RANK_TIERS = [
  { name: 'Sprout', min: 0 },
  { name: 'Wanderer', min: 8 },
  { name: 'Pathfinder', min: 15 },
  { name: 'Skimmer', min: 22 },
  { name: 'Glider', min: 30 },
  { name: 'Voyager', min: 40 },
  { name: 'Falcon', min: 52 },
  { name: 'Tempest', min: 66 },
  { name: 'Luminary', min: 82 },
  { name: 'Mythic', min: 100 },
];

export function rankOf(wpm: number, acc: number): string {
  const score = wpm * Math.pow(Math.max(0.5, acc / 100), 2);
  let tier = RANK_TIERS[0];
  let idx = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (score >= RANK_TIERS[i].min) { tier = RANK_TIERS[i]; idx = i; }
  }
  const next = RANK_TIERS[idx + 1]?.min ?? tier.min * 1.4;
  const span = Math.max(1, next - tier.min);
  const within = (score - tier.min) / span;
  const sub = within < 0.34 ? 'I' : within < 0.67 ? 'II' : 'III';
  return `${tier.name} ${sub}`;
}

export function xpForLevel(level: number): number {
  return Math.round(120 * Math.pow(level, 1.42));
}

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = xp;
  while (rest >= xpForLevel(level) && level < 99) {
    rest -= xpForLevel(level);
    level++;
  }
  return { level, into: rest, need: xpForLevel(level) };
}
