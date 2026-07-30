import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS, RACER_NAMES } from '../lib/words';
import { mulberry32, pick, pickN, avatarIndexFor } from '../lib/rng';
import { recentAvgWpm } from '../lib/challenge';
import { Btn, Chip, Stat } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { Ic } from '../components/icons';
import { Avatar, BlockAvatar } from '../components/avatars';
import type { Rewards } from '../lib/types';

const TARGET_WINS = 4;

export default function DuelGame() {
  const data = useData();
  const nav = useNavigate();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const rng = useRef(mulberry32(Date.now() % 1e9));
  const rival = useMemo(() => {
    const name = pick(mulberry32(Date.now() % 1e6), RACER_NAMES);
    const base = data ? recentAvgWpm(data) : 25;
    return { name, avatar: avatarIndexFor(name), wpm: Math.max(10, base * (0.85 + Math.random() * 0.3)) };
  }, [data?.profile.id]);

  const [phase, setPhase] = useState<'intro' | 'ready' | 'live' | 'roundEnd' | 'over'>('intro');
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState({ you: 0, rival: 0 });
  const [phrase, setPhrase] = useState('');
  const [pos, setPos] = useState(0);
  const [rivalPos, setRivalPos] = useState(0);
  const [banner, setBanner] = useState('');
  const [overInfo, setOverInfo] = useState<{ won: boolean; rewards: Rewards | null; acc: number; wpm: number } | null>(null);
  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const roundDone = useRef(false);
  const timer = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const newPhrase = useCallback(() => {
    const pool = (kid ? KID_WORDS : COMMON_WORDS).filter((w) => w.length >= 3 && w.length <= 8);
    setPhrase(pickN(rng.current, pool, kid ? 4 : 6).join(' '));
    setPos(0);
    setRivalPos(0);
    roundDone.current = false;
  }, [kid]);

  const startMatch = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    setScores({ you: 0, rival: 0 });
    setRound(1);
    startRound();
  };

  const startRound = () => {
    newPhrase();
    setPhase('ready');
    setBanner('');
    window.clearInterval(timer.current);
    setTimeout(() => {
      setPhase('live');
      setTimeout(() => inputRef.current?.focus(), 40);
      // rival typing simulation
      const cps = (rival.wpm * 5) / 60;
      let acc = 0;
      let stunned = 0;
      timer.current = window.setInterval(() => {
        if (stunned > 0) { stunned--; return; }
        if (Math.random() < 0.05) { stunned = 4 + Math.floor(Math.random() * 8); return; } // stumbles
        acc += cps * 0.08 * (0.75 + Math.random() * 0.55);
        setRivalPos(Math.min(Math.floor(acc), 200));
      }, 80);
    }, 1100);
  };

  const endRound = (youWon: boolean) => {
    if (roundDone.current) return;
    roundDone.current = true;
    window.clearInterval(timer.current);
    const s = { you: scores.you + (youWon ? 1 : 0), rival: scores.rival + (youWon ? 0 : 1) };
    setScores(s);
    setBanner(youWon ? 'Round yours!' : `${rival.name} takes it`);
    if (data?.settings.soundOn) (youWon ? snd.pop() : snd.err());
    setPhase('roundEnd');
    setTimeout(() => {
      if (s.you >= TARGET_WINS || s.rival >= TARGET_WINS) finishMatch(s);
      else { setRound((r) => r + 1); startRound(); }
    }, 1400);
  };

  const finishMatch = (s: { you: number; rival: number }) => {
    const won = s.you > s.rival;
    const result = resultFromStrokes('game', 'Quill Duel', strokes.current, startedAt.current, performance.now(), { game: 'duel', won, rounds: s.you + s.rival });
    const rewards = strokes.current.length > 10 ? recordSession(result) : null;
    patch((d) => {
      const cur = d.gameBests['duel'];
      const score = s.you * 100 + Math.round(result.wpm);
      if (!cur || score > cur.score) d.gameBests['duel'] = { score, level: s.you };
    });
    if (won) pushToast({ kind: 'record', icon: 'swords', title: 'Duel won!', body: `${s.you}–${s.rival} against ${rival.name}` });
    if (data?.settings.soundOn) (won ? snd.badge() : snd.done());
    setOverInfo({ won, rewards, acc: result.acc, wpm: result.wpm });
    setPhase('over');
  };

  useEffect(() => {
    if (phase === 'live' && rivalPos >= phrase.length && phrase.length > 0) endRound(false);
  }, [rivalPos, phase, phrase.length]);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const handleKey = (key: string) => {
    if (phase !== 'live' || key.length !== 1) return;
    const want = phrase[pos];
    if (want === undefined) return;
    const ok = key === want;
    strokes.current.push({ t: performance.now(), exp: want, ok });
    if (ok) {
      if (data?.settings.soundOn) snd.key();
      const p = pos + 1;
      setPos(p);
      if (p >= phrase.length) endRound(true);
    } else if (data?.settings.soundOn) snd.err();
  };

  if (!data) return null;

  return (
    <div className="train-page" onClick={() => inputRef.current?.focus()}>
      <div className="train-top">
        <Btn kind="ghost" onClick={() => { window.clearInterval(timer.current); nav('/app/games'); }} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="swords" size={20} /> Quill Duel</h1>
        <Chip tone="accent">Trains: burst speed under pressure</Chip>
      </div>

      <div className="game-frame">
        {phase !== 'intro' && phase !== 'over' && (
          <div className="game-hud">
            <span className="row gap"><Avatar v={data.profile.avatar} size={22} /> You</span>
            <span className="duel-pips" aria-label={`You ${scores.you} — ${scores.rival} ${rival.name}`}>
              {Array.from({ length: TARGET_WINS }).map((_, i) => <i key={`y${i}`} className={i < scores.you ? 'pip pip-you' : 'pip'} />)}
              <b>vs</b>
              {Array.from({ length: TARGET_WINS }).map((_, i) => <i key={`r${i}`} className={i < scores.rival ? 'pip pip-rival' : 'pip'} />)}
            </span>
            <span className="row gap"><BlockAvatar preset={rival.avatar} size={22} /> {rival.name}</span>
            <span className="grow" />
            <span>Round {round}</span>
          </div>
        )}
        <div className="game-board" style={{ minHeight: 380 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="swords" size={52} />
              <h2>First to four phrases wins</h2>
              <p className="muted" style={{ maxWidth: 470 }}>
                A head-to-head duel: one short phrase per round, first typist to finish it takes the round.
                Only correct letters move you forward — a miss costs a beat. Your rival today is
                <strong> {rival.name}</strong> (~{Math.round(rival.wpm)} wpm), matched to your recent pace.
              </p>
              {data.gameBests['duel'] && <Chip tone="gold">Best match score: {data.gameBests['duel'].score}</Chip>}
              <Btn big onClick={startMatch}>Draw quills →</Btn>
            </div>
          )}
          {(phase === 'ready' || phase === 'live' || phase === 'roundEnd') && (
            <div className="duel-arena">
              {phase === 'ready' && <div className="race-countdown" style={{ fontSize: '2.2rem' }}>Round {round}…</div>}
              {banner && <div className="race-countdown" style={{ fontSize: '2rem' }}>{banner}</div>}
              <div className="duel-lane">
                <Avatar v={data.profile.avatar} size={26} />
                <div className="race-track"><div className="race-trail" style={{ width: `${(pos / Math.max(1, phrase.length)) * 100}%` }} /></div>
              </div>
              <div className="duel-phrase" aria-live="off">
                <span className="good">{phrase.slice(0, pos)}</span>
                <span className="duel-cur">{phrase[pos] === ' ' ? '␣' : phrase[pos] ?? ''}</span>
                <span className="muted">{phrase.slice(pos + 1)}</span>
              </div>
              <div className="duel-lane duel-lane-rival">
                <BlockAvatar preset={rival.avatar} size={26} />
                <div className="race-track"><div className="race-trail duel-rival-trail" style={{ width: `${(Math.min(rivalPos, phrase.length) / Math.max(1, phrase.length)) * 100}%` }} /></div>
              </div>
            </div>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over">
              <Ic n={overInfo.won ? 'trophy' : 'heart'} size={48} />
              <h2>{overInfo.won ? `Victory, ${scores.you}–${scores.rival}!` : `${rival.name} wins ${scores.rival}–${scores.you}`}</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={overInfo.wpm} l="burst wpm" tone="accent" />
                <Stat v={`${overInfo.acc}%`} l="accuracy" />
                <Stat v={`${scores.you}–${scores.rival}`} l="rounds" />
              </div>
              <RewardsBanner rewards={overInfo.rewards} />
              <p className="small muted" style={{ maxWidth: 430 }}>
                {overInfo.won ? 'Sharp quill! Try a harder rival by raising your recent pace.' : 'So close — duels reward clean first strikes. One breath before each round helps.'}
              </p>
              <div className="row gap">
                <Btn onClick={startMatch}>↻ Rematch</Btn>
                <Btn kind="soft" to="/app/games">All games</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
      <input
        ref={inputRef} className="ghost-input" aria-label="Duel typing input"
        onKeyDown={(e) => { if (!e.metaKey && !e.ctrlKey && e.key.length === 1) { handleKey(e.key); e.preventDefault(); } if (e.key === 'Escape' && phase !== 'intro' && phase !== 'over') finishMatch(scores); }}
        onInput={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; for (const ch of v) handleKey(ch); }}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
      />
    </div>
  );
}
