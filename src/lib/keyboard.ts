import type { LayoutId } from './types';

// Physical geometry (row, col, width in units). Labels are resolved per layout.
export interface KeyDef {
  code: string;       // stable id: physical position id
  row: number;
  w: number;          // width units (1 = standard key)
  finger: number;     // 0..7 = LP LR LM LI RI RM RR RP, 8 = thumb
  label?: string;     // fixed label for non-character keys
}

export const FINGER_NAMES = [
  'left pinky', 'left ring', 'left middle', 'left index',
  'right index', 'right middle', 'right ring', 'right pinky', 'thumb',
];
export const FINGER_SHORT = ['L5', 'L4', 'L3', 'L2', 'R2', 'R3', 'R4', 'R5', 'T'];

// Letter placement per layout: 3 rows of character positions.
const LETTER_ROWS: Record<LayoutId, [string, string, string]> = {
  qwerty:  ['qwertyuiop[]', "asdfghjkl;'", 'zxcvbnm,./'],
  qwertz:  ['qwertzuiop[]', "asdfghjkl;'", 'yxcvbnm,./'],
  azerty:  ['azertyuiop[]', "qsdfghjklm'", 'wxcvbn,;:/'],
  dvorak:  ["',.pyfgcrl[]", 'aoeuidhtns-', ';qjkxbmwvz'],
  colemak: ['qwfpgjluy;[]', "arstdhneio'", 'zxcvbkm,./'],
};

const NUM_ROW = '`1234567890-=';
const NUM_SHIFT = '~!@#$%^&*()_+';
const SHIFT_PAIRS: Record<string, string> = {
  '[': '{', ']': '}', ';': ':', "'": '"', ',': '<', '.': '>', '/': '?', '\\': '|', '-': '_', '=': '+',
};

export interface KeyInfo {
  code: string;
  row: number;
  w: number;
  finger: number;
  base: string;       // unshifted char ('' for control keys)
  shifted: string;    // shifted char
  label: string;      // display label
  control: boolean;
}

function fingerForCol(col: number, rowLen: number): number {
  // standard column assignment for a 10..13 key character row
  if (col <= 0) return 0;
  if (col === 1) return 1;
  if (col === 2) return 2;
  if (col === 3 || col === 4) return 3;
  if (col === 5 || col === 6) return 4;
  if (col === 7) return 5;
  if (col === 8) return 6;
  return 7;
}

export function buildLayout(layout: LayoutId): KeyInfo[] {
  const rows = LETTER_ROWS[layout];
  const keys: KeyInfo[] = [];
  // Row 0: number row
  for (let i = 0; i < NUM_ROW.length; i++) {
    keys.push({
      code: `n${i}`, row: 0, w: 1, finger: fingerForCol(i - 1, 13),
      base: NUM_ROW[i], shifted: NUM_SHIFT[i], label: NUM_ROW[i], control: false,
    });
  }
  keys.push({ code: 'backspace', row: 0, w: 2, finger: 7, base: '', shifted: '', label: '⌫', control: true });
  // Row 1
  keys.push({ code: 'tab', row: 1, w: 1.5, finger: 0, base: '\t', shifted: '\t', label: 'Tab', control: true });
  for (let i = 0; i < rows[0].length; i++) {
    const c = rows[0][i];
    keys.push({
      code: `r1-${i}`, row: 1, w: 1, finger: fingerForCol(i, 12),
      base: c, shifted: SHIFT_PAIRS[c] ?? c.toUpperCase(), label: c.toUpperCase(), control: false,
    });
  }
  keys.push({ code: 'bslash', row: 1, w: 1.5, finger: 7, base: '\\', shifted: '|', label: '\\', control: false });
  // Row 2 (home)
  keys.push({ code: 'caps', row: 2, w: 1.9, finger: 0, base: '', shifted: '', label: 'Caps', control: true });
  for (let i = 0; i < rows[1].length; i++) {
    const c = rows[1][i];
    keys.push({
      code: `r2-${i}`, row: 2, w: 1, finger: fingerForCol(i, 11),
      base: c, shifted: SHIFT_PAIRS[c] ?? c.toUpperCase(), label: c.toUpperCase(), control: false,
    });
  }
  keys.push({ code: 'enter', row: 2, w: 2.1, finger: 7, base: '\n', shifted: '\n', label: 'Enter ⏎', control: true });
  // Row 3
  keys.push({ code: 'shiftl', row: 3, w: 2.45, finger: 0, base: '', shifted: '', label: 'Shift', control: true });
  for (let i = 0; i < rows[2].length; i++) {
    const c = rows[2][i];
    keys.push({
      code: `r3-${i}`, row: 3, w: 1, finger: fingerForCol(i, 10),
      base: c, shifted: SHIFT_PAIRS[c] ?? c.toUpperCase(), label: c.toUpperCase(), control: false,
    });
  }
  keys.push({ code: 'shiftr', row: 3, w: 2.45, finger: 7, base: '', shifted: '', label: 'Shift', control: true });
  // Row 4
  keys.push({ code: 'space', row: 4, w: 9, finger: 8, base: ' ', shifted: ' ', label: '', control: false });
  return keys;
}

export interface CharLookup {
  key: KeyInfo | null;
  shift: boolean;
  finger: number;
  hand: 'left' | 'right' | 'thumb';
}

export function makeCharLookup(layout: LayoutId): (ch: string) => CharLookup {
  const keys = buildLayout(layout);
  const map = new Map<string, { key: KeyInfo; shift: boolean }>();
  for (const k of keys) {
    if (k.control && k.code !== 'enter' && k.code !== 'tab') continue;
    if (k.base && !map.has(k.base)) map.set(k.base, { key: k, shift: false });
    if (k.shifted && k.shifted !== k.base && !map.has(k.shifted)) map.set(k.shifted, { key: k, shift: true });
  }
  return (ch: string): CharLookup => {
    const hit = map.get(ch);
    if (!hit) return { key: null, shift: false, finger: -1, hand: 'left' };
    const f = hit.key.finger;
    return {
      key: hit.key,
      shift: hit.shift,
      finger: f,
      hand: f === 8 ? 'thumb' : f <= 3 ? 'left' : 'right',
    };
  };
}

// Curriculum key groups resolved per layout (row positions -> actual chars).
export interface LayoutGroups {
  homeCore: string[];   // 8 home keys
  homeAll: string[];    // home row incl. inner reaches (g h on qwerty)
  top: string[];
  bottom: string[];
  vowelsEarly: string[]; // e + one more vowel introduced early for real words
}

export function layoutGroups(layout: LayoutId): LayoutGroups {
  const rows = LETTER_ROWS[layout];
  const home = rows[1].split('').filter((c) => /[a-z]/.test(c));
  const top = rows[0].split('').filter((c) => /[a-z]/.test(c));
  const bottom = rows[2].split('').filter((c) => /[a-z]/.test(c));
  const homeCore = [...home.slice(0, 4), ...home.slice(-4)];
  const early = ['e', 'i', 'o', 'a', 'u'].filter((v) => top.includes(v) || bottom.includes(v)).slice(0, 2);
  return { homeCore, homeAll: home, top, bottom, vowelsEarly: early };
}

export const PUNCT_BASIC = [',', '.', '?', '!', "'", '-'];
export const PUNCT_FULL = [';', ':', '"', '(', ')'];
export const SYMBOLS = ['@', '#', '$', '%', '&', '*', '_', '+', '=', '/', '<', '>', '[', ']', '{', '}', '\\', '|', '^', '~'];
export const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export function displayChar(ch: string): string {
  if (ch === ' ') return '␣';
  if (ch === '\n') return '⏎';
  if (ch === '\t') return '⇥';
  return ch;
}

export const LAYOUT_NAMES: Record<LayoutId, string> = {
  qwerty: 'QWERTY (US / UK)',
  qwertz: 'QWERTZ (DE / CH)',
  azerty: 'AZERTY (FR / BE)',
  dvorak: 'Dvorak',
  colemak: 'Colemak',
};
