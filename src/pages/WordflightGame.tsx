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
    word: '', hit: 0, missedInWord: false,
    dist: 0, alt: 0.5, turb: 0,
    gates: [] as { id: number; at: number; hit?: boolean }[],
    gatesHit: 0, nextGate: 900, gateId: 1,
    score: 0, words: 0,
    strokes: [] as GameStroke[], recentIkis: [] as number[], lastKeyT: 0,
    startedAt: 0, lastTick: 0,
    clouds: [] as { x: number; y: number; w: number; s: number }[],
    rng: mulberry32(Date.now() % 1e9),
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef(0);
  const endedRef = useRef(false);

  const newWord = () => {
    const s = st.current;
    s.word = pick(s.rng, pool);
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

    // smoothness from recent intervals → altitude target
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

    const speed = 60 + smooth * 130;             // px/s world scroll
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
    setTimeout(() => inputRef.current?.focus(), 50);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => loop(performance.now()), 33);
  };

  useEffect(() => () => window.clearInterval(timer.current), []);

  const handleKey = (key: string) => {
    const s = st.current;
    if (phase !== 'run' || key.length !== 1) return;
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
  };

  if (!data) return null;
  const s = st.current;
  const remaining = phase === 'run' ? Math.max(0, DURATION - (performance.now() - s.startedAt) / 1000) : DURATION;
  const skyH = 380;
  const gliderTop = 24 + (1 - s.alt) * (skyH - 110);

  return (
    <div className="train-page" onClick={() => inputRef.current?.focus()}>
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
            <span>{Math.ceil(remaining)}s</span>
          </div>
        )}
        <div className="flight-sky" style={{ height: skyH }}>
          {phase === 'intro' && (
            <div className="game-over" style={{ paddingTop: 60 }}>
              <Ic n="send" size={50} />
              <h2>Ride the word-wind</h2>
              <p className="muted" style={{ maxWidth: 470 }}>
                Type the running words (press <strong>space</strong> between them). <strong>Even, steady typing lifts you</strong>;
                bursts and misses bring turbulence. Fly high and clean through the golden gates for bonus light.
              </p>
              {data.gameBests['wordflight'] && <Chip tone="gold">Personal best: {data.gameBests['wordflight'].score}</Chip>}
              <Btn big onClick={start}>Launch →</Btn>
            </div>
          )}
          {phase === 'run' && (
            <>
              <div className="flight-layer">
                {s.clouds.map((c, i) => (
                  <span key={i} className="flight-cloud" style={{ left: `${c.x}%`, top: `${c.y}%`, width: c.w, height: c.w * 0.34 }} />
                ))}
              </div>
              {s.gates.map((g) => {
                const x = ((g.at - s.dist) / 900) * 100 + 12;
                if (x < -5 || x > 110) return null;
                return <div key={g.id} className={`flight-gate ${g.hit ? 'hit' : ''}`} style={{ left: `${x}%`, top: 20, bottom: 20 }} aria-hidden />;
              })}
              <div
                className="flight-glider"
                style={{ top: gliderTop, transform: s.turb > 0.3 ? `rotate(${(s.rng() - 0.5) * 18}deg)` : 'rotate(4deg)' }}
                aria-hidden
              ><Ic n="send" size={30} /></div>
              <div className="flight-word" style={{ left: '32%', top: Math.min(skyH - 60, gliderTop + 10) }}>
                <span style={{ color: 'var(--accent)' }}>{s.word.slice(0, s.hit)}</span>
                <span style={{ borderBottom: '2px solid var(--accent)' }}>{s.word[s.hit] ?? '␣'}</span>
                <span className="muted">{s.word.slice(s.hit + 1)}</span>
              </div>
            </>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over" style={{ paddingTop: 40 }}>
              <Ic n={overInfo.newBest ? 'trophy' : 'sailboat'} size={46} />
              <h2>{overInfo.newBest ? 'New flight record!' : 'Smooth landing'}</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={overInfo.score} l="distance score" tone="accent" />
                <Stat v={overInfo.gates} l="gates" />
                <Stat v={overInfo.smooth} l="smoothness" />
                <Stat v={`${overInfo.acc}%`} l="accuracy" />
              </div>
              <RewardsBanner rewards={overInfo.rewards} />
              <p className="small muted" style={{ maxWidth: 430 }}>
                {overInfo.smooth >= 65 ? 'That rhythm was silk. Take it into a speed sprint!' : 'Altitude follows evenness, not haste — try locking into a beat you can hold.'}
              </p>
              <div className="row gap">
                <Btn onClick={start}>↻ Fly again</Btn>
                <Btn kind="soft" to="/app/games">All games</Btn>
              </div>
            </div>
          )}
        </div>
        {phase === 'run' && (
          <div className="game-typebar">
            <span className="muted small">Steady beats fast · space between words · altitude = smoothness</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef} className="ghost-input" aria-label="Game typing input"
        onKeyDown={(e) => { if (!e.metaKey && !e.ctrlKey && e.key.length === 1) { handleKey(e.key); e.preventDefault(); } if (e.key === 'Escape' && phase === 'run') endGame(); }}
        onInput={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; for (const ch of v) handleKey(ch); }}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
      />
    </div>
  );
}
