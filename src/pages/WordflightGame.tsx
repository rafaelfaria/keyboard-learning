import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS } from '../lib/words';
import { mulberry32, pick } from '../lib/rng';
import { Btn, Chip, Stat } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { Ic } from '../components/icons';
import { Glider, MobileKeys, useGameKeys } from '../components/gamekit';
import { sparkBurst, floatText } from '../lib/fx';
import type { Rewards } from '../lib/types';

const DURATION = 75; // seconds

export default function WordflightGame() {
  const data = useData();
  const nav = useNavigate();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const pool = useMemo(() => (kid ? KID_WORDS : COMMON_WORDS.filter((w) => w.length >= 3 && w.length <= 7)), [kid]);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [, force] = useState(0);
  const [overInfo, setOverInfo] = useState<{ score: number; gates: number; smooth: number; acc: number; rewards: Rewards | null; newBest: boolean } | null>(null);

  const st = useRef({
    word: '', next: '', hit: 0, missedInWord: false,
    dist: 0, alt: 0.5, turb: 0,
    gates: [] as { id: number; at: number; hit?: boolean }[],
    gatesHit: 0, nextGate: 900, gateId: 1,
    score: 0, words: 0,
    strokes: [] as GameStroke[], recentIkis: [] as number[], lastKeyT: 0,
    startedAt: 0, lastTick: 0,
    clouds: [] as { x: number; y: number; w: number; s: number }[],
    rng: mulberry32(Date.now() % 1e9),
  });
  const skyRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const endedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const newWord = () => {
    const s = st.current;
    s.word = s.next || pick(s.rng, pool);
    s.next = pick(s.rng, pool);
    s.hit = 0;
    s.missedInWord = false;
  };

  const endGame = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    window.clearInterval(timer.current);
    const s = st.current;
    const result = resultFromStrokes('game', 'Wordflight', s.strokes, s.startedAt, performance.now(), { game: 'wordflight', score: Math.round(s.score), gates: s.gatesHit });
    const rewards = s.strokes.length > 10 ? recordSession(result) : null;
    let newBest = false;
    patch((d) => {
      const cur = d.gameBests['wordflight'];
      if (!cur || s.score > cur.score) { d.gameBests['wordflight'] = { score: Math.round(s.score), level: s.gatesHit }; newBest = true; }
    });
    if (newBest) pushToast({ kind: 'record', icon: 'trophy', title: 'New Wordflight best!' });
    setOverInfo({ score: Math.round(s.score), gates: s.gatesHit, smooth: result.consistency, acc: result.acc, rewards, newBest });
    setPhase('over');
  }, [recordSession, patch, pushToast]);

  const loop = useCallback((t: number) => {
    const s = st.current;
    const dt = Math.min(0.05, (t - s.lastTick) / 1000 || 0.016);
    s.lastTick = t;
    const elapsed = (t - s.startedAt) / 1000;
    if (elapsed >= DURATION) { endGame(); return; }

    const ik = s.recentIkis;
    let smooth = 0.35;
    if (ik.length >= 6) {
      const m = ik.reduce((a, b) => a + b, 0) / ik.length;
      const sd = Math.sqrt(ik.reduce((a, b) => a + (b - m) * (b - m), 0) / ik.length);
      smooth = Math.max(0.05, Math.min(1, 1 - (sd / m) * 0.9));
    }
    const idle = s.lastKeyT ? (t - s.lastKeyT) / 1000 : 0;
    const targetAlt = idle > 2 ? 0.12 : 0.15 + smooth * 0.72;
    s.alt += (targetAlt - s.alt) * Math.min(1, dt * 2.2);
    s.turb = Math.max(0, s.turb - dt * 2);

    const speed = 60 + smooth * 130;
    s.dist += speed * dt;
    s.score += speed * dt * 0.12 * (0.5 + s.alt);

    if (s.dist > s.nextGate - 700 && (!s.gates.length || s.gates[s.gates.length - 1].at < s.nextGate)) {
      s.gates.push({ id: s.gateId++, at: s.nextGate });
      s.nextGate += 620 + s.rng() * 500;
    }
    for (const g of s.gates) {
      if (!g.hit && g.at < s.dist + 120 && g.at > s.dist + 60) {
        g.hit = true;
        if (s.alt > 0.34 && !s.missedInWord) {
          s.gatesHit++;
          s.score += 60;
          if (data?.settings.soundOn) snd.pop();
          const sky = skyRef.current;
          if (sky) {
            const gx = ((g.at - s.dist) / 900) * sky.clientWidth + sky.clientWidth * 0.12;
            sparkBurst(sky, gx, sky.clientHeight * 0.4, 10);
            floatText(sky, '+60', gx, sky.clientHeight * 0.36, 'fx-score');
          }
        }
      }
    }
    s.gates = s.gates.filter((g) => g.at > s.dist - 200);

    if (s.clouds.length < 7 && s.rng() < 0.02) {
      s.clouds.push({ x: 110, y: 8 + s.rng() * 70, w: 60 + s.rng() * 120, s: 6 + s.rng() * 12 });
    }
    for (const c of s.clouds) c.x -= (c.s + speed * 0.04) * dt;
    s.clouds = s.clouds.filter((c) => c.x > -30);

    force((n) => n + 1);
  }, [endGame, data?.settings.soundOn]);

  const start = () => {
    const s = st.current;
    Object.assign(s, {
      dist: 0, alt: 0.5, turb: 0, gates: [], gatesHit: 0, nextGate: 900, gateId: 1,
      score: 0, words: 0, strokes: [], recentIkis: [], lastKeyT: 0,
      startedAt: performance.now(), lastTick: performance.now(),
      clouds: [{ x: 20, y: 20, w: 90, s: 8 }, { x: 60, y: 60, w: 130, s: 10 }],
    });
    newWord();
    endedRef.current = false;
    setPhase('run');
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => loop(performance.now()), 33);
  };

  useEffect(() => () => window.clearInterval(timer.current), []);

  const handleKey = (key: string) => {
    const s = st.current;
    if (phaseRef.current !== 'run') return;
    const t = performance.now();
    const want = s.hit >= s.word.length ? ' ' : s.word[s.hit];
    const ok = key === want;
    s.strokes.push({ t, exp: want, ok });
    if (s.lastKeyT) {
      const dt = t - s.lastKeyT;
      if (dt > 20 && dt < 1500) { s.recentIkis.push(dt); if (s.recentIkis.length > 12) s.recentIkis.shift(); }
    }
    s.lastKeyT = t;
    if (ok) {
      if (data?.settings.soundOn) snd.key();
      if (want === ' ') { s.words++; s.score += s.word.length * 4; newWord(); }
      else s.hit++;
    } else {
      s.missedInWord = true;
      s.turb = 1;
      s.alt = Math.max(0.06, s.alt - 0.14);
      if (data?.settings.soundOn) snd.err();
    }
    force((n) => n + 1);
  };

  useGameKeys(phase === 'run', handleKey, { onEscape: endGame });

  if (!data) return null;
  const s = st.current;
  const remaining = phase === 'run' ? Math.max(0, DURATION - (performance.now() - s.startedAt) / 1000) : DURATION;
  const skyH = 380;
  const gliderTop = 20 + (1 - s.alt) * (skyH - 150);

  return (
    <div className="train-page">
      <div className="train-top">
        <Btn kind="ghost" onClick={() => { window.clearInterval(timer.current); nav('/app/games'); }} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="send" size={20} /> Wordflight</h1>
        <Chip tone="accent">Trains: rhythm & flow</Chip>
      </div>

      <div className="game-frame">
        {phase === 'run' && (
          <div className="game-hud">
            <span>Score {Math.round(s.score)}</span>
            <span>Gates {s.gatesHit}</span>
            <span className="grow" />
            <span>altitude {Math.round(s.alt * 100)}%</span>
            <span>{Math.ceil(remaining)}s</span>
          </div>
        )}
        <div className={`flight-sky ${kid ? 'flight-kid' : ''}`} ref={skyRef} style={{ height: skyH }}>
          {phase === 'intro' && (
            <div className="game-over" style={{ paddingTop: 46 }}>
              <Ic n="send" size={50} />
              <h2>{kid ? 'Fly the little bird!' : 'Ride the word-wind'}</h2>
              <p className="muted" style={{ maxWidth: 470 }}>
                Type the running words in the bar below (press <strong>space</strong> between them).
                <strong> Even, steady typing lifts you</strong>; bursts and misses bring turbulence and drop you.
                Fly high and clean through the golden gates for bonus sparks.
              </p>
              {data.gameBests['wordflight'] && <Chip tone="gold"><Ic n="trophy" size={12} /> Personal best: {data.gameBests['wordflight'].score}</Chip>}
              <Btn big onClick={start}>{kid ? 'Flap flap → ' : 'Launch →'}</Btn>
            </div>
          )}
          {phase === 'run' && (
            <>
              {kid && <span className="flight-sun" aria-hidden />}
              <div className="flight-layer">
                {s.clouds.map((c, i) => (
                  <span key={i} className="flight-cloud" style={{ left: `${c.x}%`, top: `${c.y}%`, width: c.w, height: c.w * 0.34 }} />
                ))}
              </div>
              {s.gates.map((g) => {
                const x = ((g.at - s.dist) / 900) * 100 + 12;
                if (x < -5 || x > 110) return null;
                return (
                  <div key={g.id} className={`flight-gate ${g.hit ? 'hit' : ''}`} style={{ left: `${x}%`, top: 16, bottom: 76 }} aria-hidden>
                    <span className="flight-gate-flag"><Ic n="star" size={13} /></span>
                  </div>
                );
              })}
              <div className="flight-glider-wrap" style={{ top: gliderTop, transform: s.turb > 0.3 ? `rotate(${(s.rng() - 0.5) * 16}deg)` : 'rotate(0deg)' }}>
                <Glider kid={kid} turbulent={s.turb > 0.3} />
                {s.alt > 0.6 && <span className="flight-wind" aria-hidden><i /><i /><i /></span>}
              </div>
              <div className="flight-wordbar">
                <span className="muted small flight-wordbar-label">{kid ? 'type me!' : 'type · space · next'}</span>
                <span className="flight-wordbar-word">
                  <span className="good">{s.word.slice(0, s.hit)}</span>
                  <span className="duel-cur">{s.hit >= s.word.length ? '␣' : s.word[s.hit]}</span>
                  <span className="muted">{s.word.slice(s.hit + 1)}</span>
                </span>
                <span className="muted small flight-wordbar-next">then: {s.next}</span>
              </div>
            </>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over" style={{ paddingTop: 36 }}>
              <Ic n={overInfo.newBest ? 'trophy' : 'sailboat'} size={44} />
              <h2>{overInfo.newBest ? 'New flight record!' : 'Smooth landing'}</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={overInfo.score} l="distance score" tone="accent" />
                <Stat v={overInfo.gates} l="gates" />
                <Stat v={overInfo.smooth} l="smoothness" />
                <Stat v={`${overInfo.acc}%`} l="accuracy" />
              </div>
              <RewardsBanner rewards={overInfo.rewards} />
              <p className="small muted" style={{ maxWidth: 430 }}>
                {overInfo.smooth >= 65 ? 'That rhythm was silk. Take it into a speed sprint!' : 'Altitude follows evenness, not haste. Lock into a beat you can hold.'}
              </p>
              <div className="row gap">
                <Btn onClick={start}>↻ Fly again</Btn>
                <Btn kind="soft" to="/app/games">All games</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
      <MobileKeys active={phase === 'run'} />
    </div>
  );
}
