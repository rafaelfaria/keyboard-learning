// GSAP game-feel helpers. Every effect creates its own DOM inside a
// position:relative container and cleans itself up when the tween ends.
import gsap from 'gsap';

function el(cls: string, text = ''): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls;
  if (text) s.textContent = text;
  s.setAttribute('aria-hidden', 'true');
  return s;
}

export function screenShake(target: HTMLElement | null, power = 7): void {
  if (!target) return;
  gsap.fromTo(target, { x: -power }, { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.3)' });
}

export function floatText(parent: HTMLElement | null, text: string, x: number, y: number, cls = ''): void {
  if (!parent) return;
  const s = el(`fx-float ${cls}`, text);
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  parent.appendChild(s);
  gsap.fromTo(s, { y: 0, opacity: 1, scale: 0.7 }, {
    y: -64, opacity: 0, scale: 1.15, duration: 0.9, ease: 'power2.out',
    onComplete: () => s.remove(),
  });
}

/** Blow a word apart into letter shards that arc up then rain down. */
export function shatterWord(parent: HTMLElement | null, word: string, x: number, y: number, color?: string): void {
  if (!parent) return;
  const chars = word.split('').slice(0, 12);
  chars.forEach((ch, i) => {
    const s = el('fx-shard', ch);
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    if (color) s.style.color = color;
    parent.appendChild(s);
    const angle = (i / chars.length) * Math.PI - Math.PI; // fan upward
    const dist = 30 + Math.random() * 70;
    const dx = Math.cos(angle + Math.random() * 0.8) * dist * (Math.random() > 0.5 ? 1 : -1);
    const upY = -(30 + Math.random() * 60);
    const tl = gsap.timeline({ onComplete: () => s.remove() });
    tl.to(s, { x: dx * 0.6, y: upY, rotation: (Math.random() - 0.5) * 180, duration: 0.28, ease: 'power2.out' })
      .to(s, { x: dx, y: 240 + Math.random() * 120, rotation: `+=${(Math.random() - 0.5) * 240}`, opacity: 0, duration: 0.8 + Math.random() * 0.4, ease: 'power2.in' });
  });
}

/** Spark burst (forge strikes, gate hits). */
export function sparkBurst(parent: HTMLElement | null, x: number, y: number, n = 8, cls = ''): void {
  if (!parent) return;
  for (let i = 0; i < n; i++) {
    const s = el(`fx-spark ${cls}`, '✦');
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    parent.appendChild(s);
    const a = Math.random() * Math.PI * 2;
    const d = 24 + Math.random() * 46;
    gsap.to(s, {
      x: Math.cos(a) * d, y: Math.sin(a) * d - 18,
      opacity: 0, scale: 0.4 + Math.random() * 0.5, rotation: (Math.random() - 0.5) * 200,
      duration: 0.5 + Math.random() * 0.35, ease: 'power2.out',
      onComplete: () => s.remove(),
    });
  }
}

/** Fire a glowing bolt from (fx,fy) to (tx,ty); onHit runs at impact. */
export function fireBolt(parent: HTMLElement | null, fx: number, fy: number, tx: number, ty: number, onHit?: () => void): void {
  if (!parent) { onHit?.(); return; }
  const s = el('fx-bolt');
  s.style.left = `${fx}px`;
  s.style.top = `${fy}px`;
  const angle = Math.atan2(ty - fy, tx - fx) * (180 / Math.PI);
  s.style.transform = `rotate(${angle}deg)`;
  parent.appendChild(s);
  const dist = Math.hypot(tx - fx, ty - fy);
  gsap.to(s, {
    x: tx - fx, y: ty - fy,
    duration: Math.max(0.12, dist / 1400), ease: 'power1.in',
    onComplete: () => { s.remove(); onHit?.(); },
  });
}

export function popIn(target: HTMLElement | null): void {
  if (!target) return;
  gsap.fromTo(target, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2.2)' });
}

export function hopUp(target: HTMLElement | null, h = 10): void {
  if (!target) return;
  gsap.fromTo(target, { y: 0 }, { y: -h, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.out' });
}
