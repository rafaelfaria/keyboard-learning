import { useCallback, useEffect, useMemo, useState } from 'react';
import { Btn, Card, Chip, Modal, Seg } from './ui';
import { Ic } from './icons';
import { Avatar } from './avatars';
import {
  boardsAvailable, createBoard, fetchBoard, joinBoard, listBoards,
  type BoardGroup, type BoardResult, type BoardScope,
} from '../lib/leaderboard';
import type { DailySpec } from '../lib/challenge';
import type { ProfileData } from '../lib/types';

/**
 * The Daily Challenge board.
 *
 * Three ideas drive the layout:
 *
 *   - The top three are the story, so they get a podium rather than three more
 *     table rows. Below that, ranking is reference material and a dense list
 *     reads faster than cards.
 *   - You are always on screen. If your rank is outside the visible top N, your
 *     row is pinned at the bottom with the gap made explicit, because a board
 *     that drops you reads as "you didn't count".
 *   - Rank is never carried by colour alone. The podium tints are decoration on
 *     top of a number, and "(you)" is written out next to your name.
 */

const DIVISIONS = {
  kid: 'Young Explorers',
  teen: 'Rising Stars',
  adult: 'Open division',
} as const;

const SCOPE_KEY = 'keytopia-board-scope';

export function Leaderboard({ data, spec }: { data: ProfileData; spec: DailySpec }) {
  const [groups, setGroups] = useState<BoardGroup[]>([]);
  const [scope, setScope] = useState<BoardScope>({ kind: 'global' });
  const [result, setResult] = useState<BoardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [manage, setManage] = useState(false);

  const myScore = data.daily[spec.key];

  // Restore the last scope, but only after the groups are known — a saved group
  // id the account no longer belongs to must fall back to global rather than
  // sitting there returning nothing.
  useEffect(() => {
    if (!boardsAvailable()) { setGroups([]); return; }
    let live = true;
    void listBoards(data.profile.id).then((gs) => {
      if (!live) return;
      setGroups(gs);
      const saved = localStorage.getItem(`${SCOPE_KEY}-${data.profile.id}`);
      const found = saved && gs.find((g) => g.id === saved);
      if (found) setScope({ kind: 'group', id: found.id, name: found.name });
    });
    return () => { live = false; };
  }, [data.profile.id]);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    void fetchBoard(scope, data, spec).then((r) => {
      if (live) { setResult(r); setLoading(false); }
    });
    return () => { live = false; };
    // The board changes when the scope, the day, or the learner's own score
    // does — not on every unrelated store write.
  }, [scope, spec.key, data.profile.id, myScore?.wpm, myScore?.acc]);

  useEffect(load, [load]);

  const pick = (v: string) => {
    if (v === '__manage') { setManage(true); return; }
    const next: BoardScope = v === 'global'
      ? { kind: 'global' }
      : { kind: 'group', id: v, name: groups.find((g) => g.id === v)?.name ?? 'Board' };
    setScope(next);
    localStorage.setItem(`${SCOPE_KEY}-${data.profile.id}`, v === 'global' ? '' : v);
  };

  const scopeValue = scope.kind === 'global' ? 'global' : scope.id;
  const options = [
    { v: 'global', label: <><Ic n="compass" size={14} /> Global</> },
    ...groups.map((g) => ({ v: g.id, label: <><Ic n="users" size={14} /> {g.name}</> })),
    ...(boardsAvailable() ? [{ v: '__manage', label: <><Ic n="user-plus" size={14} /> Boards</> }] : []),
  ];

  const rows = result?.rows ?? [];
  const visible = rows.filter((r) => (r.rank ?? 0) <= 20 || !r.rank);
  const podium = visible.slice(0, 3);
  const rest = visible.slice(3);
  // Your row is "detached" when the server appended it after a rank gap.
  const detached = rows.find((r) => r.you && (r.rank ?? 0) > visible.length);

  return (
    <Card className="lb">
      <div className="row spread lb-head">
        <h3 id="lb-title">
          <Ic n="medal" size={17} />{' '}
          {scope.kind === 'global' ? `${DIVISIONS[data.profile.ageGroup]} — global` : scope.name}
        </h3>
        <Btn kind="ghost" onClick={load} ariaLabel="Refresh the leaderboard"><Ic n="refresh" size={15} /></Btn>
      </div>

      {options.length > 1 && (
        <Seg options={options} value={scopeValue} onChange={pick} ariaLabel="Choose which leaderboard to show" />
      )}

      {result?.error && (
        <p className="lb-note lb-note-warn" role="status">
          <Ic n="cloud-off" size={14} /> {result.error}
        </p>
      )}

      {loading && !result ? (
        <div className="lb-skel" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => <span key={i} />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="lb-empty">
          <Ic n="hourglass" size={30} />
          <p><strong>Nobody has posted a score yet today.</strong></p>
          <p className="small muted">
            {scope.kind === 'global'
              ? 'Take the challenge and you will be the one at the top of it.'
              : 'Invite people to this board, then be the first to set the pace.'}
          </p>
        </div>
      ) : (
        <>
          <ol className="lb-podium" aria-labelledby="lb-title">
            {podium.map((r, i) => (
              <li key={`${r.name}-${i}`} className={`lb-pod lb-pod-${i + 1} ${r.you ? 'lb-you' : ''}`} style={{ ['--i' as string]: i }}>
                <span className="lb-pod-rank" aria-hidden>{r.rank ?? i + 1}</span>
                <Avatar v={r.avatar} size={40} />
                <span className="lb-pod-name">
                  {r.name}{r.you && <span className="lb-tag"> (you)</span>}
                </span>
                <span className="lb-pod-score">{r.score}</span>
                <span className="small muted">{r.wpm} wpm · {r.acc}%</span>
              </li>
            ))}
          </ol>

          {rest.length > 0 && (
            <ol className="lb-list" start={4}>
              {rest.map((r, i) => (
                <li key={`${r.name}-${i}`} className={`lb-row ${r.you ? 'lb-you' : ''}`} style={{ ['--i' as string]: i }}>
                  <span className="lb-rank">{r.rank ?? i + 4}</span>
                  <Avatar v={r.avatar} size={24} className="feed-av" />
                  <span className="lb-name">{r.name}{r.you && <span className="lb-tag"> (you)</span>}</span>
                  <span className="lb-stats small">{r.wpm} wpm · {r.acc}%</span>
                  <span className="lb-score">{r.score}</span>
                </li>
              ))}
            </ol>
          )}

          {detached && (
            <>
              <div className="lb-gap" aria-hidden>···</div>
              <ol className="lb-list" start={detached.rank}>
                <li className="lb-row lb-you">
                  <span className="lb-rank">{detached.rank}</span>
                  <Avatar v={detached.avatar} size={24} className="feed-av" />
                  <span className="lb-name">{detached.name}<span className="lb-tag"> (you)</span></span>
                  <span className="lb-stats small">{detached.wpm} wpm · {detached.acc}%</span>
                  <span className="lb-score">{detached.score}</span>
                </li>
              </ol>
            </>
          )}

          {!myScore && (
            <p className="lb-note" role="status">
              <Ic n="info" size={14} /> You haven't taken today's challenge yet. Your row appears the moment you do.
            </p>
          )}
        </>
      )}

      <p className="lb-note small muted">
        {result?.simulated ? (
          <><Ic n="bot" size={13} /> Practice rivals, generated on this device. Your score is real and saved.</>
        ) : scope.kind === 'global' ? (
          <><Ic n="shield" size={13} /> Everyone on the global board appears under a nickname. Real names show only on boards you were invited to.</>
        ) : (
          <><Ic n="users" size={13} /> Everyone here was invited with this board's code. Scores are self-reported from each device.</>
        )}
      </p>

      <ManageBoards
        open={manage}
        onClose={() => setManage(false)}
        profileId={data.profile.id}
        groups={groups}
        onChanged={(gs, focus) => {
          setGroups(gs);
          if (focus) {
            setScope({ kind: 'group', id: focus.id, name: focus.name });
            localStorage.setItem(`${SCOPE_KEY}-${data.profile.id}`, focus.id);
          }
        }}
      />
    </Card>
  );
}

/**
 * Create-or-join, in one dialog. Both paths end the same way — a board you are
 * now on and a code to pass around — so splitting them across two screens would
 * only add a decision before the useful part.
 */
function ManageBoards({ open, onClose, profileId, groups, onChanged }: {
  open: boolean; onClose: () => void; profileId: string; groups: BoardGroup[];
  onChanged: (groups: BoardGroup[], focus?: BoardGroup) => void;
}) {
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<BoardGroup['kind']>('family');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const run = async (fn: () => Promise<BoardGroup>) => {
    setBusy(true); setError(null);
    try {
      const g = await fn();
      const next = groups.some((x) => x.id === g.id) ? groups : [...groups, g];
      onChanged(next, g);
      setCode(''); setName('');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const valid = tab === 'join' ? code.trim().length === 6 : name.trim().length >= 2;

  return (
    <Modal open={open} onClose={onClose} labelledBy="boards-title">
      <h2 id="boards-title"><Ic n="users" size={20} /> Your boards</h2>
      <p className="small muted">
        A board is a private leaderboard for people you know. Share its code and they appear alongside you,
        under their real names.
      </p>

      {groups.length > 0 && (
        <div className="lb-groups">
          {groups.map((g) => (
            <div key={g.id} className="lb-group">
              <span><Ic n="medal" size={15} /> <strong>{g.name}</strong> <Chip>{g.kind}</Chip></span>
              <button
                type="button" className="lb-code"
                onClick={() => { void navigator.clipboard?.writeText(g.code); setCopied(g.id); }}
                aria-label={`Copy the join code for ${g.name}`}
              >
                {copied === g.id ? <>Copied <Ic n="tick" size={13} /></> : <>{g.code} <span className="muted">copy</span></>}
              </button>
            </div>
          ))}
        </div>
      )}

      <Seg<'join' | 'create'>
        options={[{ v: 'join', label: 'Join a board' }, { v: 'create', label: 'Create one' }]}
        value={tab} onChange={setTab} ariaLabel="Join or create a board"
      />

      <div className="lb-form">
        {tab === 'join' ? (
          <label className="lb-field">
            <span>Join code</span>
            <input
              value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123" autoComplete="off" spellCheck={false} className="lb-input-code"
            />
            <small className="muted">Six letters and numbers, from whoever created the board.</small>
          </label>
        ) : (
          <>
            <label className="lb-field">
              <span>Board name</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="The Okonkwo house" />
            </label>
            <Seg<BoardGroup['kind']>
              options={[
                { v: 'family', label: 'Family' },
                { v: 'friends', label: 'Friends' },
              ]}
              value={kind} onChange={setKind} ariaLabel="Board type"
            />
          </>
        )}

        {error && <p className="lb-note lb-note-warn" role="alert"><Ic n="warn" size={14} /> {error}</p>}

        <Btn
          disabled={busy || !valid}
          onClick={() => void run(() => (tab === 'join'
            ? joinBoard(profileId, code)
            : createBoard(profileId, name, kind)))}
        >
          {busy ? 'Working…' : tab === 'join' ? 'Join board' : 'Create board'}
        </Btn>
      </div>
    </Modal>
  );
}
