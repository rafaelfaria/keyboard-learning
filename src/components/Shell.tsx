import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useData, useStore, levelInfo, currentStreak } from '../lib/store';
import { auth } from '../lib/auth';
import { applyTheme } from '../lib/themes';
import { configureSound } from '../lib/sound';
import { CelebrationHost, Logo, ToastHost } from './ui';
import { nextLesson } from '../lib/curriculum';
import { Ic } from './icons';
import { Avatar } from './avatars';
import { useNoIndex } from '../lib/seo/Seo';
import { account, useAccount } from '../lib/account';
import { useSync, visibleProfileIds } from '../lib/syncEngine';

export function ThemeSync() {
  const data = useData();
  useEffect(() => {
    const s = data?.settings;
    const sysRm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    applyTheme(s?.theme ?? 'midnight', {
      fontScale: s?.fontScale ?? 1,
      dyslexia: s?.dyslexiaFont ?? false,
      reducedMotion: (s?.reducedMotion ?? false) || sysRm,
    });
    configureSound(s?.soundOn ?? true, s?.volume ?? 0.6);
  }, [data?.settings]);
  return null;
}

// Five doors (plan §4.2): the journey is home; games and races share the
// Arena; everything the dashboard used to show lives under Progress.
const NAV = [
  { to: '/app', label: 'Journey', icon: 'map', end: true },
  { to: '/app/practice', label: 'Train', icon: 'keyboard' },
  { to: '/app/games', label: 'Arena', icon: 'swords' },
  { to: '/app/progress', label: 'Progress', icon: 'trending' },
];

const NAV2 = [
  { to: '/app/challenge', label: 'Daily Challenge', icon: 'calendar' },
  { to: '/app/family', label: 'Family & Schools', icon: 'school' },
  { to: '/app/profile', label: 'Profile', icon: 'user' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' },
];

// Kids get the same merge as grown-ups: races live inside Play (plan §7.2),
// which frees the fourth door for the sticker book they actually visit.
const KID_NAV = [
  { to: '/app', label: 'My World', icon: 'map', end: true },
  { to: '/app/learn', label: 'Quests', icon: 'book' },
  { to: '/app/games', label: 'Play', icon: 'gamepad' },
  { to: '/app/badges', label: 'My Stickers', icon: 'medal' },
];

const KID_NAV2 = [
  { to: '/app/profile', label: 'My Character', icon: 'user' },
  { to: '/app/family', label: 'Grown-ups', icon: 'school' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' },
];

export function AppShell() {
  const data = useData();
  const nav = useNavigate();
  const profiles = useStore((s) => s.profiles);
  const activeId = useStore((s) => s.activeId);
  const user = useAccount((s) => s.user);
  const owners = useSync((s) => s.owners);
  const visible = visibleProfileIds(Object.keys(profiles), user?.id ?? null, owners);
  const hasProfiles = visible.length > 0;
  // A profile belonging to another account must not stay open just because it
  // was active when that account signed out.
  const foreign = Boolean(activeId && user && !visible.includes(activeId));
  const loc = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  // The app is private, per-device state — never indexable. robots.txt blocks
  // /app/, and this makes the directive explicit for a crawler that follows a
  // shared app link anyway.
  useNoIndex('App');

  useEffect(() => { setMoreOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);

  const lvl = useMemo(() => (data ? levelInfo(data.xp) : null), [data?.xp]);
  const streak = useMemo(() => (data ? currentStreak(data) : 0), [data?.days]);
  const nextL = useMemo(() => (data ? nextLesson(data) : null), [data]);

  if (!data || foreign) return <Navigate to={hasProfiles ? '/who' : '/welcome'} replace />;

  const isTyping = /\/lesson\/|\/train\//.test(loc.pathname);
  const kid = data.profile.ageGroup === 'kid' && data.settings.kidWorld !== false;
  const nav1 = kid ? KID_NAV : NAV;
  const nav2 = kid ? KID_NAV2 : NAV2;

  return (
    <div className={`shell ${data.settings.focusMode ? 'focus-mode' : ''} ${kid ? 'kid-mode' : ''}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sidebar" aria-label="Main navigation">
        <NavLink to="/" className="sidebar-logo" aria-label="KeyTopia home"><Logo size={30} /></NavLink>
        <NavLink to={nextL ? `/app/lesson/${nextL.id}` : '/app/train/adaptive'} className="continue-btn">
          <Ic n="play" size={18} className="continue-ic" />
          <span>
            <strong>{kid ? 'Next quest' : 'Continue the ascent'}</strong>
            <small>{nextL ? nextL.title : 'Adaptive practice'}</small>
          </span>
        </NavLink>
        <nav className="side-nav">
          {nav1.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `side-link ${isActive ? 'on' : ''}`}>
              <span className="side-ic"><Ic n={n.icon} size={18} /></span>{n.label}
            </NavLink>
          ))}
          <div className="side-sep" />
          {nav2.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `side-link side-link2 ${isActive ? 'on' : ''}`}>
              <span className="side-ic"><Ic n={n.icon} size={16} /></span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-me">
          <NavLink to="/app/profile" className="side-me-btn" aria-label={`${data.profile.name} — open profile`}>
            <Avatar v={data.profile.avatar} size={34} className="side-avatar" />
            <div className="side-me-txt">
              <strong>{data.profile.name}</strong>
              <small>Level {lvl?.level} · {streak > 0 ? <><Ic n="flame" size={11} /> {streak} day{streak > 1 ? 's' : ''}</> : 'no streak yet'}</small>
            </div>
          </NavLink>
          <button
            type="button" className="side-logout"
            onClick={async () => { await auth.signOut(); nav('/who'); }}
            aria-label="Switch explorer"
            title="Switch explorer"
          ><Ic n="users" size={16} /></button>
        </div>
        <div className="side-xp" title={`${lvl?.into} / ${lvl?.need} XP to next level`}>
          <div className="side-xp-fill" style={{ width: `${Math.round(((lvl?.into ?? 0) / (lvl?.need ?? 1)) * 100)}%` }} />
        </div>
      </aside>

      <header className="topbar">
        <NavLink to="/" aria-label="KeyTopia home"><Logo size={26} /></NavLink>
        <div className="topbar-right">
          {streak > 0 && <span className="streak-pill" title={`${streak}-day streak`}><Ic n="flame" size={13} /> {streak}</span>}
          <span className="xp-pill">Lv {lvl?.level}</span>
          <NavLink to="/app/profile" className="top-avatar" aria-label="Profile"><Avatar v={data.profile.avatar} size={30} /></NavLink>
        </div>
      </header>

      <main id="main" className="main">
        <Outlet />
      </main>

      {!isTyping && (
        <nav className="bottom-nav" aria-label="Main navigation">
          {nav1.slice(0, 4).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `bn-item ${isActive ? 'on' : ''}`}>
              <Ic n={n.icon} size={21} /><small>{n.label}</small>
            </NavLink>
          ))}
          <button className={`bn-item ${moreOpen ? 'on' : ''}`} onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen}>
            <Ic n="menu" size={21} /><small>More</small>
          </button>
        </nav>
      )}
      {moreOpen && (
        <div className="more-sheet-bg" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" role="menu">
            {[...nav1.slice(4), ...nav2].map((n) => (
              <NavLink key={n.to} to={n.to} className="more-link" role="menuitem">
                <Ic n={n.icon} size={18} />{n.label}
              </NavLink>
            ))}
            <button
              type="button" className="more-link" role="menuitem"
              onClick={async () => { await auth.signOut(); nav('/who'); }}
            ><Ic n="users" size={18} />Switch explorer</button>
            <button
              type="button" className="more-link" role="menuitem"
              onClick={() => void account.signOut()}
            ><Ic n="logout" size={18} />Log out</button>
          </div>
        </div>
      )}
      <ToastHost />
      <CelebrationHost />
    </div>
  );
}
