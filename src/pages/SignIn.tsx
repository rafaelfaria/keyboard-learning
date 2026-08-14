import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { account, useAccount } from '../lib/account';
import { isSupabaseConfigured } from '../lib/supabase';
import { Btn, Logo } from '../components/ui';
import { Ic } from '../components/icons';
import { EnterJourney, GoogleMark } from '../components/Account';

/**
 * The one door into KeyTopia proper.
 *
 * The public pages (/typing-test, /typing-games, /learn-to-type) stay open to
 * everyone — that is where a curious visitor finds out whether they like this.
 * An account starts the *journey*: saved progress, several explorers, and the
 * online features. Keeping those two worlds cleanly apart is what stops the
 * "whose profile is this?" confusion that a half-local, half-synced model
 * creates.
 *
 * Sign-in is deliberately one step: an email link, or one tap of Google. No
 * password to invent, none for us to store, and nothing a child needs.
 */
export default function SignIn() {
  const nav = useNavigate();
  const { user, ready, busy, error, linkSentTo, providers } = useAccount();
  const [email, setEmail] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Already signed in — resume the last explorer, or go wherever they belong.
  if (user) return <EnterJourney />;

  // A project with no Supabase configured would strand everyone at this screen,
  // so an unconfigured build falls through rather than bricking.
  if (!isSupabaseConfigured) return <Navigate to="/welcome" replace />;

  return (
    <div className="ob-page">
      <Link to="/" aria-label="Back to landing page"><Logo /></Link>
      <div className="signin-wrap">
        <h1>Start your journey</h1>
        <p className="muted">
          One account keeps every explorer's progress safe, on any device.
          It's free, and there's no password to remember.
        </p>

        {offline ? (
          <div className="signin-offline">
            <p><Ic n="cloud-off" size={15} /> You're offline right now.</p>
            <p className="small muted">
              Signing in is the one thing that needs a connection. You can still
              use the <Link to="/typing-test">typing test</Link> and the
              {' '}<Link to="/typing-games">games</Link> while you wait.
            </p>
          </div>
        ) : linkSentTo ? (
          <div className="signin-sent">
            <span className="signin-sent-ic"><Ic n="mail" size={26} /></span>
            <h2>Check your email</h2>
            <p className="muted">
              We sent a sign-in link to <strong>{linkSentTo}</strong>. Open it on
              this device and you're in — no password needed.
            </p>
            <Btn kind="soft" onClick={() => account.clearError()}>Use a different email</Btn>
          </div>
        ) : (
          <>
            <form
              className="signin-form"
              onSubmit={(e) => { e.preventDefault(); if (email.includes('@')) void account.sendMagicLink(email); }}
            >
              <label className="small muted" htmlFor="si-email">Your email</label>
              <input
                id="si-email" className="ob-input" type="email" autoComplete="email"
                placeholder="you@example.com" value={email}
                onChange={(e) => { setEmail(e.target.value); account.clearError(); }}
              />
              <Btn type="submit" big disabled={Boolean(busy) || !email.includes('@')}>
                {busy === 'email' ? 'Sending…' : 'Email me a link'}
              </Btn>
            </form>

            {providers?.google && (
              <>
                <div className="signin-or"><span>or</span></div>
                <button type="button" className="oauth-btn" disabled={Boolean(busy)} onClick={() => void account.signInWith('google')}>
                  <GoogleMark />
                  {busy === 'google' ? 'Taking you to Google…' : 'Continue with Google'}
                </button>
              </>
            )}
          </>
        )}

        {error && <p className="small" style={{ marginTop: 12, color: 'var(--bad)' }}>{error}</p>}
        {!ready && !offline && <p className="small muted" style={{ marginTop: 12 }}>Checking your session…</p>}

        <p className="small muted signin-foot">
          Just looking? The <Link to="/typing-test">typing test</Link> and{' '}
          <Link to="/typing-games">games</Link> need no account at all.
        </p>
        <Btn kind="ghost" onClick={() => nav('/')}>← Back to KeyTopia</Btn>
      </div>
    </div>
  );
}
