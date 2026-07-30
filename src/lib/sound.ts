// Synthesized sound engine — zero audio assets, all WebAudio.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let zenNodes: { stop: () => void } | null = null;

function ensure(): { ctx: AudioContext; master: GainNode } | null {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx && master ? { ctx, master } : null;
  } catch {
    return null;
  }
}

let enabled = true;
let vol = 0.6;

export function configureSound(on: boolean, volume: number): void {
  enabled = on;
  vol = volume;
  if (master) master.gain.value = volume;
  if (!on) stopZen();
}

function env(c: AudioContext, g: GainNode, peak: number, attack: number, decay: number): void {
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function osc(type: OscillatorType, freq: number, peak: number, attack: number, decay: number, detune = 0): void {
  const s = ensure();
  if (!s || !enabled) return;
  const o = s.ctx.createOscillator();
  const g = s.ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  env(s.ctx, g, peak * vol, attack, decay);
  o.connect(g).connect(s.master);
  o.start();
  o.stop(s.ctx.currentTime + attack + decay + 0.05);
}

function noiseBurst(peak: number, decay: number, freq: number): void {
  const s = ensure();
  if (!s || !enabled) return;
  const len = Math.floor(s.ctx.sampleRate * 0.06);
  const buf = s.ctx.createBuffer(1, len, s.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = s.ctx.createBufferSource();
  src.buffer = buf;
  const f = s.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.1;
  const g = s.ctx.createGain();
  env(s.ctx, g, peak * vol, 0.002, decay);
  src.connect(f).connect(g).connect(s.master);
  src.start();
}

export const snd = {
  key(): void { noiseBurst(0.32, 0.05, 2400 + Math.random() * 800); },
  thock(): void { noiseBurst(0.4, 0.07, 900 + Math.random() * 300); },
  err(): void { osc('triangle', 160, 0.22, 0.004, 0.11); },
  step(): void { osc('sine', 660, 0.2, 0.004, 0.1); osc('sine', 880, 0.14, 0.004, 0.16); },
  done(): void {
    [523, 659, 784].forEach((f, i) => setTimeout(() => osc('sine', f, 0.24, 0.005, 0.28), i * 90));
  },
  badge(): void {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => osc('triangle', f, 0.2, 0.005, 0.32), i * 110));
  },
  levelup(): void {
    [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => osc('sine', f, 0.22, 0.005, 0.3), i * 95));
  },
  count(final = false): void { osc('sine', final ? 880 : 440, 0.3, 0.004, final ? 0.4 : 0.15); },
  tick(): void { osc('sine', 1200, 0.08, 0.002, 0.03); },
  whoosh(): void { noiseBurst(0.3, 0.3, 500); },
  pop(): void { osc('sine', 340, 0.25, 0.003, 0.09); osc('sine', 620, 0.12, 0.003, 0.06); },
};

export function startZen(): void {
  const s = ensure();
  if (!s || !enabled || zenNodes) return;
  const len = s.ctx.sampleRate * 2;
  const buf = s.ctx.createBuffer(1, len, s.ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  const src = s.ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = s.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  const g = s.ctx.createGain();
  g.gain.value = 0.08 * vol;
  const lfo = s.ctx.createOscillator();
  const lfoGain = s.ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.035 * vol;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(f).connect(g).connect(s.master);
  src.start();
  lfo.start();
  zenNodes = { stop: () => { try { src.stop(); lfo.stop(); } catch { /* noop */ } } };
}

export function stopZen(): void {
  zenNodes?.stop();
  zenNodes = null;
}

export function speak(text: string, rate = 0.95): boolean {
  try {
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.lang = 'en';
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeak(): void {
  try { window.speechSynthesis.cancel(); } catch { /* noop */ }
}
