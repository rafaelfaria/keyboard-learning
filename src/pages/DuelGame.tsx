import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS, RACER_NAMES } from '../lib/words';
import { mulberry32, pick, pickN, avatarIndexFor } from '../lib/rng';
import { recentAvgWpm, PACE_MIN, PACE_MAX } from '../lib/challenge';
import { Btn, Chip, Stat } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { Ic } from '../components/icons';
import { Avatar, BlockAvatar } from '../components/avatars';
import type { Rewards } from '../lib/types';

const TARGET_WINS = 4;

type Diff = 'gentle' | 'steady' | 'sharp' | 'fierce' | 'matched';

/** Absolute pace tiers, so a rival is never derived from one fluky session. */
const DIFFS: { id: Diff; name: string; wpm: number; icon: string; desc: string }[] = [
  { id: 'gentle', name: 'Gentle', wpm: 18, icon: 'sprout', desc: 'Learning the format' },
  { id: 'steady', name: 'Steady', wpm: 30, icon: 'moon', desc: 'Everyday typist' },
  { id: 'sharp', name: 'Sharp', wpm: 48, icon: 'sparkles', desc: 'Confident and quick' },
  { id: 'fierce', name: 'Fierce', wpm: 70, icon: 'flame', desc: 'Bring your best burst' },
  { id: 'matched', name: 'Matched', wpm: 0, icon: 'sliders', desc: 'Tracks your own pace' },
];

/** A duel is short bursts against a rival that never truly mistypes, so the
 *  matched tier is capped where a human can still realistically out-sprint it. */
const MATCHED_CAP = 90;

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
    return { name, avatar: avatarIndexFor(name) };
  }, [data?.profile.id]);

  const basePace = data ? recentAvgWpm(data) : 25;
  const matchedWpm = Math.round(Math.max(PACE_MIN + 4, Math.min(MATCHED_CAP, basePace)));
  const paceOf = (d: Diff) => (d === 'matched' ? matchedWpm : DIFFS.find((x) => x.id === d)!.wpm);
  // Default to the tier just below the learner's pace, so the first duel is winnable.
  const [diff, setDiff] = useState<Diff>(() => {
    const p = data ? recentAvgWpm(data) : 25;
    if (p < 24) return 'gentle';
    if (p < 40) return 'steady';
    if (p < 60) return 'sharp';
    return 'fierce';
  });
  const rivalWpm = paceOf(diff);

  const [phase, setPhase] = useState<'intro' | 'ready' | 'live' | 'roundEnd' | 'over'>('intro');
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState({ you: 0, rival: 0 });
  const [phrase, setPhrase] = useState('');
  const [pos, setPos] = useState(0);
  const [rivalPos, setRivalPos] = useState(0);
  const [banner, setBanner] = useState('');
  const [overInfo, setOverInfo] = useState<{ won: boolean; rewards: Rewards | null; acc: number; wpm: number } | null>(null);

  // Refs are the source of truth for anything the key handler touches, so no
  // keystroke can be lost to a stale closure when two arrive before a re-render.
  const phraseRef = useRef('');
  const posRef = useRef(0);
  const phaseRef = useRef<typeof phase>('intro');
  const scoresRef = useRef({ you: 0, rival: 0 });
  const rivalWpmRef = useRef(rivalWpm);
  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const roundDone = useRef(false);
  const timer = useRef(0);
  const readyTimer = useRef(0);
  const nextTimer = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  rivalWpmRef.current = rivalWpm;
  const setPhaseBoth = (p: typeof phase) => { phaseRef.current = p; setPhase(p); };

  const clearTimers = () => {
    window.clearInterval(timer.current);
    window.clearTimeout(readyTimer.current);
    window.clearTimeout(nextTimer.current);
  };
  useEffect(() => clearTimers, []);

  const newPhrase = useCallback(() => {
    const pool = (kid ? KID_WORDS : COMMON_WORDS).filter((w) => w.length >= 3 && w.length <= 8);
    const text = pickN(rng.current, pool, kid ? 4 : 6).join(' ');
    phraseRef.current = text;
    posRef.current = 0;
    roundDone.current = false;
    setPhrase(text);
    setPos(0);
    setRivalPos(0);
  }, [kid]);

  const startRound = useCallback(() => {
    clearTimers();
    newPhrase();
    setBanner('');
    setPhaseBoth('ready');
    readyTimer.current = window.setTimeout(() => {
      setPhaseBoth('live');
      setBanner('GO!');
      window.setTimeout(() => setBanner((b) => (b === 'GO!' ? '' : b)), 550);
      inputRef.current?.focus();
      // Rival types on a wall-clock accumulator so its pace is frame-rate independent.
      const startedTick = performance.now();
      let typed = 0;
      let lastTick = startedTick;
      let stunnedUntil = 0;
      timer.current = window.setInterval(() => {
        const now = performance.now();
        const dt = (now - lastTick) / 1000;
        lastTick = now;
        if (now < stunnedUntil) return;
        // occasional human stumble
        if (rng.current() < 0.04) { stunnedUntil = now + 220 + rng.current() * 700; return; }
        const cps = (rivalWpmRef.current * 5) / 60;
        typed += cps * dt * (0.82 + rng.current() * 0.36);
        setRivalPos(Math.floor(typed));
        if (typed >= phraseRef.current.length) endRound(false);
      }, 70);
    }, 1100);
  }, [newPhrase]);

  const endRound = useCallback((youWon: boolean) => {
    if (roundDone.current || phaseRef.current !== 'live') return;
    roundDone.current = true;
    clearTimers();
    const s = {
      you: scoresRef.current.you + (youWon ? 1 : 0),
      rival: scoresRef.current.rival + (youWon ? 0 : 1),
    };
    scoresRef.current = s;
    setScores(s);
    setBanner(youWon ? 'Round yours!' : `${rival.name} takes it`);
    if (data?.settings.soundOn) (youWon ? snd.pop() : snd.err());
    setPhaseBoth('roundEnd');
    nextTimer.current = window.setTimeout(() => {
      if (s.you >= TARGET_WINS || s.rival >= TARGET_WINS) finishMatch(s);
      else { setRound((r) => r + 1); startRound(); }
    }, 1300);
  }, [rival.name, data?.settings.soundOn, startRound]);

  const finishMatch = (s: { you: number; rival: number }) => {
    clearTimers();
    const won = s.you > s.rival;
    const result = resultFromStrokes('game', 'Quill Duel', strokes.current, startedAt.current, performance.now(), { game: 'duel', won, rounds: s.you + s.rival, difficulty: diff });
    const rewards = strokes.current.length > 10 ? recordSession(result) : null;
    patch((d) => {
      const cur = d.gameBests['duel'];
      const score = s.you * 100 + Math.round(result.wpm);
      if (!cur || score > cur.score) d.gameBests['duel'] = { score, level: s.you };
    });
    if (won) pushToast({ kind: 'record', icon: 'swords', title: 'Duel won!', body: `${s.you}–${s.rival} against ${rival.name}` });
    if (data?.settings.soundOn) (won ? snd.badge() : snd.done());
    setOverInfo({ won, rewards, acc: result.acc, wpm: result.wpm });
    setPhaseBoth('over');
  };

  const startMatch = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    scoresRef.current = { you: 0, rival: 0 };
    setScores({ you: 0, rival: 0 });
    setRound(1);
    setOverInfo(null);
    startRound();
  };

  const handleKey = (key: string) => {
    if (phaseRef.current !== 'live' || key.length !== 1) return;
    const text = phraseRef.current;
    const want = text[posRef.current];
    if (want === undefined) return;
    const ok = key === want;
    strokes.current.push({ t: performance.now(), exp: want, ok });
    if (!ok) { if (data?.settings.soundOn) snd.err(); return; }
    posRef.current += 1;
    setPos(posRef.current);
    if (data?.settings.soundOn) snd.key();
    if (posRef.current >= text.length) endRound(true);
  };

  if (!data) return null;
  const running = phase === 'ready' || phase === 'live' || phase === 'roundEnd';
  const myPct = (pos / Math.max(1, phrase.length)) * 100;
  const rivalPct = (Math.min(rivalPos, phrase.length) / Math.max(1, phrase.length)) * 100;

  return (
    <div className="train-page" onClick={() => inputRef.current?.focus()}>
      <div className="train-top">
        <Btn kind="ghost" onClick={() => { clearTimers(); nav('/app/games'); }} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="swords" size={20} /> Quill Duel</h1>
        <Chip tone="accent">Trains: burst speed under pressure</Chip>
      </div>

      <div className="game-frame">
        {running && (
          <div className="game-hud">
            <span className="row gap"><Avatar v={data.profile.avatar} size={22} /> You</span>
            <span className="duel-pips" aria-label={`You ${scores.you}, ${rival.name} ${scores.rival}`}>
              {Array.from({ length: TARGET_WINS }).map((_, i) => <i key={`y${i}`} className={i < scores.you ? 'pip pip-you' : 'pip'} />)}
              <b>vs</b>
              {Array.from({ length: TARGET_WINS }).map((_, i) => <i key={`r${i}`} className={i < scores.rival ? 'pip pip-rival' : 'pip'} />)}
            </span>
            <span className="row gap"><BlockAvatar preset={rival.avatar} size={22} /> {rival.name}</span>
            <span className="grow" />
            <span>Round {round} · first to {TARGET_WINS}</span>
          </div>
        )}
        <div className="game-board" style={{ minHeight: 380 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="swords" size={52} />
              <h2>First to four phrases wins</h2>
              <p className="muted" style={{ maxWidth: 470 }}>
                One short phrase per round — whoever finishes it first takes the round.
                Only correct letters move you forward, so a miss costs you a beat.
                Today's rival is <strong>{rival.name}</strong>.
              </p>
              <div className="duel-diffs" role="radiogroup" aria-label="Rival difficulty">
                {DIFFS.map((d) => (
                  <button
                    key={d.id} type="button"
                    className={`opt-tile ${diff === d.id ? 'on' : ''}`}
                    onClick={() => setDiff(d.id)}
                    aria-pressed={diff === d.id}
                  >
                    <span className="opt-ic"><Ic n={d.icon} size={20} /></span>
                    <span>
                      <strong>{d.name} · {paceOf(d.id)} wpm</strong>
                      <small>{d.desc}</small>
                    </span>
                  </button>
                ))}
              </div>
              <p className="small muted">Pick your rival's pace — your recent pace reads as ~{Math.round(basePace)} wpm.</p>
              {data.gameBests['duel'] && <Chip tone="gold"><Ic n="trophy" size={12} /> Best match score: {data.gameBests['duel'].score}</Chip>}
              <Btn big onClick={startMatch}>Draw quills →</Btn>
            </div>
          )}
          {running && (
            <div className="duel-arena">
              {phase === 'ready' && <div className="race-countdown" style={{ fontSize: '2rem' }}>Round {round}…</div>}
              {banner && phase !== 'ready' && <div className="race-countdown" style={{ fontSize: '2rem' }}>{banner}</div>}
              <div className="duel-lane">
                <Avatar v={data.profile.avatar} size={26} />
                <div className="race-track">
                  <div className="race-trail" style={{ width: `${Math.max(2, myPct)}%` }} />
                  <span className="race-comet" style={{ left: `${Math.max(2, myPct)}%` }} aria-hidden><span className="comet-dot" /></span>
                </div>
                <span className="race-wpm">{Math.round(myPct)}%</span>
              </div>
              <div className="duel-phrase" aria-live="off">
                <span className="good">{phrase.slice(0, pos)}</span>
                <span className="duel-cur">{phrase[pos] === ' ' ? '␣' : phrase[pos] ?? ''}</span>
                <span className="muted">{phrase.slice(pos + 1)}</span>
              </div>
              <div className="duel-lane duel-lane-rival">
                <BlockAvatar preset={rival.avatar} size={26} />
                <div className="duel-ghost">
                  <div className="duel-ghostline" aria-hidden>
                    <span className="gl-done">{phrase.slice(0, Math.min(rivalPos, phrase.length))}</span>
                    <span className={`gl-caret ${phase === 'live' ? 'gl-live' : ''}`} />
                    <span className="gl-rest">{phrase.slice(Math.min(rivalPos, phrase.length))}</span>
                  </div>
                  <div className="race-track duel-ghost-track">
                    <div className="race-trail duel-rival-trail" style={{ width: `${Math.max(2, rivalPct)}%` }} />
                  </div>
                </div>
                <span className="race-wpm">{Math.round(rivalPct)}%</span>
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
                {overInfo.won ? 'Sharp quill! Step up to a fiercer rival when that feels comfortable.' : 'Duels reward a clean first strike — try the Friendly pace, then work up.'}
              </p>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Btn onClick={startMatch}>↻ Rematch</Btn>
                <Btn kind="soft" onClick={() => setPhaseBoth('intro')}>Change rival pace</Btn>
                <Btn kind="ghost" to="/app/games">All games</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
      <input
        ref={inputRef} className="ghost-input" aria-label="Duel typing input"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && running) { clearTimers(); finishMatch(scoresRef.current); return; }
          if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) { handleKey(e.key); e.preventDefault(); }
        }}
        onInput={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; for (const ch of v) handleKey(ch); }}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
      />
    </div>
  );
}
