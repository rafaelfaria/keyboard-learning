import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS, RACER_NAMES } from '../lib/words';
import { mulberry32, pick, pickN, avatarIndexFor, hashStr } from '../lib/rng';
import { recentAvgWpm } from '../lib/challenge';
import { Btn, Chip, Stat } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { Ic } from '../components/icons';
import { MobileKeys, Runner, useGameKeys } from '../components/gamekit';
import { ANIMAL_START, ANIMAL_COUNT } from '../components/avatars';
import { hopUp, floatText } from '../lib/fx';
import type { Rewards } from '../lib/types';

const HEAT_CLOCKS = [15, 13, 11, 10];         // later heats run hotter
const RIVAL_RAMP = 0.12;                      // rivals toughen 12% per heat
const CUTS = [2, 2, 2, 1]; // 8 → 6 → 4 → 2 → champion

interface Entrant {
  name: string; preset: number; you?: boolean;
  wpm: number; chars: number; out: boolean; outHeat?: number;
}

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
  const [, force] = useState(0);
  const [interludeMsg, setInterludeMsg] = useState('');
  const [overInfo, setOverInfo] = useState<{ place: number; champion: boolean; rewards: Rewards | null } | null>(null);

  const ent = useRef<Entrant[]>([]);
  const stream = useRef<string[]>([]);
  const wordIdx = useRef(0);
  const pos = useRef(0);
  const heatTarget = useRef(100);
  const heatDur = useRef(HEAT_CLOCKS[0]);
  const heatWins = useRef(0);
  const heatStart = useRef(0);
  const startedAt = useRef(0);
  const strokes = useRef<GameStroke[]>([]);
  const timer = useRef(0);
  const phaseRef = useRef(phase);
  const heatRef = useRef(1);
  const boardRef = useRef<HTMLDivElement>(null);
  phaseRef.current = phase;
  heatRef.current = heat;

  const makeEntrants = (): Entrant[] => {
    const base = data ? Math.max(12, recentAvgWpm(data)) : 25;
    const names = pickN(rng.current, RACER_NAMES, 7);
    const rivals: Entrant[] = names.map((n) => ({
      name: n,
      preset: kid ? ANIMAL_START + (hashStr(n) % ANIMAL_COUNT) : avatarIndexFor(n),
      wpm: Math.max(8, base * (0.55 + rng.current() * 0.8)),
      chars: 0, out: false,
    }));
    return [
      { name: 'You', preset: 0, you: true, wpm: base, chars: 0, out: false },
      ...rivals,
    ];
  };

  const startMatch = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    ent.current = makeEntrants();
    heatWins.current = 0;
    setHeat(1);
    heatRef.current = 1;
    startHeat(1);
  };

  const startHeat = (h: number) => {
    // later heats: longer words sneak into the stream (not for the youngest)
    const heatPool = !kid && h >= 3 ? pool.filter((w) => w.length >= 4) : pool;
    stream.current = Array.from({ length: 70 }, () => pick(rng.current, heatPool));
    wordIdx.current = 0;
    pos.current = 0;
    const alive = ent.current.filter((e) => !e.out);
    for (const e of alive) e.chars = 0;
    heatDur.current = HEAT_CLOCKS[h - 1] ?? 10;
    const toughen = 1 + (h - 1) * RIVAL_RAMP;
    const fastest = Math.max(...alive.map((e) => (e.you ? e.wpm : e.wpm * toughen)));
    heatTarget.current = Math.max(30, (fastest * 5 / 60) * heatDur.current * 1.05);
    heatStart.current = performance.now();
    setPhase('heat');
    phaseRef.current = 'heat';
    window.clearInterval(timer.current);
    let last = performance.now();
    timer.current = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      // rivals visibly type through the whole heat
      for (const e of ent.current) {
        if (e.out || e.you) continue;
        if (rng.current() < 0.05) continue; // micro-stumble: skips a beat
        e.chars = Math.min(heatTarget.current, e.chars + (e.wpm * toughen * 5 / 60) * dt * (0.8 + rng.current() * 0.4));
      }
      const left = heatDur.current - (now - heatStart.current) / 1000;
      if (left <= 0) resolveHeat(h);
      else force((n) => n + 1);
    }, 120);
  };

  const resolveHeat = (h: number) => {
    window.clearInterval(timer.current);
    if (phaseRef.current !== 'heat') return;
    const alive = ent.current.filter((e) => !e.out);
    const sorted = [...alive].sort((a, b) => a.chars - b.chars);
    const cut = Math.min(CUTS[h - 1] ?? 1, sorted.length - 1);
    const dropped = sorted.slice(0, cut);
    for (const d of dropped) { d.out = true; d.outHeat = h; }
    const youOut = dropped.some((d) => d.you);
    const remaining = ent.current.filter((e) => !e.out);

    if (youOut || remaining.length <= 1) {
      finishMatch(youOut ? alive.length : 1, h);
    } else {
      setInterludeMsg(`${dropped.map((d) => d.name).join(' and ')} head${dropped.length === 1 ? 's' : ''} to the cheer bench`);
      setPhase('interlude');
      phaseRef.current = 'interlude';
      if (data?.settings.soundOn) snd.step();
      window.setTimeout(() => {
        setHeat(h + 1);
        heatRef.current = h + 1;
        startHeat(h + 1);
      }, 2400);
    }
  };

  const finishMatch = (place: number, lastHeat: number) => {
    window.clearInterval(timer.current);
    const champion = place === 1;
    const result = resultFromStrokes('game', 'Survivor Sprint', strokes.current, startedAt.current, performance.now(), { game: 'survivor', place, heats: lastHeat, heatWins: heatWins.current });
    const rewards = strokes.current.length > 10 ? recordSession(result) : null;
    patch((d) => {
      const cur = d.gameBests['survivor'];
      const score = (9 - place) * 100 + heatWins.current * 40 + Math.round(result.wpm);
      if (!cur || score > cur.score) d.gameBests['survivor'] = { score, level: 9 - place };
    });
    if (champion) pushToast({ kind: 'record', icon: 'crown', title: 'Last typist standing!' });
    if (data?.settings.soundOn) (champion ? snd.badge() : snd.done());
    setOverInfo({ place, champion, rewards });
    setPhase('over');
    phaseRef.current = 'over';
  };

  const handleKey = (key: string) => {
    if (phaseRef.current !== 'heat') return;
    const word = stream.current[wordIdx.current] ?? '';
    const want = pos.current >= word.length ? ' ' : word[pos.current];
    const ok = key === want;
    strokes.current.push({ t: performance.now(), exp: want, ok });
    const you = ent.current.find((e) => e.you)!;
    if (ok) {
      if (data?.settings.soundOn) snd.key();
      you.chars += 1;
      // cross the finish line → heat is yours immediately, no waiting out the clock
      if (you.chars >= heatTarget.current) {
        heatWins.current += 1;
        if (data?.settings.soundOn) snd.badge();
        const board = boardRef.current;
        if (board) floatText(board, 'Finish! heat yours', board.clientWidth / 2, board.clientHeight * 0.3, 'fx-score');
        window.setTimeout(() => resolveHeat(heatRef.current), 450);
        force((n) => n + 1);
        return;
      }
      if (want === ' ') {
        wordIdx.current += 1;
        pos.current = 0;
        const el = boardRef.current?.querySelector<HTMLElement>('.runner-you');
        hopUp(el ?? null, 9);
        if (boardRef.current && el) {
          const r = el.getBoundingClientRect();
          const b = boardRef.current.getBoundingClientRect();
          floatText(boardRef.current, `+${word.length}`, r.left - b.left + 14, r.top - b.top - 6, 'fx-score');
        }
      } else {
        pos.current += 1;
      }
      force((n) => n + 1);
    } else if (data?.settings.soundOn) snd.err();
  };

  useGameKeys(phase === 'heat', handleKey, { onEscape: () => resolveHeat(heatRef.current) });
  useEffect(() => () => window.clearInterval(timer.current), []);

  if (!data) return null;
  const word = stream.current[wordIdx.current] ?? '';
  const alive = ent.current.filter((e) => !e.out);
  const benched = ent.current.filter((e) => e.out);
  const timeLeft = phase === 'heat' ? Math.max(0, heatDur.current - (performance.now() - heatStart.current) / 1000) : HEAT_CLOCKS[0];
  const pctOf = (e: Entrant) => Math.min(96, (e.chars / heatTarget.current) * 100);

  return (
    <div className="train-page">
      <div className="train-top">
        <Btn kind="ghost" onClick={() => { window.clearInterval(timer.current); nav('/app/games'); }} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="crown" size={20} /> Survivor Sprint</h1>
        <Chip tone="accent">Trains: consistency under pressure</Chip>
      </div>

      <div className="game-frame">
        {(phase === 'heat' || phase === 'interlude') && (
          <div className="game-hud">
            <span>Heat {heat} of 4</span>
            <span>{alive.length} still racing</span>
            <span className="grow" />
            <span className={timeLeft < 5 ? 'bad' : ''}>{Math.ceil(timeLeft)}s</span>
          </div>
        )}
        <div className="game-board surv-track-board" ref={boardRef} style={{ minHeight: 460 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="crown" size={50} />
              <h2>Eight racers. One crown.</h2>
              <p className="muted" style={{ maxWidth: 480 }}>
                Four heats, each faster than the last (15s, 13s, 11s, 10s) — every correct letter pushes your runner down the track. Reach the flag before the clock and the heat is instantly yours.
                After each heat the slowest move to the <strong>cheer bench</strong> (no shame, instant rematch).
                Outrun every cut and the final duel to take the crown.
              </p>
              {data.gameBests['survivor'] && <Chip tone="gold"><Ic n="trophy" size={12} /> Best: {data.gameBests['survivor'].level >= 8 ? 'Champion' : `Top ${9 - data.gameBests['survivor'].level}`}</Chip>}
              <Btn big onClick={startMatch}>Take your lane →</Btn>
            </div>
          )}
          {(phase === 'heat' || phase === 'interlude') && (
            <div className="surv-scene">
              {phase === 'interlude' && (
                <div className="race-countdown" style={{ fontSize: '1.3rem', padding: '0 24px', textAlign: 'center' }}>
                  {interludeMsg}<br /><span className="muted small">heat {heat + 1} begins…</span>
                </div>
              )}
              <div className="surv-typebox" aria-live="off">
                <span className="good">{word.slice(0, pos.current)}</span>
                <span className="duel-cur">{word[pos.current] ?? '␣'}</span>
                <span className="muted">{word.slice(pos.current + 1)}</span>
                <span className="muted surv-next"> {stream.current[wordIdx.current + 1]} {stream.current[wordIdx.current + 2]}</span>
              </div>
              <div className="surv-lanes">
                {alive.map((e) => (
                  <div key={e.name} className="surv-lane">
                    <span className="surv-lane-name">{e.you ? <strong>You</strong> : e.name}</span>
                    <div className="surv-lane-track">
                      <span className="surv-sprite" style={{ left: `${pctOf(e)}%` }}>
                        <Runner
                          av={e.you ? data.profile.avatar : undefined}
                          preset={e.you ? undefined : e.preset}
                          size={34}
                          running={phase === 'heat'}
                          you={e.you}
                        />
                      </span>
                      <span className="surv-finish"><Ic n="flag" size={16} /></span>
                    </div>
                  </div>
                ))}
              </div>
              {benched.length > 0 && (
                <div className="surv-bench">
                  <span className="small muted"><Ic n="heart" size={13} /> cheer bench:</span>
                  {benched.map((e) => (
                    <span key={e.name} className="surv-bench-seat" title={`out in heat ${e.outHeat}`}>
                      <Runner preset={e.preset} av={e.you ? data.profile.avatar : undefined} size={26} benched />
                      <small className="muted">{e.you ? 'You' : e.name}</small>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over">
              <Ic n={overInfo.champion ? 'crown' : 'heart'} size={46} />
              <h2>{overInfo.champion ? 'Last typist standing!' : `Benched in place ${overInfo.place}`}</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={overInfo.place} l="finish" tone={overInfo.champion ? 'good' : undefined} />
                <Stat v={heat} l="heats survived" />
                <Stat v={heatWins.current} l="flags taken" tone={heatWins.current > 0 ? 'accent' : undefined} />
              </div>
              <RewardsBanner rewards={overInfo.rewards} />
              <p className="small muted" style={{ maxWidth: 430 }}>
                {overInfo.champion ? 'Consistency wins crowns. Take that steadiness into a speed sprint!' : 'The bench cheers loudest for rematches — every heat you survive raises your floor.'}
              </p>
              <div className="row gap">
                <Btn onClick={startMatch}>↻ New tournament</Btn>
                <Btn kind="soft" to="/app/games">All games</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
      <MobileKeys active={phase === 'heat'} />
    </div>
  );
}
