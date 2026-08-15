/**
 * The GSAP layer for the public pages.
 *
 * Gives the content pages the same arrival rhythm the landing has: the hero
 * copy sets itself down, then each block of the page fades up as it reaches the
 * reading line.
 *
 * Every animation is a `gsap.from`, never a CSS `opacity: 0` that JavaScript
 * later clears. If the dynamic import fails, or the browser is old, or a
 * crawler renders the prerendered HTML without running any of this, the page
 * is simply already in its finished state. Content pages are the part of the
 * site that has to survive its own JavaScript.
 *
 * Skipped entirely under reduced motion, which is correct here: unlike the
 * landing's trail and accessibility demo, nothing in these animations carries
 * information. They only affect when text arrives, not what it says.
 */

import { useEffect } from 'react';

/** Blocks that fade up on approach. Order does not matter; each has its own trigger. */
const TARGETS = [
  '.pub-section',
  '.pub-card',
  '.pub-defs > div',
  '.pub-next-card',
  '.pub-cta-band',
  '.pub-toc',
  '.pub-shot',
  '.pub-faq-item',
  '.pub-term',
  '.tt-test',
];

export function usePublicMotion(key: string): void {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ctx: { revert(): void } | null = null;
    let cancelled = false;
    let cleanupRefresh = () => {};

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        // The h1 and lede are deliberately NOT animated. They are the page's
        // largest contentful paint and its most important content, and an
        // opacity tween that never gets a frame — a backgrounded tab, a
        // throttled device — leaves the title invisible. Nothing above the fold
        // depends on JavaScript to become readable.
        for (const sel of TARGETS) {
          gsap.utils.toArray<HTMLElement>(sel).forEach((el) => {
            gsap.from(el, {
              y: 26, opacity: 0, duration: 0.5, ease: 'power2.out',
              scrollTrigger: { trigger: el, start: 'top 88%' },
            });
          });
        }
      });

      // Triggers are measured before the web fonts swap and before the hero
      // canvas has sized itself, both of which move everything below them.
      // Without this, reveals fire early or never fire at all.
      const refresh = () => ScrollTrigger.refresh();
      const raf = requestAnimationFrame(refresh);
      window.addEventListener('load', refresh);
      document.fonts?.ready.then(refresh).catch(() => {});
      cleanupRefresh = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('load', refresh);
      };
    })();

    return () => {
      cancelled = true;
      cleanupRefresh();
      ctx?.revert();
    };
  }, [key]);
}
