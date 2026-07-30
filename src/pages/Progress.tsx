import { useMemo, useState } from 'react';
import { useData } from '../lib/store';
import { Card, Chip, Modal, Seg, Stat, Btn } from '../components/ui';
import { CalendarHeat, HBarList, LineChart, RhythmFingerprint, RhythmStrip } from '../components/charts';
import { MasteryMap } from '../components/MasteryMap';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { fingerStats, weakKeys, handBalance } from '../lib/adaptive';
import { makeCharLookup, FINGER_NAMES, displayChar } from '../lib/keyboard';
import { fmtDuration, relTime } from '../lib/metrics';
import type { SessionResult } from '../lib/types';
import { ResultsPanel } from '../components/ResultsPanel';
import { sessionInsight, nextAction } from '../lib/coach';
import { useNavigate } from 'react-router-dom';
import { Ic } from '../components/icons';

const MODE_ICONS: Record<string, string> = {
  lesson: 'book', adaptive: 'brain', weakkeys: 'dumbbell', speed: 'zap', accuracy: 'target', rhythm: 'waves', zen: 'flower',
  endurance: 'route', realworld: 'clipboard', code: 'braces', numbers: 'peaks', dictation: 'headphones', copy: 'file',
  blind: 'eye-off', recovery: 'lifebuoy', game: 'gamepad', race: 'rocket', challenge: 'calendar', assessment: 'compass',
};

type Range = '7' | '30' | '90' | 'all';

export default function Progress() {
  const data = useData();
  const nav = useNavigate();
  const [range, setRange] = useState<Range>('30');
  const [metric, setMetric] = useState<'wpm' | 'acc'>('wpm');
  const [heatMode, setHeatMode] = useState<'mastery' | 'errors' | 'speed'>('mastery');
  const [sel, setSel] = useState<SessionResult | null>(null);
  if (!data) return null;

  const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400_000;
  const sessions = useMemo(() => data.sessions.filter((s) => s.endedAt >= cutoff && s.typed >= 10), [data.sessions, cutoff]);
  const lookup = useMemo(() => makeCharLookup(data.profile.layout), [data.profile.layout]);

  const points = sessions.map((s) => ({
    x: s.endedAt,
    y: metric === 'wpm' ? s.wpm : s.acc,
    label: `${new Date(s.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${metric === 'wpm' ? `${s.wpm} wpm` : `${s.acc}%`}`,
  }));

  const totals = useMemo(() => {
    const t = { chars: 0, words: 0, sec: 0, sessions: sessions.length, avgWpm: 0, avgAcc: 0, bs: 0 };
    for (const s of sessions) { t.chars += s.typed; t.words += s.words; t.sec += s.seconds; t.bs += s.backspaces; }
    const withTyped = sessions.filter((s) => s.typed > 25);
    t.avgWpm = withTyped.length ? Math.round(withTyped.reduce((a, s) => a + s.wpm, 0) / withTyped.length * 10) / 10 : 0;
    t.avgAcc = withTyped.length ? Math.round(withTyped.reduce((a, s) => a + s.acc, 0) / withTyped.length * 10) / 10 : 0;
    return t;
  }, [sessions]);

  const fingers = useMemo(() => fingerStats(data.keyStats, lookup), [data.keyStats, lookup]);
  const hands = useMemo(() => handBalance(data.keyStats, lookup), [data.keyStats, lookup]);
  const weak = useMemo(() => weakKeys(data.keyStats).slice(0, 8), [data.keyStats]);
  const lastWithIkis = [...data.sessions].reverse().find((s) => s.ikis && s.ikis.length > 10);

  const heat = useMemo(() => {
    if (heatMode === 'mastery') return undefined;
    const out: Record<string, { v: number; label: string }> = {};
    const entries = Object.entries(data.keyStats).filter(([, s]) => s.a >= 5);
    if (heatMode === 'errors') {
      const max = Math.max(0.02, ...entries.map(([, s]) => s.e / s.a));
      for (const [k, s] of entries) out[k] = { v: (s.e / s.a) / max, label: `${k.toUpperCase()}: ${Math.round((s.e / s.a) * 100)}% miss rate (${s.a} presses)` };
    } else {
      const ms = entries.filter(([, s]) => s.ms > 0);
      const max = Math.max(200, ...ms.map(([, s]) => s.ms));
      const min = Math.min(...ms.map(([, s]) => s.ms), max);
      for (const [k, s] of ms) out[k] = { v: (s.ms - min) / Math.max(1, max - min), label: `${k.toUpperCase()}: ${s.ms}ms average` };
    }
    return out;
  }, [heatMode, data.keyStats]);

  const records: { key: string; label: string }[] = [
    { key: 'wpm', label: 'Best WPM (≥90% acc)' },
    { key: 'acc', label: 'Best accuracy' },
    { key: 'consistency', label: 'Best consistency' },
    { key: 'sprint15', label: '15s sprint' },
    { key: 'sprint30', label: '30s sprint' },
    { key: 'sprint60', label: '60s sprint' },
    { key: 'sprint120', label: '2min sprint' },
    { key: 'sprint300', label: '5min sprint' },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Progress</h1>
          <p>Your whole journey — speed, accuracy, rhythm, keys and time. Rank: <strong>{data.assessment?.rank}</strong></p>
        </div>
        <div className="row gap wrap">
          <Seg options={[{ v: '7', label: '7d' }, { v: '30', label: '30d' }, { v: '90', label: '90d' }, { v: 'all', label: 'All' }]} value={range} onChange={setRange} ariaLabel="Time range" />
        </div>
      </div>

      <div className="row gap wrap" style={{ marginBottom: 16 }}>
        <Stat v={totals.avgWpm} l="avg wpm" tone="accent" />
        <Stat v={`${totals.avgAcc}%`} l="avg accuracy" />
        <Stat v={totals.sessions} l="sessions" />
        <Stat v={fmtDuration(totals.sec)} l="practice time" />
        <Stat v={totals.words.toLocaleString()} l="words typed" />
        <Stat v={totals.chars.toLocaleString()} l="characters" />
      </div>

      <div className="grid2">
        <Card>
          <div className="row spread wrap gap">
            <h3>{metric === 'wpm' ? 'Speed' : 'Accuracy'} over time</h3>
            <Seg options={[{ v: 'wpm', label: 'WPM' }, { v: 'acc', label: 'Accuracy' }]} value={metric} onChange={setMetric} ariaLabel="Chart metric" />
          </div>
          <LineChart points={points} unit={metric === 'wpm' ? '' : '%'} yMin={metric === 'acc' ? 80 : undefined} />
        </Card>
        <Card>
          <h3>Practice calendar</h3>
          <p className="small muted" style={{ marginBottom: 10 }}>Daily goal: {data.dailyGoalMin} minutes</p>
          <CalendarHeat days={data.days} goalMin={data.dailyGoalMin} />
        </Card>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <Card>
          <div className="row spread wrap gap">
            <h3>Keyboard heatmap</h3>
            <Seg options={[{ v: 'mastery', label: 'Mastery' }, { v: 'errors', label: 'Errors' }, { v: 'speed', label: 'Speed' }]} value={heatMode} onChange={setHeatMode} ariaLabel="Heatmap mode" />
          </div>
          {heatMode === 'mastery'
            ? <MasteryMap data={data} compact />
            : <div style={{ paddingTop: 8 }}>
                <KeyboardVisual layout={data.profile.layout} guide="plain" compact heat={heat} />
                <p className="small muted center" style={{ marginTop: 8 }}>{heatMode === 'errors' ? 'Hotter = more misses. Hover any key for exact numbers.' : 'Hotter = slower response. Hover any key for exact numbers.'}</p>
              </div>}
        </Card>
        <div className="col gap">
          <Card>
            <h3>Fingers & hands</h3>
            {fingers.length ? (
              <>
                <HBarList
                  rows={fingers.map((f) => ({ label: FINGER_NAMES[f.finger], v: f.acc, hint: `${f.n} presses · ${f.ms}ms avg`, color: `var(--fz${f.finger})` }))}
                  unit="%" max={100}
                />
                <p className="small muted" style={{ marginTop: 10 }}>Hand balance — left {hands.left}% · right {hands.right}% accuracy</p>
              </>
            ) : <p className="muted small">Type a few sessions to unlock finger analytics.</p>}
          </Card>
          <Card>
            <h3>Weak keys right now</h3>
            {weak.length ? (
              <>
                <div className="row gap wrap" style={{ margin: '8px 0' }}>
                  {weak.map((w) => (
                    <Chip key={w.key} tone={w.err > 0.12 ? 'warn' : 'default'}>
                      {w.key.toUpperCase()} · {Math.round(w.err * 100)}% miss{w.ms ? ` · ${Math.round(w.ms)}ms` : ''}
                    </Chip>
                  ))}
                </div>
                <Btn kind="soft" onClick={() => nav('/app/train/weakkeys')}><Ic n="dumbbell" size={15} /> Drill the worst one</Btn>
              </>
            ) : <p className="good small">Nothing flagged — your map is in great shape.</p>}
          </Card>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <Card>
          <h3>Rhythm fingerprint</h3>
          <p className="small muted">From your latest measured session. A round, even ring means metronome-steady typing.</p>
          <div className="rhythm-cols" style={{ marginTop: 10 }}>
            <div><RhythmStrip ikis={lastWithIkis?.ikis ?? []} /></div>
            <div className="fp-col"><RhythmFingerprint ikis={lastWithIkis?.ikis ?? []} /></div>
          </div>
        </Card>
        <Card>
          <h3>Personal records</h3>
          <div className="records-grid" style={{ marginTop: 10 }}>
            {records.filter((r) => data.records[r.key]).map((r) => (
              <div className="record-tile" key={r.key}>
                <b>{data.records[r.key].v}{r.key === 'acc' ? '%' : ''}</b>
                <span>{r.label}</span>
                <span style={{ display: 'block' }}>{relTime(data.records[r.key].t)}</span>
              </div>
            ))}
            {!Object.keys(data.records).length && <p className="muted small">Records appear after your first sessions.</p>}
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }} className="card">
        <h3>Session history</h3>
        <p className="small muted">Click a session for full details and its typing echo.</p>
        <div style={{ marginTop: 8 }}>
          {[...data.sessions].reverse().slice(0, 30).map((s) => (
            <div className="sess-row" key={s.id} onClick={() => setSel(s)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSel(s); }}>
              <span className="sess-ic"><Ic n={MODE_ICONS[s.mode] ?? 'keyboard'} size={18} /></span>
              <div className="sess-main">
                <strong>{s.label}{s.seeded ? ' · sample' : ''}</strong>
                <small>{relTime(s.endedAt)} · {fmtDuration(s.seconds)}</small>
              </div>
              <div className="sess-nums">
                {s.wpm} wpm · {s.acc}%
                <small>{s.words} words</small>
              </div>
            </div>
          ))}
          {!data.sessions.length && <p className="muted small">No sessions yet — your story starts with the first one.</p>}
        </div>
      </Card>

      <Modal open={!!sel} onClose={() => setSel(null)} wide labelledBy="sess-title">
        {sel && (
          <div>
            <h2 id="sess-title" style={{ marginBottom: 14 }}><Ic n={MODE_ICONS[sel.mode] ?? 'keyboard'} size={20} /> {sel.label}</h2>
            <ResultsPanel
              result={sel}
              rewards={null}
              insight={sessionInsight(data, sel)}
              next={nextAction(data, sel)}
              soundOn={data.settings.soundOn}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
