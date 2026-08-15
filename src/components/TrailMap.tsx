import { Ic } from './icons';
import { curveThrough } from './IslandMap';

/**
 * The expedition renderer for the grown-up journey (plan §4): one leg per
 * world, one waypoint per lesson, camps at stage boundaries. Drawn entirely
 * with theme variables so it belongs to every adult theme, dark or light.
 */

export interface TrailStopVM {
  id: string;
  label: string;
  stars: number;
  unlocked: boolean;
  campBefore: boolean;    // a stage boundary sits just before this waypoint
}

export function TrailMap({ stops, currentIdx, complete, onStop, onCamp }: {
  stops: TrailStopVM[];
  currentIdx: number;
  complete: boolean;
  onStop: (id: string, unlocked: boolean) => void;
  onCamp: () => void;
}) {
  const n = Math.max(2, stops.length);
  const nodes: [number, number][] = stops.map((_, i) => {
    const t = i / (n - 1);
    return [72 + t * 850, 348 - t * 262 + (i % 2 === 1 ? 30 : 0)];
  });
  const trailD = curveThrough(nodes);
  const doneCount = stops.filter((s) => s.stars >= 1).length;
  const doneD = curveThrough(nodes.slice(0, Math.max(1, Math.min(stops.length, doneCount + 1))));

  return (
    <div
      className="trail-map"
      role="img"
      aria-label={`Trail map: ${doneCount} of ${stops.length} waypoints cleared${complete ? ': leg complete' : `. You are at waypoint ${currentIdx + 1}`}`}
    >
      <svg viewBox="0 0 1000 420">
        {/* faint contours + the mountain massif */}
        <path d="M 0,395 C 220,360 420,380 620,340 C 780,308 900,320 1000,290 L 1000,420 L 0,420 Z" className="trail-massif" />
        <path d="M 560,420 C 680,300 780,220 880,120 C 920,80 950,70 1000,58 L 1000,420 Z" className="trail-massif trail-massif2" />
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M 0,${300 - i * 60} C 250,${280 - i * 66} 520,${310 - i * 58} 1000,${210 - i * 62}`}
            className="trail-contour"
          />
        ))}

        <path d={trailD} className="trail-path" />
        <path d={doneD} className="trail-path-done" />

        {/* camps at stage boundaries */}
        {stops.map((s, i) => {
          if (!s.campBefore || i === 0) return null;
          const [ax, ay] = nodes[i - 1];
          const [bx, by] = nodes[i];
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2 - 30;
          return (
            <g
              key={`camp-${i}`} transform={`translate(${mx} ${my})`} className="trail-camp"
              onClick={onCamp} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onCamp(); }}
              aria-label="Camp: optional checkpoint review"
            >
              <circle r="15" className="trail-camp-bg" />
              <foreignObject x="-9" y="-9" width="18" height="18">
                <div className="trail-camp-ic"><Ic n="tent" size={14} strokeWidth={2.4} /></div>
              </foreignObject>
              <text y="30" textAnchor="middle" className="trail-camp-label">camp</text>
            </g>
          );
        })}

        {/* summit flag */}
        <g transform={`translate(${nodes[n - 1][0] + 26} ${nodes[n - 1][1] - 40})`} className={complete ? 'trail-flag trail-flag-up' : 'trail-flag'}>
          <rect x="-1.5" y="0" width="3" height="34" rx="1.5" />
          <path d="M1.5,0 L22,6 L1.5,12 Z" />
        </g>

        {stops.map((s, i) => {
          const [x, y] = nodes[i];
          const cur = i === currentIdx && !complete;
          const done = s.stars >= 1;
          return (
            <g
              key={s.id}
              transform={`translate(${x} ${y})`}
              className={`trail-wp ${done ? 'trail-done' : cur ? 'trail-cur' : s.unlocked ? 'trail-open' : 'trail-locked'}`}
              onClick={() => onStop(s.id, s.unlocked)}
              role="button"
              tabIndex={s.unlocked ? 0 : -1}
              onKeyDown={(e) => { if (e.key === 'Enter') onStop(s.id, s.unlocked); }}
              aria-label={`Waypoint ${i + 1}: ${s.label}${done ? `: ${s.stars} star${s.stars > 1 ? 's' : ''}` : cur ? ': you are here' : s.unlocked ? '' : ': locked'}`}
            >
              {cur && <circle r="24" className="trail-pulse" />}
              <circle r={cur ? 17 : 14} className="trail-wp-bg" />
              {done ? (
                <text y="1" textAnchor="middle" dominantBaseline="central" className="trail-wp-stars">{s.stars >= 3 ? '★' : '✓'}</text>
              ) : (
                <text y="1" textAnchor="middle" dominantBaseline="central" className="trail-wp-num">{i + 1}</text>
              )}
              {(cur || (complete && i === n - 1)) && (
                <foreignObject x="-110" y="26" width="220" height="40">
                  <div className="trail-sign"><span>{complete ? 'Leg complete: flag planted' : s.label}</span></div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
