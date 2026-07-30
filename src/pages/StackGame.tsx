import { useMemo, useRef, useState } from 'react';
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

const DURATION = 60;
const COLORS = ['#14d8c4', '#8b7cff', '#ffb454', '#f2789f', '#6fd695', '#5fc9e0'];

interface Block { id: number; word: string; width: number; color: string; gold: boolean; offset: number }

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
  const [pos, setPos] = useState(0);
  const [wordErrs, setWordErrs] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [wobble, setWobble] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [overInfo, setOverInfo] = useState<{ score: number; height: number; gold: number; rewards: Rewards | null; newBest: boolean } | null>(null);
  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const wordStart = useRef(0);
  const nextId = useRef(1);
  const timer = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const newWord = () => {
    setWord(pick(rng.current, pool));
    setPos(0);
    setWordErrs(0);
    wordStart.current = performance.now();
  };

  const start = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    setBlocks([]); setTimeLeft(DURATION);
    nextId.current = 1;
    newWord();
    setPhase('run');
    setTimeout(() => inputRef.current?.focus(), 40);
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
    setPhase((p) => {
      if (p !== 'run') return p;
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
      return 'over';
    });
  };

  const placeBlock = () => {
    const secs = (performance.now() - wordStart.current) / 1000;
    const width = Math.max(30, 100 - wordErrs * 15);
    const gold = wordErrs === 0 && secs < (kid ? 4.5 : 2.8);
    if (width < 55) {
      // shaky block: the top of the tower crumbles a little
      setWobble(true);
      setTimeout(() => setWobble(false), 500);
      setBlocks((bs) => bs.slice(0, Math.max(0, bs.length - 2)));
      if (data?.settings.soundOn) snd.err();
    } else {
      setBlocks((bs) => [...bs, {
        id: nextId.current++,
        word, width, gold,
        color: gold ? 'var(--gold)' : COLORS[nextId.current % COLORS.length],
        offset: (rng.current() - 0.5) * (100 - width) * 0.5,
      }]);
      if (data?.settings.soundOn) (gold ? snd.step() : snd.pop());
    }
    newWord();
  };

  const handleKey = (key: string) => {
    if (phase !== 'run' || key.length !== 1) return;
    const want = word[pos];
    if (want === undefined) return;
    const ok = key === want;
    strokes.current.push({ t: performance.now(), exp: want, ok });
    if (ok) {
      if (data?.settings.soundOn) snd.key();
      const p = pos + 1;
      if (p >= word.length) placeBlock();
      else setPos(p);
    } else {
      setWordErrs((e) => e + 1);
      if (data?.settings.soundOn) snd.err();
    }
  };

  if (!data) return null;
  const height = blocks.length;

  return (
    <div className="train-page" onClick={() => inputRef.current?.focus()}>
      <div className="train-top">
        <Btn kind="ghost" onClick={() => { window.clearInterval(timer.current); nav('/app/games'); }} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="blocks" size={20} /> Block Stack</h1>
        <Chip tone="accent">Trains: word-perfect precision</Chip>
      </div>

      <div className="game-frame">
        {phase === 'run' && (
          <div className="game-hud">
            <span>Height {height}</span>
            <span>Gold {blocks.filter((b) => b.gold).length}</span>
            <span className="grow" />
            <span className={timeLeft < 10 ? 'bad' : ''}>{Math.ceil(timeLeft)}s</span>
          </div>
        )}
        <div className="game-board" style={{ minHeight: 420 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="blocks" size={52} />
              <h2>Build the word tower</h2>
              <p className="muted" style={{ maxWidth: 470 }}>
                Every word you type becomes a block — <strong>clean words make wide, steady blocks</strong>,
                each miss shaves 15% off. Blocks under 55% are too shaky and crumble the top of your tower.
                Perfect + quick = <strong>gold</strong>.
              </p>
              {data.gameBests['stack'] && <Chip tone="gold">Tallest: {data.gameBests['stack'].level} blocks · {data.gameBests['stack'].score} pts</Chip>}
              <Btn big onClick={start}>Lay the first block →</Btn>
            </div>
          )}
          {phase === 'run' && (
            <div className="stack-stage">
              <div className="stack-word">
                <span className="good">{word.slice(0, pos)}</span>
                <span className="duel-cur">{word[pos] ?? ''}</span>
                <span className="muted">{word.slice(pos + 1)}</span>
                {wordErrs > 0 && <Chip tone="warn" className="chip">−{wordErrs * 15}%</Chip>}
              </div>
              <div className={`stack-tower ${wobble ? 'stack-wobble' : ''}`} aria-label={`Tower height ${height}`}>
                {blocks.slice(-12).map((b) => (
                  <div
                    key={b.id}
                    className={`stack-block ${b.gold ? 'stack-gold' : ''}`}
                    style={{ width: `${b.width * 0.9}%`, background: b.color, transform: `translateX(${b.offset}%)` }}
                  >{b.word}</div>
                ))}
                <div className="stack-ground" />
              </div>
            </div>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over">
              <Ic n={overInfo.newBest ? 'trophy' : 'blocks'} size={48} />
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
      <input
        ref={inputRef} className="ghost-input" aria-label="Stack typing input"
        onKeyDown={(e) => { if (!e.metaKey && !e.ctrlKey && e.key.length === 1) { handleKey(e.key); e.preventDefault(); } if (e.key === 'Escape' && phase === 'run') endGame(); }}
        onInput={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; for (const ch of v) handleKey(ch); }}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
      />
    </div>
  );
}
