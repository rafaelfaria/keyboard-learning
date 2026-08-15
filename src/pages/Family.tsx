import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useStore, currentStreak, levelInfo, randomKidName } from '../lib/store';
import { useAccount } from '../lib/account';
import { useSync, visibleProfileIds } from '../lib/syncEngine';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  classAssignments, classProgress, classScores, createAssignment, createClass, createSeat,
  deleteAssignment, deleteClass, leaveClass, myMemberships, ownedClasses, removeSeat,
  rotateJoinCode, setHideBoard, assignmentProgress,
  type Assignment, type ClassInfo, type ClassScore, type Membership, type StudentRow,
} from '../lib/classroom';
import { Btn, Card, Chip, Stat, Toggle } from '../components/ui';
import { CalendarHeat, Spark } from '../components/charts';
import { buildStages, curriculumProgress, WORLD_SPINE } from '../lib/curriculum';
import { dayKey, fmtDuration } from '../lib/metrics';
import { mulberry32, hashStr, pickN } from '../lib/rng';
import { CLASSMATE_NAMES } from '../lib/words';
import { Ic } from '../components/icons';
import { Avatar } from '../components/avatars';
import type { ProfileData } from '../lib/types';

/**
 * Family & Schools. Three layers, each real:
 *   1. the guardian summary of the active explorer (always);
 *   2. the household view across every explorer in this browser (local read);
 *   3. KeyTopia Classroom (docs/classrooms-plan.md): the teacher dashboard for
 *      classes this account owns, and class membership for the active explorer.
 * With no Supabase configured, layer 3 stays the honestly-labeled concept it
 * always was.
 */
export default function Family() {
  const data = useData();
  if (!data) return null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1><Ic n="school" size={24} /> Family & Schools</h1>
          <p>A guardian-friendly view of real progress, for one explorer, the whole household, or a class.</p>
        </div>
      </div>

      <GuardianSummary data={data} />
      <HouseholdTable />

      {isSupabaseConfigured ? <ClassroomReal /> : <ClassroomConcept />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layer 1 — the active explorer (kept from the original page)
// ---------------------------------------------------------------------------

function GuardianSummary({ data }: { data: ProfileData }) {
  const prog = curriculumProgress(data);
  const streak = currentStreak(data);
  const last7 = useMemo(() => {
    let min = 0;
    for (let i = 0; i < 7; i++) min += data.days[dayKey(Date.now() - i * 86400_000)] ?? 0;
    return Math.round(min);
  }, [data.days]);
  const recent = data.sessions.slice(-12);
  const totalSec = data.sessions.reduce((a, s) => a + s.seconds, 0);

  return (
    <>
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
            <span className="small"><Ic n="check" size={13} /> No open chat, ever. Shared surfaces use safe generated names only.</span>
            <span className="small"><Ic n="check" size={13} /> Children are never matched with unknown adults.</span>
            <span className="small"><Ic n="check" size={13} /> Rewards favour accuracy and consistency, not screen time.</span>
            <span className="small"><Ic n="check" size={13} /> Progress saves to your family account. A class sees lessons, stars and minutes, never keystrokes, replays or personal details.</span>
            <span className="small"><Ic n="check" size={13} /> Leaderboards can be hidden entirely in Settings, even from classmates.</span>
          </div>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Layer 2 — every explorer in this browser (plan §4's household dashboard)
// ---------------------------------------------------------------------------

function HouseholdTable() {
  const profiles = useStore((s) => s.profiles);
  const user = useAccount((s) => s.user);
  const owners = useSync((s) => s.owners);
  const ids = visibleProfileIds(Object.keys(profiles), user?.id ?? null, owners);
  if (ids.length < 2) return null;

  const weekAgo = dayKey(Date.now() - 6 * 86400_000);
  return (
    <>
      <h2 className="section-title">Your household</h2>
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table className="class-table">
            <thead><tr><th>Explorer</th><th>Level</th><th>Streak</th><th>Minutes (7d)</th><th>Lessons</th></tr></thead>
            <tbody>
              {ids.map((id) => {
                const d = profiles[id];
                if (!d) return null;
                const lvl = levelInfo(d.xp).level;
                const min7 = Math.round(Object.entries(d.days)
                  .filter(([day]) => day >= weekAgo)
                  .reduce((a, [, m]) => a + m, 0));
                const done = Object.values(d.lessons).filter((l) => l.stars >= 1).length;
                return (
                  <tr key={id}>
                    <td><span className="row gap" style={{ alignItems: 'center' }}><Avatar v={d.profile.avatar} size={22} /> {d.profile.name}</span></td>
                    <td>{lvl}</td>
                    <td>{currentStreak(d)}</td>
                    <td>{min7}</td>
                    <td>{done}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Everyone in this browser, at a glance. Switch explorers from the top bar to dig into one journey.
        </p>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Layer 3 — KeyTopia Classroom, real
// ---------------------------------------------------------------------------

function ClassroomReal() {
  const user = useAccount((s) => s.user);
  const teacher = Boolean(user) && !(user as { is_anonymous?: boolean } | null)?.is_anonymous;

  return (
    <>
      <MyClassMembership />
      {teacher ? <TeacherClasses /> : (
        <p className="small muted" style={{ marginTop: 8 }}>
          Classes are created from a signed-in household or teacher account.
        </p>
      )}
    </>
  );
}

/** The active explorer's memberships, plus the door to join another. */
function MyClassMembership() {
  const activeId = useStore((s) => s.activeId);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    if (!activeId) { setMemberships([]); return; }
    setMemberships(await myMemberships(activeId));
  };
  useEffect(() => { void refresh(); }, [activeId]);

  return (
    <>
      <h2 className="section-title">This explorer's classes</h2>
      <Card>
        {memberships.length ? (
          <div className="col" style={{ gap: 8 }}>
            {memberships.map((m) => (
              <div key={m.memberId} className="row spread wrap gap">
                <span><Ic n="school" size={15} /> <strong>{m.className}</strong> <span className="small muted">as {m.displayName}</span></span>
                <Btn
                  kind="ghost" disabled={busy === m.memberId}
                  onClick={() => {
                    if (!window.confirm(`Leave ${m.className}? The teacher will no longer see this explorer's progress.`)) return;
                    setBusy(m.memberId);
                    void leaveClass(m.memberId).then(refresh).finally(() => setBusy(null));
                  }}
                >Leave</Btn>
              </div>
            ))}
          </div>
        ) : (
          <p className="small muted">This explorer is not in a class yet.</p>
        )}
        <div className="row gap wrap" style={{ marginTop: 10 }}>
          <Btn kind="soft" to="/join"><Ic n="key" size={15} /> Join with a class code</Btn>
        </div>
      </Card>
    </>
  );
}

function TeacherClasses() {
  const [classes, setClasses] = useState<ClassInfo[] | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => setClasses(await ownedClasses());
  useEffect(() => { void refresh(); }, []);

  const add = async () => {
    const n = name.trim();
    if (!n || creating) return;
    setCreating(true);
    setError(null);
    try {
      await createClass(n);
      setName('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the class.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <h2 className="section-title">Your classes <Chip tone="accent">Teacher view</Chip></h2>
      {classes?.map((c) => <ClassAdmin key={c.id} cls={c} onChanged={refresh} />)}

      <Card>
        <h3>{classes?.length ? 'Start another class' : 'Start a class'}</h3>
        <p className="small muted" style={{ margin: '6px 0 10px' }}>
          A class works for a school group or for your own family circle. Students join
          with a short code, no emails, and you see lessons, stars and practice minutes.
        </p>
        <div className="row gap wrap">
          <input
            className="ob-input" style={{ maxWidth: 260 }} maxLength={60}
            placeholder="Class 5B, or The Cardoso Crew" value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
          />
          <Btn onClick={() => void add()} disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create class'}
          </Btn>
        </div>
        {error && <p className="small" style={{ color: 'var(--bad)', marginTop: 8 }}>{error}</p>}
      </Card>
    </>
  );
}

const LESSON_OPTIONS = (() => {
  const stages = buildStages('qwerty');
  return WORLD_SPINE.flatMap((w) =>
    w.stages.flatMap((si) => stages[si]?.lessons ?? []).map((l) => ({
      id: l.id,
      label: `${w.name}: ${l.title}`,
    })));
})();

function ClassAdmin({ cls, onChanged }: { cls: ClassInfo; onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scores, setScores] = useState<ClassScore[]>([]);
  const [code, setCode] = useState(cls.joinCode);
  const [copied, setCopied] = useState(false);
  const [seatName, setSeatName] = useState('');
  const [seatNote, setSeatNote] = useState('');
  const [newKind, setNewKind] = useState<'lesson' | 'minutes' | 'world'>('lesson');
  const [newLesson, setNewLesson] = useState(LESSON_OPTIONS[3]?.id ?? 'h2');
  const [newMinutes, setNewMinutes] = useState(20);
  const [newWorld, setNewWorld] = useState('w1');
  const [newNote, setNewNote] = useState('');
  const [newDue, setNewDue] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    const [r, a, s] = await Promise.all([
      classProgress(cls.id),
      classAssignments(cls.id),
      classScores(cls.id, dayKey()),
    ]);
    setRows(r);
    setAssignments(a);
    setScores(s);
  };
  useEffect(() => { void refresh(); }, [cls.id]);

  const act = (fn: () => Promise<unknown>) => {
    setErr(null);
    void fn().then(refresh).catch((e) => setErr(e instanceof Error ? e.message : 'That did not work.'));
  };

  const prettyCode = `${code.slice(0, 3)}-${code.slice(3)}`;
  const claimed = rows.filter((r) => r.profileId);
  const nameOf = new Map(rows.map((r) => [r.profileId, r.displayName]));

  return (
    <Card className="cls-admin">
      <div className="row spread wrap gap">
        <h3><Ic n="school" size={18} /> {cls.name}</h3>
        <div className="row gap wrap" style={{ alignItems: 'center' }}>
          <span className="cls-code" title="Students join with this code">{prettyCode}</span>
          <Btn
            kind="soft"
            onClick={() => {
              void navigator.clipboard?.writeText(code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              });
            }}
          >{copied ? 'Copied!' : 'Copy code'}</Btn>
          <Btn kind="ghost" onClick={() => act(async () => setCode(await rotateJoinCode(cls.id)))}>
            <Ic n="refresh" size={14} /> New code
          </Btn>
        </div>
      </div>

      {/* Roster */}
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <table className="class-table">
          <thead><tr><th>Student</th><th>Journey</th><th>Stars</th><th>Lessons</th><th>Min (7d)</th><th>Last seen</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.memberId}>
                <td>
                  {r.displayName}
                  {r.teacherNote && <small className="muted"> · {r.teacherNote}</small>}
                </td>
                {r.profileId ? (
                  <>
                    <td>{r.world ? (r.world.complete ? `${r.world.worldName} · done` : `${r.world.worldName} · spot ${r.world.spot}`) : '–'}</td>
                    <td>{r.stars}</td>
                    <td>{r.lessonsDone}</td>
                    <td>{r.minutes7d}</td>
                    <td>{r.lastActive ? new Date(r.lastActive + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'not yet'}</td>
                  </>
                ) : (
                  <td colSpan={5}>
                    <span className="small muted">Waiting to join · seat code </span>
                    <span className="cls-seat-code">{r.claimCode ? `${r.claimCode.slice(0, 3)}-${r.claimCode.slice(3)}` : '?'}</span>
                  </td>
                )}
                <td>
                  <button
                    className="cls-x" aria-label={`Remove ${r.displayName}`}
                    onClick={() => {
                      if (!window.confirm(`Remove ${r.displayName} from ${cls.name}? Their own progress stays with them; you just stop seeing it.`)) return;
                      act(() => removeSeat(r.memberId));
                    }}
                  >✕</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7}><span className="small muted">Nobody here yet. Share the class code, or add seats below and hand out their codes.</span></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add a managed seat */}
      <div className="row gap wrap" style={{ marginTop: 10, alignItems: 'center' }}>
        <input
          className="ob-input" style={{ maxWidth: 180 }} maxLength={24}
          placeholder="Class name (safe)" value={seatName}
          onChange={(e) => setSeatName(e.target.value.replace(/[^A-Za-z0-9 ]/g, ''))}
        />
        <Btn kind="ghost" onClick={() => setSeatName(randomKidName())} ariaLabel="Suggest a safe name"><Ic n="refresh" size={13} /></Btn>
        <input
          className="ob-input" style={{ maxWidth: 200 }} maxLength={80}
          placeholder="Private note, e.g. first name" value={seatNote}
          onChange={(e) => setSeatNote(e.target.value)}
        />
        <Btn
          kind="soft" disabled={!seatName.trim()}
          onClick={() => act(async () => {
            await createSeat(cls.id, seatName.trim(), seatNote.trim() || undefined);
            setSeatName('');
            setSeatNote('');
          })}
        ><Ic n="clipboard" size={14} /> Add seat</Btn>
        <span className="small muted">Seats come with one-time codes; the private note never leaves this view.</span>
      </div>

      {/* Assignments */}
      <h4 className="cls-sub"><Ic n="clipboard" size={15} /> Assignments</h4>
      <div className="col" style={{ gap: 6 }}>
        {assignments.map((a) => {
          const doneCount = claimed.filter((r) => assignmentProgress(a, r.snap).complete).length;
          return (
            <div key={a.id} className="row spread wrap gap cls-assign">
              <span className="cls-assign-txt">
                {a.note || describeForTeacher(a)}
                {a.dueAt ? <small className="muted"> · due {new Date(a.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small> : null}
              </span>
              <span className="row gap" style={{ alignItems: 'center' }}>
                <Chip tone={doneCount === claimed.length && claimed.length > 0 ? 'good' : 'default'}>
                  {doneCount} of {claimed.length} done
                </Chip>
                <button className="cls-x" aria-label="Delete assignment" onClick={() => act(() => deleteAssignment(a.id))}>✕</button>
              </span>
            </div>
          );
        })}
        {!assignments.length && <p className="small muted">Nothing assigned. Set a goal below and every student sees it on their map.</p>}
      </div>

      <div className="row gap wrap" style={{ marginTop: 8, alignItems: 'center' }}>
        <select className="ob-input cls-select" value={newKind} onChange={(e) => setNewKind(e.target.value as typeof newKind)} aria-label="Assignment kind">
          <option value="lesson">Clear a spot</option>
          <option value="minutes">Practice minutes</option>
          <option value="world">Finish a world</option>
        </select>
        {newKind === 'lesson' && (
          <select className="ob-input cls-select" value={newLesson} onChange={(e) => setNewLesson(e.target.value)} aria-label="Which lesson">
            {LESSON_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        )}
        {newKind === 'minutes' && (
          <input
            className="ob-input" style={{ width: 90 }} type="number" min={5} max={600} value={newMinutes}
            onChange={(e) => setNewMinutes(Number(e.target.value))} aria-label="Minutes goal"
          />
        )}
        {newKind === 'world' && (
          <select className="ob-input cls-select" value={newWorld} onChange={(e) => setNewWorld(e.target.value)} aria-label="Which world">
            {WORLD_SPINE.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        <input
          className="ob-input" style={{ maxWidth: 220 }} maxLength={200}
          placeholder="Note the class sees (optional)" value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <input
          className="ob-input" type="date" value={newDue}
          onChange={(e) => setNewDue(e.target.value)} aria-label="Due date"
        />
        <Btn
          kind="soft"
          onClick={() => act(() => createAssignment(
            cls.id, newKind,
            newKind === 'lesson' ? { lessonIds: [newLesson] } : newKind === 'minutes' ? { minutes: newMinutes } : { worldId: newWorld },
            newNote.trim() || null,
            newDue ? new Date(newDue + 'T23:59:00').getTime() : null,
          ).then(() => { setNewNote(''); setNewDue(''); }))}
        >Assign</Btn>
      </div>

      {/* Today's board */}
      <h4 className="cls-sub"><Ic n="medal" size={15} /> Today's board</h4>
      {scores.length ? (
        <div className="col" style={{ gap: 2 }}>
          {scores.map((s, i) => (
            <div key={s.profileId} className="feed-row">
              <strong style={{ width: 20 }}>{i + 1}</strong>
              <span>{nameOf.get(s.profileId) ?? 'Explorer'}</span>
              <small>{Math.round(s.wpm)} wpm · {Math.round(s.acc)}%</small>
              {s.hidden && <Chip>hidden from classmates</Chip>}
            </div>
          ))}
        </div>
      ) : (
        <p className="small muted">No scores yet today. The daily challenge feeds this board automatically.</p>
      )}

      <div className="row spread wrap gap" style={{ marginTop: 12 }}>
        <Toggle
          on={!cls.hideBoard}
          onChange={(v) => act(async () => { await setHideBoard(cls.id, !v); await onChanged(); })}
          label="Class board visible to students"
          desc="Off runs a board-free class; you still see scores privately. Students who hide leaderboards stay hidden either way."
        />
        <Btn
          kind="danger"
          onClick={() => {
            if (!window.confirm(`Delete ${cls.name}? Every seat and assignment goes with it. Student progress is untouched.`)) return;
            act(async () => { await deleteClass(cls.id); await onChanged(); });
          }}
        >Delete class</Btn>
      </div>
      {err && <p className="small" style={{ color: 'var(--bad)', marginTop: 8 }}>{err}</p>}
    </Card>
  );
}

function describeForTeacher(a: Assignment): string {
  if (a.kind === 'minutes') return `Practise ${a.target.minutes ?? 0} minutes`;
  if (a.kind === 'world') return `Finish ${WORLD_SPINE.find((w) => w.id === a.target.worldId)?.name ?? 'a world'}`;
  const id = a.target.lessonIds?.[0];
  return LESSON_OPTIONS.find((o) => o.id === id)?.label ?? 'Clear a spot';
}

// ---------------------------------------------------------------------------
// The unconfigured build keeps the honest concept preview
// ---------------------------------------------------------------------------

function ClassroomConcept() {
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
    <>
      <h2 className="section-title">KeyTopia Classroom <Chip>Concept preview</Chip></h2>
      <div className="grid2">
        <Card style={{ position: 'relative' }} className="card">
          <h3>Class overview — 5B · Term 2</h3>
          <p className="small muted" style={{ marginBottom: 10 }}>Sample data. Classroom switches on when this build is connected to an account server.</p>
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
            <span className="small"><Ic n="clipboard" size={13} /> Assign spots, worlds or daily-minute goals to a class or a student.</span>
            <span className="small"><Ic n="medal" size={13} /> A real class board for the daily challenge, with a board-free option.</span>
            <span className="small"><Ic n="trending" size={13} /> Progress by student, world and week, computed from real lessons.</span>
            <span className="small"><Ic n="lock" size={13} /> Join codes and managed seats; no emails required from children.</span>
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            The learner experience you're using now is designed so classrooms plug in
            without changing anything students already know. <Link to="/typing-for-schools">More for schools →</Link>
          </p>
        </Card>
      </div>
    </>
  );
}
