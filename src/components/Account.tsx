import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { account, useAccount } from '../lib/account';
import { auth } from '../lib/auth';
import { useStore } from '../lib/store';
import { isSupabaseConfigured } from '../lib/supabase';
import { lastProfileFor, useSync, visibleProfileIds } from '../lib/syncEngine';
import { Btn, Card, Logo } from './ui';
import { Ic } from './icons';

/**
 * Account surfaces for the signed-in app.
 *
 * KeyTopia has two clearly separated worlds: the public pages, which need no
 * account at all, and the journey, which always has one. Because a profile can
 * never exist outside an account, none of this has to reason about half-owned
 * local data — which is exactly what made the earlier optional-account model
 * confusing. Signing in is handled by pages/SignIn.tsx; everything here assumes
 * a session already exists.
 */

/** Provider mark. Inline SVG so it survives the CSP and works offline. */
export function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.6 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-3.8-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/**
 * True only once `ms` has elapsed. Used to hold back loading UI: anything shown
 * for less than ~300ms reads as a flicker and makes a fast operation *feel*
 * slower than showing nothing at all.
 */
function useDelayed(ms: number, enabled = true): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => setPast(true), ms);
    return () => clearTimeout(t);
  }, [ms, enabled]);
  return past;
}

/** Background-only placeholder that reveals itself only if the wait drags. */
function QuietSplash({ label }: { label: string }) {
  const show = useDelayed(400);
  return (
    <div className="ob-page boot-splash" aria-busy="true">
      {show && (
        <>
          <Logo />
          <p className="small muted" role="status">{label}</p>
        </>
      )}
    </div>
  );
}

/**
 * Route guard for everything that owns saved progress. The session lookup reads
 * from localStorage, so it is effectively instant — a returning user should
 * never see an auth spinner, hence the delayed splash.
 */
export function RequireAccount({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAccount();

  // A build with no Supabase project configured would otherwise strand every
  // route behind a door with no handle. Fail open: this is a deployment
  // mistake, not a user trying to sneak past.
  if (!isSupabaseConfigured) return <>{children}</>;

  if (!ready) return <QuietSplash label="One moment…" />;
  if (!user) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

/**
 * Where a fresh sign-in lands. One decision, made with full information:
 *
 *   1. The explorer this account used last is still theirs -> straight into
 *      the app as that explorer. Logging out and back in should feel like
 *      picking up a book where the bookmark is, not starting at the shelf.
 *   2. Otherwise, explorers exist -> the picker.
 *   3. Otherwise, nothing local yet -> WAIT for the first sync pull before
 *      concluding this is a new family. Deciding from an empty cache is how a
 *      returning parent on a fresh browser used to land on "Add an explorer"
 *      while their two kids' profiles were still downloading.
 */
export function EnterJourney() {
  const nav = useNavigate();
  const user = useAccount((s) => s.user);
  const profiles = useStore((s) => s.profiles);
  const owners = useSync((s) => s.owners);
  const hydrated = useSync((s) => s.hydrated);

  useEffect(() => {
    if (!user) return;
    const visible = visibleProfileIds(Object.keys(profiles), user.id, owners);
    const last = lastProfileFor(user.id);
    if (last && visible.includes(last)) {
      void auth.signIn(last).then(() => nav('/app', { replace: true }));
      return;
    }
    if (visible.length) { nav('/who', { replace: true }); return; }
    if (hydrated) nav('/welcome', { replace: true });
  }, [user, profiles, owners, hydrated, nav]);

  return <QuietSplash label="Loading your world…" />;
}

/** The signed-in account panel on the Profile page. */
export function AccountCard() {
  const user = useAccount((s) => s.user);
  if (!isSupabaseConfigured || !user) return null;

  const who = user.email ?? (user.user_metadata?.name as string | undefined) ?? 'your account';
  return (
    <Card>
      <h3><Ic n="cloud-check" size={17} /> Your account</h3>
      <p className="small muted">
        Signed in as <strong>{who}</strong>. Every explorer here belongs to this
        account, so a new laptop picks up exactly where this one left off.
      </p>
      <div className="row gap wrap" style={{ marginTop: 12, alignItems: 'center' }}>
        <SyncPill verbose />
      </div>
    </Card>
  );
}

/**
 * The one permitted sync surface (plan §8): ambient, never a toast. "Offline"
 * is stated plainly rather than as an error, because offline practice is a
 * supported way to use the app, not a failure.
 *
 * Ambient placements are exception-only: a healthy synced state shows nothing,
 * because permanent reassurance reads as a warning after the first session.
 * "Saving…" only appears once a sync has run long enough to be worth knowing
 * about; sub-second syncs stay invisible. The Account panel passes `verbose`
 * to keep the full status, since that page is where you go to check it.
 */
export function SyncPill({ verbose = false }: { verbose?: boolean }) {
  const status = useSync((s) => s.status);
  const slowSync = useSlowSync(status);
  if (status === 'off') return null;
  if (!verbose) {
    if (status === 'synced') return null;
    if (status === 'syncing' && !slowSync) return null;
  }
  const map = {
    synced: { icon: 'cloud-check', text: 'Saved to your account', cls: 'ok' },
    syncing: { icon: 'refresh', text: 'Saving…', cls: 'go' },
    offline: { icon: 'cloud-off', text: 'Offline — saved on this device', cls: 'off' },
  } as const;
  const s = map[status];
  return (
    <span className={`sync-pill ${s.cls}`} title={s.text}>
      <Ic n={s.icon} size={13} className={status === 'syncing' ? 'spin' : ''} />
      <span className="sync-pill-txt">{s.text}</span>
    </span>
  );
}

/** True once a 'syncing' status has persisted past the flicker threshold. */
function useSlowSync(status: string) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (status !== 'syncing') { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 800);
    return () => clearTimeout(t);
  }, [status]);
  return slow;
}

/**
 * Where Google and email links land.
 *
 * This screen's job is to be *unnoticed*. The Supabase client exchanges the
 * `?code=` for a session on its own (detectSessionInUrl); the moment that
 * settles we redirect, with no artificial pause. Two deliberate choices:
 *
 *  - **No success screen.** "You're in" was a 500ms speed bump celebrating
 *    something the user already knows. The real confirmation is arriving at
 *    the picker with their explorers on it.
 *  - **The spinner waits 400ms before appearing.** A loader shown for 150ms
 *    reads as a flicker, which feels *slower* than a clean transition. Most
 *    exchanges beat the timer and this renders nothing but the background.
 *
 * The error branch is the exception — a failed sign-in must be visible and
 * must offer a way out.
 */
export function AuthCallback() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user, ready } = useAccount();
  const providerError = params.get('error_description') ?? params.get('error');

  useEffect(() => {
    if (providerError || user) return;
    if (ready) nav('/signin', { replace: true });
  }, [providerError, user, ready, nav]);

  if (!providerError && user) return <EnterJourney />;

  if (providerError) {
    return (
      <div className="ob-page">
        <div className="signin-wrap" style={{ textAlign: 'center' }}>
          <h1>That didn't go through</h1>
          <p className="muted">{providerError}</p>
          <Btn onClick={() => nav('/signin', { replace: true })}>Try again</Btn>
        </div>
      </div>
    );
  }

  return <QuietSplash label="Signing you in…" />;
}

export { account };
