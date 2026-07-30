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
    desc: 'Every word becomes a block — clean words build wide and steady, sloppy ones crumble the tower.',
    trains: 'Word-perfect precision',
  },
  {
    id: 'cipher', name: 'Cipher Run', icon: 'puzzle', to: '/app/games/cipher',
    desc: 'Unscramble rune-words against the clock. Decoding builds the deep letter-map fast typing sits on.',
    trains: 'Spelling recall & mapping',
  },
  {
    id: 'keyforge', name: 'Keyforge', icon: 'hammer', to: '/app/games/keyforge',
    desc: 'Forge artifacts from flawless rune-words. No timer — perfection makes rarity. Collect Mythics.',
    trains: 'Perfect-word streaks',
  },
  {
    id: 'wordflight', name: 'Wordflight', icon: 'send', to: '/app/games/wordflight',
    desc: 'A glider that climbs when your rhythm is even and wobbles when you rush. Thread the golden gates.',
    trains: 'Rhythm & flow',
  },
];

function GameCard({ g, best }: { g: typeof QUESTS[number]; best?: { score: number } }) {
  return (
    <Link to={g.to} className="card card-link">
      <Ic n={g.icon} size={34} />
      <h3 style={{ margin: '10px 0 6px' }}>{g.name}</h3>
      <p className="small muted" style={{ minHeight: '4em' }}>{g.desc}</p>
      <div className="row gap wrap" style={{ marginTop: 10 }}>
        <Chip tone="accent">{g.trains}</Chip>
        {best && <Chip tone="gold"><Ic n="trophy" size={12} /> {best.score}</Chip>}
      </div>
    </Link>
  );
}

export default function Games() {
  const data = useData();
  if (!data) return null;
  const kid = data.profile.ageGroup === 'kid';
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>The Arcade</h1>
          <p>Seven original games, each built around a real typing skill — not typing glued onto someone else's game.</p>
        </div>
      </div>

      <h2 className="section-title"><Ic n="swords" size={19} /> Competitive arena</h2>
      <div className="grid3">
        {COMPETITIVE.map((g) => <GameCard key={g.id} g={g} best={data.gameBests[g.id]} />)}
      </div>
      <Link to="/app/race" className="race-banner" aria-label="Open the Race hub">
        <Ic n="rocket" size={30} />
        <span className="race-banner-txt">
          <strong>Looking for full races? That's The Lightstream — the Race hub.</strong>
          <small className="muted">CPU rivals, your ghost, private rooms with friends. Not a mini-game: its own hall, one click away.</small>
        </span>
        <span className="race-banner-cta">Open Race hub →</span>
        {data.race.wins > 0 && <Chip tone="gold"><Ic n="trophy" size={12} /> {data.race.wins} wins</Chip>}
      </Link>

      <h2 className="section-title"><Ic n="map" size={19} /> Skill quests</h2>
      <div className="grid3">
        {QUESTS.map((g) => <GameCard key={g.id} g={g} best={data.gameBests[g.id]} />)}
      </div>

      {!kid && (
        <Card style={{ marginTop: 18 }} className="card">
          <h3><Ic n="users" size={17} /> Cooperative missions</h3>
          <p className="small muted">Team typing missions — two players share one transmission, each typing alternating lines — are designed and coming with online play. <Chip>Concept preview</Chip></p>
        </Card>
      )}
    </div>
  );
}
