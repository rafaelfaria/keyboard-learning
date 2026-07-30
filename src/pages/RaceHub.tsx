import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/store';
import { CPU_LEVELS, makeRacers, recentAvgWpm, type RacerSpec } from '../lib/challenge';
import { SENTENCES, KID_SENTENCES, RACER_NAMES, CLASSMATE_NAMES } from '../lib/words';
import { mulberry32, pick, pickN } from '../lib/rng';
import { setRaceSetup } from '../lib/race';
import { Btn, Card, Chip, Stat } from '../components/ui';
import { Ic } from '../components/icons';
import { Avatar } from '../components/avatars';

function raceText(kid: boolean, seedN?: number): string {
  const rng = mulberry32(seedN ?? (Date.now() % 1e9));
  return pickN(rng, kid ? KID_SENTENCES : SENTENCES, kid ? 2 : 3).join(' ');
}

interface LobbyPlayer { name: string; avatar: string; ready: boolean; you?: boolean; joinedAt: number }

export default function RaceHub() {
  const data = useData();
  const nav = useNavigate();
  const [difficulty, setDifficulty] = useState<string>('casual');
  const [lobby, setLobby] = useState<null | { code: string; players: LobbyPlayer[]; host: boolean }>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  if (!data) return null;
  const kid = data.profile.ageGroup === 'kid';
  const avg = recentAvgWpm(data);

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
    setRaceSetup({ kind: 'ghost', label: 'Ghost race — you vs. your best', racers: [], text: raceText(kid), withGhost: true });
    nav('/app/race/live');
  };

  const openLobby = (host: boolean, code?: string) => {
    const rng = mulberry32(Date.now() % 1e9);
    const c = code ?? `TYP-${Math.floor(rng() * 900) + 100}`;
    const names = kid ? CLASSMATE_NAMES : RACER_NAMES;
    const avatars = ['🐧', '🦉', '🐢', '🐬', '🦜', '🦔'];
    setLobby({ code: c, host, players: [{ name: data.profile.name, avatar: data.profile.avatar, ready: true, you: true, joinedAt: Date.now() }] });
    // simulated friends trickle in and ready up
    const joiners = pickN(rng, names, 3);
    joiners.forEach((n, i) => {
      timers.current.push(window.setTimeout(() => {
        setLobby((l) => l && ({ ...l, players: [...l.players, { name: n, avatar: avatars[(i * 2) % avatars.length], ready: false, joinedAt: Date.now() }] }));
        timers.current.push(window.setTimeout(() => {
          setLobby((l) => l && ({ ...l, players: l.players.map((p) => p.name === n ? { ...p, ready: true } : p) }));
        }, 900 + Math.random() * 2600));
      }, 700 + i * 1300 + Math.random() * 800));
    });
  };

  const startRoomRace = () => {
    if (!lobby) return;
    const rng = mulberry32(Date.now() % 1e9);
    const others = lobby.players.filter((p) => !p.you);
    const racers: RacerSpec[] = others.map((p) => ({
      name: p.name, avatar: p.avatar,
      baseWpm: Math.max(10, avg + (rng() - 0.5) * avg * 0.3),
      volatility: 0.3, stumbleRate: 2, sprintFinish: rng() > 0.5, personality: 'friend',
    }));
    setRaceSetup({ kind: 'room', label: `Room ${lobby.code}`, racers, text: raceText(kid), withGhost: false, roomCode: lobby.code });
    nav('/app/race/live');
  };

  const join = () => {
    if (joinCode.trim().length < 3) return;
    setJoining(true);
    timers.current.push(window.setTimeout(() => {
      setJoining(false);
      openLobby(false, joinCode.trim().toUpperCase());
    }, 1200));
  };

  if (lobby) {
    const allReady = lobby.players.length >= 2 && lobby.players.every((p) => p.ready);
    return (
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <div className="page-head"><h1><Ic n="rocket" size={22} /> Race room</h1><Btn kind="ghost" onClick={() => { timers.current.forEach(clearTimeout); setLobby(null); }}>← Leave room</Btn></div>
        <Card>
          <p className="small muted center">Share this code with friends so they can join:</p>
          <div className="lobby-code" style={{ margin: '10px auto', maxWidth: 280 }}>{lobby.code}</div>
          <p className="small muted center" style={{ marginBottom: 14 }}>Offline demo — friends here are simulated. Real rooms connect when KeyTopia goes online. Your race still counts!</p>
          <div>
            {lobby.players.map((p) => (
              <div className="lobby-player" key={p.name}>
                <Avatar v={p.avatar} size={26} />
                <strong>{p.name}</strong>
                {p.you && <Chip tone="accent">you</Chip>}
                <span className={`ready-dot ${p.ready ? 'rdy' : ''}`} title={p.ready ? 'Ready' : 'Not ready'} />
              </div>
            ))}
            {lobby.players.length < 4 && <p className="small muted" style={{ paddingTop: 8 }}>Waiting for players…</p>}
          </div>
          <div className="row gap" style={{ marginTop: 16 }}>
            <Btn onClick={startRoomRace} disabled={!allReady}>{allReady ? <><Ic n="flag" size={15} /> Start race</> : 'Waiting for ready…'}</Btn>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>The Lightstream</h1>
          <p>Comet racing across the night. Speed wins races — but accuracy keeps your comet burning bright.</p>
        </div>
        <div className="row gap">
          <Stat v={data.race.races} l="races" />
          <Stat v={data.race.wins} l="wins" tone="good" />
          <Stat v={data.race.bestWpm || '—'} l="best wpm" tone="accent" />
        </div>
      </div>

      <div className="grid2">
        <Card>
          <h3><Ic n="bot" size={17} /> CPU race</h3>
          <p className="small muted">Three rival comets with believable habits — some stumble, some sprint the finish.</p>
          <div className="col" style={{ gap: 6, margin: '12px 0' }}>
            {CPU_LEVELS.map((l) => (
              <button key={l.id} type="button" className={`opt-tile ${difficulty === l.id ? 'on' : ''}`} onClick={() => setDifficulty(l.id)} aria-pressed={difficulty === l.id}>
                <span className="opt-ic"><Ic n={l.id === 'adaptive' ? 'sliders' : l.id === 'expert' ? 'flame' : l.id === 'skilled' ? 'sparkles' : l.id === 'casual' ? 'moon' : 'sprout'} size={22} /></span>
                <span><strong>{l.name}{l.id === 'adaptive' ? ` (~${Math.round(avg)} wpm)` : ` (~${l.wpm} wpm)`}</strong><small>{l.desc}</small></span>
              </button>
            ))}
          </div>
          <Btn onClick={startCpu} big><Ic n="flag" size={17} /> Race now</Btn>
        </Card>

        <div className="col gap">
          <Card>
            <h3><Ic n="ghost" size={17} /> Ghost race</h3>
            <p className="small muted">
              {data.ghost
                ? `Race the recording of your best run — ${data.ghost.wpm} wpm at ${data.ghost.acc}% accuracy.`
                : 'Finish one race and your best run becomes a ghost you can challenge.'}
            </p>
            <div style={{ marginTop: 12 }}>
              <Btn onClick={startGhost} disabled={!data.ghost} kind={data.ghost ? 'primary' : 'soft'}>Race your ghost</Btn>
            </div>
          </Card>
          <Card>
            <h3><Ic n="ticket" size={17} /> Private room</h3>
            <p className="small muted">Create a room and share the code, or join a friend's room. Safe usernames only — no chat, no strangers.</p>
            <div className="row gap wrap" style={{ marginTop: 12 }}>
              <Btn onClick={() => openLobby(true)}>Create room</Btn>
              <input
                className="ob-input" style={{ maxWidth: 150, padding: '9px 12px' }} placeholder="TYP-000"
                value={joinCode} onChange={(e) => setJoinCode(e.target.value)} aria-label="Room code"
              />
              <Btn kind="soft" onClick={join} disabled={joining}>{joining ? 'Finding…' : 'Join'}</Btn>
            </div>
          </Card>
          <Card style={{ position: 'relative' }} className="card">
            <Chip className="concept-tag">Concept preview</Chip>
            <h3><Ic n="trophy" size={17} /> Ranked seasons</h3>
            <p className="small muted">Skill-matched ladders with age-separated divisions, promotion series and seasonal rewards — arriving with online play. Kids race only in protected school & family divisions.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
