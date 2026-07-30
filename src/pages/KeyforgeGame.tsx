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
import { sparkBurst, screenShake, popIn } from '../lib/fx';
import gsap from 'gsap';
import type { ForgeItem, Rewards } from '../lib/types';

const RARITY_NAMES = ['', 'Common', 'Fine', 'Rare', 'Mythic'];
const FORGE_ICONS = ['feather', 'compass', 'lamp', 'key', 'bell', 'gem', 'shell', 'crown'];

export default function KeyforgeGame() {
  const data = useData();
  const nav = useNavigate();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const rng = useRef(mulberry32(Date.now() % 1e9));
  const pool = useMemo(() => {
    const base = kid ? KID_WORDS : COMMON_WORDS.filter((w) => w.length >= 4 && w.length <= 9);
    return [...base, ...(kid ? [] : TRICKY_WORDS)];
  }, [kid]);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [runeIdx, setRuneIdx] = useState(0);
  const [runes, setRunes] = useState<string[]>([]);
  const [hit, setHit] = useState(0);
  const [missed, setMissed] = useState(false);
  const [perfects, setPerfects] = useState(0);
  const [streak, setStreak] = useState(0);
  const [forged, setForged] = useState<ForgeItem[]>([]);
  const [justForged, setJustForged] = useState<ForgeItem | null>(null);
  const [overInfo, setOverInfo] = useState<{ rewards: Rewards | null; acc: number } | null>(null);

  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const hammerRef = useRef<SVGGElement>(null);
  const phaseRef = useRef(phase);
  const streakRef = useRef(0);
  const stateRef = useRef({ runeIdx: 0, hit: 0, missed: false, perfects: 0, runes: [] as string[], busy: false });
  phaseRef.current = phase;
  streakRef.current = streak;

  const sync = () => {
    const st = stateRef.current;
    setRuneIdx(st.runeIdx); setHit(st.hit); setMissed(st.missed); setPerfects(st.perfects); setRunes([...st.runes]);
  };

  const newRunes = () => {
    const st = stateRef.current;
    st.runes = [pick(rng.current, pool), pick(rng.current, pool), pick(rng.current, pool)];
    st.runeIdx = 0; st.hit = 0; st.missed = false; st.perfects = 0; st.busy = false;
    setJustForged(null);
    sync();
  };

  const start = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    setForged([]); setStreak(0);
    newRunes();
    setPhase('run');
  };

  const strikeFx = (good: boolean) => {
    const scene = sceneRef.current;
    if (hammerRef.current) {
      gsap.fromTo(hammerRef.current, { rotation: -52 }, { rotation: 0, duration: 0.11, ease: 'power3.in' });
      gsap.to(hammerRef.current, { rotation: -52, duration: 0.28, delay: 0.13, ease: 'power2.out' });
    }
    if (scene) {
      const w = scene.clientWidth;
      const h = scene.clientHeight;
      sparkBurst(scene, w / 2 + 6, h * 0.6, good ? 7 : 4, good ? '' : 'fx-spark-bad');
      if (!good) screenShake(scene, 4);
    }
  };

  const finishForge = (perf: number) => {
    const st = stateRef.current;
    st.busy = true;
    const rarity = Math.min(4, Math.max(1, perf + (streakRef.current >= 3 ? 1 : 0)));
    const item: ForgeItem = {
      id: uid(),
      name: `${pick(rng.current, FORGE_MATERIALS)} ${pick(rng.current, FORGE_ITEMS)} ${pick(rng.current, FORGE_SUFFIX)}`,
      rarity,
      icon: pick(rng.current, FORGE_ICONS),
      t: Date.now(),
    };
    setForged((f) => [...f, item]);
    setJustForged(item);
    patch((d) => { d.forge.push(item); });
    if (rarity >= 3) pushToast({ kind: 'badge', icon: item.icon, title: `${RARITY_NAMES[rarity]} forge!`, body: item.name });
    if (data?.settings.soundOn) (rarity >= 3 ? snd.badge() : snd.done());
    setStreak((s) => (perf === 3 ? s + 1 : 0));
    window.setTimeout(() => popIn(sceneRef.current?.querySelector<HTMLElement>('.forge-item-card') ?? null), 30);
  };

  const endGame = () => {
    if (phaseRef.current !== 'run') return;
    setForged((f) => {
      if (strokes.current.length > 10) {
        const result = resultFromStrokes('game', 'Keyforge', strokes.current, startedAt.current, performance.now(), { game: 'keyforge', forged: f.length });
        const rewards = recordSession(result);
        patch((d) => {
          const cur = d.gameBests['keyforge'];
          const score = f.reduce((a, x) => a + x.rarity * 25, 0);
          if (!cur || score > cur.score) d.gameBests['keyforge'] = { score, level: f.length };
        });
        setOverInfo({ rewards, acc: result.acc });
      } else {
        setOverInfo({ rewards: null, acc: 100 });
      }
      return f;
    });
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
      strikeFx(true);
      if (st.hit + 1 >= word.length) {
        const perfect = !st.missed;
        st.perfects += perfect ? 1 : 0;
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
      if (data?.settings.soundOn) snd.err();
      strikeFx(false);
      sync();
    }
  };

  useGameKeys(phase === 'run' && !justForged, handleKey, { onEscape: endGame });

  useEffect(() => {
    if (justForged) {
      const t = setTimeout(() => newRunes(), 2100);
      return () => clearTimeout(t);
    }
  }, [justForged]);

  if (!data) return null;
  const word = runes[runeIdx] ?? '';

  return (
    <div className="train-page">
      <div className="train-top">
        <Btn kind="ghost" onClick={() => nav('/app/games')} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="hammer" size={20} /> Keyforge</h1>
        <Chip tone="accent">Trains: perfect-word streaks</Chip>
        {phase === 'run' && <Btn kind="soft" onClick={endGame}>Finish & collect</Btn>}
      </div>

      <div className="game-frame">
        {phase === 'run' && (
          <div className="game-hud">
            <span>Forged {forged.length}</span>
            <span className="row" style={{ gap: 4 }}>Streak {streak > 0 ? <><Ic n="flame" size={13} /> {streak}</> : '—'}</span>
            <span className="grow" />
            <span>{perfects} of 3 parts perfect</span>
          </div>
        )}
        <div className="game-board" ref={sceneRef} style={{ minHeight: 440 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="hammer" size={50} />
              <h2>Three runes forge one treasure</h2>
              <p className="muted" style={{ maxWidth: 470 }}>
                Type the rune above the anvil — <strong>every correct letter is a hammer strike</strong>.
                Finish a rune with zero mistakes and that part is <em>perfect</em>; three perfect parts
                (and a hot streak) forge <strong>Mythic</strong> treasure. No timer. Precision is the only fire here.
              </p>
              <Chip tone="gold"><Ic n="lamp" size={12} /> Collection: {data.forge.length} artifacts</Chip>
              <Btn big onClick={start}>Light the forge →</Btn>
            </div>
          )}
          {phase === 'run' && (
            <div className="forge-scene">
              {justForged ? (
                <div className="forge-reveal">
                  <div className={`forge-item-card rarity-${justForged.rarity}`}>
                    <Ic n={justForged.icon} size={44} />
                    <strong>{justForged.name}</strong>
                    <Chip tone={justForged.rarity >= 3 ? 'gold' : 'default'}>{RARITY_NAMES[justForged.rarity]}</Chip>
                  </div>
                  <p className="muted small">next treasure warming up…</p>
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
                  <p className="forge-say muted small">{missed ? 'a crack slipped in — finish strong, the next rune is a fresh start' : 'strike true — type the glowing rune'}</p>
                  <div className="forge-word">
                    <span className="done">{word.slice(0, hit)}</span>
                    <span className="cur">{word[hit] ?? ''}</span>
                    <span>{word.slice(hit + 1)}</span>
                  </div>
                  <svg viewBox="0 0 220 120" className="forge-anvil-svg" aria-hidden>
                    <rect x="60" y="58" width="100" height="18" rx="6" fill="var(--surface2)" stroke="var(--border)" strokeWidth="2.5" />
                    <rect x="88" y="76" width="44" height="14" rx="4" fill="var(--surface2)" stroke="var(--border)" strokeWidth="2.5" />
                    <rect x="76" y="90" width="68" height="12" rx="4" fill="var(--surface2)" stroke="var(--border)" strokeWidth="2.5" />
                    <rect x="96" y="46" width="30" height="12" rx="3" fill="var(--gold)" opacity="0.9" className="forge-ingot" />
                    <g ref={hammerRef} className="forge-hammer">
                      <rect x="120" y="30" width="54" height="8" rx="4" fill="var(--text)" opacity="0.7" transform="rotate(32 147 34)" />
                      <rect x="150" y="6" width="28" height="24" rx="5" fill="var(--accent)" />
                    </g>
                  </svg>
                </>
              )}
              {forged.length > 0 && !justForged && (
                <div className="row gap wrap" style={{ justifyContent: 'center', marginTop: 12 }}>
                  {forged.slice(-6).map((f) => (
                    <span key={f.id} title={f.name} style={{ opacity: 0.5 + f.rarity * 0.12 }}><Ic n={f.icon} size={20} /></span>
                  ))}
                </div>
              )}
            </div>
          )}
          {phase === 'over' && overInfo && (
            <div className="game-over">
              <Ic n="lamp" size={44} />
              <h2>The forge cools</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={forged.length} l="artifacts" tone="accent" />
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
              <p className="small muted">Artifacts live in your Profile's display case.</p>
              <div className="row gap">
                <Btn onClick={start}>↻ Forge again</Btn>
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
