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
  const [runeIdx, setRuneIdx] = useState(0);       // which rune in current forge (0..2)
  const [runes, setRunes] = useState<string[]>([]);
  const [hit, setHit] = useState(0);               // chars typed in current rune
  const [missed, setMissed] = useState(false);     // error in current rune?
  const [perfects, setPerfects] = useState(0);
  const [streak, setStreak] = useState(0);
  const [forged, setForged] = useState<ForgeItem[]>([]);
  const [justForged, setJustForged] = useState<ForgeItem | null>(null);
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; dx: number; dy: number }[]>([]);
  const [overInfo, setOverInfo] = useState<{ rewards: Rewards | null; result: ReturnType<typeof resultFromStrokes> } | null>(null);
  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const sparkId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const newRunes = () => {
    setRunes([pick(rng.current, pool), pick(rng.current, pool), pick(rng.current, pool)]);
    setRuneIdx(0); setHit(0); setMissed(false); setPerfects(0); setJustForged(null);
  };

  const start = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    setForged([]); setStreak(0);
    newRunes();
    setPhase('run');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const finishForge = (perf: number) => {
    const rarity = Math.min(4, Math.max(1, perf + (streak >= 3 ? 1 : 0)));
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
  };

  const endGame = () => {
    if (strokes.current.length > 10) {
      const result = resultFromStrokes('game', 'Keyforge', strokes.current, startedAt.current, performance.now(), { game: 'keyforge', forged: forged.length });
      const rewards = recordSession(result);
      patch((d) => {
        const cur = d.gameBests['keyforge'];
        const score = forged.reduce((a, f) => a + f.rarity * 25, 0);
        if (!cur || score > cur.score) d.gameBests['keyforge'] = { score, level: forged.length };
      });
      setOverInfo({ rewards, result });
    } else {
      setOverInfo(null);
    }
    setPhase('over');
  };

  const handleKey = (key: string) => {
    if (phase !== 'run' || key.length !== 1 || justForged) return;
    const word = runes[runeIdx];
    if (!word) return;
    const want = word[hit];
    const t = performance.now();
    if (key === want) {
      strokes.current.push({ t, exp: want, ok: true });
      if (data?.settings.soundOn) snd.key();
      const el = document.querySelector('.forge-word');
      if (el) {
        const id = sparkId.current++;
        setSparks((sp) => [...sp.slice(-14), { id, x: 50 + (hit - word.length / 2) * 3, y: 50, dx: (Math.random() - 0.5) * 120, dy: -40 - Math.random() * 60 }]);
        setTimeout(() => setSparks((sp) => sp.filter((s) => s.id !== id)), 700);
      }
      if (hit + 1 >= word.length) {
        const perfect = !missed;
        const newPerf = perfects + (perfect ? 1 : 0);
        setPerfects(newPerf);
        if (runeIdx + 1 >= 3) {
          finishForge(newPerf);
        } else {
          setRuneIdx((i) => i + 1); setHit(0); setMissed(false);
          if (data?.settings.soundOn) snd.step();
        }
      } else {
        setHit((h) => h + 1);
      }
    } else {
      strokes.current.push({ t, exp: want ?? key, ok: false });
      setMissed(true);
      if (data?.settings.soundOn) snd.err();
    }
  };

  useEffect(() => {
    if (justForged) {
      const t = setTimeout(() => { newRunes(); inputRef.current?.focus(); }, 1900);
      return () => clearTimeout(t);
    }
  }, [justForged]);

  if (!data) return null;
  const word = runes[runeIdx] ?? '';

  return (
    <div className="train-page" onClick={() => inputRef.current?.focus()}>
      <div className="train-top">
        <Btn kind="ghost" onClick={() => nav('/app/games')} ariaLabel="Exit game">←</Btn>
        <h1><Ic n="hammer" size={20} /> Keyforge</h1>
        <Chip tone="accent">Trains: perfect-word streaks</Chip>
        {phase === 'run' && <Btn kind="soft" onClick={endGame}>Finish session</Btn>}
      </div>

      <div className="game-frame">
        {phase === 'run' && (
          <div className="game-hud">
            <span>Forged {forged.length}</span>
            <span className="row" style={{ gap: 4 }}>Streak {streak > 0 ? <><Ic n="flame" size={13} /> {streak}</> : '—'}</span>
            <span className="grow" />
            <span>Rune {Math.min(runeIdx + 1, 3)}/3 · {perfects}✦ perfect</span>
          </div>
        )}
        <div className="game-board" style={{ minHeight: 420 }}>
          {phase === 'intro' && (
            <div className="game-over">
              <Ic n="hammer" size={50} />
              <h2>The Glyph Foundry is open</h2>
              <p className="muted" style={{ maxWidth: 460 }}>
                Every artifact takes three rune-words. Type a rune with <strong>zero mistakes</strong> to add a perfect part.
                Three perfect runes — and a hot streak — forge <strong>Mythic</strong> treasures.
                There is no timer. Precision is the only fire here.
              </p>
              <Chip tone="gold">Collection: {data.forge.length} artifacts</Chip>
              <Btn big onClick={start}>Light the forge →</Btn>
            </div>
          )}
          {phase === 'run' && (
            <div className="forge-anvil">
              {justForged ? (
                <div className={`forge-item-card rarity-${justForged.rarity}`}>
                  <Ic n={justForged.icon} size={44} />
                  <strong>{justForged.name}</strong>
                  <Chip tone={justForged.rarity >= 3 ? 'gold' : 'default'}>{RARITY_NAMES[justForged.rarity]}</Chip>
                </div>
              ) : (
                <>
                  <p className="muted small">rune {runeIdx + 1} of 3 {missed && <span className="bad">· cracked (a miss slipped in)</span>}</p>
                  <div className="forge-word" style={{ position: 'relative' }}>
                    <span className="done">{word.slice(0, hit)}</span>
                    <span className="cur">{word[hit] ?? ''}</span>
                    <span>{word.slice(hit + 1)}</span>
                    {sparks.map((s) => (
                      <span key={s.id} className="forge-spark" style={{ left: `${s.x}%`, top: `${s.y}%`, ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px` }} aria-hidden>✦</span>
                    ))}
                  </div>
                  <p className="muted small">anvil heat: {'▮'.repeat(perfects + 1)}{'▯'.repeat(Math.max(0, 3 - perfects - 1))}</p>
                </>
              )}
              {forged.length > 0 && (
                <div className="row gap wrap" style={{ justifyContent: 'center', marginTop: 26 }}>
                  {forged.slice(-6).map((f) => <span key={f.id} title={f.name} style={{ opacity: 0.5 + f.rarity * 0.12 }}><Ic n={f.icon} size={22} /></span>)}
                </div>
              )}
            </div>
          )}
          {phase === 'over' && (
            <div className="game-over">
              <Ic n="lamp" size={44} />
              <h2>The forge cools</h2>
              <div className="row gap wrap" style={{ justifyContent: 'center' }}>
                <Stat v={forged.length} l="artifacts" tone="accent" />
                <Stat v={forged.filter((f) => f.rarity >= 3).length} l="rare+" />
                {overInfo && <Stat v={`${overInfo.result.acc}%`} l="accuracy" />}
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
              {overInfo && <RewardsBanner rewards={overInfo.rewards} />}
              <p className="small muted">Artifacts live in your Profile's display case.</p>
              <div className="row gap">
                <Btn onClick={start}>↻ Forge again</Btn>
                <Btn kind="soft" to="/app/games">All games</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
      <input
        ref={inputRef} className="ghost-input" aria-label="Game typing input"
        onKeyDown={(e) => { if (!e.metaKey && !e.ctrlKey && e.key.length === 1) { handleKey(e.key); e.preventDefault(); } if (e.key === 'Escape' && phase === 'run') endGame(); }}
        onInput={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; for (const ch of v) handleKey(ch); }}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
      />
    </div>
  );
}
