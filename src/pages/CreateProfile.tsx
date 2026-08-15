import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, randomKidName, MAX_PROFILES } from '../lib/store';
import { useAccount } from '../lib/account';
import { useSync, visibleProfileIds } from '../lib/syncEngine';
import { readAnonResult, clearAnonResult, starterAssessment } from '../lib/starter';
import { Btn, Logo } from '../components/ui';
import { Ic } from '../components/icons';
import { BlockAvatar } from '../components/avatars';
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

  if (count >= MAX_PROFILES) return <Navigate to={next ? after : '/who'} replace />;

  const first = count === 0;
  // Children shouldn't publish their real name, and a grown-up setting up for a
  // child often can't think of one — so kids get a safe generated suggestion.
  const finalName = name.trim() || (age === 'kid' ? randomKidName() : 'Explorer');

  const create = () => {
    if (!age) return;
    const id = createProfile({
      name: finalName, avatar: `bk:${avatar}`, ageGroup: age,
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
      <Logo />
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
                ? 'A nickname is perfect — never a real full name. Leave it blank and we’ll invent one.'
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
      </div>
    </div>
  );
}
