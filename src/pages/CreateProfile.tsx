import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, randomKidName, MAX_PROFILES } from '../lib/store';
import { account, useAccount } from '../lib/account';
import { useSync, visibleProfileIds } from '../lib/syncEngine';
import { readAnonResult, clearAnonResult, starterAssessment } from '../lib/starter';
import { Btn, Logo } from '../components/ui';
import { Ic } from '../components/icons';
import { BlockAvatar, presetValue } from '../components/avatars';
import type { AgeGroup } from '../lib/types';

/**
 * Making an explorer. Two questions, then they're typing.
 *
 * Everything else KeyTopia needs — goal, coach style, keyboard layout, guide
 * style, font size, sound, correction strictness — is derived from age and
 * tuned later in Settings. Asking a parent nine questions before their child
 * has pressed a single key is how you lose them; the placement test is offered
 * afterwards, from inside the app, once there is something to place.
 */

const AGES: { id: AgeGroup; label: string; sub: string; icon: string }[] = [
  { id: 'kid', label: 'Under 13', sub: 'Big friendly world, gentle pace', icon: 'smile' },
  { id: 'teen', label: '13 – 17', sub: 'Streaks, ranks and challenges', icon: 'headphones' },
  { id: 'adult', label: '18 and over', sub: 'Focused practice and real analytics', icon: 'briefcase' },
];

export default function CreateProfile() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  // Where to go once the explorer exists. Only same-site paths are honoured:
  // a full URL here would be an open redirect on a page anyone can link to.
  const next = params.get('next');
  const after = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
  const createProfile = useStore((s) => s.createProfile);
  const finishAssessment = useStore((s) => s.finishAssessment);
  // Count only THIS account's explorers. Another household's profiles may still
  // be cached in this browser; letting them consume the cap (or change the
  // wording) would leak one family's state into another's.
  const profiles = useStore((s) => s.profiles);
  const user = useAccount((s) => s.user);
  const owners = useSync((s) => s.owners);
  const count = visibleProfileIds(Object.keys(profiles), user?.id ?? null, owners).length;

  const [age, setAge] = useState<AgeGroup | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(0);

  const first = count === 0;
  // The way out. Once explorers exist there is a picker behind this screen, so
  // "not now" is a real destination and Escape can take it. The very first
  // explorer has nothing behind it but the public site — that case is handled
  // by the account footer below, because the person who is truly stuck here is
  // the parent who signed in with the wrong Google account.
  const back = first ? null : (next ? after : '/who');

  useEffect(() => {
    if (!back) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') nav(back); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, nav]);

  if (count >= MAX_PROFILES) return <Navigate to={next ? after : '/who'} replace />;

  // Children shouldn't publish their real name, and a grown-up setting up for a
  // child often can't think of one — so kids get a safe generated suggestion.
  const finalName = name.trim() || (age === 'kid' ? randomKidName() : 'Explorer');

  const create = () => {
    if (!age) return;
    const id = createProfile({
      name: finalName, avatar: presetValue(avatar), ageGroup: age,
      goal: age === 'kid' ? 'school' : 'basics',
      looksAtKeyboard: 'sometimes',
      experience: age === 'kid' ? 'new' : 'some',
      layout: 'qwerty',
      competitive: age !== 'kid',
      coach: age === 'kid' ? 'energetic' : 'teacher',
    });
    if (!id) { nav('/who'); return; }

    // Seed the starting level — from the public typing test if they took one,
    // otherwise a gentle age-appropriate default. Never blocks, never asks.
    const anon = readAnonResult();
    const start = starterAssessment(age, anon);
    finishAssessment(start, start.level, false);
    clearAnonResult();
    nav(after);
  };

  return (
    <div className="ob-page">
      <Link to="/" aria-label="Back to landing page"><Logo /></Link>
      <div className="signin-wrap">
        <h1>{first ? 'Who’s learning?' : 'Add an explorer'}</h1>
        <p className="muted">
          {first
            ? 'Two quick questions and you’re typing. Everything else can change later.'
            : `Each explorer keeps their own world and progress. ${count} of ${MAX_PROFILES} used.`}
        </p>

        <div className="cp-block">
          <h2 className="cp-label">How old are they?</h2>
          <p className="small muted cp-hint">This sets the world, the words and the pace.</p>
          <div className="cp-ages">
            {AGES.map((o) => (
              <button
                key={o.id} type="button"
                className={`opt-tile ${age === o.id ? 'on' : ''}`}
                onClick={() => setAge(o.id)}
                aria-pressed={age === o.id}
              >
                <span className="opt-ic"><Ic n={o.icon} size={22} /></span>
                <span><strong>{o.label}</strong><small>{o.sub}</small></span>
              </button>
            ))}
          </div>
        </div>

        {age && (
          <div className="cp-block">
            <h2 className="cp-label">What should we call them?</h2>
            <p className="small muted cp-hint">
              {age === 'kid'
                ? 'A nickname is perfect: never a real full name. Leave it blank and we’ll invent one.'
                : 'A first name or nickname is plenty.'}
            </p>
            <input
              className="ob-input" maxLength={18} autoFocus
              placeholder={age === 'kid' ? 'SunnyMaple42' : 'Alex'}
              value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
            />

            <div className="cp-avatars" role="group" aria-label="Choose an explorer">
              {Array.from({ length: 8 }, (_, i) => (
                <button
                  key={i} type="button"
                  className={`avatar-pick ${avatar === i ? 'on' : ''}`}
                  onClick={() => setAvatar(i)}
                  aria-label={`Explorer ${i + 1}`} aria-pressed={avatar === i}
                ><BlockAvatar preset={i} size={40} /></button>
              ))}
            </div>

            <Btn big onClick={create}>Start typing →</Btn>
            <p className="small muted" style={{ marginTop: 10 }}>
              We’ll pitch the first lessons for you. You can take the full placement
              test any time from Train.
            </p>
          </div>
        )}

        {/* Every other screen in the journey has somewhere to go; this one used
            to have nothing but a button you could only press after answering.
            The exit stays subordinate — a link, below the fold of the task. */}
        <div className="cp-exit">
          {back ? (
            <button type="button" className="who-add-link" onClick={() => nav(back)}>
              <Ic n="chevron-left" size={15} /> Back to explorers
            </button>
          ) : (
            <Link className="who-add-link" to="/">
              <Ic n="chevron-left" size={15} /> Back to KeyTopia
            </Link>
          )}

          {/* Signed in as the wrong person is the one dead end a back link
              cannot fix, so the account is reachable from here too. */}
          {first && (
            <div className="who-account">
              <span className="who-account-who">
                <Ic n="user" size={13} /> {user?.email ?? 'Signed in'}
              </span>
              <button type="button" className="who-signout" onClick={() => void account.signOut()}>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
