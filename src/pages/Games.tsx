import { Link } from 'react-router-dom';
import { useData } from '../lib/store';
import { Card, Chip } from '../components/ui';
import { Ic } from '../components/icons';

const COMPETITIVE = [
  {
    id: 'duel', name: 'Quill Duel', icon: 'swords', to: '/app/games/duel',
    desc: 'Best-of-seven phrase duel against a rival matched to your pace. First to finish each phrase takes the round.',
    trains: 'Burst speed under pressure',
  },
  {
    id: 'survivor', name: 'Survivor Sprint', icon: 'crown', to: '/app/games/survivor',
    desc: 'Eight typists, four rapid heats, the slowest move to the cheer bench each round. Outlast everyone for the crown.',
    trains: 'Consistency under pressure',
  },
];

const QUESTS = [
  {
    id: 'wordfall', name: 'Wordfall Defence', icon: 'shield', to: '/app/games/wordfall',
    desc: 'Words drift toward your light-shield. Careless speed weakens it; calm accuracy saves the city.',
    trains: 'Accuracy under pressure',
  },
  {
    id: 'stack', name: 'Block Stack', icon: 'blocks', to: '/app/games/stack',
    desc: 'Every word becomes a block. Clean words build wide and steady, sloppy ones crumble the tower.',
    trains: 'Word-perfect precision',
  },
  {
    id: 'cipher', name: 'Cipher Run', icon: 'puzzle', to: '/app/games/cipher',
    desc: 'Unscramble rune-words against the clock. Decoding builds the deep letter-map fast typing sits on.',
    trains: 'Spelling recall & mapping',
  },
  {
    id: 'keyforge', name: 'Keyforge', icon: 'hammer', to: '/app/games/keyforge',
    desc: 'The fire only burns while you type. Misses vent heat, every treasure makes it hungrier. Forge before it goes cold.',
    trains: 'Fast, flawless words',
  },
  {
    id: 'wordflight', name: 'Wordflight', icon: 'send', to: '/app/games/wordflight',
    desc: 'A glider that climbs when your rhythm is even and wobbles when you rush. Thread the golden gates.',
    trains: 'Rhythm & flow',
  },
];

/* Little living scene per game, same vocabulary as the landing page's
   play-art tiles but drawn with theme tokens so every app theme works. */
function GameArt({ id }: { id: string }) {
  switch (id) {
    case 'duel':
      return (
        <div className="arena-art ga-duel" aria-hidden>
          <span className="gd-lane"><i className="gd-fill gd-you" /></span>
          <span className="gd-badge"><Ic n="swords" size={16} /></span>
          <span className="gd-lane"><i className="gd-fill gd-foe" /></span>
        </div>
      );
    case 'survivor':
      return (
        <div className="arena-art ga-sprint" aria-hidden>
          <span className="gs-finish"><Ic n="crown" size={15} /></span>
          <i className="gs-dot" /><i className="gs-dot" /><i className="gs-dot" /><i className="gs-dot" />
        </div>
      );
    case 'wordfall':
      return (
        <div className="arena-art ga-wordfall" aria-hidden>
          <span>w</span><span>o</span><span>r</span><span>d</span><span>s</span>
        </div>
      );
    case 'stack':
      return (
        <div className="arena-art ga-stack" aria-hidden>
          <span className="gk-col">
            <i className="gk-drop" />
            <i className="gk-b" style={{ width: 58 }} />
            <i className="gk-b" style={{ width: 42 }} />
            <i className="gk-b" style={{ width: 66 }} />
          </span>
        </div>
      );
    case 'cipher':
      return (
        <div className="arena-art ga-cipher" aria-hidden>
          {([['h', 'c'], ['p', 'i'], ['c', 'p'], ['i', 'h'], ['r', 'e'], ['e', 'r']] as const).map(([a, b], i) => (
            <span className="gc-tile" key={i} style={{ animationDelay: `${i * 0.22}s` }}><b>{a}</b><i>{b}</i></span>
          ))}
        </div>
      );
    case 'keyforge':
      return (
        <div className="arena-art ga-forge" aria-hidden>
          <Ic n="hammer" size={36} /><i>✦</i><i>✦</i><i>✦</i>
        </div>
      );
    case 'wordflight':
      return (
        <div className="arena-art ga-flight" aria-hidden>
          <span className="gf-glider"><Ic n="send" size={34} /></span>
        </div>
      );
    default:
      return <div className="arena-art" aria-hidden />;
  }
}

function GameCard({ g, best, i }: { g: typeof QUESTS[number]; best?: { score: number }; i: number }) {
  return (
    <Link to={g.to} className="arena-card" style={{ '--i': i } as React.CSSProperties}>
      <div className="arena-artwrap">
        <GameArt id={g.id} />
        <span className="arena-play">Play →</span>
        {best && <span className="arena-best"><Ic n="trophy" size={12} /> {best.score}</span>}
      </div>
      <div className="arena-body">
        <h3><Ic n={g.icon} size={17} /> {g.name}</h3>
        <p className="small muted">{g.desc}</p>
        <div className="row gap wrap arena-foot">
          <Chip tone="accent">{g.trains}</Chip>
        </div>
      </div>
    </Link>
  );
}

export default function Games() {
  const data = useData();
  if (!data) return null;
  const kid = data.profile.ageGroup === 'kid';
  const bests = Object.keys(data.gameBests).length;
  return (
    <div>
      <header className="arena-head">
        <div className="arena-head-txt">
          <div className="dash-kicker">{kid ? 'Playtime' : 'The Arena'}</div>
          <h1>{kid ? 'Pick a game, hero.' : 'Seven games. Seven real skills.'}</h1>
          <p>Every game here is built around one real typing skill, and tells you which. Not typing glued onto someone else's game.</p>
        </div>
        <div className="arena-head-stats">
          <span className="arena-stat"><Ic n="swords" size={15} /> 7 games</span>
          <span className="arena-stat"><Ic n="trophy" size={15} /> {bests} personal {bests === 1 ? 'best' : 'bests'}</span>
          {data.race.wins > 0 && <span className="arena-stat arena-stat-gold"><Ic n="rocket" size={15} /> {data.race.wins} race {data.race.wins === 1 ? 'win' : 'wins'}</span>}
        </div>
      </header>

      <h2 className="section-title"><Ic n="swords" size={19} /> Competitive</h2>
      <Link to="/app/race" className="race-hall" aria-label="Open the Race hub">
        <span className="rh-sky" aria-hidden>
          <i className="rh-comet" /><i className="rh-comet" /><i className="rh-comet" />
        </span>
        <span className="race-banner-rocket"><Ic n="rocket" size={40} /></span>
        <span className="race-banner-txt">
          <strong className="race-hall-title">The Lightstream</strong>
          <span className="race-hall-sub">Full typing races, the Arena's main event. CPU rivals matched to your pace, your own ghost, private rooms with friends.</span>
          <span className="row gap wrap race-hall-chips">
            <Chip tone="accent">Sustained speed under pressure</Chip>
            {data.race.wins > 0 && <Chip tone="gold"><Ic n="trophy" size={12} /> {data.race.wins} wins</Chip>}
          </span>
        </span>
        <span className="race-hall-cta">Enter the Race hub →</span>
      </Link>
      <div className="arena-grid race-hall-underlings">
        {COMPETITIVE.map((g, i) => <GameCard key={g.id} g={g} best={data.gameBests[g.id]} i={i} />)}
      </div>

      <h2 className="section-title"><Ic n="map" size={19} /> Skill quests</h2>
      <div className="arena-grid">
        {QUESTS.map((g, i) => <GameCard key={g.id} g={g} best={data.gameBests[g.id]} i={i + 2} />)}
      </div>

      {!kid && (
        <Card style={{ marginTop: 18 }} className="card">
          <h3><Ic n="users" size={17} /> Cooperative missions</h3>
          <p className="small muted">Team typing missions, where two players share one transmission and type alternating lines, are designed and coming with online play. <Chip>Concept preview</Chip></p>
        </Card>
      )}
    </div>
  );
}
