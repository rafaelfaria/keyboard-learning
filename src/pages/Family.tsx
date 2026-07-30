import { useMemo } from 'react';
import { useData, currentStreak } from '../lib/store';
import { Card, Chip, Stat } from '../components/ui';
import { CalendarHeat, Spark } from '../components/charts';
import { curriculumProgress } from '../lib/curriculum';
import { dayKey, fmtDuration } from '../lib/metrics';
import { mulberry32, hashStr, pickN } from '../lib/rng';
import { CLASSMATE_NAMES } from '../lib/words';
import { Ic } from '../components/icons';
import { Avatar } from '../components/avatars';

export default function Family() {
  const data = useData();
  if (!data) return null;
  const prog = curriculumProgress(data);
  const streak = currentStreak(data);
  const last7 = useMemo(() => {
    let min = 0;
    for (let i = 0; i < 7; i++) min += data.days[dayKey(Date.now() - i * 86400_000)] ?? 0;
    return Math.round(min);
  }, [data.days]);
  const recent = data.sessions.slice(-12);
  const totalSec = data.sessions.reduce((a, s) => a + s.seconds, 0);

  const classRows = useMemo(() => {
    const rng = mulberry32(hashStr('classroom-demo'));
    return pickN(rng, CLASSMATE_NAMES, 6).map((n) => ({
      name: n,
      lessons: Math.floor(rng() * 14) + 2,
      wpm: Math.floor(rng() * 22) + 12,
      acc: Math.floor(rng() * 8) + 91,
      mins: Math.floor(rng() * 60) + 15,
    }));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1><Ic n="school" size={24} /> Family & Schools</h1>
          <p>A guardian-friendly view of real progress — plus a preview of KeyTopia Classroom for teachers.</p>
        </div>
      </div>

      <h2 className="section-title">Guardian summary — {data.profile.name} <Avatar v={data.profile.avatar} size={24} /></h2>
      <div className="grid2">
        <Card>
          <h3>This week at a glance</h3>
          <div className="row gap wrap" style={{ margin: '10px 0' }}>
            <Stat v={`${last7}m`} l="practised (7d)" tone="accent" />
            <Stat v={streak} l="day streak" />
            <Stat v={`${prog.done}/${prog.total}`} l="lessons done" />
            <Stat v={fmtDuration(totalSec)} l="all-time" />
          </div>
          <div className="row spread">
            <span className="small muted">Speed trend (last 12 sessions)</span>
            <Spark values={recent.map((s) => s.wpm)} width={160} />
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            {recent.length >= 3 && recent[recent.length - 1].wpm > recent[0].wpm
              ? `Improving: from ${Math.round(recent[0].wpm)} to ${Math.round(recent[recent.length - 1].wpm)} wpm across recent sessions, holding ${Math.round(recent.reduce((a, s) => a + s.acc, 0) / recent.length)}% accuracy.`
              : 'Consistent practice matters more than any single fast day. Short, regular sessions are the healthiest pattern.'}
          </p>
        </Card>
        <Card>
          <h3>Practice calendar</h3>
          <CalendarHeat days={data.days} goalMin={data.dailyGoalMin} />
          <h3 style={{ marginTop: 16 }}>Safety & wellbeing</h3>
          <div className="col" style={{ gap: 6, marginTop: 8 }}>
            <span className="small"><Ic n="check" size={13} /> No open chat — ever. Racing uses safe generated names.</span>
            <span className="small"><Ic n="check" size={13} /> Children are never matched with unknown adults.</span>
            <span className="small"><Ic n="check" size={13} /> Rewards favour accuracy and consistency, not screen time.</span>
            <span className="small"><Ic n="check" size={13} /> All data lives in this browser. Nothing is uploaded.</span>
            <span className="small"><Ic n="check" size={13} /> Leaderboards can be hidden entirely in Settings.</span>
          </div>
        </Card>
      </div>

      <h2 className="section-title">KeyTopia Classroom <Chip>Concept preview</Chip></h2>
      <div className="grid2">
        <Card style={{ position: 'relative' }} className="card">
          <h3>Class overview — 5B · Term 2</h3>
          <p className="small muted" style={{ marginBottom: 10 }}>Sample data. Teacher accounts unlock rosters, assigned lessons, printable reports and accessible pacing controls.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="class-table">
              <thead><tr><th>Student</th><th>Lessons</th><th>WPM</th><th>Accuracy</th><th>Minutes</th></tr></thead>
              <tbody>
                {classRows.map((r) => (
                  <tr key={r.name}><td>{r.name}</td><td>{r.lessons}</td><td>{r.wpm}</td><td>{r.acc}%</td><td>{r.mins}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <h3>What teachers get</h3>
          <div className="col" style={{ gap: 8, marginTop: 8 }}>
            <span className="small"><Ic n="clipboard" size={13} /> Assign regions, lessons or daily-minute goals to a class or a student.</span>
            <span className="small"><Ic n="flag" size={13} /> Classroom races with teacher-controlled pace bands — nobody is singled out.</span>
            <span className="small"><Ic n="trending" size={13} /> Progress reports by student, skill and week; export for parents' evening.</span>
            <span className="small"><Ic n="access" size={13} /> Per-student accessibility profiles: untimed mode, large text, high contrast, audio cues.</span>
            <span className="small"><Ic n="lock" size={13} /> School-managed accounts; no emails required from children.</span>
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>The learner experience you're using now is designed so classrooms plug in without changing anything students already know.</p>
        </Card>
      </div>
    </div>
  );
}
