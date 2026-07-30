import { hashStr } from '../lib/rng';

// Minecraft-style pixel heads, 10×10. Stored on the profile as "bk:<index>".

interface Preset {
  skin: string;
  hair: string;
  style: 'flat' | 'spiky' | 'side' | 'long' | 'buzz' | 'beanie' | 'none' | 'bot' | 'creeper';
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
];

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
  // eyes
  const ey = p.style === 'creeper' ? 4 : 4;
  cells.push(px(2, ey, '#ffffff', 'ew1'), px(3, ey, p.eyes, 'ep1'));
  cells.push(px(7, ey, '#ffffff', 'ew2'), px(6, ey, p.eyes, 'ep2'));
  // mouth (skip creeper — has its own)
  if (p.style !== 'creeper') {
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

export function avatarValueFor(name: string): string {
  return `bk:${hashAvatar(name)}`;
}
