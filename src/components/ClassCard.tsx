import { useEffect, useState } from 'react';
import { useData, useStore } from '../lib/store';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  assignmentProgress, classAssignments, classBoard, myMemberships, snapshotOf,
  type Assignment, type ClassScore, type Membership,
} from '../lib/classroom';
import { dayKey } from '../lib/metrics';
import { Card, Chip } from '../components/ui';
import { Ic } from './icons';

/**
 * The student's whole classroom surface: one card (plan §2). Assignments due,
 * and today's class board. Renders nothing when the active explorer belongs to
 * no class — the join entries live on Family, /join and the sign-in page, so
 * the home screens stay clean for everyone else.
 *
 * Assignment completion is computed from the LOCAL profile (lessons + days):
 * the same derivation the teacher runs server-side, so both agree without a
 * progress table (plan §2.4).
 */
export function ClassCard() {
  const data = useData();
  const activeId = useStore((s) => s.activeId);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [board, setBoard] = useState<(ClassScore & { name: string })[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !activeId) { setMembership(null); return; }
    let stale = false;
    void (async () => {
      const ms = await myMemberships(activeId);
      if (stale) return;
      const m = ms[0] ?? null;
      setMembership(m);
      if (!m) { setAssignments([]); setBoard([]); return; }
      const [a, b] = await Promise.all([
        classAssignments(m.classId),
        m.hideBoard ? Promise.resolve([]) : classBoard(m.classId, dayKey()),
      ]);
      if (stale) return;
      setAssignments(a);
      setBoard(b);
    })();
    return () => { stale = true; };
  }, [activeId]);

  if (!data || !membership) return null;

  const snap = snapshotOf(data);
  const kid = data.profile.ageGroup === 'kid';
  const open = assignments
    .map((a) => ({ a, p: assignmentProgress(a, snap) }))
    .filter(({ a }) => !a.dueAt || a.dueAt > Date.now() - 86400_000)
    .slice(0, 3);
  const showBoard = !data.settings.hideLeaderboards && !membership.hideBoard;

  return (
    <Card className="cls-card">
      <div className="row spread wrap gap">
        <h3><Ic n="school" size={17} /> {membership.className}</h3>
        <Chip tone="accent">{kid ? 'Your class' : 'My class'}</Chip>
      </div>
      <p className="small muted" style={{ margin: '4px 0 8px' }}>
        You explore here as <strong>{membership.displayName}</strong>.
      </p>

      {open.length > 0 && (
        <div className="cls-assigns">
          {open.map(({ a, p }) => (
            <div key={a.id} className="cls-assign">
              <span className="cls-assign-ic" aria-hidden>
                <Ic n={p.complete ? 'check' : a.kind === 'minutes' ? 'timer' : 'map'} size={15} />
              </span>
              <span className="cls-assign-txt">
                {a.note || describeAssignment(a)}
                {a.dueAt ? <small className="muted"> · by {new Date(a.dueAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</small> : null}
              </span>
              <Chip tone={p.complete ? 'good' : 'default'}>{p.done}/{p.goal}</Chip>
            </div>
          ))}
        </div>
      )}
      {!open.length && (
        <p className="small muted">Nothing assigned right now. Free exploring!</p>
      )}

      {showBoard && board.length > 0 && (
        <div className="cls-board">
          <div className="small muted" style={{ margin: '8px 0 4px' }}>
            <Ic n="medal" size={13} /> Today's class board
          </div>
          {board.slice(0, 5).map((r, i) => (
            <div key={r.profileId} className={`feed-row ${r.profileId === activeId ? 'cls-you' : ''}`}>
              <strong style={{ width: 20 }}>{i + 1}</strong>
              <span>{r.profileId === activeId ? <strong>{r.name} (you)</strong> : r.name}</span>
              <small>{Math.round(r.wpm)} wpm · {Math.round(r.acc)}%</small>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function describeAssignment(a: Assignment): string {
  if (a.kind === 'minutes') return `Practise ${a.target.minutes ?? 0} minutes`;
  if (a.kind === 'world') return 'Explore the whole world';
  const n = a.target.lessonIds?.length ?? 0;
  return n === 1 ? 'Clear one special spot' : `Clear ${n} spots`;
}
