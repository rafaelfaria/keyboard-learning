import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Btn, Logo, Bar, Chip } from '../components/ui';
import { GhostInput, TypingText, useTypingSession, combineResults } from '../components/typing';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { useStore, useData, randomKidName, MAX_PROFILES } from '../lib/store';
import type { AgeGroup, AssessmentResult, CoachStyle, Goal, LayoutId, SessionResult } from '../lib/types';
import { COACH_STYLES } from '../lib/coach';
import { LAYOUT_NAMES, layoutGroups } from '../lib/keyboard';
import { COMMON_WORDS, KID_WORDS, SENTENCES, KID_SENTENCES } from '../lib/words';
import { mulberry32, pickN, pick } from '../lib/rng';
import { median, rankOf } from '../lib/metrics';
import { snd } from '../lib/sound';
import { Ic } from '../components/icons';
import { BlockAvatar, PRESET_CHARACTERS, presetValue } from '../components/avatars';

type StepId = 'welcome' | 'age' | 'identity' | 'goal' | 'habits' | 'setup' | 'access' | 'assessIntro' | 'tap' | 'words' | 'sentence' | 'computing' | 'plan';

interface Answers {
  path: 'new' | 'place';
  age: AgeGroup;
  ageLabel: string;
  name: string;
  avatar: string;
  goal: Goal;
  looks: 'always' | 'sometimes' | 'rarely';
  exp: 'new' | 'some' | 'confident';
  layout: LayoutId;
  sound: boolean;
  competitive: boolean;
  coach: CoachStyle;
  fontScale: number;
  reducedMotion: boolean;
  dyslexia: boolean;
  untimed: boolean;
  contrast: boolean;
}

function Opt({ on, onClick, icon, title, sub }: { on: boolean; onClick: () => void; icon: string; title: string; sub?: string }) {
  return (
    <button type="button" className={`opt-tile ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="opt-ic"><Ic n={icon} size={24} /></span>
      <span><strong>{title}</strong>{sub && <small>{sub}</small>}</span>
    </button>
  );
}

// --- Tap test: prompted single keys, measures reaction & habit signals ---
function TapTest({ layout, count, onDone, onSkip }: { layout: LayoutId; count: number; onDone: (r: { taps: number[]; errs: number; keys: Record<string, { ms: number[]; err: number }> }) => void; onSkip: () => void }) {
  const seq = useMemo(() => {
    const g = layoutGroups(layout);
    const pool = [...g.homeCore, ...g.homeCore, ...g.top.slice(0, 3), ...g.bottom.slice(0, 2)];
    const rng = mulberry32(Date.now() % 1e9);
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      let c = pick(rng, pool);
      while (out[out.length - 1] === c) c = pick(rng, pool);
      out.push(c);
    }
    return out;
  }, [layout, count]);
  const [i, setI] = useState(0);
  const [flash, setFlash] = useState('');
  const shownAt = useRef(performance.now());
  const acc = useRef<{ taps: number[]; errs: number; keys: Record<string, { ms: number[]; err: number }> }>({ taps: [], errs: 0, keys: {} });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { shownAt.current = performance.now(); }, [i]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handle = (key: string) => {
    if (key.length !== 1) return;
    const t = performance.now() - shownAt.current;
    const want = seq[i];
    const k = acc.current.keys[want] ?? { ms: [], err: 0 };
    if (key.toLowerCase() === want) {
      acc.current.taps.push(t);
      k.ms.push(t);
      acc.current.keys[want] = k;
      setFlash('ok');
      snd.key();
      if (i + 1 >= seq.length) onDone(acc.current);
      else setI(i + 1);
    } else {
      acc.current.errs++;
      k.err++;
      acc.current.keys[want] = k;
      setFlash('bad');
      snd.err();
    }
    setTimeout(() => setFlash(''), 220);
  };

  return (
    <div onClick={() => inputRef.current?.focus()}>
      <p className="center muted">Press the key you see. As quickly and accurately as you can. Keep your eyes up here.</p>
      <div className={`assess-big-key ${flash === 'ok' ? 'assess-flash-ok' : flash === 'bad' ? 'assess-flash-bad' : ''}`} aria-live="polite">
        {seq[i]?.toUpperCase()}
      </div>
      <p className="center muted small">{i + 1} / {seq.length}</p>
      <input
        ref={inputRef} className="ghost-input" aria-label="Press the shown key"
        onKeyDown={(e) => { if (e.key === 'Escape') { onSkip(); return; } if (!e.metaKey && !e.ctrlKey && e.key.length === 1) { handle(e.key); e.preventDefault(); } }}
        onInput={(e) => { const v = e.currentTarget.value; e.currentTarget.value = ''; if (v) handle(v[v.length - 1]); }}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
      />
      <div style={{ marginTop: 16 }}>
        <KeyboardVisual layout={layout} guide="zones" compact />
      </div>
      <div className="center" style={{ marginTop: 14 }}>
        <Btn kind="ghost" onClick={onSkip}>Skip test →</Btn>
      </div>
    </div>
  );
}

// --- Timed typing step used for words & sentence phases ---
function TypeStep({ text, seconds, layout, label, onDone, onSkip }: { text: string; seconds: number; layout: LayoutId; label: string; onDone: (r: SessionResult) => void; onSkip: () => void }) {
  const session = useTypingSession(
    { text, mode: 'assessment', label, correction: 'standard', timeLimitSec: seconds, stopOnComplete: true, keepTimeline: false },
    { onFinish: onDone, soundOn: true, onEscape: onSkip },
  );
  useEffect(() => { session.focus(); }, []);
  const rem = session.engine.remainingSec();
  return (
    <div className="type-wrap">
      <p className="center muted small" style={{ marginBottom: 8 }}>
        {label} · {session.engine.started ? `${Math.ceil(rem ?? 0)}s left` : 'timer starts on your first key'}
      </p>
      <TypingText engine={session.engine} caret="bar" focused={session.focused} onClick={session.focus} />
      <GhostInput bind={session.bindInput} />
      <div style={{ marginTop: 12 }}>
        <KeyboardVisual layout={layout} guide="zones" compact nextChar={session.engine.text[session.engine.pos]} lastPress={session.engine.lastPress} />
      </div>
      <div className="center" style={{ marginTop: 14 }}>
        <Btn kind="ghost" onClick={onSkip}>Skip test →</Btn>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const quick = params.get('quick') === '1';
  const existing = useData();
  const retest = params.get('retest') === '1' && !!existing;
  // (isRetest below mirrors this for state initialization order)
  const createProfile = useStore((s) => s.createProfile);
  const finishAssessment = useStore((s) => s.finishAssessment);
  const hasProfile = useStore((s) => !!s.activeId);
  const full = useStore((s) => Object.keys(s.profiles).length >= MAX_PROFILES);

  const isRetest = params.get('retest') === '1' && !!existing;
  const [a, setA] = useState<Answers>(() => ({
    path: 'place',
    age: isRetest ? existing!.profile.ageGroup : 'adult',
    ageLabel: '18+',
    name: '', avatar: presetValue(0), goal: 'basics',
    looks: isRetest ? existing!.profile.looksAtKeyboard : 'sometimes',
    exp: isRetest ? (existing!.profile.experience === 'new' ? 'some' : existing!.profile.experience) : 'some',
    layout: isRetest ? existing!.profile.layout : 'qwerty',
    sound: true, competitive: true, coach: 'teacher',
    fontScale: 1, reducedMotion: false, dyslexia: false, untimed: false, contrast: false,
  }));
  const upd = (patch: Partial<Answers>) => setA((s) => ({ ...s, ...patch }));

  const steps: StepId[] = useMemo(() => {
    const base: StepId[] = retest
      ? ['assessIntro', 'tap', 'words', 'sentence', 'computing', 'plan']
      : quick
        ? ['age', 'assessIntro', 'tap', 'words', 'sentence', 'computing', 'plan']
        : ['welcome', 'age', 'identity', 'goal', 'habits', 'setup', 'access', 'assessIntro', 'tap', 'words', 'sentence', 'computing', 'plan'];
    return base.filter((s) => {
      if ((s === 'words' || s === 'sentence') && a.path === 'new' && !retest) return false;
      if (s === 'sentence' && a.age === 'kid') return false;
      return true;
    });
  }, [quick, retest, a.path, a.age]);

  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const next = () => setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));
  const goTo = (id: StepId) => { const i = steps.indexOf(id); if (i >= 0) setStepIdx(i); };

  const tapRes = useRef<{ taps: number[]; errs: number; keys: Record<string, { ms: number[]; err: number }> } | null>(null);
  const typeParts = useRef<SessionResult[]>([]);
  const pendingDefault = useRef<AssessmentResult | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [planStage, setPlanStage] = useState(0);
  const [usedDefault, setUsedDefault] = useState(false);

  // Build texts once
  const wordText = useMemo(() => {
    const rng = mulberry32(Date.now() % 1e9 + 7);
    const pool = a.age === 'kid' ? KID_WORDS : COMMON_WORDS.slice(0, 300);
    return pickN(rng, pool, 60).join(' ');
  }, [a.age, step === 'words']);
  const sentText = useMemo(() => {
    const rng = mulberry32(Date.now() % 1e9 + 13);
    return pickN(rng, a.age === 'kid' ? KID_SENTENCES : SENTENCES, 3).join(' ');
  }, [a.age, step === 'sentence']);

  const defaultAssessment = (): AssessmentResult => {
    const exp = a.path === 'new' ? 'new' : a.exp;
    const base = exp === 'new' ? { wpm: 8, acc: 90, reaction: 520, stage: 0 }
      : exp === 'some' ? { wpm: 22, acc: 93, reaction: 400, stage: 2 }
      : { wpm: 38, acc: 95, reaction: 320, stage: 4 };
    return {
      wpm: base.wpm, raw: base.wpm + 2, acc: base.acc, consistency: 45, rhythm: 45,
      reactionMs: base.reaction, backspaceRate: 4, hesitationRate: 4,
      weakKeys: [], slowKeys: [], weakPairs: [], likelyLooking: a.looks === 'always',
      level: base.stage, rank: rankOf(base.wpm, base.acc),
      insight: 'You chose a starter plan: a balanced beginning matched to your experience. Take the real placement anytime from Practise to sharpen it around your actual keys.',
      t: Date.now(),
    };
  };

  const compute = (): AssessmentResult => {
    const tap = tapRes.current;
    const parts = typeParts.current;
    const reaction = tap ? Math.round(median(tap.taps)) : 600;
    let wpm = 8, raw = 9, acc = 90, consistency = 30, rhythm = 30, backspaceRate = 0, hesitationRate = 0.1;
    let keyAgg: Record<string, { a: number; e: number; ms: number; n: number }> = {};
    if (parts.length) {
      const comb = combineResults(parts, 'assessment', 'Placement');
      wpm = comb.wpm; raw = comb.raw; acc = comb.acc; consistency = comb.consistency; rhythm = comb.rhythm;
      backspaceRate = comb.typed ? comb.backspaces / comb.typed : 0;
      hesitationRate = comb.typed ? comb.hesitations / comb.typed : 0;
      keyAgg = comb.keyAgg;
    } else if (tap) {
      const cpm = 60000 / Math.max(240, reaction);
      wpm = Math.round(Math.min(14, cpm / 5));
      raw = wpm + 1;
      acc = Math.round((tap.taps.length / Math.max(1, tap.taps.length + tap.errs)) * 100);
    }
    if (tap) {
      for (const [k, v] of Object.entries(tap.keys)) {
        const cur = keyAgg[k] ?? { a: 0, e: 0, ms: 0, n: 0 };
        cur.a += v.ms.length + v.err; cur.e += v.err;
        if (v.ms.length) { cur.ms = Math.round((cur.ms * cur.n + median(v.ms) * v.ms.length) / (cur.n + v.ms.length)); cur.n += v.ms.length; }
        keyAgg[k] = cur;
      }
    }
    const entries = Object.entries(keyAgg).filter(([k]) => /^[a-z;,.']$/.test(k));
    const weakKeys = entries.filter(([, s]) => s.e > 0).sort((x, y) => y[1].e / y[1].a - x[1].e / x[1].a).slice(0, 4).map(([k]) => k);
    const slowKeys = entries.filter(([, s]) => s.n >= 2).sort((x, y) => y[1].ms - x[1].ms).slice(0, 3).map(([k]) => k);
    const errPairs = parts.flatMap((p) => p.errorPairs).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([p]) => p);
    const likelyLooking = a.looks === 'always' || reaction > 850 || hesitationRate > 0.09;
    const stage = a.path === 'new' || wpm < 9 ? 0 : wpm < 16 ? 1 : wpm < 24 ? 2 : wpm < 32 ? 3 : wpm < 42 ? 4 : wpm < 50 ? 5 : 6;
    const rank = rankOf(wpm, acc);

    const bits: string[] = [];
    if (acc >= 95) bits.push(`Your accuracy is already strong at ${acc}%`);
    else if (acc >= 90) bits.push(`Your accuracy is solid at ${acc}%`);
    else bits.push(`Accuracy is your first opportunity. ${acc}% today`);
    if (weakKeys.length) bits.push(`your next breakthrough will come from steadier ${weakKeys.slice(0, 3).map((k) => k.toUpperCase()).join(', ')}`);
    else if (slowKeys.length) bits.push(`your next breakthrough is speed on ${slowKeys.slice(0, 2).map((k) => k.toUpperCase()).join(' and ')}`);
    if (errPairs.length) bits.push(`and smoothing the ${errPairs[0].toUpperCase()} transition`);
    else if (likelyLooking) bits.push('and building trust to type without looking down');
    else if (consistency < 50 && parts.length) bits.push('and evening out your rhythm');
    const insight = bits.join(', ') + '.';

    return {
      wpm, raw, acc, consistency, rhythm, reactionMs: reaction,
      backspaceRate: Math.round(backspaceRate * 1000) / 10,
      hesitationRate: Math.round(hesitationRate * 1000) / 10,
      weakKeys, slowKeys, weakPairs: errPairs, likelyLooking,
      level: stage, rank, insight, t: Date.now(),
    };
  };

  /** Creates (or updates) the profile from the current answers + an assessment. */
  const commitProfile = (res: AssessmentResult) => {
    setAssessment(res);
    setPlanStage(res.level);
    if (retest) {
      finishAssessment(res, res.level, false);
      return;
    }
    const name = a.name.trim() || (a.age === 'kid' ? randomKidName() : 'Explorer');
    const newId = createProfile({
      name, avatar: a.avatar, ageGroup: a.age, goal: a.goal, looksAtKeyboard: a.looks,
      experience: a.path === 'new' ? 'new' : a.exp, layout: a.layout, competitive: a.competitive, coach: a.coach,
    });
    // Device already holds MAX_PROFILES — the store refused. Send them back to
    // the picker rather than silently writing settings onto whoever is active.
    if (!newId) { nav('/who'); return; }
    useStore.getState().patch((d) => {
      d.settings.soundOn = a.sound;
      d.settings.fontScale = a.fontScale;
      d.settings.reducedMotion = a.reducedMotion;
      d.settings.dyslexiaFont = a.dyslexia;
      d.settings.untimed = a.untimed;
      if (a.contrast) d.settings.theme = 'contrast';
      if (a.age === 'kid') d.settings.correction = 'strict';
      if (!a.competitive) d.settings.hideLeaderboards = true;
    });
    finishAssessment(res, res.level, true);
  };

  /** Skip the entire remaining setup: build a default profile and go straight in.
   *  Anything already chosen (name, avatar, age) is kept. */
  const skipAll = () => {
    commitProfile(defaultAssessment());
    nav('/app');
  };

  /** Skip the assessment but still show the resulting starter plan. */
  const skipToStarterPlan = () => {
    pendingDefault.current = defaultAssessment();
    setUsedDefault(true);
    goTo('computing');
  };

  /** Mid-test escape: retakers return to Practise, first-timers get a starter plan. */
  const skipTest = () => {
    tapRes.current = null;
    typeParts.current = [];
    if (retest) nav('/app/practice');
    else skipToStarterPlan();
  };

  useEffect(() => {
    if (step === 'computing') {
      const res = pendingDefault.current ?? compute();
      pendingDefault.current = null;
      const t = setTimeout(() => { commitProfile(res); next(); }, 1600);
      return () => clearTimeout(t);
    }
  }, [step]);

  const pct = Math.round(((stepIdx + 1) / steps.length) * 100);
  const skippable = ['goal', 'habits', 'setup', 'access'].includes(step);

  // The device is full. Bounce to the picker before the questions start rather
  // than letting someone answer six screens and then hit the wall. Retakes are
  // exempt — they re-test an existing profile instead of adding one.
  if (full && !retest) return <Navigate to="/who" replace />;

  return (
    <div className="ob-page">
      <Link to="/" aria-label="Back to landing page"><Logo /></Link>
      <div className="ob-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div>

      {step === 'welcome' && (
        <div className="ob-card">
          <h1>Welcome, traveller.</h1>
          <p>KeyTopia turns your keyboard into a world you learn to cross without looking down. Two minutes of questions, one tiny test, or skip straight in with smart defaults.</p>
          <div className="opt-grid">
            <Opt on={a.path === 'new'} onClick={() => upd({ path: 'new', exp: 'new' })} icon="sprout" title="I'm new to typing" sub="Start from the very beginning" />
            <Opt on={a.path === 'place'} onClick={() => upd({ path: 'place' })} icon="compass" title="I can type. Place me" sub="A short test finds your level" />
          </div>
          {hasProfile && !retest && <p className="small muted">Already have a profile on this device? <Link to="/app" style={{ color: 'var(--accent)' }}>Continue where you left off →</Link></p>}
          <div className="ob-nav"><Btn kind="ghost" onClick={skipAll}>Skip setup</Btn><Btn onClick={next}>Continue →</Btn></div>
        </div>
      )}

      {step === 'age' && (
        <div className="ob-card">
          <h1>Who's learning?</h1>
          <p>KeyTopia adapts its words, pace and world to the typist.</p>
          <div className="opt-grid">
            <Opt on={a.ageLabel === 'Under 10'} onClick={() => upd({ age: 'kid', ageLabel: 'Under 10', coach: 'energetic', goal: 'fun' })} icon="candy" title="Under 10" sub="Short quests, friendly words" />
            <Opt on={a.ageLabel === '10–13'} onClick={() => upd({ age: 'kid', ageLabel: '10–13', coach: 'energetic', goal: 'school' })} icon="backpack" title="10–13" sub="School-ready practice" />
            <Opt on={a.ageLabel === '13–17'} onClick={() => upd({ age: 'teen', ageLabel: '13–17', coach: 'competitive' })} icon="headphones" title="13–17" sub="Challenges & races" />
            <Opt on={a.ageLabel === '18+'} onClick={() => upd({ age: 'adult', ageLabel: '18+', coach: 'teacher' })} icon="briefcase" title="18+" sub="Focused, practical training" />
          </div>
          <div className="ob-nav">{!quick ? <Btn kind="ghost" onClick={back}>← Back</Btn> : <span />}<span className="row gap"><Btn kind="ghost" onClick={skipAll}>Skip setup</Btn><Btn onClick={next}>Continue →</Btn></span></div>
        </div>
      )}

      {step === 'identity' && (
        <div className="ob-card">
          <h1>Choose your explorer</h1>
          <p>{a.age === 'kid' ? 'Pick a fun name, not your real one, and build your block explorer.' : 'A display name and a block character. You can change both later.'}</p>
          <label className="small muted" htmlFor="ob-name">Display name</label>
          <div className="row gap" style={{ margin: '6px 0 16px' }}>
            <input id="ob-name" className="ob-input" value={a.name} maxLength={18} placeholder={a.age === 'kid' ? 'e.g. SwiftFalcon12' : 'e.g. Rafael'} onChange={(e) => upd({ name: e.target.value })} />
            <Btn kind="soft" onClick={() => upd({ name: randomKidName() })}><Ic n="dice" size={16} /> Suggest</Btn>
          </div>
          <label className="small muted">Your block explorer, more unlock as you level up</label>
          <div className="avatar-grid" style={{ marginTop: 6 }}>
            {PRESET_CHARACTERS.map((p, i) => {
              const locked = p.level > 0;
              const v = presetValue(i);
              return (
                <button
                  key={i} type="button"
                  className={`avatar-pick ${a.avatar === v ? 'on' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => { if (!locked) upd({ avatar: v }); }}
                  disabled={locked}
                  aria-label={locked ? `Explorer locked until level ${p.level}` : `Choose explorer ${i + 1}`}
                  aria-pressed={a.avatar === v}
                >
                  <BlockAvatar preset={i} size={40} />
                  {locked && <span className="lock-lv">Lv{p.level}</span>}
                </button>
              );
            })}
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>Everything stays on this device. No account or email needed. You can hit <strong>Skip setup</strong> at any point to jump straight in with sensible defaults.</p>
          <div className="ob-nav"><Btn kind="ghost" onClick={back}>← Back</Btn><span className="row gap"><Btn kind="ghost" onClick={skipAll}>Skip setup</Btn><Btn onClick={next}>Continue →</Btn></span></div>
        </div>
      )}

      {step === 'goal' && (
        <div className="ob-card">
          <h1>What brings you to the keys?</h1>
          <p>Your goal shapes your daily plan and the content you practise.</p>
          <div className="opt-grid">
            {a.age !== 'adult' && <Opt on={a.goal === 'school'} onClick={() => upd({ goal: 'school' })} icon="book" title="School & homework" sub="Essays, projects, speed for class" />}
            {a.age === 'adult' && <Opt on={a.goal === 'work'} onClick={() => upd({ goal: 'work' })} icon="briefcase" title="Work & productivity" sub="Email, documents, meetings" />}
            <Opt on={a.goal === 'basics'} onClick={() => upd({ goal: 'basics' })} icon="blocks" title="Proper technique" sub="Learn touch typing from zero" />
            <Opt on={a.goal === 'speed'} onClick={() => upd({ goal: 'speed' })} icon="zap" title="Raw speed" sub="Chase records and races" />
            <Opt on={a.goal === 'accuracy'} onClick={() => upd({ goal: 'accuracy' })} icon="target" title="Accuracy first" sub="Clean, controlled, error-free" />
            {a.age !== 'kid' && <Opt on={a.goal === 'code'} onClick={() => upd({ goal: 'code' })} icon="braces" title="Code & symbols" sub="Brackets, syntax, terminals" />}
            <Opt on={a.goal === 'fun'} onClick={() => upd({ goal: 'fun' })} icon="party" title="Fun & games" sub="Play your way to skill" />
          </div>
          <div className="ob-nav"><Btn kind="ghost" onClick={back}>← Back</Btn><span className="row gap"><Btn kind="ghost" onClick={skipAll}>Skip setup</Btn><Btn onClick={next}>Continue →</Btn></span></div>
        </div>
      )}

      {step === 'habits' && (
        <div className="ob-card">
          <h1>Honest check-in</h1>
          <p>No judgement: this only tunes your training.</p>
          <h3 style={{ margin: '10px 0 6px' }}>Do you look at the keyboard while typing?</h3>
          <div className="opt-grid">
            <Opt on={a.looks === 'always'} onClick={() => upd({ looks: 'always' })} icon="eye" title="Almost always" />
            <Opt on={a.looks === 'sometimes'} onClick={() => upd({ looks: 'sometimes' })} icon="glasses" title="Sometimes" />
            <Opt on={a.looks === 'rarely'} onClick={() => upd({ looks: 'rarely' })} icon="eye-off" title="Rarely or never" />
          </div>
          {a.path !== 'new' && (
            <>
              <h3 style={{ margin: '14px 0 6px' }}>How would you describe your typing?</h3>
              <div className="opt-grid">
                <Opt on={a.exp === 'some'} onClick={() => upd({ exp: 'some' })} icon="snail" title="Getting there" sub="I hunt and peck a bit" />
                <Opt on={a.exp === 'confident'} onClick={() => upd({ exp: 'confident' })} icon="rabbit" title="Confident" sub="I want speed & polish" />
              </div>
            </>
          )}
          <div className="ob-nav"><Btn kind="ghost" onClick={back}>← Back</Btn><span className="row gap"><Btn kind="ghost" onClick={skipAll}>Skip setup</Btn><Btn onClick={next}>Continue →</Btn></span></div>
        </div>
      )}

      {step === 'setup' && (
        <div className="ob-card">
          <h1>Your keyboard & style</h1>
          <label className="small muted" htmlFor="ob-layout">Keyboard layout</label>
          <select id="ob-layout" className="ob-input" style={{ margin: '6px 0 16px' }} value={a.layout} onChange={(e) => upd({ layout: e.target.value as LayoutId })}>
            {(Object.keys(LAYOUT_NAMES) as LayoutId[]).map((l) => <option key={l} value={l}>{LAYOUT_NAMES[l]}</option>)}
          </select>
          <h3 style={{ marginBottom: 6 }}>Coaching personality</h3>
          <div className="opt-grid">
            {(Object.keys(COACH_STYLES) as CoachStyle[]).map((c) => (
              <Opt key={c} on={a.coach === c} onClick={() => upd({ coach: c })} icon={COACH_STYLES[c].emoji} title={COACH_STYLES[c].name} sub={COACH_STYLES[c].desc} />
            ))}
          </div>
          <div className="opt-grid" style={{ marginTop: 8 }}>
            <Opt on={a.sound} onClick={() => upd({ sound: !a.sound })} icon="volume" title={a.sound ? 'Sound on' : 'Sound off'} sub="Key clicks & gentle cues" />
            <Opt on={a.competitive} onClick={() => upd({ competitive: !a.competitive })} icon="flag" title={a.competitive ? 'Competition on' : 'Competition off'} sub="Races, boards & rivals" />
          </div>
          <div className="ob-nav"><Btn kind="ghost" onClick={back}>← Back</Btn><span className="row gap"><Btn kind="ghost" onClick={skipAll}>Skip setup</Btn><Btn onClick={next}>Continue →</Btn></span></div>
        </div>
      )}

      {step === 'access' && (
        <div className="ob-card">
          <h1>Comfort & accessibility</h1>
          <p>Set these now or anytime in Settings. Typing should feel good for every body and brain.</p>
          <div className="opt-grid">
            <Opt on={a.fontScale > 1} onClick={() => upd({ fontScale: a.fontScale > 1 ? 1 : 1.2 })} icon="zoom" title="Larger text" />
            <Opt on={a.dyslexia} onClick={() => upd({ dyslexia: !a.dyslexia })} icon="type" title="High-legibility font" sub="Atkinson Hyperlegible" />
            <Opt on={a.reducedMotion} onClick={() => upd({ reducedMotion: !a.reducedMotion })} icon="leaf" title="Reduce motion" />
            <Opt on={a.contrast} onClick={() => upd({ contrast: !a.contrast })} icon="eye" title="High contrast theme" />
            <Opt on={a.untimed} onClick={() => upd({ untimed: !a.untimed })} icon="hourglass" title="Untimed lessons" sub="No countdown pressure" />
          </div>
          <div className="ob-nav"><Btn kind="ghost" onClick={back}>← Back</Btn><span className="row gap"><Btn kind="ghost" onClick={skipAll}>Skip setup</Btn><Btn onClick={next}>Continue →</Btn></span></div>
        </div>
      )}

      {step === 'assessIntro' && (
        <div className="ob-card">
          <h1>{retest ? 'Retake your placement' : a.path === 'new' ? 'A tiny key quest' : 'The 60-second placement'}</h1>
          <p>
            {retest
              ? 'A fresh read of your speed, accuracy, rhythm and weak keys. Your progress and badges stay: only the plan updates.'
              : a.path === 'new'
                ? 'Press the keys as they appear. This teaches us your starting point: there is no way to fail.'
                : `Quick reactions, then ${a.age === 'kid' ? 'a short word run' : 'a word run and one sentence'}. We measure speed, accuracy, rhythm and hesitation, then build your personal path.`}
          </p>
          <p className="small muted">Sit comfortably. Rest your index fingers on the two bump keys (F and J on most keyboards). You can skip the test anytime with Esc.</p>
          <div className="ob-nav">
            {retest ? <Btn kind="ghost" onClick={() => nav('/app/practice')}>← Back to Practise</Btn> : <Btn kind="ghost" onClick={back}>← Back</Btn>}
            <span className="row gap wrap" style={{ justifyContent: 'flex-end' }}>
              {!retest && <Btn kind="soft" onClick={skipToStarterPlan}>Skip test, use starter plan</Btn>}
              <Btn big onClick={next}>Start →</Btn>
            </span>
          </div>
        </div>
      )}

      {step === 'tap' && (
        <div className="ob-card">
          <h1 className="center" style={{ fontSize: '1.2rem' }}>Key reflexes</h1>
          <TapTest layout={a.layout} count={a.path === 'new' && !retest ? 16 : 10} onDone={(r) => { tapRes.current = r; next(); }} onSkip={skipTest} />
        </div>
      )}

      {step === 'words' && (
        <div className="ob-card">
          <h1 className="center" style={{ fontSize: '1.2rem' }}>Word run</h1>
          <TypeStep text={wordText} seconds={30} layout={a.layout} label="30 seconds · common words" onDone={(r) => { typeParts.current.push(r); next(); }} onSkip={skipTest} />
        </div>
      )}

      {step === 'sentence' && (
        <div className="ob-card">
          <h1 className="center" style={{ fontSize: '1.2rem' }}>Real sentences</h1>
          <TypeStep text={sentText} seconds={30} layout={a.layout} label="30 seconds · capitals & punctuation" onDone={(r) => { typeParts.current.push(r); next(); }} onSkip={skipTest} />
        </div>
      )}

      {step === 'computing' && (
        <div className="ob-card center" aria-live="polite">
          <h1>Drawing your map…</h1>
          <p>{usedDefault ? 'Preparing your starter plan.' : 'Measuring rhythm, weak keys and finger balance.'}</p>
          <div style={{ margin: '26px auto', maxWidth: 320 }}><Bar value={0.9} height={10} /></div>
          <div className="row gap center" style={{ justifyContent: 'center', color: 'var(--muted)' }}>
            <Ic n="keyboard" size={18} /> → <Ic n="map" size={18} /> → <Ic n="sparkles" size={18} />
          </div>
        </div>
      )}

      {step === 'plan' && assessment && (
        <div className="ob-card plan-summary">
          <div className="plan-rank">
            <p className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>{usedDefault ? 'Your starter rank' : 'Your starting rank'}</p>
            <div className="rank-name">{assessment.rank}</div>
            <div className="row gap" style={{ justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <Chip tone="accent">{assessment.wpm} WPM</Chip>
              <Chip tone={assessment.acc >= 94 ? 'good' : 'warn'}>{assessment.acc}% accuracy</Chip>
              <Chip>{assessment.reactionMs}ms key response</Chip>
            </div>
          </div>
          <div className="skill-bars">
            {[['Speed', Math.min(1, assessment.wpm / 80)], ['Accuracy', Math.max(0, (assessment.acc - 70) / 30)], ['Rhythm', assessment.rhythm / 100], ['Control', Math.max(0, 1 - assessment.backspaceRate / 12)]].map(([label, v]) => (
              <div key={label as string}>
                <div className="row spread"><span className="small">{label as string}</span><span className="small muted">{Math.round((v as number) * 100)}</span></div>
                <Bar value={v as number} />
              </div>
            ))}
          </div>
          <div className="coach-card">
            <span style={{ color: 'var(--accent)' }}><Ic n="bulb" size={26} /></span>
            <div>
              <div className="coach-title">Kip's read</div>
              <p className="coach-text">{assessment.insight}</p>
            </div>
          </div>
          <p className="small muted center">
            Your journey {retest ? 'continues' : 'begins'} in <strong>{['Base Camp', 'The Heartlands', 'Skyreach Ridge', 'Deeproot Vale', 'The Twin Gates', 'Numeral Peaks', 'Punctuation Straits'][planStage] ?? 'The Long Roads'}</strong>{!retest && <> with a daily goal of {a.age === 'kid' ? 8 : 10} focused minutes</>}.
          </p>
          <Btn big onClick={() => nav('/app')}>{retest ? 'Back to my world →' : 'Enter KeyTopia →'}</Btn>
        </div>
      )}
    </div>
  );
}
