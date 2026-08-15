import { useMemo, useState } from 'react';
import { useData } from '../lib/store';
import { BADGES, BADGE_CATS, badgeProgress } from '../lib/badges';
import { BadgeIcon, Bar, Card, Chip, Seg } from '../components/ui';
import { relTime } from '../lib/metrics';
import { Ic } from '../components/icons';

export default function BadgesPage() {
  const data = useData();
  const [cat, setCat] = useState<string>('All');
  if (!data) return null;

  const progress = useMemo(() => badgeProgress(data), [data]);
  const unlockedCount = Object.keys(data.badges).length;
  const cats = ['All', ...BADGE_CATS];
  const shown = BADGES.filter((b) => cat === 'All' || b.cat === cat);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1><Ic n="medal" size={24} /> Badge collection</h1>
          <p>{unlockedCount} of {BADGES.length} earned. Badges reward accuracy, technique, consistency and kindness to yourself. Not just speed.</p>
        </div>
      </div>
      <div style={{ marginBottom: 16, overflowX: 'auto' }}>
        <Seg options={cats.map((c) => ({ v: c, label: c }))} value={cat} onChange={setCat} ariaLabel="Badge category" />
      </div>
      <div className="badge-grid">
        {shown.map((b) => {
          const unlocked = !!data.badges[b.id];
          const p = progress[b.id] ?? 0;
          const hidden = b.secret && !unlocked;
          return (
            <Card key={b.id} className="badge-card">
              <BadgeIcon icon={hidden ? 'help' : b.icon} unlocked={unlocked} />
              <div className="grow">
                <h4>{hidden ? 'Secret badge' : b.name}</h4>
                <p>{hidden ? 'Keep exploring: some achievements reveal themselves only when earned.' : b.desc}</p>
                {unlocked
                  ? <Chip tone="gold" className="chip" >Earned {relTime(data.badges[b.id])}</Chip>
                  : !hidden && <Bar value={p} height={6} color={p > 0.6 ? 'var(--gold)' : 'var(--accent)'} />}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
