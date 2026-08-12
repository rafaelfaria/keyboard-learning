import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import { useData, useStore, useUi, currentStreak, levelInfo } from '../lib/store';
import {
  activeWorldId, buildStages, graduationReady, lessonUnlocked,
  nextLessonInWorld, worldLessons, worldProgress, worldUnlocked, WORLD_SPINE,
} from '../lib/curriculum';
import { WORLDS, worldDef } from '../lib/worlds';
import { dailyChallenge } from '../lib/challenge';
import { dashboardTip } from '../lib/coach';
import { Btn, Card, Chip } from '../components/ui';
import { CoachCard } from '../components/ResultsPanel';
import { Avatar, BlockAvatar } from '../components/avatars';
import { Critter, PIXEL_PALS } from '../components/gamekit';
import { IslandMap, type StopVM } from '../components/IslandMap';
import { SeaChart, type ChartWorldVM } from '../components/SeaChart';
import { Ic } from '../components/icons';
import { BADGES } from '../lib/badges';

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

  const layout = data.profile.layout;
  const stages = useMemo(() => buildStages(layout), [layout]);
  const activeId = activeWorldId(data);
  const [view, setView] = useState<'chart' | 'island'>('island');
  const [worldId, setWorldId] = useState(() => {
    const last = data.journey?.lastWorld;
    return last && worldUnlocked(data, last) ? last : activeId;
  });

  const streak = currentStreak(data);
  const lvl = levelInfo(data.xp);
  const stickers = Object.keys(data.badges).length;
  const daily = dailyChallenge('kid');
  const dailyDone = !!data.daily[daily.key];
  const tip = useMemo(() => dashboardTip(data), [data.sessions.length]);

  const def = worldDef(worldId);
  const wp = worldProgress(data, worldId);
  const lessons = worldLessons(layout, worldId);
  const stops: StopVM[] = lessons.map((l) => ({
    id: l.id,
    label: l.title,
    icon: stages[l.stage]?.icon ?? 'map',
    stars: Math.min(3, data.lessons[l.id]?.stars ?? 0),
    unlocked: lessonUnlocked(data, l.id),
  }));
  const firstOpen = stops.findIndex((s) => s.stars === 0);
  const currentIdx = firstOpen === -1 ? stops.length - 1 : firstOpen;

  const chartWorlds: ChartWorldVM[] = WORLD_SPINE.map((w) => {
    const p = worldProgress(data, w.id);
    return { id: w.id, unlocked: worldUnlocked(data, w.id), complete: p.complete, active: w.id === activeId, done: p.done, total: p.total };
  });
  const islandsDone = chartWorlds.filter((w) => w.complete).length;

  const openWorld = (id: string) => {
    setWorldId(id);
    setView('island');
    patch((d) => { d.journey ??= {}; d.journey.lastWorld = id; });
  };

  // The quest card always points at the single next thing on the active world.
  const activeDef = worldDef(activeId);
  const activePal = PIXEL_PALS[activeDef.kid.guardian % PIXEL_PALS.length];
  const nextL = nextLessonInWorld(data, activeId);
  const activeP = worldProgress(data, activeId);
  const nextWorld = WORLD_SPINE[WORLD_SPINE.findIndex((w) => w.id === activeId) + 1];
  const allDone = chartWorlds.every((w) => w.complete);

  return (
    <div className="kidworld">
      <div className="kw-head">
        <Avatar v={data.profile.avatar} size={62} className="kw-avatar" />
        <div>
          <h1>Hi, {data.profile.name}!</h1>
          <p className="muted">Level {lvl.level} explorer · {islandsDone} island{islandsDone === 1 ? '' : 's'} explored</p>
        </div>
        <div className="kw-chips">
          <span className="kw-chip"><Ic n="flame" size={17} /> {streak} day{streak === 1 ? '' : 's'}</span>
          <span className="kw-chip"><Ic n="medal" size={17} /> {stickers} stickers</span>
        </div>
      </div>

      <Card className="kw-map-card">
        <div className="row spread wrap gap">
          {view === 'island' ? (
            <>
              <div className="row gap">
                <Btn kind="soft" onClick={() => setView('chart')} ariaLabel="Back to the sea chart"><Ic n="map" size={16} /> Sea chart</Btn>
                <h2 style={{ margin: 0 }}>{def.kid.kidName}</h2>
              </div>
              <Chip tone={wp.complete ? 'good' : 'accent'}>{wp.complete ? 'Explored! ★' : `${wp.done} of ${wp.total} spots`}</Chip>
            </>
          ) : (
            <>
              <h2 style={{ margin: 0 }}>The sea chart</h2>
              <Chip tone="accent">{islandsDone} of {WORLD_SPINE.length} islands explored</Chip>
            </>
          )}
        </div>
        <div className="kw-mapwrap">
          {view === 'island' ? (
            <IslandMap
              skin={def.kid}
              worldId={worldId}
              stops={stops}
              currentIdx={currentIdx}
              youAvatar={data.profile.avatar}
              complete={wp.complete}
              onStop={(id, unlocked) => { if (unlocked) nav(`/app/lesson/${id}`); }}
            />
          ) : (
            <SeaChart worlds={chartWorlds} onOpen={openWorld} />
          )}
          {view === 'island' && def.kid.decor !== 'cavern' && (
            <>
              <Critter kind="butterfly" style={{ left: '22%', top: '10%' }} />
              <Critter kind="bee" style={{ left: '55%', top: '7%', animationDelay: '1.1s' }} />
              <Critter kind="butterfly" style={{ left: '70%', top: '38%', animationDelay: '0.5s' }} />
              <Critter kind="snail" style={{ right: '4%', bottom: '5%' }} />
            </>
          )}
        </div>
      </Card>

      <div className="kw-grid">
        <Card className="kw-quest">
          <div className="dash-kicker">Today's quest</div>
          <div className="row gap">
            <span className="kw-quest-pal"><BlockAvatar preset={activePal.preset} size={44} /></span>
            <div>
              <h2>{allDone ? 'Free practice in your world' : nextL ? nextL.title : nextWorld ? `Sail to ${worldDef(nextWorld.id).kid.kidName}!` : 'Free practice'}</h2>
              <p className="muted small">
                {allDone
                  ? 'Every island explored — amazing! Keep your stars shiny.'
                  : nextL
                    ? `${activePal.name} the ${activePal.kind} is waiting at ${activeDef.kid.kidName}!`
                    : `${activeDef.kid.kidName} is explored — a new island is on the horizon!`}
              </p>
            </div>
          </div>
          <div className="row gap wrap" style={{ marginTop: 12 }}>
            {allDone ? (
              <Btn big to="/app/train/adaptive"><Ic n="play" size={18} /> Let's go!</Btn>
            ) : nextL ? (
              <Btn big to={`/app/lesson/${nextL.id}`}><Ic n="play" size={18} /> Let's go!</Btn>
            ) : nextWorld ? (
              <Btn big onClick={() => openWorld(nextWorld.id)}><Ic n="rocket" size={18} /> Set sail!</Btn>
            ) : (
              <Btn big to="/app/train/adaptive"><Ic n="play" size={18} /> Let's go!</Btn>
            )}
            {activeP.complete && !allDone && activeP.stars < activeP.maxStars && (
              <Btn kind="soft" onClick={() => openWorld(activeId)}><Ic n="star" size={16} /> Polish stars</Btn>
            )}
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

      {graduationReady(data) && (
        <Card className="kw-grad">
          <div className="row gap wrap spread">
            <div className="row gap">
              <Ic n="grad" size={30} />
              <div>
                <h3>You've grown so much, explorer!</h3>
                <p className="small muted">Ready to try the grown-up expedition, with deep stats and every mode? Your islands stay right here if you miss them.</p>
              </div>
            </div>
            <Btn
              kind="gold"
              onClick={() => {
                patch((d) => { d.settings.kidWorld = false; });
                celebrate({ kind: 'level', icon: 'grad', title: 'Graduation day!', body: 'Welcome to The Ascent — same journey, bigger mountains. Your islands are always in Settings if you miss them.' });
              }}
            >Graduate →</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
