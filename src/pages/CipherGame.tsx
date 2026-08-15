import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS } from '../lib/words';
import { mulberry32, pick, shuffle } from '../lib/rng';
import { Btn, Chip, Stat } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { Ic } from '../components/icons';
import { MobileKeys, useGameKeys } from '../components/gamekit';
import type { Rewards } from '../lib/types';

const DURATION = 75;

function scrambled(rng: () => number, word: string): string {
  let s = word;
  for (let guard = 0; guard < 10 && s === word; guard++) {
    s = shuffle(rng, word.split('')).join('');
  }
  return s;
}

export default function CipherGame() {
  const data = useData();
  const nav = useNavigate();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const rng = useRef(mulberry32(Date.now() % 1e9));
  const pool = useMemo(
    () => (kid ? KID_WORDS.filter((w) => w.length >= 4 && w.length <= 6) : COMMON_WORDS.filter((w) => w.length >= 5 && w.length <= 8)),
    [kid],
  );

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [answer, setAnswer] = useState('');
  const [cipher, setCipher] = useState('');
  const [buffer, setBuffer] = useState('');
  const [revealed, setRevealed] = useState(0);
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState(0);
  const [shake, setShake] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [overInfo, setOverInfo] = useState<{ rewards: Rewards | null; newBest: boolean } | null>(null);
  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const wordShownAt = useRef(0);
  const timer = useRef(0);

  const newPuzzle = () => {
    const w = pick(rng.current, pool);
    setAnswer(w);
    setCipher(scrambled(rng.current, w));
    setBuffer('');
    setRevealed(0);
    wordShownAt.current = performance.now();
  };

  const start = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    setScore(0); setSolved(0); setTimeLeft(DURATION);
    newPuzzle();
    setPhase('run');
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      const left = DURATION - (performance.now() - startedAt.current) / 1000;
      setTimeLeft(Math.max(0, left));
      if (left <= 0) endGame();
    }, 250);
  };

  const endGame = () => {
    window.clearInterval(timer.current);
    setPhase((p) => {
      if (p !== 'run') return p;
      const result = resultFromStrokes('game', 'Cipher Run', strokes.current, startedAt.current, performance.now(), { game: 'cipher', score, solved });
      const rewards = strokes.current.length > 8 ? recordSession(result) : null;
      let newBest = false;
      patch((d) => {
        const cur = d.gameBests['cipher'];
        if (!cur || score > cur.score) { d.gameBests['cipher'] = { score, level: solved }; newBest = true; }
      });
      if (newBest) pushToast({ kind: 'record', icon: 'puzzle', title: 'New Cipher Run best!' });
      setOverInfo({ rewards, newBest });
      return 'over';
    });
  };

  const solve = () => {
    const secs = (performance.now() - wordShownAt.current) / 1000;
    const bonus = Math.max(0, Math.round((8 - secs) * 4));
    setScore((s) => s + answer.length * 12 + bonus);
    setSolved((n) => n + 1);
    if (data?.settings.soundOn) snd.pop();
    newPuzzle();
  };

  const handleKey = (key: string) => {
    if (phase !== 'run') return;
    if (key === 'Backspace') { setBuffer((b) => b.slice(0, -1)); return; }
    if (key.length !== 1 || !/[a-z]/i.test(key)) return;
    const ch = key.toLowerCase();
    // letter must still be available in the answer's remaining multiset
    const remaining = answer.split('');
    for (const c of buffer) {
      const i = remaining.indexOf(c);
      if (i >= 0) remaining.splice(i, 1);
    }
    const okLetter = remaining.includes(ch);
    strokes.current.push({ t: performance.now(), exp: okLetter ? ch : answer[buffer.length] ?? ch, ok: okLetter });
    if (!okLetter) {
      setShake(true);
      setTimeout(() => setShake(false), 220);
      if (data?.settings.soundOn) snd.err();
      return;
    }
    if (data?.settings.soundOn) snd.key();
    const nb = buffer + ch;
    if (nb.length === answer.length) {
      if (nb === answer) { setBuffer(nb); setTimeout(solve, 120); }
      else {
        setBuffer('');
        setShake(true);
        setTimeout(() => setShake(false), 260);
        setScore((s) => Math.max(0, s - 4));
        if (data?.settings.soundOn) snd.err();
      }
    } else {
      setBuffer(nb);
    }
  };

  useGameKeys(phase === 'run', (ch) => handleKey(ch), { onEscape: endGame, onBackspace: () => handleKey('Backspace') });

  const hint = () => {
    if (revealed >= answer.length - 1) return;
    setRevealed((r) => r + 1);
    setBuffer(answer.slice(0, revealed + 1));
    setScore((s) => Math.max(0, s - 15));
    if (data?.settings.soundOn) snd.thock();
  };

  const skip = () => {
    setScore((s) => Math.max(0, s - 8));
    newPuzzle();
    if (data?.settings.soundOn) snd.thock();
  };

  if (!data) return null;

  return (
    <div className="train-page">
      <div className="train-top">
        <Btn kind="ghost" onClick={() => { window.clearInterval(timer.current); nav('/app/games'); }} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="puzzle" size={20} /> Cipher Run</h1>
        <Chip tone="accent">Trains: spelling recall & letter mapping</Chip>
      </div>

      <div className="game-frame">
        {phase === 'run' && (
          <div className="game-hud">
            <span>Score {score}</span>
            <span>Solved {solved}</span>
            <span className="grow" />
            <span className={timeLeft < 12 ? 'bad' : ''}>{Math.ceil(timeLeft)}s</span>
          </div>
        )}
        <div className="game-board" style={{ minHeight: 380 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="puzzle" size={52} />
              <h2>Unscramble the runes</h2>
              <p className="muted" style={{ maxWidth: 470 }}>
                Each cipher is a real word with its letters shuffled. Type the <strong>true word</strong>: 
                only letters the word contains will land. Wrong full guesses bounce. Hints cost 15, skips cost 8.
              </p>
              {data.gameBests['cipher'] && <Chip tone="gold">Personal best: {data.gameBests['cipher'].score}</Chip>}
              <Btn big onClick={start}>Crack the first cipher →</Btn>
            </div>
          )}
          {phase === 'run' && (
            <div className="cipher-stage">
              <p className="muted small">the scrambled rune</p>
              <div className="cipher-word">{cipher.split('').map((c, i) => <span key={i} className="cipher-tile">{c}</span>)}</div>
              <p className="muted small" style={{ marginTop: 18 }}>your answer</p>
              <div className={`cipher-word ${shake ? 'cipher-shake' : ''}`}>
                {answer.split('').map((_, i) => (
                  <span key={i} className={`cipher-tile cipher-slot ${buffer[i] ? 'filled' : ''}`}>{buffer[i] ?? ''}</span>
                ))}
              </div>
              <div className="row gap" style={{ marginTop: 20, justifyContent: 'center' }}>
                <Btn kind="soft" onClick={hint}><Ic n="bulb" size={15} /> Hint (−15)</Btn>
                <Btn kind="ghost" onClick={skip}>Skip (−8)</Btn>
              </div>
            </div>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over">
              <Ic n={overInfo.newBest ? 'trophy' : 'check'} size={48} />
              <h2>{overInfo.newBest ? 'New best decode run!' : 'Ciphers cracked'}</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={score} l="score" tone="accent" />
                <Stat v={solved} l="words decoded" />
              </div>
              <RewardsBanner rewards={overInfo.rewards} />
              <p className="small muted" style={{ maxWidth: 430 }}>Decoding builds the deep letter-map that fast typing sits on. Sneaky, isn't it?</p>
              <div className="row gap">
                <Btn onClick={start}>↻ Run it again</Btn>
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
