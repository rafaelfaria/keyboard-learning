import { useMemo, useRef, useState } from 'react';
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

const HEAT_SECONDS = 15;
const CUTS = [2, 2, 2, 1]; // eliminated per heat → 8 → 6 → 4 → 2 → champion

interface Entrant { name: string; avatar: number; you?: boolean; wpm: number; score: number; out: boolean; outHeat?: number }

export default function SurvivorGame() {
  const data = useData();
  const nav = useNavigate();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const rng = useRef(mulberry32(Date.now() % 1e9));
  const pool = useMemo(() => (kid ? KID_WORDS : COMMON_WORDS.filter((w) => w.length >= 3 && w.length <= 8)), [kid]);

  const [phase, setPhase] = useState<'intro' | 'heat' | 'interlude' | 'over'>('intro');
  const [heat, setHeat] = useState(1);
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [stream, setStream] = useState<string[]>([]);
  const [wordIdx, setWordIdx] = useState(0);
  const [pos, setPos] = useState(0);
  const [heatScore, setHeatScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(HEAT_SECONDS);
  const [interludeMsg, setInterludeMsg] = useState('');
  const [overInfo, setOverInfo] = useState<{ place: number; champion: boolean; rewards: Rewards | null } | null>(null);
  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const heatStart = useRef(0);
  const timer = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const makeEntrants = (): Entrant[] => {
    const base = data ? Math.max(12, recentAvgWpm(data)) : 25;
    const names = pickN(rng.current, RACER_NAMES, 7);
    const rivals: Entrant[] = names.map((n) => ({
      name: n, avatar: avatarIndexFor(n),
      wpm: Math.max(8, base * (0.62 + rng.current() * 0.75)),
      score: 0, out: false,
    }));
    return [
      { name: data?.profile.name ?? 'You', avatar: 0, you: true, wpm: base, score: 0, out: false },
      ...rivals,
    ];
  };

  const startMatch = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    setEntrants(makeEntrants());
    setHeat(1);
    startHeat(1);
  };

  const startHeat = (h: number) => {
    setStream(Array.from({ length: 60 }, () => pick(rng.current, pool)));
    setWordIdx(0); setPos(0); setHeatScore(0);
    setTimeLeft(HEAT_SECONDS);
    setPhase('heat');
    heatStart.current = performance.now();
    setTimeout(() => inputRef.current?.focus(), 40);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      const left = HEAT_SECONDS - (performance.now() - heatStart.current) / 1000;
      setTimeLeft(Math.max(0, left));
      if (left <= 0) resolveHeat(h);
    }, 200);
  };

  const resolveHeat = (h: number) => {
    window.clearInterval(timer.current);
    setEntrants((prev) => {
      const alive = prev.filter((e) => !e.out);
      const toughen = 1 + (h - 1) * 0.06;
      const updated = prev.map((e) => {
        if (e.out) return e;
        if (e.you) return { ...e, score: heatScoreRef.current };
        const chars = (e.wpm * 5 / 60) * HEAT_SECONDS * toughen * (0.8 + rng.current() * 0.4);
        return { ...e, score: Math.round(chars) };
      });
      const aliveSorted = updated.filter((e) => !e.out).sort((a, b) => a.score - b.score);
      const cut = Math.min(CUTS[h - 1] ?? 1, aliveSorted.length - 1);
      const dropped = aliveSorted.slice(0, cut);
      const next = updated.map((e) => dropped.some((d) => d.name === e.name) ? { ...e, out: true, outHeat: h } : e);
      const youOut = dropped.some((d) => d.you);
      const remaining = next.filter((e) => !e.out);

      if (youOut || remaining.length <= 1) {
        finishMatch(next, youOut ? alive.length : 1, h);
      } else {
        setInterludeMsg(dropped.length ? `${dropped.map((d) => d.name).join(' and ')} head${dropped.length === 1 ? 's' : ''} to the cheer bench` : '');
        setPhase('interlude');
        if (data?.settings.soundOn) snd.step();
        setTimeout(() => { setHeat(h + 1); startHeat(h + 1); }, 2600);
      }
      return next;
    });
  };

  // keep latest heat score readable inside resolveHeat's state updater
  const heatScoreRef = useRef(0);
  heatScoreRef.current = heatScore;

  const finishMatch = (finalEntrants: Entrant[], place: number, lastHeat: number) => {
    const champion = place === 1;
    const result = resultFromStrokes('game', 'Survivor Sprint', strokes.current, startedAt.current, performance.now(), { game: 'survivor', place, heats: lastHeat });
    const rewards = strokes.current.length > 10 ? recordSession(result) : null;
    patch((d) => {
      const cur = d.gameBests['survivor'];
      const score = (9 - place) * 100 + Math.round(result.wpm);
      if (!cur || score > cur.score) d.gameBests['survivor'] = { score, level: 9 - place };
    });
    if (champion) pushToast({ kind: 'record', icon: 'crown', title: 'Last typist standing!' });
    if (data?.settings.soundOn) (champion ? snd.badge() : snd.done());
    setOverInfo({ place, champion, rewards });
    setPhase('over');
  };

  const handleKey = (key: string) => {
    if (phase !== 'heat' || key.length !== 1) return;
    const word = stream[wordIdx] ?? '';
    const want = pos >= word.length ? ' ' : word[pos];
    const ok = key === want;
    strokes.current.push({ t: performance.now(), exp: want, ok });
    if (ok) {
      if (data?.settings.soundOn) snd.key();
      if (want === ' ') { setWordIdx((i) => i + 1); setPos(0); setHeatScore((s) => s + 1); }
      else { setPos((p) => p + 1); setHeatScore((s) => s + 1); }
    } else if (data?.settings.soundOn) snd.err();
  };

  if (!data) return null;
  const word = stream[wordIdx] ?? '';
  const alive = entrants.filter((e) => !e.out);

  return (
    <div className="train-page" onClick={() => inputRef.current?.focus()}>
      <div className="train-top">
        <Btn kind="ghost" onClick={() => { window.clearInterval(timer.current); nav('/app/games'); }} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="crown" size={20} /> Survivor Sprint</h1>
        <Chip tone="accent">Trains: consistency under pressure</Chip>
      </div>

      <div className="game-frame">
        {phase === 'heat' && (
          <div className="game-hud">
            <span>Heat {heat}</span>
            <span>{alive.length} typists left</span>
            <span>Chars {heatScore}</span>
            <span className="grow" />
            <span className={timeLeft < 5 ? 'bad' : ''}>{Math.ceil(timeLeft)}s</span>
          </div>
        )}
        <div className="game-board" style={{ minHeight: 400 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="crown" size={52} />
              <h2>Eight typists. One crown.</h2>
              <p className="muted" style={{ maxWidth: 480 }}>
                Four rapid 15-second heats. After each, the slowest typists move to the <strong>cheer bench</strong> —
                no shame, instant rematch. Survive every cut and the final duel to take the crown.
                Rivals are matched to your recent pace.
              </p>
              {data.gameBests['survivor'] && <Chip tone="gold">Best: {data.gameBests['survivor'].level >= 8 ? 'Champion' : `Top ${9 - data.gameBests['survivor'].level}`}</Chip>}
              <Btn big onClick={startMatch}>Take your lane →</Btn>
            </div>
          )}
          {(phase === 'heat' || phase === 'interlude') && (
            <div className="surv-stage">
              {phase === 'interlude' && (
                <div className="race-countdown" style={{ fontSize: '1.4rem', padding: '0 20px', textAlign: 'center' }}>
                  {interludeMsg || 'Next heat…'}<br /><span className="muted small">heat {heat + 1} begins…</span>
                </div>
              )}
              <div className="surv-word">
                <span className="good">{word.slice(0, pos)}</span>
                <span className="duel-cur">{word[pos] ?? '␣'}</span>
                <span className="muted">{word.slice(pos + 1)}</span>
                <span className="muted surv-next"> {stream[wordIdx + 1]} {stream[wordIdx + 2]}</span>
              </div>
              <div className="surv-board">
                {[...entrants].sort((a, b) => Number(a.out) - Number(b.out) || b.score - a.score).map((e) => (
                  <div key={e.name} className={`surv-row ${e.out ? 'surv-out' : ''} ${e.you ? 'surv-you' : ''}`}>
                    {e.you ? <Avatar v={data.profile.avatar} size={20} /> : <BlockAvatar preset={e.avatar} size={20} />}
                    <span className="surv-name">{e.you ? 'You' : e.name}</span>
                    {e.out
                      ? <span className="small muted">cheering from heat {e.outHeat}</span>
                      : <span className="hbl-track" style={{ flex: 1 }}><span className="hbl-fill" style={{ width: `${Math.min(100, ((e.you ? heatScore : e.score) / Math.max(20, (recentAvgWpm(data) * 5 / 60) * HEAT_SECONDS * 1.4)) * 100)}%`, background: e.you ? 'var(--accent)' : 'var(--accent2)' }} /></span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over">
              <Ic n={overInfo.champion ? 'crown' : 'heart'} size={48} />
              <h2>{overInfo.champion ? 'Last typist standing!' : `Benched in place ${overInfo.place}`}</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={overInfo.place} l="finish" tone={overInfo.champion ? 'good' : undefined} />
                <Stat v={heat} l="heats survived" />
              </div>
              <RewardsBanner rewards={overInfo.rewards} />
              <p className="small muted" style={{ maxWidth: 430 }}>
                {overInfo.champion ? 'Consistency wins crowns. Take that steadiness into a ranked-style speed sprint!' : 'The bench cheers loudest for rematches — every heat you survive raises your floor.'}
              </p>
              <div className="row gap">
                <Btn onClick={startMatch}>↻ New tournament</Btn>
                <Btn kind="soft" to="/app/games">All games</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
      <input
        ref={inputRef} className="ghost-input" aria-label="Survivor typing input"
        onKeyDown={(e) => { if (!e.metaKey && !e.ctrlKey && e.key.length === 1) { handleKey(e.key); e.preventDefault(); } if (e.key === 'Escape' && phase === 'heat') resolveHeat(heat); }}
        onInput={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; for (const ch of v) handleKey(ch); }}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
      />
    </div>
  );
}
