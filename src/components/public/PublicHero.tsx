/**
 * The hero band on every public page: a WebGL keycap field behind the title.
 *
 * Three constraints shaped this, and each one is why a piece of it looks odd:
 *
 * 1. These pages are prerendered to static HTML in Node, so neither Three.js
 *    nor GSAP may be imported at module scope. Both arrive through dynamic
 *    import inside an effect, which never runs during prerender.
 * 2. They are content pages that must stay fast, so the scene module is only
 *    imported once the hero is near the viewport and the render loop stops the
 *    moment it leaves. Be aware that this currently defers only the scene
 *    itself: Three.js is statically imported by landing3d.ts, and because
 *    main.tsx imports every route eagerly it already sits in the single main
 *    chunk. The deferral pays off properly once the routes are split.
 * 3. The heading and lede are real content and live *inside* this component as
 *    children. They are never animated from `opacity: 0` in CSS — if the
 *    scripts never load, the page still reads.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import type { Formation, HeroHandle } from '../../pages/public/heroScene';

interface Variant { formation: Formation; hue: string; hue2: string }

/**
 * One formation per page, chosen to match what the page is about rather than
 * to be different for its own sake.
 */
const VARIANTS: Record<string, Variant> = {
  '/typing-test': { formation: 'stream', hue: '#14d8c4', hue2: '#8b7cff' },
  '/learn-to-type': { formation: 'wave', hue: '#14d8c4', hue2: '#6fe3b6' },
  '/curriculum': { formation: 'terrace', hue: '#8b7cff', hue2: '#14d8c4' },
  '/typing-games': { formation: 'scatter', hue: '#ffb454', hue2: '#f2789f' },
  '/typing-races': { formation: 'stream', hue: '#ffb454', hue2: '#14d8c4' },
  '/adaptive-practice': { formation: 'wave', hue: '#14d8c4', hue2: '#8b7cff' },
  '/typing-practice-modes': { formation: 'terrace', hue: '#14d8c4', hue2: '#8b7cff' },
  '/typing-analytics': { formation: 'terrace', hue: '#8b7cff', hue2: '#5fb3ff' },
  '/typing-for-kids': { formation: 'scatter', hue: '#6fe3b6', hue2: '#ffb454' },
  '/typing-for-schools': { formation: 'wave', hue: '#6fe3b6', hue2: '#14d8c4' },
};

const CALM: Variant = { formation: 'calm', hue: '#8b7cff', hue2: '#14d8c4' };

export function PublicHero({ path, children }: { path: string; children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const variant = VARIANTS[path] ?? CALM;

    let handle: HeroHandle | null = null;
    let cancelled = false;
    let raf = 0;

    // Scroll is read directly rather than through ScrollTrigger: the value is a
    // simple 0..1 over the hero's own height, and a plain listener cannot get
    // out of step with the page the way a stale trigger measurement can.
    const onScroll = (): void => {
      if (raf || !handle) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = wrap.getBoundingClientRect();
        handle?.setScroll(Math.min(1, Math.max(0, -r.top / Math.max(1, r.height))));
      });
    };

    const io = new IntersectionObserver(async (entries) => {
      const visible = entries[0]?.isIntersecting ?? false;
      if (visible && !handle) {
        const { createHeroScene } = await import('../../pages/public/heroScene');
        if (cancelled) return;
        handle = createHeroScene(canvas, variant, reduced);
        wrap.dataset.ready = '1';
        handle.start();
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      } else if (handle) {
        if (visible) handle.start();
        else handle.stop();
      }
    }, { rootMargin: '160px 0px' });

    io.observe(wrap);

    return () => {
      cancelled = true;
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      handle?.dispose();
    };
  }, [path]);

  return (
    <div className="pub-hero" ref={wrapRef}>
      <canvas className="pub-hero-canvas" ref={canvasRef} aria-hidden />
      <div className="pub-hero-body">
        <div className="pub-wrap">{children}</div>
      </div>
    </div>
  );
}
