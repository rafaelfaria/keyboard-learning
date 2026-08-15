/**
 * KeyTopia brand mark — an orbit ring sweeping around a tilted keycap bearing the K,
 * with a spark at the crest. Pure vector so it renders identically from 16px favicons
 * to the 512px app icon. Colours are fixed (brand identity), independent of theme.
 */

export const BRAND = {
  cyan: '#22d3ee',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#7c3aed',
  ink: '#1b2559',
  gold: '#fbbf24',
  amber: '#f59e0b',
  bg: '#0b1020',
};

/** The K glyph, hand-built as a path so no font is required. Local box 0..100. */
const K_PATH = 'M20 14 H41 V43 L67 14 H94 L59 51 L96 86 H68 L41 58 V86 H20 Z';

/** Four-pointed spark with concave sides. Local box 0..100. */
const SPARK_PATH = 'M50 2 C53.5 30 57 44.5 98 50 C57 55.5 53.5 70 50 98 C46.5 70 43 55.5 2 50 C43 44.5 46.5 30 50 2 Z';

export function LogoMark({ size = 32, idPrefix = 'kt', flat = false }: { size?: number; idPrefix?: string; flat?: boolean }) {
  const p = idPrefix;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="KeyTopia" className="logo-mark">
      <defs>
        <linearGradient id={`${p}-ring`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={BRAND.cyan} />
          <stop offset="45%" stopColor={BRAND.blue} />
          <stop offset="100%" stopColor={BRAND.violet} />
        </linearGradient>
        <linearGradient id={`${p}-ring2`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BRAND.indigo} />
          <stop offset="55%" stopColor={BRAND.blue} />
          <stop offset="100%" stopColor={BRAND.cyan} />
        </linearGradient>
        <linearGradient id={`${p}-cap`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#eff6ff" />
          <stop offset="100%" stopColor="#cfe0fb" />
        </linearGradient>
        <linearGradient id={`${p}-spark`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor={BRAND.gold} />
          <stop offset="100%" stopColor={BRAND.amber} />
        </linearGradient>
        {!flat && (
          <filter id={`${p}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="14" stdDeviation="18" floodColor="#0f1e46" floodOpacity="0.34" />
          </filter>
        )}
      </defs>

      {/* orbit ring: back half */}
      <g transform="rotate(-32 256 256)">
        <ellipse
          cx="256" cy="256" rx="228" ry="132"
          fill="none" stroke={`url(#${p}-ring)`} strokeWidth="38" strokeLinecap="round"
        />
      </g>

      {/* keycap */}
      <g transform="rotate(-11 256 262)" filter={flat ? undefined : `url(#${p}-shadow)`}>
        <rect x="124" y="118" width="264" height="264" rx="62" fill={`url(#${p}-cap)`} />
        <rect x="124" y="118" width="264" height="264" rx="62" fill="none" stroke="#ffffff" strokeWidth="7" opacity="0.85" />
        <g transform="translate(159 152) scale(1.94)">
          <path d={K_PATH} fill={BRAND.ink} stroke={BRAND.ink} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      </g>

      {/* orbit ring: front sweep, drawn over the cap to weave the ring through */}
      <g transform="rotate(-32 256 256)">
        <path
          d="M 28 256 A 228 132 0 0 0 256 388 A 228 132 0 0 0 420 330"
          fill="none" stroke={`url(#${p}-ring2)`} strokeWidth="38" strokeLinecap="round"
        />
      </g>

      {/* spark */}
      <g transform="translate(352 34) scale(1.28)">
        <path d={SPARK_PATH} fill={`url(#${p}-spark)`} />
      </g>
    </svg>
  );
}
