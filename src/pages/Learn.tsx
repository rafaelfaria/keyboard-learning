import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useData } from '../lib/store';
import {
  buildLessonPlan, buildStages, lessonUnlocked, nextLesson,
  worldLessons, worldProgress, worldUnlocked,
} from '../lib/curriculum';
import { WORLDS } from '../lib/worlds';
import { Card, Chip, Stars } from '../components/ui';
import { BlockAvatar } from '../components/avatars';
import { PIXEL_PALS } from '../components/gamekit';
import { Ic } from '../components/icons';
import type { ProfileData } from '../lib/types';

/**
 * /app/learn — the Quest Book for kids (plan §2.5). Grown-ups get their
 * step list as the Trail Guide inside Journey, so they redirect home.
 */
export default function Learn() {
  const data = useData();
  if (!data) return null;
  const kid = data.profile.ageGroup === 'kid' && data.settings.kidWorld !== false;
  if (!kid) return <Navigate to="/app" replace />;
  return <QuestBook data={data} />;
}

function QuestBook({ data }: { data: ProfileData }) {
  const layout = data.profile.layout;
  const stages = useMemo(() => buildStages(layout), [layout]);
  const nextL = nextLesson(data);

  // Stable star requirements (targets derive from world position, not seed)
  const targets = useMemo(() => {
    const out: Record<string, { wpm: number; acc: number }> = {};
    for (const w of WORLDS) {
      if (!worldUnlocked(data, w.id)) continue;
      for (const l of worldLessons(layout, w.id)) {
        const p = buildLessonPlan(layout, l, data.profile.ageGroup, 42);
        out[l.id] = { wpm: p.targetWpm, acc: p.targetAcc };
      }
    }
    return out;
  }, [layout, data.profile.ageGroup, data.lessons]);

  return (
    <div className="questbook">
      <div className="page-head">
        <div>
          <h1>My Quest Book</h1>
          <p>Every spot on every island: what it teaches, and what your next star needs.</p>
        </div>
      </div>

      {WORLDS.map((w) => {
        const unlocked = worldUnlocked(data, w.id);
        const p = worldProgress(data, w.id);
        const pal = PIXEL_PALS[w.kid.guardian % PIXEL_PALS.length];
        if (!unlocked) {
          return (
            <Card key={w.id} className="qb-island qb-island-fog">
              <div className="row gap">
                <span className="qb-fog-ic"><Ic n="lock" size={20} /></span>
                <div>
                  <h3>{w.kid.kidName}</h3>
                  <p className="small muted">{w.tagline}: still hidden in the fog. Finish the island before it to reveal the way!</p>
                </div>
              </div>
            </Card>
          );
        }
        return (
          <Card key={w.id} className="qb-island">
            <div className="row spread wrap gap qb-island-head">
              <div className="row gap">
                <span className="kw-quest-pal"><BlockAvatar preset={pal.preset} size={38} /></span>
                <div>
                  <h3>{w.kid.kidName}</h3>
                  <p className="small muted" style={{ margin: 0 }}>{pal.name} the {pal.kind} keeps this island · {w.tagline}</p>
                </div>
              </div>
              <Chip tone={p.complete ? 'good' : 'accent'}>{p.complete ? 'Explored! ★' : `${p.done}/${p.total} spots`}</Chip>
            </div>
            <div className="qb-rows">
              {worldLessons(layout, w.id).map((l, i) => {
                const lp = data.lessons[l.id];
                const stars = Math.min(3, lp?.stars ?? 0);
                const open = lessonUnlocked(data, l.id);
                const isNext = nextL?.id === l.id;
                const t = targets[l.id];
                const focus = l.newKeys.length
                  ? `Learn ${l.newKeys.map((k) => (k === ' ' ? 'Space' : k.toUpperCase())).join(' & ')}`
                  : stages[l.stage]?.skill ?? '';
                const need = !open ? 'Finish the spot before it first'
                  : stars === 0 ? `Get a star: type carefully (85% right)`
                  : stars < 3 && t ? `Next star: ${stars === 1 ? `${t.acc}% right and a bit quicker` : `${t.wpm} wpm at ${t.acc}%`}`
                  : 'All three stars: shiny!';
                return (
                  <div key={l.id} className={`qb-row ${open ? '' : 'locked'} ${isNext ? 'qb-next' : ''}`}>
                    <span className="jn-guide-num">{i + 1}</span>
                    <div className="jn-guide-txt">
                      <strong>{l.title}</strong>
                      <small>{focus} · {need}</small>
                    </div>
                    {stars > 0 ? <Stars n={stars} size={13} /> : <span className="qb-hollow" aria-hidden>☆☆☆</span>}
                    {open
                      ? <Link className={`btn ${isNext ? 'btn-primary' : 'btn-soft'}`} to={`/app/lesson/${l.id}`}>{stars === 0 ? (isNext ? 'Go!' : 'Start') : 'Replay'}</Link>
                      : <Ic n="lock" size={15} className="muted" />}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
