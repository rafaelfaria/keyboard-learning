import { useMemo, useState } from 'react';
import { dayKey } from '../lib/metrics';

export interface Pt { x: number; y: number; label?: string }

export function LineChart({ points, height = 180, color = 'var(--accent)', unit = '', yMin, showDots }: {
  points: Pt[]; height?: number; color?: string; unit?: string; yMin?: number; showDots?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height, PAD = 26;
  const d = useMemo(() => {
    if (points.length < 2) return null;
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const yLo = yMin ?? Math.max(0, Math.min(...ys) * 0.85);
    const yHi = Math.max(...ys) * 1.08 + 1;
    const sx = (x: number) => PAD + ((x - x0) / Math.max(1, x1 - x0)) * (W - PAD * 2);
    const sy = (y: number) => H - PAD - ((y - yLo) / Math.max(0.001, yHi - yLo)) * (H - PAD * 2);
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    const area = `${path} L${sx(x1).toFixed(1)},${H - PAD} L${sx(x0).toFixed(1)},${H - PAD} Z`;
    return { path, area, sx, sy, yLo, yHi };
  }, [points, H, yMin]);

  if (!d) return <div className="chart-empty">Not enough data yet — complete a few sessions.</div>;
  const hp = hover !== null ? points[hover] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`} className="linechart" role="img" aria-label="Line chart"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * W;
        let best = 0, bd = Infinity;
        points.forEach((p, i) => { const dd = Math.abs(d.sx(p.x) - mx); if (dd < bd) { bd = dd; best = i; } });
        setHover(best);
      }}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="lc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={PAD} x2={W - PAD} y1={PAD + f * (H - PAD * 2)} y2={PAD + f * (H - PAD * 2)} className="chart-grid" />
      ))}
      <path d={d.area} fill="url(#lc-grad)" />
      <path d={d.path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {(showDots || points.length < 40) && points.map((p, i) => (
        <circle key={i} cx={d.sx(p.x)} cy={d.sy(p.y)} r={hover === i ? 5.5 : 3} fill={color} className="chart-dot" />
      ))}
      <text x={PAD} y={14} className="chart-axis">{Math.round(d.yHi)}{unit}</text>
      <text x={PAD} y={H - 8} className="chart-axis">{Math.round(d.yLo)}{unit}</text>
      {hp && (
        <g transform={`translate(${Math.min(W - 130, Math.max(PAD, d.sx(hp.x) - 60))}, 8)`}>
          <rect width="128" height="24" rx="7" className="chart-tip-bg" />
          <text x="64" y="16" textAnchor="middle" className="chart-tip">{hp.label ?? `${Math.round(hp.y)}${unit}`}</text>
        </g>
      )}
      {hp && <line x1={d.sx(hp.x)} x2={d.sx(hp.x)} y1={PAD} y2={H - PAD} className="chart-cursor" />}
    </svg>
  );
}

export function CalendarHeat({ days, weeks = 16, goalMin }: { days: Record<string, number>; weeks?: number; goalMin: number }) {
  const cells = useMemo(() => {
    const out: { key: string; v: number; col: number; row: number }[] = [];
    const today = new Date();
    const dow = (today.getDay() + 6) % 7;
    for (let w = 0; w < weeks; w++) {
      for (let r = 0; r < 7; r++) {
        const back = (weeks - 1 - w) * 7 + (dow - r);
        if (back < 0) continue;
        const dte = new Date(today);
        dte.setDate(today.getDate() - back);
        const key = dayKey(dte);
        out.push({ key, v: days[key] ?? 0, col: w, row: r });
      }
    }
    return out;
  }, [days, weeks]);

  return (
    <div className="cal-heat" role="img" aria-label="Practice calendar — darker squares are longer practice days">
      <svg viewBox={`0 0 ${weeks * 16} ${7 * 16}`}>
        {cells.map((c) => {
          const lvl = c.v <= 0 ? 0 : c.v < goalMin * 0.5 ? 1 : c.v < goalMin ? 2 : c.v < goalMin * 2 ? 3 : 4;
          return (
            <rect
              key={c.key} x={c.col * 16} y={c.row * 16} width="13" height="13" rx="3.5"
              className={`cal-cell cal-l${lvl}`}
            >
              <title>{c.key}: {Math.round(c.v)} min</title>
            </rect>
          );
        })}
      </svg>
      <div className="cal-legend"><span>less</span>{[0, 1, 2, 3, 4].map((l) => <i key={l} className={`cal-chip cal-l${l}`} />)}<span>more</span></div>
    </div>
  );
}

export function RhythmStrip({ ikis, height = 90 }: { ikis: number[]; height?: number }) {
  if (!ikis.length) return <div className="chart-empty">No rhythm data for this session.</div>;
  const slice = ikis.slice(-120);
  const med = [...slice].sort((a, b) => a - b)[Math.floor(slice.length / 2)] || 200;
  const W = 600;
  const bw = W / slice.length;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="rhythm-strip" role="img" aria-label="Keystroke rhythm — each bar is the gap before one keystroke">
      <line x1="0" x2={W} y1={height - (med / (med * 3)) * height} y2={height - (med / (med * 3)) * height} className="rhythm-med" />
      {slice.map((v, i) => {
        const h = Math.min(1, v / (med * 3)) * (height - 6);
        const dev = Math.abs(v - med) / med;
        const cls = v > med * 3 ? 'rb-pause' : dev > 0.75 ? 'rb-off' : 'rb-on';
        return <rect key={i} x={i * bw + 0.5} y={height - h} width={Math.max(1.5, bw - 1.2)} height={h} rx="1" className={`rb ${cls}`} />;
      })}
    </svg>
  );
}

/** Circular rhythm fingerprint: distribution of intervals around a ring. */
export function RhythmFingerprint({ ikis, size = 170 }: { ikis: number[]; size?: number }) {
  const bins = useMemo(() => {
    const flow = ikis.filter((x) => x > 15 && x < 1200);
    if (flow.length < 10) return null;
    const med = [...flow].sort((a, b) => a - b)[Math.floor(flow.length / 2)];
    const B = 36;
    const out = new Array(B).fill(0);
    for (const v of flow) {
      const ratio = Math.max(0, Math.min(2, v / med));
      out[Math.min(B - 1, Math.floor((ratio / 2) * B))]++;
    }
    const max = Math.max(...out);
    return out.map((v) => v / max);
  }, [ikis]);
  if (!bins) return <div className="chart-empty">Type a little more to grow your fingerprint.</div>;
  const R = size / 2;
  const inner = R * 0.35;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="fingerprint" role="img" aria-label="Rhythm fingerprint — a smooth even ring means consistent timing">
      <circle cx={R} cy={R} r={inner - 4} className="fp-core" />
      {bins.map((v, i) => {
        const a0 = (i / bins.length) * Math.PI * 2 - Math.PI / 2;
        const len = inner + v * (R - inner - 6);
        const x1 = R + Math.cos(a0) * inner, y1 = R + Math.sin(a0) * inner;
        const x2 = R + Math.cos(a0) * len, y2 = R + Math.sin(a0) * len;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="fp-ray" style={{ opacity: 0.35 + v * 0.65 }} />;
      })}
    </svg>
  );
}

export function HBarList({ rows, unit = '', max }: { rows: { label: string; v: number; hint?: string; color?: string }[]; unit?: string; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="hbl">
      {rows.map((r, i) => (
        <div className="hbl-row" key={i} title={r.hint}>
          <span className="hbl-label">{r.label}</span>
          <span className="hbl-track"><span className="hbl-fill" style={{ width: `${(r.v / m) * 100}%`, background: r.color ?? 'var(--accent)' }} /></span>
          <span className="hbl-v">{Math.round(r.v * 10) / 10}{unit}</span>
        </div>
      ))}
    </div>
  );
}

export function Spark({ values, width = 120, height = 36, color = 'var(--accent)' }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return <span className="spark-empty">—</span>;
  const lo = Math.min(...values), hi = Math.max(...values);
  const path = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - 3 - ((v - lo) / Math.max(0.001, hi - lo)) * (height - 6);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="spark" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
