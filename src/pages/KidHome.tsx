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

// Node coordinates for the 9 regions along the winding path (viewBox 0 0 1000 430)
const NODES: [number, number][] = [
  [70, 350], [200, 290], [330, 345], [455, 250], [575, 310],
  [680, 205], [790, 265], [890, 160], [950, 70],
];

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

  const pathD = NODES.map((p, i) => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`)).join(' ');
  const doneCount = stageState.filter((s) => s.done).length;
  const donePath = NODES.slice(0, Math.max(1, doneCount + 1)).map((p, i) => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`)).join(' ');

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
        <div className="kw-map" role="img" aria-label={`World map: ${doneCount} of ${stages.length} lands explored. Current land: ${stages[currentIdx].region}`}>
          <svg viewBox="0 0 1000 430">
            <path d={pathD} className="kw-path" />
            <path d={donePath} className="kw-path-done" />
            {stageState.map(({ st, done, unlocked }, i) => {
              const [x, y] = NODES[i];
              const cur = i === currentIdx;
              const c = LAND_COLORS[i % LAND_COLORS.length];
              const pal = PIXEL_PALS[i % PIXEL_PALS.length];
              return (
                <g
                  key={st.id}
                  transform={`translate(${x}, ${y})`}
                  className={`kw-node ${done ? 'kw-done' : cur ? 'kw-cur' : unlocked ? 'kw-open' : 'kw-locked'}`}
                  onClick={() => { if (unlocked) nav('/app/learn'); }}
                  role="button"
                  tabIndex={unlocked ? 0 : -1}
                  onKeyDown={(e) => { if (e.key === 'Enter' && unlocked) nav('/app/learn'); }}
                  aria-label={`${st.region}${done ? ' — explored' : cur ? ' — current land' : unlocked ? '' : ' — locked'}`}
                >
                  {cur && <circle r="34" className="kw-pulse" style={{ stroke: c }} />}
                  <circle
                    r="26" className="kw-node-bg"
                    style={unlocked ? { fill: `color-mix(in oklab, ${c} ${done ? 44 : 26}%, var(--surface))`, stroke: c } : undefined}
                  />
                  <foreignObject x="-13" y="-13" width="26" height="26">
                    <div className="kw-node-ic" style={unlocked ? { color: `color-mix(in oklab, ${c} 65%, var(--text))` } : undefined}>
                      <Ic n={unlocked ? st.icon : 'lock'} size={20} strokeWidth={2.3} />
                    </div>
                  </foreignObject>
                  {(cur || done) && (
                    <foreignObject x="18" y="-44" width="36" height="36">
                      <div className={`kw-guardian ${cur ? 'kw-guardian-bob' : ''}`} title={`${pal.name} the ${pal.kind}`}>
                        <BlockAvatar preset={pal.preset} size={cur ? 30 : 24} />
                      </div>
                    </foreignObject>
                  )}
                  {cur && <text y="52" textAnchor="middle" className="kw-node-label">{st.region}</text>}
                </g>
              );
            })}
          </svg>
          <Critter kind="butterfly" style={{ left: '16%', top: '14%' }} />
          <Critter kind="bee" style={{ left: '58%', top: '8%', animationDelay: '1.1s' }} />
          <Critter kind="butterfly" style={{ left: '84%', top: '46%', animationDelay: '0.5s' }} />
          <Critter kind="snail" style={{ left: '6%', bottom: '8%' }} />
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
