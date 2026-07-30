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

interface Fall { id: number; text: string; x: number; y: number; speed: number; hit: number; popping?: boolean }

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
  const [overInfo, setOverInfo] = useState<{ score: number; wave: number; acc: number; rewards: Rewards | null; newBest: boolean } | null>(null);

  const st = useRef({
    words: [] as Fall[],
    nextId: 1,
    shield: 100,
    score: 0,
    combo: 0,
    wave: 1,
    cleared: 0,
    targetId: 0,
    strokes: [] as GameStroke[],
    startedAt: 0,
    lastSpawn: 0,
    lastTick: 0,
    rng: mulberry32(Date.now() % 1e9),
  });
  const boardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef(0);
  const endedRef = useRef(false);

  const spawn = useCallback(() => {
    const s = st.current;
    const text = pick(s.rng, pool);
    s.words.push({
      id: s.nextId++, text,
      x: 8 + s.rng() * 84,
      y: -30,
      speed: (kid ? 16 : 26) * (1 + (s.wave - 1) * 0.16) * (0.8 + s.rng() * 0.5),
      hit: 0,
    });
  }, [pool, kid]);

  const endGame = useCallback(() => {
    const s = st.current;
    if (endedRef.current) return;
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

    const interval = Math.max(kid ? 2100 : 1500, (kid ? 3400 : 2600) - s.wave * 160);
    if (t - s.lastSpawn > interval && s.words.filter((w) => !w.popping).length < 3 + s.wave) {
      s.lastSpawn = t;
      spawn();
    }
    for (const w of s.words) {
      if (w.popping) continue;
      w.y += w.speed * dt;
      if (w.y > h - 74) {
        w.popping = true;
        s.shield -= 12;
        s.combo = 0;
        if (s.targetId === w.id) s.targetId = 0;
        if (data?.settings.soundOn) snd.err();
        setTimeout(() => { s.words = s.words.filter((x) => x.id !== w.id); }, 60);
      }
    }
    if (s.shield <= 0) { endGame(); return; }
    force((n) => n + 1);
  }, [spawn, endGame, kid, data?.settings.soundOn]);

  const start = () => {
    st.current = { ...st.current, words: [], shield: 100, score: 0, combo: 0, wave: 1, cleared: 0, targetId: 0, strokes: [], startedAt: performance.now(), lastSpawn: 0, lastTick: performance.now(), nextId: 1 };
    endedRef.current = false;
    setPhase('run');
    setTimeout(() => inputRef.current?.focus(), 50);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => loop(performance.now()), 33);
  };

  useEffect(() => () => window.clearInterval(timer.current), []);

  const handleKey = (key: string) => {
    const s = st.current;
    if (key.length !== 1 || phase !== 'run') return;
    const t = performance.now();
    let target = s.words.find((w) => w.id === s.targetId && !w.popping);
    if (!target) {
      const candidates = s.words.filter((w) => !w.popping && w.text[0] === key).sort((a, b) => b.y - a.y);
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
      if (target.hit >= target.text.length) {
        target.popping = true;
        s.targetId = 0;
        s.cleared++;
        s.combo++;
        s.score += Math.round(target.text.length * 10 * (1 + Math.min(1.5, s.combo * 0.08)));
        if (data?.settings.soundOn) snd.pop();
        if (s.cleared % 10 === 0) {
          s.wave++;
          s.shield = Math.min(100, s.shield + 8);
          if (data?.settings.soundOn) snd.step();
        }
        const id = target.id;
        setTimeout(() => { s.words = s.words.filter((x) => x.id !== id); }, 380);
      }
    } else {
      s.strokes.push({ t, exp: want, ok: false });
      s.combo = 0;
      s.shield -= 1.5;
      if (data?.settings.soundOn) snd.err();
    }
  };

  if (!data) return null;
  const s = st.current;

  return (
    <div className="train-page" onClick={() => inputRef.current?.focus()}>
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
        <div className="game-board" ref={boardRef} style={{ minHeight: 440 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="shield" size={50} />
              <h2>Defend the Lantern City</h2>
              <p className="muted" style={{ maxWidth: 460 }}>
                Words drift down. Type one to lock on, finish it to dissolve it in light.
                Wrong keys drain the shield a little — words landing drain it a lot.
                <strong> Calm accuracy beats frantic speed.</strong>
              </p>
              {data.gameBests['wordfall'] && <Chip tone="gold">Personal best: {data.gameBests['wordfall'].score}</Chip>}
              <Btn big onClick={start}>Raise the shield →</Btn>
            </div>
          )}
          {phase === 'run' && (
            <>
              {s.words.map((w) => (
                <span
                  key={w.id}
                  className={`wf-word ${w.id === s.targetId ? 'wf-target' : ''} ${w.popping ? 'wf-pop' : ''}`}
                  style={{ left: `${w.x}%`, top: w.y }}
                >
                  <span className="hit">{w.text.slice(0, w.hit)}</span>{w.text.slice(w.hit)}
                </span>
              ))}
              <div className="wf-shield">
                <span className="wf-city" aria-hidden><Ic n="lamp" size={22} /><Ic n="house" size={22} /><Ic n="landmark" size={22} /><Ic n="house" size={22} /><Ic n="lamp" size={22} /></span>
              </div>
            </>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over">
              <Ic n={overInfo.newBest ? 'trophy' : 'rainbow'} size={46} />
              <h2>{overInfo.newBest ? 'New personal best!' : 'The city rests'}</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={overInfo.score} l="score" tone="accent" />
                <Stat v={overInfo.wave} l="wave" />
                <Stat v={`${overInfo.acc}%`} l="accuracy" />
              </div>
              <RewardsBanner rewards={overInfo.rewards} />
              <p className="small muted" style={{ maxWidth: 420 }}>
                {overInfo.acc >= 95 ? 'Beautiful defence — your calm under pressure is real.' : 'Tip: it is faster to type each word once, correctly, than twice in a panic.'}
              </p>
              <div className="row gap">
                <Btn onClick={start}>↻ Defend again</Btn>
                <Btn kind="soft" to="/app/games">All games</Btn>
              </div>
            </div>
          )}
        </div>
        {phase === 'run' && (
          <div className="game-typebar">
            <span className="muted small">Type the falling words — first letter locks your target</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef} className="ghost-input" aria-label="Game typing input"
        onKeyDown={(e) => { if (!e.metaKey && !e.ctrlKey && e.key.length === 1) { handleKey(e.key); e.preventDefault(); } if (e.key === 'Escape') endGame(); }}
        onInput={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; for (const ch of v) handleKey(ch); }}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
      />
    </div>
  );
}
