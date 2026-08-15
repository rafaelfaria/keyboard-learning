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
import { Cannon, CityWall, MobileKeys, useGameKeys } from '../components/gamekit';
import { fireBolt, floatText, screenShake, shatterWord } from '../lib/fx';
import type { Rewards } from '../lib/types';

const BALLOON_COLORS = ['#ff8fa3', '#ffb26b', '#ffd166', '#7dd8a0', '#5fc9e0', '#8b9cf5', '#c99cf5'];

interface Fall { id: number; text: string; x: number; y: number; speed: number; hit: number; dying?: boolean }

export default function WordfallGame() {
  const data = useData();
  const nav = useNavigate();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const pool = useMemo(() => (kid ? KID_WORDS : COMMON_WORDS.filter((w) => w.length >= 3 && w.length <= 8)), [kid]);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [, force] = useState(0);
  const [waveBanner, setWaveBanner] = useState('');
  const [overInfo, setOverInfo] = useState<{ score: number; wave: number; acc: number; rewards: Rewards | null; newBest: boolean } | null>(null);

  const st = useRef({
    words: [] as Fall[],
    nextId: 1, shield: 100, score: 0, combo: 0, wave: 1, cleared: 0, targetId: 0,
    strokes: [] as GameStroke[],
    startedAt: 0, lastSpawn: 0, lastTick: 0,
    rng: mulberry32(Date.now() % 1e9),
  });
  const boardRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const endedRef = useRef(false);

  const speedMult = () => 1 + (st.current.wave - 1) * 0.22;

  const spawn = useCallback(() => {
    const s = st.current;
    s.words.push({
      id: s.nextId++,
      text: pick(s.rng, pool),
      x: 8 + s.rng() * 84,
      y: -30,
      speed: (kid ? 15 : 24) * speedMult() * (0.8 + s.rng() * 0.5),
      hit: 0,
    });
  }, [pool, kid]);

  const endGame = useCallback(() => {
    const s = st.current;
    if (endedRef.current || !s.startedAt) return;
    endedRef.current = true;
    window.clearInterval(timer.current);
    const result = resultFromStrokes('game', 'Wordfall Defence', s.strokes, s.startedAt, performance.now(), { game: 'wordfall', score: s.score, wave: s.wave });
    const rewards = s.strokes.length > 10 ? recordSession(result) : null;
    let newBest = false;
    patch((d) => {
      const cur = d.gameBests['wordfall'];
      if (!cur || s.score > cur.score) { d.gameBests['wordfall'] = { score: s.score, level: s.wave }; newBest = true; }
    });
    if (newBest) pushToast({ kind: 'record', icon: 'trophy', title: 'New Wordfall best!' });
    setOverInfo({ score: s.score, wave: s.wave, acc: result.acc, rewards, newBest });
    setPhase('over');
  }, [recordSession, patch, pushToast]);

  const loop = useCallback((t: number) => {
    const s = st.current;
    const board = boardRef.current;
    if (!board || endedRef.current) return;
    const h = board.clientHeight;
    const dt = Math.min(0.05, (t - s.lastTick) / 1000 || 0.016);
    s.lastTick = t;

    const interval = Math.max(kid ? 1900 : 1300, (kid ? 3300 : 2500) - s.wave * 190);
    if (t - s.lastSpawn > interval && s.words.filter((w) => !w.dying).length < 3 + s.wave) {
      s.lastSpawn = t;
      spawn();
    }
    for (const w of s.words) {
      if (w.dying) continue;
      w.y += w.speed * dt;
      if (w.y > h - 108) {
        w.dying = true;
        s.shield -= 12;
        s.combo = 0;
        if (s.targetId === w.id) s.targetId = 0;
        if (data?.settings.soundOn) snd.err();
        screenShake(board, 5);
        const px = (w.x / 100) * board.clientWidth;
        shatterWord(board, w.text, px, h - 112, 'var(--bad)');
        s.words = s.words.filter((x) => x.id !== w.id);
      }
    }
    if (s.shield <= 0) { endGame(); return; }
    force((n) => n + 1);
  }, [spawn, endGame, kid, data?.settings.soundOn]);

  const start = () => {
    st.current = { ...st.current, words: [], shield: 100, score: 0, combo: 0, wave: 1, cleared: 0, targetId: 0, strokes: [], startedAt: performance.now(), lastSpawn: 0, lastTick: performance.now(), nextId: 1 };
    endedRef.current = false;
    setWaveBanner('');
    setPhase('run');
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => loop(performance.now()), 33);
  };

  useEffect(() => () => window.clearInterval(timer.current), []);

  const destroyWord = (w: Fall) => {
    const s = st.current;
    const board = boardRef.current;
    w.dying = true;
    s.targetId = 0;
    s.cleared++;
    s.combo++;
    const gained = Math.round(w.text.length * 10 * (1 + Math.min(1.5, s.combo * 0.08)) * (1 + (s.wave - 1) * 0.1));
    s.score += gained;
    if (board) {
      const bw = board.clientWidth;
      const bh = board.clientHeight;
      const tx = (w.x / 100) * bw;
      const ty = w.y + 14;
      fireBolt(board, bw / 2, bh - 96, tx, ty, () => {
        shatterWord(board, w.text, tx, ty, 'var(--accent)');
        floatText(board, `+${gained}`, tx, ty - 8, 'fx-score');
        if (data?.settings.soundOn) snd.pop();
        st.current.words = st.current.words.filter((x) => x.id !== w.id);
      });
    } else {
      s.words = s.words.filter((x) => x.id !== w.id);
    }
    if (s.cleared % 10 === 0) {
      s.wave++;
      s.shield = Math.min(100, s.shield + 8);
      setWaveBanner(`Wave ${s.wave}: faster!`);
      window.setTimeout(() => setWaveBanner(''), 1400);
      if (data?.settings.soundOn) snd.step();
    }
  };

  const handleKey = (key: string) => {
    const s = st.current;
    if (phase !== 'run') return;
    const t = performance.now();
    let target = s.words.find((w) => w.id === s.targetId && !w.dying);
    if (!target) {
      const candidates = s.words.filter((w) => !w.dying && w.text[0] === key).sort((a, b) => b.y - a.y);
      target = candidates[0];
      if (target) s.targetId = target.id;
    }
    if (!target) {
      s.strokes.push({ t, exp: key, ok: false });
      s.combo = 0;
      if (data?.settings.soundOn) snd.err();
      return;
    }
    const want = target.text[target.hit];
    if (key === want) {
      s.strokes.push({ t, exp: want, ok: true });
      target.hit++;
      if (data?.settings.soundOn) snd.key();
      if (target.hit >= target.text.length) destroyWord(target);
    } else {
      s.strokes.push({ t, exp: want, ok: false });
      s.combo = 0;
      s.shield -= 1.5;
      if (data?.settings.soundOn) snd.err();
    }
  };

  useGameKeys(phase === 'run', handleKey, { onEscape: endGame });

  if (!data) return null;
  const s = st.current;
  const board = boardRef.current;
  const locked = s.words.find((w) => w.id === s.targetId && !w.dying);
  let cannonAngle = 0;
  if (locked && board) {
    const cx = board.clientWidth / 2;
    const cy = board.clientHeight - 96;
    cannonAngle = Math.atan2((locked.x / 100) * board.clientWidth - cx, cy - locked.y) * (180 / Math.PI);
  }

  return (
    <div className="train-page">
      <div className="train-top">
        <Btn kind="ghost" onClick={() => { window.clearInterval(timer.current); nav('/app/games'); }} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="shield" size={20} /> Wordfall Defence</h1>
        <Chip tone="accent">Trains: accuracy under pressure</Chip>
      </div>

      <div className="game-frame">
        {phase === 'run' && (
          <div className="game-hud">
            <span>Score {s.score}</span>
            <span>Wave {s.wave}</span>
            <span className={s.combo >= 5 ? 'good' : ''}>Combo ×{s.combo}</span>
            <span className="grow" />
            <span className={s.shield < 30 ? 'bad' : ''}>Shield {Math.max(0, Math.round(s.shield))}%</span>
          </div>
        )}
        <div className={`game-board wf-board ${kid ? 'wf-kid' : ''}`} ref={boardRef} style={{ minHeight: 460 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="shield" size={50} />
              <h2>{kid ? 'Pop the word balloons!' : 'Defend the Lantern City'}</h2>
              <p className="muted" style={{ maxWidth: 470 }}>
                {kid
                  ? 'Word balloons are floating down to the garden. Type a word to aim your pop-cannon: finish it and BOOM, confetti! Every 10 pops the balloons drift faster.'
                  : 'Words drift toward the wall. Type one to lock your cannon on, finish it and the cannon blasts it out of the sky. Wrong keys drain the shield a little; a word landing drains it a lot. Every wave falls faster.'}
                <strong> Calm accuracy beats frantic speed.</strong>
              </p>
              {data.gameBests['wordfall'] && <Chip tone="gold"><Ic n="trophy" size={12} /> Personal best: {data.gameBests['wordfall'].score}</Chip>}
              <Btn big onClick={start}>{kid ? 'Ready the pop-cannon →' : 'Raise the shield →'}</Btn>
            </div>
          )}
          {phase === 'run' && (
            <>
              {waveBanner && <div className="wf-wave-banner">{waveBanner}</div>}
              {s.words.map((w) => (
                <span
                  key={w.id}
                  className={`wf-word ${kid ? 'wf-balloon' : ''} ${w.id === s.targetId ? 'wf-target' : ''} ${w.dying ? 'wf-dying' : ''}`}
                  style={kid
                    ? { left: `${w.x}%`, top: w.y, background: BALLOON_COLORS[w.id % BALLOON_COLORS.length], borderColor: 'transparent', color: '#2d2a26' }
                    : { left: `${w.x}%`, top: w.y }}
                >
                  <span className="hit">{w.text.slice(0, w.hit)}</span>{w.text.slice(w.hit)}
                </span>
              ))}
              <div className="wf-base">
                <Cannon angle={cannonAngle} firing={!!locked} />
                <CityWall kid={kid} />
              </div>
            </>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over">
              <Ic n={overInfo.newBest ? 'trophy' : 'rainbow'} size={46} />
              <h2>{overInfo.newBest ? 'New personal best!' : kid ? 'The garden is safe' : 'The city rests'}</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={overInfo.score} l="score" tone="accent" />
                <Stat v={overInfo.wave} l="wave" />
                <Stat v={`${overInfo.acc}%`} l="accuracy" />
              </div>
              <RewardsBanner rewards={overInfo.rewards} />
              <p className="small muted" style={{ maxWidth: 420 }}>
                {overInfo.acc >= 95 ? 'Beautiful defence: your calm under pressure is real.' : 'Tip: it is faster to type each word once, correctly, than twice in a panic.'}
              </p>
              <div className="row gap">
                <Btn onClick={start}>↻ {kid ? 'Pop again' : 'Defend again'}</Btn>
                <Btn kind="soft" to="/app/games">All games</Btn>
              </div>
            </div>
          )}
        </div>
        {phase === 'run' && (
          <div className="game-typebar">
            <span className="muted small">type a word to lock on. Finish it to fire · every 10 pops the fall speeds up</span>
          </div>
        )}
      </div>
      <MobileKeys active={phase === 'run'} />
    </div>
  );
}
