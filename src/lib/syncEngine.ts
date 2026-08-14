import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { watchAccount } from './account';
import { useStore, setProfileCounter } from './store';
import { collectChangeset, fullChangeset, type SyncAdapter } from './sync';
import { supabaseSync } from './syncSupabase';

/**
 * The sync engine: everything that decides *when* to talk to the server.
 *
 * It exists to satisfy the instant bar (docs/two-worlds-plan.md §8): the store
 * is written synchronously by the UI and this engine watches from the outside,
 * so no interaction ever awaits a request. Concretely —
 *
 *   - boot paints from localStorage; this starts afterwards
 *   - writes are debounced and pushed in the background
 *   - failures retry with backoff and never raise a toast
 *   - conflicts resolve through merge.ts, never by asking
 *
 * The only surface is one ambient indicator (see components/SyncPill).
 */

export type SyncStatus = 'off' | 'synced' | 'syncing' | 'offline';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  /**
   * True once the first reconcile after sign-in has finished (or failed, e.g.
   * offline). Until then the local store may simply not have this account's
   * profiles yet, so routing decisions like "no explorers -> go create one"
   * must wait rather than mistake an empty cache for a new family.
   */
  hydrated: boolean;
  /**
   * profileId -> account that owns it. Mirrored into the store so the UI can
   * react to it, because it decides *which explorers are shown*: a profile
   * belonging to another account must not appear when someone else signs in on
   * the same browser. Reading it locally keeps that decision instant and
   * correct offline.
   */
  owners: Record<string, string>;
}

// With no Supabase project there is nothing to pull, so the local cache is
// already the whole truth: hydrated from the start.
export const useSync = create<SyncState>(() => ({ status: 'off', lastSyncedAt: null, hydrated: !supabase, owners: {} }));

/**
 * Explorers this account may see: its own, plus any not yet claimed (those are
 * about to be adopted by whoever is signing in). Anything owned by a different
 * account is hidden — not deleted, and it returns the moment that account signs
 * back in.
 */
export function visibleProfileIds(all: string[], userId: string | null, owners: Record<string, string>): string[] {
  if (!userId) return [];
  return all.filter((id) => !owners[id] || owners[id] === userId);
}

// ---------------------------------------------------------------------------
// Cursors. One per profile, kept outside the persisted app store so sync
// bookkeeping can never corrupt a learner's data. `owner` records which account
// claimed the profile, so a second household signing in on a shared machine
// does not hoover up the first household's profiles.
// ---------------------------------------------------------------------------

const CURSOR_KEY = 'keytopia-sync-v1';
type Meta = { cursor: number; owner: string };

function readMeta(): Record<string, Meta> {
  try { return JSON.parse(localStorage.getItem(CURSOR_KEY) ?? '{}') as Record<string, Meta>; } catch { return {}; }
}
function writeMeta(m: Record<string, Meta>): void {
  try { localStorage.setItem(CURSOR_KEY, JSON.stringify(m)); } catch { /* private mode */ }
}
function setCursor(id: string, cursor: number, owner: string): void {
  const m = readMeta();
  m[id] = { cursor, owner };
  writeMeta(m);
  publishOwners(m);
}

/** Mirror the owner map into the reactive store so the picker re-renders. */
function publishOwners(m: Record<string, Meta> = readMeta()): void {
  const owners: Record<string, string> = {};
  for (const [id, meta] of Object.entries(m)) if (meta?.owner) owners[id] = meta.owner;
  useSync.setState({ owners });
}

// ---------------------------------------------------------------------------
// Last explorer used, per account. Keyed by owner uid so a shared browser never
// drops one household into another's profile; the value only steers routing
// after sign-in and is verified against visibleProfileIds before use.
// ---------------------------------------------------------------------------

const LAST_KEY = 'keytopia-last-profile-v1';

function readLast(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') as Record<string, string>; } catch { return {}; }
}

/** The explorer this account was using last, or null. */
export function lastProfileFor(uid: string): string | null {
  return readLast()[uid] ?? null;
}

function rememberLast(uid: string, profileId: string): void {
  const m = readLast();
  if (m[uid] === profileId) return;
  m[uid] = profileId;
  try { localStorage.setItem(LAST_KEY, JSON.stringify(m)); } catch { /* private mode */ }
}

/** Profiles this account may sync: unclaimed ones (adopt them) or its own. */
function syncable(userId: string): string[] {
  const meta = readMeta();
  return Object.keys(useStore.getState().profiles)
    .filter((id) => !meta[id]?.owner || meta[id].owner === userId);
}

// ---------------------------------------------------------------------------

let adapter: SyncAdapter | null = null;
let userId: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = 0;
/** Set while reconciling, so our own merge writes don't trigger a nested flush. */
let paused = false;
let running = false;

const DEBOUNCE_MS = 1200;
const MAX_BACKOFF_MS = 60_000;

function schedule(delay = DEBOUNCE_MS): void {
  if (!adapter || paused) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { void flush(); }, delay);
}

function onFailure(): void {
  // Transient failures are invisible: no toast, no error state in the UI beyond
  // the ambient pill going quiet.
  useSync.setState({ status: navigator.onLine ? 'syncing' : 'offline' });
  backoff = Math.min(backoff ? backoff * 2 : 2000, MAX_BACKOFF_MS);
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { void flush(); }, backoff);
}

function onSuccess(): void {
  backoff = 0;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  useSync.setState({ status: 'synced', lastSyncedAt: Date.now() });
}

/** Push every profile whose stamps have moved past its cursor. */
async function flush(): Promise<void> {
  if (!adapter || !userId || paused) return;
  const meta = readMeta();
  const profiles = useStore.getState().profiles;
  const ids = syncable(userId);

  const pending = ids
    .map((id) => {
      const d = profiles[id];
      if (!d) return null;
      const cursor = meta[id]?.cursor ?? 0;
      return cursor === 0 ? fullChangeset(id, d) : collectChangeset(id, d, cursor);
    })
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  if (!pending.length) { onSuccess(); return; }

  useSync.setState({ status: 'syncing' });
  try {
    for (const changes of pending) {
      await adapter.pushChanges(changes);
      setCursor(changes.profileId, changes.upTo, userId);
    }
    onSuccess();
  } catch {
    onFailure();
  }
}

/**
 * First contact after sign-in: pull what the account already has, merge it into
 * whatever this device holds, then push the union. This is the moment a family's
 * existing local profiles become an account, and the moment a new laptop gets
 * everything back — both fall out of the same merge functions.
 */
async function reconcile(uid: string): Promise<void> {
  if (!adapter) return;
  paused = true;
  useSync.setState({ status: 'syncing' });
  try {
    const remoteIds = adapter.listProfileIds ? await adapter.listProfileIds() : [];
    const meta = readMeta();
    const ids = [...new Set([...syncable(uid), ...remoteIds])];

    for (const id of ids) {
      // A profile owned by a different account on this shared browser stays put.
      if (meta[id]?.owner && meta[id].owner !== uid) continue;
      if (remoteIds.includes(id)) {
        const remote = await adapter.pullProfile(id);
        // Patches in quietly, after paint, through the §8 merge rules.
        if (remote) useStore.getState().applyRemoteProfile(id, remote);
      }
      if (!meta[id]?.owner) setCursor(id, 0, uid);
    }
    paused = false;
    await flush();
  } catch {
    paused = false;
    onFailure();
  } finally {
    // Even a failed pull settles the question "have we tried yet?" - routing
    // must not wait forever on a network that isn't there.
    useSync.setState({ hydrated: true });
  }
}

function onUser(user: User | null): void {
  if (user && supabase) {
    userId = user.id;
    adapter = supabaseSync(supabase);
    void reconcile(user.id);
  } else {
    // Remember who was typing so this account's next sign-in can resume there.
    const active = useStore.getState().activeId;
    if (userId && active) rememberLast(userId, active);
    userId = null;
    adapter = null;
    if (flushTimer) clearTimeout(flushTimer);
    if (retryTimer) clearTimeout(retryTimer);
    // Drop the active learner: a *different* account signing in on this browser
    // must never land inside someone else's profile. The per-account map above
    // is what lets the *same* account resume where it left off.
    useStore.getState().signOut();
    useSync.setState({ status: 'off', lastSyncedAt: null, hydrated: false });
  }
}

/**
 * Boot the engine. Called once from main.tsx *after* the first render, so the
 * app has already painted from localStorage before any of this runs.
 */
export function startSync(): () => void {
  if (!supabase || running) return () => {};
  running = true;

  publishOwners();
  setProfileCounter(() => visibleProfileIds(
    Object.keys(useStore.getState().profiles), userId, useSync.getState().owners,
  ).length);
  const stopAccount = watchAccount(onUser);
  // Any store write marks work to do; the debounce coalesces a burst of
  // keystrokes-worth of state into one request. Switching explorers also
  // updates this account's "last used" note, so a plain browser close (no
  // explicit logout) still resumes in the right place next time.
  const stopStore = useStore.subscribe((s, prev) => {
    if (userId && s.activeId && s.activeId !== prev.activeId) rememberLast(userId, s.activeId);
    schedule();
  });

  const wake = () => { if (adapter) { backoff = 0; schedule(300); } };
  window.addEventListener('online', wake);
  // Leaving the tab is the best moment to make sure the last run is safe.
  const onHide = () => { if (document.visibilityState === 'hidden') schedule(0); };
  document.addEventListener('visibilitychange', onHide);

  return () => {
    running = false;
    stopAccount();
    stopStore();
    window.removeEventListener('online', wake);
    document.removeEventListener('visibilitychange', onHide);
  };
}
