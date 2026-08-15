import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { KeyboardScene } from './landing3d';
import { Logo, Chip } from '../components/ui';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { RhythmFingerprint } from '../components/charts';
import { useStore } from '../lib/store';
import { useAccount } from '../lib/account';
import { useSync, visibleProfileIds } from '../lib/syncEngine';
import { isSupabaseConfigured } from '../lib/supabase';
import { THEMES } from '../lib/themes';
import { EXPLORER_QUOTES } from '../lib/words';
import { Ic } from '../components/icons';
import { BlockAvatar } from '../components/avatars';
import { MODE_CLUSTERS } from '../lib/seo/content';

gsap.registerPlugin(ScrollTrigger);

/**
 * The four regions the 3D terrain morphs through.
 *
 * Each carries its own colour so the labels read as places on a map rather than
 * as four instances of the same card, which is what a single shared surface
 * colour makes them look like.
 */
const WORLD_REGIONS = [
  { name: 'The Heartlands', row: 'Home row', note: 'where every journey begins', hue: '#14d8c4' },
  { name: 'Skyreach Ridge', row: 'Top row', note: 'reaches, and returns', hue: '#8b7cff' },
  { name: 'Deeproot Vale', row: 'Bottom row', note: 'curl and control', hue: '#6fe3b6' },
  { name: 'Numeral Peaks', row: 'Numbers & symbols', note: 'the high country', hue: '#ffb454' },
] as const;

/**
 * The audience section, as stops on a trail.
 *
 * Six audiences described in prose is six paragraphs nobody finishes. Six stops
 * on one winding road is a picture, and it forces the copy down to the single
 * line that actually distinguishes each traveller.
 *
 * The SEO value here is not the body text it replaces: it is six descriptive
 * internal links out of the highest-authority page on the site. `to` therefore
 * points at the page that genuinely answers that audience's question, never at
 * a placeholder.
 */
const TRAIL = [
  { key: 'kids', icon: 'smile', name: 'Kids', line: 'An island world. They never sign in.', to: '/typing-for-kids', hue: '#14d8c4' },
  { key: 'teens', icon: 'headphones', name: 'Teens', line: 'Duels, streaks and themes worth unlocking.', to: '/typing-games', hue: '#8b7cff' },
  { key: 'adults', icon: 'briefcase', name: 'Adults', line: 'Ten minutes a day, on real work text.', to: '/typing-practice-modes', hue: '#5fb3ff' },
  { key: 'competitors', icon: 'trophy', name: 'Competitors', line: 'Transition timing and ghost racing.', to: '/typing-analytics', hue: '#ffb454' },
  { key: 'schools', icon: 'school', name: 'Schools', line: 'A class code, never a class roster.', to: '/typing-for-schools', hue: '#6fe3b6' },
  { key: 'families', icon: 'users', name: 'Families', line: 'Four explorers, one grown-up account.', to: '/faq', hue: '#f2789f' },
] as const;

/**
 * The serpentine the stops sit on.
 *
 * Peaks land on the six column centres of a 6-track grid (x = (i + 0.5) / 6),
 * alternating between y = 62 and y = 178 of a 240-unit box. The stops are
 * positioned by the same fractions in CSS, so the dots meet the curve at every
 * width without either side knowing about the other's pixels.
 */
const TRAIL_PATH =
  'M 0 62 L 83 62 C 166 62 166 178 250 178 C 333 178 333 62 417 62 '
  + 'C 500 62 500 178 583 178 C 666 178 666 62 750 62 '
  + 'C 833 62 833 178 917 178 L 1000 178';

/**
 * The accessibility section, as a demonstration rather than a list.
 *
 * Ten feature rows is a claim the reader has to take on trust. These five are
 * applied to a real specimen as you scroll, cumulatively, so by the last step
 * the sample on screen *is* the accessible configuration: bigger, hyperlegible,
 * high contrast, marked by shape as well as colour, and unhurried.
 *
 * `cls` is the modifier the stage picks up. Steps stack, never swap, so nothing
 * ever un-improves as the reader moves down.
 */
const A11Y_STEPS = [
  {
    cls: 'is-size',
    icon: 'zoom',
    title: 'Four text sizes',
    body: 'Not a browser zoom that breaks the layout. A real setting, stored on the profile, so it follows the person onto a shared classroom machine.',
  },
  {
    cls: 'is-font',
    icon: 'type',
    title: 'A typeface built for low vision',
    body: 'Atkinson Hyperlegible, from the Braille Institute, draws letters that are hard to confuse with one another. Available everywhere, not just on a settings page.',
  },
  {
    cls: 'is-contrast',
    icon: 'eye',
    title: 'High contrast, in one tap',
    body: 'A full theme rather than a filter laid over the top, so every state stays distinguishable instead of turning into grey on grey.',
  },
  {
    cls: 'is-shape',
    icon: 'check',
    title: 'Never colour alone',
    body: 'Around one man in twelve cannot rely on red against green. Every state here carries a shape or a label as well as a hue.',
  },
  {
    cls: 'is-calm',
    icon: 'hourglass',
    title: 'Untimed, and unhurried',
    body: 'The clock comes off, the motion stops, and the lesson still counts. Nobody learns to type well while being rushed.',
  },
] as const;

const SAMPLE_MASTERY: Record<string, string> = {};
'asdfjkl'.split('').forEach((c) => { SAMPLE_MASTERY[c] = 'var(--m-mastered)'; });
'erioghn'.split('').forEach((c) => { SAMPLE_MASTERY[c] = 'var(--m-reliable)'; });
'tuwcmv'.split('').forEach((c) => { SAMPLE_MASTERY[c] = 'var(--m-improving)'; });
'qpzb'.split('').forEach((c) => { SAMPLE_MASTERY[c] = 'var(--m-learning)'; });
'yx'.split('').forEach((c) => { SAMPLE_MASTERY[c] = 'var(--m-review)'; });

const FAKE_IKIS = Array.from({ length: 160 }, (_, i) => 210 + Math.sin(i * 0.7) * 40 + (i % 17 === 0 ? 320 : 0) + (i % 5) * 8);

export default function Landing() {
  // The header CTA must reflect the *account*, not just what localStorage
  // holds: cached profiles survive logout on purpose (account.signOut), so a
  // signed-out visitor with stale local data still gets "Start free".
  const user = useAccount((s) => s.user);
  const owners = useSync((s) => s.owners);
  const activeId = useStore((s) => s.activeId);
  const profiles = useStore((s) => s.profiles);
  const visible = isSupabaseConfigured
    ? visibleProfileIds(Object.keys(profiles), user?.id ?? null, owners)
    : Object.keys(profiles);
  const hasProfile = !!activeId && visible.includes(activeId);
  const hasAnyProfile = visible.length > 0;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLElement>(null);
  const chartPathRef = useRef<SVGPathElement>(null);
  const trailClipRef = useRef<SVGRectElement>(null);
  const sceneRef = useRef<KeyboardScene | null>(null);
  const [typed, setTyped] = useState<string[]>([]);
  const [aStep, setAStep] = useState(0);

  const rm = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // The audience trail draws itself along the scroll.
  //
  // Same reasoning as the accessibility stepper below, and the same fix: this
  // used to live in the GSAP effect, which bails out under reduced motion, so
  // the road rendered permanently complete for anyone with Reduce Motion on.
  // Progress is read straight from the section's own geometry, which also makes
  // it independent of whether ScrollTrigger measured the page correctly.
  //
  // At progress p the wipe sits at x = 1000p and stop i's column centre is at
  // (i + 0.5) / 6, so each stop finishes arriving exactly as the road reaches it.
  useEffect(() => {
    const clip = trailClipRef.current;
    const section = document.querySelector('.land-everyone');
    if (!clip || !section) return;
    const stops = Array.from(document.querySelectorAll<HTMLElement>('.trail-stop'));

    const render = (p: number) => {
      clip.setAttribute('width', String(1000 * p));
      stops.forEach((el, i) => {
        const t = Math.min(1, Math.max(0, (p * TRAIL.length - i) / 0.7));
        el.style.opacity = String(t);
        el.style.transform = `translateY(${(1 - t) * 14}px)`;
      });
    };

    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // r.top when the draw should start, and when it should be complete.
      const from = vh * 0.72;
      const to = vh * 0.85 - r.height;
      render(Math.min(1, Math.max(0, (from - r.top) / (from - to))));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };

    measure();
    if (import.meta.env.DEV) (window as unknown as { __trail?: (p: number) => void }).__trail = render;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Accessibility demo stepper.
  //
  // Deliberately outside the GSAP effect, and deliberately not gated on
  // `rm`. Reduced motion means "do not animate at me", not "hide the content":
  // these steps are driven directly by scroll position, which is manipulation
  // rather than autonomous movement. Under reduced motion the CSS transitions
  // are switched off in landing.css, so the states snap instead of easing and
  // the reader still sees all five. It also means the section no longer depends
  // on ScrollTrigger having measured the page correctly.
  useEffect(() => {
    const root = document.querySelector('.a11y');
    if (!root) return;
    const steps = Array.from(root.querySelectorAll<HTMLElement>('.a11y-step'));
    if (!steps.length) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      // The last step whose top has crossed the reading line is the live one.
      const line = window.innerHeight * 0.62;
      let next = 0;
      steps.forEach((el, i) => { if (el.getBoundingClientRect().top <= line) next = i; });
      setAStep(next);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // 3D scene
  useEffect(() => {
    if (!canvasRef.current) return;
    const scene = new KeyboardScene(canvasRef.current, rm);
    sceneRef.current = scene;
    if (import.meta.env.DEV) (window as unknown as { __scene?: KeyboardScene }).__scene = scene;
    if (rm) scene.setProgress(0.25);
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key.length === 1) {
        scene.typeKey(e.key);
        setTyped((prev) => [...prev.slice(-11), e.key === ' ' ? '␣' : e.key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [rm]);

  // GSAP scroll choreography
  useLayoutEffect(() => {
    if (rm) return;
    const ctx = gsap.context(() => {
      // hero+world zone drives the camera / terrain morph
      ScrollTrigger.create({
        trigger: zoneRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.5,
        onUpdate: (self) => sceneRef.current?.setProgress(self.progress),
      });

      // hero copy drifts up & fades as you scroll
      gsap.to('.hero-inner', {
        y: -120, opacity: 0, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 35%', scrub: true },
      });

      // region labels choreography inside the world section
      const labels = gsap.utils.toArray<HTMLElement>('.world-label');
      labels.forEach((el, i) => {
        gsap.fromTo(el, { opacity: 0, y: 34, scale: 0.94 }, {
          opacity: 1, y: 0, scale: 1, ease: 'power2.out',
          scrollTrigger: {
            trigger: zoneRef.current,
            start: `${18 + i * 16}% bottom`,
            end: `${30 + i * 16}% bottom`,
            scrub: true,
          },
        });
      });
      gsap.fromTo('.world-head', { opacity: 0, y: 50 }, {
        opacity: 1, y: 0, ease: 'power2.out',
        scrollTrigger: { trigger: zoneRef.current, start: '12% bottom', end: '26% bottom', scrub: true },
      });

      // canvas fades away after the world zone
      gsap.to(canvasWrapRef.current, {
        opacity: 0, ease: 'none',
        scrollTrigger: {
          trigger: afterRef.current,
          start: 'top 85%',
          end: 'top 25%',
          scrub: true,
          onUpdate: (self) => {
            if (self.progress >= 0.99) sceneRef.current?.stop();
            else sceneRef.current?.start();
          },
        },
      });

      // generic reveals
      gsap.utils.toArray<HTMLElement>('.rv').forEach((el) => {
        gsap.from(el, {
          y: 46, opacity: 0, duration: 0.75, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%' },
        });
      });

      // parallax cards — small fixed-pixel drift so cards can never
      // wander into a neighbouring grid row (yPercent of a tall card could)
      gsap.utils.toArray<HTMLElement>('[data-speed]').forEach((el) => {
        const sp = Number(el.dataset.speed ?? 0);
        gsap.to(el, {
          y: sp * 14, ease: 'none',
          scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });

      // The audience trail: one scrubbed timeline so the road and the stops can
      // never drift apart. Six time units, one per stop, and the wipe covers
      // column i at t = i + 0.5 (the column centre), so each stop is timed to
      // fade in just as the road arrives at it.
      //
      // The trigger is the whole section, not `.trail` itself — a 320px element
      // gives almost no scroll distance to scrub across, which made the old
      // version snap to finished the moment it appeared.
      // analytics chart draws itself
      if (chartPathRef.current) {
        const len = chartPathRef.current.getTotalLength();
        gsap.fromTo(chartPathRef.current,
          { strokeDasharray: len, strokeDashoffset: len },
          {
            strokeDashoffset: 0, ease: 'none',
            scrollTrigger: { trigger: '.land-analytics', start: 'top 78%', end: 'center 45%', scrub: true },
          });
      }

    }, rootRef);

    // Every trigger above is measured against a page that is about to change
    // height: the Three.js canvas sizes itself, the web fonts swap in, and the
    // 230vh world zone settles only after this effect has run. Without a
    // refresh once that is done, start/end positions are computed against the
    // wrong document and reveals either fire early or never fire at all.
    const refresh = () => ScrollTrigger.refresh();
    const raf = requestAnimationFrame(refresh);
    window.addEventListener('load', refresh);
    document.fonts?.ready.then(refresh).catch(() => {});

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('load', refresh);
      ctx.revert();
    };
  }, [rm]);

  return (
    <div className="landing" ref={rootRef}>
      <div className="land-canvas-wrap" ref={canvasWrapRef} aria-hidden>
        <canvas ref={canvasRef} className="land-canvas" />
        <div className="land-vignette" />
      </div>

      <header className="land-nav">
        <Logo size={30} />
        <nav className="land-nav-links" aria-label="Landing sections">
          <a href="#how">Method</a>
          <a href="#modes">Modes</a>
          <a href="#play">Play</a>
          <a href="#stats">Analytics</a>
          <a href="#everyone">For everyone</a>
        </nav>
        <div className="row gap">
          {hasProfile
            ? <Link className="btn btn-primary" to="/app">Continue training →</Link>
            : hasAnyProfile
              ? <Link className="btn btn-primary" to="/who">Choose profile →</Link>
              : <Link className="btn btn-primary" to="/onboarding">Start free</Link>}
        </div>
      </header>

      <div className="land-zone" ref={zoneRef}>
        <section className="hero">
          <div className="hero-inner">
            <h1>Don't just type faster.<br /><em>Learn to type beautifully.</em></h1>
            <p className="hero-sub">
              KeyTopia turns your keyboard into a living world. Adaptive lessons build real technique,
              games and races make practice something you look forward to, and every keystroke
              lights up your personal Mastery Map.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary btn-big" to="/onboarding">Start learning, it's free</Link>
              <Link className="btn btn-soft btn-big" to="/onboarding?quick=1">Take the 60-second assessment</Link>
            </div>
            <div className="hero-try" aria-live="off">
              <span className="hero-try-label">psst, the keyboard below is live. try typing!</span>
              <span className="hero-try-keys">
                {typed.length === 0 ? <span className="muted">·&nbsp;·&nbsp;·</span> : typed.map((c, i) => <kbd key={i} className="keycap">{c}</kbd>)}
              </span>
            </div>
            <div className="hero-strip">
              <span>Adaptive engine</span><i />
              <span>18-stage curriculum</span><i />
              <span>Games & races</span><i />
              <span>Deep analytics</span><i />
              <span>All ages</span>
            </div>
          </div>
          <div className="hero-scroll-cue" aria-hidden>scroll<br />↓</div>
        </section>

        <section className="world" aria-label="The keyboard world">
          {/* The terrain behind this text is bright and moving, so the copy needs
              a ground of its own. A scrim under the head plus a soft text shadow
              keeps it legible at every point of the scroll, without dimming the
              render the way a full-section overlay would. */}
          <div className="world-sticky">
            <div className="world-scrim" aria-hidden />
            <div className="world-head">
              <span className="land-eyebrow">The map</span>
              <h2>Every keyboard is a world<br />waiting to be mastered.</h2>
              <p>Keep scrolling. Your keyboard becomes terrain, and every region is a stage of the journey from first key to full flow.</p>
            </div>
            {WORLD_REGIONS.map((r, i) => (
              <div
                className={`world-label wl-${i + 1}`}
                key={r.name}
                style={{ '--wc': r.hue } as React.CSSProperties}
              >
                <span className="wl-idx">{String(i + 1).padStart(2, '0')}</span>
                <span className="wl-body">
                  <strong>{r.name}</strong>
                  <span className="wl-meta"><b>{r.row}</b>{r.note}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="land-section land-how" id="how" ref={afterRef}>
        <div className="land-inner">
          <h2 className="rv">KeyTopia learns <em>you</em> first.</h2>
          <p className="land-lede rv">No two typists struggle with the same keys. The whole product bends around your data.</p>
          <div className="how-steps">
            <article className="how-card rv">
              <span className="how-num">1</span>
              <h3>Assess</h3>
              <p>A 60-second placement reads your speed, accuracy, rhythm, hesitation, backspace habits and per-key reflexes, then names your rank and draws your starting map.</p>
            </article>
            <article className="how-card rv">
              <span className="how-num">2</span>
              <h3>Adapt</h3>
              <p>Every keystroke updates your Mastery Map. Practice sets are generated on the fly: weak keys and slow letter-pairs get extra reps, wrapped in real words so drills never feel like drills.</p>
            </article>
            <article className="how-card rv">
              <span className="how-num">3</span>
              <h3>Advance</h3>
              <p>Accuracy first, speed second, rhythm always. The coach holds you back from chasing speed too early, and tells you exactly why, after every single session.</p>
            </article>
          </div>
          <div className="how-demo rv">
            <div className="how-demo-map">
              <KeyboardVisual layout="qwerty" guide="plain" compact stateColors={SAMPLE_MASTERY} />
              <div className="mm-legend" style={{ fontSize: '0.72rem' }}>
                <span className="mm-leg"><i style={{ background: 'var(--m-mastered)' }} />Mastered</span>
                <span className="mm-leg"><i style={{ background: 'var(--m-reliable)' }} />Reliable</span>
                <span className="mm-leg"><i style={{ background: 'var(--m-improving)' }} />Improving</span>
                <span className="mm-leg"><i style={{ background: 'var(--m-learning)' }} />Learning</span>
                <span className="mm-leg"><i style={{ background: 'var(--m-review)' }} />Needs review</span>
              </div>
            </div>
            <blockquote className="how-quote">
              <span className="how-quote-k"><Ic n="bulb" size={26} /></span>
              “Your accuracy is already strong. Your next breakthrough will come from steadier <b>P</b> and <b>O</b>, and smoothing the <b>O→L</b> transition. Here is a two-minute drill for exactly that.”
              <cite>Kip, your typing coach, being annoyingly specific</cite>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="land-section land-modes" id="modes">
        <div className="land-inner">
          <div className="land-head rv">
            <span className="land-eyebrow">Practice</span>
            <h2>Train your way.</h2>
            <p className="land-lede">Not descriptions of the modes. The text each one puts in front of you.</p>
          </div>

          {/* A specimen sheet, not a feature list. A line of Code forge says
              what it is faster than a sentence about brackets can, so the prose
              moved to /typing-practice-modes and the samples took its place. */}
          <div className="spec-sheet">
            {MODE_CLUSTERS.map((c, i) => (
              <section className="spec-group rv" key={c.name}>
                <h3>
                  <span aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                  {c.name}
                </h3>
                <dl>
                  {c.modes.map((m) => (
                    <div className="spec-row" key={m.name}>
                      <dt>{m.name}</dt>
                      <dd className="spec-sample">
                        {m.hi
                          ? [...m.sample].map((ch, k) => (
                            m.hi!.includes(ch.toLowerCase())
                              ? <b key={k}>{ch}</b>
                              : <span key={k}>{ch}</span>
                          ))
                          : m.sample}
                        <i className="spec-caret" aria-hidden />
                      </dd>
                      <dd className="spec-skill">{m.skill}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <p className="land-more rv">
            <Link to="/typing-practice-modes">What each mode trains, in full →</Link>
          </p>
        </div>
      </section>

      <section className="land-section land-play" id="play">
        <div className="land-inner">
          <div className="land-head rv">
            <span className="land-eyebrow">The Arena</span>
            <h2>Games that train, honestly.</h2>
            <p className="land-lede">
              Not typing glued onto someone else's arcade. Every game is built around one real skill
              and tells you which one, so the fun and the practice are the same activity.
            </p>
          </div>
          <div className="play-grid">
            <article className="play-card play-card-lead rv">
              <div className="play-art pa-race" aria-hidden>
                {[2, 5, 8, 11].map((p, i) => (
                  <span className="pr-lane" key={p}>
                    <i className="pr-trail" />
                    <span className="pr-comet" style={{ animationDelay: `${i * 0.55}s` }}>
                      <BlockAvatar preset={p} size={20} />
                    </span>
                  </span>
                ))}
              </div>
              <div className="play-lead-body">
                <span className="land-eyebrow">The main event</span>
                <h3><Ic n="zap" size={20} /> Lightstream Race</h3>
                <p>
                  Rivals with believable habits: slow starters who come back at you, streaky
                  sprinters who surge and stall. Race the ghost of your own best run, or open a
                  private room with a join code for friends and classrooms. No strangers, no chat,
                  ever.
                </p>
                <div className="row gap wrap">
                  <Chip tone="accent">Composure at speed</Chip>
                  <Chip><Ic n="bot" size={13} /> 5 difficulties + adaptive</Chip>
                  <Chip><Ic n="ghost" size={13} /> Ghost of your best run</Chip>
                  <Chip><Ic n="ticket" size={13} /> Private join-code rooms</Chip>
                </div>
                <p className="land-more"><Link to="/typing-races">How racing works →</Link></p>
              </div>
            </article>
            <article className="play-card rv" data-speed={-0.6}>
              <div className="play-art pa-wordfall" aria-hidden><span>w</span><span>o</span><span>r</span><span>d</span><span>s</span></div>
              <h3><Ic n="shield" size={18} /> Wordfall Defence</h3>
              <p>Words drift toward your light-shield. Careless speed weakens it; calm accuracy saves the city.</p>
              <Chip tone="accent">Accuracy under pressure</Chip>
            </article>
            <article className="play-card rv" data-speed={0.4}>
              <div className="play-art pa-forge" aria-hidden><Ic n="hammer" size={40} /><i>✦</i><i>✦</i><i>✦</i></div>
              <h3><Ic n="hammer" size={18} /> Keyforge</h3>
              <p>The fire only burns while you type. Misses vent heat, treasures make it hungrier. Forge before it goes cold.</p>
              <Chip tone="accent">Fast, flawless words</Chip>
            </article>
            <article className="play-card rv" data-speed={-0.2}>
              <div className="play-art pa-flight" aria-hidden><Ic n="send" size={40} /></div>
              <h3><Ic n="send" size={18} /> Wordflight</h3>
              <p>A glider that climbs when your rhythm is even and wobbles when you rush. Thread the golden gates.</p>
              <Chip tone="accent">Rhythm & flow</Chip>
            </article>
            <article className="play-card rv" data-speed={0.5}>
              <div className="play-art pa-duel" aria-hidden>
                <span className="pd-lane"><i className="pd-fill pd-you" /></span>
                <span className="pd-badge"><Ic n="swords" size={17} /></span>
                <span className="pd-lane"><i className="pd-fill pd-foe" /></span>
              </div>
              <h3><Ic n="swords" size={18} /> Quill Duel</h3>
              <p>Best-of-seven phrase duel against a rival matched to your pace, and you watch them typing, cursor and all.</p>
              <Chip tone="accent">Burst speed under pressure</Chip>
            </article>
            <article className="play-card rv" data-speed={-0.3}>
              <div className="play-art pa-sprint" aria-hidden>
                <span className="ps-finish"><Ic n="crown" size={16} /></span>
                <i className="ps-dot" /><i className="ps-dot" /><i className="ps-dot" /><i className="ps-dot" />
              </div>
              <h3><Ic n="crown" size={18} /> Survivor Sprint</h3>
              <p>Eight typists, four rapid heats. The slowest head to the cheer bench each round. Outlast them all.</p>
              <Chip tone="accent">Consistency under pressure</Chip>
            </article>
            <article className="play-card rv" data-speed={0.3}>
              <div className="play-art pa-cipher" aria-hidden>
                {([['h', 'c'], ['p', 'i'], ['c', 'p'], ['i', 'h'], ['r', 'e'], ['e', 'r']] as const).map(([a, b], i) => (
                  <span className="pc-tile" key={i} style={{ animationDelay: `${i * 0.22}s` }}><b>{a}</b><i>{b}</i></span>
                ))}
              </div>
              <h3><Ic n="puzzle" size={18} /> Cipher Run</h3>
              <p>Unscramble rune-words against the clock. Decoding builds the deep letter-map fast typing sits on.</p>
              <Chip tone="accent">Spelling recall & mapping</Chip>
            </article>
            <article className="play-card rv" data-speed={-0.5}>
              <div className="play-art pa-stack" aria-hidden>
                <span className="pst-col">
                  <i className="pst-drop" />
                  <i className="pst-b" style={{ width: 58 }} />
                  <i className="pst-b" style={{ width: 42 }} />
                  <i className="pst-b" style={{ width: 66 }} />
                </span>
              </div>
              <h3><Ic n="blocks" size={18} /> Block Stack</h3>
              <p>Every word becomes a block. Clean words build wide and steady, sloppy ones crumble the tower.</p>
              <Chip tone="accent">Word-perfect precision</Chip>
            </article>
          </div>
        </div>
      </section>

      <section className="land-section land-analytics" id="stats">
        <div className="land-inner">
          <div className="land-head rv">
            <span className="land-eyebrow">Analytics</span>
            <h2>See yourself getting better.</h2>
            <p className="land-lede">
              Readable by a nine-year-old on the surface, deep enough underneath that competitive
              typists use it to find their last few words per minute.
            </p>
          </div>
          <div className="analytics-grid">
            <div className="an-card rv">
              <h4>Speed over 6 weeks</h4>
              <svg viewBox="0 0 320 130" className="an-chart" aria-hidden>
                <path d="M10 108 L48 100 L86 96 L124 84 L162 88 L200 70 L238 58 L276 52 L310 38" ref={chartPathRef}
                  fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="10" y1="118" x2="310" y2="118" stroke="var(--border)" />
              </svg>
              <small>28 → 47 wpm · accuracy held above 95%</small>
            </div>
            <div className="an-card rv">
              <h4>Rhythm fingerprint</h4>
              <RhythmFingerprint ikis={FAKE_IKIS} size={150} />
              <small>a round ring = metronome-steady hands</small>
            </div>
            <div className="an-card rv">
              <h4>Session echo</h4>
              <div className="an-echo" aria-hidden>
                <span>t</span><span>h</span><span>e</span><span> </span><span>q</span><span>u</span><span>i</span><span className="an-echo-pause">e</span><span>t</span><span> </span><span className="an-echo-bad">l</span><span>i</span><span>b</span><span>r</span><span>a</span><span>r</span><span>y</span>
              </div>
              <small>replay any run. hesitations glow, misses ring</small>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section land-everyone" id="everyone">
        <div className="land-inner">
          <div className="land-head rv">
            <span className="land-eyebrow">Who it is for</span>
            <h2>One world. Every typist.</h2>
            <p className="land-lede">One road, six very different travellers. Find yours.</p>
          </div>

          <div className="trail">
            <svg className="trail-line" viewBox="0 0 1000 240" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="trailGrad" x1="0" y1="0" x2="1" y2="0">
                  {TRAIL.map((t, i) => (
                    <stop key={t.key} offset={`${(i / (TRAIL.length - 1)) * 100}%`} stopColor={t.hue} />
                  ))}
                </linearGradient>
                {/* The road is revealed by a rect sweeping left to right rather
                    than by a stroke-dash offset. Dashes advance along arc
                    length, which on a serpentine runs fast through the flats
                    and slow through the bends, so the line drifts out of step
                    with the evenly spaced stops. A wipe advances linearly in x,
                    so stop N is reached at exactly N/6 of the scroll. It also
                    sidesteps getTotalLength() reporting viewBox units while a
                    non-scaling stroke dashes in screen pixels. */}
                <clipPath id="trailClip" clipPathUnits="userSpaceOnUse">
                  <rect ref={trailClipRef} x="0" y="-40" width="1000" height="320" />
                </clipPath>
              </defs>
              <path
                d={TRAIL_PATH}
                clipPath="url(#trailClip)"
                fill="none"
                stroke="url(#trailGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <ol className="trail-stops">
              {TRAIL.map((t, i) => (
                <li
                  className={`trail-stop ${i % 2 === 0 ? 'is-up' : 'is-down'}`}
                  key={t.key}
                  style={{ '--tc': t.hue } as React.CSSProperties}
                >
                  <Link to={t.to}>
                    <span className="trail-dot"><Ic n={t.icon} size={19} /></span>
                    <span className="trail-label">
                      <h3>{t.name}</h3>
                      <span>{t.line}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="land-section land-access">
        <div className="land-inner">
          <div className="land-head rv">
            <span className="land-eyebrow">Accessibility</span>
            <h2>Built for every body and brain.</h2>
            <p className="land-lede">
              Easy to claim, so here it is happening. Keep scrolling and watch the sample below
              rebuild itself, one setting at a time.
            </p>
          </div>

          <div className="a11y">
            {/* The stage is first in the DOM so it can stick to the top of a
                phone screen with the steps scrolling beneath it. On a desktop
                `order` moves it back to the right. */}
            <div className="a11y-stage">
              <div className={`a11y-screen ${A11Y_STEPS.slice(0, aStep + 1).map((s) => s.cls).join(' ')}`}>
                <div className="a11y-bar" aria-hidden>
                  <span className="a11y-chip">Accuracy Lab</span>
                  <span className="a11y-chip a11y-timer">0:42</span>
                </div>
                <p className="a11y-spec" aria-hidden>
                  <b className="ok">the quiet library keeps </b>
                  <b className="bad">o</b>
                  <b className="ok">ts own kind of</b>
                  <i className="a11y-caret" />
                  <b className="todo"> weather</b>
                </p>
                <div className="a11y-key" aria-hidden>
                  <span className="ok">correct</span>
                  <span className="bad">mistyped</span>
                </div>
              </div>
            </div>

            <ol className="a11y-steps">
              {A11Y_STEPS.map((st, i) => (
                <li className={`a11y-step${i === aStep ? ' is-on' : ''}`} key={st.cls}>
                  <span className="a11y-step-n" aria-hidden><Ic n={st.icon} size={22} /></span>
                  <h3>{st.title}</h3>
                  <p>{st.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <p className="a11y-rest rv">
            Also, and without a paid tier anywhere in sight: full keyboard navigation on every
            screen, spoken target letters, dictation with replay and speed control, and
            leaderboards you can switch off entirely. Each one is a per-profile setting, because
            an accommodation should belong to the person, not to the laptop they borrowed.
          </p>
        </div>
      </section>

      <section className="land-section land-themes">
        <div className="land-inner">
          <h2 className="rv">Twelve worlds to type in.</h2>
          <p className="land-lede rv">Themes change illustration, keyboard, sound and celebration. You unlock them by learning, not paying.</p>
        </div>
        <div className="theme-marquee" aria-hidden>
          <div className="theme-track">
            {[...THEMES, ...THEMES].map((t, i) => (
              <span className="theme-pill" key={i} style={{ background: t.preview[0], color: t.preview[2], borderColor: t.preview[1] }}>
                <i style={{ background: t.preview[1] }} />{t.name}
              </span>
            ))}
          </div>
        </div>
        <div className="land-inner">
          <div className="quote-row">
            {EXPLORER_QUOTES.slice(0, 3).map((q) => (
              <blockquote className="tiny-quote rv" key={q.by}>“{q.text}”<cite>{q.by}</cite></blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="land-section land-final">
        <div className="land-inner center">
          <h2 className="rv">Your keyboard is waiting.</h2>
          <p className="land-lede rv">Two minutes of onboarding. Sixty seconds of assessment. A lifetime skill.</p>
          <div className="hero-ctas rv" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary btn-big" to="/onboarding">Begin your journey →</Link>
            {hasProfile ? <Link className="btn btn-soft btn-big" to="/app">Continue training</Link> : hasAnyProfile ? <Link className="btn btn-soft btn-big" to="/who">Choose profile</Link> : null}
          </div>
        </div>
      </section>

      <footer className="land-footer">
        <div className="land-inner land-footer-inner">
          <div>
            <Logo size={26} />
            <p className="small muted" style={{ marginTop: 8, maxWidth: 300 }}>
              Every keyboard is a world. KeyTopia is free, carries no advertising, and writes every
              keystroke to your own browser first, so practice never waits on the network.
            </p>
          </div>
          <div className="foot-col">
            <strong>Product</strong>
            <Link to="/adaptive-practice">Adaptive practice</Link>
            <Link to="/typing-practice-modes">Practice modes</Link>
            <Link to="/typing-games">Typing games</Link>
            <Link to="/typing-races">Typing races</Link>
            <Link to="/typing-analytics">Analytics</Link>
          </div>
          <div className="foot-col">
            <strong>Learn</strong>
            <Link to="/learn-to-type">How to learn typing</Link>
            <Link to="/curriculum">The curriculum</Link>
            <Link to="/typing-test">Free typing test</Link>
            <Link to="/typing-glossary">Glossary</Link>
            <Link to="/faq">FAQ</Link>
          </div>
          <div className="foot-col">
            <strong>Who it is for</strong>
            <Link to="/typing-for-kids">Kids</Link>
            <Link to="/typing-for-schools">Schools</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
