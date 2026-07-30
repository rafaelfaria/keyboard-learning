import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS, FORGE_ITEMS, FORGE_MATERIALS, FORGE_SUFFIX, TRICKY_WORDS } from '../lib/words';
import { mulberry32, pick, uid } from '../lib/rng';
import { Btn, Chip, Stat } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { Ic } from '../components/icons';
import { MobileKeys, useGameKeys } from '../components/gamekit';
import { sparkBurst, screenShake, popIn, floatText } from '../lib/fx';
import gsap from 'gsap';
import type { ForgeItem, Rewards } from '../lib/types';

const RARITY_NAMES = ['', 'Common', 'Fine', 'Rare', 'Mythic'];
const FORGE_ICONS = ['feather', 'compass', 'lamp', 'key', 'bell', 'gem', 'shell', 'crown'];
const HAMMER_REST = 42;          // raised above the ingot; 0 = contact
const HOT_BONUS_AT = 70;         // finish a treasure with ≥70 heat → +1 rarity

export default function KeyforgeGame() {
  const data = useData();
  const nav = useNavigate();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const rng = useRef(mulberry32(Date.now() % 1e9));
  const basePool = useMemo(() => {
    const base = kid ? KID_WORDS : COMMON_WORDS.filter((w) => w.length >= 4 && w.length <= 9);
    return [...base, ...(kid ? [] : TRICKY_WORDS)];
  }, [kid]);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [runeIdx, setRuneIdx] = useState(0);
  const [runes, setRunes] = useState<string[]>([]);
  const [hit, setHit] = useState(0);
  const [missed, setMissed] = useState(false);
  const [perfects, setPerfects] = useState(0);
  const [heatUi, setHeatUi] = useState(100);
  const [levelBanner, setLevelBanner] = useState('');
  const [forged, setForged] = useState<ForgeItem[]>([]);
  const [justForged, setJustForged] = useState<ForgeItem | null>(null);
  const [overInfo, setOverInfo] = useState<{ rewards: Rewards | null; acc: number; score: number; level: number; quenched: boolean } | null>(null);

  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const hammerRef = useRef<SVGGElement>(null);
  const heatTimer = useRef(0);
  const phaseRef = useRef(phase);
  const forgedRef = useRef<ForgeItem[]>([]);
  const stateRef = useRef({ runeIdx: 0, hit: 0, missed: false, perfects: 0, runes: [] as string[], busy: false, heat: 100 });
  phaseRef.current = phase;
  forgedRef.current = forged;

  /** The fire gets hungrier with every treasure: faster drain, longer runes. */
  const drainPerSec = () => (kid ? 2.2 + forgedRef.current.length * 0.5 : 3.4 + forgedRef.current.length * 0.9);
  const runePool = () => {
    if (kid) return basePool;
    const minLen = 4 + Math.min(3, Math.floor(forgedRef.current.length / 2));
    const p = basePool.filter((w) => w.length >= minLen);
    return p.length > 12 ? p : basePool;
  };

  const sync = () => {
    const st = stateRef.current;
    setRuneIdx(st.runeIdx); setHit(st.hit); setMissed(st.missed); setPerfects(st.perfects); setRunes([...st.runes]);
  };

  const addHeat = (n: number) => {
    const st = stateRef.current;
    st.heat = Math.max(0, Math.min(100, st.heat + n));
  };

  const newRunes = () => {
    const st = stateRef.current;
    const p = runePool();
    st.runes = [pick(rng.current, p), pick(rng.current, p), pick(rng.current, p)];
    st.runeIdx = 0; st.hit = 0; st.missed = false; st.perfects = 0; st.busy = false;
    setJustForged(null);
    sync();
  };

  const start = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    stateRef.current.heat = 100;
    setHeatUi(100);
    setForged([]);
    forgedRef.current = [];
    setLevelBanner('');
    newRunes();
    setPhase('run');
    window.clearInterval(heatTimer.current);
    let last = performance.now();
    heatTimer.current = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const st = stateRef.current;
      if (phaseRef.current !== 'run') return;
      if (!st.busy) st.heat = Math.max(0, st.heat - drainPerSec() * dt); // reveal pauses the fire
      setHeatUi(st.heat);
      if (st.heat <= 0) endGame(false);
    }, 100);
  };

  const strikeFx = (good: boolean) => {
    const scene = sceneRef.current;
    if (hammerRef.current) {
      gsap.fromTo(hammerRef.current,
        { rotation: HAMMER_REST, svgOrigin: '172 98' },
        { rotation: 0, duration: 0.09, ease: 'power3.in', svgOrigin: '172 98' });
      gsap.to(hammerRef.current, { rotation: HAMMER_REST, duration: 0.26, delay: 0.11, ease: 'power2.out', svgOrigin: '172 98' });
    }
    if (scene) {
      const ing = scene.querySelector('.forge-ingot');
      const sr = scene.getBoundingClientRect();
      const ir = ing?.getBoundingClientRect();
      const x = ir ? ir.left - sr.left + ir.width / 2 : scene.clientWidth / 2;
      const y = ir ? ir.top - sr.top + 2 : scene.clientHeight * 0.6;
      sparkBurst(scene, x, y, good ? 8 : 4, good ? '' : 'fx-spark-bad');
      if (!good) screenShake(scene, 4);
    }
  };

  // hold the hammer raised whenever the anvil is on screen
  useEffect(() => {
    if (phase === 'run' && !justForged && hammerRef.current) {
      gsap.set(hammerRef.current, { rotation: HAMMER_REST, svgOrigin: '172 98' });
    }
  }, [phase, justForged, runeIdx]);

  const finishForge = (perf: number) => {
    const st = stateRef.current;
    st.busy = true;
    const hot = st.heat >= HOT_BONUS_AT;
    const rarity = Math.min(4, Math.max(1, perf + (hot ? 1 : 0)));
    const item: ForgeItem = {
      id: uid(),
      name: `${pick(rng.current, FORGE_MATERIALS)} ${pick(rng.current, FORGE_ITEMS)} ${pick(rng.current, FORGE_SUFFIX)}`,
      rarity,
      icon: pick(rng.current, FORGE_ICONS),
      t: Date.now(),
    };
    setForged((f) => { const nf = [...f, item]; forgedRef.current = nf; return nf; });
    setJustForged(item);
    addHeat(14);
    patch((d) => { d.forge.push(item); });
    if (rarity >= 3) pushToast({ kind: 'badge', icon: item.icon, title: `${RARITY_NAMES[rarity]} forge!`, body: item.name });
    if (data?.settings.soundOn) (rarity >= 3 ? snd.badge() : snd.done());
    const lvl = forgedRef.current.length;
    setLevelBanner(`Forge level ${lvl + 1} — the fire burns hungrier`);
    window.setTimeout(() => setLevelBanner(''), 1500);
    window.setTimeout(() => popIn(sceneRef.current?.querySelector<HTMLElement>('.forge-item-card') ?? null), 30);
  };

  const scoreOf = (items: ForgeItem[]) => items.reduce((a, x) => a + x.rarity * 25, 0) + items.length * 30;

  const endGame = (quenched: boolean) => {
    if (phaseRef.current !== 'run') return;
    window.clearInterval(heatTimer.current);
    const items = forgedRef.current;
    const score = scoreOf(items);
    if (strokes.current.length > 10) {
      const result = resultFromStrokes('game', 'Keyforge', strokes.current, startedAt.current, performance.now(), { game: 'keyforge', forged: items.length, score });
      const rewards = recordSession(result);
      patch((d) => {
        const cur = d.gameBests['keyforge'];
        if (!cur || score > cur.score) d.gameBests['keyforge'] = { score, level: items.length };
      });
      setOverInfo({ rewards, acc: result.acc, score, level: items.length, quenched });
    } else {
      setOverInfo({ rewards: null, acc: 100, score, level: items.length, quenched });
    }
    if (data?.settings.soundOn) snd.done();
    setPhase('over');
  };

  const handleKey = (key: string) => {
    const st = stateRef.current;
    if (phaseRef.current !== 'run' || st.busy) return;
    const word = st.runes[st.runeIdx];
    if (!word) return;
    const want = word[st.hit];
    const t = performance.now();
    if (key === want) {
      strokes.current.push({ t, exp: want, ok: true });
      if (data?.settings.soundOn) snd.key();
      addHeat(kid ? 2 : 1.6);
      strikeFx(true);
      if (st.hit + 1 >= word.length) {
        const perfect = !st.missed;
        st.perfects += perfect ? 1 : 0;
        addHeat(perfect ? 10 : 4);
        const scene = sceneRef.current;
        if (scene && perfect) floatText(scene, '+heat', scene.clientWidth / 2 + 60, scene.clientHeight * 0.35, 'fx-score');
        if (st.runeIdx + 1 >= 3) {
          sync();
          finishForge(st.perfects);
        } else {
          st.runeIdx += 1; st.hit = 0; st.missed = false;
          if (data?.settings.soundOn) snd.step();
          sync();
        }
      } else {
        st.hit += 1;
        sync();
      }
    } else {
      strokes.current.push({ t, exp: want ?? key, ok: false });
      st.missed = true;
      addHeat(-7);
      if (data?.settings.soundOn) snd.err();
      strikeFx(false);
      sync();
    }
  };

  useGameKeys(phase === 'run' && !justForged, handleKey, { onEscape: () => endGame(true) });

  useEffect(() => {
    if (justForged) {
      const t = setTimeout(() => newRunes(), 1900);
      return () => clearTimeout(t);
    }
  }, [justForged]);

  useEffect(() => () => window.clearInterval(heatTimer.current), []);

  if (!data) return null;
  const word = runes[runeIdx] ?? '';
  const level = forged.length;
  const heatPct = Math.round(heatUi);
  const cold = heatPct < 25;

  return (
    <div className="train-page">
      <div className="train-top">
        <Btn kind="ghost" onClick={() => { window.clearInterval(heatTimer.current); nav('/app/games'); }} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="hammer" size={20} /> Keyforge</h1>
        <Chip tone="accent">Trains: fast, flawless words</Chip>
        {phase === 'run' && <Btn kind="soft" onClick={() => endGame(true)}>Quench & collect</Btn>}
      </div>

      <div className="game-frame">
        {phase === 'run' && (
          <div className="game-hud">
            <span>Forged {forged.length}</span>
            <span>Level {level + 1}</span>
            {data.gameBests['keyforge'] && <span className="muted">best {data.gameBests['keyforge'].score}</span>}
            <span className="grow" />
            <span className={cold ? 'bad' : heatPct >= HOT_BONUS_AT ? 'good' : ''}>
              <Ic n="flame" size={13} /> {heatPct}%
            </span>
          </div>
        )}
        <div className="game-board" ref={sceneRef} style={{ minHeight: 460 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="flame" size={50} />
              <h2>Keep the forge alive</h2>
              <p className="muted" style={{ maxWidth: 480 }}>
                The fire only burns while you type. <strong>Heat drains constantly</strong> — every correct strike feeds it,
                every miss vents it. Three runes forge a treasure, and each treasure makes the fire <strong>hungrier and the
                runes longer</strong>. Finish a treasure with the forge blazing (≥{HOT_BONUS_AT}%) for bonus rarity.
                How much can you forge before it goes cold?
              </p>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Chip tone="gold"><Ic n="lamp" size={12} /> Collection: {data.forge.length}</Chip>
                {data.gameBests['keyforge'] && <Chip tone="gold"><Ic n="trophy" size={12} /> Best: {data.gameBests['keyforge'].score}</Chip>}
              </div>
              <Btn big onClick={start}>Light the forge →</Btn>
            </div>
          )}
          {phase === 'run' && (
            <div className="forge-scene">
              <div className={`forge-heatbar ${cold ? 'forge-cold' : ''}`} role="meter" aria-valuenow={heatPct} aria-label="Forge heat">
                <div className="forge-heatfill" style={{ width: `${heatPct}%` }} />
                <span className="forge-heatlabel"><Ic n="flame" size={12} /> {heatPct}%{heatPct >= HOT_BONUS_AT ? ' · blazing (rarity bonus)' : cold ? ' · the fire is dying!' : ''}</span>
              </div>
              {levelBanner && <div className="wf-wave-banner">{levelBanner}</div>}
              {justForged ? (
                <div className="forge-reveal">
                  <div className={`forge-item-card rarity-${justForged.rarity}`}>
                    <Ic n={justForged.icon} size={44} />
                    <strong>{justForged.name}</strong>
                    <Chip tone={justForged.rarity >= 3 ? 'gold' : 'default'}>{RARITY_NAMES[justForged.rarity]}</Chip>
                  </div>
                  <p className="muted small">the fire holds its breath… next runes are longer</p>
                </div>
              ) : (
                <>
                  <div className="forge-progress" aria-label={`Rune ${runeIdx + 1} of 3`}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className={`forge-part ${i < runeIdx ? 'part-done' : i === runeIdx ? 'part-cur' : ''}`}>
                        <Ic n={i < runeIdx ? 'check' : 'gem'} size={13} /> part {i + 1}
                      </span>
                    ))}
                  </div>
                  <p className="forge-say muted small">{missed ? 'cracked — finish strong, misses vent heat' : 'strike fast and true'}</p>
                  <div className="forge-word">
                    <span className="done">{word.slice(0, hit)}</span>
                    <span className="cur">{word[hit] ?? ''}</span>
                    <span>{word.slice(hit + 1)}</span>
                  </div>
                  <svg viewBox="0 0 220 132" className="forge-anvil-svg" aria-hidden>
                    <path
                      d="M30 62 Q42 56 60 55 L156 55 Q165 55 165 62 L165 68 Q165 74 156 74 L124 74 L130 92 L142 97 L148 110 L72 110 L78 97 L90 92 L96 74 L64 74 Q46 72 34 68 Q28 65 30 62 Z"
                      fill="color-mix(in oklab, var(--text) 26%, var(--surface2))"
                      stroke="var(--border)" strokeWidth="2.5" strokeLinejoin="round"
                    />
                    <rect x="62" y="110" width="96" height="13" rx="5" fill="var(--surface2)" stroke="var(--border)" strokeWidth="2.5" />
                    <rect x="60" y="55" width="105" height="6" rx="3" fill="color-mix(in oklab, var(--text) 45%, var(--surface2))" opacity="0.55" />
                    <rect x="94" y="44" width="34" height="12" rx="3" fill="var(--gold)" className="forge-ingot" style={{ opacity: 0.3 + (heatUi / 100) * 0.7 }} />
                    <g ref={hammerRef} className="forge-hammer">
                      <g transform="translate(172 98) rotate(-142)">
                        <rect x="4" y="-4.5" width="60" height="9" rx="4.5" fill="#a8703f" stroke="#7a4f2a" strokeWidth="1.5" />
                        <rect x="58" y="-15" width="26" height="30" rx="5"
                          fill="color-mix(in oklab, var(--text) 55%, var(--surface2))" stroke="var(--border)" strokeWidth="2" />
                        <rect x="80" y="-15" width="6" height="30" rx="2.5"
                          fill="color-mix(in oklab, var(--text) 75%, var(--surface2))" />
                      </g>
                    </g>
                  </svg>
                </>
              )}
              {forged.length > 0 && !justForged && (
                <div className="row gap wrap" style={{ justifyContent: 'center', marginTop: 10 }}>
                  {forged.slice(-6).map((f) => (
                    <span key={f.id} title={f.name} style={{ opacity: 0.5 + f.rarity * 0.12 }}><Ic n={f.icon} size={20} /></span>
                  ))}
                </div>
              )}
            </div>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over">
              <Ic n={overInfo.quenched ? 'lamp' : 'snowflake'} size={44} />
              <h2>{overInfo.quenched ? 'Quenched — treasures banked' : 'The forge went cold'}</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={overInfo.score} l="score" tone="accent" />
                <Stat v={overInfo.level} l="treasures" />
                <Stat v={forged.filter((f) => f.rarity >= 3).length} l="rare+" />
                <Stat v={`${overInfo.acc}%`} l="accuracy" />
              </div>
              {forged.length > 0 && (
                <div className="row gap wrap" style={{ justifyContent: 'center', maxWidth: 480 }}>
                  {forged.map((f) => (
                    <span key={f.id} className={`forge-item-card rarity-${f.rarity}`} style={{ padding: '10px 14px' }}>
                      <Ic n={f.icon} size={24} />
                      <small style={{ maxWidth: 130, textAlign: 'center' }}>{f.name}</small>
                    </span>
                  ))}
                </div>
              )}
              <RewardsBanner rewards={overInfo.rewards} />
              <p className="small muted" style={{ maxWidth: 440 }}>
                {overInfo.quenched ? 'Banked in time. Push one level deeper next run?' : `The fire ate ${Math.round(drainPerSec())}%/s by the end — speed feeds it, misses starve it.`}
              </p>
              <div className="row gap">
                <Btn onClick={start}>↻ Relight the forge</Btn>
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
