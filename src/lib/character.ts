/**
 * KeyTopia explorers — a layered pixel character.
 *
 * A character is a set of part ids plus three palette picks. Every part is a
 * pure function that appends pixels to a 16×16 grid, so the same character
 * renders at 20px in a leaderboard row and 220px in the builder.
 *
 * Layer order (later paints over earlier):
 *   aura → body/outfit → neck → head silhouette → kind features (ears, snouts)
 *   → face marks → eyes → mouth → hair/crest → gear → sparkle overlays
 *
 * Stored on the profile as "ch1:k=human,h=spiky,s=2,...". Defaults are omitted
 * from the string, so a plain explorer is only a few characters long.
 */

export type Px = [x: number, y: number, c: string];

export const GRID = 16;

export type Expression = 'happy' | 'focused' | 'excited' | 'chill' | 'oops';
export type Collection = 'explorers' | 'creatures' | 'legends';
/** Which hair/crest family a kind wears. */
export type Crown = 'human' | 'beast';

export interface Character {
  kind: string;
  face: string;
  hair: string;
  eyes: string;
  mouth: string;
  gear: string;
  outfit: string;
  aura: string;
  skin: number;
  hairColor: number;
  outfitColor: number;
}

export const DEFAULT_CHARACTER: Character = {
  kind: 'human', face: 'round', hair: 'short', eyes: 'bright', mouth: 'smile',
  gear: 'none', outfit: 'tee', aura: 'none',
  skin: 0, hairColor: 0, outfitColor: 0,
};

// ---------------------------------------------------------------- palettes

export interface Swatch { id: string; name: string; c: string; s: string; level: number }

const SW = (id: string, name: string, c: string, s: string, level = 0): Swatch => ({ id, name, c, s, level });

export const SKINS: Swatch[] = [
  SW('porcelain', 'Porcelain', '#f7d6b4', '#e0b68f'),
  SW('sand', 'Sand', '#f0c49a', '#d3a175'),
  SW('honey', 'Honey', '#dda579', '#bd8656'),
  SW('amber', 'Amber', '#c07f4f', '#9e6339'),
  SW('cocoa', 'Cocoa', '#9c5f37', '#7a4526'),
  SW('ebony', 'Ebony', '#6f3f22', '#522c16'),
  SW('steel', 'Steel', '#c2cad9', '#98a2b5', 3),
  SW('frost', 'Frost', '#a8dcff', '#7db4e0', 5),
  SW('meadow', 'Meadow', '#9fd8a8', '#75b283', 7),
  SW('twilight', 'Twilight', '#d6b0ff', '#ad86dc', 10),
  SW('blossom', 'Blossom', '#ffc4d4', '#e59db1', 13),
  SW('ember', 'Ember', '#ffcd85', '#e0a557', 17),
  SW('snow', 'Snow', '#f2f3f7', '#cdd2dc'),
];

/** Index of the white coat the panda wears by default. */
export const SNOW_SKIN = SKINS.length - 1;

export const HAIR_COLORS: Swatch[] = [
  SW('ink', 'Ink', '#1a1614', '#0d0b0a'),
  SW('espresso', 'Espresso', '#3b2a1e', '#261a12'),
  SW('chestnut', 'Chestnut', '#6b432a', '#4d2e1c'),
  SW('caramel', 'Caramel', '#a06a38', '#7a4f28'),
  SW('wheat', 'Wheat', '#d8a95c', '#b5883f'),
  SW('ginger', 'Ginger', '#c96b2f', '#a1501e'),
  SW('crimson', 'Crimson', '#a8322c', '#7e211d', 2),
  SW('silver', 'Silver', '#c9cdd6', '#a2a7b3', 4),
  SW('teal', 'Teal', '#2fb8a8', '#1f8d80', 6),
  SW('cobalt', 'Cobalt', '#3a72c9', '#2a539c', 8),
  SW('violet', 'Violet', '#8a54c9', '#68389c', 10),
  SW('rose', 'Rose', '#e07ba0', '#b85a7c', 12),
  SW('mint', 'Mint', '#6fd8a8', '#4bb083', 15),
  SW('gold', 'Gold', '#e8bb3a', '#bc9420', 18),
];

export const OUTFIT_COLORS: Swatch[] = [
  SW('reef', 'Reef', '#19c6b0', '#0f9384'),
  SW('navy', 'Navy', '#2b4a86', '#1c3260'),
  SW('charcoal', 'Charcoal', '#31363f', '#20242b'),
  SW('forest', 'Forest', '#2f7a4d', '#1f5636'),
  SW('crimson', 'Crimson', '#b0362f', '#83231d'),
  SW('amber', 'Amber', '#dc9430', '#b0711c'),
  SW('sky', 'Sky', '#4b9bdc', '#3475ad'),
  SW('plum', 'Plum', '#7a3f8c', '#592a68', 3),
  SW('rose', 'Rose', '#dc7699', '#b25574', 5),
  SW('mint', 'Mint', '#5fc98f', '#3f9c6a', 7),
  SW('violet', 'Violet', '#7b5fd8', '#5a41ab', 9),
  SW('slate', 'Slate', '#5d6b80', '#414c5c', 11),
  SW('gold', 'Gold', '#d9b23a', '#ac8a20', 14),
  SW('void', 'Void', '#1c1b26', '#0e0d14', 16),
];

const INK = '#221c26';
const WHITE = '#ffffff';

// ---------------------------------------------------------------- geometry

interface Ctx {
  out: Px[];
  skin: string; skinS: string;
  hair: string; hairS: string;
  fit: string; fitS: string;
  face: FaceShape;
  kind: KindDef;
  expr: Expression;
}

const P = (o: Px[], x: number, y: number, c: string) => {
  if (x >= 0 && x < GRID && y >= 0 && y < GRID) o.push([x, y, c]);
};
const row = (o: Px[], y: number, x0: number, x1: number, c: string) => {
  for (let x = x0; x <= x1; x++) P(o, x, y, c);
};
const box = (o: Px[], x0: number, y0: number, x1: number, y1: number, c: string) => {
  for (let y = y0; y <= y1; y++) row(o, y, x0, x1, c);
};
/** Paint a pixel and its mirror across the face centre line (x = 7.5). */
const sym = (o: Px[], x: number, y: number, c: string) => { P(o, x, y, c); P(o, 15 - x, y, c); };

interface FaceShape { id: string; name: string; level: number; y0: number; y1: number; inset: number[] }

const FACE = (id: string, name: string, level: number, y0: number, y1: number, inset: number[]): FaceShape =>
  ({ id, name, level, y0, y1, inset });

/** Head silhouettes. `inset` narrows each row from the base span x3..x12. */
export const FACES: FaceShape[] = [
  FACE('round', 'Round', 0, 2, 10, [1, 0, 0, 0, 0, 0, 0, 0, 1]),
  FACE('square', 'Square', 0, 2, 10, [0, 0, 0, 0, 0, 0, 0, 0, 0]),
  FACE('oval', 'Oval', 0, 2, 10, [2, 1, 0, 0, 0, 0, 0, 1, 2]),
  FACE('wide', 'Wide', 0, 3, 10, [0, -1, -1, -1, -1, -1, 0, 1]),
  FACE('angular', 'Angular', 2, 2, 10, [1, 0, 0, 0, 0, 0, 1, 2, 3]),
  FACE('tall', 'Tall', 3, 1, 10, [2, 1, 1, 1, 1, 1, 1, 1, 1, 2]),
  FACE('heart', 'Heart', 6, 2, 10, [1, 0, 0, 0, 0, 1, 1, 2, 3]),
  FACE('chunky', 'Chunky', 9, 2, 10, [1, 0, -1, -1, -1, -1, 0, 0, 1]),
];

const faceSpan = (f: FaceShape, y: number): [number, number] | null => {
  if (y < f.y0 || y > f.y1) return null;
  const i = f.inset[y - f.y0] ?? 0;
  return [3 + i, 12 - i];
};

function headShape(ctx: Ctx) {
  const { out, face } = ctx;
  for (let y = face.y0; y <= face.y1; y++) {
    const sp = faceSpan(face, y);
    if (!sp) continue;
    row(out, y, sp[0], sp[1], ctx.skin);
    P(out, sp[1], y, ctx.skinS); // right edge catches the shade
  }
  const bot = faceSpan(face, face.y1);
  if (bot) row(out, face.y1, bot[0], bot[1], ctx.skinS);
}

// ---------------------------------------------------------------- kinds

export interface KindDef {
  id: string;
  name: string;
  blurb: string;
  collection: Collection;
  crown: Crown;
  level: number;
  /** Suggested parts applied when you switch to this kind. */
  suggests?: Partial<Character>;
  /** Painted before the head, for ears and wings that sit behind. */
  back?: (c: Ctx) => void;
  /** Painted after the head but under the eyes, for snouts and patches. */
  front?: (c: Ctx) => void;
}

const K = (d: KindDef): KindDef => d;

/** Two upright ears, drawn above the head. */
function earsUp(c: Ctx, fill: string, inner: string) {
  sym(c.out, 4, 0, fill); sym(c.out, 4, 1, fill); sym(c.out, 5, 1, fill);
  sym(c.out, 4, 2, inner);
}

export const KINDS: KindDef[] = [
  K({
    id: 'human', name: 'Explorer', blurb: 'The everyday heroes of KeyTopia.',
    collection: 'explorers', crown: 'human', level: 0,
    front(c) {
      // ears, unless the face already fills the full width
      if (c.face.id !== 'wide' && c.face.id !== 'chunky') {
        sym(c.out, 2, 6, c.skin); sym(c.out, 2, 7, c.skinS);
      }
    },
  }),
  K({
    id: 'cat', name: 'Cat', blurb: 'Silent paws, very loud opinions.',
    collection: 'creatures', crown: 'beast', level: 0,
    suggests: { mouth: 'whiskers', eyes: 'bright', skin: 6, hairColor: 7 },
    back(c) { earsUp(c, c.hair, '#f0b7c9'); },
    front(c) {
      box(c.out, 6, 8, 9, 9, '#f6ece4');
      P(c.out, 7, 8, '#3a2a20'); P(c.out, 8, 8, '#3a2a20');
      sym(c.out, 3, 7, c.hairS); sym(c.out, 3, 4, c.hairS);
    },
  }),
  K({
    id: 'fox', name: 'Fox', blurb: 'Quick, clever, always a step ahead.',
    collection: 'creatures', crown: 'beast', level: 0,
    suggests: { mouth: 'whiskers', hairColor: 5 },
    back(c) { earsUp(c, c.hair, INK); },
    front(c) {
      box(c.out, 6, 8, 9, 9, '#ffeedd');
      P(c.out, 7, 8, '#3a2a20'); P(c.out, 8, 8, '#3a2a20');
      sym(c.out, 3, 7, '#ffeedd'); sym(c.out, 4, 3, c.hairS); sym(c.out, 3, 4, c.hairS);
    },
  }),
  K({
    id: 'frog', name: 'Frog', blurb: 'Leaps before it looks. Lands anyway.',
    collection: 'creatures', crown: 'beast', level: 0,
    suggests: { eyes: 'bulge', mouth: 'wide', skin: 8 },
    back(c) {
      sym(c.out, 4, 1, c.skin); sym(c.out, 5, 1, c.skin);
      sym(c.out, 4, 2, c.skin); sym(c.out, 5, 2, c.skin);
    },
    front(c) { sym(c.out, 4, 4, c.skinS); },
  }),
  K({
    id: 'panda', name: 'Panda', blurb: 'Calm hands, unbeatable focus.',
    collection: 'creatures', crown: 'beast', level: 0,
    suggests: { skin: SNOW_SKIN, hairColor: 0, mouth: 'small' },
    back(c) {
      sym(c.out, 3, 1, c.hair); sym(c.out, 4, 1, c.hair);
      sym(c.out, 3, 2, c.hair); sym(c.out, 4, 2, c.hair);
    },
    front(c) {
      // eye patches sit under the eyes so pupils still read
      box(c.out, 4, 4, 6, 7, c.hair);
      box(c.out, 9, 4, 11, 7, c.hair);
      sym(c.out, 7, 8, INK);
    },
  }),
  K({
    id: 'owl', name: 'Owl', blurb: 'Sees every typo coming.',
    collection: 'creatures', crown: 'beast', level: 0,
    suggests: { eyes: 'huge', mouth: 'beak', skin: 2, hairColor: 2 },
    back(c) {
      sym(c.out, 3, 0, c.hair); sym(c.out, 4, 0, c.hair); sym(c.out, 3, 1, c.hair);
    },
    front(c) {
      sym(c.out, 4, 9, c.hairS); P(c.out, 7, 10, c.hairS); P(c.out, 8, 10, c.hairS);
    },
  }),
  K({
    id: 'bunny', name: 'Bunny', blurb: 'Small hops, big word counts.',
    collection: 'creatures', crown: 'beast', level: 2,
    suggests: { mouth: 'buck', skin: 0, hairColor: 4 },
    back(c) {
      for (let y = 0; y <= 2; y++) { sym(c.out, 4, y, c.hair); sym(c.out, 5, y, c.hair); }
      sym(c.out, 5, 1, '#f0b7c9'); sym(c.out, 5, 2, '#f0b7c9');
    },
  }),
  K({
    id: 'dragon', name: 'Dragon', blurb: 'Breathes fire between sentences.',
    collection: 'creatures', crown: 'beast', level: 6,
    suggests: { hair: 'horns', mouth: 'fangs', skin: 8, outfit: 'wings' },
    back(c) {
      sym(c.out, 3, 1, c.hairS); sym(c.out, 2, 2, c.hairS);
    },
    front(c) {
      box(c.out, 6, 8, 9, 9, c.skinS);
      P(c.out, 7, 8, INK); P(c.out, 8, 8, INK);
      sym(c.out, 3, 4, c.hairS); sym(c.out, 4, 3, c.hairS);
    },
  }),
  K({
    id: 'axolotl', name: 'Axolotl', blurb: 'Grows back everything but bad habits.',
    collection: 'creatures', crown: 'beast', level: 8,
    suggests: { skin: 10, hairColor: 11, mouth: 'small' },
    back(c) {
      for (const y of [4, 6]) {
        sym(c.out, 1, y, c.hair); sym(c.out, 2, y - 1, c.hair); sym(c.out, 2, y + 1, c.hair);
      }
    },
    front(c) { sym(c.out, 4, 8, '#ff9ec0'); },
  }),
  K({
    id: 'slime', name: 'Slime', blurb: 'Wobbles. Persists. Wins.',
    collection: 'creatures', crown: 'beast', level: 10,
    suggests: { hair: 'none', skin: 8, mouth: 'wide' },
    front(c) {
      P(c.out, 5, 3, WHITE); P(c.out, 6, 3, WHITE); P(c.out, 5, 4, WHITE);
      row(c.out, 10, 4, 11, c.skin);
    },
  }),
  K({
    id: 'wolf', name: 'Wolf', blurb: 'Runs the long sessions with the pack.',
    collection: 'creatures', crown: 'beast', level: 12,
    suggests: { mouth: 'fangs', hairColor: 7 },
    back(c) {
      sym(c.out, 3, 0, c.hair); sym(c.out, 4, 0, c.hair);
      sym(c.out, 3, 1, c.hair); sym(c.out, 4, 1, c.hair); sym(c.out, 4, 2, c.hairS);
    },
    front(c) {
      box(c.out, 6, 8, 9, 9, '#efe6dc');
      P(c.out, 7, 8, INK); P(c.out, 8, 8, INK);
      row(c.out, 3, 5, 10, c.hairS);
    },
  }),
  K({
    id: 'robot', name: 'Robot', blurb: 'Always ready. Never rests.',
    collection: 'legends', crown: 'beast', level: 5,
    suggests: { face: 'square', hair: 'antenna', eyes: 'led', mouth: 'grid', skin: 6, outfit: 'plating' },
    front(c) {
      sym(c.out, 2, 5, c.hairS); sym(c.out, 2, 6, c.hairS);
      row(c.out, 3, 5, 10, c.skinS);
      P(c.out, 11, 9, c.hairS);
    },
  }),
  K({
    id: 'knight', name: 'Knight', blurb: 'Holds the line, letter by letter.',
    collection: 'legends', crown: 'beast', level: 9,
    suggests: { face: 'square', hair: 'plume', gear: 'helm', outfit: 'armour', eyes: 'determined', skin: 6 },
    front(c) { row(c.out, 10, 5, 10, c.skinS); },
  }),
  K({
    id: 'wizard', name: 'Wizard', blurb: 'Casts sixty words per minute.',
    collection: 'legends', crown: 'human', level: 11,
    suggests: { gear: 'wizardhat', outfit: 'robe', hair: 'beard', eyes: 'wise' },
    front(c) { sym(c.out, 4, 5, c.skinS); },
  }),
  K({
    id: 'astronaut', name: 'Astronaut', blurb: 'Typed the first word in orbit.',
    collection: 'legends', crown: 'human', level: 14,
    suggests: { gear: 'dome', outfit: 'suit', aura: 'stars' },
  }),
  K({
    id: 'ninja', name: 'Ninja', blurb: 'You never hear the keystrokes.',
    collection: 'legends', crown: 'human', level: 16,
    suggests: { gear: 'mask', outfit: 'gi', eyes: 'determined', mouth: 'none' },
  }),
  K({
    id: 'phoenix', name: 'Phoenix', blurb: 'Every reset makes it faster.',
    collection: 'legends', crown: 'beast', level: 20,
    suggests: { hair: 'flame', mouth: 'beak', skin: 11, aura: 'embers', outfit: 'wings', outfitColor: 5 },
    front(c) { sym(c.out, 4, 4, '#ffb347'); },
  }),
];

export const KIND_BY_ID = new Map(KINDS.map((k) => [k.id, k]));

export const COLLECTIONS: { id: Collection; name: string; blurb: string }[] = [
  { id: 'explorers', name: 'Explorers', blurb: 'The everyday heroes of KeyTopia.' },
  { id: 'creatures', name: 'Creatures', blurb: 'Unique beings from far and wide.' },
  { id: 'legends', name: 'Legends', blurb: 'Special explorers for true legends.' },
];

// ---------------------------------------------------------------- parts

export interface PartDef {
  id: string;
  name: string;
  level: number;
  /** Restrict to one crown family; omitted means it fits everyone. */
  crown?: Crown;
  /** Restrict to specific kinds. */
  kinds?: string[];
  draw: (c: Ctx) => void;
}

const PART = (id: string, name: string, level: number, draw: PartDef['draw'], extra: Partial<PartDef> = {}): PartDef =>
  ({ id, name, level, draw, ...extra });

// ---- hair (human) and crests (beast)

/** Fill the top rows of the head silhouette with hair. */
function cap(c: Ctx, rows: number, colour = c.hair) {
  for (let i = 0; i < rows; i++) {
    const y = c.face.y0 + i;
    const sp = faceSpan(c.face, y);
    if (sp) row(c.out, y, sp[0], sp[1], colour);
  }
}
function sides(c: Ctx, y0: number, y1: number, colour = c.hairS) {
  for (let y = y0; y <= y1; y++) {
    const sp = faceSpan(c.face, y);
    if (sp) { P(c.out, sp[0], y, colour); P(c.out, sp[1], y, colour); }
  }
}

export const HAIRS: PartDef[] = [
  PART('none', 'Bald', 0, () => {}),
  PART('short', 'Short', 0, (c) => { cap(c, 2); sides(c, c.face.y0 + 2, c.face.y0 + 2); }, { crown: 'human' }),
  PART('flat', 'Flat top', 0, (c) => { cap(c, 2); const y = c.face.y0 + 2; const sp = faceSpan(c.face, y); if (sp) { P(c.out, sp[0], y, c.hair); P(c.out, sp[1], y, c.hair); } }, { crown: 'human' }),
  PART('spiky', 'Spiky', 0, (c) => {
    cap(c, 2);
    for (let x = 4; x <= 11; x += 2) P(c.out, x, c.face.y0 - 1, c.hair);
  }, { crown: 'human' }),
  PART('side', 'Side part', 0, (c) => {
    cap(c, 2);
    const y = c.face.y0 + 2; const sp = faceSpan(c.face, y);
    if (sp) row(c.out, y, sp[0], sp[0] + 3, c.hair);
  }, { crown: 'human' }),
  PART('curls', 'Curls', 0, (c) => {
    cap(c, 2);
    for (let x = 3; x <= 12; x += 2) P(c.out, x, c.face.y0 - 1, c.hair);
    sides(c, c.face.y0 + 2, c.face.y0 + 3, c.hair);
  }, { crown: 'human' }),
  PART('long', 'Long', 1, (c) => {
    cap(c, 2);
    for (let y = c.face.y0 + 2; y <= 9; y++) {
      const sp = faceSpan(c.face, y);
      if (sp) { P(c.out, sp[0], y, c.hair); P(c.out, sp[0] - 1, y, c.hairS); P(c.out, sp[1], y, c.hair); P(c.out, sp[1] + 1, y, c.hairS); }
    }
  }, { crown: 'human' }),
  PART('ponytail', 'Ponytail', 2, (c) => {
    cap(c, 2); sides(c, c.face.y0 + 2, c.face.y0 + 2);
    for (let y = 3; y <= 7; y++) P(c.out, 13, y, c.hair);
    P(c.out, 14, 4, c.hairS); P(c.out, 14, 6, c.hairS);
  }, { crown: 'human' }),
  PART('buns', 'Space buns', 3, (c) => {
    cap(c, 2);
    sym(c.out, 3, 0, c.hair); sym(c.out, 4, 0, c.hair); sym(c.out, 3, 1, c.hair); sym(c.out, 4, 1, c.hairS);
  }, { crown: 'human' }),
  PART('braids', 'Braids', 4, (c) => {
    cap(c, 2);
    for (let y = c.face.y0 + 2; y <= 10; y++) sym(c.out, 2, y, y % 2 ? c.hair : c.hairS);
  }, { crown: 'human' }),
  PART('afro', 'Afro', 5, (c) => {
    cap(c, 2);
    box(c.out, 3, c.face.y0 - 2, 12, c.face.y0 - 1, c.hair);
    sym(c.out, 2, c.face.y0 - 1, c.hair); sym(c.out, 2, c.face.y0, c.hair);
    sides(c, c.face.y0 + 1, c.face.y0 + 2, c.hair);
  }, { crown: 'human' }),
  PART('bob', 'Bob', 6, (c) => {
    cap(c, 2);
    for (let y = c.face.y0 + 2; y <= 7; y++) {
      const sp = faceSpan(c.face, y);
      if (sp) { P(c.out, sp[0], y, c.hair); P(c.out, sp[1], y, c.hair); }
    }
    row(c.out, 8, 3, 4, c.hairS); row(c.out, 8, 11, 12, c.hairS);
  }, { crown: 'human' }),
  PART('mohawk', 'Mohawk', 8, (c) => {
    box(c.out, 6, c.face.y0 - 2, 9, c.face.y0 + 1, c.hair);
    row(c.out, c.face.y0 - 2, 7, 8, c.hairS);
  }, { crown: 'human' }),
  PART('topknot', 'Topknot', 10, (c) => {
    cap(c, 2); sides(c, c.face.y0 + 2, c.face.y0 + 2);
    row(c.out, c.face.y0 - 1, 7, 8, c.hair);
    row(c.out, c.face.y0 - 2, 6, 9, c.hair);
  }, { crown: 'human' }),
  PART('beard', 'Beard', 11, (c) => {
    cap(c, 2); sides(c, c.face.y0 + 2, c.face.y0 + 2);
    for (let y = 7; y <= 10; y++) {
      const sp = faceSpan(c.face, y);
      if (sp) row(c.out, y, sp[0], sp[1], y === 7 ? c.hairS : c.hair);
    }
    row(c.out, 11, 6, 9, c.hair);
    box(c.out, 6, 8, 9, 9, c.hair);
  }, { crown: 'human' }),
  PART('halo-hair', 'Starlight', 15, (c) => {
    cap(c, 2);
    for (let x = 3; x <= 12; x += 3) P(c.out, x, c.face.y0 - 1, c.hair);
    sym(c.out, 2, c.face.y0, '#ffe9a8'); sym(c.out, 5, c.face.y0 - 2, '#ffe9a8');
  }, { crown: 'human' }),
  // ---- beast crests
  PART('tuft', 'Tuft', 0, (c) => { row(c.out, c.face.y0, 6, 9, c.hairS); P(c.out, 7, c.face.y0 - 1, c.hairS); }, { crown: 'beast' }),
  PART('mane', 'Mane', 2, (c) => {
    cap(c, 1, c.hairS);
    sides(c, c.face.y0, 9, c.hairS);
    sym(c.out, 2, 5, c.hairS); sym(c.out, 2, 7, c.hairS);
  }, { crown: 'beast' }),
  PART('spikes', 'Spikes', 4, (c) => {
    for (let x = 5; x <= 10; x += 2) { P(c.out, x, c.face.y0 - 1, c.hairS); P(c.out, x, c.face.y0, c.hairS); }
  }, { crown: 'beast' }),
  PART('horns', 'Horns', 6, (c) => {
    sym(c.out, 4, c.face.y0 - 1, '#e8dcc0'); sym(c.out, 4, c.face.y0 - 2, '#e8dcc0'); sym(c.out, 3, c.face.y0 - 2, '#cbbf9e');
  }, { crown: 'beast' }),
  PART('fin', 'Fin', 8, (c) => {
    for (let y = c.face.y0 - 2; y <= c.face.y0; y++) row(c.out, y, 7, 8, c.hairS);
    P(c.out, 6, c.face.y0, c.hairS); P(c.out, 9, c.face.y0, c.hairS);
  }, { crown: 'beast' }),
  PART('antenna', 'Antenna', 5, (c) => {
    P(c.out, 7, c.face.y0 - 1, c.hairS); P(c.out, 7, c.face.y0 - 2, c.hairS);
    P(c.out, 8, c.face.y0 - 3, '#ff6b6b'); P(c.out, 7, c.face.y0 - 3, '#ff6b6b');
  }, { crown: 'beast' }),
  PART('plume', 'Plume', 9, (c) => {
    for (let y = c.face.y0 - 3; y <= c.face.y0 - 1; y++) row(c.out, y, 7, 8, '#c9403a');
    P(c.out, 9, c.face.y0 - 3, '#9c2b26'); P(c.out, 6, c.face.y0 - 2, '#9c2b26');
  }, { crown: 'beast' }),
  PART('flame', 'Flame', 20, (c) => {
    row(c.out, c.face.y0 - 1, 5, 10, '#ff8c2e');
    row(c.out, c.face.y0 - 2, 6, 9, '#ffc247');
    row(c.out, c.face.y0 - 3, 7, 8, '#fff0a8');
    cap(c, 1, '#e0621e');
  }, { crown: 'beast' }),
];

// ---- eyes. Drawn in a 2×2 box per side: left x5-6, right x9-10, rows 5-6.

const EYE_L = 5, EYE_R = 9, EYE_Y = 5;

/** Standard eye: white sclera with a pupil, then bent by the expression. */
function plainEye(c: Ctx, whiteRows: number, pupil: string) {
  const { out, expr } = c;
  const draw = (x0: number, inner: number) => {
    if (expr === 'oops') {
      // squeezed shut: a single dark arc
      P(out, x0, EYE_Y + 1, INK); P(out, x0 + 1, EYE_Y, INK);
      return;
    }
    const top = expr === 'focused' || expr === 'chill' ? EYE_Y + 1 : EYE_Y;
    for (let y = top; y < EYE_Y + whiteRows; y++) { P(out, x0, y, WHITE); P(out, x0 + 1, y, WHITE); }
    if (expr === 'focused') { P(out, x0, EYE_Y, c.hairS); P(out, x0 + 1, EYE_Y, c.hairS); }
    if (expr === 'chill') { P(out, x0, EYE_Y, c.skinS); P(out, x0 + 1, EYE_Y, c.skinS); }
    P(out, inner, EYE_Y + whiteRows - 1, pupil);
    if (expr === 'excited') { P(out, x0 + (inner === x0 ? 1 : 0), EYE_Y, WHITE); P(out, inner, EYE_Y, pupil); }
  };
  draw(EYE_L, EYE_L + 1);
  draw(EYE_R, EYE_R);
}

export const EYES: PartDef[] = [
  PART('bright', 'Bright', 0, (c) => plainEye(c, 2, INK)),
  PART('dot', 'Dot', 0, (c) => {
    if (c.expr === 'oops') { P(c.out, EYE_L + 1, EYE_Y, INK); P(c.out, EYE_R, EYE_Y, INK); return; }
    P(c.out, EYE_L + 1, EYE_Y + 1, INK); P(c.out, EYE_R, EYE_Y + 1, INK);
    if (c.expr === 'excited') { P(c.out, EYE_L + 1, EYE_Y, INK); P(c.out, EYE_R, EYE_Y, INK); }
  }),
  PART('wide', 'Wide', 0, (c) => plainEye(c, 2, '#2b4a86')),
  PART('sleepy', 'Sleepy', 0, (c) => {
    row(c.out, EYE_Y + 1, EYE_L, EYE_L + 1, INK);
    row(c.out, EYE_Y + 1, EYE_R, EYE_R + 1, INK);
  }),
  PART('happyarc', 'Happy arcs', 1, (c) => {
    P(c.out, EYE_L, EYE_Y + 1, INK); P(c.out, EYE_L + 1, EYE_Y, INK);
    P(c.out, EYE_R + 1, EYE_Y + 1, INK); P(c.out, EYE_R, EYE_Y, INK);
  }),
  PART('determined', 'Determined', 3, (c) => {
    plainEye(c, 2, INK);
    P(c.out, EYE_L, EYE_Y, c.hairS); P(c.out, EYE_L + 1, EYE_Y, c.hairS);
    P(c.out, EYE_R, EYE_Y, c.hairS); P(c.out, EYE_R + 1, EYE_Y, c.hairS);
  }),
  PART('huge', 'Huge', 2, (c) => {
    const { expr } = c;
    if (expr === 'oops') {
      row(c.out, EYE_Y + 1, EYE_L - 1, EYE_L + 1, INK);
      row(c.out, EYE_Y + 1, EYE_R, EYE_R + 2, INK);
      return;
    }
    box(c.out, EYE_L - 1, EYE_Y, EYE_L + 1, EYE_Y + 1, WHITE);
    box(c.out, EYE_R, EYE_Y, EYE_R + 2, EYE_Y + 1, WHITE);
    const up = expr === 'excited';
    P(c.out, EYE_L, EYE_Y + (up ? 0 : 1), INK); P(c.out, EYE_R + 1, EYE_Y + (up ? 0 : 1), INK);
    if (expr === 'focused') { row(c.out, EYE_Y, EYE_L - 1, EYE_L + 1, c.hairS); row(c.out, EYE_Y, EYE_R, EYE_R + 2, c.hairS); }
    if (expr === 'chill') { row(c.out, EYE_Y, EYE_L - 1, EYE_L + 1, c.skinS); row(c.out, EYE_Y, EYE_R, EYE_R + 2, c.skinS); }
  }),
  PART('bulge', 'Bulging', 2, (c) => {
    const { expr } = c;
    if (expr === 'oops') { sym(c.out, 4, 1, INK); sym(c.out, 5, 1, INK); }
    else {
      sym(c.out, 4, 1, WHITE); sym(c.out, 5, 1, WHITE);
      // the pupils slide with the mood: out when excited, in when concentrating
      sym(c.out, expr === 'excited' ? 4 : 5, 1, INK);
      if (expr === 'focused') sym(c.out, 4, 0, c.hairS);
      if (expr === 'chill') sym(c.out, 5, 0, c.skinS);
    }
    P(c.out, EYE_L + 1, EYE_Y + 1, c.skinS); P(c.out, EYE_R, EYE_Y + 1, c.skinS);
  }),
  PART('wink', 'Wink', 4, (c) => {
    box(c.out, EYE_L, EYE_Y, EYE_L + 1, EYE_Y + 1, WHITE);
    P(c.out, EYE_L + 1, EYE_Y + 1, INK);
    row(c.out, EYE_Y + 1, EYE_R, EYE_R + 1, INK);
  }),
  PART('star', 'Starstruck', 7, (c) => {
    box(c.out, EYE_L, EYE_Y, EYE_L + 1, EYE_Y + 1, WHITE);
    box(c.out, EYE_R, EYE_Y, EYE_R + 1, EYE_Y + 1, WHITE);
    P(c.out, EYE_L + 1, EYE_Y + 1, '#ffd45e'); P(c.out, EYE_L, EYE_Y, '#ffd45e');
    P(c.out, EYE_R, EYE_Y + 1, '#ffd45e'); P(c.out, EYE_R + 1, EYE_Y, '#ffd45e');
  }),
  PART('led', 'LED', 5, (c) => {
    const glow = c.expr === 'oops' ? '#ff6b6b' : '#37e0b8';
    row(c.out, EYE_Y + 1, EYE_L, EYE_L + 1, glow);
    row(c.out, EYE_Y + 1, EYE_R, EYE_R + 1, glow);
    if (c.expr !== 'chill') { P(c.out, EYE_L + 1, EYE_Y, glow); P(c.out, EYE_R, EYE_Y, glow); }
  }),
  PART('wise', 'Wise', 11, (c) => {
    plainEye(c, 2, '#3a72c9');
    row(c.out, EYE_Y - 1, EYE_L - 1, EYE_L + 1, c.hairS);
    row(c.out, EYE_Y - 1, EYE_R, EYE_R + 2, c.hairS);
  }),
  PART('galaxy', 'Galaxy', 18, (c) => {
    box(c.out, EYE_L, EYE_Y, EYE_L + 1, EYE_Y + 1, '#2b1a55');
    box(c.out, EYE_R, EYE_Y, EYE_R + 1, EYE_Y + 1, '#2b1a55');
    P(c.out, EYE_L + 1, EYE_Y, WHITE); P(c.out, EYE_L, EYE_Y + 1, '#a88aff');
    P(c.out, EYE_R, EYE_Y, WHITE); P(c.out, EYE_R + 1, EYE_Y + 1, '#a88aff');
  }),
];

// ---- mouth, rows 8-9

export const MOUTHS: PartDef[] = [
  PART('smile', 'Smile', 0, (c) => {
    if (c.expr === 'oops') { box(c.out, 7, 8, 8, 9, '#7a3030'); return; }
    if (c.expr === 'excited') { box(c.out, 6, 8, 9, 9, '#7a3030'); row(c.out, 9, 7, 8, '#e0788c'); return; }
    row(c.out, 9, 6, 9, '#7a3030');
    if (c.expr !== 'focused') { P(c.out, 5, 8, '#7a3030'); P(c.out, 10, 8, '#7a3030'); }
  }),
  PART('grin', 'Grin', 0, (c) => {
    box(c.out, 6, 8, 9, 9, '#6d2a2a');
    row(c.out, 8, 6, 9, WHITE);
    if (c.expr === 'oops') row(c.out, 9, 6, 9, '#6d2a2a');
  }),
  PART('small', 'Small', 0, (c) => { row(c.out, 8, 7, 8, '#7a3030'); }),
  PART('open', 'Open', 0, (c) => { box(c.out, 6, 8, 9, 9, '#6d2a2a'); row(c.out, 9, 7, 8, '#e0788c'); }),
  PART('flat', 'Flat', 0, (c) => { row(c.out, 8, 6, 9, c.skinS); }),
  PART('smirk', 'Smirk', 1, (c) => { row(c.out, 8, 6, 8, '#7a3030'); P(c.out, 9, 7, '#7a3030'); }),
  PART('tongue', 'Tongue out', 2, (c) => {
    row(c.out, 8, 6, 9, '#6d2a2a');
    row(c.out, 9, 7, 8, '#e0788c');
  }),
  PART('whiskers', 'Muzzle', 0, (c) => {
    P(c.out, 6, 8, INK); P(c.out, 7, 9, INK); P(c.out, 8, 9, INK); P(c.out, 9, 8, INK);
  }, { crown: 'beast' }),
  PART('buck', 'Buck teeth', 2, (c) => {
    row(c.out, 8, 6, 9, '#7a3030');
    row(c.out, 9, 7, 8, WHITE);
  }),
  PART('beak', 'Beak', 3, (c) => {
    row(c.out, 8, 6, 9, '#e0a33a');
    row(c.out, 9, 7, 8, '#bd8420');
  }, { crown: 'beast' }),
  PART('fangs', 'Fangs', 6, (c) => {
    row(c.out, 8, 6, 9, '#6d2a2a');
    P(c.out, 6, 9, WHITE); P(c.out, 9, 9, WHITE);
  }, { crown: 'beast' }),
  PART('wide', 'Wide grin', 4, (c) => {
    row(c.out, 8, 5, 10, '#6d2a2a');
    P(c.out, 4, 7, '#6d2a2a'); P(c.out, 11, 7, '#6d2a2a');
  }),
  PART('grid', 'Speaker', 5, (c) => {
    for (let x = 6; x <= 9; x++) P(c.out, x, 8, c.hairS);
    P(c.out, 6, 9, c.hairS); P(c.out, 9, 9, c.hairS);
  }, { crown: 'beast' }),
  PART('none', 'Hidden', 0, () => {}),
];

// ---- gear (headwear, eyewear, worn on top of everything but the aura)

export const GEARS: PartDef[] = [
  PART('none', 'None', 0, () => {}),
  PART('headset', 'Headset', 0, (c) => {
    row(c.out, c.face.y0 - 1, 4, 11, '#19c6b0');
    P(c.out, 3, c.face.y0, '#19c6b0'); P(c.out, 12, c.face.y0, '#19c6b0');
    box(c.out, 1, 5, 2, 7, '#19c6b0'); box(c.out, 13, 5, 14, 7, '#19c6b0');
    P(c.out, 2, 6, '#0f9384'); P(c.out, 13, 6, '#0f9384');
  }),
  PART('glasses', 'Glasses', 0, (c) => {
    row(c.out, EYE_Y - 1, EYE_L, EYE_L + 1, INK);
    row(c.out, EYE_Y - 1, EYE_R, EYE_R + 1, INK);
    P(c.out, 4, EYE_Y, INK); P(c.out, 7, EYE_Y, INK); P(c.out, 8, EYE_Y, INK); P(c.out, 11, EYE_Y, INK);
    P(c.out, 4, EYE_Y + 1, INK); P(c.out, 11, EYE_Y + 1, INK);
    row(c.out, EYE_Y + 2, EYE_L, EYE_L + 1, INK);
    row(c.out, EYE_Y + 2, EYE_R, EYE_R + 1, INK);
  }),
  PART('shades', 'Shades', 1, (c) => {
    box(c.out, EYE_L - 1, EYE_Y, EYE_L + 1, EYE_Y + 1, '#20242b');
    box(c.out, EYE_R, EYE_Y, EYE_R + 2, EYE_Y + 1, '#20242b');
    row(c.out, EYE_Y, 3, 12, '#31363f');
    P(c.out, EYE_L, EYE_Y, '#5d6b80'); P(c.out, EYE_R + 1, EYE_Y, '#5d6b80');
  }),
  PART('cap', 'Cap', 1, (c) => {
    cap(c, 2, '#2b4a86');
    row(c.out, c.face.y0 + 2, 2, 8, '#1c3260');
    row(c.out, c.face.y0 - 1, 5, 10, '#2b4a86');
  }),
  PART('beanie', 'Beanie', 1, (c) => {
    cap(c, 2, '#b0362f');
    row(c.out, c.face.y0 + 2, 3, 12, '#83231d');
    row(c.out, c.face.y0 - 1, 6, 9, '#b0362f');
  }),
  PART('bandana', 'Bandana', 2, (c) => {
    const y = c.face.y0 + 2;
    const sp = faceSpan(c.face, y);
    if (sp) row(c.out, y, sp[0], sp[1], '#dc7699');
    P(c.out, 13, y, '#b25574'); P(c.out, 13, y + 1, '#b25574');
  }),
  PART('goggles', 'Goggles', 3, (c) => {
    row(c.out, EYE_Y - 1, 3, 12, '#6b432a');
    box(c.out, 4, EYE_Y, 6, EYE_Y + 1, '#8fd8ff');
    box(c.out, 9, EYE_Y, 11, EYE_Y + 1, '#8fd8ff');
    P(c.out, 4, EYE_Y, WHITE); P(c.out, 9, EYE_Y, WHITE);
  }),
  PART('flower', 'Flower', 3, (c) => {
    P(c.out, 3, c.face.y0, '#ff9ec0'); P(c.out, 3, c.face.y0 + 1, '#ff9ec0');
    P(c.out, 2, c.face.y0 + 1, '#ff9ec0'); P(c.out, 3, c.face.y0 + 2, '#ff9ec0');
    P(c.out, 2, c.face.y0, '#ffd45e');
  }),
  PART('visor', 'Visor', 4, (c) => {
    row(c.out, EYE_Y - 1, 3, 12, '#31363f');
    box(c.out, 4, EYE_Y, 11, EYE_Y + 1, 'rgba(25,198,176,0.72)');
    P(c.out, 5, EYE_Y, '#b6fff2');
  }),
  PART('partyhat', 'Party hat', 5, (c) => {
    row(c.out, c.face.y0 - 1, 6, 9, '#dc7699');
    row(c.out, c.face.y0 - 2, 7, 8, '#ffd45e');
    P(c.out, 7, c.face.y0 - 3, '#ffd45e');
    cap(c, 1, '#b25574');
  }),
  PART('eyepatch', 'Eye patch', 6, (c) => {
    box(c.out, EYE_L - 1, EYE_Y, EYE_L + 1, EYE_Y + 1, INK);
    row(c.out, EYE_Y, 3, 4, INK);
  }),
  PART('helm', 'Helm', 9, (c) => {
    cap(c, 3, '#98a2b5');
    row(c.out, c.face.y0 - 1, 5, 10, '#98a2b5');
    row(c.out, 4, 3, 12, '#c2cad9');              // brow ridge, just above the slot
    for (let y = 5; y <= 8; y++) {                // cheek guards flank the eyes
      P(c.out, 3, y, '#98a2b5'); P(c.out, 4, y, '#7c869c');
      P(c.out, 11, y, '#7c869c'); P(c.out, 12, y, '#98a2b5');
    }
    for (let y = 4; y <= 7; y++) { P(c.out, 7, y, '#7c869c'); P(c.out, 8, y, '#7c869c'); }
    row(c.out, 9, 4, 11, '#98a2b5');
  }),
  PART('crown', 'Crown', 10, (c) => {
    row(c.out, c.face.y0, 4, 11, '#e8bb3a');
    P(c.out, 4, c.face.y0 - 1, '#e8bb3a'); P(c.out, 7, c.face.y0 - 1, '#e8bb3a');
    P(c.out, 8, c.face.y0 - 1, '#e8bb3a'); P(c.out, 11, c.face.y0 - 1, '#e8bb3a');
    P(c.out, 7, c.face.y0, '#ff6b6b'); P(c.out, 8, c.face.y0, '#8fd8ff');
  }),
  PART('wizardhat', 'Wizard hat', 11, (c) => {
    row(c.out, c.face.y0, 2, 13, '#4a2f86');
    row(c.out, c.face.y0 - 1, 4, 11, '#5f3fa8');
    row(c.out, c.face.y0 - 2, 5, 9, '#5f3fa8');
    row(c.out, c.face.y0 - 3, 6, 8, '#4a2f86');
    P(c.out, 9, c.face.y0 - 4, '#ffd45e');
  }),
  PART('mask', 'Mask', 16, (c) => {
    cap(c, 2, '#20242b');
    for (let y = 7; y <= 10; y++) {
      const sp = faceSpan(c.face, y);
      if (sp) row(c.out, y, sp[0], sp[1], '#20242b');
    }
    row(c.out, EYE_Y + 2, 3, 12, '#31363f');
  }),
  PART('dome', 'Space dome', 14, (c) => {
    row(c.out, c.face.y0 - 1, 4, 11, '#e6f2ff');
    for (let y = c.face.y0; y <= 10; y++) {
      const sp = faceSpan(c.face, y);
      if (sp) { P(c.out, sp[0] - 1, y, '#e6f2ff'); P(c.out, sp[1] + 1, y, '#e6f2ff'); }
    }
    row(c.out, 11, 3, 12, '#c2cad9');
    P(c.out, 4, c.face.y0, 'rgba(255,255,255,0.7)');
  }),
  PART('halo', 'Halo', 18, (c) => {
    row(c.out, c.face.y0 - 3, 5, 10, '#ffe9a8');
    P(c.out, 4, c.face.y0 - 3, '#e8bb3a'); P(c.out, 11, c.face.y0 - 3, '#e8bb3a');
  }),
];

// ---- outfits, rows 11-15

/** Shoulders and chest, the base every outfit paints on. */
function torso(c: Ctx, colour: string, shade: string) {
  const { out } = c;
  row(out, 11, 6, 9, c.skinS);
  row(out, 12, 4, 11, colour);
  row(out, 13, 2, 13, colour);
  box(out, 1, 14, 14, 15, colour);
  // shading down the right side
  for (let y = 12; y <= 15; y++) P(out, y === 12 ? 11 : y === 13 ? 13 : 14, y, shade);
  row(out, 15, 1, 14, shade);
}

export const OUTFITS: PartDef[] = [
  PART('tee', 'Tee', 0, (c) => { torso(c, c.fit, c.fitS); }),
  PART('hoodie', 'Hoodie', 0, (c) => {
    torso(c, c.fit, c.fitS);
    row(c.out, 12, 5, 6, c.fitS); row(c.out, 12, 9, 10, c.fitS);
    P(c.out, 7, 12, c.fitS); P(c.out, 8, 12, c.fitS);
    row(c.out, 13, 7, 8, c.fitS);
  }),
  PART('hoodieK', 'KeyTopia hoodie', 0, (c) => {
    torso(c, c.fit, c.fitS);
    row(c.out, 12, 5, 6, c.fitS); row(c.out, 12, 9, 10, c.fitS);
    // K badge on the chest
    for (let y = 13; y <= 15; y++) P(c.out, 6, y, WHITE);
    P(c.out, 8, 13, WHITE); P(c.out, 7, 14, WHITE); P(c.out, 8, 15, WHITE);
  }),
  PART('collar', 'Collared shirt', 0, (c) => {
    torso(c, c.fit, c.fitS);
    P(c.out, 6, 12, WHITE); P(c.out, 9, 12, WHITE);
    row(c.out, 13, 7, 8, WHITE);
  }),
  PART('scarf', 'Scarf', 1, (c) => {
    torso(c, c.fit, c.fitS);
    row(c.out, 11, 5, 10, '#b0362f');
    row(c.out, 12, 5, 10, '#83231d');
    P(c.out, 11, 13, '#b0362f'); P(c.out, 11, 14, '#83231d');
  }),
  PART('jacket', 'Jacket', 2, (c) => {
    torso(c, c.fit, c.fitS);
    box(c.out, 7, 12, 8, 15, c.skin);
    P(c.out, 6, 12, c.fitS); P(c.out, 9, 12, c.fitS);
    row(c.out, 13, 2, 3, c.fitS); row(c.out, 13, 12, 13, c.fitS);
  }),
  PART('jersey', 'Jersey', 3, (c) => {
    torso(c, c.fit, c.fitS);
    row(c.out, 13, 2, 3, WHITE); row(c.out, 13, 12, 13, WHITE);
    P(c.out, 7, 14, WHITE); P(c.out, 8, 14, WHITE);
  }),
  PART('overalls', 'Overalls', 4, (c) => {
    torso(c, c.skin, c.skinS);
    row(c.out, 13, 5, 6, c.fit); row(c.out, 13, 9, 10, c.fit);
    box(c.out, 4, 14, 11, 15, c.fit);
    P(c.out, 5, 14, c.fitS); P(c.out, 10, 14, c.fitS);
  }),
  PART('backpack', 'Pack straps', 5, (c) => {
    torso(c, c.fit, c.fitS);
    box(c.out, 4, 12, 5, 15, '#6b432a');
    box(c.out, 10, 12, 11, 15, '#6b432a');
    row(c.out, 14, 5, 10, '#4d2e1c');
  }),
  PART('labcoat', 'Lab coat', 6, (c) => {
    torso(c, '#e8ecf2', '#c2cad9');
    box(c.out, 7, 12, 8, 15, c.fit);
    P(c.out, 3, 14, c.fit); P(c.out, 12, 14, c.fit);
  }),
  PART('plating', 'Plating', 5, (c) => {
    torso(c, c.fit, c.fitS);
    row(c.out, 13, 6, 9, c.fitS);
    P(c.out, 7, 14, '#37e0b8'); P(c.out, 8, 14, '#37e0b8');
    row(c.out, 12, 4, 5, c.fitS); row(c.out, 12, 10, 11, c.fitS);
  }),
  PART('armour', 'Armour', 9, (c) => {
    torso(c, '#98a2b5', '#7c869c');
    row(c.out, 12, 4, 5, '#c2cad9'); row(c.out, 12, 10, 11, '#c2cad9');
    box(c.out, 6, 13, 9, 14, '#c2cad9');
    P(c.out, 7, 13, c.fit); P(c.out, 8, 13, c.fit);
    row(c.out, 15, 1, 14, '#6a7286');
  }),
  PART('robe', 'Robe', 11, (c) => {
    torso(c, c.fit, c.fitS);
    box(c.out, 6, 12, 9, 15, '#e8bb3a');
    box(c.out, 7, 13, 8, 15, c.fitS);
    P(c.out, 7, 12, c.fitS); P(c.out, 8, 12, c.fitS);
  }),
  PART('suit', 'Space suit', 14, (c) => {
    torso(c, '#e8ecf2', '#c2cad9');
    row(c.out, 12, 4, 11, '#c2cad9');
    box(c.out, 6, 14, 9, 15, c.fit);
    P(c.out, 3, 13, '#ff6b6b'); P(c.out, 12, 13, '#19c6b0');
  }),
  PART('gi', 'Gi', 16, (c) => {
    torso(c, '#20242b', '#14171c');
    box(c.out, 7, 12, 8, 15, c.fit);
    row(c.out, 14, 1, 14, c.fit);
  }),
  PART('wings', 'Wings', 8, (c) => {
    box(c.out, 0, 11, 1, 14, c.fitS);
    box(c.out, 14, 11, 15, 14, c.fitS);
    P(c.out, 2, 12, c.fit); P(c.out, 13, 12, c.fit);
    torso(c, c.fit, c.fitS);
  }),
  PART('cape', 'Cape', 12, (c) => {
    box(c.out, 1, 12, 14, 15, c.fitS);
    row(c.out, 12, 3, 12, c.fitS);
    torso(c, c.fit, c.fitS);
    row(c.out, 13, 1, 2, c.fitS); row(c.out, 13, 13, 14, c.fitS);
    row(c.out, 12, 5, 10, '#e8bb3a');
  }),
];

// ---- auras, painted first so everything sits on top

export const AURAS: PartDef[] = [
  PART('none', 'None', 0, () => {}),
  PART('sparkles', 'Sparkles', 2, (c) => {
    for (const [x, y] of [[1, 2], [14, 4], [2, 8], [13, 9], [0, 5]]) P(c.out, x, y, '#ffe9a8');
  }),
  PART('dots', 'Pixel dust', 4, (c) => {
    for (const [x, y] of [[0, 3], [15, 3], [1, 6], [14, 7], [0, 10], [15, 10]]) P(c.out, x, y, '#19c6b0');
  }),
  PART('stars', 'Starfield', 7, (c) => {
    for (const [x, y] of [[1, 1], [14, 2], [0, 7], [15, 6], [2, 10]]) {
      P(c.out, x, y, WHITE); P(c.out, x, y + 1, 'rgba(255,255,255,0.4)');
    }
  }),
  PART('bubbles', 'Bubbles', 9, (c) => {
    for (const [x, y] of [[1, 4], [14, 6], [0, 9], [15, 11]]) P(c.out, x, y, '#8fd8ff');
    P(c.out, 2, 2, '#c9ecff'); P(c.out, 13, 3, '#c9ecff');
  }),
  PART('embers', 'Embers', 13, (c) => {
    for (const [x, y] of [[1, 3], [14, 5], [0, 8], [15, 9], [2, 11]]) P(c.out, x, y, '#ff8c2e');
    P(c.out, 1, 6, '#ffc247'); P(c.out, 14, 10, '#ffc247');
  }),
  PART('leaves', 'Drifting leaves', 15, (c) => {
    for (const [x, y] of [[1, 2], [14, 5], [0, 9]]) { P(c.out, x, y, '#5fc98f'); P(c.out, x + 1, y + 1, '#3f9c6a'); }
  }),
  PART('glow', 'Aurora', 19, (c) => {
    for (let y = 1; y <= 12; y++) {
      P(c.out, 0, y, y % 2 ? 'rgba(25,198,176,0.35)' : 'rgba(123,95,216,0.35)');
      P(c.out, 15, y, y % 2 ? 'rgba(123,95,216,0.35)' : 'rgba(25,198,176,0.35)');
    }
  }),
];

// ---------------------------------------------------------------- catalogue

export type Slot = 'kind' | 'face' | 'hair' | 'eyes' | 'mouth' | 'gear' | 'outfit' | 'aura';

export const CATALOGUE: Record<Exclude<Slot, 'kind' | 'face'>, PartDef[]> = {
  hair: HAIRS, eyes: EYES, mouth: MOUTHS, gear: GEARS, outfit: OUTFITS, aura: AURAS,
};

/**
 * What a wearer at this level may use.
 *
 * A creature's own colours and features are its identity, not a reward: a frog
 * is green at level 1 or it is not a frog. So anything a kind suggests counts
 * as unlocked while you are wearing that kind, even when the same swatch is
 * still locked for everyone else.
 */
export function isPartOpen(ch: Character, slot: Exclude<Slot, 'kind' | 'face'>, part: PartDef, level: number): boolean {
  return part.level <= level || KIND_BY_ID.get(ch.kind)?.suggests?.[slot] === part.id;
}

export function isSwatchOpen(ch: Character, key: SwatchKey, i: number, level: number): boolean {
  const list = SWATCHES[key];
  return (list[i]?.level ?? 99) <= level || KIND_BY_ID.get(ch.kind)?.suggests?.[key] === i;
}

export type SwatchKey = 'skin' | 'hairColor' | 'outfitColor';
export const SWATCHES: Record<SwatchKey, Swatch[]> = {
  skin: SKINS, hairColor: HAIR_COLORS, outfitColor: OUTFIT_COLORS,
};

/**
 * Clamp a character to what its wearer may actually put on: nothing above their
 * level, and nothing a cat could physically wear. Run after every kind switch,
 * because the parts that fit an explorer are not the parts that fit a dragon.
 */
export function wearable(ch: Character, level: number): Character {
  const next = { ...ch };
  if ((KIND_BY_ID.get(next.kind)?.level ?? 99) > level) next.kind = 'human';
  const face = FACES.find((f) => f.id === next.face);
  if (!face || face.level > level) next.face = 'round';
  for (const slot of ['hair', 'eyes', 'mouth', 'gear', 'outfit', 'aura'] as const) {
    const fits = partsFor(slot, next.kind);
    const open = fits.filter((p) => isPartOpen(next, slot, p, level));
    if (!open.some((p) => p.id === next[slot])) next[slot] = (open[0] ?? fits[0]).id;
  }
  for (const key of ['skin', 'hairColor', 'outfitColor'] as const) {
    if (!isSwatchOpen(next, key, next[key], level)) next[key] = 0;
  }
  return next;
}

/**
 * Switch kind. The suggestions are what make the creature read as itself, so
 * they win — but they only cover the slots that kind actually cares about, and
 * everything else you picked comes along unchanged.
 */
export function applyKind(prev: Character, kindId: string, level: number): Character {
  const kind = KIND_BY_ID.get(kindId);
  return wearable({ ...prev, ...kind?.suggests, kind: kindId }, level);
}

/** Parts of a slot that this kind can wear, in catalogue order. */
export function partsFor(slot: Exclude<Slot, 'kind' | 'face'>, kindId: string): PartDef[] {
  const kind = KIND_BY_ID.get(kindId) ?? KINDS[0];
  return CATALOGUE[slot].filter(
    (p) => (!p.crown || p.crown === kind.crown) && (!p.kinds || p.kinds.includes(kindId)),
  );
}

const findPart = (list: PartDef[], id: string) => list.find((p) => p.id === id);

/**
 * The level you need to wear this character exactly as it is — found by asking
 * the wardrobe itself, so a creature's own colours never count against it.
 */
export function characterLevel(ch: Character): number {
  const want = encodeCharacter(ch);
  for (let l = 0; l <= 40; l++) if (encodeCharacter(wearable(ch, l)) === want) return l;
  return 40;
}

/** Everything that unlocks exactly at this level, for the "recently unlocked" rail. */
export function unlocksAt(level: number): { slot: string; name: string }[] {
  const out: { slot: string; name: string }[] = [];
  for (const k of KINDS) if (k.level === level) out.push({ slot: 'Character', name: k.name });
  for (const f of FACES) if (f.level === level) out.push({ slot: 'Face', name: f.name });
  const label: Record<string, string> = { hair: 'Hair', eyes: 'Eyes', mouth: 'Mouth', gear: 'Gear', outfit: 'Outfit', aura: 'Aura' };
  for (const [slot, list] of Object.entries(CATALOGUE)) {
    for (const p of list) if (p.level === level) out.push({ slot: label[slot] ?? slot, name: p.name });
  }
  for (const s of SKINS) if (s.level === level) out.push({ slot: 'Colour', name: s.name });
  for (const s of HAIR_COLORS) if (s.level === level) out.push({ slot: 'Hair colour', name: s.name });
  for (const s of OUTFIT_COLORS) if (s.level === level) out.push({ slot: 'Outfit colour', name: s.name });
  return out;
}

/** How many parts a level unlocks, counted across every slot. */
export function unlockedCount(level: number): { have: number; total: number } {
  let have = 0, total = 0;
  const tally = (lv: number) => { total++; if (lv <= level) have++; };
  KINDS.forEach((k) => tally(k.level));
  FACES.forEach((f) => tally(f.level));
  Object.values(CATALOGUE).forEach((l) => l.forEach((p) => tally(p.level)));
  [SKINS, HAIR_COLORS, OUTFIT_COLORS].forEach((l) => l.forEach((s) => tally(s.level)));
  return { have, total };
}

/** Unlock progress for one collection of kinds. */
export function collectionProgress(id: Collection, level: number) {
  const list = KINDS.filter((k) => k.collection === id);
  return { have: list.filter((k) => k.level <= level).length, total: list.length, kinds: list };
}

// ---------------------------------------------------------------- rendering

export function buildSprite(ch: Character, expr: Expression = 'happy'): Px[] {
  const kind = KIND_BY_ID.get(ch.kind) ?? KINDS[0];
  const face = FACES.find((f) => f.id === ch.face) ?? FACES[0];
  const skin = SKINS[ch.skin] ?? SKINS[0];
  const hairC = HAIR_COLORS[ch.hairColor] ?? HAIR_COLORS[0];
  const fitC = OUTFIT_COLORS[ch.outfitColor] ?? OUTFIT_COLORS[0];

  const ctx: Ctx = {
    out: [], face, kind, expr,
    skin: skin.c, skinS: skin.s,
    hair: hairC.c, hairS: hairC.s,
    fit: fitC.c, fitS: fitC.s,
  };

  const pick = (list: PartDef[], id: string) => findPart(list, id);

  pick(AURAS, ch.aura)?.draw(ctx);
  (pick(OUTFITS, ch.outfit) ?? OUTFITS[0]).draw(ctx);
  kind.back?.(ctx);
  headShape(ctx);
  kind.front?.(ctx);
  pick(EYES, ch.eyes)?.draw(ctx);
  if (expr !== 'oops' || ch.mouth === 'none') pick(MOUTHS, ch.mouth)?.draw(ctx);
  else MOUTHS.find((m) => m.id === 'open')!.draw(ctx);
  pick(HAIRS, ch.hair)?.draw(ctx);
  pick(GEARS, ch.gear)?.draw(ctx);
  if (expr === 'excited') { P(ctx.out, 1, 1, '#ffe9a8'); P(ctx.out, 14, 2, '#ffe9a8'); }
  if (expr === 'oops') { P(ctx.out, 13, 3, '#8fd8ff'); P(ctx.out, 13, 4, '#8fd8ff'); }
  return ctx.out;
}

const spriteCache = new Map<string, Px[]>();

export function spriteFor(ch: Character, expr: Expression = 'happy'): Px[] {
  const key = `${encodeCharacter(ch)}|${expr}`;
  let px = spriteCache.get(key);
  if (!px) {
    px = buildSprite(ch, expr);
    if (spriteCache.size > 400) spriteCache.clear();
    spriteCache.set(key, px);
  }
  return px;
}

// ---------------------------------------------------------------- encoding

const FIELDS: [keyof Character, string][] = [
  ['kind', 'k'], ['face', 'f'], ['hair', 'h'], ['eyes', 'e'], ['mouth', 'm'],
  ['gear', 'g'], ['outfit', 'o'], ['aura', 'a'],
  ['skin', 's'], ['hairColor', 'hc'], ['outfitColor', 'oc'],
];

export function encodeCharacter(ch: Character): string {
  const parts: string[] = [];
  for (const [key, short] of FIELDS) {
    const v = ch[key];
    if (v !== DEFAULT_CHARACTER[key]) parts.push(`${short}=${v}`);
  }
  return `ch1:${parts.join(',')}`;
}

export function decodeCharacter(v: string | undefined): Character {
  const ch: Character = { ...DEFAULT_CHARACTER };
  if (!v) return ch;
  if (v.startsWith('bk:')) return legacyCharacter(Number(v.slice(3)) || 0);
  if (!v.startsWith('ch1:')) return ch;
  for (const bit of v.slice(4).split(',')) {
    const eq = bit.indexOf('=');
    if (eq < 0) continue;
    const short = bit.slice(0, eq), raw = bit.slice(eq + 1);
    const field = FIELDS.find((f) => f[1] === short);
    if (!field) continue;
    const key = field[0];
    if (typeof DEFAULT_CHARACTER[key] === 'number') {
      const n = Number(raw);
      if (Number.isFinite(n)) (ch[key] as number) = n;
    } else (ch[key] as string) = raw;
  }
  return ch;
}

export const isCharacterValue = (v: string | undefined) => !!v && (v.startsWith('ch1:') || v.startsWith('bk:'));

// ---------------------------------------------------------------- presets

const C = (p: Partial<Character>): Character => ({ ...DEFAULT_CHARACTER, ...p });

/**
 * Ready-made explorers, offered at sign-up and used for simulated racers.
 * Indices 0-19 are people, 20-24 the animal pals — the order the rest of the
 * app relies on through ANIMAL_START.
 */
const PRESET_LIST: Character[] = [
  C({ skin: 0, hairColor: 1, hair: 'short', outfit: 'hoodieK', outfitColor: 0 }),
  C({ skin: 1, hairColor: 0, hair: 'spiky', eyes: 'determined', outfit: 'tee', outfitColor: 2 }),
  C({ skin: 2, hairColor: 1, hair: 'side', face: 'square', outfit: 'collar', outfitColor: 1 }),
  C({ skin: 4, hairColor: 0, hair: 'curls', outfit: 'tee', outfitColor: 3 }),
  C({ skin: 3, hairColor: 2, hair: 'long', face: 'oval', outfit: 'hoodie', outfitColor: 4 }),
  C({ skin: 5, hairColor: 0, hair: 'flat', outfit: 'tee', outfitColor: 6 }),
  C({ skin: 0, hairColor: 4, hair: 'ponytail', mouth: 'grin', outfit: 'jersey', outfitColor: 5 }),
  C({ skin: 1, hairColor: 5, hair: 'spiky', gear: 'cap', outfit: 'hoodie', outfitColor: 1 }),
  C({ skin: 2, hairColor: 6, hair: 'bob', gear: 'glasses', outfit: 'collar', outfitColor: 7 }),
  C({ skin: 0, hairColor: 3, hair: 'short', gear: 'beanie', outfit: 'scarf', outfitColor: 2 }),
  C({ skin: 3, hairColor: 9, hair: 'buns', outfit: 'jacket', outfitColor: 6 }),
  C({ skin: 1, hairColor: 11, hair: 'braids', mouth: 'smirk', outfit: 'overalls', outfitColor: 8 }),
  C({ skin: 2, hairColor: 8, hair: 'afro', gear: 'glasses', outfit: 'labcoat', outfitColor: 0 }),
  C({ skin: 4, hairColor: 7, hair: 'mohawk', eyes: 'determined', outfit: 'jacket', outfitColor: 2 }),
  C({ kind: 'dragon', skin: 8, hairColor: 3, hair: 'horns', mouth: 'fangs', outfit: 'wings', outfitColor: 3 }),
  C({ kind: 'robot', face: 'square', skin: 6, hairColor: 7, hair: 'antenna', eyes: 'led', mouth: 'grid', outfit: 'plating', outfitColor: 2 }),
  C({ skin: 9, hairColor: 10, hair: 'long', gear: 'crown', outfit: 'cape', outfitColor: 10 }),
  C({ kind: 'wizard', skin: 0, hairColor: 7, hair: 'beard', eyes: 'wise', gear: 'wizardhat', outfit: 'robe', outfitColor: 10 }),
  C({ kind: 'astronaut', skin: 1, hair: 'short', hairColor: 1, gear: 'dome', outfit: 'suit', aura: 'stars', outfitColor: 1 }),
  C({ kind: 'phoenix', skin: 11, hairColor: 5, hair: 'flame', mouth: 'beak', eyes: 'star', outfit: 'wings', outfitColor: 5, aura: 'embers' }),
  C({ kind: 'cat', skin: 6, hairColor: 7, hair: 'tuft', mouth: 'whiskers', outfit: 'tee', outfitColor: 6 }),
  C({ kind: 'fox', skin: 1, hairColor: 5, hair: 'tuft', mouth: 'whiskers', outfit: 'tee', outfitColor: 5 }),
  C({ kind: 'frog', skin: 8, hairColor: 0, eyes: 'bulge', mouth: 'wide', hair: 'none', outfit: 'tee', outfitColor: 3 }),
  C({ kind: 'panda', skin: SNOW_SKIN, hairColor: 0, hair: 'none', mouth: 'small', outfit: 'tee', outfitColor: 2 }),
  C({ kind: 'owl', skin: 2, hairColor: 3, eyes: 'huge', mouth: 'beak', hair: 'none', outfit: 'tee', outfitColor: 4 }),
];

/**
 * Each preset is offered at the level its own parts require, so the grid can
 * never advertise an explorer you are not allowed to wear.
 */
export const PRESET_CHARACTERS: { ch: Character; level: number }[] =
  PRESET_LIST.map((ch) => ({ ch, level: characterLevel(ch) }));

/** Index of the first animal preset; kid-mode racers draw from this range. */
export const ANIMAL_START = PRESET_LIST.length - 5;
export const ANIMAL_COUNT = 5;

/** Old "bk:<n>" avatars keep their identity by mapping onto the preset list. */
export function legacyCharacter(n: number): Character {
  return PRESET_LIST[Math.abs(n) % PRESET_LIST.length];
}

// ---------------------------------------------------------------- shuffling

const pickFrom = <T,>(list: T[], rnd: () => number): T => list[Math.floor(rnd() * list.length)] ?? list[0];

/** A random character built only from what this level has unlocked. */
export function randomCharacter(level: number, rnd: () => number = Math.random): Character {
  const kind = pickFrom(KINDS.filter((k) => k.level <= level), rnd);
  const ok = (l: PartDef[]) => l.filter((p) => p.level <= level);
  const ch: Character = {
    ...DEFAULT_CHARACTER,
    ...kind.suggests,
    kind: kind.id,
    face: pickFrom(FACES.filter((f) => f.level <= level), rnd).id,
    hair: pickFrom(ok(partsFor('hair', kind.id)), rnd).id,
    eyes: pickFrom(ok(partsFor('eyes', kind.id)), rnd).id,
    mouth: pickFrom(ok(partsFor('mouth', kind.id)), rnd).id,
    gear: rnd() < 0.55 ? pickFrom(ok(partsFor('gear', kind.id)), rnd).id : 'none',
    outfit: pickFrom(ok(partsFor('outfit', kind.id)), rnd).id,
    aura: rnd() < 0.3 ? pickFrom(ok(partsFor('aura', kind.id)), rnd).id : 'none',
    skin: SKINS.indexOf(pickFrom(SKINS.filter((s) => s.level <= level), rnd)),
    hairColor: HAIR_COLORS.indexOf(pickFrom(HAIR_COLORS.filter((s) => s.level <= level), rnd)),
    outfitColor: OUTFIT_COLORS.indexOf(pickFrom(OUTFIT_COLORS.filter((s) => s.level <= level), rnd)),
  };
  return ch;
}

/** Plain-language description, used for alt text and screen readers. */
export function describeCharacter(ch: Character): string {
  const kind = KIND_BY_ID.get(ch.kind);
  const gear = findPart(GEARS, ch.gear);
  const outfit = findPart(OUTFITS, ch.outfit);
  const bits = [kind?.name ?? 'Explorer'];
  if (outfit && outfit.id !== 'tee') bits.push(`in a ${outfit.name.toLowerCase()}`);
  if (gear && gear.id !== 'none') bits.push(`wearing ${gear.name.toLowerCase()}`);
  return bits.join(' ');
}
