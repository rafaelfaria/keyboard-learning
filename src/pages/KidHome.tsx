import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import { useData, useStore, useUi, currentStreak, levelInfo } from '../lib/store';
import { buildStages, curriculumProgress, nextLesson, stageUnlocked } from '../lib/curriculum';
import { dailyChallenge } from '../lib/challenge';
import { dashboardTip } from '../lib/coach';
import { Btn, Card, Chip } from '../components/ui';
import { CoachCard } from '../components/ResultsPanel';
import { Avatar, BlockAvatar } from '../components/avatars';
import { Critter, PIXEL_PALS } from '../components/gamekit';
import { Ic } from '../components/icons';
import { BADGES } from '../lib/badges';

// Each land gets its own bright colour on the kid map.
const LAND_COLORS = ['#ff8fa3', '#ffb26b', '#ffd166', '#7dd8a0', '#5fc9e0', '#8b9cf5', '#c99cf5', '#f59cd8', '#66d9c2'];

// Stops along the island road, base camp beach up to the castle summit (viewBox 0 0 1000 460)
const NODES: [number, number][] = [
  [90, 372], [225, 318], [355, 368], [480, 296], [610, 348],
  [700, 252], [815, 298], [870, 208], [925, 138],
];

// Gentle S-curves through the stops, so the road winds like a storybook trail
const curveThrough = (pts: [number, number][]) =>
  pts.map((p, i) => {
    if (i === 0) return `M ${p[0]},${p[1]}`;
    const [px, py] = pts[i - 1];
    const dx = (p[0] - px) * 0.45;
    return `C ${px + dx},${py} ${p[0] - dx},${p[1]} ${p[0]},${p[1]}`;
  }).join(' ');

const ISLAND =
  'M 45,392 C 34,332 78,286 138,272 C 205,257 268,264 335,250 C 402,236 455,238 520,228 ' +
  'C 585,218 640,220 700,202 C 755,186 800,172 842,148 C 872,130 892,96 926,90 ' +
  'C 958,86 972,132 968,196 C 982,276 968,338 938,384 C 898,428 802,442 700,440 ' +
  'C 560,450 420,448 300,441 C 185,436 66,438 45,392 Z';

const Tree = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-3.5" y="8" width="7" height="15" rx="2.5" fill="#a5713f" />
    <circle cx="-11" cy="6" r="10" fill="#6cc77d" />
    <circle cx="11" cy="6" r="10" fill="#4fae62" />
    <circle cx="0" cy="-1" r="14" fill="#59b96b" />
  </g>
);

const Flower = ({ x, y, c }: { x: number; y: number; c: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="-1" y="0" width="2" height="9" fill="#5aa86c" />
    <circle cx="0" cy="-3" r="4.5" fill={c} />
    <circle cx="0" cy="-3" r="1.8" fill="#fff3c4" />
  </g>
);

const CloudPuff = ({ x, y, s = 1, slow }: { x: number; y: number; s?: number; slow?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity="0.95">
    <g className={`kwm-cloud ${slow ? 'kwm-cloud2' : ''}`}>
      <ellipse cx="0" cy="6" rx="30" ry="12" fill="#fff" />
      <circle cx="-12" cy="-2" r="12" fill="#fff" />
      <circle cx="6" cy="-6" r="14" fill="#fff" />
      <circle cx="20" cy="2" r="10" fill="#fff" />
    </g>
  </g>
);

export function HomeGate() {
  const data = useData();
  if (data && data.profile.ageGroup === 'kid' && data.settings.kidWorld !== false) return <KidHome />;
  return <Dashboard />;
}

export default function KidHome() {
  const data = useData();
  const nav = useNavigate();
  const patch = useStore((s) => s.patch);
  const celebrate = useUi((s) => s.celebrate);
  if (!data) return null;

  const stages = useMemo(() => buildStages(data.profile.layout), [data.profile.layout]);
  const prog = curriculumProgress(data);
  const nextL = nextLesson(data);
  const streak = currentStreak(data);
  const lvl = levelInfo(data.xp);
  const stickers = Object.keys(data.badges).length;
  const daily = dailyChallenge('kid');
  const dailyDone = !!data.daily[daily.key];
  const tip = useMemo(() => dashboardTip(data), [data.sessions.length]);

  const stageState = stages.map((st) => {
    const done = st.lessons.every((l) => (data.lessons[l.id]?.stars ?? 0) >= 1);
    const unlocked = stageUnlocked(data, data.profile.layout, st.id);
    return { st, done, unlocked };
  });
  const currentIdx = Math.max(0, stageState.findIndex((s) => s.unlocked && !s.done));
  const readyToGraduate = prog.done >= Math.floor(prog.total * 0.5) || lvl.level >= 8;

  const roadD = curveThrough(NODES);
  const doneCount = stageState.filter((s) => s.done).length;
  const doneD = curveThrough(NODES.slice(0, Math.max(1, doneCount + 1)));
  const goNode = (i: number, unlocked: boolean) => {
    if (!unlocked) return;
    if (i === currentIdx && nextL) nav(`/app/lesson/${nextL.id}`);
    else nav('/app/learn');
  };

  return (
    <div className="kidworld">
      <div className="kw-head">
        <Avatar v={data.profile.avatar} size={62} className="kw-avatar" />
        <div>
          <h1>Hi, {data.profile.name}!</h1>
          <p className="muted">Level {lvl.level} explorer · {prog.stars} stars collected</p>
        </div>
        <div className="kw-chips">
          <span className="kw-chip"><Ic n="flame" size={17} /> {streak} day{streak === 1 ? '' : 's'}</span>
          <span className="kw-chip"><Ic n="medal" size={17} /> {stickers} stickers</span>
        </div>
      </div>

      <Card className="kw-map-card">
        <div className="row spread wrap gap">
          <h2>Your world</h2>
          <Chip tone="accent">{doneCount} of {stages.length} lands explored</Chip>
        </div>
        <div className="kw-map" role="img" aria-label={`World map: ${doneCount} of ${stages.length} lands explored. You are at stop ${currentIdx + 1}, ${stages[currentIdx].region}`}>
          <svg viewBox="0 0 1000 460">
            <defs>
              <linearGradient id="kwSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#aee3f7" />
                <stop offset="100%" stopColor="#d9f2fb" />
              </linearGradient>
              <linearGradient id="kwSea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9edbf2" />
                <stop offset="100%" stopColor="#7fc9e8" />
              </linearGradient>
            </defs>

            {/* sky, sun and clouds */}
            <rect x="0" y="0" width="1000" height="170" fill="url(#kwSky)" />
            <g transform="translate(64 56)">
              <g className="kwm-sunrays"><circle r="34" fill="none" stroke="#ffd166" strokeWidth="3.5" strokeDasharray="5 11" /></g>
              <circle r="24" fill="#ffd166" stroke="#ffc23e" strokeWidth="2" />
            </g>
            <CloudPuff x={210} y={52} />
            <CloudPuff x={490} y={36} s={0.8} slow />
            <CloudPuff x={760} y={64} s={0.65} />

            {/* sea with little waves and a boat */}
            <rect x="0" y="150" width="1000" height="310" fill="url(#kwSea)" />
            {[[24, 300], [980, 240], [946, 448], [180, 452]].map(([wx, wy], i) => (
              <path key={i} d={`M ${wx - 9},${wy} Q ${wx},${wy - 6} ${wx + 9},${wy}`} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
            ))}
            <g transform="translate(24 244)">
              <path d="M-13,0 Q0,10 13,0 Z" fill="#d97b4f" />
              <rect x="-1" y="-16" width="2" height="16" fill="#7a5b3a" />
              <path d="M1,-15 L11,-4 L1,-4 Z" fill="#fff" />
            </g>

            {/* the island: sandy rim, grass, light meadows */}
            <path d={ISLAND} fill="#97d67f" stroke="#eddc9e" strokeWidth="16" strokeLinejoin="round" />
            <ellipse cx="220" cy="360" rx="70" ry="22" fill="#b1e39b" opacity="0.7" />
            <ellipse cx="520" cy="300" rx="90" ry="26" fill="#b1e39b" opacity="0.7" />
            <ellipse cx="780" cy="345" rx="70" ry="22" fill="#b1e39b" opacity="0.7" />
            <ellipse cx="885" cy="185" rx="52" ry="18" fill="#b1e39b" opacity="0.6" />

            {/* scenery */}
            <g aria-hidden>
              <ellipse cx="540" cy="404" rx="52" ry="16" fill="#8fd0f0" stroke="#6db6dd" strokeWidth="2.5" />
              <path d="M 512,398 Q 520,394 528,398" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
              <g transform="translate(592 388)">
                <rect x="-1" y="0" width="2" height="14" fill="#5aa86c" />
                <rect x="-3" y="-8" width="6" height="10" rx="3" fill="#a5713f" />
              </g>
              <polygon points="802,208 838,138 874,208" fill="#c2ab8b" />
              <polygon points="826,162 838,138 850,162" fill="#fff" />
              <g transform="translate(926 96)">
                <rect x="-24" y="-6" width="48" height="30" rx="3" fill="#e9e2f2" stroke="#b9a8d6" strokeWidth="2" />
                <rect x="-30" y="-18" width="14" height="42" rx="3" fill="#f3eef9" stroke="#b9a8d6" strokeWidth="2" />
                <rect x="16" y="-18" width="14" height="42" rx="3" fill="#f3eef9" stroke="#b9a8d6" strokeWidth="2" />
                <rect x="-7" y="-26" width="14" height="50" rx="3" fill="#f3eef9" stroke="#b9a8d6" strokeWidth="2" />
                <path d="M0 -40 L0 -26" stroke="#8a76ad" strokeWidth="2" />
                <path d="M0,-40 L14,-35 L0,-30 Z" fill="#ff8fa3" />
                <rect x="-5" y="10" width="10" height="14" rx="5" fill="#8a76ad" />
              </g>
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

            {/* the road: dirt trail with stepping stones; travelled part glows */}
            <path d={roadD} className="kwm-road" />
            <path d={roadD} className="kwm-road-dots" />
            <path d={doneD} className="kwm-road-done" />

            {/* stops (current rendered last so its sign and avatar sit on top) */}
            {stageState.map((_, idx) => idx).sort((a, b) => (a === currentIdx ? 1 : 0) - (b === currentIdx ? 1 : 0)).map((i) => {
              const { st, done, unlocked } = stageState[i];
              const [x, y] = NODES[i];
              const cur = i === currentIdx;
              const c = LAND_COLORS[i % LAND_COLORS.length];
              const pal = PIXEL_PALS[i % PIXEL_PALS.length];
              return (
                <g
                  key={st.id}
                  transform={`translate(${x}, ${y})`}
                  className={`kw-node ${done ? 'kw-done' : cur ? 'kw-cur' : unlocked ? 'kw-open' : 'kw-locked'}`}
                  onClick={() => goNode(i, unlocked)}
                  role="button"
                  tabIndex={unlocked ? 0 : -1}
                  onKeyDown={(e) => { if (e.key === 'Enter') goNode(i, unlocked); }}
                  aria-label={`Stop ${i + 1}: ${st.region}${done ? ' — explored' : cur ? ' — you are here' : unlocked ? '' : ' — still locked'}`}
                >
                  <ellipse cy={unlocked ? 30 : 21} rx={unlocked ? 24 : 15} ry="6" fill="rgba(58, 51, 40, 0.14)" />
                  {cur && <circle r="38" className="kw-pulse" style={{ stroke: c }} />}
                  {unlocked ? (
                    <>
                      <circle r="30" className="kw-node-bg" style={{ fill: `color-mix(in oklab, ${c} ${done ? 46 : 30}%, #fffdf6)`, stroke: c }} />
                      <foreignObject x="-14" y="-14" width="28" height="28">
                        <div className="kw-node-ic" style={{ color: `color-mix(in oklab, ${c} 60%, #3a3342)` }}>
                          <Ic n={st.icon} size={22} strokeWidth={2.4} />
                        </div>
                      </foreignObject>
                      <circle cx="-22" cy="-22" r="10.5" fill={c} stroke="#fffdf6" strokeWidth="2.5" />
                      <text x="-22" y="-21.5" textAnchor="middle" dominantBaseline="central" className="kw-num">{i + 1}</text>
                      {done && <text x="23" y="-19" textAnchor="middle" dominantBaseline="central" className="kw-star">★</text>}
                    </>
                  ) : (
                    <>
                      <circle r="19" className="kw-node-locked" />
                      <text y="0.5" textAnchor="middle" dominantBaseline="central" className="kw-num-locked">{i + 1}</text>
                    </>
                  )}
                  {cur && (
                    <>
                      <foreignObject x="-19" y="-66" width="38" height="40">
                        <div className="kw-you" title="You are here!"><Avatar v={data.profile.avatar} size={34} /></div>
                      </foreignObject>
                      <foreignObject x="24" y="-52" width="36" height="38">
                        <div className="kw-guardian kw-guardian-bob" style={{ animationDelay: '-0.7s' }} title={`${pal.name} the ${pal.kind}`}>
                          <BlockAvatar preset={pal.preset} size={28} />
                        </div>
                      </foreignObject>
                      <foreignObject x="-80" y="40" width="160" height="38">
                        <div className="kw-sign"><span style={{ borderColor: c }}>{st.region}</span></div>
                      </foreignObject>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          <Critter kind="butterfly" style={{ left: '22%', top: '10%' }} />
          <Critter kind="bee" style={{ left: '55%', top: '7%', animationDelay: '1.1s' }} />
          <Critter kind="butterfly" style={{ left: '70%', top: '38%', animationDelay: '0.5s' }} />
          <Critter kind="snail" style={{ right: '4%', bottom: '5%' }} />
        </div>
      </Card>

      <div className="kw-grid">
        <Card className="kw-quest">
          <div className="dash-kicker">Today's quest</div>
          <div className="row gap">
            <span className="kw-quest-pal"><BlockAvatar preset={PIXEL_PALS[currentIdx % PIXEL_PALS.length].preset} size={44} /></span>
            <div>
              <h2>{nextL ? nextL.title : 'Free practice in your world'}</h2>
              <p className="muted small">
                {nextL
                  ? `${PIXEL_PALS[currentIdx % PIXEL_PALS.length].name} the ${PIXEL_PALS[currentIdx % PIXEL_PALS.length].kind} is waiting in ${stages[nextL.stage].region}!`
                  : 'Every land explored — amazing! Keep your stars shiny.'}
              </p>
            </div>
          </div>
          <div className="row gap wrap" style={{ marginTop: 12 }}>
            <Btn big to={nextL ? `/app/lesson/${nextL.id}` : '/app/train/adaptive'}><Ic n="play" size={18} /> Let's go!</Btn>
            <Btn kind="soft" to="/app/games"><Ic n="gamepad" size={17} /> Play a game</Btn>
          </div>
        </Card>
        <Card>
          <div className="row spread">
            <h3><Ic n={daily.icon} size={17} /> Daily challenge</h3>
            {dailyDone && <Chip tone="good">Done!</Chip>}
          </div>
          <p className="small muted" style={{ margin: '6px 0 10px' }}>{daily.title} — a fresh little quest every day.</p>
          <Btn kind={dailyDone ? 'soft' : 'primary'} to="/app/challenge">{dailyDone ? 'See today\'s board' : 'Try it →'}</Btn>
        </Card>
      </div>

      <CoachCard text={tip} />

      <h2 className="section-title"><Ic n="gamepad" size={19} /> Playtime</h2>
      <div className="kw-games">
        <Link className="kw-game" to="/app/games/wordfall"><Ic n="shield" size={30} /><strong>Wordfall</strong><small>Protect the lantern city</small></Link>
        <Link className="kw-game" to="/app/games/stack"><Ic n="blocks" size={30} /><strong>Block Stack</strong><small>Build a word tower</small></Link>
        <Link className="kw-game" to="/app/games/keyforge"><Ic n="hammer" size={30} /><strong>Keyforge</strong><small>Craft shiny treasures</small></Link>
        <Link className="kw-game" to="/app/race"><Ic n="rocket" size={30} /><strong>Race</strong><small>Zoom with comet friends</small></Link>
      </div>

      <h2 className="section-title"><Ic n="medal" size={19} /> Newest stickers</h2>
      <div className="row gap wrap">
        {Object.entries(data.badges).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => {
          const b = BADGES.find((x) => x.id === id);
          if (!b) return null;
          return <Chip key={id} tone="gold"><Ic n={b.icon} size={14} /> {b.name}</Chip>;
        })}
        {!stickers && <p className="muted small">Finish your first quest to earn a sticker!</p>}
        <Link to="/app/badges" className="small" style={{ color: 'var(--accent)', alignSelf: 'center' }}>All stickers →</Link>
      </div>

      {readyToGraduate && (
        <Card className="kw-grad">
          <div className="row gap wrap spread">
            <div className="row gap">
              <Ic n="grad" size={30} />
              <div>
                <h3>You've grown so much, explorer!</h3>
                <p className="small muted">Ready to try the full KeyTopia dashboard, with deep stats and every mode? You can always come back.</p>
              </div>
            </div>
            <Btn
              kind="gold"
              onClick={() => {
                patch((d) => { d.settings.kidWorld = false; });
                celebrate({ kind: 'level', icon: 'grad', title: 'Graduation day!', body: 'Welcome to the full explorer dashboard. Your world is always in Settings if you miss it.' });
              }}
            >Graduate →</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
