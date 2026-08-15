import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useStore, levelInfo, currentStreak, MAX_PROFILES } from '../lib/store';
import { auth } from '../lib/auth';
import { account, useAccount } from '../lib/account';
import { Logo } from '../components/ui';
import { Avatar } from '../components/avatars';
import { Ic } from '../components/icons';
import { useSync, visibleProfileIds } from '../lib/syncEngine';

/**
 * The profile picker. One job: pick a person, in one glance, in one tap.
 *
 * Everything is sized so a full household fits above the fold on a phone. The
 * account is present only as a quiet footer — by the time anyone sees this
 * screen they are already signed in, so the account is context, not a task.
 */
export default function ProfilePicker() {
  const nav = useNavigate();
  const profiles = useStore((s) => s.profiles);
  const user = useAccount((s) => s.user);
  const owners = useSync((s) => s.owners);
  const hydrated = useSync((s) => s.hydrated);
  // Only this account's explorers. One browser can serve two households — a
  // shared laptop, or simply the wrong entry in Google's account chooser — and
  // showing someone else's explorers here (or worse, showing them while they
  // silently fail to sync) is the confusion this rule exists to prevent.
  const visible = new Set(visibleProfileIds(Object.keys(profiles), user?.id ?? null, owners));
  const list = Object.values(profiles)
    .filter((d) => visible.has(d.profile.id))
    .sort((a, b) => b.profile.createdAt - a.profile.createdAt);

  // A signed-in account with no explorers goes straight to making one — but
  // only once the first sync pull has settled. Before that, "no explorers" may
  // just mean "still downloading them" (fresh browser, returning family).
  if (!list.length) {
    if (!hydrated) return <div className="ob-page boot-splash" aria-busy="true" />;
    return <Navigate to="/welcome" replace />;
  }

  const full = list.length >= MAX_PROFILES;

  return (
    <div className="ob-page">
      <Link to="/" aria-label="Back to landing page"><Logo /></Link>
      <div className="who-wrap">
        <h1>Who's typing today?</h1>
        <p className="muted">Pick your explorer: each one keeps their own world and stickers.</p>

        <div className="who-grid">
          {list.map((d) => {
            const lvl = levelInfo(d.xp);
            const streak = currentStreak(d);
            return (
              <button
                key={d.profile.id}
                type="button"
                className="who-card"
                onClick={async () => { await auth.signIn(d.profile.id); nav('/app'); }}
              >
                <Avatar v={d.profile.avatar} size={56} className="who-av" />
                <strong title={d.profile.name}>{d.profile.name}</strong>
                <small className="muted">
                  Lv {lvl.level}
                  {streak > 0 && <> · <Ic n="flame" size={11} /> {streak}d</>}
                </small>
              </button>
            );
          })}
        </div>

        {/* Adding someone is rare next to picking someone, so it reads as a
            quiet link rather than a fifth tile competing with the faces. */}
        {full ? (
          <p className="who-note small muted">
            <Ic n="users" size={13} /> That's all {MAX_PROFILES} explorers. Remove one
            from their profile page to make room.
          </p>
        ) : (
          <button type="button" className="who-add-link" onClick={() => nav('/welcome')}>
            <Ic n="user-plus" size={15} /> Add an explorer
            <span className="muted"> · {list.length} of {MAX_PROFILES}</span>
          </button>
        )}

        <div className="who-account">
          <span className="who-account-who">
            <Ic n="user" size={13} /> {user?.email ?? 'Signed in'}
          </span>
          <button type="button" className="who-signout" onClick={() => void account.signOut()}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
