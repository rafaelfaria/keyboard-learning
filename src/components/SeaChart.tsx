import { BlockAvatar } from './avatars';
import { PIXEL_PALS } from './gamekit';
import { ISLAND, curveThrough } from './IslandMap';
import { WORLDS } from '../lib/worlds';

/**
 * The zoomed-out archipelago (plan §3.2): five islands on the sea, the active
 * one bobbing with the boat beside it, done islands flying flags, future
 * islands as fog silhouettes — plus a W6 teaser in the far fog.
 */

export interface ChartWorldVM {
  id: string;
  unlocked: boolean;
  complete: boolean;
  active: boolean;
  done: number;
  total: number;
}

/** Island anchor points across the chart (viewBox 0 0 1000 420). */
const SPOTS: [number, number][] = [
  [140, 300], [350, 195], [555, 300], [755, 185], [900, 295],
];

export function SeaChart({ worlds, onOpen }: {
  worlds: ChartWorldVM[];
  onOpen: (id: string) => void;
}) {
  const route = curveThrough(SPOTS.slice(0, worlds.length));
  const activeIdx = Math.max(0, worlds.findIndex((w) => w.active));

  return (
    <div className="kw-map kw-chart" role="img" aria-label={`The sea chart: ${worlds.filter((w) => w.complete).length} of ${worlds.length} islands explored`}>
      <svg viewBox="0 0 1000 420">
        <defs>
          <linearGradient id="kwChartSea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a8def2" />
            <stop offset="100%" stopColor="#6fbfe0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="1000" height="420" fill="url(#kwChartSea)" rx="18" />
        {[[80, 90], [480, 60], [860, 80], [220, 390], [680, 396]].map(([x, y], i) => (
          <path key={i} d={`M ${x - 10},${y} Q ${x},${y - 7} ${x + 10},${y}`} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        ))}
        <g transform="translate(52 48)">
          <g className="kwm-sunrays"><circle r="26" fill="none" stroke="#ffd166" strokeWidth="3" strokeDasharray="4 10" /></g>
          <circle r="18" fill="#ffd166" stroke="#ffc23e" strokeWidth="2" />
        </g>

        {/* dotted sea routes between islands */}
        <path d={route} className="kw-chart-route" />

        {/* W6 teaser: fog on the horizon */}
        <g transform="translate(975 120)" opacity="0.5">
          <ellipse cx="0" cy="0" rx="46" ry="26" fill="#cfdde6" />
          <ellipse cx="-18" cy="10" rx="30" ry="18" fill="#dde8ef" />
          <text x="-4" y="6" textAnchor="middle" className="kw-chart-q">?</text>
        </g>

        {worlds.map((w, i) => {
          const def = WORLDS.find((d) => d.id === w.id) ?? WORLDS[0];
          const [x, y] = SPOTS[i % SPOTS.length];
          const pal = PIXEL_PALS[def.kid.guardian % PIXEL_PALS.length];
          return (
            <g
              key={w.id}
              transform={`translate(${x} ${y})`}
              className={`kw-chart-isle ${w.active ? 'kw-chart-active' : ''} ${w.unlocked ? '' : 'kw-chart-fog'}`}
              onClick={() => { if (w.unlocked) onOpen(w.id); }}
              role="button"
              tabIndex={w.unlocked ? 0 : -1}
              onKeyDown={(e) => { if (e.key === 'Enter' && w.unlocked) onOpen(w.id); }}
              aria-label={`${def.kid.kidName}: ${w.unlocked ? (w.complete ? 'explored!' : w.active ? `you are here: ${w.done} of ${w.total} spots done` : 'open') : 'still hidden in the fog'}`}
            >
              <ellipse cy="34" rx="66" ry="12" fill="rgba(20, 60, 90, 0.18)" />
              <g transform="scale(0.155) translate(-506 -300)">
                <path
                  d={ISLAND}
                  fill={w.unlocked ? def.kid.grass : '#b7c4cf'}
                  stroke={w.unlocked ? def.kid.sand : '#a3b2bf'}
                  strokeWidth="22"
                  strokeLinejoin="round"
                />
              </g>
              {w.unlocked ? (
                <>
                  {w.complete && (
                    <g transform="translate(30 -38)">
                      <rect x="-1.5" y="0" width="3" height="26" fill="#8a6a4a" />
                      <path d="M1.5,0 L18,5 L1.5,10 Z" fill="#ffd166" stroke="#e0a33a" strokeWidth="1" />
                    </g>
                  )}
                  <foreignObject x="-16" y="-52" width="32" height="34">
                    <div className="kw-guardian" title={`${pal.name} the ${pal.kind}`}><BlockAvatar preset={pal.preset} size={26} /></div>
                  </foreignObject>
                  <foreignObject x="-80" y="38" width="160" height="46">
                    <div className="kw-sign kw-chart-sign">
                      <span style={{ borderColor: w.active ? 'var(--accent)' : '#d9c9a8' }}>
                        {def.kid.kidName}
                        <small>{w.complete ? '★ explored' : `${w.done}/${w.total}`}</small>
                      </span>
                    </div>
                  </foreignObject>
                </>
              ) : (
                <text y="6" textAnchor="middle" className="kw-chart-q">?</text>
              )}
            </g>
          );
        })}

        {/* the boat waits beside the active island */}
        <g className="kw-chart-boat" transform={`translate(${SPOTS[activeIdx][0] - 92} ${SPOTS[activeIdx][1] + 26})`}>
          <path d="M-16,0 Q0,12 16,0 Z" fill="#d97b4f" />
          <rect x="-1" y="-19" width="2" height="19" fill="#7a5b3a" />
          <path d="M1,-18 L13,-5 L1,-5 Z" fill="#fff" />
        </g>
      </svg>
    </div>
  );
}
