import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { KeyStat, SessionMode, SessionResult, StrokeT } from '../lib/types';
import { consistencyScore, hesitationCount, rhythmScore, wpmOf, round1 } from '../lib/metrics';
import { uid } from '../lib/rng';
import { snd } from '../lib/sound';
import { displayChar } from '../lib/keyboard';

export interface EngineCfg {
  text: string;
  mode: SessionMode;
  label: string;
  correction: 'standard' | 'strict';
  timeLimitSec?: number;
  stopOnComplete?: boolean;
  allowBackspace?: boolean;
  keepTimeline?: boolean;
}

const PENDING = 0, OK = 1, BAD = 2, FIXED = 3;

export class Engine {
  cfg: EngineCfg;
  text: string;
  states: Uint8Array;
  wasBad: Uint8Array;
  pos = 0;
  startedAt = 0;
  finishedAt = 0;
  done = false;
  strokes: { t: number; key: string; exp: string; ok: boolean }[] = [];
  backspaces = 0;
  errorsTotal = 0;
  lastWrong: { key: string; exp: string; t: number } | null = null;
  lastPress: { key: string; ok: boolean; t: number } | null = null;

  constructor(cfg: EngineCfg) {
    this.cfg = { stopOnComplete: true, allowBackspace: true, ...cfg };
    this.text = cfg.text;
    this.states = new Uint8Array(this.text.length);
    this.wasBad = new Uint8Array(this.text.length);
  }

  get started(): boolean { return this.startedAt > 0; }

  elapsedMs(now = performance.now()): number {
    if (!this.startedAt) return 0;
    return (this.done ? this.finishedAt : now) - this.startedAt;
  }

  remainingSec(now = performance.now()): number | null {
    if (!this.cfg.timeLimitSec) return null;
    if (!this.startedAt) return this.cfg.timeLimitSec;
    return Math.max(0, this.cfg.timeLimitSec - this.elapsedMs(now) / 1000);
  }

  key(k: string, t = performance.now()): 'ok' | 'bad' | 'back' | 'none' | 'done' {
    if (this.done) return 'none';
    if (k === 'Backspace') {
      if (!this.startedAt) return 'none';
      if (this.cfg.allowBackspace && this.pos > 0) {
        this.pos--;
        this.states[this.pos] = PENDING;
      }
      this.backspaces++;
      return 'back';
    }
    if (k.length !== 1 && k !== '\n') return 'none';
    const exp = this.text[this.pos];
    if (exp === undefined) return 'none';
    if (!this.startedAt) this.startedAt = t;
    const ok = k === exp;
    this.strokes.push({ t, key: k, exp, ok });
    this.lastPress = { key: k, ok, t };
    if (!ok) {
      this.errorsTotal++;
      this.lastWrong = { key: k, exp, t };
    }
    if (this.cfg.correction === 'strict' && !ok) return 'bad';
    if (ok) this.states[this.pos] = this.wasBad[this.pos] ? FIXED : OK;
    else { this.states[this.pos] = BAD; this.wasBad[this.pos] = 1; }
    this.pos++;
    if (exp === '\n') {
      while (this.text[this.pos] === ' ') { this.states[this.pos] = OK; this.pos++; }
    }
    if (this.pos >= this.text.length && this.cfg.stopOnComplete) {
      this.finish(t);
      return 'done';
    }
    return ok ? 'ok' : 'bad';
  }

  ikis(): number[] {
    const out: number[] = [];
    for (let i = 1; i < this.strokes.length; i++) out.push(this.strokes[i].t - this.strokes[i - 1].t);
    return out;
  }

  liveStats(now = performance.now()): { wpm: number; raw: number; acc: number; progress: number } {
    const ms = this.elapsedMs(now);
    const correct = this.strokes.reduce((a, s) => a + (s.ok ? 1 : 0), 0);
    const typed = this.strokes.length;
    return {
      wpm: Math.round(wpmOf(correct, ms)),
      raw: Math.round(wpmOf(typed, ms)),
      acc: typed ? Math.round((correct / typed) * 1000) / 10 : 100,
      progress: this.cfg.timeLimitSec
        ? Math.min(1, ms / (this.cfg.timeLimitSec * 1000))
        : this.text.length ? this.pos / this.text.length : 0,
    };
  }

  finish(t = performance.now()): SessionResult {
    if (!this.done) {
      this.done = true;
      this.finishedAt = t;
    }
    return this.result();
  }

  result(): SessionResult {
    const ms = Math.max(600, this.elapsedMs());
    const seconds = this.cfg.timeLimitSec && ms / 1000 > this.cfg.timeLimitSec * 0.98
      ? this.cfg.timeLimitSec
      : ms / 1000;
    const typed = this.strokes.length;
    const correct = this.strokes.reduce((a, s) => a + (s.ok ? 1 : 0), 0);
    const ikis = this.ikis();
    const keyAgg: Record<string, KeyStat> = {};
    const pairMs: Record<string, { sum: number; n: number }> = {};
    const pairErr: Record<string, number> = {};
    for (let i = 0; i < this.strokes.length; i++) {
      const s = this.strokes[i];
      const cur = keyAgg[s.exp] ?? { a: 0, e: 0, ms: 0, n: 0 };
      cur.a++;
      if (!s.ok) cur.e++;
      if (i > 0) {
        const dt = s.t - this.strokes[i - 1].t;
        if (dt > 15 && dt < 1500) {
          cur.ms = (cur.ms * cur.n + dt) / (cur.n + 1);
          cur.n++;
          const pair = this.strokes[i - 1].exp + s.exp;
          if (pair.length === 2 && !pair.includes('\n')) {
            const p = pairMs[pair] ?? { sum: 0, n: 0 };
            p.sum += dt; p.n++;
            pairMs[pair] = p;
            if (!s.ok) pairErr[pair] = (pairErr[pair] ?? 0) + 1;
          }
        } else if (!s.ok) {
          const pair = this.strokes[i - 1].exp + s.exp;
          if (pair.length === 2) pairErr[pair] = (pairErr[pair] ?? 0) + 1;
        }
      }
      keyAgg[s.exp] = cur;
    }
    for (const k of Object.keys(keyAgg)) keyAgg[k].ms = Math.round(keyAgg[k].ms);
    const slowPairs = Object.entries(pairMs)
      .filter(([, v]) => v.n >= 2)
      .map(([p, v]) => [p, v.sum / v.n] as [string, number])
      .sort((a, b) => b[1] - a[1]).slice(0, 4);
    const errorPairs = Object.entries(pairErr)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1]).slice(0, 4) as [string, number][];
    let uncorrected = 0, corrected = 0;
    for (let i = 0; i < this.pos; i++) {
      if (this.states[i] === BAD) uncorrected++;
      if (this.states[i] === FIXED) corrected++;
    }
    const wpm = round1(wpmOf(correct, seconds * 1000));
    const acc = typed ? Math.round((correct / typed) * 1000) / 10 : 100;
    const timeline: StrokeT[] | undefined = this.cfg.keepTimeline
      ? this.strokes.slice(-700).map((s) => ({ t: Math.round(s.t - this.startedAt), key: s.key, ok: s.ok }))
      : undefined;
    return {
      id: uid(),
      mode: this.cfg.mode,
      label: this.cfg.label,
      endedAt: Date.now(),
      seconds: Math.round(seconds * 10) / 10,
      typed, correct,
      errors: this.errorsTotal,
      corrected, uncorrected,
      backspaces: this.backspaces,
      words: Math.round(correct / 5),
      wpm,
      raw: round1(wpmOf(typed, seconds * 1000)),
      acc,
      adjusted: round1(wpm * (acc / 100)),
      consistency: consistencyScore(ikis),
      rhythm: rhythmScore(ikis),
      hesitations: hesitationCount(ikis),
      keyAgg, slowPairs, errorPairs,
      timeline,
      ikis: ikis.filter((x) => x > 5 && x < 3000).map((x) => Math.round(x)).slice(-400),
    };
  }
}

export interface GameStroke { t: number; exp: string; ok: boolean }

/** Build a SessionResult from a free-form stroke log (games). */
export function resultFromStrokes(
  mode: SessionMode, label: string, strokes: GameStroke[], startMs: number, endMs: number,
  extra?: Record<string, number | string | boolean>,
): SessionResult {
  const seconds = Math.max(1, (endMs - startMs) / 1000);
  const typed = strokes.length;
  const correct = strokes.reduce((a, s) => a + (s.ok ? 1 : 0), 0);
  const ikis: number[] = [];
  for (let i = 1; i < strokes.length; i++) ikis.push(strokes[i].t - strokes[i - 1].t);
  const keyAgg: Record<string, KeyStat> = {};
  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i];
    const cur = keyAgg[s.exp] ?? { a: 0, e: 0, ms: 0, n: 0 };
    cur.a++;
    if (!s.ok) cur.e++;
    if (i > 0) {
      const dt = strokes[i].t - strokes[i - 1].t;
      if (dt > 15 && dt < 1500) { cur.ms = (cur.ms * cur.n + dt) / (cur.n + 1); cur.n++; }
    }
    keyAgg[s.exp] = cur;
  }
  for (const k of Object.keys(keyAgg)) keyAgg[k].ms = Math.round(keyAgg[k].ms);
  const wpm = round1(wpmOf(correct, seconds * 1000));
  const acc = typed ? Math.round((correct / typed) * 1000) / 10 : 100;
  return {
    id: uid(), mode, label, endedAt: Date.now(),
    seconds: Math.round(seconds * 10) / 10,
    typed, correct, errors: typed - correct, corrected: 0, uncorrected: typed - correct,
    backspaces: 0, words: Math.round(correct / 5),
    wpm, raw: round1(wpmOf(typed, seconds * 1000)), acc,
    adjusted: round1(wpm * (acc / 100)),
    consistency: consistencyScore(ikis), rhythm: rhythmScore(ikis), hesitations: hesitationCount(ikis),
    keyAgg, slowPairs: [], errorPairs: [],
    ikis: ikis.filter((x) => x > 5 && x < 3000).map(Math.round).slice(-400),
    extra,
  };
}

export function combineResults(parts: SessionResult[], mode: SessionMode, label: string): SessionResult {
  const typed = parts.reduce((a, p) => a + p.typed, 0);
  const correct = parts.reduce((a, p) => a + p.correct, 0);
  const seconds = parts.reduce((a, p) => a + p.seconds, 0);
  const keyAgg: Record<string, KeyStat> = {};
  for (const p of parts) {
    for (const [k, s] of Object.entries(p.keyAgg)) {
      const cur = keyAgg[k] ?? { a: 0, e: 0, ms: 0, n: 0 };
      cur.a += s.a; cur.e += s.e;
      if (s.n) { cur.ms = (cur.ms * cur.n + s.ms * s.n) / (cur.n + s.n); cur.n += s.n; }
      keyAgg[k] = cur;
    }
  }
  for (const k of Object.keys(keyAgg)) keyAgg[k].ms = Math.round(keyAgg[k].ms);
  const ikis = parts.flatMap((p) => p.ikis ?? []);
  const acc = typed ? Math.round((correct / typed) * 1000) / 10 : 100;
  const wpm = round1(wpmOf(correct, seconds * 1000));
  const allSlow = parts.flatMap((p) => p.slowPairs).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const allErr = parts.flatMap((p) => p.errorPairs);
  const errAgg: Record<string, number> = {};
  for (const [p, n] of allErr) errAgg[p] = (errAgg[p] ?? 0) + n;
  return {
    id: uid(), mode, label, endedAt: Date.now(),
    seconds: Math.round(seconds * 10) / 10,
    typed, correct,
    errors: parts.reduce((a, p) => a + p.errors, 0),
    corrected: parts.reduce((a, p) => a + p.corrected, 0),
    uncorrected: parts.reduce((a, p) => a + p.uncorrected, 0),
    backspaces: parts.reduce((a, p) => a + p.backspaces, 0),
    words: Math.round(correct / 5),
    wpm, raw: round1(wpmOf(typed, seconds * 1000)), acc,
    adjusted: round1(wpm * (acc / 100)),
    consistency: consistencyScore(ikis),
    rhythm: rhythmScore(ikis),
    hesitations: parts.reduce((a, p) => a + p.hesitations, 0),
    keyAgg,
    slowPairs: allSlow,
    errorPairs: Object.entries(errAgg).sort((a, b) => b[1] - a[1]).slice(0, 4) as [string, number][],
    timeline: parts[parts.length - 1]?.timeline,
    ikis: ikis.slice(-400),
  };
}

// ---------- React hook ----------

export interface UseSession {
  engine: Engine;
  version: number;
  focused: boolean;
  bindInput: {
    ref: React.RefObject<HTMLInputElement | null>;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onInput: (e: React.FormEvent<HTMLInputElement>) => void;
    onFocus: () => void;
    onBlur: () => void;
  };
  focus: () => void;
  restart: () => void;
}

export function useTypingSession(
  cfg: EngineCfg,
  opts: {
    onFinish: (r: SessionResult) => void;
    onStroke?: (kind: 'ok' | 'bad' | 'back', engine: Engine) => void;
    onEscape?: () => void;
    soundOn?: boolean;
    disabled?: boolean;
  },
): UseSession {
  const [nonce, setNonce] = useState(0);
  const engine = useMemo(() => new Engine(cfg), [cfg.text, cfg.timeLimitSec, cfg.correction, cfg.mode, nonce]);
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastHandled = useRef(0);
  const finishedFor = useRef<Engine | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const finishNow = useCallback((e: Engine) => {
    if (finishedFor.current === e) return;
    finishedFor.current = e;
    const r = e.finish();
    optsRef.current.onFinish(r);
  }, []);

  // timer tick: updates clock + enforces time limit
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!engine.started || engine.done) return;
      const rem = engine.remainingSec();
      if (rem !== null && rem <= 0) finishNow(engine);
      else bump();
    }, 200);
    return () => window.clearInterval(id);
  }, [engine, finishNow]);

  const press = useCallback((k: string, t: number) => {
    if (optsRef.current.disabled || engine.done) return;
    const res = engine.key(k, t);
    if (res === 'none') return;
    const sOn = optsRef.current.soundOn;
    if (res === 'ok') { if (sOn) snd.key(); optsRef.current.onStroke?.('ok', engine); }
    else if (res === 'bad') { if (sOn) snd.err(); optsRef.current.onStroke?.('bad', engine); }
    else if (res === 'back') { if (sOn) snd.thock(); optsRef.current.onStroke?.('back', engine); }
    else if (res === 'done') { if (sOn) snd.key(); optsRef.current.onStroke?.('ok', engine); finishNow(engine); }
    bump();
  }, [engine, finishNow]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = performance.now();
    if (e.key === 'Escape') { optsRef.current.onEscape?.(); e.preventDefault(); return; }
    if (e.key === 'Tab') { e.preventDefault(); return; }
    if (e.key === 'Backspace') { press('Backspace', t); lastHandled.current = t; e.preventDefault(); return; }
    if (e.key === 'Enter') { press('\n', t); lastHandled.current = t; e.preventDefault(); return; }
    if (e.key.length === 1) { press(e.key, t); lastHandled.current = t; e.preventDefault(); return; }
  }, [press]);

  const onInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const t = performance.now();
    const v = el.value;
    el.value = '';
    if (t - lastHandled.current < 40) return; // already handled by keydown
    for (const ch of v) press(ch === '\n' ? '\n' : ch, t);
  }, [press]);

  const focus = useCallback(() => { inputRef.current?.focus({ preventScroll: true }); }, []);
  const restart = useCallback(() => {
    finishedFor.current = null;
    setNonce((n) => n + 1);
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30);
  }, []);

  return {
    engine, version, focused,
    bindInput: {
      ref: inputRef,
      onKeyDown,
      onInput,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
    focus, restart,
  };
}

// ---------- Text display ----------

export function TypingText({ engine, caret, big, focused, onClick, masked }: {
  engine: Engine;
  caret: 'bar' | 'block' | 'under';
  big?: boolean;
  focused: boolean;
  onClick?: () => void;
  masked?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);

  const tokens = useMemo(() => {
    const out: { ch: string; i: number }[][] = [[]];
    for (let i = 0; i < engine.text.length; i++) {
      const ch = engine.text[i];
      out[out.length - 1].push({ ch, i });
      if (ch === ' ' || ch === '\n') out.push([]);
    }
    return out.filter((w) => w.length);
  }, [engine]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current, inner = innerRef.current, caretEl = caretRef.current;
    if (!wrap || !inner || !caretEl) return;
    const target = inner.querySelector<HTMLElement>(`[data-i="${Math.min(engine.pos, engine.text.length - 1)}"]`);
    if (!target) return;
    const atEnd = engine.pos >= engine.text.length;
    const x = atEnd ? target.offsetLeft + target.offsetWidth : target.offsetLeft;
    const y = target.offsetTop;
    caretEl.style.transform = `translate(${x}px, ${y}px)`;
    caretEl.style.height = `${target.offsetHeight}px`;
    caretEl.style.width = caret === 'block' ? `${Math.max(8, target.offsetWidth)}px` : caret === 'under' ? `${Math.max(8, target.offsetWidth)}px` : '2.5px';
    const lineH = target.offsetHeight;
    const desired = Math.max(0, y - lineH);
    inner.style.transform = `translateY(${-desired}px)`;
  });

  return (
    <div
      ref={wrapRef}
      className={`type-text ${big ? 'type-big' : ''} ${focused ? '' : 'type-blur'} caret-${caret}`}
      onMouseDown={(e) => { e.preventDefault(); onClick?.(); }}
      aria-label="Typing area"
    >
      <div className="type-inner" ref={innerRef}>
        <div ref={caretRef} className={`caret ${engine.started && !engine.done ? '' : 'caret-idle'}`} aria-hidden />
        {tokens.map((word, wi) => (
          <span className="tt-word" key={wi}>
            {word.map(({ ch, i }) => {
              const st = i < engine.pos ? engine.states[i] : PENDING;
              const cls = i === engine.pos ? 'tt-cur' : st === OK ? 'tt-ok' : st === BAD ? 'tt-bad' : st === FIXED ? 'tt-fixed' : 'tt-pend';
              if (ch === '\n') return <span key={i}><span data-i={i} className={`tt-ch ${cls} tt-nl`}>⏎</span><br /></span>;
              const hidden = masked && i >= engine.pos && ch !== ' ';
              return (
                <span key={i} data-i={i} className={`tt-ch ${cls}`}>
                  {hidden ? '·' : ch === ' ' ? ' ' : ch}
                </span>
              );
            })}
          </span>
        ))}
      </div>
      {!focused && <button type="button" className="type-focus-hint" onClick={onClick}>Click here or press any key to focus</button>}
    </div>
  );
}

export function GhostInput({ bind, disabled }: { bind: UseSession['bindInput']; disabled?: boolean }) {
  return (
    <input
      ref={bind.ref}
      className="ghost-input"
      onKeyDown={bind.onKeyDown}
      onInput={bind.onInput}
      onFocus={bind.onFocus}
      onBlur={bind.onBlur}
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      aria-label="Typing input — type the shown text"
      disabled={disabled}
      inputMode="text"
    />
  );
}

export function LiveStats({ engine, showWpm, untimed }: { engine: Engine; showWpm: boolean; untimed?: boolean }) {
  const s = engine.liveStats();
  const rem = engine.remainingSec();
  return (
    <div className="live-stats" role="status" aria-live="off">
      {showWpm && <div className="ls-item"><span className="ls-v">{s.wpm}</span><span className="ls-l">wpm</span></div>}
      <div className="ls-item"><span className="ls-v">{s.acc}%</span><span className="ls-l">accuracy</span></div>
      {!untimed && (
        <div className="ls-item">
          <span className="ls-v">{rem !== null ? Math.ceil(rem) : Math.floor(engine.elapsedMs() / 1000)}</span>
          <span className="ls-l">{rem !== null ? 'left' : 'sec'}</span>
        </div>
      )}
      <div className="ls-bar" aria-hidden><div className="ls-fill" style={{ width: `${Math.round(s.progress * 100)}%` }} /></div>
    </div>
  );
}

export function expectedKeyLabel(engine: Engine): string {
  const ch = engine.text[engine.pos];
  return ch === undefined ? '' : displayChar(ch);
}
