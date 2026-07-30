import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useUi } from '../lib/store';
import { Ic } from './icons';
import { LogoMark } from './Brand';

export function Logo({ size = 28, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      <LogoMark size={size * 1.16} />
      {wordmark && <span className="logo-word">KeyTopia</span>}
    </span>
  );
}

export function Card({ children, className = '', onClick, as: As = 'div', style }: { children: ReactNode; className?: string; onClick?: () => void; as?: 'div' | 'section' | 'article'; style?: React.CSSProperties }) {
  return <As className={`card ${className}`} onClick={onClick} style={style}>{children}</As>;
}

export function Btn({ children, onClick, kind = 'primary', to, className = '', disabled, big, type = 'button', ariaLabel }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'soft' | 'danger' | 'gold';
  to?: string; className?: string; disabled?: boolean; big?: boolean; type?: 'button' | 'submit'; ariaLabel?: string;
}) {
  const cls = `btn btn-${kind} ${big ? 'btn-big' : ''} ${className}`;
  if (to) return <Link className={cls} to={to} onClick={onClick} aria-label={ariaLabel}>{children}</Link>;
  return <button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>{children}</button>;
}

export function Ring({ value, size = 64, stroke = 7, label, sub, color = 'var(--accent)' }: {
  value: number; size?: number; stroke?: number; label?: ReactNode; sub?: string; color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${c * v} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-fill"
        />
      </svg>
      <div className="ring-center">
        <div className="ring-label">{label}</div>
        {sub && <div className="ring-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function Stat({ v, l, tone }: { v: ReactNode; l: string; tone?: 'good' | 'bad' | 'accent' }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-v">{v}</div>
      <div className="stat-l">{l}</div>
    </div>
  );
}

export function Bar({ value, color = 'var(--accent)', height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <div className="hbar" style={{ height }}>
      <div className="hbar-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: color }} />
    </div>
  );
}

export function Chip({ children, tone = 'default', className = '' }: { children: ReactNode; tone?: 'default' | 'good' | 'warn' | 'accent' | 'gold'; className?: string }) {
  return <span className={`chip chip-${tone} ${className}`}>{children}</span>;
}

export function Seg<T extends string>({ options, value, onChange, ariaLabel }: {
  options: { v: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; ariaLabel?: string;
}) {
  return (
    <div className="seg" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.v} role="tab" aria-selected={value === o.v}
          className={`seg-item ${value === o.v ? 'seg-on' : ''}`}
          onClick={() => onChange(o.v)} type="button"
        >{o.label}</button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button type="button" className="toggle-row" onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="toggle-txt">
        <span className="toggle-label">{label}</span>
        {desc && <span className="toggle-desc">{desc}</span>}
      </span>
      <span className={`toggle ${on ? 'toggle-on' : ''}`} aria-hidden><span className="toggle-dot" /></span>
    </button>
  );
}

export function Modal({ open, onClose, children, wide, labelledBy }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean; labelledBy?: string }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <button className="modal-x" onClick={onClose} aria-label="Close dialog">✕</button>
        {children}
      </div>
    </div>
  );
}

export function Stars({ n, size = 20 }: { n: number; size?: number }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'star-on' : 'star-off'}>★</span>)}
    </span>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function ToastHost() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast toast-${t.kind}`} onClick={() => dismiss(t.id)}>
          <span className="toast-icon"><Ic n={t.icon ?? 'sparkles'} size={22} /></span>
          <span className="toast-body">
            <strong>{t.title}</strong>
            {t.body && <span>{t.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export function CelebrationHost() {
  const c = useUi((s) => s.celebration);
  const clear = useUi((s) => s.clearCelebration);
  if (!c) return null;
  return (
    <div className="modal-bg celebrate-bg" onMouseDown={clear}>
      <div className="celebrate" role="dialog" aria-modal="true">
        <div className="celebrate-burst" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => <span key={i} style={{ ['--i' as string]: i }} />)}
        </div>
        <div className="celebrate-icon"><Ic n={c.icon} size={56} /></div>
        <h2>{c.title}</h2>
        <p>{c.body}</p>
        <Btn onClick={clear}>Continue</Btn>
      </div>
    </div>
  );
}

export function BadgeIcon({ icon, unlocked, size = 56 }: { icon: string; unlocked: boolean; size?: number }) {
  return (
    <span className={`badge-ic ${unlocked ? 'badge-on' : 'badge-off'}`} style={{ width: size, height: size, fontSize: size * 0.46 }} aria-hidden>
      <Ic n={icon} size={size * 0.44} />
    </span>
  );
}

export function KeyCap({ ch }: { ch: string }) {
  return <kbd className="keycap">{ch === ' ' ? '␣' : ch}</kbd>;
}
