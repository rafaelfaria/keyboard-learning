import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/store';
import { CPU_LEVELS, makeRacers, recentAvgWpm, type RacerSpec } from '../lib/challenge';
import { SENTENCES, KID_SENTENCES, RACER_NAMES, CLASSMATE_NAMES } from '../lib/words';
import { mulberry32, pickN } from '../lib/rng';
import { setRaceSetup } from '../lib/race';
import { Room, currentRoom, makeRoomCode, normalizeCode, roomsLive, type RoomPhase, type RoomPlayer } from '../lib/room';
import { Btn, Card, Chip, Seg } from '../components/ui';
import { Ic } from '../components/icons';
import { Avatar } from '../components/avatars';

function raceText(kid: boolean): string {
  const rng = mulberry32(Date.now() % 1e9);
  return pickN(rng, kid ? KID_SENTENCES : SENTENCES, kid ? 2 : 3).join(' ');
}

const DIFF_ICON: Record<string, string> = {
  beginner: 'sprout', casual: 'moon', skilled: 'sparkles', expert: 'flame', adaptive: 'sliders',
};

export default function RaceHub() {
  const data = useData();
  const nav = useNavigate();
  const [difficulty, setDifficulty] = useState<string>('casual');

  // Live room (Supabase Realtime). Survives navigation into a race, so coming
  // back from a finished race lands in the lobby you already belong to.
  const [room, setRoom] = useState<Room | null>(() => currentRoom());
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [phase, setPhase] = useState<RoomPhase>('open');
  const [roomError, setRoomError] = useState<string | null>(null);

  // Practice room: the same lobby against simulated friends, for when there is
  // no project configured or no connection.
  const [sim, setSim] = useState<null | { code: string; players: RoomPlayer[] }>(null);
  const simTimers = useRef<number[]>([]);

  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => () => { simTimers.current.forEach(clearTimeout); }, []);

  useEffect(() => {
    if (!room) return;
    room.reopen();
    setPlayers(room.players);
    setPhase(room.phase);
    room.on({
      onPlayers: (ps) => setPlayers([...ps]),
      onPhase: (p, e) => { setPhase(p); setRoomError(e ?? null); },
      onStart: ({ text }) => {
        setRaceSetup({
          kind: 'room',
          label: `Room ${room.code}`,
          racers: [],
          remotes: room.players.filter((p) => !p.you).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })),
          text,
          withGhost: false,
          roomCode: room.code,
          live: true,
        });
        nav('/app/race/live');
      },
    });
  }, [room, nav]);

  if (!data) return null;
  const kid = data.profile.ageGroup === 'kid';
  const avg = recentAvgWpm(data);
  const hasHistory = data.sessions.length > 0;
  const live = roomsLive();

  // ---------- starts ----------

  const startCpu = () => {
    const lvl = CPU_LEVELS.find((l) => l.id === difficulty) ?? CPU_LEVELS[1];
    const target = lvl.id === 'adaptive' ? avg : lvl.wpm;
    const rng = mulberry32(Date.now() % 1e9);
    setRaceSetup({
      kind: 'cpu',
      label: `${lvl.name} CPU race`,
      racers: makeRacers(rng, target, 3),
      text: raceText(kid),
      withGhost: false,
    });
    nav('/app/race/live');
  };

  const startGhost = () => {
    if (!data.ghost) return;
    setRaceSetup({ kind: 'ghost', label: 'Ghost race', racers: [], text: raceText(kid), withGhost: true });
    nav('/app/race/live');
  };

  // ---------- rooms ----------

  const me = { id: data.profile.id, name: data.profile.name, avatar: data.profile.avatar };

  const createRoom = () => {
    if (!live) { openSimRoom(`TYP-${Math.floor(Math.random() * 900) + 100}`); return; }
    setRoomError(null);
    setRoom(Room.open(makeRoomCode(), me, { expectOthers: false }));
  };

  const joinRoom = () => {
    const code = normalizeCode(joinCode);
    if (code.length < 5) { setRoomError('Room codes look like TYP-4KQ2.'); return; }
    if (!live) { setJoining(true); simTimers.current.push(window.setTimeout(() => { setJoining(false); openSimRoom(code); }, 900)); return; }
    setRoomError(null);
    setRoom(Room.open(code, me, { expectOthers: true }));
  };

  const leaveRoom = () => {
    room?.leave();
    setRoom(null);
    setPlayers([]);
    setRoomError(null);
    simTimers.current.forEach(clearTimeout);
    setSim(null);
  };

  const openSimRoom = (code: string) => {
    const rng = mulberry32(Date.now() % 1e9);
    const names = pickN(rng, kid ? CLASSMATE_NAMES : RACER_NAMES, 3);
    const avatars = ['bk:2', 'bk:5', 'bk:8'];
    setSim({ code, players: [{ ...me, ready: true, joinedAt: Date.now(), you: true }] });
    names.forEach((n, i) => {
      simTimers.current.push(window.setTimeout(() => {
        setSim((l) => l && ({ ...l, players: [...l.players, { id: n, name: n, avatar: avatars[i % 3], ready: false, joinedAt: Date.now() }] }));
        simTimers.current.push(window.setTimeout(() => {
          setSim((l) => l && ({ ...l, players: l.players.map((p) => (p.id === n ? { ...p, ready: true } : p)) }));
        }, 900 + rng() * 2400));
      }, 700 + i * 1200));
    });
  };

  const startSimRace = () => {
    if (!sim) return;
    const rng = mulberry32(Date.now() % 1e9);
    const racers: RacerSpec[] = sim.players.filter((p) => !p.you).map((p) => ({
      name: p.name, avatar: p.avatar,
      baseWpm: Math.max(10, avg + (rng() - 0.5) * avg * 0.3),
      volatility: 0.3, stumbleRate: 2, sprintFinish: rng() > 0.5, personality: 'friend',
    }));
    setRaceSetup({ kind: 'room', label: `Practice room ${sim.code}`, racers, text: raceText(kid), withGhost: false, roomCode: sim.code });
    nav('/app/race/live');
  };

  const copyCode = (code: string) => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  // ---------- lobby ----------

  const lobbyCode = room?.code ?? sim?.code;
  if (lobbyCode) {
    const list = room ? players : sim!.players;
    const isHost = room ? room.isHost : true;
    const allReady = list.length >= 2 && list.every((p) => p.ready);
    const meRow = list.find((p) => p.you);
    const startRace = () => (room ? room.start(raceText(kid)) : startSimRace());

    return (
      <div className="ls-lobby">
        <div className="page-head">
          <div>
            <h1><Ic n="ticket" size={22} /> Race room</h1>
            <p>{room ? 'Everyone here is a real person on their own keyboard.' : 'Practice room. These friends are simulated, and your race still counts.'}</p>
          </div>
          <Btn kind="ghost" onClick={leaveRoom}>← Leave room</Btn>
        </div>

        <Card>
          <p className="small muted center">Share this code so friends can join</p>
          <button type="button" className="lobby-code lobby-code-btn" onClick={() => copyCode(lobbyCode)} aria-label={`Room code ${lobbyCode}. Copy to clipboard.`}>
            {lobbyCode}
            <span className="lobby-copy"><Ic n={copied ? 'tick' : 'clipboard'} size={16} /> {copied ? 'Copied' : 'Copy'}</span>
          </button>

          {phase === 'connecting' && <p className="small muted center">Connecting to the room…</p>}
          {roomError && <p className="small warnline center" role="status"><Ic n="warn" size={14} /> {roomError}</p>}

          <div className="lobby-list">
            {list.map((p) => (
              <div className="lobby-player" key={p.id}>
                <Avatar v={p.avatar} size={26} />
                <strong>{p.name}</strong>
                {p.you && <Chip tone="accent">you</Chip>}
                {list[0]?.id === p.id && <Chip>host</Chip>}
                <span className={`ready-dot ${p.ready ? 'rdy' : ''}`} />
                <span className="small muted lobby-ready-txt">{p.ready ? 'Ready' : 'Not ready'}</span>
              </div>
            ))}
            {list.length < 2 && phase !== 'empty' && (
              <p className="small muted lobby-waiting"><span className="lobby-pulse" aria-hidden /> Waiting for friends to join…</p>
            )}
          </div>

          <div className="row gap wrap lobby-actions">
            {room && (
              <Btn kind={meRow?.ready ? 'soft' : 'primary'} onClick={() => room.setReady(!meRow?.ready)}>
                {meRow?.ready ? 'Cancel ready' : "I'm ready"}
              </Btn>
            )}
            {isHost ? (
              <Btn onClick={startRace} disabled={!allReady} big>
                <Ic n="flag" size={16} /> {allReady ? 'Start race' : list.length < 2 ? 'Waiting for players' : 'Waiting for ready'}
              </Btn>
            ) : (
              <span className="small muted">The host starts the race when everyone is ready.</span>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ---------- hub ----------

  const lvl = CPU_LEVELS.find((l) => l.id === difficulty) ?? CPU_LEVELS[1];

  return (
    <div className="ls-hub">
      <header className="ls-hero">
        <span className="rh-sky" aria-hidden />
        <span aria-hidden><i className="rh-comet" /><i className="rh-comet" /><i className="rh-comet" /></span>
        <div className="ls-hero-txt">
          <h1>The Lightstream</h1>
          <p>Comet racing across the night. Speed wins races, and accuracy keeps your comet burning bright.</p>
        </div>
        <dl className="ls-career">
          <div><dt>Races</dt><dd>{data.race.races}</dd></div>
          <div><dt>Wins</dt><dd className="good">{data.race.wins}</dd></div>
          <div><dt>Best wpm</dt><dd className="accent">{data.race.bestWpm || '—'}</dd></div>
        </dl>
      </header>

      <div className="ls-grid">
        <Card className="ls-cpu">
          <div className="ls-card-head">
            <h3><Ic n="bot" size={17} /> CPU race</h3>
            <Chip>Always available</Chip>
          </div>
          <p className="small muted">Three rival comets with believable habits. Some stumble, some sprint the finish.</p>

          <div className="ls-diffs" role="radiogroup" aria-label="CPU difficulty">
            {CPU_LEVELS.map((l) => {
              const on = difficulty === l.id;
              const pace = l.id === 'adaptive'
                ? (hasHistory ? `~${Math.round(avg)} wpm` : 'your pace')
                : `~${l.wpm} wpm`;
              return (
                <button
                  key={l.id} type="button" role="radio" aria-checked={on}
                  className={`opt-tile ${on ? 'on' : ''}`} onClick={() => setDifficulty(l.id)}
                >
                  <span className="opt-ic"><Ic n={DIFF_ICON[l.id]} size={22} /></span>
                  <span>
                    <strong>{l.name} <span className="ls-pace">{pace}</span></strong>
                    <small>{l.desc}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="ls-cta-row">
            <Btn onClick={startCpu} big><Ic n="flag" size={17} /> Race now</Btn>
            <span className="small muted">{lvl.name} rivals · {kid ? '2' : '3'} sentences</span>
          </div>
        </Card>

        <div className="col gap">
          <Card className={data.ghost ? 'ls-ghost ls-ghost-on' : 'ls-ghost'}>
            <div className="ls-card-head">
              <h3><Ic n="ghost" size={17} /> Ghost race</h3>
              {data.ghost && <Chip tone="accent">{data.ghost.wpm} wpm</Chip>}
            </div>
            {data.ghost ? (
              <>
                <p className="small muted">Race the recording of your best run: {data.ghost.wpm} wpm at {data.ghost.acc}% accuracy. Beat it and the ghost becomes your new best.</p>
                <div className="ls-cta-row">
                  <Btn onClick={startGhost}><Ic n="ghost" size={16} /> Race your ghost</Btn>
                </div>
              </>
            ) : (
              <>
                <p className="small muted">Your best run gets recorded as a ghost you can chase. Finish one race at 85% accuracy or better to unlock it.</p>
                <div className="ls-cta-row">
                  <Btn kind="soft" onClick={startCpu}><Ic n="flag" size={16} /> Race to unlock</Btn>
                </div>
              </>
            )}
          </Card>

          <Card className="ls-room">
            <div className="ls-card-head">
              <h3><Ic n="ticket" size={17} /> Private room</h3>
              <Chip tone={live ? 'good' : 'default'}>{live ? 'Live' : 'Practice mode'}</Chip>
            </div>
            <p className="small muted">
              {live
                ? 'Create a room and share the code, or join a friend’s room. Safe usernames only, no chat, no strangers.'
                : 'Rooms run against simulated friends until you sign in. Safe usernames only, no chat, no strangers.'}
            </p>
            <div className="ls-room-actions">
              <Btn onClick={createRoom}><Ic n="ticket" size={16} /> Create room</Btn>
              <span className="ls-join">
                <label htmlFor="ls-code" className="ls-join-label">Have a code?</label>
                <span className="row gap">
                  <input
                    id="ls-code" className="ob-input ls-code-input" placeholder="TYP-4KQ2" maxLength={10}
                    value={joinCode} onChange={(e) => { setJoinCode(e.target.value); setRoomError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(); }}
                  />
                  <Btn kind="soft" onClick={joinRoom} disabled={joining || !joinCode.trim()}>{joining ? 'Finding…' : 'Join'}</Btn>
                </span>
              </span>
            </div>
            {roomError && <p className="small warnline" role="status"><Ic n="warn" size={14} /> {roomError}</p>}
          </Card>
        </div>
      </div>

      <StandingsPreview name={data.profile.name} avatar={data.profile.avatar} best={data.race.bestWpm} />
    </div>
  );
}

/**
 * Rankings, shown as the shape they will take rather than as a promise in
 * prose. The rows are visibly locked so nothing here can be mistaken for a real
 * standing, and the copy says plainly that races already count toward it.
 */
function StandingsPreview({ name, avatar, best }: { name: string; avatar: string; best: number }) {
  const [scope, setScope] = useState<'friends' | 'class' | 'global'>('friends');
  const blurb = {
    friends: 'Friends you have raced in private rooms.',
    class: 'Your class or family group, with real names, because everyone on it knows everyone on it.',
    global: 'Everyone in your age division, under generated aliases.',
  }[scope];

  return (
    <Card className="ls-standings">
      <div className="ls-card-head">
        <h3><Ic n="trophy" size={17} /> Standings</h3>
        <Chip className="concept-tag-inline">Coming soon</Chip>
      </div>
      <div className="ls-standings-bar">
        <Seg
          ariaLabel="Standings scope"
          value={scope}
          onChange={setScope}
          options={[{ v: 'friends', label: 'Friends' }, { v: 'class', label: 'Class' }, { v: 'global', label: 'Global' }]}
        />
        <span className="small muted">{blurb}</span>
      </div>

      <ol className="ls-board" aria-label="Standings preview, not yet ranked">
        {[1, 2, 3, 4].map((rank) => (
          <li key={rank} className="ls-board-row ls-board-locked">
            <span className={`ls-rank ls-rank-${rank}`}>{rank}</span>
            <span className="ls-skel ls-skel-av" aria-hidden />
            <span className="ls-skel ls-skel-name" aria-hidden />
            <span className="ls-skel ls-skel-wpm" aria-hidden />
          </li>
        ))}
        <li className="ls-board-row ls-board-you">
          <span className="ls-rank ls-rank-you"><Ic n="lock" size={13} /></span>
          <Avatar v={avatar} size={24} />
          <span className="ls-board-name">{name} <Chip tone="accent">you</Chip></span>
          <span className="ls-board-wpm">{best ? `${best} wpm` : 'no races yet'}</span>
        </li>
      </ol>

      <p className="small muted ls-standings-foot">
        Ladders, promotion series and seasonal rewards arrive with online play. Kids race only in protected school and family divisions. Every race you run now still counts toward your first placement.
      </p>
    </Card>
  );
}
