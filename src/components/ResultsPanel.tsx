import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Rewards, SessionResult } from '../lib/types';
import { Btn, Chip, Modal, Stars } from './ui';
import { RhythmFingerprint, RhythmStrip } from './charts';
import { BADGES } from '../lib/badges';
import { snd } from '../lib/sound';
import { fmtDuration } from '../lib/metrics';
import { displayChar } from '../lib/keyboard';
import { Ic } from './icons';

function KipFace({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="kip" aria-hidden>
      <ellipse cx="32" cy="36" rx="20" ry="18" fill="var(--accent)" opacity="0.16" />
      <ellipse cx="32" cy="36" rx="14" ry="13" fill="var(--accent)" />
      <ellipse cx="20" cy="26" rx="9" ry="12" fill="var(--accent2)" opacity="0.75" transform="rotate(-24 20 26)" />
      <ellipse cx="44" cy="26" rx="9" ry="12" fill="var(--accent2)" opacity="0.75" transform="rotate(24 44 26)" />
      <circle cx="27" cy="34" r="2.6" fill="var(--kip-eye, #0b1020)" />
      <circle cx="37" cy="34" r="2.6" fill="var(--kip-eye, #0b1020)" />
      <path d="M27 41 Q32 45 37 41" stroke="var(--kip-eye, #0b1020)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="14" r="3" fill="var(--gold)" className="kip-light" />
      <line x1="32" y1="17" x2="32" y2="23" stroke="var(--gold)" strokeWidth="2" />
    </svg>
  );
}

export function CoachCard({ text, title = 'Kip says' }: { text: string; title?: string }) {
  return (
    <div className="coach-card" role="note">
      <KipFace />
      <div>
        <div className="coach-title">{title}</div>
        <p className="coach-text">{text}</p>
      </div>
    </div>
  );
}

function EchoReplay({ result, soundOn }: { result: SessionResult; soundOn: boolean }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<number>(0);
  const tl = result.timeline ?? [];

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!playing || idx >= tl.length) { if (idx >= tl.length) setPlaying(false); return; }
    const dt = idx === 0 ? 250 : Math.min(1100, Math.max(24, tl[idx].t - tl[idx - 1].t)) / speed;
    timer.current = window.setTimeout(() => {
      if (soundOn) { if (tl[idx].ok) snd.tick(); else snd.err(); }
      setIdx((i) => i + 1);
    }, dt);
    return () => window.clearTimeout(timer.current);
  }, [playing, idx, speed, tl, soundOn]);

  if (!tl.length) return <p className="muted">No replay was recorded for this session.</p>;
  return (
    <div className="echo">
      <p className="muted small">Your typing, played back with its real timing. Long gaps glow: that's hesitation you can hear.</p>
      <div className="echo-strip" aria-hidden>
        {tl.slice(0, idx).slice(-90).map((s, i, arr) => {
          const realIdx = idx - arr.length + i;
          const gap = realIdx > 0 ? tl[realIdx].t - tl[realIdx - 1].t : 0;
          return (
            <span key={realIdx} className={`echo-ch ${s.ok ? 'ok' : 'bad'} ${gap > 600 ? 'echo-pause' : ''}`}>
              {displayChar(s.key)}
            </span>
          );
        })}
        <span className="echo-cursor" />
      </div>
      <div className="row gap">
        <Btn kind="soft" onClick={() => { if (idx >= tl.length) setIdx(0); setPlaying((p) => !p); }}>
          {playing ? '⏸ Pause' : idx >= tl.length ? '↻ Replay' : '▶ Play echo'}
        </Btn>
        <Btn kind="ghost" onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}>{speed}× speed</Btn>
        <div className="echo-progress"><div style={{ width: `${(idx / tl.length) * 100}%` }} /></div>
      </div>
    </div>
  );
}

export function RewardsBanner({ rewards }: { rewards: Rewards | null }) {
  if (!rewards) return null;
  const badgeDefs = rewards.badges.map((id) => BADGES.find((b) => b.id === id)).filter(Boolean);
  return (
    <div className="rewards-banner">
      <Chip tone="gold">+{rewards.xp} XP</Chip>
      {rewards.levelUp && <Chip tone="accent">Level {rewards.levelUp}!</Chip>}
      {badgeDefs.map((b) => <Chip key={b!.id} tone="gold"><Ic n={b!.icon} size={13} /> {b!.name}</Chip>)}
      {rewards.records.map((r) => <Chip key={r} tone="good"><Ic n="trophy" size={13} /> New record</Chip>)}
      {rewards.missionsDone.map((m) => <Chip key={m} tone="accent"><Ic n="check" size={13} /> Mission: {m}</Chip>)}
    </div>
  );
}

/** A quieter earned-line: the record is promoted to the hero, so it is not repeated here. */
function EarnedLine({ rewards }: { rewards: Rewards | null }) {
  if (!rewards) return null;
  const badgeDefs = rewards.badges.map((id) => BADGES.find((b) => b.id === id)).filter(Boolean);
  const items = [
    <span key="xp" className="earned-xp">+{rewards.xp} XP</span>,
    ...(rewards.levelUp ? [<span key="lvl" className="earned-hi">Level {rewards.levelUp}</span>] : []),
    ...badgeDefs.map((b) => (
      <span key={b!.id} className="earned-badge"><Ic n={b!.icon} size={13} /> {b!.name}</span>
    )),
    ...rewards.missionsDone.map((m) => <span key={m} className="earned-hi">Mission: {m}</span>),
  ];
  return <p className="results-earned">{items}</p>;
}

function Fold({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <details className="detail-fold">
      <summary>
        <span className="fold-title">{title}</span>
        <span className="fold-hint">{hint}</span>
        <Ic n="chevron-right" size={16} />
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

export function ResultsPanel({ result, rewards, insight, next, stars, targets, onRetry, extraActions, precisionFirst, soundOn }: {
  result: SessionResult;
  rewards: Rewards | null;
  insight: string;
  next: { label: string; to: string };
  stars?: number;
  targets?: { wpm: number; acc: number };
  onRetry?: () => void;
  extraActions?: ReactNode;
  precisionFirst?: boolean;
  soundOn: boolean;
}) {
  const troubleKeys = Object.entries(result.keyAgg)
    .filter(([, s]) => s.e > 0)
    .sort((a, b) => b[1].e - a[1].e)
    .slice(0, 6);

  const heroV = precisionFirst ? `${result.acc}%` : String(result.wpm);
  const heroL = precisionFirst ? 'accuracy' : 'words per minute';
  const sideV = precisionFirst ? String(result.uncorrected) : `${result.acc}%`;
  const sideL = precisionFirst ? (result.uncorrected === 1 ? 'error left' : 'errors left') : 'accuracy';
  const sideTone = precisionFirst
    ? (result.uncorrected === 0 ? 'good' : 'bad')
    : (result.acc >= 95 ? 'good' : result.acc < 88 ? 'bad' : '');
  const record = (rewards?.records.length ?? 0) > 0;

  return (
    <div className="results" aria-live="polite">
      <section className="results-hero">
        {stars !== undefined && <div className="results-stars"><Stars n={stars} size={34} /></div>}
        {record && <p className="hero-record"><Ic n="trophy" size={14} /> New personal record</p>}
        <div className="hero-nums">
          <div className="hero-main">
            <span className="hero-v">{heroV}</span>
            <span className="hero-l">{heroL}</span>
          </div>
          <div className={`hero-side ${sideTone ? `hero-${sideTone}` : ''}`}>
            <span className="hero-v2">{sideV}</span>
            <span className="hero-l">{sideL}</span>
          </div>
        </div>
        <p className="hero-meta">
          consistency {result.consistency} · {fmtDuration(result.seconds)}
          {!precisionFirst && <> · {result.raw} raw wpm</>}
          {targets && <> · target {targets.acc}% at {targets.wpm} wpm</>}
        </p>
        <EarnedLine rewards={rewards} />
      </section>

      <section className="results-next">
        <CoachCard text={insight} />
        <div className="results-actions">
          <Btn to={next.to} kind="primary">{next.label} →</Btn>
          {onRetry && <Btn kind="soft" onClick={onRetry}>↻ Try again</Btn>}
          {extraActions}
        </div>
      </section>

      <section className="results-detail">
        <h3 className="detail-h">Where the run got messy</h3>
        <div className="detail-body">
          {troubleKeys.length > 0 ? (
            <div className="row wrap gap">
              {troubleKeys.map(([k, s]) => (
                <Chip key={k} tone="warn">{k === ' ' ? 'Space' : displayChar(k)} · {s.e} miss{s.e > 1 ? 'es' : ''}</Chip>
              ))}
            </div>
          ) : result.uncorrected === 0 && result.errors === 0
            ? <p className="good">✔ No missed keys, a perfectly clean run.</p>
            : <p className="muted small">No single key stood out as a problem.</p>}
          <p className="muted small detail-line">
            {result.uncorrected} left wrong · {result.corrected} corrected · {result.backspaces} backspaces · {result.hesitations} hesitations
          </p>
          {result.slowPairs.length > 0 && (
            <p className="muted small detail-line">
              Slowest transitions: {result.slowPairs.slice(0, 3).map(([p, ms]) => `${(p[0] === ' ' ? 'Space' : displayChar(p[0]))}→${(p[1] === ' ' ? 'Space' : displayChar(p[1]))} (${Math.round(ms)}ms)`).join(' · ')}
            </p>
          )}
        </div>

        <Fold title="Rhythm" hint="how even your keystrokes were">
          <div className="rhythm-cols">
            <div>
              <p className="muted small">Each bar is the gap before a keystroke. Even bars mean a smooth rhythm.</p>
              <RhythmStrip ikis={result.ikis ?? []} />
            </div>
            <div className="fp-col">
              <p className="muted small">Rhythm fingerprint</p>
              <RhythmFingerprint ikis={result.ikis ?? []} />
            </div>
          </div>
        </Fold>

        <Fold title="Typing echo" hint="play the run back at its real speed">
          <EchoReplay result={result} soundOn={soundOn} />
        </Fold>
      </section>
    </div>
  );
}

export function PauseModal({ open, onResume, onRestart, onExit }: { open: boolean; onResume: () => void; onRestart: () => void; onExit: () => void }) {
  return (
    <Modal open={open} onClose={onResume} labelledBy="pause-title">
      <h2 id="pause-title">Paused</h2>
      <p className="muted">Shake your hands out. Roll your shoulders. Your place is saved.</p>
      <div className="col gap">
        <Btn onClick={onResume}>▶ Resume</Btn>
        <Btn kind="soft" onClick={onRestart}>↻ Restart</Btn>
        <Btn kind="ghost" onClick={onExit}>← Exit session</Btn>
      </div>
    </Modal>
  );
}
