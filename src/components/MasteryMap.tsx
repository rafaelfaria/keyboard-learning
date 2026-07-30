import { useMemo, useState } from 'react';
import { KeyboardVisual } from './KeyboardVisual';
import { MASTERY_META, globalMedianMs, masteryOf } from '../lib/adaptive';
import type { KeyMastery, ProfileData } from '../lib/types';
import { buildLayout } from '../lib/keyboard';
import { Btn, Chip } from './ui';
import { useNavigate } from 'react-router-dom';
import { Ic } from './icons';

export function MasteryMap({ data, compact }: { data: ProfileData; compact?: boolean }) {
  const [weather, setWeather] = useState(data.profile.ageGroup === 'kid');
  const [sel, setSel] = useState<string | null>(null);
  const nav = useNavigate();
  const med = useMemo(() => globalMedianMs(data.keyStats), [data.keyStats]);

  const { colors, counts } = useMemo(() => {
    const keys = buildLayout(data.profile.layout);
    const colors: Record<string, string> = {};
    const counts: Record<KeyMastery, number> = { new: 0, learning: 0, improving: 0, reliable: 0, mastered: 0, review: 0 };
    for (const k of keys) {
      if (k.control || !k.base || k.base === ' ') continue;
      const m = masteryOf(data.keyStats[k.base], med);
      counts[m]++;
      colors[k.base] = MASTERY_META[m].color;
    }
    return { colors, counts };
  }, [data.keyStats, data.profile.layout, med]);

  const selStat = sel ? data.keyStats[sel] : null;
  const selMastery = sel ? masteryOf(selStat ?? undefined, med) : null;

  return (
    <div className="mastery-map">
      <KeyboardVisual
        layout={data.profile.layout}
        guide="plain"
        stateColors={colors}
        compact={compact}
        onKeyClick={(k) => { if (k.base && k.base !== ' ' && !k.control) setSel(k.base === sel ? null : k.base); }}
      />
      <div className="mm-legend" role="list" aria-label="Mastery legend">
        {(Object.keys(MASTERY_META) as KeyMastery[]).map((m) => (
          <span className="mm-leg" role="listitem" key={m}>
            <i style={{ background: MASTERY_META[m].color }} />
            {weather && <Ic n={MASTERY_META[m].weather} size={13} />}{MASTERY_META[m].label}
            <b>{counts[m]}</b>
          </span>
        ))}
        <button className="mm-weather-toggle" onClick={() => setWeather((w) => !w)} type="button">
          {weather ? 'Simple view' : <><Ic n="cloud-sun" size={13} /> Weather view</>}
        </button>
      </div>
      {sel && (
        <div className="mm-detail" role="status">
          <Chip tone="accent">{sel.toUpperCase()}</Chip>
          {selStat && selStat.a > 0 ? (
            <>
              <span className="muted small">
                {MASTERY_META[selMastery!].label} · {selStat.a} presses · {Math.round((1 - selStat.e / Math.max(1, selStat.a)) * 100)}% accuracy
                {selStat.ms > 0 && ` · ${selStat.ms}ms avg`}
              </span>
              <Btn kind="soft" onClick={() => nav('/app/train/weakkeys')}>Drill this area</Btn>
            </>
          ) : (
            <span className="muted small">You haven't met this key yet — it will light up as your journey continues.</span>
          )}
        </div>
      )}
    </div>
  );
}
