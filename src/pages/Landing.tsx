import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { KeyboardScene } from './landing3d';
import { Logo, Chip } from '../components/ui';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { RhythmFingerprint } from '../components/charts';
import { useStore } from '../lib/store';
import { THEMES } from '../lib/themes';
import { EXPLORER_QUOTES } from '../lib/words';
import { Ic } from '../components/icons';
import { BlockAvatar } from '../components/avatars';

gsap.registerPlugin(ScrollTrigger);

const MODE_CHIPS = [
  ['brain', 'Adaptive practice', 'Sets built from your weak keys'],
  ['dumbbell', 'Weak-key workout', 'Your worst key, repaired'],
  ['zap', 'Speed sprints', '15s to 5 minutes'],
  ['target', 'Accuracy Lab', 'Precision-first scoring'],
  ['waves', 'Rhythm studio', 'Type on the beat'],
  ['flower', 'Zen typing', 'No scores, just flow'],
  ['eye-off', 'Lights out', 'Wean off looking down'],
  ['braces', 'Code forge', 'Brackets & symbols'],
  ['headphones', 'Dictation', 'Type what you hear'],
  ['peaks', 'Numeral Peaks', 'Numbers & symbols row'],
  ['lifebuoy', 'Recovery', 'Stay calm after misses'],
  ['route', 'Endurance', 'Long-form stamina'],
  ['clipboard', 'Real-world desk', 'Emails & documents'],
  ['file', 'Copy desk', 'Practise your own text'],
] as const;

const SAMPLE_MASTERY: Record<string, string> = {};
'asdfjkl'.split('').forEach((c) => { SAMPLE_MASTERY[c] = 'var(--m-mastered)'; });
'erioghn'.split('').forEach((c) => { SAMPLE_MASTERY[c] = 'var(--m-reliable)'; });
'tuwcmv'.split('').forEach((c) => { SAMPLE_MASTERY[c] = 'var(--m-improving)'; });
'qpzb'.split('').forEach((c) => { SAMPLE_MASTERY[c] = 'var(--m-learning)'; });
'yx'.split('').forEach((c) => { SAMPLE_MASTERY[c] = 'var(--m-review)'; });

const FAKE_IKIS = Array.from({ length: 160 }, (_, i) => 210 + Math.sin(i * 0.7) * 40 + (i % 17 === 0 ? 320 : 0) + (i % 5) * 8);

export default function Landing() {
  const hasProfile = useStore((s) => !!s.activeId && !!s.profiles[s.activeId!]);
  const hasAnyProfile = useStore((s) => Object.keys(s.profiles).length > 0);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLElement>(null);
  const chartPathRef = useRef<SVGPathElement>(null);
  const sceneRef = useRef<KeyboardScene | null>(null);
  const [typed, setTyped] = useState<string[]>([]);

  const rm = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

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

      // race comets slide across on scroll
      gsap.utils.toArray<HTMLElement>('.demo-comet').forEach((el, i) => {
        gsap.fromTo(el, { left: '2%' }, {
          left: `${58 + i * 11}%`, ease: 'power1.inOut',
          scrollTrigger: { trigger: '.land-race', start: 'top 80%', end: 'center 40%', scrub: true },
        });
      });
    }, rootRef);
    return () => ctx.revert();
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
              <Link className="btn btn-primary btn-big" to="/onboarding">Start learning — it's free</Link>
              <Link className="btn btn-soft btn-big" to="/onboarding?quick=1">Take the 60-second assessment</Link>
            </div>
            <div className="hero-try" aria-live="off">
              <span className="hero-try-label">psst — the keyboard below is live. try typing!</span>
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
          <div className="world-sticky">
            <div className="world-head">
              <h2>Every keyboard is a world<br />waiting to be mastered.</h2>
              <p>Scroll on — watch your keyboard become terrain. Each region is a stage of the journey from first key to full flow.</p>
            </div>
            <div className="world-label wl-1"><strong>🌾 The Heartlands</strong><span>home row · where every journey begins</span></div>
            <div className="world-label wl-2"><strong>🏔 Skyreach Ridge</strong><span>top row · reaches & returns</span></div>
            <div className="world-label wl-3"><strong>🌲 Deeproot Vale</strong><span>bottom row · curl & control</span></div>
            <div className="world-label wl-4"><strong>⛰ Numeral Peaks</strong><span>numbers & symbols · the high country</span></div>
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
              <p>A 60-second placement reads your speed, accuracy, rhythm, hesitation, backspace habits and per-key reflexes — then names your rank and draws your starting map.</p>
            </article>
            <article className="how-card rv">
              <span className="how-num">2</span>
              <h3>Adapt</h3>
              <p>Every keystroke updates your Mastery Map. Practice sets are generated on the fly: weak keys and slow letter-pairs get extra reps, wrapped in real words so drills never feel like drills.</p>
            </article>
            <article className="how-card rv">
              <span className="how-num">3</span>
              <h3>Advance</h3>
              <p>Accuracy first, speed second, rhythm always. The coach holds you back from chasing speed too early — and tells you exactly why, after every single session.</p>
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
              “Your accuracy is already strong. Your next breakthrough will come from steadier <b>P</b> and <b>O</b>, and smoothing the <b>O→L</b> transition — here's a two-minute drill for exactly that.”
              <cite>— Kip, your typing coach, being annoyingly specific</cite>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="land-section land-modes" id="modes">
        <div className="land-inner">
          <h2 className="rv">Train your way.</h2>
          <p className="land-lede rv">Fourteen modes, one engine. Each names the skill it builds — so practice always has a purpose.</p>
          <div className="mode-grid">
            {MODE_CHIPS.map(([ic, name, sub]) => (
              <div className="mode-chip rv" key={name}>
                <span className="mode-chip-ic"><Ic n={ic} size={24} /></span>
                <strong>{name}</strong>
                <small>{sub}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="land-section land-play" id="play">
        <div className="land-inner">
          <h2 className="rv">Seven games that train, honestly.</h2>
          <p className="land-lede rv">Not typing glued onto someone else's arcade — every game is built around one real skill, and tells you which. Duels, tournaments, towers, ciphers and calm little forges.</p>
          <div className="play-grid">
            <article className="play-card rv" data-speed={-0.6}>
              <div className="play-art pa-wordfall" aria-hidden><span>w</span><span>o</span><span>r</span><span>d</span><span>s</span></div>
              <h3><Ic n="shield" size={18} /> Wordfall Defence</h3>
              <p>Words drift toward your light-shield. Careless speed weakens it; calm accuracy saves the city.</p>
              <Chip tone="accent">Accuracy under pressure</Chip>
            </article>
            <article className="play-card rv" data-speed={0.4}>
              <div className="play-art pa-forge" aria-hidden><Ic n="hammer" size={40} /><i>✦</i><i>✦</i><i>✦</i></div>
              <h3><Ic n="hammer" size={18} /> Keyforge</h3>
              <p>The fire only burns while you type — misses vent heat, treasures make it hungrier. Forge before it goes cold.</p>
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
              <p>Best-of-seven phrase duel against a rival matched to your pace — you watch them typing, cursor and all.</p>
              <Chip tone="accent">Burst speed under pressure</Chip>
            </article>
            <article className="play-card rv" data-speed={-0.3}>
              <div className="play-art pa-sprint" aria-hidden>
                <span className="ps-finish"><Ic n="crown" size={16} /></span>
                <i className="ps-dot" /><i className="ps-dot" /><i className="ps-dot" /><i className="ps-dot" />
              </div>
              <h3><Ic n="crown" size={18} /> Survivor Sprint</h3>
              <p>Eight typists, four rapid heats — the slowest head to the cheer bench each round. Outlast them all.</p>
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
              <p>Every word becomes a block — clean words build wide and steady, sloppy ones crumble the tower.</p>
              <Chip tone="accent">Word-perfect precision</Chip>
            </article>
          </div>
        </div>
      </section>

      <section className="land-section land-race">
        <div className="land-inner">
          <h2 className="rv">Race the Lightstream.</h2>
          <p className="land-lede rv">CPU rivals with believable habits — slow starters, streaky sprinters. Ghosts of your best runs. Private rooms with safe names for friends and classrooms. No strangers, no chat, ever.</p>
          <div className="race-demo rv" aria-hidden>
            {[2, 5, 8, 11].map((p, i) => (
              <div className="race-demo-lane" key={p}>
                <span className="demo-comet" style={{ animationDelay: `${i * 0.3}s` }}><BlockAvatar preset={p} size={22} /></span>
                <i className="demo-trail" />
              </div>
            ))}
          </div>
          <div className="row gap wrap rv" style={{ justifyContent: 'center' }}>
            <Chip><Ic n="bot" size={13} /> 5 CPU difficulties + adaptive</Chip>
            <Chip><Ic n="ghost" size={13} /> Ghost of your best run</Chip>
            <Chip><Ic n="ticket" size={13} /> Private rooms with join codes</Chip>
            <Chip><Ic n="trophy" size={13} /> Ranked seasons (coming online)</Chip>
          </div>
        </div>
      </section>

      <section className="land-section land-analytics" id="stats">
        <div className="land-inner">
          <h2 className="rv">See yourself getting better.</h2>
          <p className="land-lede rv">Beginner-friendly on the surface, expert-deep underneath: per-key heatmaps, finger balance, rhythm fingerprints, session echoes, records and a practice calendar.</p>
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
              <small>replay any run — hesitations glow, misses ring</small>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section land-everyone" id="everyone">
        <div className="land-inner">
          <h2 className="rv">One world. Every typist.</h2>
          <div className="who-grid">
            <article className="who-card rv"><Ic n="smile" size={28} /><h3>Kids</h3><p>Short quests, friendly words, big visual feedback, a glowing companion — and rewards for care, never for screen time. Safe generated names only.</p></article>
            <article className="who-card rv"><Ic n="headphones" size={28} /><h3>Teens</h3><p>Streaks, missions, ranked divisions, themes worth unlocking — practice that respects your time and your aesthetic.</p></article>
            <article className="who-card rv"><Ic n="briefcase" size={28} /><h3>Adults</h3><p>Ten focused minutes a day. Workplace texts, email drills, a minimal focus mode, and analytics that treat you like a grown-up.</p></article>
            <article className="who-card rv"><Ic n="trophy" size={28} /><h3>Competitors</h3><p>Consistency scoring, rhythm training, ghost racing, endurance tests and per-transition timing data to find your last few WPM.</p></article>
            <article className="who-card rv"><Ic n="school" size={28} /><h3>Schools</h3><p>Classroom rooms, assignable lessons, printable progress, per-student accessibility profiles. Teacher dashboard in preview today.</p></article>
            <article className="who-card rv"><Ic n="users" size={28} /><h3>Families</h3><p>Multiple explorers per device, a guardian summary view, and a local-first design: children's data never leaves the browser.</p></article>
          </div>
        </div>
      </section>

      <section className="land-section land-access">
        <div className="land-inner land-access-inner rv">
          <h2>Built for every body and brain.</h2>
          <div className="access-list">
            <span><Ic n="keyboard" size={14} /> Full keyboard navigation</span>
            <span><Ic n="zoom" size={14} /> Four text sizes</span>
            <span><Ic n="type" size={14} /> Atkinson Hyperlegible font option</span>
            <span><Ic n="eye" size={14} /> High-contrast theme</span>
            <span><Ic n="leaf" size={14} /> Reduced-motion mode</span>
            <span><Ic n="hourglass" size={14} /> Untimed learning</span>
            <span><Ic n="chat" size={14} /> Spoken target letters</span>
            <span><Ic n="headphones" size={14} /> Dictation with replay & speed control</span>
            <span><Ic n="check" size={14} /> Never colour-only feedback</span>
            <span><Ic n="eye-off" size={14} /> Hideable leaderboards</span>
          </div>
          <p className="muted">Accessibility is a core requirement in KeyTopia — not a settings page we added later.</p>
        </div>
      </section>

      <section className="land-section land-themes">
        <div className="land-inner">
          <h2 className="rv">Twelve worlds to type in.</h2>
          <p className="land-lede rv">Themes change illustration, keyboard, sound and celebration — you unlock them by learning, not paying.</p>
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
              <blockquote className="tiny-quote rv" key={q.by}>“{q.text}”<cite>— {q.by}</cite></blockquote>
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
              Every keyboard is a world. KeyTopia is a local-first prototype — all progress lives in your browser. No accounts, no tracking, no uploads.
            </p>
          </div>
          <div className="foot-col">
            <strong>Product</strong>
            <Link to="/onboarding">Start learning</Link>
            <Link to="/onboarding?quick=1">60-second assessment</Link>
            <Link to="/app">Open the app</Link>
          </div>
          <div className="foot-col">
            <strong>Inside</strong>
            <a href="#how">The method</a>
            <a href="#modes">Training modes</a>
            <a href="#play">Games & races</a>
            <a href="#stats">Analytics</a>
          </div>
          <div className="foot-col">
            <strong>Promise</strong>
            <span className="small muted">Accuracy before speed.</span>
            <span className="small muted">Safety before rankings.</span>
            <span className="small muted">Joy before streak-guilt.</span>
          </div>
        </div>
        <p className="center small muted" style={{ paddingBottom: 26 }}>KeyTopia · an original typing-learning world · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
