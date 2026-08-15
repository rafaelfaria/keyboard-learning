import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, authRedirectTo, SUPABASE_URL, SUPABASE_KEY } from './supabase';

/**
 * The *account* layer — deliberately separate from src/lib/auth.ts.
 *
 * Two different ideas share the word "sign in" in KeyTopia, and conflating them
 * would break the product:
 *
 *   auth.ts     the ACTIVE LEARNER. A household has several (kids + grown-ups);
 *               switching between them is one tap and no password. This is what
 *               /who drives.
 *
 *   account.ts  the HOUSEHOLD ACCOUNT in Supabase (this file). One grown-up
 *               signs in with Google or an email link, and that account *owns*
 *               the profiles. Children never sign in themselves, which is what
 *               keeps kid emails out of the product.
 *
 * The journey requires an account; the public pages (/typing-test and friends)
 * require none. A profile can never exist outside an account, which is what
 * stops "whose progress is this?" from ever being a question. Local-first
 * storage still applies underneath: writes go to localStorage and sync behind,
 * so only this sign-in handshake ever needs a connection.
 */

/**
 * Only Google today. Facebook was dropped on 2026-08-13: its two most basic
 * permissions (`email`, `public_profile`) both require Meta business
 * verification plus app review, which is a lot of friction for a third door
 * few parents would use. Adding a provider back is this union plus a button —
 * the enabled-provider probe below does the rest.
 */
export type OAuthProvider = 'google';

interface AccountState {
  /** null = signed out. undefined-ish `ready:false` = we haven't checked yet. */
  user: User | null;
  /** False only during the first session lookup at boot. Never gates the UI. */
  ready: boolean;
  /**
   * Which sign-in method is mid-handshake, or null. Not a bare boolean: the
   * buttons share this state, and a boolean made clicking Google put the *email*
   * button into its "Sending…" state.
   */
  busy: 'google' | 'email' | 'anon' | null;
  /** Human-readable problem from the last attempt, or null. */
  error: string | null;
  /** Set after a magic link is sent, so the UI can say "check your email". */
  linkSentTo: string | null;
  /**
   * Which sign-in methods the project actually has switched on, or null until
   * we've asked. The UI renders from this rather than from a hardcoded list:
   * a provider that isn't enabled would bounce the user to a raw JSON error
   * page on Supabase, and enabling one in the dashboard should light up the
   * button here with no code change.
   */
  providers: { google: boolean; email: boolean } | null;
}

export const useAccount = create<AccountState>(() => ({
  user: null,
  ready: !isSupabaseConfigured,
  busy: null,
  error: null,
  linkSentTo: null,
  providers: null,
}));

const set = useAccount.setState;

/**
 * Ask the project which providers are live. This is a public, unauthenticated
 * endpoint (the same data the hosted Supabase UI reads) and it is cheap, so it
 * runs once at boot alongside the session lookup.
 */
async function loadProviders(): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
    const json = (await res.json()) as { external?: Record<string, boolean> };
    const ext = json.external ?? {};
    set({ providers: { google: !!ext.google, email: ext.email !== false } });
  } catch {
    // Offline at boot: assume nothing is available rather than offering a
    // button that would strand the user. It resolves on the next load.
    set({ providers: { google: false, email: false } });
  }
}

/** Turn Supabase's error text into something a parent can act on. */
function readable(message: string, provider?: string): string {
  const m = message.toLowerCase();
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return `${provider ? provider[0].toUpperCase() + provider.slice(1) : 'That'} sign-in isn't switched on for this project yet.`;
  }
  if (m.includes('redirect')) return 'This address is not in the allowed redirect list for the project.';
  if (m.includes('rate') || m.includes('too many')) return 'Too many attempts just now — give it a minute.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'No connection right now. Your progress is saved on this device either way.';
  return message;
}

export const account = {
  /** The signed-in account's user id, or null. Used as `owner` for synced rows. */
  userId(): string | null {
    return useAccount.getState().user?.id ?? null;
  },

  /** Redirects the whole tab to the provider; resolves only on failure. */
  async signInWith(provider: OAuthProvider): Promise<void> {
    if (!supabase) return;
    set({ busy: provider, error: null, linkSentTo: null });
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authRedirectTo(),
        // Ask for a refresh token so returning users are not bounced to the
        // provider every hour.
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) set({ busy: null, error: readable(error.message, provider) });
    // On success the browser navigates away, so `busy` is deliberately left set:
    // the button stays in its pending state until the page unloads.
  },

  /**
   * A device-bound account with no email, no password and no PII — the kid
   * class-join door (docs/classrooms-plan.md §5). Honest limitation, stated in
   * the UI too: it lives in this browser, so a cleared browser loses the link
   * (local progress survives locally; the teacher removes the stale seat and
   * the kid rejoins). Server-side it may join classes but never own one.
   */
  async signInAnonymously(): Promise<boolean> {
    if (!supabase) return false;
    set({ busy: 'anon', error: null, linkSentTo: null });
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      set({ busy: null, error: readable(error?.message ?? 'Could not start a class session.') });
      return false;
    }
    set({ busy: null });
    return true;
  },

  /** Passwordless email. No password to forget, and none for us to store. */
  async sendMagicLink(email: string): Promise<void> {
    if (!supabase) return;
    set({ busy: 'email', error: null, linkSentTo: null });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: authRedirectTo() },
    });
    set(error
      ? { busy: null, error: readable(error.message) }
      : { busy: null, error: null, linkSentTo: email.trim() });
  },

  /**
   * Sign the household out. Cached profiles stay in localStorage rather than
   * being wiped: they belong to this account, and keeping them means signing
   * back in restores everything instantly and works offline. They are hidden
   * from anyone else (see visibleProfileIds in syncEngine).
   */
  async signOut(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ user: null, error: null, linkSentTo: null });
  },

  clearError(): void {
    set({ error: null, linkSentTo: null });
  },
};

/**
 * Start listening for session changes. Called once at boot, after first paint —
 * the local store has already rendered by then, so a returning user never waits
 * on this (the instant bar, plan §8).
 *
 * `onChange` fires with the user on sign-in and null on sign-out; the sync
 * engine subscribes to it.
 */
export function watchAccount(onChange: (user: User | null) => void): () => void {
  if (!supabase) return () => {};

  const apply = (session: Session | null) => {
    const user = session?.user ?? null;
    const prev = useAccount.getState().user;
    set({ user, ready: true, busy: null });
    if (prev?.id !== user?.id) onChange(user);
  };

  // getSession reads the persisted token synchronously-ish from localStorage and
  // refreshes in the background, so this settles fast and offline.
  void supabase.auth.getSession().then(({ data }) => apply(data.session));
  void loadProviders();

  const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
  return () => data.subscription.unsubscribe();
}
