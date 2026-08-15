import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData, levelInfo, currentStreak } from '../lib/store';
import { dayKey } from '../lib/metrics';
import { activityFeed } from '../lib/challenge';
import { Card, Ring, Stat, BadgeIcon } from '../components/ui';
import { MasteryMap } from '../components/MasteryMap';
import { Spark } from '../components/charts';
import { BADGES } from '../lib/badges';
import { Ic } from '../components/icons';
import { Avatar } from '../components/avatars';

/**
 * Progress → Overview (density pass): a pure stats snapshot. Everything
 * actionable — recommended session, daily challenge, missions, coach —
 * lives on Journey now; this tab answers "how am I doing?", nothing else.
 */
export default function Dashboard() {
  const data = useData();
  const nav = useNavigate();
  if (!data) return null;

  const lvl = levelInfo(data.xp);
  const streak = currentStreak(data);
  const todayMin = data.days[dayKey()] ?? 0;
  const recent = data.sessions.slice(-14);
  const last = recent[recent.length - 1];
  const feed = useMemo(() => activityFeed(data.profile.ageGroup), [data.profile.ageGroup]);
  const lastBadgeId = Object.entries(data.badges).sort((a, b) => b[1] - a[1])[0]?.[0];
  const lastBadge = BADGES.find((b) => b.id === lastBadgeId);
  const totalMin = Math.round(Object.values(data.days).reduce((a, m) => a + m, 0));

  return (
    <div>
      <div className="page-head">
        <div className="row gap">
          <Avatar v={data.profile.avatar} size={52} />
          <div>
            <h1>{data.profile.name}</h1>
            <p className="muted">Rank <strong>{data.assessment?.rank ?? 'Sprout I'}</strong> · Level {lvl.level} · {Math.round(data.xp)} XP · {totalMin} minutes practised all-time</p>
          </div>
        </div>
      </div>

      <div className="grid2">
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
        <Card>
          <div className="row spread">
            <h3>Recent form</h3>
            {recent.length > 1 && <Spark values={recent.map((s) => s.wpm)} />}
          </div>
          {last ? (
            <div className="row gap wrap" style={{ marginTop: 8 }}>
              <Stat v={last.wpm} l="last wpm" tone="accent" />
              <Stat v={`${last.acc}%`} l="last acc" />
              <Stat v={data.records.wpm?.v ?? ': '} l="best wpm" />
              <Stat v={`${Math.round(recent.reduce((a, s) => a + s.seconds, 0) / 60)}m`} l="last 14 sess." />
            </div>
          ) : (
            <p className="small muted" style={{ marginTop: 8 }}>Your first sessions will show up here.</p>
          )}
        </Card>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <Card>
          <div className="row spread">
            <h3>Your keyboard world</h3>
            <Link to="/app/progress?tab=analytics" className="small" style={{ color: 'var(--accent)' }}>Full analytics →</Link>
          </div>
          <MasteryMap data={data} compact />
        </Card>
        <div className="col gap">
          {lastBadge && (
            <Card className="row gap card-link" onClick={() => nav('/app/progress?tab=badges')}>
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
    </div>
  );
}
