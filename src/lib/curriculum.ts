import { layoutGroups, DIGITS } from './keyboard';
import type { AgeGroup, LayoutId, ProfileData } from './types';
import { COMMON_WORDS, KID_WORDS, KID_SENTENCES, SENTENCES, PARAGRAPHS, TRICKY_WORDS, WORK_TEXTS } from './words';
import { mulberry32, pick, pickN, shuffle, type Rng } from './rng';
import { levelFromXp } from './metrics';

const FREQ = 'etaoinshrdlcumwfgypbvkjxqz';
function byFreq(chars: string[]): string[] {
  return [...chars].sort((a, b) => {
    const ia = FREQ.indexOf(a); const ib = FREQ.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

export interface LessonDef {
  id: string;
  title: string;
  tip: string;
  newKeys: string[];
  kind: 'keys' | 'words' | 'capitals' | 'punct' | 'numbers' | 'symbols' | 'paragraph' | 'ladder' | 'check'
    | 'rhythm' | 'work' | 'blind' | 'longwalk' | 'recovery' | 'gauntlet';
  stage: number;
}

export interface StageDef {
  id: number;
  name: string;
  region: string;
  icon: string;
  desc: string;
  skill: string;
  lessons: LessonDef[];
}

export const REGION_META = [
  { region: 'Base Camp', icon: 'tent', desc: 'Posture, hand position and your two anchor keys.', skill: 'Setup & anchors' },
  { region: 'The Heartlands', icon: 'wheat', desc: 'The home row — where every journey starts and ends.', skill: 'Home row' },
  { region: 'Skyreach Ridge', icon: 'mountain', desc: 'Reach up to the top row without losing your anchors.', skill: 'Top row' },
  { region: 'Deeproot Vale', icon: 'tree', desc: 'Curl down to the bottom row with control.', skill: 'Bottom row' },
  { region: 'The Twin Gates', icon: 'landmark', desc: 'Shift keys, capital letters and first punctuation.', skill: 'Capitals & . , ?' },
  { region: 'Numeral Peaks', icon: 'peaks', desc: 'The number row — high reaches, steady returns.', skill: 'Numbers' },
  { region: 'Punctuation Straits', icon: 'anchor', desc: 'Colons, quotes and brackets — navigate the narrow water.', skill: 'Punctuation' },
  { region: 'The Glyph Foundry', icon: 'hammer', desc: 'Symbols and code — the toolmaker\'s district.', skill: 'Symbols & code' },
  { region: 'The Long Roads', icon: 'route', desc: 'Paragraphs, rhythm, speed and endurance mastery.', skill: 'Flow & mastery' },
];

/**
 * The five-world spine both journeys share (docs/two-worlds-plan.md §2).
 * Worlds regroup existing stages — lesson ids never change, so world
 * membership is pure metadata and old profiles carry over untouched.
 * Difficulty ramps across worlds, not within them.
 */
export interface WorldSpine {
  id: string;
  name: string;
  stages: number[];       // curriculum stage indices folded into this world
  icon: string;
  tagline: string;
  /** adult targetWpm range across the world; kids get the 0.72 multiplier */
  wpm: [number, number];
  targetAcc: number;
}

export const WORLD_SPINE: WorldSpine[] = [
  { id: 'w1', name: 'First Steps', stages: [0, 1], icon: 'tent', tagline: 'Posture, anchors and the home row', wpm: [8, 14], targetAcc: 92 },
  { id: 'w2', name: 'The High & Low Roads', stages: [2, 3], icon: 'mountain', tagline: 'Top and bottom rows — the full alphabet', wpm: [14, 20], targetAcc: 93 },
  { id: 'w3', name: 'The Written Word', stages: [4, 6], icon: 'landmark', tagline: 'Capitals, punctuation, real sentences', wpm: [20, 26], targetAcc: 94 },
  { id: 'w4', name: 'Numbers & Glyphs', stages: [5, 7], icon: 'peaks', tagline: 'The number row, symbols and code', wpm: [26, 32], targetAcc: 95 },
  { id: 'w5', name: 'The Flow', stages: [8], icon: 'route', tagline: 'Rhythm, endurance and real-world mastery', wpm: [30, 42], targetAcc: 96 },
];

export function buildStages(layout: LayoutId): StageDef[] {
  const g = layoutGroups(layout);
  const core = g.homeCore;                       // 8 home keys
  const inner = g.homeAll.filter((c) => !core.includes(c));
  const top = byFreq(g.top);
  const bottom = byFreq(g.bottom);
  const L = (stage: number, id: string, title: string, tip: string, newKeys: string[], kind: LessonDef['kind']): LessonDef =>
    ({ id, title, tip, newKeys, kind, stage });

  const stages: StageDef[] = REGION_META.map((m, i) => ({
    id: i, name: `Stage ${i + 1}`, region: m.region, icon: m.icon, desc: m.desc, skill: m.skill, lessons: [],
  }));

  stages[0].lessons = [
    L(0, 'b1', 'Anchors away', 'Rest your index fingers on the two bump keys. They are your compass — you can always find them without looking.', [core[3], core[4]], 'keys'),
    L(0, 'b2', 'The space between', 'Tap the space bar with your thumb, then float straight back. Wrists stay light, shoulders stay low.', [core[3], core[4], ' '], 'keys'),
  ];
  stages[1].lessons = [
    L(1, 'h1', 'Middle neighbours', 'Middle fingers reach their home keys without the hand moving. Only the finger travels.', [core[2], core[5]], 'keys'),
    L(1, 'h2', 'Ring roads', 'Ring fingers are slower for everyone. Give them time — precision now, speed later.', [core[1], core[6]], 'keys'),
    L(1, 'h3', 'Pinky posts', 'Pinkies guard the edges of the Heartlands. Small keys, big responsibility.', [core[0], core[7]], 'keys'),
    L(1, 'h4', 'Inner reaches', 'Index fingers stretch inward one key, then return home immediately.', inner, 'keys'),
    L(1, 'h5', 'Heartlands crossing', 'Your first real words using only the home row. Look at the screen, not your hands.', [], 'check'),
  ];
  const tPairs = [[top[0], top[1]], [top[2], top[3]], [top[4], top[5]], [top[6], top[7]], top.slice(8)];
  stages[2].lessons = [
    L(2, 't1', `Up to ${tPairs[0].join(' & ').toUpperCase()}`, 'Reach up with the finger that owns the key, then come straight back to home.', tPairs[0], 'keys'),
    L(2, 't2', `The ${tPairs[1].join(' & ').toUpperCase()} pass`, 'Keep the other hand resting on its home keys while one hand reaches.', tPairs[1], 'keys'),
    L(2, 't3', `Climbing ${tPairs[2].join(' & ').toUpperCase()}`, 'Watch for drifting — after each reach, feel for the bump keys again.', tPairs[2], 'keys'),
    L(2, 't4', `The ${tPairs[3].join(' & ').toUpperCase()} traverse`, 'Outer fingers now. Slow is fine. Wrong fingers are not.', tPairs[3], 'keys'),
    L(2, 't5', `Summit: ${tPairs[4].join(' & ').toUpperCase()}`, 'The far corners of the ridge. Pinkies and ring fingers, steady on.', tPairs[4], 'keys'),
    L(2, 't6', 'Ridge run', 'Top and home rows together — real words, real sentences.', [], 'check'),
  ];
  const bPairs = [[bottom[0], bottom[1]], [bottom[2], bottom[3]], bottom.slice(4)];
  stages[3].lessons = [
    L(3, 'd1', `Down to ${bPairs[0].join(' & ').toUpperCase()}`, 'Curl the finger down and under. The hand stays level; only the finger dips.', bPairs[0], 'keys'),
    L(3, 'd2', `Roots ${bPairs[1].join(' & ').toUpperCase()}`, 'Bottom-row reaches feel longest. Trust the return to home.', bPairs[1], 'keys'),
    L(3, 'd3', `Deep grove: ${bPairs[2].join(' & ').toUpperCase()}`, 'The rarest letters live down here. Meet them properly now, thank yourself later.', bPairs[2], 'keys'),
    L(3, 'd4', 'Full alphabet trail', 'Every letter unlocked. This crossing uses the whole map.', [], 'check'),
  ];
  stages[4].lessons = [
    L(4, 'c1', 'The opposite gate', 'Capital letter rule: press Shift with the opposite hand\'s pinky. Right-hand letter, left Shift — and back.', ['A'], 'capitals'),
    L(4, 'c2', 'Full stops & commas', 'Punctuation belongs to the right hand\'s strongest travellers. Period, comma, new thought.', ['.', ','], 'punct'),
    L(4, 'c3', 'Questions & wonder', 'Question marks and exclamations both need Shift. Apostrophes are a gentle pinky reach.', ['?', '!', "'"], 'punct'),
    L(4, 'c4', 'Through the gates', 'Real sentences with capitals and punctuation. Breathe at the full stops.', [], 'check'),
  ];
  stages[5].lessons = [
    L(5, 'n1', 'Left peaks 1–5', 'Number reaches are long. Anchor the right hand while the left climbs.', ['1', '2', '3', '4', '5'], 'numbers'),
    L(5, 'n2', 'Right peaks 6–0', 'Same climb, other side. Return to home between every number.', ['6', '7', '8', '9', '0'], 'numbers'),
    L(5, 'n3', 'Mixed altitude', 'Numbers inside real text — dates, times, quantities.', DIGITS, 'numbers'),
    L(5, 'n4', 'Peak crossing', 'A full passage with numbers woven in.', [], 'check'),
  ];
  stages[6].lessons = [
    L(6, 'p1', 'Colons & semicolons', 'The pinky\'s precision tools. Light touches, no wrist twist.', [';', ':'], 'punct'),
    L(6, 'p2', 'Quotes & speech', 'Opening and closing quotes — Shift plus the apostrophe key.', ['"'], 'punct'),
    L(6, 'p3', 'Brackets & dashes', 'Parentheses come in pairs (like this). Dashes join — and separate.', ['(', ')', '-'], 'punct'),
    L(6, 'p4', 'The narrow channel', 'Dense punctuation in real prose. Take it slow and clean.', [], 'check'),
  ];
  stages[7].lessons = [
    L(7, 's1', 'Signs & signals', 'Email addresses, tags and prices: the everyday symbols.', ['@', '#', '$', '%', '&'], 'symbols'),
    L(7, 's2', 'Operators', 'Plus, equals, star, slash — the arithmetic of the keyboard.', ['+', '=', '*', '/', '_'], 'symbols'),
    L(7, 's3', 'The bracket forge', 'Square and curly brackets, angle pairs — the shapes of code.', ['[', ']', '{', '}', '<', '>'], 'symbols'),
    L(7, 's4', 'Foundry trial', 'Code-flavoured lines with the full symbol set.', [], 'check'),
  ];
  stages[8].lessons = [
    L(8, 'l1', 'Paragraph flow', 'Longer passages reward rhythm over bursts. Find a pace you could hold all day.', [], 'paragraph'),
    L(8, 'l2', 'The confidence ladder', 'Type the same passage three times: relaxed, steady, then at full stride.', [], 'ladder'),
    L(8, 'l3', 'The long walk', 'An endurance passage. Consistency matters more than any single fast burst.', [], 'paragraph'),
    L(8, 'l4', 'Master of the roads', 'The final crossing — everything, everywhere, all at once.', [], 'check'),
    L(8, 'f1', 'The rhythm river', 'Even-sized words, even keystrokes. Imagine a metronome and land every letter on the beat.', [], 'rhythm'),
    L(8, 'f2', 'The working desk', 'Emails, notes and updates — the typing real days are made of.', [], 'work'),
    L(8, 'f3', 'Eyes on the horizon', 'Type this without looking down once. Your fingers already know the way home.', [], 'blind'),
    L(8, 'f4', 'The longer walk', 'Two full passages back to back. Hold one steady pace from first line to last.', [], 'longwalk'),
    L(8, 'f5', 'The recovery road', 'Tricky words are planted on purpose. Miss one? Exhale, fix it, and find your rhythm within three words.', [], 'recovery'),
    L(8, 'f6', 'The flow gauntlet', 'Everything at once: prose, capitals, numbers and symbols. The last trial of the journey.', [], 'gauntlet'),
  ];
  return stages;
}

export function allLessons(layout: LayoutId): LessonDef[] {
  return buildStages(layout).flatMap((s) => s.lessons);
}

export function lessonById(layout: LayoutId, id: string): LessonDef | undefined {
  return allLessons(layout).find((l) => l.id === id);
}

/** Chars available to a learner at a given lesson (all keys introduced up to & incl. it). */
export function knownKeysAt(layout: LayoutId, lessonId: string): string[] {
  const lessons = allLessons(layout);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  const keys = new Set<string>([' ']);
  lessons.slice(0, idx + 1).forEach((l) => l.newKeys.forEach((k) => { if (k.length === 1) keys.add(k.toLowerCase()); }));
  return [...keys];
}

function wordsFromPool(allowed: Set<string>, pool: string[], min = 8): string[] {
  const ok = pool.filter((w) => [...w].every((c) => allowed.has(c)));
  return ok.length >= min ? ok : ok;
}

function pseudoWords(rng: Rng, chars: string[], count: number): string[] {
  const letters = chars.filter((c) => /[a-z]/.test(c));
  if (!letters.length) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const len = 2 + Math.floor(rng() * 3);
    let w = '';
    for (let j = 0; j < len; j++) w += pick(rng, letters);
    out.push(w);
  }
  return out;
}

function keyPatternLine(rng: Rng, newKeys: string[], anchors: string[], reps: number): string {
  const ks = newKeys.filter((k) => k !== ' ');
  const parts: string[] = [];
  for (const k of ks) parts.push(k.repeat(3));
  for (const k of ks) {
    const other = ks.length > 1 ? ks[(ks.indexOf(k) + 1) % ks.length] : (anchors[0] ?? k);
    parts.push(`${k}${other}${k}`);
  }
  for (let i = 0; i < reps; i++) {
    const a = pick(rng, ks);
    const b = pick(rng, anchors.length ? anchors : ks);
    parts.push(rng() > 0.5 ? `${a}${b}${a}` : `${b}${a}${b}`);
  }
  return shuffle(rng, parts).join(' ');
}

export interface LessonStep {
  kind: 'drill' | 'words' | 'check';
  label: string;
  text: string;
}

export interface LessonPlan {
  steps: LessonStep[];
  targetWpm: number;
  targetAcc: number;
}

export function buildLessonPlan(layout: LayoutId, lesson: LessonDef, age: AgeGroup, seed?: number): LessonPlan {
  const rng = mulberry32(seed ?? Math.floor(Math.random() * 1e9));
  const kid = age === 'kid';
  const known = new Set(knownKeysAt(layout, lesson.id));
  const stages = buildStages(layout);
  const anchors = stages[0].lessons[0].newKeys;
  const pool = kid ? [...KID_WORDS, ...COMMON_WORDS] : COMMON_WORDS;
  const sentPool = kid ? KID_SENTENCES : SENTENCES;
  const lineWords = kid ? 6 : 9;
  const steps: LessonStep[] = [];
  // Difficulty ramps across worlds, not within them (plan §2.3): each world
  // sweeps its own wpm range, so early worlds stay gentle and W5 truly climbs.
  const world = WORLD_SPINE.find((w) => w.stages.includes(lesson.stage)) ?? WORLD_SPINE[WORLD_SPINE.length - 1];
  const wLessons = world.stages.flatMap((si) => stages[si]?.lessons ?? []);
  const wi = Math.max(0, wLessons.findIndex((l) => l.id === lesson.id));
  const wp = wLessons.length > 1 ? wi / (wLessons.length - 1) : 0;
  const targetWpm = Math.round((world.wpm[0] + (world.wpm[1] - world.wpm[0]) * wp) * (kid ? 0.72 : 1));
  const targetAcc = world.targetAcc;

  const addWordLines = (n: number, label: string) => {
    const words = wordsFromPool(known, pool, 8);
    for (let i = 0; i < n; i++) {
      const ws = words.length >= 6
        ? pickN(rng, words, Math.min(words.length, lineWords))
        : pseudoWords(rng, [...known], lineWords);
      if (words.length >= 3 && words.length < 6) ws.push(...pickN(rng, words, words.length));
      steps.push({ kind: 'words', label, text: shuffle(rng, ws).slice(0, lineWords).join(' ') });
    }
  };

  switch (lesson.kind) {
    case 'keys': {
      steps.push({ kind: 'drill', label: 'Feel the keys', text: keyPatternLine(rng, lesson.newKeys, anchors, kid ? 3 : 5) });
      steps.push({ kind: 'drill', label: 'Build the path', text: keyPatternLine(rng, lesson.newKeys, [...known].filter((k) => /[a-z]/.test(k)).slice(0, 6), kid ? 4 : 6) });
      addWordLines(1, 'Real words');
      steps.push({ kind: 'check', label: 'Mastery check', text: keyPatternLine(rng, lesson.newKeys, [...known].filter((k) => /[a-z]/.test(k)), kid ? 4 : 7) });
      break;
    }
    case 'capitals': {
      const words = wordsFromPool(known, pool, 10).filter((w) => w.length >= 3);
      const caps = (n: number) => pickN(rng, words, n).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      steps.push({ kind: 'drill', label: 'Shift & tap', text: caps(kid ? 5 : 8) });
      steps.push({ kind: 'drill', label: 'Names & starts', text: caps(kid ? 5 : 8) });
      steps.push({ kind: 'check', label: 'Mastery check', text: pickN(rng, words, kid ? 6 : 9).map((w, i) => (i % 2 === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ') });
      break;
    }
    case 'punct': {
      const s = pickN(rng, sentPool, 3);
      steps.push({ kind: 'drill', label: 'Punctuation shapes', text: lesson.newKeys.map((k) => `${k}${k}${k}`).join(' ') + ' ' + lesson.newKeys.map((k) => `${pick(rng, ['and', 'the', 'sea', 'map'])}${k}`).join(' ') });
      steps.push({ kind: 'words', label: 'In sentences', text: s[0] });
      steps.push({ kind: 'words', label: 'Keep the flow', text: s[1] });
      steps.push({ kind: 'check', label: 'Mastery check', text: s[2] });
      break;
    }
    case 'numbers': {
      const digits = lesson.newKeys.filter((k) => /\d/.test(k));
      const dline = () => Array.from({ length: kid ? 6 : 9 }, () => {
        const len = 1 + Math.floor(rng() * 3);
        let s = '';
        for (let j = 0; j < len; j++) s += pick(rng, digits.length ? digits : DIGITS);
        return s;
      }).join(' ');
      steps.push({ kind: 'drill', label: 'Climb & return', text: dline() });
      steps.push({ kind: 'drill', label: 'Number runs', text: dline() });
      const words = wordsFromPool(known, pool, 8);
      steps.push({ kind: 'check', label: 'Mastery check', text: pickN(rng, words, 6).map((w, i) => (i % 2 ? `${w} ${pick(rng, digits.length ? digits : DIGITS)}${pick(rng, DIGITS)}` : w)).join(' ') });
      break;
    }
    case 'symbols': {
      const syms = lesson.newKeys;
      steps.push({ kind: 'drill', label: 'Symbol shapes', text: syms.map((k) => `${k}${k}${k}`).join(' ') });
      steps.push({ kind: 'drill', label: 'In context', text: syms.map((k) => pick(rng, [`a${k}b`, `${k}top${k}`, `x${k}9`, `go${k}`])).join(' ') });
      steps.push({ kind: 'check', label: 'Mastery check', text: `mail@post.io tag#7 cost$45 rate%9 ${syms.slice(0, 3).join('')} done`.slice(0, 90) });
      break;
    }
    case 'paragraph': {
      const p = pick(rng, PARAGRAPHS);
      const sentencesArr = p.split(/(?<=\.)\s+/);
      const half = Math.ceil(sentencesArr.length / 2);
      steps.push({ kind: 'words', label: 'Part one', text: sentencesArr.slice(0, half).join(' ') });
      steps.push({ kind: 'check', label: 'Part two', text: sentencesArr.slice(half).join(' ') });
      break;
    }
    case 'ladder': {
      const s = pick(rng, sentPool);
      steps.push({ kind: 'drill', label: 'Rung 1 · relaxed', text: s });
      steps.push({ kind: 'drill', label: 'Rung 2 · steady', text: s });
      steps.push({ kind: 'check', label: 'Rung 3 · full stride', text: s });
      break;
    }
    case 'rhythm': {
      const even = pool.filter((w) => w.length >= 3 && w.length <= 6);
      steps.push({ kind: 'drill', label: 'Find the beat', text: pickN(rng, even, kid ? 10 : 16).join(' ') });
      steps.push({ kind: 'words', label: 'Hold the beat', text: pickN(rng, even, kid ? 10 : 16).join(' ') });
      steps.push({ kind: 'check', label: 'On the pulse', text: pickN(rng, even, kid ? 12 : 18).join(' ') });
      break;
    }
    case 'work': {
      if (kid) {
        const s = pickN(rng, KID_SENTENCES, 4);
        steps.push({ kind: 'words', label: 'A little letter', text: s.slice(0, 2).join(' ') });
        steps.push({ kind: 'check', label: 'Sign it off', text: s.slice(2).join(' ') });
      } else {
        const t = pick(rng, WORK_TEXTS);
        const sentencesArr = t.split(/(?<=\.)\s+/);
        const half = Math.ceil(sentencesArr.length / 2);
        steps.push({ kind: 'words', label: 'The inbox', text: sentencesArr.slice(0, half).join(' ') });
        steps.push({ kind: 'check', label: 'Send it', text: sentencesArr.slice(half).join(' ') });
      }
      break;
    }
    case 'blind': {
      const ws = wordsFromPool(known, pool, 8);
      const line = () => (ws.length >= 6 ? pickN(rng, ws, lineWords + 2) : pseudoWords(rng, [...known], lineWords + 2)).join(' ');
      steps.push({ kind: 'drill', label: 'Eyes up', text: line() });
      steps.push({ kind: 'check', label: 'Trust your hands', text: line() });
      break;
    }
    case 'longwalk': {
      const ps = pickN(rng, PARAGRAPHS, 2);
      steps.push({ kind: 'words', label: 'First mile', text: ps[0] });
      steps.push({ kind: 'check', label: 'Second mile', text: ps[1] });
      break;
    }
    case 'recovery': {
      const mix = (n: number) => Array.from({ length: n }, (_, i) => (i % 4 === 2 ? pick(rng, TRICKY_WORDS) : pick(rng, pool))).join(' ');
      steps.push({ kind: 'drill', label: 'Steady through', text: mix(kid ? 10 : 14) });
      steps.push({ kind: 'check', label: 'Calm finish', text: mix(kid ? 12 : 16) });
      break;
    }
    case 'gauntlet': {
      const s = pickN(rng, sentPool, 2);
      const nums = `Order ${1 + Math.floor(rng() * 8)}${Math.floor(rng() * 9)} arrives at ${1 + Math.floor(rng() * 9)}:${['00', '15', '30', '45'][Math.floor(rng() * 4)]}.`;
      steps.push({ kind: 'words', label: 'Prose', text: s[0] });
      steps.push({ kind: 'drill', label: 'Numbers woven in', text: nums + ' ' + (kid ? pick(rng, KID_SENTENCES) : `Invoice #${100 + Math.floor(rng() * 900)} is 100% ready.`) });
      steps.push({ kind: 'check', label: 'The last trial', text: s[1] });
      break;
    }
    case 'check':
    default: {
      if (lesson.stage <= 3) {
        addWordLines(2, 'Crossing');
        const words = wordsFromPool(known, pool, 8);
        const ws = words.length >= 6 ? pickN(rng, words, lineWords + 3) : pseudoWords(rng, [...known], lineWords + 3);
        steps.push({ kind: 'check', label: 'Final crossing', text: ws.join(' ') });
      } else {
        const s = pickN(rng, sentPool, 3);
        steps.push({ kind: 'words', label: 'Crossing', text: s[0] });
        steps.push({ kind: 'words', label: 'Crossing', text: s[1] });
        steps.push({ kind: 'check', label: 'Final crossing', text: s[2] });
      }
      break;
    }
  }
  return { steps, targetWpm, targetAcc };
}

export function starsFor(plan: LessonPlan, wpm: number, acc: number): number {
  if (acc < 85) return 0;
  let stars = 1;
  if (acc >= plan.targetAcc && wpm >= plan.targetWpm * 0.75) stars = 2;
  if (acc >= plan.targetAcc + 2.5 && wpm >= plan.targetWpm) stars = 3;
  return stars;
}

export function stageUnlocked(data: ProfileData, layout: LayoutId, stageId: number): boolean {
  if (data.settings.unlockAll || stageId === 0) return true;
  const stages = buildStages(layout);
  const prev = stages[stageId - 1];
  if (!prev) return true;
  const done = prev.lessons.filter((l) => (data.lessons[l.id]?.stars ?? 0) >= 1).length;
  return done >= Math.ceil(prev.lessons.length * 0.6);
}

// ---------- world-scoped selectors (plan §2) ----------

export function worldLessons(layout: LayoutId, worldId: string): LessonDef[] {
  const world = WORLD_SPINE.find((w) => w.id === worldId);
  if (!world) return [];
  const stages = buildStages(layout);
  return world.stages.flatMap((si) => stages[si]?.lessons ?? []);
}

export function worldOfLesson(lessonId: string, layout: LayoutId): WorldSpine {
  const l = lessonById(layout, lessonId);
  return WORLD_SPINE.find((w) => l && w.stages.includes(l.stage)) ?? WORLD_SPINE[0];
}

export interface WorldProgress { done: number; total: number; stars: number; maxStars: number; complete: boolean }

export function worldProgress(data: ProfileData, worldId: string): WorldProgress {
  const lessons = worldLessons(data.profile.layout, worldId);
  const done = lessons.filter((l) => (data.lessons[l.id]?.stars ?? 0) >= 1).length;
  const stars = lessons.reduce((a, l) => a + Math.min(3, data.lessons[l.id]?.stars ?? 0), 0);
  return { done, total: lessons.length, stars, maxStars: lessons.length * 3, complete: done >= lessons.length && lessons.length > 0 };
}

export function worldUnlocked(data: ProfileData, worldId: string): boolean {
  if (data.settings.unlockAll) return true;
  const idx = WORLD_SPINE.findIndex((w) => w.id === worldId);
  if (idx <= 0) return idx === 0;
  return worldProgress(data, WORLD_SPINE[idx - 1].id).complete;
}

/** The world the learner is currently journeying through: first incomplete unlocked world (last if all done). */
export function activeWorldId(data: ProfileData): string {
  for (const w of WORLD_SPINE) {
    if (!worldUnlocked(data, w.id)) return WORLD_SPINE[Math.max(0, WORLD_SPINE.indexOf(w) - 1)].id;
    if (!worldProgress(data, w.id).complete) return w.id;
  }
  return WORLD_SPINE[WORLD_SPINE.length - 1].id;
}

/** Within a world the road is linear: a stop is open once the one before it is explored. */
export function lessonUnlocked(data: ProfileData, lessonId: string): boolean {
  if (data.settings.unlockAll) return true;
  const layout = data.profile.layout;
  const world = worldOfLesson(lessonId, layout);
  if (!worldUnlocked(data, world.id)) return false;
  const lessons = worldLessons(layout, world.id);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  if (idx <= 0) return true;
  return (data.lessons[lessons[idx - 1].id]?.stars ?? 0) >= 1;
}

export function nextLessonInWorld(data: ProfileData, worldId: string): LessonDef | null {
  return worldLessons(data.profile.layout, worldId).find((l) => (data.lessons[l.id]?.stars ?? 0) === 0) ?? null;
}

export function nextLesson(data: ProfileData): LessonDef | null {
  for (const w of WORLD_SPINE) {
    if (!worldUnlocked(data, w.id)) break;
    const l = nextLessonInWorld(data, w.id);
    if (l) return l;
  }
  // Everything explored: the polish journey, front to back.
  for (const w of WORLD_SPINE) {
    const l = worldLessons(data.profile.layout, w.id).find((x) => (data.lessons[x.id]?.stars ?? 0) < 3);
    if (l) return l;
  }
  return null;
}

/** Graduation (kids): explicit rule decoupled from lesson totals — W2 complete or level 8. */
export function graduationReady(data: ProfileData): boolean {
  return worldProgress(data, 'w2').complete || levelFromXp(data.xp).level >= 8;
}

export function curriculumProgress(data: ProfileData): { done: number; total: number; stars: number; maxStars: number } {
  const lessons = allLessons(data.profile.layout);
  const done = lessons.filter((l) => (data.lessons[l.id]?.stars ?? 0) >= 1).length;
  const stars = lessons.reduce((a, l) => a + (data.lessons[l.id]?.stars ?? 0), 0);
  return { done, total: lessons.length, stars, maxStars: lessons.length * 3 };
}
