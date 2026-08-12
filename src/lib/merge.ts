import type { LessonProgress, ProfileData, SessionResult } from './types';

/**
 * Merge semantics for profile data (docs/two-worlds-plan.md §8) — defined now,
 * while the shapes are settled, because they are the part of a sync layer that
 * hurts to retrofit. The same rules serve three moments:
 *   1. first sign-in upload of an existing local profile,
 *   2. multi-device reconciliation,
 *   3. server pull applied after boot (patching in quietly, post-paint).
 * Conflicts never ask the user (the instant bar): every rule is automatic.
 */

/** Sessions are append-only: union by id, newest last, capped like the store. */
export function mergeSessions(local: SessionResult[], remote: SessionResult[], cap = 400): SessionResult[] {
  const byId = new Map<string, SessionResult>();
  for (const s of [...remote, ...local]) if (s?.id) byId.set(s.id, s);
  const all = [...byId.values()].sort((a, b) => a.endedAt - b.endedAt);
  return all.slice(Math.max(0, all.length - cap));
}

/** Lesson progress: the better run wins — max stars, then max wpm. */
export function mergeLessons(
  local: Record<string, LessonProgress>, remote: Record<string, LessonProgress>,
): Record<string, LessonProgress> {
  const out: Record<string, LessonProgress> = { ...remote };
  for (const [id, l] of Object.entries(local)) {
    const r = out[id];
    out[id] = !r || l.stars > r.stars || (l.stars === r.stars && l.wpm >= r.wpm) ? l : r;
  }
  return out;
}

/** Badges/unlocks are sets: union, keeping the earliest unlock time. */
export function mergeBadges(local: Record<string, number>, remote: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...remote };
  for (const [id, t] of Object.entries(local)) out[id] = out[id] ? Math.min(out[id], t) : t;
  return out;
}

/** Records: the best value wins per key. */
export function mergeRecords(
  local: ProfileData['records'], remote: ProfileData['records'],
): ProfileData['records'] {
  const out: ProfileData['records'] = { ...remote };
  for (const [k, r] of Object.entries(local)) if (!out[k] || r.v > out[k].v) out[k] = r;
  return out;
}

/** Practice-minutes calendar: per-day max (double-counting would inflate streaks). */
export function mergeDays(local: Record<string, number>, remote: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...remote };
  for (const [k, v] of Object.entries(local)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

/**
 * Whole-profile merge. Sections without natural merge rules (settings,
 * keyStats, missions) are last-write-wins by their `touched` stamp — the
 * aggregates rebuild from real typing quickly, so LWW is safe there.
 */
export function mergeProfileData(local: ProfileData, remote: Partial<ProfileData>): ProfileData {
  const lt = local.touched ?? {};
  const rt = remote.touched ?? {};
  const lww = <K extends keyof ProfileData>(key: K, section: string): ProfileData[K] =>
    ((rt[section] ?? 0) > (lt[section] ?? 0) && remote[key] !== undefined ? remote[key] : local[key]) as ProfileData[K];

  return {
    ...local,
    sessions: mergeSessions(local.sessions, remote.sessions ?? []),
    lessons: mergeLessons(local.lessons, remote.lessons ?? {}),
    badges: mergeBadges(local.badges, remote.badges ?? {}),
    records: mergeRecords(local.records, remote.records ?? {}),
    days: mergeDays(local.days, remote.days ?? {}),
    xp: Math.max(local.xp, remote.xp ?? 0),
    unlockedThemes: [...new Set([...local.unlockedThemes, ...(remote.unlockedThemes ?? [])])],
    unlockedAvatars: [...new Set([...local.unlockedAvatars, ...(remote.unlockedAvatars ?? [])])],
    settings: lww('settings', 'settings'),
    keyStats: lww('keyStats', 'keyStats'),
    missions: lww('missions', 'missions'),
    touched: Object.fromEntries(
      [...new Set([...Object.keys(lt), ...Object.keys(rt)])].map((k) => [k, Math.max(lt[k] ?? 0, rt[k] ?? 0)]),
    ),
  };
}
