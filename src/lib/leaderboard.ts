import { supabase } from './supabase';
import { dailyBoard, type BoardRow, type DailySpec } from './challenge';
import type { AgeGroup, ProfileData } from './types';

/**
 * Daily Challenge leaderboards — the client half of
 * supabase/migrations/20260814120000_daily_leaderboards.sql.
 *
 * Two kinds of board, and the difference is a privacy rule, not a filter:
 *
 *   global   everyone in your age division, shown under generated aliases.
 *            Postgres derives the alias from the profile id, so no real name
 *            can reach a stranger even from a tampered client.
 *   group    a board someone was invited to (family, class, friends). Real
 *            names, because everybody on it knows everybody on it.
 *
 * Every read degrades rather than fails. With no Supabase project configured,
 * no account signed in, or no network, the caller gets the simulated board that
 * shipped before this file existed, flagged `simulated` so the UI can say so.
 * A leaderboard is not worth a blocked page.
 */

export type BoardScope =
  | { kind: 'global' }
  | { kind: 'group'; id: string; name: string };

export interface BoardGroup {
  id: string;
  code: string;
  name: string;
  /**
   * Social boards only. A classroom is a separate product surface with a
   * roster and a teacher (see supabase/migrations/…_classrooms.sql), and it
   * has its own join codes — so 'class' deliberately is not a board kind.
   */
  kind: 'family' | 'friends';
}

export interface BoardResult {
  rows: BoardRow[];
  /** Rows are seeded rivals, not real people. The UI must disclose this. */
  simulated: boolean;
  /** The learner's rank, even when their row sits outside the visible top N. */
  yourRank: number | null;
  /** How many learners posted a score, when the source can tell us. */
  total: number | null;
  /** Set when a real board was wanted but could not be reached. */
  error: string | null;
}

interface RpcRow {
  rank: number;
  name: string;
  avatar: string;
  wpm: number;
  acc: number;
  score: number;
  you: boolean;
}

/** Signed in, configured, and therefore able to see real people. */
export function boardsAvailable(): boolean {
  return Boolean(supabase);
}

/**
 * Publish today's result. Fire-and-forget by design: the score is already saved
 * locally by the time this runs, so a failure here costs a board position, not
 * data. Keeping the best of the day is the server's job (see the upsert below),
 * which is what makes retrying safe.
 */
export async function submitDailyScore(
  data: ProfileData,
  spec: DailySpec,
  r: { wpm: number; acc: number; rhythm: number },
): Promise<boolean> {
  if (!supabase) return false;
  // The learner asked not to be on boards. That has to mean "not uploaded",
  // not merely "not displayed" — otherwise the setting is decoration.
  if (data.settings.hideLeaderboards) return false;

  const row = {
    day_key: spec.key,
    profile_id: data.profile.id,
    age_group: data.profile.ageGroup,
    mode: spec.mode,
    wpm: Math.max(0, Math.min(250, r.wpm)),
    acc: Math.max(0, Math.min(100, r.acc)),
    rhythm: Math.max(0, Math.min(100, r.rhythm || 0)),
    display_name: data.profile.name.slice(0, 40),
    avatar: data.profile.avatar.slice(0, 64),
  };

  // `score` is a generated column, so "did today improve?" can only be asked
  // after the fact — hence upsert-then-compare rather than a conditional write.
  const { error } = await supabase.from('daily_scores').upsert(row, { onConflict: 'day_key,profile_id' });
  return !error;
}

/**
 * A learner's own score is kept as their day's best. Postgres cannot express
 * that in the upsert above without duplicating the scoring formula in a WHERE
 * clause, so the client checks first and skips writes that would lower it.
 */
export async function submitBestDailyScore(
  data: ProfileData,
  spec: DailySpec,
  r: { wpm: number; acc: number; rhythm: number },
): Promise<boolean> {
  if (!supabase || data.settings.hideLeaderboards) return false;
  const { data: existing } = await supabase
    .from('daily_scores')
    .select('score')
    .eq('day_key', spec.key)
    .eq('profile_id', data.profile.id)
    .maybeSingle();
  if (existing) {
    const { scoreFor } = await import('./challenge');
    if (scoreFor(spec.mode, r.wpm, r.acc, r.rhythm) <= (existing as { score: number }).score) return true;
  }
  return submitDailyScore(data, spec, r);
}

/** Boards this profile belongs to. Empty when signed out — never throws. */
export async function listBoards(profileId: string): Promise<BoardGroup[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('board_members')
    .select('boards ( id, code, name, kind )')
    .eq('profile_id', profileId);
  if (error || !data) return [];
  // PostgREST types an embedded relation as an array even when the foreign key
  // makes it at most one row, so flatten rather than assuming either shape.
  return (data as unknown as { boards: BoardGroup | BoardGroup[] | null }[])
    .flatMap((r) => (Array.isArray(r.boards) ? r.boards : r.boards ? [r.boards] : []));
}

export async function createBoard(profileId: string, name: string, kind: BoardGroup['kind']): Promise<BoardGroup> {
  if (!supabase) throw new Error('Sign in to create a board.');
  const { data, error } = await supabase.rpc('create_board', {
    p_name: name.trim().slice(0, 40),
    p_kind: kind,
    p_profile_id: profileId,
  });
  if (error) throw new Error(readableBoardError(error.message));
  return (data as BoardGroup[])[0];
}

/**
 * Postgres exception text is not user copy. The anonymous case is the one that
 * will actually be hit: a child on a school seat has no household account, and
 * "anonymous sessions cannot create boards" is not something to show them.
 */
function readableBoardError(message: string): string {
  if (message.includes('anonymous sessions')) {
    return 'Boards need a household account. Ask a grown-up to sign in, then you can make one together.';
  }
  if (message.includes('no board with that code')) {
    return "That code doesn't match any board. Check it and try again.";
  }
  if (message.includes('profile does not belong')) {
    return 'That explorer belongs to a different account.';
  }
  return message;
}

export async function joinBoard(profileId: string, code: string): Promise<BoardGroup> {
  if (!supabase) throw new Error('Sign in to join a board.');
  const { data, error } = await supabase.rpc('join_board', {
    p_code: code.trim().toUpperCase(),
    p_profile_id: profileId,
  });
  if (error) throw new Error(readableBoardError(error.message));
  return (data as BoardGroup[])[0];
}

/**
 * The board for a scope. `you` is merged in by the server for real boards, and
 * locally for the simulated one, so the caller never has to special-case it.
 */
export async function fetchBoard(
  scope: BoardScope,
  data: ProfileData,
  spec: DailySpec,
  limit = 20,
): Promise<BoardResult> {
  const me = data.daily[spec.key];
  const fallback = (error: string | null): BoardResult => ({
    rows: dailyBoard(
      data.profile.ageGroup, spec,
      me ? { name: data.profile.name, avatar: data.profile.avatar, wpm: me.wpm, acc: me.acc } : undefined,
    ),
    simulated: true,
    yourRank: null,
    total: null,
    error,
  });

  if (!supabase) return fallback(null);

  try {
    const rpc = scope.kind === 'global'
      ? supabase.rpc('daily_board_global', {
          p_day: spec.key,
          p_age: data.profile.ageGroup as AgeGroup,
          p_profile_id: data.profile.id,
          p_limit: limit,
        })
      : supabase.rpc('daily_board_group', {
          p_day: spec.key,
          p_board_id: scope.id,
          p_profile_id: data.profile.id,
          p_limit: limit,
        });

    const { data: rows, error } = await rpc;
    if (error) return fallback('Board unavailable right now. Showing practice rivals instead.');

    const list = (rows ?? []) as RpcRow[];
    return {
      rows: list.map((r) => ({
        name: r.name,
        avatar: r.avatar || `bk:${(r.rank * 7) % 12}`,
        wpm: Math.round(r.wpm),
        acc: Math.round(r.acc),
        score: r.score,
        you: r.you,
        rank: r.rank,
      })),
      simulated: false,
      yourRank: list.find((r) => r.you)?.rank ?? null,
      total: list.length,
      error: null,
    };
  } catch {
    return fallback('No connection. Showing practice rivals instead.');
  }
}
