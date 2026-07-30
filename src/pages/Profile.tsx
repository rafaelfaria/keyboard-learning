import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, levelInfo, currentStreak } from '../lib/store';
import { auth } from '../lib/auth';
import { Ic } from '../components/icons';
import { Avatar, BlockAvatar, AVATAR_PRESETS } from '../components/avatars';
import { Btn, Card, Chip, Modal, Stat } from '../components/ui';
import { BADGES } from '../lib/badges';
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
  const switchProfile = useStore((s) => s.switchProfile);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!data) return null;

  const lvl = levelInfo(data.xp);
  const streak = currentStreak(data);
  const prog = curriculumProgress(data);
  const totalSec = data.sessions.reduce((a, s) => a + s.seconds, 0);
  const badges = Object.keys(data.badges).length;
  const others = Object.values(profiles).filter((p) => p.profile.id !== activeId);

  return (
    <div>
      <div className="page-head">
        <div className="row gap">
          <Avatar v={data.profile.avatar} size={62} />
          <div>
            <h1>{data.profile.name}</h1>
            <p className="muted">
              {data.assessment?.rank ?? 'Sprout I'} · Level {lvl.level} · joined {relTime(data.profile.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="row gap wrap" style={{ marginBottom: 18 }}>
        <Stat v={data.records.wpm?.v ?? '—'} l="best wpm" tone="accent" />
        <Stat v={`${data.records.acc?.v ?? '—'}${data.records.acc ? '%' : ''}`} l="best accuracy" />
        <Stat v={streak} l="streak" />
        <Stat v={badges} l="badges" />
        <Stat v={`${prog.done}/${prog.total}`} l="lessons" />
        <Stat v={fmtDuration(totalSec)} l="time typed" />
        <Stat v={`${data.race.wins}/${data.race.races}`} l="race wins" />
      </div>

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
          <div className="row gap wrap" style={{ marginTop: 8 }}>
            {(Object.keys(COACH_STYLES) as CoachStyle[]).map((c) => (
              <button
                key={c} type="button"
                className={`chip ${data.profile.coach === c ? 'chip-accent' : ''}`}
                onClick={() => patch((d) => { d.profile.coach = c; })}
                style={{ cursor: 'pointer' }}
              ><Ic n={COACH_STYLES[c].emoji} size={13} /> {COACH_STYLES[c].name}</button>
            ))}
          </div>
        </Card>

        <div className="col gap">
          <Card>
            <h3><Ic n="hammer" size={17} /> Keyforge display case</h3>
            {data.forge.length ? (
              <div className="row gap wrap" style={{ marginTop: 10 }}>
                {[...data.forge].reverse().slice(0, 8).map((f) => (
                  <span key={f.id} className={`forge-item-card rarity-${f.rarity}`} style={{ padding: '10px 12px' }} title={`${RARITY_NAMES[f.rarity]} · forged ${relTime(f.t)}`}>
                    <Ic n={f.icon} size={24} />
                    <small style={{ maxWidth: 120, textAlign: 'center' }}>{f.name}</small>
                  </span>
                ))}
              </div>
            ) : <p className="muted small" style={{ marginTop: 8 }}>Forge artifacts in the Keyforge game — flawless words make rare treasures.</p>}
          </Card>
          <Card>
            <h3>Ranks of KeyTopia</h3>
            <p className="small muted" style={{ marginBottom: 8 }}>Rank blends speed with squared accuracy — clean typists climb faster.</p>
            <div className="row gap wrap">
              {RANK_TIERS.map((t) => {
                const active = data.assessment?.rank?.startsWith(t.name);
                return <Chip key={t.name} tone={active ? 'accent' : 'default'}>{t.name}</Chip>;
              })}
            </div>
          </Card>
          <Card>
            <h3>Profiles on this device</h3>
            <p className="small muted">KeyTopia is local-first: each family member can have their own world on this machine.</p>
            <div className="col" style={{ gap: 6, marginTop: 10 }}>
              {others.map((p) => (
                <button key={p.profile.id} type="button" className="opt-tile" onClick={async () => { await auth.signIn(p.profile.id); nav('/app'); }}>
                  <span className="opt-ic" aria-hidden>{p.profile.avatar}</span>
                  <span><strong>{p.profile.name}</strong><small>Level {levelInfo(p.xp).level}</small></span>
                </button>
              ))}
              <Btn kind="soft" onClick={() => nav('/onboarding')}><Ic n="user-plus" size={15} /> Add another explorer</Btn>
              <Btn kind="soft" onClick={async () => { await auth.signOut(); nav('/who'); }}><Ic n="logout" size={15} /> Log out</Btn>
              <p className="small muted" style={{ marginTop: 2 }}>Logging out returns to the profile picker. Nothing is deleted — your world stays saved on this device.</p>
            </div>
          </Card>
          <Card>
            <h3>Danger zone</h3>
            <Btn kind="danger" onClick={() => setConfirmReset(true)}>Delete this profile</Btn>
          </Card>
        </div>
      </div>

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
