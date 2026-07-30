import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/store';
import { buildStages, curriculumProgress, nextLesson, stageUnlocked } from '../lib/curriculum';
import { Card, Chip, Stars } from '../components/ui';
import { MasteryMap } from '../components/MasteryMap';
import { Ic } from '../components/icons';

export default function Learn() {
  const data = useData();
  if (!data) return null;
  const stages = useMemo(() => buildStages(data.profile.layout), [data.profile.layout]);
  const prog = curriculumProgress(data);
  const nextL = nextLesson(data);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>The Atlas</h1>
          <p>Nine regions, one keyboard. Earn at least one star in most lessons of a region to open the next. ({prog.done}/{prog.total} lessons · {prog.stars}★)</p>
        </div>
        {nextL && <Link className="btn btn-primary" to={`/app/lesson/${nextL.id}`}>▶ Continue: {nextL.title}</Link>}
      </div>

      <Card>
        <h3>Your keyboard world today</h3>
        <MasteryMap data={data} compact />
      </Card>

      <div className="atlas" style={{ marginTop: 22 }}>
        {stages.map((st) => {
          const unlocked = stageUnlocked(data, data.profile.layout, st.id);
          const doneCount = st.lessons.filter((l) => (data.lessons[l.id]?.stars ?? 0) >= 1).length;
          const allDone = doneCount === st.lessons.length;
          return (
            <div key={st.id} className={`stage-card ${unlocked ? (allDone ? 'stage-done' : 'stage-open') : 'stage-locked'}`}>
              <div className="stage-node" aria-hidden><Ic n={unlocked ? st.icon : 'lock'} size={26} /></div>
              <Card className="stage-body">
                <div className="row spread wrap gap">
                  <div>
                    <div className="stage-skill">{st.skill}</div>
                    <div className="stage-region">{st.region}</div>
                  </div>
                  <Chip tone={allDone ? 'good' : unlocked ? 'accent' : 'default'}>
                    {allDone ? 'Region complete ✔' : unlocked ? `${doneCount}/${st.lessons.length} crossed` : 'Locked'}
                  </Chip>
                </div>
                <p className="small muted" style={{ margin: '6px 0 0' }}>{st.desc}</p>
                <div className="lesson-pills">
                  {st.lessons.map((l) => {
                    const lp = data.lessons[l.id];
                    const isNext = nextL?.id === l.id;
                    return (
                      <Link
                        key={l.id}
                        to={`/app/lesson/${l.id}`}
                        className={`lesson-pill ${isNext ? 'lesson-pill-next' : ''} ${unlocked ? '' : 'lesson-pill-locked'}`}
                        aria-disabled={!unlocked}
                      >
                        {lp?.stars ? <Stars n={lp.stars} size={11} /> : <span aria-hidden>{isNext ? '▶' : '○'}</span>}
                        {l.title}
                      </Link>
                    );
                  })}
                </div>
              </Card>
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ marginTop: 18 }}>
        Impatient explorer? You can unlock every region in <Link to="/app/settings" style={{ color: 'var(--accent)' }}>Settings → Learning</Link>.
      </p>
    </div>
  );
}
