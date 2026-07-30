import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS } from '../lib/words';
import { mulberry32, pick } from '../lib/rng';
import { Btn, Chip, Stat } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { Ic } from '../components/icons';
import { MobileKeys, useGameKeys } from '../components/gamekit';
import { floatText, screenShake } from '../lib/fx';
import gsap from 'gsap';
import type { Rewards } from '../lib/types';

const DURATION = 60;
const COLORS = ['#14d8c4', '#8b7cff', '#ffb454', '#f2789f', '#6fd695', '#5fc9e0'];
const UNIT = 30;           // block height + gap, px — keep in sync with CSS
const SITE_H = 430;

interface Block { id: number; word: string; width: number; color: string; gold: boolean; offset: number }

const HINTS = [
  'Type the blueprint word — the crane drops a block for each one.',
  'Misses shrink the block you are holding. Width = accuracy.',
  'Under 55% is too shaky — it crumbles the top. Breathe, aim clean.',
];

export default function StackGame() {
  const data = useData();
  const nav = useNavigate();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const rng = useRef(mulberry32(Date.now() % 1e9));
  const pool = useMemo(
    () => (kid ? KID_WORDS.filter((w) => w.length >= 3) : COMMON_WORDS.filter((w) => w.length >= 4 && w.length <= 9)),
    [kid],
  );

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [word, setWord] = useState('');
  const [nextWord, setNextWord] = useState('');
  const [pos, setPos] = useState(0);
  const [wordErrs, setWordErrs] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [wobble, setWobble] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [wordsDone, setWordsDone] = useState(0);
  const [overInfo, setOverInfo] = useState<{ score: number; height: number; gold: number; rewards: Rewards | null; newBest: boolean } | null>(null);

  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const wordStart = useRef(0);
  const nextId = useRef(1);
  const timer = useRef(0);
  const siteRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  const st = useRef({ word: '', next: '', pos: 0, errs: 0, crumbling: false });
  phaseRef.current = phase;

  const newWord = () => {
    const s = st.current;
    s.word = s.next || pick(rng.current, pool);
    s.next = pick(rng.current, pool);
    s.pos = 0; s.errs = 0;
    setWord(s.word); setNextWord(s.next); setPos(0); setWordErrs(0);
    wordStart.current = performance.now();
  };

  const start = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    st.current.next = '';
    st.current.crumbling = false;
    setBlocks([]); setTimeLeft(DURATION); setWordsDone(0);
    nextId.current = 1;
    newWord();
    setPhase('run');
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      const left = DURATION - (performance.now() - startedAt.current) / 1000;
      setTimeLeft(Math.max(0, left));
      if (left <= 0) endGame();
    }, 250);
  };

  const scoreOf = (bs: Block[]) => Math.round(bs.reduce((a, b) => a + b.width, 0) + bs.length * 10 + bs.filter((b) => b.gold).length * 25);

  const endGame = () => {
    window.clearInterval(timer.current);
    if (phaseRef.current !== 'run') return;
    setBlocks((bs) => {
      const score = scoreOf(bs);
      const result = resultFromStrokes('game', 'Block Stack', strokes.current, startedAt.current, performance.now(), { game: 'stack', score, height: bs.length });
      const rewards = strokes.current.length > 8 ? recordSession(result) : null;
      let newBest = false;
      patch((d) => {
        const cur = d.gameBests['stack'];
        if (!cur || score > cur.score) { d.gameBests['stack'] = { score, level: bs.length }; newBest = true; }
      });
      if (newBest) pushToast({ kind: 'record', icon: 'blocks', title: 'Tallest tower yet!' });
      setOverInfo({ score, height: bs.length, gold: bs.filter((b) => b.gold).length, rewards, newBest });
      return bs;
    });
    setPhase('over');
  };

  const crumbleTop = () => {
    const s = st.current;
    s.crumbling = true;
    setWobble(true);
    const site = siteRef.current;
    if (site) {
      screenShake(site, 7);
      floatText(site, 'crumble!', site.clientWidth / 2, site.clientHeight * 0.4, 'fx-bad');
      const els = [...site.querySelectorAll<HTMLElement>('.stack-block')].slice(-2);
      els.forEach((el, i) => {
        gsap.to(el, {
          x: (i % 2 ? 1 : -1) * (60 + Math.random() * 60),
          y: 140 + Math.random() * 80,
          rotation: (Math.random() - 0.5) * 120,
          opacity: 0, duration: 0.55, ease: 'power2.in',
        });
      });
    }
    if (data?.settings.soundOn) snd.err();
    window.setTimeout(() => {
      setBlocks((bs) => bs.slice(0, Math.max(0, bs.length - 2)));
      setWobble(false);
      s.crumbling = false;
    }, 560);
  };

  const placeBlock = () => {
    const s = st.current;
    const secs = (performance.now() - wordStart.current) / 1000;
    const width = Math.max(30, 100 - s.errs * 15);
    const gold = s.errs === 0 && secs < (kid ? 4.5 : 2.8);
    setWordsDone((n) => n + 1);
    if (width < 55) {
      crumbleTop();
    } else {
      setBlocks((bs) => [...bs, {
        id: nextId.current++,
        word: s.word, width, gold,
        color: gold ? 'var(--gold)' : COLORS[nextId.current % COLORS.length],
        offset: (rng.current() - 0.5) * (100 - width) * 0.4,
      }]);
      if (data?.settings.soundOn) (gold ? snd.step() : snd.pop());
      window.setTimeout(() => {
        const site = siteRef.current;
        const el = site?.querySelector<HTMLElement>('.stack-column .stack-block:last-of-type');
        if (el) gsap.fromTo(el, { y: -SITE_H, opacity: 0.75 }, { y: 0, opacity: 1, duration: 0.5, ease: 'bounce.out' });
        if (gold && site) floatText(site, 'perfect!', site.clientWidth * 0.5, 90, 'fx-score');
      }, 20);
    }
    newWord();
  };

  const handleKey = (key: string) => {
    const s = st.current;
    if (phaseRef.current !== 'run' || key.length !== 1 || s.crumbling) return;
    const want = s.word[s.pos];
    if (want === undefined) return;
    const ok = key === want;
    strokes.current.push({ t: performance.now(), exp: want, ok });
    if (ok) {
      if (data?.settings.soundOn) snd.key();
      if (s.pos + 1 >= s.word.length) placeBlock();
      else { s.pos += 1; setPos(s.pos); }
    } else {
      s.errs += 1;
      setWordErrs(s.errs);
      if (data?.settings.soundOn) snd.err();
    }
  };

  useGameKeys(phase === 'run', handleKey, { onEscape: endGame });
  useEffect(() => () => window.clearInterval(timer.current), []);

  if (!data) return null;
  const height = blocks.length;
  const goldCount = blocks.filter((b) => b.gold).length;
  const hint = wordsDone < HINTS.length ? HINTS[wordsDone] : '';
  const previewWidth = Math.max(30, 100 - wordErrs * 15);
  const camera = Math.max(0, (height + 1) * UNIT + 56 - SITE_H);
  const bestLevel = data.gameBests['stack']?.level ?? 0;
  const floors = Math.max(Math.ceil((height + 6) / 5) * 5, 15);

  return (
    <div className="train-page">
      <div className="train-top">
        <Btn kind="ghost" onClick={() => { window.clearInterval(timer.current); nav('/app/games'); }} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="blocks" size={20} /> Block Stack</h1>
        <Chip tone="accent">Trains: word-perfect precision</Chip>
      </div>

      <div className="game-frame">
        {phase === 'run' && (
          <div className="game-hud">
            <span>Height {height}</span>
            <span>Gold {goldCount}</span>
            {bestLevel > 0 && <span className="muted">best {bestLevel}</span>}
            <span className="grow" />
            <span className={timeLeft < 10 ? 'bad' : ''}>{Math.ceil(timeLeft)}s</span>
          </div>
        )}
        <div className="game-board" style={{ minHeight: 470 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="blocks" size={50} />
              <h2>Build the word tower</h2>
              <p className="muted" style={{ maxWidth: 470 }}>
                Type the blueprint on the left and the crane drops a block on the right —
                <strong> clean words drop wide, steady blocks</strong>, each miss shaves 15% off the one you're holding.
                Under 55% it crumbles the top of the tower. Perfect + quick = <strong>gold</strong>.
              </p>
              {data.gameBests['stack'] && <Chip tone="gold"><Ic n="trophy" size={12} /> Tallest: {data.gameBests['stack'].level} blocks · {data.gameBests['stack'].score} pts</Chip>}
              <Btn big onClick={start}>Lay the first block →</Btn>
            </div>
          )}
          {phase === 'run' && (
            <div className="stack-split">
              <div className="stack-typepanel">
                <p className="muted small">blueprint</p>
                <div className="stack-word">
                  <span className="good">{word.slice(0, pos)}</span>
                  <span className="duel-cur">{word[pos] ?? ''}</span>
                  <span className="muted">{word.slice(pos + 1)}</span>
                </div>
                <div className="row gap wrap" style={{ justifyContent: 'center', minHeight: 30 }}>
                  {wordErrs > 0
                    ? <Chip tone="warn">block −{wordErrs * 15}% → {previewWidth}%</Chip>
                    : <Chip tone="good"><Ic n="check" size={12} /> clean block</Chip>}
                </div>
                <p className="muted small">then: {nextWord}</p>
                {hint && <p className="stack-hint muted small"><Ic n="bulb" size={13} /> {hint}</p>}
              </div>

              <div className={`stack-site ${wobble ? 'stack-wobble' : ''}`} ref={siteRef} style={{ height: SITE_H }}>
                <div className="stack-crane2" aria-hidden>
                  <span className="stack-crane-arm" />
                  <span className="stack-crane-cable" />
                  <div className={`stack-preview ${wordErrs === 0 ? 'stack-preview-clean' : ''}`} style={{ width: `${previewWidth * 0.8}%` }}>
                    {previewWidth}%
                  </div>
                </div>
                <div className="stack-world" style={{ transform: `translateY(${camera}px)` }}>
                  <div className="stack-marks" aria-hidden>
                    {Array.from({ length: Math.floor(floors / 5) }).map((_, i) => {
                      const lvl = (i + 1) * 5;
                      return <span key={lvl} className="stack-mark" style={{ bottom: lvl * UNIT + 14 }}>{lvl}</span>;
                    })}
                    {bestLevel > 0 && (
                      <span className="stack-bestline" style={{ bottom: bestLevel * UNIT + 14 }}>
                        <i /><em>best {bestLevel}</em>
                      </span>
                    )}
                  </div>
                  <div className="stack-column">
                    {blocks.map((b) => (
                      <div
                        key={b.id}
                        className={`stack-block ${b.gold ? 'stack-gold' : ''}`}
                        style={{ width: `${b.width * 0.82}%`, background: b.color, marginLeft: `${b.offset}%` }}
                      >{b.word}</div>
                    ))}
                    <div className="stack-ground" />
                  </div>
                </div>
              </div>
            </div>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over">
              <Ic n={overInfo.newBest ? 'trophy' : 'blocks'} size={46} />
              <h2>{overInfo.newBest ? 'Tallest tower yet!' : `A ${overInfo.height}-block tower`}</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={overInfo.score} l="score" tone="accent" />
                <Stat v={overInfo.height} l="height" />
                <Stat v={overInfo.gold} l="gold blocks" />
              </div>
              <RewardsBanner rewards={overInfo.rewards} />
              <p className="small muted" style={{ maxWidth: 430 }}>Wide towers come from patience: finish each word cleanly before reaching for the next.</p>
              <div className="row gap">
                <Btn onClick={start}>↻ Build again</Btn>
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
