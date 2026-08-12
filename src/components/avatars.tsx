import { hashStr } from '../lib/rng';

// Minecraft-style pixel heads, 10×10. Stored on the profile as "bk:<index>".

interface Preset {
  skin: string;
  hair: string;
  style: 'flat' | 'spiky' | 'side' | 'long' | 'buzz' | 'beanie' | 'none' | 'bot' | 'creeper' | 'cat' | 'fox' | 'frog' | 'panda' | 'owl';
  eyes: string;
  acc?: 'glasses' | 'cheeks' | 'visor' | 'freckles';
  level: number;
}

const P = (skin: string, hair: string, style: Preset['style'], eyes: string, acc?: Preset['acc'], level = 0): Preset =>
  ({ skin, hair, style, eyes, acc, level });

export const AVATAR_PRESETS: Preset[] = [
  P('#f2c9a0', '#3b2a1e', 'flat', '#2b2622', 'cheeks'),
  P('#e8b48a', '#151210', 'spiky', '#20303f'),
  P('#c98d5f', '#241c14', 'side', '#241f1a', 'cheeks'),
  P('#a76a43', '#0f0c0a', 'buzz', '#1c1712'),
  P('#8a5231', '#1a120c', 'long', '#17120d', 'cheeks'),
  P('#6b3d22', '#000000', 'flat', '#100d0a'),
  P('#f2c9a0', '#b7742f', 'long', '#2e4a35', 'freckles', 2),
  P('#e8b48a', '#d9a441', 'spiky', '#3a5a8c', undefined, 2),
  P('#c98d5f', '#8c2f22', 'side', '#2b2622', 'glasses', 3),
  P('#f2c9a0', '#5a4632', 'beanie', '#20303f', undefined, 3),
  P('#a76a43', '#274a8c', 'spiky', '#1c1712', undefined, 4),
  P('#e8b48a', '#8c2f6b', 'long', '#2b2622', 'cheeks', 5),
  P('#c98d5f', '#2f8c57', 'flat', '#241f1a', 'glasses', 6),
  P('#8a5231', '#c9c9c9', 'buzz', '#17120d', undefined, 7),
  P('#9fd8a8', '#2f6b3a', 'creeper', '#123318', undefined, 8),      // meadow sprite
  P('#bfc7d6', '#5a6478', 'bot', '#37e0b8', 'visor', 9),            // key-bot
  P('#d9b3ff', '#7a4fc9', 'long', '#3a2a5c', 'cheeks', 10),         // twilight sprite
  P('#ffd28a', '#e07b28', 'spiky', '#5c3a12', 'freckles', 11),      // ember sprite
  P('#a8dcff', '#3a7ac9', 'beanie', '#123a5c', undefined, 12),      // glacier sprite
  P('#ffe9a8', '#c9a13a', 'flat', '#5c4a12', 'visor', 14),          // aurum sprite
  // pixel pals — animal characters, loved by the youngest explorers
  P('#b8b2c9', '#6d6584', 'cat', '#2b2622', undefined, 0),
  P('#e8955c', '#c96b2f', 'fox', '#2b2622', undefined, 0),
  P('#9fd8a8', '#5aa964', 'frog', '#123318', undefined, 0),
  P('#f2f2f2', '#1c1c1c', 'panda', '#1c1c1c', undefined, 0),
  P('#d9c2a0', '#8a6a4a', 'owl', '#2b2622', undefined, 0),
];

/** Index of the first animal preset; kid-mode sims draw from this range. */
export const ANIMAL_START = AVATAR_PRESETS.length - 5;
export const ANIMAL_COUNT = 5;

function px(x: number, y: number, c: string, key: string) {
  return <rect key={key} x={x} y={y} width="1" height="1" fill={c} />;
}

export function BlockAvatar({ preset, size = 40, className = '' }: { preset: number; size?: number; className?: string }) {
  const p = AVATAR_PRESETS[Math.abs(preset) % AVATAR_PRESETS.length];
  const cells: React.ReactNode[] = [];
  // hair
  const hair = (x: number, y: number, i: string) => cells.push(px(x, y, p.hair, `h${i}`));
  if (p.style !== 'none' && p.style !== 'bot' && p.style !== 'creeper') {
    if (p.style === 'spiky') { for (let x = 1; x < 10; x += 2) hair(x, 0, `t${x}`); }
    else for (let x = 0; x < 10; x++) hair(x, 0, `t${x}`);
    if (p.style !== 'buzz') for (let x = 0; x < 10; x++) hair(x, 1, `u${x}`);
    if (p.style === 'flat') { hair(0, 2, 'f0'); hair(9, 2, 'f9'); }
    if (p.style === 'side') for (let x = 0; x < 6; x++) hair(x, 2, `s${x}`);
    if (p.style === 'long') for (let y = 2; y <= 6; y++) { hair(0, y, `l${y}`); hair(1, y, `l2${y}`); hair(8, y, `r${y}`); hair(9, y, `r2${y}`); }
    if (p.style === 'beanie') { for (let x = 0; x < 10; x++) cells.push(px(x, 2, `color-mix(in srgb, ${p.hair} 60%, white)`, `b${x}`)); }
  }
  if (p.style === 'bot') {
    for (let x = 0; x < 10; x++) cells.push(px(x, 0, p.hair, `b0${x}`));
    cells.push(px(4, -0, p.hair, 'ant')); // antenna base blends into row 0
  }
  if (p.style === 'creeper') {
    cells.push(px(2, 6, p.hair, 'cm1'), px(3, 6, p.hair, 'cm2'), px(6, 6, p.hair, 'cm3'), px(7, 6, p.hair, 'cm4'));
    cells.push(px(3, 7, p.hair, 'cm5'), px(4, 7, p.hair, 'cm6'), px(5, 7, p.hair, 'cm7'), px(6, 7, p.hair, 'cm8'));
    cells.push(px(3, 8, p.hair, 'cm9'), px(6, 8, p.hair, 'cma'));
  }
  if (p.style === 'cat' || p.style === 'fox') {
    // ears
    cells.push(px(1, 0, p.hair, 'e1'), px(2, 0, p.hair, 'e2'), px(1, 1, p.hair, 'e3'), px(2, 1, p.hair, 'e4'));
    cells.push(px(7, 0, p.hair, 'e5'), px(8, 0, p.hair, 'e6'), px(7, 1, p.hair, 'e7'), px(8, 1, p.hair, 'e8'));
    cells.push(px(2, 1, '#f0b7c9', 'ei1'), px(7, 1, '#f0b7c9', 'ei2'));
    // snout + nose
    const snout = p.style === 'fox' ? '#ffe9d6' : '#e8e2f0';
    cells.push(px(4, 6, snout, 'sn1'), px(5, 6, snout, 'sn2'), px(4, 7, snout, 'sn3'), px(5, 7, snout, 'sn4'));
    cells.push(px(4, 6, '#3a2a20', 'nz1'), px(5, 6, '#3a2a20', 'nz2'));
    // whisker dots
    cells.push(px(1, 6, p.hair, 'w1'), px(8, 6, p.hair, 'w2'));
  }
  if (p.style === 'frog') {
    // eye bumps on top
    cells.push(px(1, 0, p.skin, 'fb1'), px(2, 0, p.skin, 'fb2'), px(7, 0, p.skin, 'fb3'), px(8, 0, p.skin, 'fb4'));
    cells.push(px(1, 1, '#ffffff', 'fw1'), px(2, 1, p.eyes, 'fp1'), px(8, 1, '#ffffff', 'fw2'), px(7, 1, p.eyes, 'fp2'));
    // wide smile
    for (let x = 2; x <= 7; x++) cells.push(px(x, 7, p.hair, `fm${x}`));
    cells.push(px(2, 6, p.hair, 'fmc1'), px(7, 6, p.hair, 'fmc2'));
  }
  if (p.style === 'panda') {
    // ears + eye patches
    cells.push(px(0, 0, p.hair, 'pe1'), px(1, 0, p.hair, 'pe2'), px(8, 0, p.hair, 'pe3'), px(9, 0, p.hair, 'pe4'));
    cells.push(px(1, 3, p.hair, 'pp1'), px(2, 3, p.hair, 'pp2'), px(2, 5, p.hair, 'pp3'), px(1, 5, p.hair, 'pp4'));
    cells.push(px(7, 3, p.hair, 'pp5'), px(8, 3, p.hair, 'pp6'), px(7, 5, p.hair, 'pp7'), px(8, 5, p.hair, 'pp8'));
    cells.push(px(4, 6, p.hair, 'pn1'), px(5, 6, p.hair, 'pn2'));
  }
  if (p.style === 'owl') {
    // ear tufts
    cells.push(px(0, 0, p.hair, 'ot1'), px(1, 0, p.hair, 'ot2'), px(0, 1, p.hair, 'ot3'));
    cells.push(px(8, 0, p.hair, 'ot4'), px(9, 0, p.hair, 'ot5'), px(9, 1, p.hair, 'ot6'));
    // huge round eyes
    cells.push(px(1, 3, '#ffffff', 'ow1'), px(2, 3, '#ffffff', 'ow2'), px(1, 4, '#ffffff', 'ow3'), px(2, 4, p.eyes, 'op1'));
    cells.push(px(7, 3, '#ffffff', 'ow4'), px(8, 3, '#ffffff', 'ow5'), px(8, 4, '#ffffff', 'ow6'), px(7, 4, p.eyes, 'op2'));
    // beak + chest feathers
    cells.push(px(4, 5, '#e0a33a', 'ob1'), px(5, 5, '#e0a33a', 'ob2'));
    cells.push(px(3, 8, p.hair, 'oc1'), px(5, 8, p.hair, 'oc2'), px(7, 8, p.hair, 'oc3'));
  }
  // eyes (frog and owl draw their own)
  const skipFace = p.style === 'frog' || p.style === 'owl';
  const ey = 4;
  if (!skipFace) {
    cells.push(px(2, ey, '#ffffff', 'ew1'), px(3, ey, p.eyes, 'ep1'));
    cells.push(px(7, ey, '#ffffff', 'ew2'), px(6, ey, p.eyes, 'ep2'));
  }
  // mouth (creeper/animals draw their own)
  if (!['creeper', 'cat', 'fox', 'frog', 'panda', 'owl'].includes(p.style)) {
    if (p.style === 'bot') { for (let x = 3; x <= 6; x++) cells.push(px(x, 7, p.eyes, `m${x}`)); }
    else { cells.push(px(3, 7, '#7a4030', 'm1'), px(4, 7, '#7a4030', 'm2'), px(5, 7, '#7a4030', 'm3'), px(6, 7, '#7a4030', 'm4')); }
  }
  // accessories
  if (p.acc === 'cheeks') cells.push(px(1, 6, '#f08a8a', 'c1'), px(8, 6, '#f08a8a', 'c2'));
  if (p.acc === 'freckles') cells.push(px(2, 6, '#a8703f', 'fr1'), px(7, 6, '#a8703f', 'fr2'), px(4, 6, '#a8703f', 'fr3'));
  if (p.acc === 'glasses') {
    cells.push(px(1, 4, '#1c1c1c', 'g1'), px(4, 4, '#1c1c1c', 'g2'), px(5, 4, '#1c1c1c', 'g3'), px(8, 4, '#1c1c1c', 'g4'));
    cells.push(px(2, 3, '#1c1c1c', 'g5'), px(3, 3, '#1c1c1c', 'g6'), px(6, 3, '#1c1c1c', 'g7'), px(7, 3, '#1c1c1c', 'g8'));
  }
  if (p.acc === 'visor') { for (let x = 2; x <= 7; x++) cells.push(px(x, 3, 'rgba(20,216,196,0.55)', `v${x}`)); }

  return (
    <svg
      viewBox="0 0 10 10" width={size} height={size}
      className={`bk-av ${className}`} shapeRendering="crispEdges" aria-hidden
    >
      <rect x="0" y="0" width="10" height="10" fill={p.skin} />
      {cells}
    </svg>
  );
}

/** Render any stored avatar value: "bk:<n>" → block head; legacy emoji → emoji. */
export function Avatar({ v, size = 40, className = '' }: { v: string; size?: number; className?: string }) {
  if (v?.startsWith('bk:')) return <BlockAvatar preset={Number(v.slice(3)) || 0} size={size} className={className} />;
  return <span className={className} style={{ fontSize: size * 0.82, lineHeight: 1 }} aria-hidden>{v || '·'}</span>;
}

/** Stable preset index for simulated players, from their name. */
export function hashAvatar(name: string): number {
  return hashStr(name) % 14; // only free-tier presets for sim players
}

/** Animal preset for kid-mode sims — friendly faces at the starting line. */
export function kidAvatarValueFor(name: string): string {
  return `bk:${ANIMAL_START + (hashStr(name) % ANIMAL_COUNT)}`;
}

export function avatarValueFor(name: string): string {
  return `bk:${hashAvatar(name)}`;
}
