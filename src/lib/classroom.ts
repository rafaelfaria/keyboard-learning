import { supabase } from './supabase';
import { useStore } from './store';
import { dayKey } from './metrics';
import { dailyChallenge } from './challenge';
import { WORLD_SPINE, worldLessons } from './curriculum';
import type { ProfileData, SessionResult } from './types';

/**
 * KeyTopia Classroom — the client for docs/classrooms-plan.md §2.
 *
 * A class is a reader and meeting place for data the sync layer already moves.
 * Nothing here gates practice: every function is a no-op or an empty read when
 * Supabase is unconfigured, and none of it ever runs on an interaction path.
 *
 * Class state is shared state, not profile state (plan §4): it is read and
 * written directly against the classroom tables and never rides
 * ProfileData.touched / collectChangeset. The one bridge between the two
 * worlds is the watcher at the bottom, which mirrors finished daily-challenge
 * runs up to the class boards the same way Challenge.tsx mirrors them into
 * data.daily.
 */

// ---------------------------------------------------------------------------
// Shapes (camelCase mirrors of the tables)
// ---------------------------------------------------------------------------

export interface ClassInfo {
  id: string;
  name: string;
  joinCode: string;
  hideBoard: boolean;
  createdAt: number;
}

export interface Membership {
  classId: string;
  className: string;
  hideBoard: boolean;
  memberId: string;
  profileId: string;
  displayName: string;
}

/** A seat as the class owner sees it; students never receive this shape. */
export interface Seat {
  memberId: string;
  profileId: string | null;      // null = unclaimed slot
  displayName: string;
  teacherNote: string | null;
  claimCode: string | null;
  joinedAt: number;
}

/** A classmate as peers see them: safe display name, nothing else. */
export interface RosterEntry {
  memberId: string;
  profileId: string;
  displayName: string;
}

export type AssignmentKind = 'lesson' | 'minutes' | 'world';

export interface Assignment {
  id: string;
  classId: string;
  kind: AssignmentKind;
  target: { lessonIds?: string[]; minutes?: number; worldId?: string };
  note: string | null;
  dueAt: number | null;
  createdAt: number;
}

export interface ClassScore {
  profileId: string;
  day: string;
  mode: 'speed' | 'accuracy' | 'rhythm';
  wpm: number;
  acc: number;
  score: number;
  hidden: boolean;
}

export type JoinStatus = 'ok' | 'not_found' | 'full' | 'already_member' | 'rate_limited' | 'error';

export interface JoinResult {
  status: JoinStatus;
  classId?: string;
  className?: string;
  /** Set by slot claims: the safe name the teacher chose for this seat. */
  displayName?: string;
}

const ms = (s: string | null) => (s ? new Date(s).getTime() : 0);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v * 10) / 10));

/** Throw with the server's message so forms can show something actionable. */
function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ---------------------------------------------------------------------------
// Member-side reads
// ---------------------------------------------------------------------------

/** Classes this profile belongs to. Empty when signed out or unconfigured. */
export async function myMemberships(profileId: string): Promise<Membership[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('my_classes')
    .select('class_id, name, settings, member_id, profile_id, display_name')
    .eq('profile_id', profileId);
  if (error || !data) return [];
  return data.map((r) => ({
    classId: r.class_id as string,
    className: r.name as string,
    hideBoard: Boolean((r.settings as { hideBoard?: boolean } | null)?.hideBoard),
    memberId: r.member_id as string,
    profileId: r.profile_id as string,
    displayName: r.display_name as string,
  }));
}

/** Safe classmate list, through the class_roster view (no notes, no codes). */
export async function classRoster(classId: string): Promise<RosterEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('class_roster')
    .select('member_id, profile_id, display_name')
    .eq('class_id', classId)
    .order('display_name');
  if (error || !data) return [];
  return data.map((r) => ({
    memberId: r.member_id as string,
    profileId: r.profile_id as string,
    displayName: r.display_name as string,
  }));
}

export async function classAssignments(classId: string): Promise<Assignment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('assignments')
    .select('id, class_id, kind, target, note, due_at, created_at')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    classId: r.class_id as string,
    kind: r.kind as AssignmentKind,
    target: (r.target ?? {}) as Assignment['target'],
    note: (r.note as string | null) ?? null,
    dueAt: r.due_at ? ms(r.due_at as string) : null,
    createdAt: ms(r.created_at as string),
  }));
}

/** Raw score rows for a day; RLS decides how much each role sees. */
export async function classScores(classId: string, day: string): Promise<ClassScore[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('class_daily_scores')
    .select('profile_id, day, mode, wpm, acc, score, hidden')
    .eq('class_id', classId)
    .eq('day', day)
    .order('score', { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    profileId: r.profile_id as string,
    day: r.day as string,
    mode: r.mode as ClassScore['mode'],
    wpm: r.wpm as number,
    acc: r.acc as number,
    score: r.score as number,
    hidden: Boolean(r.hidden),
  }));
}

/**
 * Today's class board as a MEMBER sees it: scores joined to safe roster names,
 * best first. The teacher builds their own board from classScores + classSeats,
 * because the roster view is member-scoped and a teacher is not a member.
 */
export async function classBoard(classId: string, day: string): Promise<(ClassScore & { name: string })[]> {
  const [scores, roster] = await Promise.all([classScores(classId, day), classRoster(classId)]);
  const names = new Map(roster.map((r) => [r.profileId, r.displayName]));
  return scores
    .filter((r) => names.has(r.profileId))
    .map((r) => ({ ...r, name: names.get(r.profileId) ?? 'Explorer' }));
}

export async function leaveClass(memberId: string): Promise<void> {
  if (!supabase) return;
  must(await supabase.from('class_members').delete().eq('id', memberId));
}

// ---------------------------------------------------------------------------
// Joining (kid or family device)
// ---------------------------------------------------------------------------

/**
 * One door for both code kinds: try the class join code first, then fall back
 * to a teacher-issued seat claim code. Both RPCs are rate-limited server-side.
 */
export async function joinWithCode(code: string, profileId: string, displayName: string): Promise<JoinResult> {
  if (!supabase) return { status: 'error' };
  try {
    const join = must(await supabase.rpc('join_class', {
      p_code: code, p_profile_id: profileId, p_display_name: displayName,
    })) as { status: string; class_id: string | null; class_name: string | null }[];
    const j = join[0];
    if (j && j.status === 'ok') {
      return { status: 'ok', classId: j.class_id ?? undefined, className: j.class_name ?? undefined };
    }
    if (j && j.status !== 'not_found') return { status: j.status as JoinStatus };

    const claim = must(await supabase.rpc('claim_slot', {
      p_code: code, p_profile_id: profileId,
    })) as { status: string; class_id: string | null; class_name: string | null; display_name: string | null }[];
    const c = claim[0];
    if (c && c.status === 'ok') {
      return {
        status: 'ok',
        classId: c.class_id ?? undefined,
        className: c.class_name ?? undefined,
        displayName: c.display_name ?? undefined,
      };
    }
    return { status: (c?.status as JoinStatus) ?? 'error' };
  } catch {
    return { status: 'error' };
  }
}

/** Parent-friendly words for every way a code entry can land. */
export function joinStatusMessage(status: JoinStatus): string {
  switch (status) {
    case 'ok': return 'Welcome aboard!';
    case 'not_found': return 'That code did not match a class. Check it with your teacher and try again.';
    case 'full': return 'This class is full. Ask your teacher to make space first.';
    case 'already_member': return 'This explorer is already in that class.';
    case 'rate_limited': return 'Too many tries just now. Wait a few minutes and try again.';
    default: return 'Something went wrong. Check your connection and try again.';
  }
}

// ---------------------------------------------------------------------------
// Teacher side
// ---------------------------------------------------------------------------

const classRow = (r: Record<string, unknown>): ClassInfo => ({
  id: r.id as string,
  name: r.name as string,
  joinCode: r.join_code as string,
  hideBoard: Boolean((r.settings as { hideBoard?: boolean } | null)?.hideBoard),
  createdAt: ms(r.created_at as string),
});

/** Classes the signed-in account owns (RLS returns nothing else). */
export async function ownedClasses(): Promise<ClassInfo[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, join_code, settings, created_at')
    .order('created_at');
  if (error || !data) return [];
  return data.map(classRow);
}

export async function createClass(name: string): Promise<ClassInfo> {
  if (!supabase) throw new Error('Not connected');
  const rows = must(await supabase.from('classes').insert({ name }).select()) as Record<string, unknown>[];
  return classRow(rows[0]);
}

/** New code, old one stops working the moment this returns. */
export async function rotateJoinCode(classId: string): Promise<string> {
  if (!supabase) throw new Error('Not connected');
  const code = must(await supabase.rpc('gen_join_code')) as string;
  const rows = must(
    await supabase.from('classes').update({ join_code: code }).eq('id', classId).select('join_code'),
  ) as { join_code: string }[];
  return rows[0].join_code;
}

export async function setHideBoard(classId: string, hide: boolean): Promise<void> {
  if (!supabase) return;
  must(await supabase.from('classes').update({ settings: { hideBoard: hide } }).eq('id', classId));
}

export async function deleteClass(classId: string): Promise<void> {
  if (!supabase) return;
  must(await supabase.from('classes').delete().eq('id', classId));
}

/** Full seat list, owner-only columns included. */
export async function classSeats(classId: string): Promise<Seat[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('class_members')
    .select('id, profile_id, display_name, teacher_note, claim_code, joined_at')
    .eq('class_id', classId)
    .order('display_name');
  if (error || !data) return [];
  return data.map((r) => ({
    memberId: r.id as string,
    profileId: (r.profile_id as string | null) ?? null,
    displayName: r.display_name as string,
    teacherNote: (r.teacher_note as string | null) ?? null,
    claimCode: (r.claim_code as string | null) ?? null,
    joinedAt: ms(r.joined_at as string),
  }));
}

/** Pre-create a named seat; returns its one-time claim code. */
export async function createSeat(classId: string, displayName: string, teacherNote?: string): Promise<string> {
  if (!supabase) throw new Error('Not connected');
  const rows = must(await supabase.rpc('create_slot', {
    p_class_id: classId, p_display_name: displayName, p_teacher_note: teacherNote ?? null,
  })) as { member_id: string; claim_code: string }[];
  return rows[0].claim_code;
}

export async function removeSeat(memberId: string): Promise<void> {
  if (!supabase) return;
  must(await supabase.from('class_members').delete().eq('id', memberId));
}

export async function createAssignment(
  classId: string, kind: AssignmentKind, target: Assignment['target'], note: string | null, dueAt: number | null,
): Promise<void> {
  if (!supabase) throw new Error('Not connected');
  must(await supabase.from('assignments').insert({
    class_id: classId, kind, target, note,
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
  }));
}

export async function deleteAssignment(id: string): Promise<void> {
  if (!supabase) return;
  must(await supabase.from('assignments').delete().eq('id', id));
}

// ---------------------------------------------------------------------------
// Progress derivation — reads over what sync already carries (plan §2.3–2.4)
// ---------------------------------------------------------------------------

/** The snapshot both dashboards compute against. */
export interface ProgressSnapshot {
  /** lessonId -> stars */
  stars: Record<string, number>;
  /** dayKey -> minutes */
  days: Record<string, number>;
}

export function snapshotOf(d: ProfileData): ProgressSnapshot {
  const stars: Record<string, number> = {};
  for (const [id, l] of Object.entries(d.lessons)) stars[id] = l.stars;
  return { stars, days: d.days };
}

/**
 * Lesson ids are layout-independent (b1, h2, t4… name positions, not glyphs),
 * so world membership can be derived without knowing the student's layout.
 */
export function worldPosition(snap: ProgressSnapshot): {
  worldId: string; worldName: string; spot: number; total: number; complete: boolean;
} {
  for (const w of WORLD_SPINE) {
    const ls = worldLessons('qwerty', w.id);
    const done = ls.filter((l) => (snap.stars[l.id] ?? 0) >= 1).length;
    if (done < ls.length) {
      return { worldId: w.id, worldName: w.name, spot: done + 1, total: ls.length, complete: false };
    }
  }
  const last = WORLD_SPINE[WORLD_SPINE.length - 1];
  const total = worldLessons('qwerty', last.id).length;
  return { worldId: last.id, worldName: last.name, spot: total, total, complete: true };
}

/** Completion is computed, never tracked (plan §2.4): lesson done at ≥1 star. */
export function assignmentProgress(a: Assignment, snap: ProgressSnapshot): { done: number; goal: number; complete: boolean } {
  if (a.kind === 'minutes') {
    const goal = Math.max(1, a.target.minutes ?? 0);
    const from = dayKey(a.createdAt);
    const to = dayKey(a.dueAt ?? Date.now());
    let sum = 0;
    for (const [day, min] of Object.entries(snap.days)) {
      if (day >= from && day <= to) sum += min;
    }
    const done = Math.min(goal, Math.round(sum));
    return { done, goal, complete: done >= goal };
  }
  const ids = a.kind === 'world'
    ? worldLessons('qwerty', a.target.worldId ?? 'w1').map((l) => l.id)
    : a.target.lessonIds ?? [];
  const goal = Math.max(1, ids.length);
  const done = ids.filter((id) => (snap.stars[id] ?? 0) >= 1).length;
  return { done, goal, complete: done >= goal && ids.length > 0 };
}

/** Everything the teacher table needs for one class, in three queries. */
export interface StudentRow extends Seat {
  world: ReturnType<typeof worldPosition> | null;
  stars: number;
  lessonsDone: number;
  minutes7d: number;
  lastActive: string | null;   // dayKey
  snap: ProgressSnapshot;
}

export async function classProgress(classId: string): Promise<StudentRow[]> {
  if (!supabase) return [];
  const seats = await classSeats(classId);
  const ids = seats.map((s) => s.profileId).filter((p): p is string => Boolean(p));
  const since = dayKey(Date.now() - 27 * 86400_000);
  const [lessonsRes, daysRes] = ids.length
    ? await Promise.all([
      supabase.from('lesson_progress').select('profile_id, lesson_id, stars').in('profile_id', ids),
      supabase.from('day_minutes').select('profile_id, day, minutes').in('profile_id', ids).gte('day', since),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const starsBy = new Map<string, Record<string, number>>();
  for (const r of (lessonsRes.data ?? []) as { profile_id: string; lesson_id: string; stars: number }[]) {
    const m = starsBy.get(r.profile_id) ?? {};
    m[r.lesson_id] = r.stars;
    starsBy.set(r.profile_id, m);
  }
  const daysBy = new Map<string, Record<string, number>>();
  for (const r of (daysRes.data ?? []) as { profile_id: string; day: string; minutes: number }[]) {
    const m = daysBy.get(r.profile_id) ?? {};
    m[r.day] = r.minutes;
    daysBy.set(r.profile_id, m);
  }

  const weekAgo = dayKey(Date.now() - 6 * 86400_000);
  return seats.map((seat) => {
    if (!seat.profileId) {
      return { ...seat, world: null, stars: 0, lessonsDone: 0, minutes7d: 0, lastActive: null, snap: { stars: {}, days: {} } };
    }
    const snap: ProgressSnapshot = {
      stars: starsBy.get(seat.profileId) ?? {},
      days: daysBy.get(seat.profileId) ?? {},
    };
    const starTotal = Object.values(snap.stars).reduce((a, s) => a + Math.min(3, s), 0);
    const lessonsDone = Object.values(snap.stars).filter((s) => s >= 1).length;
    const minutes7d = Object.entries(snap.days)
      .filter(([day, min]) => day >= weekAgo && min > 0)
      .reduce((a, [, min]) => a + min, 0);
    const activeDays = Object.entries(snap.days).filter(([, min]) => min > 0).map(([day]) => day);
    return {
      ...seat,
      world: worldPosition(snap),
      stars: starTotal,
      lessonsDone,
      minutes7d: Math.round(minutes7d),
      lastActive: activeDays.length ? activeDays.sort().at(-1)! : null,
      snap,
    };
  });
}

// ---------------------------------------------------------------------------
// Daily-challenge mirror (plan §2.5)
// ---------------------------------------------------------------------------

/**
 * Push a finished run to every class this profile belongs to. The server keeps
 * the day's best (keep_best trigger) and computes the score itself, so this
 * can submit every run blindly. `hidden` carries hideLeaderboards: withheld
 * from peers, still visible to the teacher (plan §5).
 */
export async function submitDailyRun(
  profileId: string,
  day: string,
  run: { mode: ClassScore['mode']; wpm: number; acc: number; rhythm: number },
  hidden: boolean,
): Promise<void> {
  if (!supabase) return;
  const memberships = await myMemberships(profileId);
  if (!memberships.length) return;
  await Promise.all(memberships.map((m) =>
    supabase!.from('class_daily_scores').upsert({
      class_id: m.classId,
      profile_id: profileId,
      day,
      mode: run.mode,
      wpm: clamp(run.wpm, 0, 260),
      acc: clamp(run.acc, 0, 100),
      rhythm: clamp(run.rhythm, 0, 100),
      hidden,
    }, { onConflict: 'class_id,profile_id,day' }),
  ));
}

/**
 * Re-send today's local best, e.g. right after joining a class (the kid may
 * already have done today's challenge) or when hideLeaderboards flips (the
 * privacy change must reach the board immediately, not at the next run).
 * Stats can only improve server-side; `hidden` always lands.
 */
export async function syncTodayScore(d: ProfileData, profileId: string): Promise<void> {
  const today = dayKey();
  const best = d.daily[today];
  if (!best) return;
  const mode = dailyChallenge(d.profile.ageGroup).mode;
  await submitDailyRun(profileId, today, { mode, wpm: best.wpm, acc: best.acc, rhythm: 0 }, d.settings.hideLeaderboards);
}

let watching = false;
let lastSubmittedRun = '';

/**
 * Bridge from the local store to the class boards, started once from main.tsx
 * after first paint. Watching the store (rather than patching Challenge.tsx)
 * keeps the surface area of the classroom feature entirely inside this module:
 * a finished challenge run appears in sessions, and its mirror is pushed in
 * the background, exactly like sync itself.
 */
export function startClassroomWatch(): () => void {
  if (!supabase || watching) return () => {};
  watching = true;
  const unsub = useStore.subscribe((s, prev) => {
    const id = s.activeId;
    if (!id) return;
    const d = s.profiles[id];
    const before = prev.profiles[id];
    if (!d || !before || d === before) return;

    // A new daily-challenge run landed in the session history.
    if (d.sessions !== before.sessions) {
      const last: SessionResult | undefined = d.sessions[d.sessions.length - 1];
      if (
        last && last.mode === 'challenge' && !last.seeded
        && last.id !== lastSubmittedRun && dayKey(last.endedAt) === dayKey()
      ) {
        lastSubmittedRun = last.id;
        const mode = dailyChallenge(d.profile.ageGroup).mode;
        void submitDailyRun(
          id, dayKey(last.endedAt),
          { mode, wpm: last.wpm, acc: last.acc, rhythm: last.rhythm },
          d.settings.hideLeaderboards,
        ).catch(() => { /* background mirror: never surfaces */ });
      }
    }

    // The privacy toggle must take effect on the board immediately.
    if (d.settings.hideLeaderboards !== before.settings.hideLeaderboards) {
      void syncTodayScore(d, id).catch(() => { /* background mirror */ });
    }
  });
  return () => { watching = false; unsub(); };
}
