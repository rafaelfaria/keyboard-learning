import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, currentStreak, levelInfo } from '../lib/store';
import {
  activeWorldId, buildLessonPlan, buildStages, lessonUnlocked,
  worldLessons, worldProgress, worldUnlocked, WORLD_SPINE,
} from '../lib/curriculum';
import { WORLDS, worldDef } from '../lib/worlds';
import { dailyChallenge } from '../lib/challenge';
import { dashboardTip } from '../lib/coach';
import { dayKey } from '../lib/metrics';
import { Btn, Card, Chip } from '../components/ui';
import { CoachCard } from '../components/ResultsPanel';
import { TrailMap, type TrailStopVM } from '../components/TrailMap';
import { Ic } from '../components/icons';

/**
 * The Ascent — the grown-up journey home (plan §4). One trail, five legs,
 * one obvious button. The dense dashboard now lives under Progress.
 */
export default function Journey() {
  const data = useData();
  const nav = useNavigate();
  const patch = useStore((s) => s.patch);
  if (!data) return null;

  const layout = data.profile.layout;
  const stages = useMemo(() => buildStages(layout), [layout]);
  const activeId = activeWorldId(data);
  const [legId, setLegId] = useState(() => {
    const last = data.journey?.lastWorld;
    return last && worldUnlocked(data, last) ? last : activeId;
  });
  const [view, setView] = useState<'map' | 'guide'>('map');

  const streak = currentStreak(data);
  const lvl = levelInfo(data.xp);
  const minutesToday = Math.round(data.days[dayKey(Date.now())] ?? 0);
  const daily = dailyChallenge(data.profile.ageGroup);
  const dailyDone = !!data.daily[daily.key];
  const tip = useMemo(() => dashboardTip(data), [data.sessions.length]);

  const def = worldDef(legId);
  const wp = worldProgress(data, legId);
  const legIdx = WORLD_SPINE.findIndex((w) => w.id === legId);
  const lessons = worldLessons(layout, legId);
  const stops: TrailStopVM[] = lessons.map((l, i) => ({
    id: l.id,
    label: l.title,
    stars: Math.min(3, data.lessons[l.id]?.stars ?? 0),
    unlocked: lessonUnlocked(data, l.id),
    campBefore: i > 0 && lessons[i - 1].stage !== l.stage,
  }));
  const firstOpen = stops.findIndex((s) => s.stars === 0);
  const currentIdx = firstOpen === -1 ? stops.length - 1 : firstOpen;

  const activeLessons = worldLessons(layout, activeId);
  const nextL = activeLessons.find((l) => (data.lessons[l.id]?.stars ?? 0) === 0) ?? null;
  const activeDef = worldDef(activeId);
  const allDone = WORLD_SPINE.every((w) => worldProgress(data, w.id).complete);

  const openLeg = (id: string) => {
    setLegId(id);
    patch((d) => { d.journey ??= {}; d.journey.lastWorld = id; });
  };

  // Stable targets for the guide (targets derive from world position, not seed)
  const targets = useMemo(() => {
    const out: Record<string, { wpm: number; acc: number }> = {};
    for (const l of lessons) {
      const p = buildLessonPlan(layout, l, data.profile.ageGroup, 42);
      out[l.id] = { wpm: p.targetWpm, acc: p.targetAcc };
    }
    return out;
  }, [layout, legId, data.profile.ageGroup]);

  return (
    <div className="journey">
      <div className="jn-head">
        <div>
          <div className="dash-kicker">The Ascent · Leg {legIdx + 1} of {WORLD_SPINE.length}</div>
          <h1>{def.adult.adultName}</h1>
          <p className="muted">{def.adult.blurb}</p>
        </div>
        <div className="jn-stats">
          <span className="kw-chip"><Ic n="flame" size={16} /> {streak} day{streak === 1 ? '' : 's'}</span>
          <span className="kw-chip">Lv {lvl.level}</span>
          <span className="kw-chip" title="Minutes practised today"><Ic n="timer" size={15} /> {minutesToday}/{data.dailyGoalMin}m</span>
        </div>
      </div>

      {/* elevation strip: the whole expedition at a glance */}
      <div className="jn-elev" role="tablist" aria-label="Expedition legs">
        {WORLDS.map((w, i) => {
          const p = worldProgress(data, w.id);
          const unlocked = worldUnlocked(data, w.id);
          const on = w.id === legId;
          return (
            <button
              key={w.id}
              role="tab"
              aria-selected={on}
              className={`jn-leg ${on ? 'on' : ''} ${p.complete ? 'done' : ''} ${unlocked ? '' : 'locked'}`}
              onClick={() => { if (unlocked) openLeg(w.id); }}
              disabled={!unlocked}
              title={`${w.adult.adultName} — ${w.tagline}`}
            >
              <span className="jn-leg-name">
                {p.complete ? <Ic n="check" size={13} /> : unlocked ? null : <Ic n="lock" size={12} />}
                {i + 1}. {w.adult.adultName}
              </span>
              <span className="jn-leg-bar"><i style={{ width: `${p.total ? Math.round((p.done / p.total) * 100) : 0}%` }} /></span>
            </button>
          );
        })}
      </div>

      <div className="jn-grid">
        <Card className="jn-map-card">
          <div className="row spread wrap gap" style={{ marginBottom: 8 }}>
            <div className="row gap">
              <Btn kind={view === 'map' ? 'primary' : 'soft'} onClick={() => setView('map')}><Ic n="map" size={15} /> Trail</Btn>
              <Btn kind={view === 'guide' ? 'primary' : 'soft'} onClick={() => setView('guide')}><Ic n="book" size={15} /> Trail Guide</Btn>
            </div>
            <Chip tone={wp.complete ? 'good' : 'accent'}>{wp.complete ? 'Leg complete' : `${wp.done} of ${wp.total} waypoints`}</Chip>
          </div>

          {view === 'map' ? (
            <TrailMap
              stops={stops}
              currentIdx={currentIdx}
              complete={wp.complete}
              onStop={(id, unlocked) => { if (unlocked) nav(`/app/lesson/${id}`); }}
              onCamp={() => nav('/app/train/checkpoint')}
            />
          ) : (
            <div className="jn-guide">
              {lessons.map((l, i) => {
                const st = stops[i];
                const t = targets[l.id];
                const focus = l.newKeys.length
                  ? `Keys: ${l.newKeys.map((k) => (k === ' ' ? 'Space' : k.toUpperCase())).join(' · ')}`
                  : stages[l.stage]?.skill ?? '';
                return (
                  <div key={l.id} className={`jn-guide-row ${st.unlocked ? '' : 'locked'}`}>
                    {st.campBefore && (
                      <div className="jn-guide-camp">
                        <Ic n="tent" size={14} /> Camp — <button className="jn-camp-link" onClick={() => nav('/app/train/checkpoint')}>optional checkpoint review</button>
                      </div>
                    )}
                    <div className="jn-guide-main">
                      <span className="jn-guide-num">{i + 1}</span>
                      <div className="jn-guide-txt">
                        <strong>{l.title}</strong>
                        <small>{focus} · pass at 85% acc · ★★★ {t.wpm} wpm @ {t.acc}%</small>
                      </div>
                      <span className="jn-guide-stars">{'★'.repeat(st.stars)}{'☆'.repeat(Math.max(0, 3 - st.stars))}</span>
                      {st.unlocked
                        ? <Btn kind={st.stars === 0 ? 'primary' : 'soft'} onClick={() => nav(`/app/lesson/${l.id}`)}>{st.stars === 0 ? 'Start' : 'Replay'}</Btn>
                        : <Ic n="lock" size={15} className="muted" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="jn-rail">
          <Card className="jn-continue">
            <div className="dash-kicker">Next waypoint</div>
            {allDone ? (
              <>
                <h2>The summit is yours</h2>
                <p className="small muted">Every waypoint cleared. Keep the edge with adaptive training.</p>
                <Btn big to="/app/train/adaptive"><Ic n="play" size={18} /> Adaptive practice</Btn>
              </>
            ) : nextL ? (
              <>
                <h2>{nextL.title}</h2>
                <p className="small muted">{activeDef.adult.adultName} · {stages[nextL.stage]?.skill}</p>
                <Btn big to={`/app/lesson/${nextL.id}`}><Ic n="play" size={18} /> Continue</Btn>
              </>
            ) : (
              <>
                <h2>Polish the stars</h2>
                <p className="small muted">Every waypoint cleared — three-star runs remain.</p>
                <Btn big onClick={() => setView('guide')}><Ic n="star" size={17} /> Open the Trail Guide</Btn>
              </>
            )}
          </Card>
          <Card>
            <div className="row spread">
              <h3><Ic n={daily.icon} size={16} /> Daily challenge</h3>
              {dailyDone && <Chip tone="good">Done</Chip>}
            </div>
            <p className="small muted" style={{ margin: '6px 0 10px' }}>{daily.title}</p>
            <Btn kind={dailyDone ? 'soft' : 'primary'} to="/app/challenge">{dailyDone ? 'Today\'s board' : 'Take it on →'}</Btn>
          </Card>
          <Card>
            <h3><Ic n="target" size={16} /> This week</h3>
            <div className="jn-missions">
              {data.missions.list.map((m) => (
                <div key={m.id} className={`jn-mission ${m.done ? 'done' : ''}`}>
                  <span className="jn-mission-label"><Ic n={m.icon} size={13} /> {m.label}</span>
                  <span className="jn-mission-bar"><i style={{ width: `${Math.min(100, Math.round((m.progress / m.goal) * 100))}%` }} /></span>
                </div>
              ))}
            </div>
          </Card>
          <CoachCard text={tip} />
        </div>
      </div>
    </div>
  );
}
