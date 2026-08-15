import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, useUi } from '../lib/store';
import { getRaceSetup, setRaceSetup } from '../lib/race';
import { GhostInput, TypingText, useTypingSession } from '../components/typing';
import { Btn, Chip, Stat } from '../components/ui';
import { RewardsBanner } from '../components/ResultsPanel';
import { snd } from '../lib/sound';
import { Ic } from '../components/icons';
import { Avatar } from '../components/avatars';
import { PixelCar } from '../components/gamekit';
import { mulberry32 } from '../lib/rng';
import { currentRoom } from '../lib/room';
import type { Rewards, SessionResult } from '../lib/types';

const CAR_COLORS = ['#8b7cff', '#ffb454', '#f2789f', '#6fd695', '#5fc9e0'];

interface Lane {
  id: string; name: string; avatar: string; you?: boolean; ghost?: boolean; remote?: boolean;
  progress: number; wpm: number; finishedAt: number | null;
}

/**
 * A saved ghost holds one progress sample per second of the run, so replaying it
 * means walking that curve rather than assuming an even pace. It matters: the
 * interesting part of racing yourself is watching where past-you sped up.
 */
function ghostProgress(curve: number[] | undefined, elapsed: number, fallbackWpm: number, textLen: number): number {
  if (!curve || curve.length < 2) {
    const totalSec = (textLen / 5 / Math.max(1, fallbackWpm)) * 60;
    return Math.min(1, elapsed / totalSec);
  }
  if (elapsed >= curve.length - 1) return 1;
  const i = Math.floor(elapsed);
  const f = elapsed - i;
  return Math.min(1, curve[i] + (curve[i + 1] - curve[i]) * f);
}

export default function RaceLive() {
  const data = useData();
  const nav = useNavigate();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);
  const setup = getRaceSetup();

  const [count, setCount] = useState(3);
  const [running, setRunning] = useState(false);
  const [, force] = useState(0);
  const [done, setDone] = useState<{ result: SessionResult; rewards: Rewards; place: number; lanes: Lane[] } | null>(null);

  const lanes = useRef<Lane[]>([]);
  const botState = useRef<Record<string, { stumbleUntil: number; noise: number }>>({});
  const timer = useRef(0);
  const startT = useRef(0);
  const lastT = useRef(0);
  const progressSamples = useRef<number[]>([]);
  const rng = useRef(mulberry32(Date.now() % 1e9));

  useEffect(() => {
    if (!setup) { nav('/app/race', { replace: true }); }
  }, [setup, nav]);

  const session = useTypingSession(
    {
      text: setup?.text ?? ' ',
      mode: 'race',
      label: setup?.label ?? 'Race',
      correction: 'standard',
      stopOnComplete: true,
      allowBackspace: true,
      keepTimeline: true,
    },
    {
      soundOn: data?.settings.soundOn,
      disabled: !running || !!done,
      onFinish: (r) => finishRace(r),
    },
  );

  // Build lanes for this race setup (memo so they exist on first render, during countdown)
  useMemo(() => {
    if (!setup || !data) return;
    const ls: Lane[] = [{ id: 'you', name: data.profile.name, avatar: data.profile.avatar, you: true, progress: 0, wpm: 0, finishedAt: null }];
    botState.current = {};
    for (const r of setup.racers) {
      ls.push({ id: r.name, name: r.name, avatar: r.avatar, progress: 0, wpm: Math.round(r.baseWpm), finishedAt: null });
      botState.current[r.name] = { stumbleUntil: 0, noise: 1 };
    }
    // Real people. Their lanes are moved by their own browsers, never guessed.
    for (const r of setup.remotes ?? []) {
      ls.push({ id: r.id, name: r.name, avatar: r.avatar, remote: true, progress: 0, wpm: 0, finishedAt: null });
    }
    if (setup.withGhost && data.ghost) {
      ls.push({ id: 'ghost', name: `Ghost (${data.ghost.wpm} wpm)`, avatar: 'ghost-ic', ghost: true, progress: 0, wpm: data.ghost.wpm, finishedAt: null });
    }
    lanes.current = ls;
  }, [setup, data?.profile.id, count === 3]);

  /** Re-arm for another race on this setup, optionally with fresh text. */
  const resetRace = useCallback((text?: string) => {
    if (!setup) return;
    setRaceSetup({ ...setup, ...(text ? { text } : {}) });
    window.clearInterval(timer.current);
    progressSamples.current = [];
    lanes.current = [];
    botState.current = {};
    setDone(null);
    setRunning(false);
    setCount(3);
    session.restart();
  }, [setup, session]);

  // Live room: remote lanes move only when their own browser says so, and the
  // host can re-arm everybody from the results screen.
  useEffect(() => {
    if (!setup?.live) return;
    currentRoom()?.on({
      onProgress: (id, p, wpm) => {
        const lane = lanes.current.find((l) => l.id === id);
        if (!lane || lane.finishedAt) return;
        lane.progress = Math.max(lane.progress, p);
        lane.wpm = Math.round(wpm);
      },
      onFinish: (id) => {
        const lane = lanes.current.find((l) => l.id === id);
        if (lane && !lane.finishedAt) { lane.progress = 1; lane.finishedAt = performance.now(); }
      },
      onStart: ({ text }) => resetRace(text),
    });
  }, [setup, resetRace]);

  // Countdown
  useEffect(() => {
    if (!setup) return;
    if (count > 0) {
      if (data?.settings.soundOn) snd.count(false);
      const t = setTimeout(() => setCount((c) => c - 1), 900);
      return () => clearTimeout(t);
    }
    if (data?.settings.soundOn) snd.count(true);
    setRunning(true);
    startT.current = performance.now();
    lastT.current = 0;
    setTimeout(session.focus, 60);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => tick(performance.now()), 40);
    return () => window.clearInterval(timer.current);
  }, [count, setup]);

  const tick = useCallback((t: number) => {
    if (!setup || !data) return;
    const elapsed = (t - startT.current) / 1000;
    const dt = Math.min(0.08, lastT.current ? (t - lastT.current) / 1000 : 0.016);
    lastT.current = t;
    const textLen = setup.text.length;

    // user lane
    const you = lanes.current.find((l) => l.you)!;
    you.progress = session.engine.pos / textLen;
    you.wpm = session.engine.liveStats(t).wpm;
    if (Math.floor(elapsed) > progressSamples.current.length - 1) progressSamples.current.push(you.progress);
    if (setup.live) currentRoom()?.sendProgress(you.progress, you.wpm);

    // bots
    for (const spec of setup.racers) {
      const lane = lanes.current.find((l) => l.id === spec.name)!;
      if (lane.finishedAt) continue;
      const bs = botState.current[spec.name];
      if (t < bs.stumbleUntil) continue;
      if (rng.current() < (spec.stumbleRate / 60) * 0.016 * 60) {
        bs.stumbleUntil = t + 300 + rng.current() * 900;
      }
      bs.noise += (rng.current() - 0.5) * spec.volatility * 0.2;
      bs.noise = Math.max(0.55, Math.min(1.45, bs.noise));
      let wpm = spec.baseWpm * bs.noise;
      if (spec.sprintFinish && lane.progress > 0.8) wpm *= 1.16;
      const cps = (wpm * 5) / 60;
      lane.progress = Math.min(1, lane.progress + (cps / textLen) * dt);
      lane.wpm = Math.round(wpm);
      if (lane.progress >= 1 && !lane.finishedAt) lane.finishedAt = t;
    }

    // ghost
    if (setup.withGhost && data.ghost) {
      const lane = lanes.current.find((l) => l.ghost);
      if (lane && !lane.finishedAt) {
        lane.progress = ghostProgress(data.ghost.curve, elapsed, data.ghost.wpm, textLen);
        if (lane.progress >= 1) lane.finishedAt = t;
      }
    }

    force((n) => n + 1);
  }, [setup, data, session.engine]);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const finishRace = (r: SessionResult) => {
    if (!setup || !data) return;
    window.clearInterval(timer.current);
    const you = lanes.current.find((l) => l.you)!;
    you.progress = 1;
    you.finishedAt = performance.now();
    if (setup.live) currentRoom()?.sendFinish(r.wpm, r.acc);
    const finishedBefore = lanes.current.filter((l) => !l.you && l.finishedAt !== null && l.finishedAt < you.finishedAt!).length;
    const place = finishedBefore + 1;
    r.extra = { ...r.extra, place, race: setup.kind };
    const rewards = recordSession(r);
    if (place === 1 && data.settings.soundOn) snd.badge();
    else if (data.settings.soundOn) snd.done();
    // store ghost if best
    if (r.acc >= 85 && (!data.ghost || r.wpm >= data.ghost.wpm)) {
      const curve = [...progressSamples.current, 1];
      patch((d) => { d.ghost = { wpm: r.wpm, acc: r.acc, curve, t: Date.now() }; });
      pushToast({ kind: 'info', icon: 'ghost', title: 'New ghost saved', body: 'Your best run is now raceable.' });
    }
    if (rewards.badges.length) pushToast({ kind: 'badge', icon: 'medal', title: 'Badge unlocked!' });
    const snapshot = lanes.current.map((l) => ({ ...l }));
    snapshot.sort((a, b) => {
      const at = a.finishedAt ?? Infinity, bt = b.finishedAt ?? Infinity;
      if (at !== bt) return at - bt;
      return b.progress - a.progress;
    });
    setDone({ result: r, rewards, place, lanes: snapshot });
  };

  if (!setup || !data) return null;

  if (done) {
    const top3 = done.lanes.slice(0, 3);
    return (
      <div className="train-page">
        <div className="train-top"><h1><Ic n="flag" size={20} /> {setup.label}, finished</h1></div>
        <div className="card">
          <h2 className="center" style={{ marginBottom: 4 }}>
            {done.place === 1 ? 'Victory! Your comet crossed first.' : done.place === 2 ? 'So close. Second across the sky.' : done.place === 3 ? 'On the podium!' : `You finished ${done.place}th.`}
          </h2>
          <p className="center muted small">{done.result.wpm} wpm at {done.result.acc}% accuracy</p>
          <div className="podium">
            {[1, 0, 2].map((idx) => {
              const lane = top3[idx];
              if (!lane) return <div key={idx} style={{ width: 86 }} />;
              return (
                <div key={idx} className={`podium-col podium-${idx + 1}`}>
                  {lane.ghost ? <Ic n="ghost" size={26} /> : lane.you ? <Avatar v={data.profile.avatar} size={26} /> : <Avatar v={lane.avatar} size={26} />}
                  <small className={lane.you ? 'good' : 'muted'} style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lane.name}</small>
                  <div className="podium-block"><Ic n={idx === 0 ? 'trophy' : 'medal'} size={20} /></div>
                </div>
              );
            })}
          </div>
          <div className="row gap wrap" style={{ justifyContent: 'center' }}>
            <Stat v={done.result.wpm} l="wpm" tone="accent" />
            <Stat v={`${done.result.acc}%`} l="accuracy" />
            <Stat v={done.result.consistency} l="consistency" />
            <Stat v={data.race.wins} l="career wins" />
          </div>
          <RewardsBanner rewards={done.rewards} />
          <div className="results-actions" style={{ marginTop: 16 }}>
            {setup.live ? (
              currentRoom()?.isHost
                ? <Btn onClick={() => currentRoom()?.start(setup.text)}><Ic n="refresh" size={15} /> Rematch the room</Btn>
                : <span className="small muted">Waiting for the host to call a rematch.</span>
            ) : (
              <Btn onClick={() => resetRace()}><Ic n="refresh" size={15} /> Rematch</Btn>
            )}
            <Btn kind="soft" to="/app/race">{setup.live ? 'Back to room' : 'Race hub'}</Btn>
            <Btn kind="ghost" to="/app">Home</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="train-page" onClick={session.focus}>
      <div className="train-top">
        <Btn kind="ghost" onClick={() => nav('/app/race')} ariaLabel="Exit race">←</Btn>
        <h1><Ic n="rocket" size={20} /> {setup.label}</h1>
        {setup.roomCode && <Chip tone="accent">Room {setup.roomCode}</Chip>}
      </div>

      <div className="card" style={{ position: 'relative' }}>
        {count > 0 && <div className="race-countdown" aria-live="assertive">{count}</div>}
        {count === 0 && !session.engine.started && <div className="race-countdown" style={{ background: 'transparent', pointerEvents: 'none' }} aria-live="assertive">GO!</div>}
        {lanes.current.map((l, idx) => (
          <div key={l.id} className={`race-lane ${l.you ? 'race-lane-you' : ''}`}>
            <span className="race-name">{l.ghost ? <Ic n="ghost" size={20} /> : l.you ? <Avatar v={data.profile.avatar} size={20} /> : <Avatar v={l.avatar} size={20} />} {l.you ? 'You' : l.name}</span>
            <div className={`road ${running ? 'road-moving' : ''}`}>
              <span
                className="road-car"
                style={{ left: `${Math.max(1.5, l.progress * 100)}%`, ['--wheelspin' as string]: `${Math.max(0.12, 0.7 - l.wpm / 220)}s` }}
              >
                {l.ghost
                  ? <PixelCar color="#7a8296" ghost />
                  : <PixelCar color={l.you ? 'var(--accent)' : CAR_COLORS[idx % CAR_COLORS.length]} you={l.you} />}
                {l.finishedAt && <Ic n="flag" size={13} className="road-done-flag" />}
              </span>
              <span className="road-finish" aria-hidden />
            </div>
            <span className="race-wpm">{l.wpm} wpm</span>
          </div>
        ))}
      </div>

      <div className="train-stage">
        <TypingText engine={session.engine} caret={data.settings.caret} focused={session.focused} onClick={session.focus} />
        <GhostInput bind={session.bindInput} />
        <div className="row spread">
          <span className="muted small">Accuracy {session.engine.liveStats().acc}% · errors slow your comet more than careful typing does</span>
          <span className="muted small">{Math.round(session.engine.liveStats().progress * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
