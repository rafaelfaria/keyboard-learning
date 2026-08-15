import { memo, useMemo } from 'react';
import { buildLayout, makeCharLookup, FINGER_NAMES, type KeyInfo } from '../lib/keyboard';
import type { GuideStyle, LayoutId } from '../lib/types';

export interface KeyboardVisualProps {
  layout: LayoutId;
  nextChar?: string;
  lastPress?: { key: string; ok: boolean; t: number } | null;
  guide: GuideStyle;
  heat?: Record<string, { v: number; label: string }>;   // 0..1 per base char
  stateColors?: Record<string, string>;                   // mastery map colors per base char
  hiddenLabels?: Set<string> | 'all';
  compact?: boolean;
  onKeyClick?: (k: KeyInfo) => void;
}

export const KeyboardVisual = memo(function KeyboardVisual(p: KeyboardVisualProps) {
  const keys = useMemo(() => buildLayout(p.layout), [p.layout]);
  const lookup = useMemo(() => makeCharLookup(p.layout), [p.layout]);
  const next = p.nextChar !== undefined && p.nextChar !== '' ? lookup(p.nextChar) : null;
  const rows: KeyInfo[][] = useMemo(() => {
    const r: KeyInfo[][] = [[], [], [], [], []];
    keys.forEach((k) => r[k.row].push(k));
    return r;
  }, [keys]);

  const pressBase = p.lastPress ? lookup(p.lastPress.key)?.key?.code : null;

  return (
    <div className={`kbd ${p.compact ? 'kbd-compact' : ''} kbd-guide-${p.guide}`} aria-hidden="false" role="img" aria-label="On-screen keyboard guide">
      {rows.map((row, ri) => (
        <div className="kbd-row" key={ri}>
          {row.map((k) => {
            const isNext = next?.key?.code === k.code;
            const isShiftHint = next?.shift && ((k.code === 'shiftl' && next.hand === 'right') || (k.code === 'shiftr' && next.hand === 'left'));
            const pressed = pressBase === k.code && p.lastPress ? (p.lastPress.ok ? 'kp-ok' : 'kp-bad') : '';
            const heat = p.heat?.[k.base];
            const stateColor = p.stateColors?.[k.base];
            const hideLabel = p.hiddenLabels === 'all' || (p.hiddenLabels instanceof Set && p.hiddenLabels.has(k.base));
            const style: React.CSSProperties = { flexGrow: k.w, flexBasis: 0 };
            if (heat) style.background = `color-mix(in oklab, var(--heat-hi) ${Math.round(heat.v * 88)}%, var(--key-bg))`;
            if (stateColor) style.background = stateColor;
            return (
              <div
                key={k.code}
                data-code={k.code}
                className={[
                  'kbd-key',
                  k.control ? 'kbd-ctrl' : '',
                  p.guide === 'zones' && !k.control ? `fz${k.finger}` : '',
                  isNext ? 'kbd-next' : '',
                  isShiftHint ? 'kbd-next kbd-shift-hint' : '',
                  pressed,
                  k.code === 'space' ? 'kbd-space' : '',
                ].join(' ')}
                style={style}
                title={heat ? heat.label : k.control ? k.label : k.base ? `${k.label}: ${FINGER_NAMES[k.finger]}` : undefined}
                onClick={p.onKeyClick ? () => p.onKeyClick?.(k) : undefined}
                role={p.onKeyClick ? 'button' : undefined}
              >
                <span className="kbd-label">{hideLabel && !k.control ? '' : k.label}</span>
                {(k.code === 'r2-3' || k.code === 'r2-6') && <span className="kbd-bump" />}
              </div>
            );
          })}
        </div>
      ))}
      {next && next.finger >= 0 && (
        <div className="kbd-finger-hint" aria-live="polite">
          {next.shift ? 'Hold Shift + ' : ''}
          <strong>{p.nextChar === ' ' ? 'Space' : p.nextChar === '\n' ? 'Enter' : p.nextChar}</strong>
          {' · '}{FINGER_NAMES[next.finger]}
        </div>
      )}
    </div>
  );
});

// ---------- Hands ----------

const FINGER_GEO: { x: number; h: number; f: number }[] = [
  { x: 10, h: 34, f: 0 }, { x: 34, h: 46, f: 1 }, { x: 58, h: 54, f: 2 }, { x: 82, h: 48, f: 3 },
];

function Hand({ side, active, shiftActive }: { side: 'left' | 'right'; active: number; shiftActive: boolean }) {
  const fingers = side === 'left' ? FINGER_GEO : FINGER_GEO.map((g, i) => ({ ...g, x: 118 - g.x, f: 7 - g.f }));
  const thumbX = side === 'left' ? 112 : 16;
  return (
    <svg viewBox="0 0 128 120" className={`hand hand-${side}`} aria-hidden>
      <g className="hand-palm-g">
        <rect x="18" y="58" width="92" height="52" rx="24" className="hand-palm" />
        {fingers.map((g) => {
          const isActive = active === g.f || (shiftActive && ((side === 'left' && g.f === 0) || (side === 'right' && g.f === 7)));
          return (
            <g key={g.f} className={isActive ? 'finger-active' : ''}>
              <rect x={g.x} y={64 - g.h} width="18" height={g.h + 16} rx="9" className={`hand-finger hf${g.f}`} />
            </g>
          );
        })}
        <ellipse cx={thumbX} cy={92} rx="11" ry="17" className={`hand-finger hf8 ${active === 8 ? 'finger-active-el' : ''}`} transform={`rotate(${side === 'left' ? 24 : -24} ${thumbX} 92)`} />
      </g>
    </svg>
  );
}

export function HandsVisual({ layout, nextChar }: { layout: LayoutId; nextChar?: string }) {
  const lookup = useMemo(() => makeCharLookup(layout), [layout]);
  const n = nextChar ? lookup(nextChar) : null;
  const finger = n?.finger ?? -1;
  return (
    <div className="hands" aria-hidden>
      <Hand side="left" active={finger} shiftActive={!!n?.shift && n.hand === 'right'} />
      <Hand side="right" active={finger} shiftActive={!!n?.shift && n.hand === 'left'} />
    </div>
  );
}
