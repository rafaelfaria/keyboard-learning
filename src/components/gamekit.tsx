import { useEffect, useRef } from 'react';
import { Avatar, BlockAvatar, ANIMAL_START } from './avatars';

/**
 * Window-level key capture for games. Games previously relied on a hidden
 * <input> keeping focus — one stray click and typing silently died. This hook
 * listens on window, so the game hears keys no matter what has focus, while a
 * tiny companion input (MobileKeys) still summons the virtual keyboard on touch.
 */
export function useGameKeys(
  active: boolean,
  onChar: (ch: string) => void,
  opts?: { onEscape?: () => void; onBackspace?: () => void },
): void {
  const charRef = useRef(onChar);
  const escRef = useRef(opts?.onEscape);
  const bsRef = useRef(opts?.onBackspace);
  charRef.current = onChar;
  escRef.current = opts?.onEscape;
  bsRef.current = opts?.onBackspace;
  const lastHandled = useRef(0);

  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const isMobilePad = !!t?.classList?.contains('ghost-input');
      // let real form fields behave normally — but our own pad routes here
      if (t && !isMobilePad && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Escape') { escRef.current?.(); return; }
      if (e.key === 'Backspace') { bsRef.current?.(); e.preventDefault(); return; }
      if (e.key.length === 1) {
        lastHandled.current = performance.now();
        charRef.current(e.key);
        e.preventDefault();
      }
    };
    // input event fallback (mobile IMEs that don't emit useful keydown)
    const input = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (!t?.classList?.contains('ghost-input')) return;
      const v = t.value;
      t.value = '';
      if (performance.now() - lastHandled.current < 40) return;
      for (const ch of v) charRef.current(ch);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('input', input, true);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('input', input, true);
    };
  }, [active]);
}

/** Invisible input purely to summon the on-screen keyboard on touch devices. */
export function MobileKeys({ active }: { active: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (active && 'ontouchstart' in window) ref.current?.focus({ preventScroll: true });
  }, [active]);
  return (
    <input
      ref={ref} className="ghost-input" aria-hidden tabIndex={-1}
      autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
    />
  );
}

/** A little runner: block-avatar head on a body with animated legs. */
export function Runner({ av, preset, size = 40, running, benched, you }: {
  av?: string; preset?: number; size?: number; running?: boolean; benched?: boolean; you?: boolean;
}) {
  return (
    <span
      className={`runner ${running ? 'runner-go' : ''} ${benched ? 'runner-bench' : ''} ${you ? 'runner-you' : ''}`}
      style={{ width: size, height: size * 1.45 }}
    >
      <span className="runner-head">
        {av !== undefined ? <Avatar v={av} size={size * 0.72} /> : <BlockAvatar preset={preset ?? 0} size={size * 0.72} />}
      </span>
      <span className="runner-body" />
      <span className="runner-legs"><i className="leg-a" /><i className="leg-b" /></span>
    </span>
  );
}

/** Pixel cannon; barrel rotates to aim. angle 0 = straight up, +right/-left. */
export function Cannon({ angle = 0, firing }: { angle?: number; firing?: boolean }) {
  return (
    <span className={`cannon ${firing ? 'cannon-fire' : ''}`} aria-hidden>
      <svg viewBox="0 0 90 74" width="90" height="74">
        <g className="cannon-barrel" style={{ transform: `rotate(${Math.max(-62, Math.min(62, angle))}deg)` }}>
          <rect x="39" y="2" width="12" height="38" rx="5" fill="var(--text)" opacity="0.88" />
          <rect x="36" y="0" width="18" height="9" rx="4" fill="var(--accent)" />
        </g>
        <circle cx="45" cy="48" r="17" fill="var(--surface2)" stroke="var(--border)" strokeWidth="2.5" />
        <circle cx="45" cy="48" r="7" fill="var(--accent)" />
        <rect x="18" y="60" width="54" height="11" rx="5" fill="var(--surface2)" stroke="var(--border)" strokeWidth="2" />
      </svg>
    </span>
  );
}

/** Castle battlement (adult) / garden fence (kid) strip for Wordfall. */
export function CityWall({ kid }: { kid?: boolean }) {
  if (kid) {
    return (
      <svg viewBox="0 0 400 34" preserveAspectRatio="none" className="wf-wall" aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => (
          <rect key={i} x={i * 29 + 2} y="8" width="7" height="26" rx="2.5" fill="var(--surface2)" stroke="var(--border)" />
        ))}
        <rect x="0" y="6" width="400" height="5" rx="2.5" fill="var(--surface2)" stroke="var(--border)" />
        {Array.from({ length: 7 }).map((_, i) => (
          <circle key={`f${i}`} cx={i * 58 + 24} cy="6" r="4.5" fill={['#f2789f', '#ffd166', '#8b7cff'][i % 3]} />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 400 34" preserveAspectRatio="none" className="wf-wall" aria-hidden>
      <rect x="0" y="12" width="400" height="22" fill="var(--surface2)" stroke="var(--border)" />
      {Array.from({ length: 20 }).map((_, i) => (
        <rect key={i} x={i * 20 + 1.5} y="0" width="11" height="13" fill="var(--surface2)" stroke="var(--border)" />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={`w${i}`} x={i * 50 + 21} y="20" width="6" height="8" rx="2" fill="var(--gold)" opacity="0.8" />
      ))}
    </svg>
  );
}

/** Glider sprite: paper plane for grown-ups, flappy pixel bird for kids. */
export function Glider({ kid, turbulent }: { kid?: boolean; turbulent?: boolean }) {
  if (kid) {
    return (
      <span className={`bird ${turbulent ? 'bird-turb' : ''}`} aria-hidden>
        <svg viewBox="0 0 40 32" width="52" height="42" shapeRendering="crispEdges">
          <rect x="8" y="10" width="20" height="12" fill="#ffd166" />
          <rect x="24" y="6" width="10" height="10" fill="#ffd166" />
          <rect x="32" y="9" width="5" height="4" fill="#f0863a" />
          <rect x="27" y="8" width="3" height="3" fill="#1b2559" />
          <rect x="10" y="22" width="6" height="4" fill="#f0863a" />
          <rect x="18" y="22" width="6" height="4" fill="#f0863a" />
          <rect className="bird-wing" x="10" y="4" width="12" height="8" fill="#f9b24e" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`plane ${turbulent ? 'bird-turb' : ''}`} aria-hidden>
      <svg viewBox="0 0 48 34" width="54" height="40">
        <path d="M2 20 L46 4 L28 30 L22 20 Z" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M22 20 L46 4 L26 24 Z" fill="var(--accent)" opacity="0.35" />
      </svg>
    </span>
  );
}

/** Pixel racing car for The Lightstream. Wheels spin via --wheelspin. */
export function PixelCar({ color = '#14d8c4', you, ghost }: { color?: string; you?: boolean; ghost?: boolean }) {
  return (
    <span className={`pcar ${you ? 'pcar-you' : ''} ${ghost ? 'pcar-ghost' : ''}`} aria-hidden>
      <svg viewBox="0 0 64 30" width="58" height="27" shapeRendering="crispEdges">
        <rect x="4" y="12" width="56" height="10" rx="3" fill={color} />
        <rect x="18" y="4" width="24" height="10" rx="3" fill={color} />
        <rect x="22" y="6" width="8" height="6" fill="#dff3ff" opacity="0.9" />
        <rect x="33" y="6" width="7" height="6" fill="#dff3ff" opacity="0.75" />
        <rect x="58" y="14" width="5" height="4" fill="#ffe9a8" className="pcar-light" />
        <g className="pcar-wheel" style={{ transformOrigin: '16px 23px' }}>
          <circle cx="16" cy="23" r="6" fill="#141824" stroke="#3a4358" strokeWidth="2" />
          <rect x="15" y="18.5" width="2" height="9" fill="#8b93b8" />
        </g>
        <g className="pcar-wheel" style={{ transformOrigin: '46px 23px' }}>
          <circle cx="46" cy="23" r="6" fill="#141824" stroke="#3a4358" strokeWidth="2" />
          <rect x="45" y="18.5" width="2" height="9" fill="#8b93b8" />
        </g>
      </svg>
    </span>
  );
}

/** The four pixel pals — named animal friends who guard the kid world. */
export const PIXEL_PALS = [
  { name: 'Clementine', kind: 'cat', preset: ANIMAL_START },
  { name: 'Miso', kind: 'fox', preset: ANIMAL_START + 1 },
  { name: 'Pip', kind: 'frog', preset: ANIMAL_START + 2 },
  { name: 'Waffles', kind: 'panda', preset: ANIMAL_START + 3 },
];

/** Tiny decorative critter that floats/flutters. Purely ornamental. */
export function Critter({ kind, style }: { kind: 'butterfly' | 'bee' | 'snail'; style?: React.CSSProperties }) {
  if (kind === 'butterfly') {
    return (
      <span className="critter critter-fly" style={style} aria-hidden>
        <svg viewBox="0 0 20 14" width="22" height="16" shapeRendering="crispEdges">
          <rect className="cr-wing-l" x="1" y="2" width="7" height="8" rx="2" fill="#c99cf5" />
          <rect className="cr-wing-r" x="12" y="2" width="7" height="8" rx="2" fill="#ff8fa3" />
          <rect x="9" y="1" width="2" height="12" rx="1" fill="#3a3342" />
        </svg>
      </span>
    );
  }
  if (kind === 'bee') {
    return (
      <span className="critter critter-fly" style={style} aria-hidden>
        <svg viewBox="0 0 20 14" width="20" height="14" shapeRendering="crispEdges">
          <rect x="4" y="4" width="12" height="8" rx="4" fill="#ffd166" />
          <rect x="8" y="4" width="2" height="8" fill="#3a3342" />
          <rect x="12" y="4" width="2" height="8" fill="#3a3342" />
          <rect className="cr-wing-l" x="6" y="0" width="8" height="5" rx="2" fill="#dff3ff" opacity="0.85" />
        </svg>
      </span>
    );
  }
  return (
    <span className="critter" style={style} aria-hidden>
      <svg viewBox="0 0 22 14" width="22" height="14" shapeRendering="crispEdges">
        <circle cx="9" cy="8" r="6" fill="#7dd8a0" />
        <rect x="13" y="6" width="7" height="6" rx="3" fill="#f0a05a" />
        <rect x="18" y="2" width="2" height="4" fill="#f0a05a" />
      </svg>
    </span>
  );
}
