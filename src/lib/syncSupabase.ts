import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LessonProgress, Mission, Profile, ProfileData, SessionResult, Settings, KeyStat,
} from './types';
import { dayKey } from './metrics';
import { type Changeset, type Misc, type SyncAdapter } from './sync';

/**
 * The Supabase implementation of the sync seam — the only place that knows how
 * ProfileData maps onto tables (docs/schema.sql).
 *
 * Shape of the mapping:
 *   profiles         one row per learner; the LWW sections live as jsonb columns
 *   sessions         append-only rows, PK (profile_id, id) → retries are free
 *   lesson_progress  one row per lesson
 *   badges, records  set-like rows
 *   day_minutes      one row per practice day (split out of the profiles jsonb
 *                    for KeyTopia Classroom, so a teacher's minutes read is a
 *                    clean row policy — docs/classrooms-plan.md §4)
 *
 * Writes are upserts so `pushChanges` is idempotent, which is what lets the
 * engine retry blindly after a network blip. Nothing here decides conflicts:
 * merge rules are client-side in merge.ts, so the server stays a dumb store and
 * two devices reconcile identically.
 */

interface ProfileRow {
  id: string;
  profile: Profile;
  settings: Settings;
  key_stats: Record<string, KeyStat>;
  missions: ProfileData['missions'];
  misc: Misc;
  xp: number;
  touched: Record<string, number>;
}

const iso = (ms: number) => new Date(ms || Date.now()).toISOString();
const ms = (s: string) => new Date(s).getTime();

export function supabaseSync(db: SupabaseClient): SyncAdapter {
  /** Throw on error so the engine's retry/backoff sees a rejected promise. */
  const ok = <T>(res: { data: T; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  return {
    async listProfileIds() {
      const rows = ok(await db.from('profiles').select('id'));
      return (rows ?? []).map((r: { id: string }) => r.id);
    },

    async pullProfile(profileId) {
      const row = ok(
        await db.from('profiles')
          .select('id, profile, settings, key_stats, missions, misc, xp, touched')
          .eq('id', profileId)
          .maybeSingle(),
      ) as ProfileRow | null;
      if (!row) return null;

      // The five child tables in parallel — one round trip's worth of latency,
      // and this runs after first paint anyway.
      const [sessionRows, lessonRows, badgeRows, recordRows, dayRows] = await Promise.all([
        db.from('sessions').select('result').eq('profile_id', profileId)
          .order('ended_at', { ascending: true }).limit(400).then(ok),
        db.from('lesson_progress').select('lesson_id, stars, wpm, acc, earned_at').eq('profile_id', profileId).then(ok),
        db.from('badges').select('badge_id, unlocked_at').eq('profile_id', profileId).then(ok),
        db.from('records').select('key, value, set_at').eq('profile_id', profileId).then(ok),
        db.from('day_minutes').select('day, minutes').eq('profile_id', profileId).then(ok),
      ]);

      const lessons: Record<string, LessonProgress> = {};
      for (const l of (lessonRows ?? []) as { lesson_id: string; stars: number; wpm: number; acc: number; earned_at: string }[]) {
        lessons[l.lesson_id] = { stars: l.stars, wpm: l.wpm, acc: l.acc, t: ms(l.earned_at) };
      }
      const badges: Record<string, number> = {};
      for (const b of (badgeRows ?? []) as { badge_id: string; unlocked_at: string }[]) {
        badges[b.badge_id] = ms(b.unlocked_at);
      }
      const records: ProfileData['records'] = {};
      for (const r of (recordRows ?? []) as { key: string; value: number; set_at: string }[]) {
        records[r.key] = { v: r.value, t: ms(r.set_at) };
      }
      const days: Record<string, number> = {};
      for (const d of (dayRows ?? []) as { day: string; minutes: number }[]) {
        days[d.day] = d.minutes;
      }

      return {
        profile: row.profile,
        settings: row.settings,
        keyStats: row.key_stats ?? {},
        missions: row.missions,
        xp: row.xp ?? 0,
        days,
        touched: row.touched ?? {},
        sessions: ((sessionRows ?? []) as { result: SessionResult }[]).map((s) => s.result),
        lessons,
        badges,
        records,
        ...(row.misc ?? {}),
      } as Partial<ProfileData>;
    },

    async pushChanges(changes: Changeset) {
      const { profileId, since, touched, sections } = changes;
      // Child writes are collected as *factories*, not promises: the profiles
      // row must land first (foreign keys), and starting the children eagerly
      // would leave their rejections unhandled if the parent write failed.
      const children: (() => PromiseLike<unknown>)[] = [];

      // --- the profiles row: LWW sections as columns -----------------------
      // Written on every push, even when only child tables changed, so the
      // server's `touched` map stays the authoritative cursor another device
      // diffs against.
      const p = sections.profile as Profile | undefined;
      const row: Record<string, unknown> = {
        id: profileId, updated_at: new Date().toISOString(), touched,
      };
      if (p) row.profile = p;
      if (sections.settings) row.settings = sections.settings;
      if (sections.keyStats) row.key_stats = sections.keyStats;
      if (sections.missions) row.missions = sections.missions as { week: string; list: Mission[] };
      if (sections.misc) row.misc = sections.misc;
      if (sections.xp !== undefined) row.xp = sections.xp;

      // UPSERT vs UPDATE is not a style choice. Postgres builds the candidate
      // tuple for `insert … on conflict` and checks NOT NULL on it *before*
      // resolving the conflict, so an upsert that omits `profile` fails with
      // 23502 even when the row plainly exists. Any diff without the profile
      // section — finishing a lesson, a practice run, a theme unlock — is
      // exactly that case. The first push always carries every section
      // (fullChangeset at cursor 0), so by the time a partial diff happens the
      // row is guaranteed to exist and UPDATE is both safe and correct.
      // The profiles row must land before its children (foreign keys), so it
      // is awaited on its own before anything else starts.
      if (p) await db.from('profiles').upsert(row, { onConflict: 'id' }).then(ok);
      else await db.from('profiles').update(row).eq('id', profileId).then(ok);

      // --- append-only history --------------------------------------------
      // Only sessions newer than the cursor: re-uploading 400 rows on every
      // practice run would be correct but wasteful.
      const sessions = (sections.sessions as SessionResult[] | undefined)?.filter((s) => s.endedAt > since);
      if (sessions?.length) {
        children.push(() => db.from('sessions').upsert(
          sessions.map((s) => ({
            profile_id: profileId,
            id: s.id,
            ended_at: iso(s.endedAt),
            mode: s.mode,
            // Timelines are the bulky part and are already trimmed to the last
            // few runs locally; drop them entirely server-side.
            result: { ...s, timeline: undefined, ikis: undefined },
          })),
          { onConflict: 'profile_id,id' },
        ).then(ok));
      }

      const lessons = sections.lessons as Record<string, LessonProgress> | undefined;
      if (lessons && Object.keys(lessons).length) {
        children.push(() => db.from('lesson_progress').upsert(
          Object.entries(lessons).map(([lesson_id, l]) => ({
            profile_id: profileId, lesson_id, stars: l.stars, wpm: l.wpm, acc: l.acc, earned_at: iso(l.t),
          })),
          { onConflict: 'profile_id,lesson_id' },
        ).then(ok));
      }

      const badges = sections.badges as Record<string, number> | undefined;
      if (badges && Object.keys(badges).length) {
        children.push(() => db.from('badges').upsert(
          Object.entries(badges).map(([badge_id, t]) => ({ profile_id: profileId, badge_id, unlocked_at: iso(t) })),
          { onConflict: 'profile_id,badge_id' },
        ).then(ok));
      }

      const records = sections.records as ProfileData['records'] | undefined;
      if (records && Object.keys(records).length) {
        children.push(() => db.from('records').upsert(
          Object.entries(records).map(([key, r]) => ({ profile_id: profileId, key, value: r.v, set_at: iso(r.t) })),
          { onConflict: 'profile_id,key' },
        ).then(ok));
      }

      // Practice minutes: one row per day. Only recent days travel — old days
      // never change locally (sessions always land on "today"), so a 45-day
      // window covers every writable day while keeping a year-old profile from
      // re-uploading hundreds of rows on each push. The first push (cursor 0)
      // still sends the full calendar.
      const days = sections.days as Record<string, number> | undefined;
      if (days) {
        const cutoff = since === 0 ? '' : dayKey(since - 45 * 86400_000);
        const rows = Object.entries(days)
          .filter(([day]) => day >= cutoff)
          .map(([day, minutes]) => ({
            profile_id: profileId, day,
            minutes: Math.min(1440, Math.max(0, minutes)),
          }));
        if (rows.length) {
          children.push(() => db.from('day_minutes').upsert(rows, { onConflict: 'profile_id,day' }).then(ok));
        }
      }

      await Promise.all(children.map((run) => run()));
    },
  };
}
