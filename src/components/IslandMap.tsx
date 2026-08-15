import { Avatar, BlockAvatar } from './avatars';
import { PIXEL_PALS } from './gamekit';
import { Ic } from './icons';
import { LAND_COLORS, type IslandSkin } from '../lib/worlds';

/**
 * The island renderer for the kid journey (plan §3). One island per world,
 * one stop per lesson. Geometry is shared across all five islands — the skin
 * (palette + decor + landmark) makes each feel like a different place.
 */

export interface StopVM {
  id: string;
  label: string;
  icon: string;
  stars: number;
  unlocked: boolean;
}

export const ISLAND =
  'M 45,392 C 34,332 78,286 138,272 C 205,257 268,264 335,250 C 402,236 455,238 520,228 ' +
  'C 585,218 640,220 700,202 C 755,186 800,172 842,148 C 872,130 892,96 926,90 ' +
  'C 958,86 972,132 968,196 C 982,276 968,338 938,384 C 898,428 802,442 700,440 ' +
  'C 560,450 420,448 300,441 C 185,436 66,438 45,392 Z';

/** Ten hand-placed positions from beach to summit; roads use an even subset. */
const MASTER_NODES: [number, number][] = [
  [90, 372], [210, 320], [330, 368], [450, 300], [565, 345],
  [665, 268], [775, 305], [850, 225], [895, 165], [935, 118],
];

export function pickNodes(n: number): [number, number][] {
  if (n <= 1) return [MASTER_NODES[9]];
  return Array.from({ length: n }, (_, i) => MASTER_NODES[Math.round((i * 9) / (n - 1))]);
}

export const curveThrough = (pts: [number, number][]) =>
  pts.map((p, i) => {
    if (i === 0) return `M ${p[0]},${p[1]}`;
    const [px, py] = pts[i - 1];
    const dx = (p[0] - px) * 0.45;
    return `C ${px + dx},${py} ${p[0] - dx},${p[1]} ${p[0]},${p[1]}`;
  }).join(' ');

const Tree = ({ x, y, s = 1, c = '#59b96b', cl = '#6cc77d', cd = '#4fae62' }: { x: number; y: number; s?: number; c?: string; cl?: string; cd?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-3.5" y="8" width="7" height="15" rx="2.5" fill="#a5713f" />
    <circle cx="-11" cy="6" r="10" fill={cl} />
    <circle cx="11" cy="6" r="10" fill={cd} />
    <circle cx="0" cy="-1" r="14" fill={c} />
  </g>
);

const Flower = ({ x, y, c }: { x: number; y: number; c: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="-1" y="0" width="2" height="9" fill="#5aa86c" />
    <circle cx="0" cy="-3" r="4.5" fill={c} />
    <circle cx="0" cy="-3" r="1.8" fill="#fff3c4" />
  </g>
);

const CloudPuff = ({ x, y, s = 1, slow, dim }: { x: number; y: number; s?: number; slow?: boolean; dim?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={dim ? 0.28 : 0.95}>
    <g className={`kwm-cloud ${slow ? 'kwm-cloud2' : ''}`}>
      <ellipse cx="0" cy="6" rx="30" ry="12" fill="#fff" />
      <circle cx="-12" cy="-2" r="12" fill="#fff" />
      <circle cx="6" cy="-6" r="14" fill="#fff" />
      <circle cx="20" cy="2" r="10" fill="#fff" />
    </g>
  </g>
);

const Crystal = ({ x, y, s = 1, c = '#9be8ff' }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} className="kwm-crystal">
    <polygon points="0,-22 8,-6 5,2 -5,2 -8,-6" fill={c} opacity="0.9" />
    <polygon points="0,-22 3,-6 0,2 -5,2 -8,-6" fill="#ffffff" opacity="0.35" />
  </g>
);

const Lantern = ({ x, y, delay = 0 }: { x: number; y: number; delay?: number }) => (
  <g transform={`translate(${x} ${y})`} className="kwm-lantern" style={{ animationDelay: `${delay}s` }}>
    <rect x="-4" y="0" width="8" height="10" rx="2.5" fill="#ffd166" stroke="#e0a33a" strokeWidth="1.5" />
    <rect x="-1.5" y="-4" width="3" height="4" fill="#8a6a4a" />
  </g>
);

const Boat = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-13,0 Q0,10 13,0 Z" fill="#d97b4f" />
    <rect x="-1" y="-16" width="2" height="16" fill="#7a5b3a" />
    <path d="M1,-15 L11,-4 L1,-4 Z" fill="#fff" />
  </g>
);

// ---------- landmarks: the finale of each island ----------

function Landmark({ kind }: { kind: IslandSkin['decor'] }) {
  switch (kind) {
    case 'meadow': // The Great Oak
      return (
        <g transform="translate(933 84)">
          <rect x="-6" y="14" width="12" height="24" rx="4" fill="#8a5a33" />
          <circle cx="-16" cy="8" r="15" fill="#4fae62" />
          <circle cx="16" cy="8" r="15" fill="#6cc77d" />
          <circle cx="0" cy="-6" r="19" fill="#59b96b" />
          <circle cx="-6" cy="-8" r="3" fill="#ff8fa3" />
          <circle cx="9" cy="0" r="3" fill="#ffd166" />
        </g>
      );
    case 'forest': // The Canopy Bridge
      return (
        <g transform="translate(930 88)">
          <rect x="-34" y="6" width="8" height="34" rx="3" fill="#7a5b3a" />
          <rect x="26" y="6" width="8" height="34" rx="3" fill="#7a5b3a" />
          <path d="M-30,12 Q0,28 30,12" fill="none" stroke="#c9a76a" strokeWidth="5" strokeLinecap="round" />
          <path d="M-30,8 Q0,22 30,8" fill="none" stroke="#8a6a4a" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="-30" cy="2" r="12" fill="#3f8a4f" />
          <circle cx="30" cy="2" r="12" fill="#4fae62" />
        </g>
      );
    case 'harbor': // The Lighthouse
      return (
        <g transform="translate(933 82)">
          <path d="M-10,44 L-6,0 L6,0 L10,44 Z" fill="#f2f2f2" stroke="#d0c4b0" strokeWidth="1.5" />
          <path d="M-9,32 L9,32 L10,40 L-10,40 Z" fill="#e0526f" />
          <path d="M-8,12 L8,12 L8.8,20 L-8.8,20 Z" fill="#e0526f" />
          <rect x="-7" y="-10" width="14" height="10" rx="2" fill="#3a3342" />
          <circle cx="0" cy="-5" r="4" fill="#ffd166" className="kwm-beacon" />
          <path d="M-12,-14 L12,-14 L0,-24 Z" fill="#e0526f" />
        </g>
      );
    case 'cavern': // The Geode Gate
      return (
        <g transform="translate(933 86)">
          <path d="M-24,40 Q-24,-8 0,-14 Q24,-8 24,40 L14,40 Q14,0 0,-2 Q-14,0 -14,40 Z" fill="#5d5484" stroke="#7a70a8" strokeWidth="2" />
          <Crystal x={-20} y={-2} s={0.8} c="#c9a6ff" />
          <Crystal x={20} y={-2} s={0.8} c="#9be8ff" />
          <Crystal x={0} y={-16} s={0.9} c="#ffb9e8" />
        </g>
      );
    case 'sky': // The Cloud Castle
      return (
        <g transform="translate(930 80)">
          <rect x="-26" y="-2" width="52" height="32" rx="3" fill="#f3eef9" stroke="#c9b8e6" strokeWidth="2" />
          <rect x="-33" y="-16" width="15" height="48" rx="3" fill="#faf6ff" stroke="#c9b8e6" strokeWidth="2" />
          <rect x="18" y="-16" width="15" height="48" rx="3" fill="#faf6ff" stroke="#c9b8e6" strokeWidth="2" />
          <rect x="-8" y="-26" width="16" height="58" rx="3" fill="#faf6ff" stroke="#c9b8e6" strokeWidth="2" />
          <path d="M0 -40 L0 -26" stroke="#8a76ad" strokeWidth="2" />
          <path d="M0,-40 L15,-35 L0,-30 Z" fill="#ff8fa3" />
          <rect x="-5" y="16" width="10" height="14" rx="5" fill="#8a76ad" />
          <ellipse cx="0" cy="36" rx="42" ry="8" fill="#ffffff" opacity="0.8" />
        </g>
      );
  }
}

// ---------- per-terrain scenery ----------

function Scenery({ kind }: { kind: IslandSkin['decor'] }) {
  if (kind === 'forest') {
    return (
      <g aria-hidden>
        <Tree x={140} y={300} s={1.1} c="#3f8a4f" cl="#54a463" cd="#357844" />
        <Tree x={250} y={260} s={0.9} c="#3f8a4f" cl="#54a463" cd="#357844" />
        <Tree x={315} y={412} c="#468f55" cl="#5aa869" cd="#3a7d49" />
        <Tree x={430} y={246} s={0.85} c="#3f8a4f" cl="#54a463" cd="#357844" />
        <Tree x={520} y={400} s={1.1} c="#468f55" cl="#5aa869" cd="#3a7d49" />
        <Tree x={620} y={390} s={0.8} c="#3f8a4f" cl="#54a463" cd="#357844" />
        <Tree x={748} y={378} s={1.05} c="#468f55" cl="#5aa869" cd="#3a7d49" />
        <Tree x={95} y={300} s={0.7} c="#3f8a4f" cl="#54a463" cd="#357844" />
        <g transform="translate(368 320)">
          <rect x="-3" y="0" width="6" height="7" rx="2" fill="#fff3dd" />
          <path d="M-8,1 Q0,-10 8,1 Z" fill="#c9724f" />
          <circle cx="-3" cy="-3" r="1.5" fill="#fff" />
        </g>
        <g transform="translate(590 300)">
          <rect x="-3" y="0" width="6" height="7" rx="2" fill="#fff3dd" />
          <path d="M-8,1 Q0,-10 8,1 Z" fill="#a05ac9" />
          <circle cx="2" cy="-3" r="1.5" fill="#fff" />
        </g>
        {[[200, 350], [480, 330], [700, 340], [830, 290]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="#ffe9a8" className="kwm-firefly" style={{ animationDelay: `${i * 0.9}s` }} />
        ))}
      </g>
    );
  }
  if (kind === 'harbor') {
    return (
      <g aria-hidden>
        <circle cx="880" cy="52" r="20" fill="#ffb26b" opacity="0.9" />
        <Boat x={70} y={410} s={1.2} />
        <Boat x={200} y={430} s={0.9} />
        <g>
          <rect x="290" y="360" width="7" height="26" rx="2" fill="#8a6a4a" />
          <rect x="470" y="330" width="7" height="26" rx="2" fill="#8a6a4a" />
          <path d="M 294,362 Q 384,392 474,332" fill="none" stroke="#8a6a4a" strokeWidth="2" />
          <Lantern x={330} y={374} delay={0} />
          <Lantern x={384} y={384} delay={0.5} />
          <Lantern x={438} y={358} delay={1} />
        </g>
        <g transform="translate(600 396)">
          <rect x="-10" y="-10" width="20" height="20" rx="2" fill="#c9a76a" stroke="#a5814a" strokeWidth="1.5" />
          <rect x="12" y="-6" width="16" height="16" rx="2" fill="#d9b988" stroke="#a5814a" strokeWidth="1.5" />
        </g>
        <Tree x={730} y={380} s={0.9} c="#7dbf6a" cl="#92cf7d" cd="#68a857" />
        <Flower x={160} y={330} c="#ff8fa3" />
        <Flower x={540} y={280} c="#ffd166" />
      </g>
    );
  }
  if (kind === 'cavern') {
    return (
      <g aria-hidden>
        {[[120, 0], [310, 0], [520, 0], [760, 0], [930, 0]].map(([x], i) => (
          <polygon key={i} points={`${x},0 ${x + 26},0 ${x + 13},${34 + (i % 3) * 14}`} fill="#3d3760" />
        ))}
        <Crystal x={150} y={330} c="#9be8ff" />
        <Crystal x={260} y={280} s={0.7} c="#c9a6ff" />
        <Crystal x={420} y={340} s={1.2} c="#ffb9e8" />
        <Crystal x={560} y={280} s={0.8} c="#9be8ff" />
        <Crystal x={700} y={350} c="#c9a6ff" />
        <Crystal x={820} y={280} s={0.7} c="#9be8ff" />
        {[[220, 320], [500, 300], [740, 320], [870, 250]].map(([x, y], i) => (
          <circle key={`g${i}`} cx={x} cy={y} r="2.5" fill="#b9f2ff" className="kwm-firefly" style={{ animationDelay: `${i * 1.1}s` }} />
        ))}
        <g transform="translate(80 60)">
          <circle r="18" fill="#d9d2f2" opacity="0.9" />
          <circle r="18" fill="none" stroke="#a598cc" strokeWidth="2" />
          <circle cx="-6" cy="-4" r="4" fill="#a598cc" opacity="0.5" />
        </g>
      </g>
    );
  }
  if (kind === 'sky') {
    return (
      <g aria-hidden>
        <path d="M 120,180 A 320,320 0 0 1 700,120" fill="none" strokeWidth="10" stroke="#ff8fa3" opacity="0.5" />
        <path d="M 126,192 A 316,316 0 0 1 694,132" fill="none" strokeWidth="10" stroke="#ffd166" opacity="0.5" />
        <path d="M 132,204 A 312,312 0 0 1 688,144" fill="none" strokeWidth="10" stroke="#7dd8a0" opacity="0.5" />
        <ellipse cx="180" cy="430" rx="90" ry="20" fill="#ffffff" opacity="0.9" />
        <ellipse cx="520" cy="446" rx="120" ry="22" fill="#ffffff" opacity="0.85" />
        <ellipse cx="840" cy="426" rx="80" ry="18" fill="#ffffff" opacity="0.9" />
        <Tree x={200} y={330} s={0.9} c="#7dd8a0" cl="#95e2b2" cd="#66c489" />
        <Tree x={620} y={380} s={0.8} c="#7dd8a0" cl="#95e2b2" cd="#66c489" />
        <Flower x={340} y={330} c="#ff8fa3" />
        <Flower x={500} y={300} c="#c99cf5" />
        <Flower x={720} y={330} c="#ffd166" />
        <g className="kwm-bird" transform="translate(300 120)"><path d="M-8,0 Q-4,-6 0,0 Q4,-6 8,0" fill="none" stroke="#5c7a99" strokeWidth="2.5" strokeLinecap="round" /></g>
        <g className="kwm-bird" style={{ animationDelay: '1.4s' }} transform="translate(560 90)"><path d="M-8,0 Q-4,-6 0,0 Q4,-6 8,0" fill="none" stroke="#5c7a99" strokeWidth="2.5" strokeLinecap="round" /></g>
      </g>
    );
  }
  // meadow — the original island's scenery
  return (
    <g aria-hidden>
      <ellipse cx="540" cy="404" rx="52" ry="16" fill="#8fd0f0" stroke="#6db6dd" strokeWidth="2.5" />
      <path d="M 512,398 Q 520,394 528,398" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <g transform="translate(592 388)">
        <rect x="-1" y="0" width="2" height="14" fill="#5aa86c" />
        <rect x="-3" y="-8" width="6" height="10" rx="3" fill="#a5713f" />
      </g>
      <polygon points="802,208 838,138 874,208" fill="#c2ab8b" />
      <polygon points="826,162 838,138 850,162" fill="#fff" />
      <Tree x={150} y={296} />
      <Tree x={315} y={412} s={0.85} />
      <Tree x={430} y={246} s={0.8} />
      <Tree x={748} y={378} />
      <Tree x={655} y={412} s={0.85} />
      <Tree x={95} y={300} s={0.75} />
      <Flower x={200} y={398} c="#ff8fa3" />
      <Flower x={395} y={302} c="#ffd166" />
      <Flower x={560} y={262} c="#c99cf5" />
      <Flower x={838} y={368} c="#ff8fa3" />
      <Flower x={128} y={336} c="#5fc9e0" />
      <g transform="translate(368 320)">
        <rect x="-3" y="0" width="6" height="7" rx="2" fill="#fff3dd" />
        <path d="M-8,1 Q0,-10 8,1 Z" fill="#ff6b6b" />
        <circle cx="-3" cy="-3" r="1.5" fill="#fff" />
        <circle cx="3" cy="-4" r="1.5" fill="#fff" />
      </g>
      <ellipse cx="585" cy="302" rx="9" ry="6" fill="#c9c2ae" />
      <ellipse cx="872" cy="306" rx="7" ry="5" fill="#c9c2ae" />
    </g>
  );
}

// ---------- the map ----------

export function IslandMap({ skin, worldId, stops, currentIdx, youAvatar, complete, onStop }: {
  skin: IslandSkin;
  worldId: string;
  stops: StopVM[];
  currentIdx: number;
  youAvatar: string;
  complete: boolean;
  onStop: (id: string, unlocked: boolean) => void;
}) {
  const nodes = pickNodes(stops.length);
  const roadD = curveThrough(nodes);
  const doneCount = stops.filter((s) => s.stars >= 1).length;
  const doneD = curveThrough(nodes.slice(0, Math.max(1, Math.min(stops.length, doneCount + 1))));
  const pal = PIXEL_PALS[skin.guardian % PIXEL_PALS.length];
  const cavern = skin.decor === 'cavern';
  const order = stops.map((_, i) => i).sort((a, b) => (a === currentIdx ? 1 : 0) - (b === currentIdx ? 1 : 0));

  return (
    <div
      className="kw-map"
      role="img"
      aria-label={`${skin.kidName}: ${doneCount} of ${stops.length} spots explored${complete ? ': island complete!' : `. You are at spot ${currentIdx + 1}`}`}
    >
      <svg viewBox="0 0 1000 460">
        <defs>
          <linearGradient id={`kwSky-${worldId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skin.sky[0]} />
            <stop offset="100%" stopColor={skin.sky[1]} />
          </linearGradient>
          <linearGradient id={`kwSea-${worldId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skin.sea[0]} />
            <stop offset="100%" stopColor={skin.sea[1]} />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="1000" height="170" fill={`url(#kwSky-${worldId})`} />
        {!cavern && (
          <g transform="translate(64 56)">
            <g className="kwm-sunrays"><circle r="34" fill="none" stroke={skin.decor === 'harbor' ? '#ffb26b' : '#ffd166'} strokeWidth="3.5" strokeDasharray="5 11" /></g>
            <circle r="24" fill={skin.decor === 'harbor' ? '#ffb26b' : '#ffd166'} stroke="#ffc23e" strokeWidth="2" />
          </g>
        )}
        <CloudPuff x={210} y={52} dim={cavern} />
        <CloudPuff x={490} y={36} s={0.8} slow dim={cavern} />
        <CloudPuff x={760} y={64} s={0.65} dim={cavern} />

        <rect x="0" y="150" width="1000" height="310" fill={`url(#kwSea-${worldId})`} />
        {skin.decor !== 'sky' && [[24, 300], [980, 240], [946, 448], [180, 452]].map(([wx, wy], i) => (
          <path key={i} d={`M ${wx - 9},${wy} Q ${wx},${wy - 6} ${wx + 9},${wy}`} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity={cavern ? 0.3 : 0.8} />
        ))}
        {skin.decor === 'meadow' && <Boat x={24} y={244} />}

        <path d={ISLAND} fill={skin.grass} stroke={skin.sand} strokeWidth="16" strokeLinejoin="round" />
        <ellipse cx="220" cy="360" rx="70" ry="22" fill={skin.grassLight} opacity="0.7" />
        <ellipse cx="520" cy="300" rx="90" ry="26" fill={skin.grassLight} opacity="0.7" />
        <ellipse cx="780" cy="345" rx="70" ry="22" fill={skin.grassLight} opacity="0.7" />
        <ellipse cx="885" cy="185" rx="52" ry="18" fill={skin.grassLight} opacity="0.6" />

        <Scenery kind={skin.decor} />
        <g className={complete ? 'kwm-landmark-lit' : ''}><Landmark kind={skin.decor} /></g>
        {complete && (
          <g transform="translate(960 96)">
            <rect x="-1.5" y="-30" width="3" height="30" fill="#8a6a4a" />
            <path d="M1.5,-30 L20,-24 L1.5,-18 Z" fill="#ffd166" stroke="#e0a33a" strokeWidth="1" />
          </g>
        )}

        <path d={roadD} className="kwm-road" style={{ stroke: skin.road }} />
        <path d={roadD} className="kwm-road-dots" />
        <path d={doneD} className="kwm-road-done" />

        {order.map((i) => {
          const stop = stops[i];
          const [x, y] = nodes[i];
          const cur = i === currentIdx && !complete;
          const done = stop.stars >= 1;
          const c = LAND_COLORS[i % LAND_COLORS.length];
          const showAvatar = cur || (complete && i === stops.length - 1);
          return (
            <g
              key={stop.id}
              transform={`translate(${x}, ${y})`}
              className={`kw-node ${done ? 'kw-done' : cur ? 'kw-cur' : stop.unlocked ? 'kw-open' : 'kw-locked'}`}
              onClick={() => onStop(stop.id, stop.unlocked)}
              role="button"
              tabIndex={stop.unlocked ? 0 : -1}
              onKeyDown={(e) => { if (e.key === 'Enter') onStop(stop.id, stop.unlocked); }}
              aria-label={`Spot ${i + 1}: ${stop.label}${done ? `: ${stop.stars} star${stop.stars > 1 ? 's' : ''}` : cur ? ': you are here' : stop.unlocked ? '' : ': still locked'}`}
            >
              <ellipse cy={stop.unlocked ? 30 : 21} rx={stop.unlocked ? 24 : 15} ry="6" fill="rgba(58, 51, 40, 0.14)" />
              {cur && <circle r="38" className="kw-pulse" style={{ stroke: c }} />}
              {stop.unlocked ? (
                <>
                  <circle r="30" className="kw-node-bg" style={{ fill: `color-mix(in oklab, ${c} ${done ? 46 : 30}%, #fffdf6)`, stroke: c }} />
                  <foreignObject x="-14" y="-14" width="28" height="28">
                    <div className="kw-node-ic" style={{ color: `color-mix(in oklab, ${c} 60%, #3a3342)` }}>
                      <Ic n={stop.icon} size={22} strokeWidth={2.4} />
                    </div>
                  </foreignObject>
                  <circle cx="-22" cy="-22" r="10.5" fill={c} stroke="#fffdf6" strokeWidth="2.5" />
                  <text x="-22" y="-21.5" textAnchor="middle" dominantBaseline="central" className="kw-num">{i + 1}</text>
                  {done && <text x="23" y="-19" textAnchor="middle" dominantBaseline="central" className={`kw-star ${stop.stars >= 3 ? 'kw-star3' : ''}`}>{stop.stars >= 3 ? '★★★' : '★'}</text>}
                </>
              ) : (
                <>
                  <circle r="19" className="kw-node-locked" />
                  <text y="0.5" textAnchor="middle" dominantBaseline="central" className="kw-num-locked">{i + 1}</text>
                </>
              )}
              {showAvatar && (
                <>
                  <foreignObject x="-19" y="-66" width="38" height="40">
                    <div className="kw-you" title="You are here!"><Avatar v={youAvatar} size={34} /></div>
                  </foreignObject>
                  {/* the guardian pal: clearly smaller and at your side on the
                      ground, so it reads as a companion — not a second explorer */}
                  <ellipse cx="42" cy="27" rx="12" ry="4" fill="rgba(58, 51, 40, 0.12)" />
                  <foreignObject x="30" y="-4" width="26" height="30">
                    <div className="kw-guardian kw-guardian-bob" style={{ animationDelay: '-0.7s' }} title={`${pal.name} the ${pal.kind}`}>
                      <BlockAvatar preset={pal.preset} size={21} />
                    </div>
                  </foreignObject>
                  <foreignObject x="-90" y="40" width="180" height="38">
                    <div className="kw-sign"><span style={{ borderColor: c }}>{complete ? `${skin.kidName}: explored!` : stop.label}</span></div>
                  </foreignObject>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
