import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, levelInfo, currentStreak, MAX_PROFILES } from '../lib/store';
import { auth } from '../lib/auth';
import { account, useAccount } from '../lib/account';
import { isSupabaseConfigured } from '../lib/supabase';
import { Ic } from '../components/icons';
import { Avatar, BlockAvatar, AVATAR_PRESETS } from '../components/avatars';
import { Bar, Btn, Card, Modal, Stat } from '../components/ui';
import { curriculumProgress } from '../lib/curriculum';
import { fmtDuration, relTime, RANK_TIERS } from '../lib/metrics';
import { COACH_STYLES } from '../lib/coach';
import type { CoachStyle } from '../lib/types';

const RARITY_NAMES = ['', 'Common', 'Fine', 'Rare', 'Mythic'];

export default function Profile() {
  const data = useData();
  const nav = useNavigate();
  const patch = useStore((s) => s.patch);
  const profiles = useStore((s) => s.profiles);
  const activeId = useStore((s) => s.activeId);
  const user = useAccount((s) => s.user);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showRanks, setShowRanks] = useState(false);
  if (!data) return null;

  const lvl = levelInfo(data.xp);
  const streak = currentStreak(data);
  const prog = curriculumProgress(data);
  const totalSec = data.sessions.reduce((a, s) => a + s.seconds, 0);
  const badges = Object.keys(data.badges).length;
  const others = Object.values(profiles).filter((p) => p.profile.id !== activeId);
  const rank = data.assessment?.rank ?? 'Sprout I';
  const email = user?.email ?? (user?.user_metadata?.name as string | undefined);

  return (
    <div>
      <div className="page-head">
        <div className="row gap">
          <Avatar v={data.profile.avatar} size={62} />
          <div>
            <h1>{data.profile.name}</h1>
            <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="chip chip-accent rank-chip" onClick={() => setShowRanks(true)}>
                {rank} <Ic n="chevron-right" size={12} />
              </button>
              <span>joined {relTime(data.profile.createdAt)}</span>
            </p>
          </div>
        </div>
      </div>

      <Card className="profile-hero">
        <div className="profile-hero-main">
          <div className="row wrap profile-hero-stats">
            {data.records.wpm
              ? <Stat v={data.records.wpm.v} l="best wpm" tone="accent" />
              : (
                <div className="hero-cta">
                  <span className="small muted">No speed record yet</span>
                  <Btn kind="soft" to="/app/train/speed"><Ic n="zap" size={14} /> Take a speed sprint</Btn>
                </div>
              )}
            {data.records.acc && <Stat v={`${data.records.acc.v}%`} l="best accuracy" />}
            <Stat v={streak} l="day streak" />
          </div>
        </div>
        <div className="profile-level">
          <strong>Level {lvl.level}</strong>
          <span className="small muted">{lvl.need - lvl.into} xp to level {lvl.level + 1}</span>
        </div>
        <Bar value={lvl.into / lvl.need} height={8} />
        <div className="profile-sub">
          <span className="sub-stat"><Ic n="medal" size={14} /> <strong>{badges}</strong> badges</span>
          <span className="sub-stat"><Ic n="book" size={14} /> <strong>{prog.done}/{prog.total}</strong> lessons</span>
          <span className="sub-stat"><Ic n="timer" size={14} /> <strong>{fmtDuration(totalSec)}</strong> typed</span>
          {data.race.races > 0 && (
            <span className="sub-stat"><Ic n="flag" size={14} /> <strong>{data.race.wins}/{data.race.races}</strong> race wins</span>
          )}
        </div>
      </Card>

      <div className="grid2">
        <Card>
          <h3>Identity</h3>
          <label className="small muted" htmlFor="pf-name">Display name</label>
          <input
            id="pf-name" className="ob-input" style={{ margin: '6px 0 14px' }} maxLength={18}
            value={data.profile.name}
            onChange={(e) => patch((d) => { d.profile.name = e.target.value; })}
          />
          <label className="small muted">Block explorer — more unlock as you level</label>
          <div className="avatar-grid" style={{ marginTop: 6 }}>
            {AVATAR_PRESETS.map((p, i) => {
              const locked = lvl.level < p.level;
              const v = `bk:${i}`;
              return (
                <button
                  key={i} type="button"
                  className={`avatar-pick ${data.profile.avatar === v ? 'on' : ''} ${locked ? 'locked' : ''}`}
                  disabled={locked}
                  onClick={() => patch((d) => { d.profile.avatar = v; })}
                  aria-label={locked ? `Explorer locked until level ${p.level}` : `Choose explorer ${i + 1}`}
                >
                  <BlockAvatar preset={i} size={40} />
                  {locked && <span className="lock-lv">Lv{p.level}</span>}
                </button>
              );
            })}
          </div>
          <h3 style={{ marginTop: 18 }}>Coach personality</h3>
          <p className="small muted" style={{ marginTop: 4 }}>Same advice after every session, delivered in the voice you pick.</p>
          <div className="coach-grid">
            {(Object.keys(COACH_STYLES) as CoachStyle[]).map((c) => (
              <button
                key={c} type="button"
                className={`opt-tile ${data.profile.coach === c ? 'on' : ''}`}
                onClick={() => patch((d) => { d.profile.coach = c; })}
              >
                <span className="opt-ic" aria-hidden><Ic n={COACH_STYLES[c].emoji} size={19} /></span>
                <span><strong>{COACH_STYLES[c].name}</strong><small>{COACH_STYLES[c].desc}</small></span>
              </button>
            ))}
          </div>
        </Card>

        <div className="col gap">
          {data.forge.length > 0 && (
            <Card>
              <h3><Ic n="hammer" size={17} /> Forged treasures</h3>
              <div className="row gap wrap" style={{ marginTop: 10 }}>
                {[...data.forge].reverse().slice(0, 8).map((f) => (
                  <span key={f.id} className={`forge-item-card rarity-${f.rarity}`} style={{ padding: '10px 12px' }} title={`${RARITY_NAMES[f.rarity]} · forged ${relTime(f.t)}`}>
                    <Ic n={f.icon} size={24} />
                    <small style={{ maxWidth: 120, textAlign: 'center' }}>{f.name}</small>
                  </span>
                ))}
              </div>
            </Card>
          )}
          <Card>
            <h3><Ic n="users" size={17} /> Explorers</h3>
            {user
              ? (
                <p className="small muted">
                  Signed in as <strong>{email ?? 'your account'}</strong>. Every explorer here belongs
                  to this account, so a new device picks up right where this one left off.
                </p>
              )
              : <p className="small muted">Up to {MAX_PROFILES} family members can each have their own world here.</p>}
            <div className="col" style={{ gap: 6, marginTop: 10 }}>
              {others.map((p) => (
                <button key={p.profile.id} type="button" className="opt-tile" onClick={async () => { await auth.signIn(p.profile.id); nav('/app'); }}>
                  <Avatar v={p.profile.avatar} size={34} />
                  <span><strong>{p.profile.name}</strong><small>Level {levelInfo(p.xp).level}</small></span>
                </button>
              ))}
              {Object.keys(profiles).length < MAX_PROFILES
                ? <Btn kind="soft" onClick={() => nav('/onboarding')}><Ic n="user-plus" size={15} /> Add another explorer</Btn>
                : <p className="small muted">This device holds the maximum of {MAX_PROFILES} explorers. Delete one to add someone new.</p>}
              <Btn kind="soft" onClick={async () => { await auth.signOut(); nav('/who'); }}><Ic n="users" size={15} /> Switch explorer</Btn>
              <p className="small muted" style={{ marginTop: 2 }}>Switching just changes who's typing. Nothing is deleted, and everyone's progress stays saved.</p>
            </div>
            {isSupabaseConfigured && user && (
              <div className="row spread" style={{ marginTop: 12, alignItems: 'center' }}>
                <Btn kind="ghost" className="push-right" onClick={() => void account.signOut()}><Ic n="logout" size={15} /> Log out</Btn>
              </div>
            )}
          </Card>
          <Card>
            <h3>Danger zone</h3>
            <Btn kind="danger" onClick={() => setConfirmReset(true)}>Delete this profile</Btn>
          </Card>
        </div>
      </div>

      <Modal open={showRanks} onClose={() => setShowRanks(false)} labelledBy="ranks-title">
        <h2 id="ranks-title">Ranks of KeyTopia</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Your rank comes from typing tests. It blends speed with squared accuracy, so clean typists climb faster.
        </p>
        <div className="col" style={{ gap: 6 }}>
          {RANK_TIERS.map((t) => {
            const active = rank.startsWith(t.name);
            return (
              <div key={t.name} className={`rank-row ${active ? 'on' : ''}`}>
                <strong>{t.name}</strong>
                <small className="muted">{t.min > 0 ? `score ${t.min}+` : 'where everyone starts'}</small>
              </div>
            );
          })}
        </div>
      </Modal>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} labelledBy="del-title">
        <h2 id="del-title">Delete {data.profile.name}?</h2>
        <p className="muted">All progress, badges and records for this profile will be permanently removed from this device.</p>
        <div className="col gap">
          <Btn kind="danger" onClick={() => { const id = data.profile.id; setConfirmReset(false); nav('/'); setTimeout(() => useStore.getState().deleteProfile(id), 60); }}>Yes, delete forever</Btn>
          <Btn kind="soft" onClick={() => setConfirmReset(false)}>Keep my world</Btn>
        </div>
      </Modal>
    </div>
  );
}
