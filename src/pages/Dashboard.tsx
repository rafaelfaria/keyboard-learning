import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData, levelInfo, currentStreak } from '../lib/store';
import { dayKey } from '../lib/metrics';
import { nextLesson, buildStages } from '../lib/curriculum';
import { weakKeys } from '../lib/adaptive';
import { dashboardTip } from '../lib/coach';
import { dailyChallenge, activityFeed } from '../lib/challenge';
import { Btn, Card, Chip, Ring, Stat, BadgeIcon } from '../components/ui';
import { CoachCard } from '../components/ResultsPanel';
import { MasteryMap } from '../components/MasteryMap';
import { Spark } from '../components/charts';
import { BADGES } from '../lib/badges';
import { Ic } from '../components/icons';
import { Avatar } from '../components/avatars';

export default function Dashboard() {
  const data = useData();
  const nav = useNavigate();
  if (!data) return null;

  const lvl = levelInfo(data.xp);
  const streak = currentStreak(data);
  const todayMin = data.days[dayKey()] ?? 0;
  const nextL = useMemo(() => nextLesson(data), [data]);
  const weak = useMemo(() => weakKeys(data.keyStats).slice(0, 3), [data.keyStats]);
  const tip = useMemo(() => dashboardTip(data), [data.sessions.length]);
  const daily = dailyChallenge(data.profile.ageGroup);
  const dailyDone = !!data.daily[daily.key];
  const recent = data.sessions.slice(-14);
  const last = recent[recent.length - 1];
  const stages = buildStages(data.profile.layout);
  const stageOfNext = nextL ? stages[nextL.stage] : null;
  const feed = useMemo(() => activityFeed(data.profile.ageGroup), [data.profile.ageGroup]);
  const lastBadgeId = Object.entries(data.badges).sort((a, b) => b[1] - a[1])[0]?.[0];
  const lastBadge = BADGES.find((b) => b.id === lastBadgeId);

  const recommended = useMemo(() => {
    if (nextL && (data.profile.experience === 'new' || (data.lessons[nextL.id]?.stars ?? 0) === 0)) {
      return { title: nextL.title, sub: `${stageOfNext?.region} · guided lesson`, icon: stageOfNext?.icon ?? 'map', to: `/app/lesson/${nextL.id}`, cta: 'Start lesson' };
    }
    if (weak.length && weak[0].err > 0.08) {
      return { title: `Weak-key workout: ${weak.map((w) => w.key.toUpperCase()).join(' · ')}`, sub: 'Built from your recent misses', icon: 'dumbbell', to: '/app/train/weakkeys', cta: 'Start workout' };
    }
    if (nextL) return { title: nextL.title, sub: `${stageOfNext?.region} · guided lesson`, icon: stageOfNext?.icon ?? 'map', to: `/app/lesson/${nextL.id}`, cta: 'Start lesson' };
    return { title: 'Adaptive practice', sub: 'A balanced set tuned to your map', icon: 'brain', to: '/app/train/adaptive', cta: 'Start practice' };
  }, [data]);

  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Night owl session' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <div className="page-head">
        <div className="row gap">
          <Avatar v={data.profile.avatar} size={52} />
          <div>
            <h1>{greet}, {data.profile.name}</h1>
            <p className="muted">Rank <strong>{data.assessment?.rank ?? 'Sprout I'}</strong> · Level {lvl.level} · {Math.round(data.xp)} XP total</p>
          </div>
        </div>
        <Btn to={recommended.to} big><Ic n="play" size={17} /> Quick start</Btn>
      </div>

      <div className="dash-hero">
        <Card className="dash-today">
          <div className="dash-kicker">Today's recommended session</div>
          <h2><Ic n={recommended.icon} size={22} /> {recommended.title}</h2>
          <p>{recommended.sub}</p>
          <div className="row gap wrap">
            <Btn to={recommended.to}>{recommended.cta} →</Btn>
            <Btn kind="soft" to="/app/train/speed"><Ic n="zap" size={15} /> 60s sprint</Btn>
          </div>
        </Card>
        <Card>
          <div className="dash-rings">
            <Ring value={Math.min(1, todayMin / data.dailyGoalMin)} label={`${Math.round(todayMin)}m`} sub={`goal ${data.dailyGoalMin}m`} size={84} />
            <Ring value={lvl.into / lvl.need} label={`Lv ${lvl.level}`} sub={`${lvl.need - lvl.into} xp to go`} size={84} color="var(--accent2)" />
            <div className="center">
              <Ic n={streak > 0 ? 'flame' : 'lamp'} size={30} className={streak > 0 ? 'flame-on' : ''} />
              <strong style={{ display: 'block' }}>{streak} day{streak === 1 ? '' : 's'}</strong>
              <div className="muted small">streak</div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <CoachCard text={tip} />
      </div>

      <h2 className="section-title">Jump in</h2>
      <div className="quick-grid">
        <Link className="quick-tile" to="/app/train/speed"><Ic n="zap" size={24} className="quick-ic" /><strong>Speed sprint</strong><small>15s – 5min tests</small></Link>
        <Link className="quick-tile" to="/app/train/accuracy"><Ic n="target" size={24} className="quick-ic" /><strong>Accuracy Lab</strong><small>Precision scoring</small></Link>
        <Link className="quick-tile" to="/app/train/adaptive"><Ic n="brain" size={24} className="quick-ic" /><strong>Adaptive practice</strong><small>Tuned to your map</small></Link>
        <Link className="quick-tile" to="/app/games"><Ic n="gamepad" size={24} className="quick-ic" /><strong>Arcade</strong><small>7 original games</small></Link>
        <Link className="quick-tile" to="/app/race"><Ic n="rocket" size={24} className="quick-ic" /><strong>Race</strong><small>CPUs, ghosts & rooms</small></Link>
        <Link className="quick-tile" to="/app/train/zen"><Ic n="flower" size={24} className="quick-ic" /><strong>Zen typing</strong><small>No scores, just flow</small></Link>
      </div>

      <div className="grid2" style={{ marginTop: 26 }}>
        <Card>
          <div className="row spread">
            <h3>Your keyboard world</h3>
            <Link to="/app/progress" className="small" style={{ color: 'var(--accent)' }}>Full map →</Link>
          </div>
          <MasteryMap data={data} compact />
        </Card>
        <div className="col gap">
          <Card>
            <div className="row spread">
              <h3><Ic n={daily.icon} size={17} /> Daily challenge · {daily.title}</h3>
              {dailyDone && <Chip tone="good">Done ✓</Chip>}
            </div>
            <p className="small muted" style={{ margin: '6px 0 12px' }}>{daily.desc}</p>
            <Btn to="/app/challenge" kind={dailyDone ? 'soft' : 'primary'}>{dailyDone ? 'View today\'s board' : 'Take the challenge →'}</Btn>
          </Card>
          <Card>
            <h3>Weekly missions</h3>
            {data.missions.list.map((m) => (
              <div key={m.id} style={{ margin: '10px 0' }}>
                <div className="row spread small"><span className="row" style={{ gap: 6 }}><Ic n={m.icon} size={14} /> {m.label}</span><span className="muted">{Math.min(Math.round(m.progress), m.goal)}/{m.goal}</span></div>
                <div className="hbar" style={{ height: 7, marginTop: 4 }}><div className="hbar-fill" style={{ width: `${Math.min(100, (m.progress / m.goal) * 100)}%`, background: m.done ? 'var(--good)' : 'var(--accent)' }} /></div>
              </div>
            ))}
          </Card>
          {last && (
            <Card>
              <div className="row spread">
                <h3>Recent form</h3>
                <Spark values={recent.map((s) => s.wpm)} />
              </div>
              <div className="row gap wrap" style={{ marginTop: 8 }}>
                <Stat v={last.wpm} l="last wpm" tone="accent" />
                <Stat v={`${last.acc}%`} l="last acc" />
                <Stat v={data.records.wpm?.v ?? '—'} l="best wpm" />
                <Stat v={`${Math.round(recent.reduce((a, s) => a + s.seconds, 0) / 60)}m`} l="last 14 sess." />
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        {lastBadge && (
          <Card className="row gap card-link" onClick={() => nav('/app/badges')}>
            <BadgeIcon icon={lastBadge.icon} unlocked size={54} />
            <div>
              <h3 style={{ marginBottom: 2 }}>Latest badge: {lastBadge.name}</h3>
              <p className="small muted">{lastBadge.desc}</p>
            </div>
          </Card>
        )}
        {data.profile.competitive && !data.settings.hideLeaderboards && (
          <Card>
            <h3>Around the world</h3>
            {feed.map((f, i) => (
              <div className="feed-row" key={i}>
                <Avatar v={f.avatar} size={24} className="feed-av" />
                <span><strong>{f.name}</strong> {f.what}</span>
                <small>{f.when}</small>
              </div>
            ))}
            <p className="small muted" style={{ marginTop: 8 }}>Community activity is simulated in this offline build.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
