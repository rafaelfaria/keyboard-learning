import type { ProfileData } from './types';

/**
 * The sync seam (docs/two-worlds-plan.md §8). KeyTopia is local-first forever:
 * the zustand store is the source of truth the UI reads and writes, and a
 * backend is a *sync target* behind this interface — never a gate the UI waits
 * on. The Supabase implementation lives in ./syncSupabase; nothing else in the
 * app imports it directly.
 *
 * The instant bar (plan §8): every implementation must be fire-and-forget from
 * the caller's point of view — callers never await these on an interaction path.
 */

/** Sections of ProfileData that sync independently, diffed via `touched` stamps. */
export type SyncSection =
  | 'profile' | 'lessons' | 'sessions' | 'keyStats' | 'settings' | 'badges'
  | 'records' | 'xp' | 'days' | 'missions' | 'misc';

/**
 * Everything that has no table of its own and no special merge rule. Kept as
 * one blob column so adding a field to ProfileData never needs a migration.
 */
export const MISC_KEYS = [
  'dailyGoalMin', 'daily', 'unlockedThemes', 'unlockedAvatars', 'forge',
  'gameBests', 'race', 'ghost', 'assessment', 'planStage', 'customTexts',
  'seedCleared', 'journey',
] as const satisfies readonly (keyof ProfileData)[];

export type Misc = Partial<Pick<ProfileData, (typeof MISC_KEYS)[number]>>;

export function miscOf(d: ProfileData): Misc {
  const out: Record<string, unknown> = {};
  for (const k of MISC_KEYS) if (d[k] !== undefined) out[k] = d[k];
  return out as Misc;
}

export interface Changeset {
  profileId: string;
  /** Cursor this diff was taken against — sections stamped at or before it are skipped. */
  since: number;
  /** ms timestamp of the newest change included, to advance the cursor after a push */
  upTo: number;
  /** The full per-section stamp map, so another device can diff against it. */
  touched: Record<string, number>;
  sections: Partial<Record<SyncSection, unknown>>;
}

export interface SyncAdapter {
  /** Fetch the server's copy (null = nothing stored yet). Merged locally via merge.ts. */
  pullProfile(profileId: string): Promise<Partial<ProfileData> | null>;
  /** Push locally-changed sections. Must be safe to retry (idempotent upserts). */
  pushChanges(changes: Changeset): Promise<void>;
  /** Ids of every profile the signed-in account owns — the multi-device restore. */
  listProfileIds?(): Promise<string[]>;
}

/** The local-only default: everything is a no-op. Used when Supabase is unconfigured. */
export const localSync: SyncAdapter = {
  async pullProfile() { return null; },
  async pushChanges() { /* local-first: nothing to do */ },
  async listProfileIds() { return []; },
};

/** Collect the sections whose `touched` stamp is newer than the given cursor. */
export function collectChangeset(profileId: string, d: ProfileData, since: number): Changeset | null {
  const touched = d.touched ?? {};
  const sections: Changeset['sections'] = {};
  let upTo = since;
  const grab = (key: SyncSection, value: unknown) => {
    const t = touched[key] ?? 0;
    if (t > since) { sections[key] = value; upTo = Math.max(upTo, t); }
  };
  grab('profile', d.profile);
  grab('lessons', d.lessons);
  grab('sessions', d.sessions);
  grab('keyStats', d.keyStats);
  grab('settings', d.settings);
  grab('badges', d.badges);
  grab('records', d.records);
  grab('xp', d.xp);
  grab('days', d.days);
  grab('missions', d.missions);
  grab('misc', miscOf(d));
  return Object.keys(sections).length ? { profileId, since, upTo, touched, sections } : null;
}

/**
 * Every section, ignoring stamps — used for the very first push of a profile
 * (cursor 0). A profile created before sync existed has an empty `touched` map,
 * so a stamp-based diff would find nothing and silently never upload it.
 */
export function fullChangeset(profileId: string, d: ProfileData): Changeset {
  const stamps = Object.values(d.touched ?? {});
  return {
    profileId,
    since: 0,
    upTo: Math.max(d.profile.createdAt, ...stamps, 0),
    touched: d.touched ?? {},
    sections: {
      profile: d.profile,
      lessons: d.lessons,
      sessions: d.sessions,
      keyStats: d.keyStats,
      settings: d.settings,
      badges: d.badges,
      records: d.records,
      xp: d.xp,
      days: d.days,
      missions: d.missions,
      misc: miscOf(d),
    },
  };
}
