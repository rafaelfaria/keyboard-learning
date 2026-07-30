import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useStore, levelInfo, currentStreak } from '../lib/store';
import { auth } from '../lib/auth';
import { Logo } from '../components/ui';
import { Avatar } from '../components/avatars';
import { Ic } from '../components/icons';

export default function ProfilePicker() {
  const nav = useNavigate();
  const profiles = useStore((s) => s.profiles);
  const list = Object.values(profiles).sort((a, b) => b.profile.createdAt - a.profile.createdAt);

  if (!list.length) return <Navigate to="/onboarding" replace />;

  return (
    <div className="ob-page">
      <Link to="/" aria-label="Back to landing page"><Logo /></Link>
      <div className="who-wrap">
        <h1>Who's typing today?</h1>
        <p className="muted">Pick your explorer — each one keeps their own world, progress and stickers.</p>
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
                <Avatar v={d.profile.avatar} size={72} className="who-av" />
                <strong>{d.profile.name}</strong>
                <small className="muted">
                  Level {lvl.level}
                  {streak > 0 && <> · <Ic n="flame" size={11} /> {streak}d</>}
                </small>
              </button>
            );
          })}
          <button type="button" className="who-card who-add" onClick={() => nav('/onboarding')}>
            <span className="who-av who-add-ic"><Ic n="user-plus" size={30} /></span>
            <strong>Add explorer</strong>
            <small className="muted">New world, new journey</small>
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 18 }}>
          Profiles live in this browser. When KeyTopia accounts go online, this screen becomes your sign-in.
        </p>
      </div>
    </div>
  );
}
