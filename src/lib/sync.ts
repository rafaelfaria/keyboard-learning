import type { ProfileData } from './types';

/**
 * The sync seam (docs/two-worlds-plan.md §8). KeyTopia is local-first forever:
 * the zustand store is the source of truth the UI reads and writes, and a
 * backend is a *sync target* behind this interface — never a gate the UI waits
 * on. The Supabase step implements this one interface (plus src/lib/auth.ts);
 * nothing else in the app changes.
 *
 * The instant bar (plan §8): every implementation must be fire-and-forget from
 * the caller's point of view — callers never await these on an interaction path.
 */

/** Sections of ProfileData that sync independently, diffed via `touched` stamps. */
export type SyncSection =
  | 'lessons' | 'sessions' | 'keyStats' | 'settings' | 'badges'
  | 'records' | 'xp' | 'days' | 'missions' | 'misc';

export interface Changeset {
  profileId: string;
  /** ms timestamp of the newest change included, to advance the cursor after a push */
  upTo: number;
  sections: Partial<Record<SyncSection, unknown>>;
}

export interface SyncAdapter {
  /** Fetch the server's copy (null = nothing stored yet). Merged locally via merge.ts. */
  pullProfile(profileId: string): Promise<Partial<ProfileData> | null>;
  /** Push locally-changed sections. Must be safe to retry (idempotent upserts). */
  pushChanges(changes: Changeset): Promise<void>;
}

/** The shipped default: local-only, everything is a no-op. */
export const localSync: SyncAdapter = {
  async pullProfile() { return null; },
  async pushChanges() { /* local-first: nothing to do */ },
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
  grab('lessons', d.lessons);
  grab('sessions', d.sessions);
  grab('keyStats', d.keyStats);
  grab('settings', d.settings);
  grab('badges', d.badges);
  grab('records', d.records);
  grab('xp', d.xp);
  grab('days', d.days);
  grab('missions', d.missions);
  return Object.keys(sections).length ? { profileId, upTo, sections } : null;
}

/** The active adapter. Swapped for the Supabase implementation later. */
export const sync: SyncAdapter = localSync;
