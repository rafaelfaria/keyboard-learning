import { memo } from 'react';
import { hashStr } from '../lib/rng';
import {
  ANIMAL_COUNT, ANIMAL_START, GRID, PRESET_CHARACTERS,
  decodeCharacter, describeCharacter, encodeCharacter, legacyCharacter, spriteFor,
  type Character, type Expression,
} from '../lib/character';

export { ANIMAL_START, ANIMAL_COUNT, PRESET_CHARACTERS };
export type { Character, Expression };

/** The pixel sprite itself. Everything on screen ends up here. */
export const CharacterSprite = memo(function CharacterSprite({
  ch, size = 40, expr = 'happy', className = '', title,
}: {
  ch: Character; size?: number; expr?: Expression; className?: string; title?: string;
}) {
  const px = spriteFor(ch, expr);
  const label = title ?? describeCharacter(ch);
  return (
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`} width={size} height={size}
      className={`bk-av ${className}`} shapeRendering="crispEdges"
      role="img" aria-label={label}
    >
      <title>{label}</title>
      {px.map(([x, y, c], i) => (
        <rect key={i} x={x} y={y} width="1" height="1" fill={c} />
      ))}
    </svg>
  );
});

/** Render one of the ready-made explorers by index. */
export function BlockAvatar({ preset, size = 40, expr, className = '' }: {
  preset: number; size?: number; expr?: Expression; className?: string;
}) {
  return <CharacterSprite ch={legacyCharacter(preset)} size={size} expr={expr} className={className} />;
}

/** Render any stored avatar value: a character string, a legacy "bk:<n>", or an emoji. */
export function Avatar({ v, size = 40, expr, className = '' }: {
  v: string; size?: number; expr?: Expression; className?: string;
}) {
  if (v?.startsWith('ch1:') || v?.startsWith('bk:')) {
    return <CharacterSprite ch={decodeCharacter(v)} size={size} expr={expr} className={className} />;
  }
  return <span className={className} style={{ fontSize: size * 0.82, lineHeight: 1 }} aria-hidden>{v || '·'}</span>;
}

/** Stable preset index for simulated players, from their name. */
export function hashAvatar(name: string): number {
  return hashStr(name) % 14; // only the freely available presets for sim players
}

/** Animal preset for kid-mode sims — friendly faces at the starting line. */
export function kidAvatarValueFor(name: string): string {
  return `bk:${ANIMAL_START + (hashStr(name) % ANIMAL_COUNT)}`;
}

export function avatarValueFor(name: string): string {
  return `bk:${hashAvatar(name)}`;
}

/** The stored value for a preset, so new profiles save a real character. */
export function presetValue(i: number): string {
  return encodeCharacter(PRESET_CHARACTERS[Math.abs(i) % PRESET_CHARACTERS.length].ch);
}
