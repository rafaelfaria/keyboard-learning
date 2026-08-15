import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useStore, randomKidName } from '../lib/store';
import { useAccount } from '../lib/account';
import { useSync, visibleProfileIds } from '../lib/syncEngine';
import { isSupabaseConfigured } from '../lib/supabase';
import { joinWithCode, joinStatusMessage, syncTodayScore, type JoinResult } from '../lib/classroom';
import { Btn, Logo } from '../components/ui';
import { Ic } from '../components/icons';
import { Avatar } from '../components/avatars';

/**
 * Join a class with a code (docs/classrooms-plan.md §5). Works for both code
 * kinds: a class join code, or a one-time seat code the teacher printed.
 *
 * The display name is deliberately not a text field. Peers only ever see
 * picker-generated safe names, so the picker generates and the kid rerolls
 * until one feels right. When a teacher seat code is used, the teacher's
 * chosen safe name wins anyway.
 */
export default function JoinClass() {
  const nav = useNavigate();
  const user = useAccount((s) => s.user);
  const profiles = useStore((s) => s.profiles);
  const owners = useSync((s) => s.owners);
  const switchProfile = useStore((s) => s.switchProfile);
  const activeId = useStore((s) => s.activeId);

  const visible = visibleProfileIds(Object.keys(profiles), user?.id ?? null, owners);
  const [profileId, setProfileId] = useState<string>(() =>
    activeId && visible.includes(activeId) ? activeId : visible[0] ?? '');
  const [code, setCode] = useState('');
  const [name, setName] = useState(() => randomKidName());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<JoinResult | null>(null);

  const pretty = useMemo(
    () => (code.length > 3 ? `${code.slice(0, 3)}-${code.slice(3)}` : code),
    [code],
  );

  if (!isSupabaseConfigured) return <Navigate to="/app" replace />;
  // No explorer yet on this device: make one first, then come straight back.
  if (!visible.length) return <Navigate to="/welcome?next=/join" replace />;

  const join = async () => {
    if (busy || code.length !== 6 || !profileId) return;
    setBusy(true);
    setResult(null);
    const r = await joinWithCode(code, profileId, name);
    setBusy(false);
    setResult(r);
    if (r.status === 'ok') {
      switchProfile(profileId);
      const d = useStore.getState().profiles[profileId];
      if (d) void syncTodayScore(d, profileId).catch(() => { /* background */ });
      setTimeout(() => nav('/app', { replace: true }), 1400);
    }
  };

  return (
    <div className="ob-page">
      <Link to="/" aria-label="Back to landing page"><Logo /></Link>
      <div className="signin-wrap">
        <h1>Join your class</h1>
        <p className="muted">
          Type the code from your teacher, or from a grown-up in your family.
          No email needed, ever.
        </p>

        {visible.length > 1 && (
          <div className="cp-block">
            <h2 className="cp-label">Who is joining?</h2>
            <div className="join-profiles" role="group" aria-label="Choose an explorer">
              {visible.map((id) => {
                const p = profiles[id]?.profile;
                if (!p) return null;
                return (
                  <button
                    key={id} type="button"
                    className={`join-profile ${profileId === id ? 'on' : ''}`}
                    onClick={() => setProfileId(id)} aria-pressed={profileId === id}
                  >
                    <Avatar v={p.avatar} size={30} /> {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="cp-block">
          <h2 className="cp-label">Class code</h2>
          <input
            className="ob-input join-code" autoFocus
            placeholder="ABC-234" value={pretty} inputMode="text" autoComplete="off"
            aria-label="Class code"
            onChange={(e) => {
              setResult(null);
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') void join(); }}
          />
        </div>

        <div className="cp-block">
          <h2 className="cp-label">Your class name</h2>
          <p className="small muted cp-hint">
            Classmates see this name, never your real one. Roll until you like it.
          </p>
          <div className="row gap" style={{ alignItems: 'center' }}>
            <span className="join-name">{name}</span>
            <Btn kind="soft" onClick={() => setName(randomKidName())} ariaLabel="Roll a new class name">
              <Ic n="refresh" size={15} /> New name
            </Btn>
          </div>
        </div>

        {result && (
          <p
            className="small"
            role="status"
            style={{ marginTop: 10, color: result.status === 'ok' ? 'var(--good, #4caf7d)' : 'var(--bad)' }}
          >
            {result.status === 'ok'
              ? `Welcome to ${result.className ?? 'your class'}${result.displayName ? `, ${result.displayName}` : ''}! Setting sail…`
              : joinStatusMessage(result.status)}
          </p>
        )}

        <div style={{ marginTop: 14 }}>
          <Btn big disabled={busy || code.length !== 6} onClick={() => void join()}>
            {busy ? 'Checking the code…' : 'Join the class →'}
          </Btn>
        </div>

        <p className="small muted signin-foot">
          This class link lives in this browser. If the browser is ever reset,
          your teacher can simply remove the old seat and you join again with a
          new code. Your typing progress stays safe either way.
        </p>
        <Btn kind="ghost" onClick={() => nav('/app')}>← Back</Btn>
      </div>
    </div>
  );
}
