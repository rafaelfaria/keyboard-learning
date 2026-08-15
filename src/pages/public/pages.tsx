/**
 * The crawlable content pages.
 *
 * Every one of these is rendered twice: once to static HTML at build time by
 * scripts/prerender.mjs (what a non-JS crawler, an AI agent or a link-preview
 * bot sees), and once in the browser (what a person sees). They therefore
 * import nothing that touches a browser global — no store, no sound, no GSAP.
 *
 * All copy comes from src/lib/seo/content.ts so that the page, the JSON-LD and
 * llms.txt can never disagree about what the product does.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CtaBand, NextSteps, PublicPage } from '../../components/public/PublicPage';
import {
  MockAnalytics, MockCoach, MockModes, MockPractice, MockRace,
} from '../../components/public/Mock';
import { pageByPath, type PublicPage as PageDef } from '../../lib/seo/site';
import {
  ACCESSIBILITY, AUDIENCES, CORE_FEATURES, CURRICULUM, FAQS, GAMES, GLOSSARY,
  KIDS_POINTS, LEARN_GUIDE, LEARN_GUIDE_INTRO, LEGAL_CONTACT, LEGAL_EFFECTIVE,
  METHOD_STEPS, MODE_CLUSTERS, PRIVACY_SECTIONS, PRODUCT_SUMMARY, SCHOOLS_POINTS, SESSION_LOOP,
  SUBPROCESSORS, TERMS_SECTIONS, TRAINING_MODES,
  type GuideSection,
} from '../../lib/seo/content';

/** Page definitions are guaranteed present — the registry drives the router. */
const def = (path: string): PageDef => {
  const p = pageByPath(path);
  if (!p) throw new Error(`No PublicPage registered for ${path}`);
  return p;
};

function Sections({ sections }: { sections: GuideSection[] }) {
  return (
    <>
      {sections.map((s, i) => (
        <section className="pub-section" key={s.heading} id={`step-${i + 1}`}>
          <h2>{s.heading}</h2>
          {s.paragraphs.map((para) => <p key={para.slice(0, 40)}>{para}</p>)}
          {s.bullets && (
            <ul className="pub-bullets">
              {s.bullets.map((b) => <li key={b.slice(0, 40)}>{b}</li>)}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

function FeatureGrid({ items }: { items: { name: string; description: string }[] }) {
  return (
    <div className="pub-grid">
      {items.map((f) => (
        <article className="pub-card" key={f.name}>
          <h3>{f.name}</h3>
          <p>{f.description}</p>
        </article>
      ))}
    </div>
  );
}

// ── /learn-to-type ─────────────────────────────────────────────────────────

export function LearnToTypePage() {
  return (
    <PublicPage
      page={def('/learn-to-type')}
      lede="The method, written out in full: what to practise, in what order, and why the usual advice about speed is backwards."
    >
      <p className="pub-intro">{LEARN_GUIDE_INTRO}</p>

      <nav className="pub-toc" aria-label="On this page">
        <strong>On this page</strong>
        <ol>
          {LEARN_GUIDE.map((s, i) => (
            <li key={s.heading}><a href={`#step-${i + 1}`}>{s.heading}</a></li>
          ))}
        </ol>
      </nav>

      <Sections sections={LEARN_GUIDE} />

      <section className="pub-section">
        <h2>The three-step loop KeyTopia uses</h2>
        <ol className="pub-steps">
          {METHOD_STEPS.map((s) => (
            <li key={s.name}><strong>{s.name}.</strong> {s.text}</li>
          ))}
        </ol>
      </section>

      <CtaBand
        title="Put the method to work"
        body="A 60-second assessment, then lessons built from your own weak keys. Free, and free of adverts."
      />

      <NextSteps items={[
        { path: '/curriculum', label: 'See the full curriculum', note: 'All 41 lessons, in the order you meet them.' },
        { path: '/typing-test', label: 'Measure where you are', note: 'WPM, accuracy, consistency and per-key timing.' },
        { path: '/typing-glossary', label: 'Typing glossary', note: 'WPM, raw WPM, IKI, bigrams and the rest, explained.' },
      ]} />
    </PublicPage>
  );
}

// ── /curriculum ────────────────────────────────────────────────────────────

export function CurriculumPage() {
  return (
    <PublicPage
      page={def('/curriculum')}
      lede="Nine regions, folded into five worlds, 41 lessons. Difficulty ramps between worlds rather than inside them, so no single lesson ever jumps."
      wide
    >
      <p className="pub-intro">
        The curriculum rebuilds itself around your keyboard layout — QWERTY, QWERTZ, AZERTY,
        Dvorak or Colemak — so the lesson order always reflects the keys your fingers actually
        reach for. Each world has a target speed and accuracy; the check lesson at the end of a
        region has to be cleared before the next region opens.
      </p>

      {CURRICULUM.map((w) => (
        <section className="pub-section" key={w.name}>
          <h2>{w.name}</h2>
          <p className="pub-meta">
            {w.tagline} · <span>{w.targetWpm}</span> · <span>{w.targetAccuracy}</span>
          </p>
          <div className="pub-grid">
            {w.regions.map((r) => (
              <article className="pub-card" key={r.region}>
                <h3>{r.region}</h3>
                <p className="pub-skill">{r.skill}</p>
                <p>{r.description}</p>
              </article>
            ))}
          </div>
        </section>
      ))}

      <CtaBand
        title="Start at the right place, not at lesson one"
        body="The placement assessment reads your current technique and opens the curriculum where you actually are."
      />

      <NextSteps items={[
        { path: '/learn-to-type', label: 'How to learn touch typing', note: 'The method behind the lesson order.' },
        { path: '/typing-games', label: 'The seven games', note: 'What each one trains, and why.' },
        { path: '/typing-for-schools', label: 'For schools', note: 'Assignable lessons and classroom rooms.' },
      ]} />
    </PublicPage>
  );
}

// ── /typing-games ──────────────────────────────────────────────────────────

export function TypingGamesPage() {
  return (
    <PublicPage
      page={def('/typing-games')}
      lede="Not typing glued onto someone else's arcade game. Each one is built around a single named skill, and tells you which skill that is."
      wide
    >
      <p className="pub-intro">
        A typing game only helps if the thing it rewards is the thing you want to get better at.
        Most reward raw speed, which is exactly the habit that stalls learners. These reward the
        specific skill named on each card, and the result feeds the same mastery map your lessons do.
      </p>

      <div className="pub-grid">
        {GAMES.map((g) => (
          <article className="pub-card pub-card-game" key={g.slug}>
            <h2>{g.name}</h2>
            <p className="pub-skill">Trains: {g.skill}</p>
            <p>{g.description}</p>
          </article>
        ))}
      </div>

      <section className="pub-section">
        <h2>Racing</h2>
        <p>
          Beyond the games, races put you against CPU rivals with believable habits — slow starters,
          streaky sprinters — across five difficulties plus an adaptive one. You can race the ghost
          of your own best run, and private rooms with join codes let friends or a classroom race
          together. There is no public matchmaking, no strangers and no chat, ever.
        </p>
      </section>

      <CtaBand title="Play something that actually trains you" body="Every game is free and runs in the browser. Nothing to download." />

      <NextSteps items={[
        { path: '/typing-for-kids', label: 'Typing for kids', note: 'The island world, quests and guardian pals.' },
        { path: '/curriculum', label: 'The curriculum', note: 'Where the games plug into the lesson map.' },
        { path: '/typing-test', label: 'Free typing test', note: 'Get a baseline before you play.' },
      ]} />
    </PublicPage>
  );
}

// ── /typing-for-kids ───────────────────────────────────────────────────────

export function KidsPage() {
  return (
    <PublicPage
      page={def('/typing-for-kids')}
      lede="An island world where children learn to type properly — and where the rewards are for careful typing, not for time spent staring at a screen."
    >
      <p className="pub-intro">
        Children do not need a different typing method from adults; they need a different pace, a
        different vocabulary and a world worth returning to. The kids track uses the same adaptive
        engine and the same mastery map underneath, wrapped in a five-island journey with one stop
        per lesson.
      </p>

      <FeatureGrid items={KIDS_POINTS} />

      <section className="pub-section">
        <h2>What a parent should know</h2>
        <p>
          There is nothing to pay for, and your child never signs in: you hold the account, they get a
          profile under it. The text a child types stays in the browser on your device, and only the
          finished result of an exercise is saved. See the <Link to="/privacy">privacy policy</Link>{' '}
          for exactly what that means. There is no chat, no messaging, no public leaderboard and no way
          for a stranger to reach a child through KeyTopia. Racing opponents are computer-controlled.
        </p>
        <p>
          Up to four children can share one account and one device, each with their own explorer
          profile, mastery map and accessibility settings, and a guardian view summarises real
          progress rather than minutes logged.
        </p>
      </section>

      <CtaBand title="Set up an explorer" body="Two minutes of onboarding, then the first island. Free, and your child never signs in." />

      <NextSteps items={[
        { path: '/typing-for-schools', label: 'For schools', note: 'The same world, run across a classroom.' },
        { path: '/typing-games', label: 'The games', note: 'What each game trains.' },
        { path: '/faq', label: 'FAQ', note: 'Ages, layouts, data and accessibility.' },
      ]} />
    </PublicPage>
  );
}

// ── /typing-for-schools ────────────────────────────────────────────────────

export function SchoolsPage() {
  return (
    <PublicPage
      page={def('/typing-for-schools')}
      lede="Classroom typing practice with nothing to provision, nothing to pay for, and no student keystroke data leaving the room."
    >
      <p className="pub-intro">
        Most classroom typing software asks you to create an account for every student, then stores
        everything they type on someone else's server. KeyTopia does neither. You sign in once,
        pupils join your class with a code rather than an email address, and what they type stays in
        the browser. Only the finished result of an exercise reaches the class board.
      </p>

      <FeatureGrid items={SCHOOLS_POINTS} />

      <section className="pub-section">
        <h2>How a lesson typically runs</h2>
        <ol className="pub-steps">
          <li><strong>Baseline.</strong> Each student takes the 60-second placement so the curriculum opens at their real level rather than at lesson one for everybody.</li>
          <li><strong>Assign.</strong> Point the class at a region — home row, top row, capitals — and let the adaptive engine vary the practice text per student from there.</li>
          <li><strong>Race.</strong> Finish with a private race room; the join code keeps it to your class, and the ghost-run option lets slower typists compete against themselves.</li>
          <li><strong>Review.</strong> The progress view shows per-key mastery and accuracy trends, which is far more useful for intervention than a WPM league table.</li>
        </ol>
      </section>

      <section className="pub-section">
        <h2>Accessibility in the classroom</h2>
        <p>
          Accommodations are per-profile, so they travel with the student across shared devices:
          {' '}{ACCESSIBILITY.join(', ').toLowerCase()}. Nothing is behind a paid tier.
        </p>
      </section>

      <CtaBand title="Try it with one class" body="No sign-up, no procurement, no data agreement to negotiate. Open the page and go." />

      <NextSteps items={[
        { path: '/curriculum', label: 'The curriculum', note: 'What is taught, in what order.' },
        { path: '/typing-for-kids', label: 'For younger pupils', note: 'The island world and its safety model.' },
        { path: '/privacy', label: 'Privacy', note: 'Exactly what is stored and where.' },
      ]} />
    </PublicPage>
  );
}

// ── /faq ───────────────────────────────────────────────────────────────────

export function FaqPage() {
  return (
    <PublicPage
      page={def('/faq')}
      lede="Pricing, layouts, ages, accessibility, data, and how the numbers are actually calculated."
    >
      <div className="pub-faq">
        {FAQS.map((f) => (
          <details className="pub-faq-item" key={f.question} open>
            <summary><h2>{f.question}</h2></summary>
            <p>{f.answer}</p>
          </details>
        ))}
      </div>

      <NextSteps items={[
        { path: '/learn-to-type', label: 'How to learn touch typing', note: 'The full method in one page.' },
        { path: '/typing-glossary', label: 'Typing glossary', note: 'Every term these answers use.' },
        { path: '/typing-test', label: 'Free typing test', note: 'See where you are right now.' },
      ]} />
    </PublicPage>
  );
}

// ── /typing-glossary ───────────────────────────────────────────────────────

export function GlossaryPage() {
  return (
    <PublicPage
      page={def('/typing-glossary')}
      lede="Plain-English definitions of the terms typing tools throw at you — including the ones they rarely explain."
    >
      <nav className="pub-toc pub-toc-inline" aria-label="Terms">
        <strong>Jump to</strong>
        <ul>
          {GLOSSARY.map((t) => <li key={t.slug}><a href={`#${t.slug}`}>{t.term}</a></li>)}
        </ul>
      </nav>

      <dl className="pub-glossary">
        {GLOSSARY.map((t) => (
          <div className="pub-term" key={t.slug} id={t.slug}>
            <dt><h2>{t.term}</h2></dt>
            <dd>{t.definition}</dd>
          </div>
        ))}
      </dl>

      <NextSteps items={[
        { path: '/typing-test', label: 'Free typing test', note: 'See these measurements on your own typing.' },
        { path: '/learn-to-type', label: 'Learn to type', note: 'What to do with the numbers.' },
        { path: '/faq', label: 'FAQ', note: 'Common questions answered.' },
      ]} />
    </PublicPage>
  );
}

// ── Product pages ──────────────────────────────────────────────────────────

/** A product screenshot with the sentence that explains what you are looking at. */
function Shot({ children, note }: { children: ReactNode; note: string }) {
  return (
    <div className="pub-shot">
      {children}
      <p className="pub-shot-note">{note}</p>
    </div>
  );
}

export function AdaptivePracticePage() {
  return (
    <PublicPage
      page={def('/adaptive-practice')}
      lede="Most typing tutors give everyone lesson one. KeyTopia reads what your fingers actually do, then builds the next two minutes out of the keys you keep getting wrong."
      wide
    >
      <p className="pub-intro">
        The engine has one job: know, at all times, which keys and which letter transitions are
        costing you. Every keystroke you make carries a timestamp and an outcome, and both feed a
        per-key mastery map that decides what you practise next. Nothing about that is visible while
        you type. You just notice that the awkward keys keep turning up until they stop being awkward.
      </p>

      <Shot note="A practice set in progress. The chip in the corner names the keys this set was built from, and the map along the bottom is the same data the engine used to choose them.">
        <MockPractice />
      </Shot>

      <section className="pub-section">
        <h2>The mastery map</h2>
        <p>
          Every key sits in one of five tiers: mastered, reliable, improving, learning and needs
          review. A key moves up on clean, unhurried repetitions and slips back when it starts
          costing you time or accuracy again, so the map reflects your typing this week rather than
          your typing in general. It is the same map the kids world draws as an island chart and the
          adult world draws as a keyboard heatmap.
        </p>
        <p>
          Keys are only half of it. The engine also tracks transitions, the letter pairs your hands
          have to move between, because a slow O and a slow L are a different problem from a slow
          O followed by an L. Pair timing is where most of the speed hiding in an intermediate
          typist actually is.
        </p>
      </section>

      <section className="pub-section">
        <h2>How a practice set gets built</h2>
        <ol className="pub-steps">
          <li><strong>Pick the targets.</strong> The two or three weakest keys, plus the slowest transitions that involve them.</li>
          <li><strong>Find real words.</strong> Targets are wrapped in genuine vocabulary rather than nonsense strings, so you practise the movement in the shape it takes in real writing.</li>
          <li><strong>Keep it honest.</strong> Sets are salted with keys you already own, so a session is not a wall of your worst letters and your accuracy has somewhere to stand.</li>
          <li><strong>Re-read and adjust.</strong> The set that follows is chosen from the data this one produced, not from a fixed schedule.</li>
        </ol>
      </section>

      <section className="pub-section">
        <h2>A coach that names the fix</h2>
        <p>
          Encouragement is easy to generate and worth very little. After every session Kip reads the
          actual numbers and says which keys, which transition, and what to do about it in the next
          three minutes. When you are ready to chase speed it says so. When you are not, it says that
          too, and explains why holding accuracy first gets you there faster.
        </p>
      </section>

      <Shot note="The end-of-session report. The prescription underneath is not a suggestion list, it is what the next sets will actually contain.">
        <MockCoach />
      </Shot>

      <CtaBand
        title="Find out what your weak keys actually are"
        body="The 60-second placement draws your first map, and practice starts from there rather than from lesson one."
      />

      <NextSteps items={[
        { path: '/typing-practice-modes', label: 'The practice modes', note: 'Fourteen ways to spend the next five minutes.' },
        { path: '/typing-analytics', label: 'The analytics', note: 'See the map, the trend and the replay.' },
        { path: '/learn-to-type', label: 'How to learn touch typing', note: 'The method the engine is built on.' },
      ]} />
    </PublicPage>
  );
}

export function PracticeModesPage() {
  return (
    <PublicPage
      page={def('/typing-practice-modes')}
      lede="Practice only pays if you know what it is buying. Every mode names the one skill it builds, so you can pick the five minutes you actually need."
      wide
    >
      <p className="pub-intro">
        Adaptive practice is the default and covers most days. The rest exist because typing is not
        one skill: the fix for a hesitant pinky is not the fix for a rushed rhythm, and neither is the
        fix for falling apart the moment you make a mistake. All of them feed the same mastery map.
      </p>

      <Shot note="The mode picker. Whatever you choose, the text you get is still generated from your own map.">
        <MockModes />
      </Shot>

      <section className="pub-section">
        <h2>What a session actually is</h2>
        <ol className="pub-steps">
          {SESSION_LOOP.map((st) => (
            <li key={st.name}><strong>{st.name}.</strong> {st.text}</li>
          ))}
        </ol>
      </section>

      {MODE_CLUSTERS.map((c) => (
        <section className="pub-section" key={c.name}>
          <h2>{c.name}</h2>
          <p>{c.blurb}</p>
          <dl className="pub-defs">
            {c.modes.map((m) => (
              <div key={m.name}>
                <dt>{m.name}</dt>
                <dd>{m.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <CtaBand
        title="Pick a mode and go"
        body="Every mode is free, runs in the browser, and takes as little as one minute."
      />

      <NextSteps items={[
        { path: '/adaptive-practice', label: 'The adaptive engine', note: 'Where the practice text comes from.' },
        { path: '/typing-games', label: 'The games', note: 'The same skills, with something at stake.' },
        { path: '/curriculum', label: 'The curriculum', note: 'The structured path through all of it.' },
      ]} />
    </PublicPage>
  );
}

export function RacesPage() {
  return (
    <PublicPage
      page={def('/typing-races')}
      lede="Racing is the part people come back for. It works because the rivals type like people do, and because there is never a stranger on the other side of the screen."
      wide
    >
      <p className="pub-intro">
        A race is the shortest possible way to find out whether a skill has become automatic. Under
        pressure, the technique you actually own is the technique that shows up. KeyTopia races are
        built to apply that pressure without the two things that usually come attached: public
        matchmaking, and the demoralising experience of losing to someone four times your speed.
      </p>

      <Shot note="A heat in progress. Your ghost is the dashed marker, running the exact pace of your own best result on this text.">
        <MockRace />
      </Shot>

      <section className="pub-section">
        <h2>Rivals with habits</h2>
        <p>
          A rival that types at a flat, perfect rate is not a race, it is a metronome you either beat
          or do not. KeyTopia rivals have believable shapes: slow starters who come back at you in the
          last quarter, streaky sprinters who surge and stall, steady plodders who never make a
          mistake. Five difficulties are fixed, and a sixth reads your recent sessions and matches
          itself to a pace you can just about hold.
        </p>
      </section>

      <section className="pub-section">
        <h2>Race your own ghost</h2>
        <p>
          The most useful opponent is usually you, last week. Ghost racing replays your best run on a
          passage keystroke by keystroke, so you can see exactly where you used to hesitate and
          whether you still do. For a slower typist in a class of faster ones it is the difference
          between a race worth entering and one worth avoiding.
        </p>
      </section>

      <section className="pub-section">
        <h2>Private rooms only</h2>
        <p>
          Rooms are created with a join code and are limited to whoever you give it to. There is no
          public matchmaking, no friend requests, no chat and no messaging of any kind, which means
          there is no route by which a stranger can reach a child through a KeyTopia race. A teacher
          can open a room for a class in a few seconds and every result lands on the class board.
        </p>
      </section>

      <CtaBand title="Open a room, or race a bot" body="Five difficulties, an adaptive rival, and the ghost of your own best run. All free." />

      <NextSteps items={[
        { path: '/typing-games', label: 'The games', note: 'Seven other ways to compete with yourself.' },
        { path: '/typing-for-schools', label: 'For schools', note: 'How race rooms work in a classroom.' },
        { path: '/typing-analytics', label: 'The analytics', note: 'What a race actually told you.' },
      ]} />
    </PublicPage>
  );
}

export function AnalyticsPage() {
  return (
    <PublicPage
      page={def('/typing-analytics')}
      lede="A words-per-minute number tells you almost nothing about what to do next. These views tell you exactly what to do next."
      wide
    >
      <p className="pub-intro">
        KeyTopia records the timing of every keystroke you make, and then works hard to show you only
        the part of that which is actionable. The surface is readable by a nine-year-old. What sits
        underneath is detailed enough that competitive typists use it to find their last few words
        per minute.
      </p>

      <Shot note="The progress view. The trend is the headline, the fingerprint is the diagnosis, and the map underneath is what practice will target next.">
        <MockAnalytics />
      </Shot>

      <section className="pub-section">
        <h2>The measurements, and what each is for</h2>
        <dl className="pub-defs">
          <div><dt>Per-key heatmap</dt><dd>Which letters are slow, which are error-prone, and which have quietly gone backwards since last month. The single most useful view for deciding what to practise.</dd></div>
          <div><dt>Transition timing</dt><dd>Every letter pair, ranked by how long your hands take to move between them. Slow pairs are where an intermediate typist's missing speed usually lives.</dd></div>
          <div><dt>Rhythm fingerprint</dt><dd>Your inter-key intervals drawn as a ring. A round ring means metronome-steady hands. Spikes are hesitations, and they cost more than any single mistake.</dd></div>
          <div><dt>Consistency score</dt><dd>How repeatable your speed is, run to run. Rising consistency at flat speed is real progress, and it is the thing that always improves before speed does.</dd></div>
          <div><dt>Finger and hand balance</dt><dd>How the workload is distributed. A pinky doing an index finger's job is a technique problem no amount of practice volume will fix.</dd></div>
          <div><dt>Session echo</dt><dd>A keystroke-level replay of any run. Hesitations glow, misses ring. It is the fastest way to see a habit you did not know you had.</dd></div>
          <div><dt>Records and calendar</dt><dd>Personal bests per passage and per mode, and a practice calendar that shows frequency without turning a missed day into a punishment.</dd></div>
        </dl>
      </section>

      <section className="pub-section">
        <h2>Raw speed against net speed</h2>
        <p>
          Both numbers are always shown. Raw counts every keystroke, net counts only the ones that
          survived. The gap between them is the price of your mistakes in words per minute, and
          watching that gap close is a far better measure of progress than watching either number
          on its own.
        </p>
      </section>

      <section className="pub-section">
        <h2>Where the data lives</h2>
        <p>
          Keystroke timings are computed and stored in your browser, so nothing about your analytics
          depends on a connection. What syncs to your account is the finished result of a session and
          the mastery summary built from it, never the text you typed. The{' '}
          <Link to="/privacy">privacy policy</Link> sets out the whole chain.
        </p>
      </section>

      <CtaBand title="Get your first reading" body="The 60-second test produces every measurement on this page, immediately." />

      <NextSteps items={[
        { path: '/typing-test', label: 'Free typing test', note: 'Sixty seconds to a full breakdown.' },
        { path: '/typing-glossary', label: 'Typing glossary', note: 'Every term on this page, defined.' },
        { path: '/adaptive-practice', label: 'The adaptive engine', note: 'What the numbers get used for.' },
      ]} />
    </PublicPage>
  );
}

// ── /privacy and /terms ────────────────────────────────────────────────────

/** Shared chrome for the two legal documents: date stamp, contents, contact. */
function LegalPage({
  page, lede, sections, children,
}: {
  page: PageDef;
  lede: string;
  sections: GuideSection[];
  children?: ReactNode;
}) {
  return (
    <PublicPage page={page} lede={lede}>
      <p className="pub-legal-stamp">
        Last revised {LEGAL_EFFECTIVE} · questions to{' '}
        <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>
      </p>

      <nav className="pub-toc" aria-label="On this page">
        <strong>On this page</strong>
        <ol>
          {sections.map((s, i) => (
            <li key={s.heading}><a href={`#step-${i + 1}`}>{s.heading}</a></li>
          ))}
        </ol>
      </nav>

      <Sections sections={sections} />
      {children}
    </PublicPage>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      page={def('/privacy')}
      lede="What KeyTopia collects, what it deliberately never collects, and who else ever touches it. Written to be read rather than to be survived."
      sections={PRIVACY_SECTIONS}
    >
      <section className="pub-section" id="subprocessors">
        <h2>Sub-processors, in full</h2>
        <p>Every third party that ever holds KeyTopia data, and exactly what each one holds.</p>
        <dl className="pub-defs">
          {SUBPROCESSORS.map((s) => (
            <div key={s.name}>
              <dt>{s.name}</dt>
              <dd><em>{s.role}.</em> {s.data}</dd>
            </div>
          ))}
        </dl>
      </section>

      <NextSteps items={[
        { path: '/terms', label: 'Terms of use', note: 'The other half of the agreement.' },
        { path: '/typing-for-kids', label: 'Typing for kids', note: 'How the safety model works in practice.' },
        { path: '/typing-for-schools', label: 'For schools', note: 'Classroom data, and what reaches a class board.' },
      ]} />
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage
      page={def('/terms')}
      lede="Be decent, do not try to break it, and understand that a free learning tool comes with no guarantees. Everything below is that, said carefully."
      sections={TERMS_SECTIONS}
    >
      <NextSteps items={[
        { path: '/privacy', label: 'Privacy policy', note: 'What is collected and who processes it.' },
        { path: '/faq', label: 'FAQ', note: 'Pricing, accounts, layouts and data.' },
        { path: '/', label: 'Back to KeyTopia', note: 'Every keyboard is a world.' },
      ]} />
    </LegalPage>
  );
}

// ── The prerendered body for "/" ───────────────────────────────────────────

/**
 * The static content served at `/` before the 3D landing page boots.
 *
 * The real Landing (src/pages/Landing.tsx) depends on Three.js, GSAP and the
 * profile store, none of which can run in Node — so the crawlable version of
 * the home page is rendered from the same content data the landing page
 * presents. It is a faithful text version of what a visitor reads, not a
 * separate set of claims: React replaces it with the live landing on mount.
 */
export function HomeOutline() {
  return (
    <div className="pub-root pub-root-home">
      <h1>Don't just type faster. Learn to type beautifully.</h1>
      <p>{PRODUCT_SUMMARY}</p>

      <h2>KeyTopia learns you first</h2>
      <ol>
        {METHOD_STEPS.map((s) => <li key={s.name}><strong>{s.name}.</strong> {s.text}</li>)}
      </ol>

      <h2>What is inside</h2>
      <ul>
        {CORE_FEATURES.map((f) => <li key={f.name}><strong>{f.name}.</strong> {f.description}</li>)}
      </ul>

      <h2>Training modes</h2>
      <ul>
        {TRAINING_MODES.map((m) => <li key={m.name}><strong>{m.name}</strong> — {m.description}</li>)}
      </ul>

      <h2>Games that train, honestly</h2>
      <ul>
        {GAMES.map((g) => <li key={g.slug}><strong>{g.name}</strong> — trains {g.skill.toLowerCase()}. {g.description}</li>)}
      </ul>

      <h2>One world, every typist</h2>
      <ul>
        {AUDIENCES.map((a) => <li key={a.name}><strong>{a.name}.</strong> {a.description}</li>)}
      </ul>

      <h2>Built for every body and brain</h2>
      <ul>{ACCESSIBILITY.map((a) => <li key={a}>{a}</li>)}</ul>

      <h2>Common questions</h2>
      <dl>
        {FAQS.slice(0, 6).map((f) => (
          <div key={f.question}><dt><strong>{f.question}</strong></dt><dd>{f.answer}</dd></div>
        ))}
      </dl>

      <h2>Explore</h2>
      <ul>
        <li><Link to="/typing-test">Free typing test</Link></li>
        <li><Link to="/learn-to-type">How to learn touch typing</Link></li>
        <li><Link to="/curriculum">The full curriculum</Link></li>
        <li><Link to="/typing-games">The typing games</Link></li>
        <li><Link to="/adaptive-practice">How adaptive practice works</Link></li>
        <li><Link to="/typing-practice-modes">The practice modes</Link></li>
        <li><Link to="/typing-races">Typing races</Link></li>
        <li><Link to="/typing-analytics">Typing analytics</Link></li>
        <li><Link to="/typing-for-kids">Typing for kids</Link></li>
        <li><Link to="/typing-for-schools">Typing for schools</Link></li>
        <li><Link to="/faq">FAQ</Link></li>
        <li><Link to="/typing-glossary">Typing glossary</Link></li>
        <li><Link to="/privacy">Privacy</Link></li>
        <li><Link to="/terms">Terms</Link></li>
      </ul>
    </div>
  );
}
