/**
 * The factual content behind every public page.
 *
 * Single source of truth: the React pages render it, the prerenderer turns it
 * into crawlable HTML, `llms.txt` / `llms-full.txt` serialise it for AI agents,
 * and the JSON-LD builders lift structured data straight out of it. Nothing
 * here may drift from what a visitor actually sees, because it *is* what a
 * visitor sees.
 *
 * Browser-global free — the Node generators import this directly.
 */

export interface Faq {
  question: string;
  answer: string;
}

export interface Feature {
  name: string;
  description: string;
}

export interface GameEntry {
  name: string;
  slug: string;
  skill: string;
  description: string;
}

export interface GlossaryTerm {
  term: string;
  slug: string;
  definition: string;
}

export interface Audience {
  name: string;
  description: string;
}

export interface Step {
  name: string;
  text: string;
}

// ── Product ────────────────────────────────────────────────────────────────

export const PRODUCT_SUMMARY =
  'KeyTopia is a free, browser-based typing tutor. It assesses your typing in 60 seconds, then ' +
  'builds every practice set from your own weak keys and slow letter transitions. It is not a ' +
  'typing test with a leaderboard bolted on: it is a full curriculum (41 lessons across 5 worlds), ' +
  'fourteen training modes, seven original typing games, CPU racing, and analytics deep enough for ' +
  'competitive typists. It runs entirely in the browser and is free. Typing itself never waits on ' +
  'the network: every keystroke is written to local storage first, then synced to a free account ' +
  'so progress survives a lost device and follows you to the next one.';

export const PRODUCT_PRICE = { price: '0', currency: 'USD', note: 'Free. No subscription, no paid tier, no advertising.' };

export const CORE_FEATURES: Feature[] = [
  { name: 'Adaptive practice engine', description: 'Every keystroke updates a per-key mastery map. Practice sets are generated on the fly so weak keys and slow letter-pairs get extra repetitions, wrapped in real words rather than nonsense drills.' },
  { name: '60-second placement assessment', description: 'Reads speed, accuracy, rhythm, hesitation, backspace habits and per-key reflexes, then names your rank and draws your starting map.' },
  { name: '41-lesson curriculum', description: 'Nine regions grouped into five worlds, from the two home-row anchor keys through capitals, numbers, symbols, code, rhythm and endurance.' },
  { name: 'Fourteen training modes', description: 'Adaptive practice, weak-key workouts, speed sprints, Accuracy Lab, rhythm studio, zen, lights-out, code forge, dictation, numerals, recovery, endurance, real-world desk and copy desk.' },
  { name: 'Seven original typing games', description: 'Each game is built around one named skill and tells you which skill it trains — no typing glued onto an unrelated arcade game.' },
  { name: 'Racing with CPU rivals', description: 'Five difficulties plus adaptive, rivals with believable habits, a ghost of your own best run, and private rooms with join codes for friends or a classroom.' },
  { name: 'Deep analytics', description: 'Per-key heatmaps, finger and hand balance, rhythm fingerprints, session echo replay, consistency scoring, records and a practice calendar.' },
  { name: 'A coach that is specific', description: 'Kip reads your actual session data and names the exact keys and transitions holding you back, then prescribes a drill for them.' },
  { name: 'Layout-aware', description: 'QWERTY, QWERTZ, AZERTY, Dvorak and Colemak — the curriculum rebuilds itself around whichever layout you use.' },
  { name: 'Accessibility as a requirement', description: 'Full keyboard navigation, four text sizes, the Atkinson Hyperlegible typeface, a high-contrast theme, reduced-motion mode, untimed learning, spoken target letters and never colour-only feedback.' },
  { name: 'Local-first privacy', description: 'Nothing ever blocks on the network: keystrokes are written to your browser first and synced afterwards. One grown-up account covers the whole household, learners never sign in themselves, and everything can be erased in one click.' },
  { name: 'Twelve themes', description: 'Themes change illustration, keyboard, sound and celebration, and are unlocked by learning rather than by paying.' },
];

export const TRAINING_MODES: Feature[] = [
  { name: 'Adaptive practice', description: 'Sets built from your weak keys' },
  { name: 'Weak-key workout', description: 'Your worst key, repaired' },
  { name: 'Speed sprints', description: '15 seconds to 5 minutes' },
  { name: 'Accuracy Lab', description: 'Precision-first scoring' },
  { name: 'Rhythm studio', description: 'Type on the beat' },
  { name: 'Zen typing', description: 'No scores, just flow' },
  { name: 'Lights out', description: 'Wean off looking down' },
  { name: 'Code forge', description: 'Brackets and symbols' },
  { name: 'Dictation', description: 'Type what you hear' },
  { name: 'Numeral Peaks', description: 'Numbers and the symbol row' },
  { name: 'Recovery', description: 'Stay calm after misses' },
  { name: 'Endurance', description: 'Long-form stamina' },
  { name: 'Real-world desk', description: 'Emails and documents' },
  { name: 'Copy desk', description: 'Practise with your own text' },
];

export interface ModeCluster {
  name: string;
  /** One line naming what the whole cluster is for. */
  blurb: string;
  modes: Feature[];
}

/**
 * The same modes, grouped by the question they answer.
 *
 * Fourteen equal tiles is a list, not a design: it makes the reader compare
 * everything with everything. Four clusters make the choice a two-step one, and
 * mean neither this page nor the landing page has to quote a count that goes
 * stale the moment a fifteenth mode ships.
 */
export const MODE_CLUSTERS: ModeCluster[] = [
  {
    name: 'Build the map',
    blurb: 'For the days when you do not want to decide. These read your mastery map and choose for you.',
    modes: [
      { name: 'Adaptive practice', description: 'The default. Sets generated from your weakest keys and slowest letter transitions, wrapped in real words so a drill never reads as a drill.' },
      { name: 'Weak-key workout', description: 'One key, taken apart. Your single worst letter in every position it appears in, until it stops being the reason you slow down.' },
      { name: 'Numeral Peaks', description: 'The number row and the symbol row, the two stretches almost every self-taught typist skipped.' },
      { name: 'Code forge', description: 'Brackets, braces, operators and the punctuation shapes that only appear in code.' },
    ],
  },
  {
    name: 'Sharpen precision',
    blurb: 'Accuracy is the skill that makes speed possible. These train it directly rather than hoping it arrives.',
    modes: [
      { name: 'Accuracy Lab', description: 'Precision-first scoring, where a mistake costs far more than a slow keystroke. The fastest cure for a typist who has learned to race their own error rate.' },
      { name: 'Recovery', description: 'Passages seeded with awkward words on purpose, training the thing that actually loses runs: the three seconds of panic after a miss.' },
      { name: 'Lights out', description: 'The on-screen keyboard goes dark. The only way to know whether you are touch typing or reading your own hands.' },
      { name: 'Speed sprints', description: 'Fifteen seconds to five minutes, unlocked once your accuracy can carry it. Short, honest, and over before technique degrades.' },
    ],
  },
  {
    name: 'Find the rhythm',
    blurb: 'Even hands are faster than fast hands. These work on feel rather than on numbers.',
    modes: [
      { name: 'Rhythm studio', description: 'Type on the beat. Smoothing your inter-key intervals is usually worth more words per minute than any amount of pushing.' },
      { name: 'Zen typing', description: 'No timer, no score, no rank. Just text and the sound of it going right.' },
      { name: 'Dictation', description: 'Type what you hear, with replay and speed control. It breaks the habit of reading ahead and typing behind.' },
      { name: 'Endurance', description: 'Long-form passages, where the interesting question is not how fast you start but what is left of your technique in minute four.' },
    ],
  },
  {
    name: 'Type your real life',
    blurb: 'Practice that looks like the work. The point of all of this is the writing you do when nobody is scoring it.',
    modes: [
      { name: 'Real-world desk', description: 'Emails, messages, meeting notes and documents, complete with the addresses, dates and formatting that trip people up.' },
      { name: 'Copy desk', description: 'Paste in your own text and practise on that. Your essay, your code, your novel. It stays on your device.' },
    ],
  },
];

export const GAMES: GameEntry[] = [
  { name: 'Wordfall Defence', slug: 'wordfall', skill: 'Accuracy under pressure', description: 'Words drift toward your light-shield. Careless speed weakens it; calm accuracy saves the city. The game punishes exactly the habit that stalls most learners — racing ahead of your own accuracy.' },
  { name: 'Keyforge', slug: 'keyforge', skill: 'Fast, flawless words', description: 'The forge fire only burns while you type. Misses vent heat and treasures make it hungrier, so you have to hold speed and precision at the same time rather than trading one for the other.' },
  { name: 'Wordflight', slug: 'wordflight', skill: 'Rhythm and flow', description: 'A glider that climbs when your keystroke rhythm is even and wobbles when you rush. Threading the golden gates trains the steady inter-key timing that separates smooth typists from bursty ones.' },
  { name: 'Quill Duel', slug: 'duel', skill: 'Burst speed under pressure', description: 'A best-of-seven phrase duel against a rival matched to your pace, with their cursor visible as they type. Head-to-head pressure without strangers or chat.' },
  { name: 'Survivor Sprint', slug: 'survivor', skill: 'Consistency under pressure', description: 'Eight typists, four rapid heats, the slowest eliminated each round. Winning requires repeatable performance rather than one lucky fast run.' },
  { name: 'Cipher Run', slug: 'cipher', skill: 'Spelling recall and letter mapping', description: 'Unscramble rune-words against the clock. Decoding builds the deep letter-to-finger map that fast typing sits on top of.' },
  { name: 'Block Stack', slug: 'stack', skill: 'Word-perfect precision', description: 'Every word becomes a block: clean words build wide and steady, sloppy ones crumble the tower. It makes the cost of an uncorrected error visible.' },
];

export const AUDIENCES: Audience[] = [
  { name: 'Kids', description: 'Short quests, friendly words, big visual feedback and a glowing guardian companion — with rewards for care rather than for screen time, and safe generated names only.' },
  { name: 'Teens', description: 'Streaks, missions, ranked divisions and themes worth unlocking: practice that respects both your time and your aesthetic.' },
  { name: 'Adults', description: 'Ten focused minutes a day, workplace texts and email drills, a minimal focus mode, and analytics that treat you like a grown-up.' },
  { name: 'Competitive typists', description: 'Consistency scoring, rhythm training, ghost racing, endurance tests and per-transition timing data to find the last few WPM.' },
  { name: 'Schools', description: 'Classroom rooms, assignable lessons, printable progress and per-student accessibility profiles, with a teacher dashboard in preview.' },
  { name: 'Families', description: 'Up to four explorers under one grown-up account, a guardian summary view, and children who never need an email address or a sign-in of their own.' },
];

export const METHOD_STEPS: Step[] = [
  { name: 'Assess', text: 'A 60-second placement test reads your speed, accuracy, rhythm, hesitation, backspace habits and per-key reflexes, then names your rank and draws your starting map.' },
  { name: 'Adapt', text: 'Every keystroke updates your Mastery Map. Practice sets are generated on the fly: weak keys and slow letter-pairs get extra repetitions, wrapped in real words so drills never feel like drills.' },
  { name: 'Advance', text: 'Accuracy first, speed second, rhythm always. The coach holds you back from chasing speed too early, and tells you exactly why after every session.' },
];

export const ACCESSIBILITY: string[] = [
  'Full keyboard navigation',
  'Four text sizes',
  'Atkinson Hyperlegible font option',
  'High-contrast theme',
  'Reduced-motion mode',
  'Untimed learning',
  'Spoken target letters',
  'Dictation with replay and speed control',
  'Never colour-only feedback',
  'Hideable leaderboards',
];

// ── Curriculum ─────────────────────────────────────────────────────────────

export interface CurriculumWorld {
  name: string;
  tagline: string;
  targetWpm: string;
  targetAccuracy: string;
  regions: { region: string; skill: string; description: string }[];
}

export const CURRICULUM: CurriculumWorld[] = [
  {
    name: 'World 1 — First Steps',
    tagline: 'Posture, anchors and the home row',
    targetWpm: '8–14 WPM',
    targetAccuracy: '92% accuracy',
    regions: [
      { region: 'Base Camp', skill: 'Setup and anchors', description: 'Posture, hand position and your two anchor keys — the bump keys your index fingers can always find without looking.' },
      { region: 'The Heartlands', skill: 'Home row', description: 'The home row, where every journey starts and ends. Middle, ring and pinky fingers each learn their own key, then the index fingers stretch inward and return.' },
    ],
  },
  {
    name: 'World 2 — The High & Low Roads',
    tagline: 'Top and bottom rows, completing the alphabet',
    targetWpm: '14–20 WPM',
    targetAccuracy: '93% accuracy',
    regions: [
      { region: 'Skyreach Ridge', skill: 'Top row', description: 'Reaching up to the top row without losing your anchors — one hand reaches while the other rests, and every reach returns home.' },
      { region: 'Deeproot Vale', skill: 'Bottom row', description: 'Curling down to the bottom row with control. The hand stays level; only the finger dips. The rarest letters live here.' },
    ],
  },
  {
    name: 'World 3 — The Written Word',
    tagline: 'Capitals, punctuation and real sentences',
    targetWpm: '20–26 WPM',
    targetAccuracy: '94% accuracy',
    regions: [
      { region: 'The Twin Gates', skill: 'Capitals and basic punctuation', description: 'The opposite-hand Shift rule, full stops, commas, question marks, exclamations and apostrophes.' },
      { region: 'Punctuation Straits', skill: 'Punctuation', description: 'Colons, semicolons, quotation marks, brackets and dashes inside real prose.' },
    ],
  },
  {
    name: 'World 4 — Numbers & Glyphs',
    tagline: 'The number row, symbols and code',
    targetWpm: '26–32 WPM',
    targetAccuracy: '95% accuracy',
    regions: [
      { region: 'Numeral Peaks', skill: 'Numbers', description: 'The number row: long reaches and steady returns, then numbers woven into real text as dates, times and quantities.' },
      { region: 'The Glyph Foundry', skill: 'Symbols and code', description: 'Everyday symbols, arithmetic operators, and the square, curly and angle brackets that make up the shapes of code.' },
    ],
  },
  {
    name: 'World 5 — The Flow',
    tagline: 'Rhythm, endurance and real-world mastery',
    targetWpm: '30–42 WPM',
    targetAccuracy: '96% accuracy',
    regions: [
      { region: 'The Long Roads', skill: 'Flow and mastery', description: 'Paragraph flow, the confidence ladder, endurance passages, the rhythm river, the working desk, typing without looking down, a recovery road that plants tricky words on purpose, and a final gauntlet of everything at once.' },
    ],
  },
];

// ── Learn-to-type guide ────────────────────────────────────────────────────

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  /** Optional bullet list rendered after the paragraphs. */
  bullets?: string[];
}

export const LEARN_GUIDE_INTRO =
  'Touch typing is the ability to type without looking at your hands, using a fixed finger-to-key ' +
  'assignment so the movement becomes automatic. Almost everyone can learn it. What stops people is ' +
  'rarely talent — it is practising the wrong thing, chasing speed before the map is built, or ' +
  'quitting during the dip where typing properly is temporarily slower than the hunt-and-peck habit ' +
  'it replaces. This guide is the method KeyTopia teaches, written out in full.';

export const LEARN_GUIDE: GuideSection[] = [
  {
    heading: 'Step 1: Set up before you type anything',
    paragraphs: [
      'Sit so your forearms are roughly level with the keyboard and your wrists float rather than rest. Shoulders low, elbows loose at your sides. If your wrists are planted on the desk, your fingers have to stretch instead of the hand moving slightly — that is the source of most bottom-row misses.',
      'Find the two bump keys, the small ridges on F and J on a QWERTY keyboard. Those are your anchors. Your index fingers return to them after every reach, and they are what makes typing without looking possible: you never need to find the keyboard visually, only to feel two bumps.',
    ],
  },
  {
    heading: 'Step 2: Learn the home row before anything else',
    paragraphs: [
      'The home row is where all eight fingers rest, and every other key is described relative to it. Learning it first is not tradition for its own sake — it means every subsequent key can be learned as a movement from a known position rather than as an absolute location on a grid.',
      'Work through the home row one finger pair at a time: index fingers on the anchors, then the middle fingers, then the ring fingers, then the pinkies, then the inward stretch of the index fingers. Ring fingers are slower for everyone, including fast typists. That is anatomy, not a personal failing.',
    ],
  },
  {
    heading: 'Step 3: One finger owns each key, always',
    paragraphs: [
      'The single highest-value rule in touch typing is that each key belongs to exactly one finger, every time. Consistency is what lets the movement become automatic; using whichever finger is nearest keeps the task conscious forever, which is why self-taught fast typists usually plateau in the 50–70 WPM range.',
      'The same applies to Shift. Capitals use the Shift key on the opposite side from the letter — right-hand letter, left Shift, and back. Same-hand Shift forces the hand off its anchors and is one of the most common hidden sources of error in otherwise decent typists.',
    ],
  },
  {
    heading: 'Step 4: Accuracy before speed, without exception',
    paragraphs: [
      'Typing fast with errors is not a faster version of typing well — it is a different, worse skill, because every uncorrected error costs a backspace, a re-read and a break in rhythm. Measured end to end, a 95%-accurate typist at 45 WPM finishes real work ahead of an 85%-accurate typist at 60 WPM.',
      'The practical rule: hold accuracy above about 95% before you allow yourself to push pace. If accuracy drops, you are practising errors, and repetition makes them more automatic, not less. Slowing down by 10% until accuracy recovers is the fastest available route to being faster.',
    ],
  },
  {
    heading: 'Step 5: Practise rhythm, not bursts',
    paragraphs: [
      'Speed is mostly evenness. Two typists with the same average WPM can have very different experiences: one types at a steady pace, the other sprints through familiar words and stalls on the rest. The stalls are where the time actually goes, and they are invisible on a plain WPM score.',
      'This is why KeyTopia measures the interval between every pair of keystrokes and shows it as a rhythm fingerprint — a round ring means metronome-steady hands. Training the slow transitions specifically, rather than typing more in general, is what moves the average.',
    ],
  },
  {
    heading: 'Step 6: Short, daily, and specific',
    paragraphs: [
      'Fifteen focused minutes a day beats two hours on a Sunday, because the skill is motor learning and motor learning consolidates between sessions rather than during them. Frequency matters more than duration.',
      'Specific beats general. Typing random paragraphs improves the keys you were already good at, because those are the keys that appear most. Practice built from your own weakest keys and slowest transitions targets the part of the map that is actually holding the average down.',
    ],
  },
  {
    heading: 'How long does it take?',
    paragraphs: [
      'With about 15 minutes of daily practice, most adults can type the full alphabet without looking within two to three weeks, reach a usable 40 WPM in roughly four to eight weeks, and reach 60–70 WPM within a few months. Children typically take longer in calendar time but often end up with better technique, because they have no hunt-and-peck habit to unlearn.',
      'Expect a dip in week one. Typing properly is genuinely slower than your old habit at first, and this is the point where most people quit and go back. It lasts a few days. Pushing through it is the whole game.',
    ],
  },
  {
    heading: 'Why progress stalls, and what to do',
    paragraphs: [
      'Looking down at the keyboard is the most common cause. It feels like it helps and it prevents the map from ever forming. A lights-out or blind mode, where the keys are hidden, is uncomfortable for a session or two and then resolves it.',
      'A second cause is a small number of specific weak keys — very often the pinky-operated keys, Q, P, Z and the punctuation cluster — dragging an otherwise fine average down. Per-key data finds these in one session; more general practice can hide them for months.',
      'A third is chasing a WPM number on a test rather than training. A test measures; it does not teach. Use it as a thermometer, not as the practice itself.',
    ],
  },
];

// ── Kids and schools ───────────────────────────────────────────────────────

export const KIDS_POINTS: Feature[] = [
  { name: 'An island world, not a worksheet', description: 'Five islands — Meadow Isle, Treetop Isle, Lantern Harbor, Crystal Caverns and Cloud Castle — with one stop per lesson along a sea chart, so a child always knows where they are and what comes next.' },
  { name: 'A guardian companion', description: 'Each island has a pal who travels alongside the explorer, reacting to progress. It is a companion, not a competitor, and it never scolds.' },
  { name: 'Rewards for care, not for time', description: 'Stickers, quests and celebrations are earned by accurate, careful typing rather than by minutes spent on the screen. There are no streak-guilt mechanics aimed at children.' },
  { name: 'Gentle difficulty', description: 'Kid word lists and sentences, a lower speed target than the adult track, and untimed mode available everywhere so a child can learn without a clock.' },
  { name: 'Safe by construction', description: 'Children never sign in, never enter an email address and never pick a public name. There is no chat, no messaging and no public matchmaking. Racing rivals are computer-controlled, race rooms are private and join-code only, and explorer names come from a safe generated word list.' },
  { name: 'A graduation path', description: 'When a child outgrows the island world, there is an explicit path across to the full dashboard rather than an abrupt switch.' },
];

export const SCHOOLS_POINTS: Feature[] = [
  { name: 'No student accounts to provision', description: 'Students never create logins. A teacher signs in once, students join a class with a code, and the seat is bound to the device. There is no roster to import and no password reset queue.' },
  { name: 'Only the results a teacher needs', description: 'Raw keystroke timings stay in the browser on the machine the student uses. What reaches a class board is the finished result: lesson, score, accuracy. No text a child typed is uploaded and there is nothing for a stranger to see.' },
  { name: 'Multiple explorers per device', description: 'A shared classroom machine can hold several student profiles side by side, each with its own mastery map, settings and accessibility profile.' },
  { name: 'Private race rooms', description: 'Races use join codes and are limited to the people you share the code with. There is no public matchmaking and no chat.' },
  { name: 'Per-student accessibility profiles', description: 'Text size, the Atkinson Hyperlegible typeface, high contrast, reduced motion, untimed mode and spoken target letters are per-profile, so an accommodation follows the student rather than the device.' },
  { name: 'Progress you can actually read', description: 'A guardian and teacher summary built from real session data — per-key mastery, accuracy trends and practice frequency — rather than a participation score.' },
];

// ── FAQ ────────────────────────────────────────────────────────────────────

export const FAQS: Faq[] = [
  { question: 'Is KeyTopia free?', answer: 'Yes. Every lesson, mode, game, race and analytics view is free. There is no subscription, no paywalled tier and no advertising. Themes are unlocked by learning rather than by paying.' },
  { question: 'Do I need to create an account?', answer: 'Not to try it. The typing test and every guide are open to anyone. Saving progress needs one free account, created with an email link or a Google sign-in, because a mastery map that vanishes when you clear your browser is not worth building. One grown-up account holds up to four explorer profiles, and the learners themselves never sign in.' },
  { question: 'Where is my typing data stored?', answer: 'Every keystroke is written to your browser\'s local storage first, so practice never waits on a network call and keeps working offline. Finished results and your mastery map then sync to your account so they survive a lost device. The raw text you typed is not uploaded. You can erase everything, locally and in the account, from Settings → Data.' },
  { question: 'How long does it take to learn touch typing?', answer: 'With about 15 minutes of daily practice, most adults type the whole alphabet without looking within two to three weeks and reach a usable 40 WPM in roughly four to eight weeks. Reaching 60–70 WPM typically takes a few months. Children usually take longer in calendar time but often finish with cleaner technique.' },
  { question: 'What is a good typing speed?', answer: 'Around 40 WPM is a functional working speed and roughly the average for an adult who types regularly. 60–70 WPM is comfortably fast and enough that typing stops being the bottleneck in most work. Above 90 WPM is genuinely fast. Accuracy matters more than any of these numbers: 45 WPM at 98% accuracy beats 60 WPM at 85% for real work.' },
  { question: 'Does KeyTopia support Dvorak, Colemak, AZERTY or QWERTZ?', answer: 'Yes. The curriculum is layout-aware — it rebuilds the lesson order, the key groupings and the on-screen keyboard around QWERTY, QWERTZ, AZERTY, Dvorak or Colemak, so the lessons teach your actual layout rather than a translated QWERTY one.' },
  { question: 'Is it suitable for children?', answer: 'Yes. There is a dedicated kids world with an island map, quests, a guardian companion, gentler speed targets and kid-appropriate word lists. Children never create an account or give an email address: a parent or teacher signs in and the child gets a profile. There is no chat and no strangers, race rivals are computer-controlled, and rooms are join-code only.' },
  { question: 'Can it be used in a classroom?', answer: 'Yes. Assignable lessons, private race rooms with join codes, multiple student profiles per shared device and per-student accessibility profiles are all supported. Students join with a class code rather than an email address, and only finished results reach the class board. The teacher dashboard is currently a preview.' },
  { question: 'Is there a typing test I can take without signing up?', answer: 'Yes — the free typing test runs in the browser at 15, 30, 60 or 120 seconds and reports WPM, raw WPM, accuracy, consistency and a per-key breakdown. No sign-up, and the result stays on your device.' },
  { question: 'What accessibility support does KeyTopia have?', answer: 'Full keyboard navigation, four text sizes, the Atkinson Hyperlegible typeface, a high-contrast theme, reduced-motion mode, untimed learning, spoken target letters, dictation with replay and speed control, feedback that is never colour-only, and hideable leaderboards. These are per-profile settings.' },
  { question: 'Does it work offline?', answer: 'Yes. Once loaded, every lesson, game and analytics view runs from local storage, so practice continues if the connection drops and syncs up quietly when it returns. Only the initial sign-in needs a connection. It is installable as a progressive web app on desktop and mobile.' },
  { question: 'How is WPM calculated?', answer: 'The standard way: correctly typed characters divided by five (the conventional word length), scaled to one minute. Raw WPM applies the same formula to every keystroke including errors, so the gap between raw and net WPM is a direct measure of how much speed your mistakes are costing you.' },
];

// ── Glossary ───────────────────────────────────────────────────────────────

export const GLOSSARY: GlossaryTerm[] = [
  { term: 'Touch typing', slug: 'touch-typing', definition: 'Typing without looking at your hands, using a fixed assignment of fingers to keys so the movement becomes automatic. The defining feature is not speed but that the keyboard is located by feel — via the home-row anchor keys — rather than by sight.' },
  { term: 'WPM (words per minute)', slug: 'wpm', definition: 'The standard measure of typing speed: correctly typed characters divided by five, scaled to one minute. Five characters is the conventional definition of a "word", so WPM is comparable across languages and texts of different word lengths.' },
  { term: 'Raw WPM', slug: 'raw-wpm', definition: 'The same calculation as WPM but counting every keystroke, including incorrect ones. The gap between raw and net WPM quantifies exactly how much speed your errors are costing.' },
  { term: 'CPM (characters per minute)', slug: 'cpm', definition: 'Typing speed expressed in characters rather than five-character words. CPM is simply WPM multiplied by five, and is more common outside English-language typing tools.' },
  { term: 'Accuracy', slug: 'accuracy', definition: 'The percentage of keystrokes that were correct on the first attempt. Because every error costs a backspace, a re-read and a break in rhythm, accuracy affects real-world throughput more than headline speed does.' },
  { term: 'Consistency', slug: 'consistency', definition: 'How even your typing pace is, derived from the variation in the interval between successive keystrokes. High consistency means a steady rhythm; low consistency means bursts of familiar words separated by stalls, which is where most lost time actually hides.' },
  { term: 'Inter-key interval (IKI)', slug: 'inter-key-interval', definition: 'The time in milliseconds between one keystroke and the next. The distribution of inter-key intervals across a session is the raw material for consistency scoring, rhythm fingerprints and hesitation detection.' },
  { term: 'Hesitation', slug: 'hesitation', definition: 'A keystroke interval far longer than your own typical pace — the moment where you stopped to think or search for a key. Hesitations are more diagnostic than errors, because they show which keys are not yet automatic.' },
  { term: 'Home row', slug: 'home-row', definition: 'The middle row of letter keys where all eight fingers rest between reaches. On QWERTY it is A S D F and J K L semicolon. Every other key in touch typing is learned as a movement relative to this row.' },
  { term: 'Anchor keys', slug: 'anchor-keys', definition: 'The two keys carrying small tactile bumps — F and J on QWERTY — that the index fingers use to locate the keyboard by feel. They are what makes typing without looking possible.' },
  { term: 'Bigram', slug: 'bigram', definition: 'A pair of consecutive letters, such as "th" or "er". Bigram timings reveal which transitions between specific keys are slow, which is usually more actionable than knowing which individual keys are slow.' },
  { term: 'Rollover', slug: 'rollover', definition: 'Pressing the next key before fully releasing the previous one. Overlapping keystrokes this way is a hallmark of fluent typing, and keyboards are rated by how many simultaneous keys they can register correctly.' },
  { term: 'Burst speed', slug: 'burst-speed', definition: 'Your peak speed over a short window — often a familiar word or common bigram — as opposed to your sustained average. A large gap between burst and average speed indicates that specific keys or transitions, not general ability, are the limiting factor.' },
  { term: 'Key mastery', slug: 'key-mastery', definition: 'A per-key state describing how reliable a key is for you, based on its error rate and typical timing. In KeyTopia keys move through learning, improving, reliable and mastered states, and fall back to needs-review when performance degrades.' },
  { term: 'Adaptive practice', slug: 'adaptive-practice', definition: 'Practice text generated from your own performance data rather than a fixed script, so that weak keys and slow transitions receive more repetitions than keys you already own.' },
  { term: 'Placement test', slug: 'placement-test', definition: 'A short assessment taken before training that measures current speed, accuracy, rhythm and per-key reliability in order to choose a realistic starting point in the curriculum.' },
  { term: 'Ghost run', slug: 'ghost-run', definition: 'A replay of one of your own previous sessions raced alongside your current attempt, so improvement is visible in real time against your former self rather than against a stranger.' },
  { term: 'Keyboard layout', slug: 'keyboard-layout', definition: 'The mapping of physical keys to characters. QWERTY, QWERTZ and AZERTY are regional variants; Dvorak and Colemak are alternative layouts designed to reduce finger travel. Touch-typing instruction must match the layout you actually use.' },
];

// ── Legal ──────────────────────────────────────────────────────────────────

/**
 * The contact address printed on the legal pages and used for data requests.
 * Change it here and every page, JSON-LD node and llms.txt entry follows.
 */
export const LEGAL_CONTACT = 'contact@keytopia.app';

/** Last substantive revision of the privacy policy and terms. */
export const LEGAL_EFFECTIVE = '15 August 2026';

/**
 * The sub-processors KeyTopia sends data to. Listed on the privacy page rather
 * than hidden behind a request, because a school or a parent should be able to
 * see the whole chain on one screen.
 */
export const SUBPROCESSORS: { name: string; role: string; data: string }[] = [
  { name: 'Supabase', role: 'Database, authentication and file storage', data: 'Account email address, profile records, lesson and session results, class membership. Hosted in the region shown on the account page.' },
  { name: 'Vercel', role: 'Website hosting and content delivery', data: 'Standard web-server request data: IP address, user agent, requested URL, timestamp.' },
  { name: 'Resend', role: 'Transactional email delivery', data: 'Account email address, and delivery metadata for sign-in links.' },
  { name: 'Google', role: 'Optional sign-in provider', data: 'Only if you choose to sign in with Google: your email address and account identifier. KeyTopia requests nothing else from your Google account.' },
];

export const PRIVACY_SECTIONS: GuideSection[] = [
  {
    heading: 'The short version',
    paragraphs: [
      'KeyTopia is free, carries no advertising, and sells nothing to anyone. There are no tracking pixels, no advertising networks and no analytics products following you between sites.',
      'Every keystroke you make is written to your own browser first, so practice never waits on a network call and keeps working offline. What syncs to our servers is the outcome of a session, not the text you typed. Signing in is what makes a mastery map survive a lost laptop, and it is the only reason we hold an email address at all.',
    ],
    bullets: [
      'Reading this site, taking the typing test and browsing the guides needs no account and no cookie banner.',
      'Saving progress needs one free account, held by a grown-up. Learners get profiles, not logins.',
      'We never collect a child\'s email address, real name, photograph, location or contact details.',
      'You can export or delete everything at any time, from inside the app or by emailing us.',
    ],
  },
  {
    heading: 'Who is responsible for your data',
    paragraphs: [
      `KeyTopia is an independent project. For the purposes of the UK and EU General Data Protection Regulation, the operator of keytopia.app is the data controller for the information described on this page. You can reach a human at ${LEGAL_CONTACT}, and we aim to answer every privacy question within thirty days.`,
      'Where a school deploys KeyTopia to a class, the school is the controller for its pupils\' records and KeyTopia acts as a processor on the school\'s instructions.',
    ],
  },
  {
    heading: 'What we collect, and why',
    paragraphs: [
      'We have tried to keep this list short enough that you can actually read it.',
    ],
    bullets: [
      'Account details. An email address, and a Google account identifier if you sign in that way. We need it to prove the account is yours and to send sign-in links. There is no password, so there is no password for anyone to steal.',
      'Explorer profiles. The display name, avatar, age band and accessibility settings you choose for each learner. Names for children are generated from a safe word list by default.',
      'Learning records. Finished lesson and session results: which lesson, when, words per minute, accuracy, consistency, and a per-key mastery summary. This is what draws your map and what makes the adaptive engine adaptive.',
      'Classroom records. If you join a class with a code, the class you belong to and the results you post to its board.',
      'Technical logs. Our host records the ordinary web-server details of a request: IP address, browser user agent, URL and timestamp. These are used to keep the service up and to spot abuse, and are not joined to your learning records.',
    ],
  },
  {
    heading: 'What we never collect',
    paragraphs: [
      'Some of what a typing tutor could technically capture, we deliberately do not.',
    ],
    bullets: [
      'The raw text of what you typed. Individual keystrokes and their timings stay in your browser. Only the aggregate statistics leave it.',
      'Anything you type in the Copy desk mode. Text you paste in to practise with is yours, stays local, and is never uploaded.',
      'Payment details, because there is nothing to buy.',
      'Precise location, contact lists, microphone or camera access.',
      'Advertising identifiers, cross-site trackers and third-party analytics.',
    ],
  },
  {
    heading: 'Legal bases for processing',
    paragraphs: [
      'Under UK and EU data protection law we rely on two bases. Performing our contract with you covers your account, your profiles and your learning records, because without them the product cannot do the one thing it promises. Our legitimate interest in running a secure, working service covers server logs and abuse prevention.',
      'We do not process your data for marketing, and we do not rely on consent for anything, which is why there is no cookie banner to dismiss.',
    ],
  },
  {
    heading: 'Cookies and browser storage',
    paragraphs: [
      'KeyTopia sets no advertising or analytics cookies. It uses your browser\'s local storage to hold your profiles, settings and practice history so the app can start instantly and work offline, and it stores a session token so you are not asked to sign in on every visit. Both are strictly necessary for the service to function.',
      'Clearing your browser data for this site removes the local copy. If you are signed in, your synced records remain in your account and return when you sign in again.',
    ],
  },
  {
    heading: 'Who else touches your data',
    paragraphs: [
      'KeyTopia uses a small number of service providers, listed in full below. Each is bound by a data processing agreement, none is permitted to use your data for its own purposes, and we do not sell or share personal data with anyone else. We have never received a government request for user data. If that changes and we are permitted to say so, we will.',
    ],
    bullets: SUBPROCESSORS.map((s) => `${s.name}, ${s.role.toLowerCase()}. ${s.data}`),
  },
  {
    heading: 'Where your data is held',
    paragraphs: [
      'Data is stored in the region shown on your account page. Some of our providers operate in the United States, so your information may be transferred outside the UK and the European Economic Area. Where that happens, the transfer is covered by the UK International Data Transfer Addendum or the European Commission\'s Standard Contractual Clauses.',
    ],
  },
  {
    heading: 'How long we keep it',
    paragraphs: [
      'Your account and its learning records are kept for as long as the account exists, because their whole purpose is to show progress over years rather than weeks. Delete a profile and its records go with it. Delete your account and everything is removed from live systems immediately and from backups within thirty days.',
      'Server logs are kept for a short operational window, typically thirty days, then discarded.',
    ],
  },
  {
    heading: 'Children',
    paragraphs: [
      'KeyTopia is built to be used by children, and the design assumption is that a child should never have to hand over anything about themselves to learn to type.',
      'A child never creates an account, never enters an email address and never chooses a public name. A parent, guardian or teacher signs in, and the child gets a profile under that account. There is no chat, no messaging, no friend requests and no public leaderboard, so there is no route by which a stranger can contact a child through KeyTopia. Racing opponents are computer-controlled.',
      'Because we knowingly collect no personal information from a child, there is nothing for a child to be identified by. If you believe a child has entered personal information anyway, for example by typing a real name into a profile field, email us and we will remove it.',
    ],
  },
  {
    heading: 'Schools',
    paragraphs: [
      'A teacher signs in with a school email address and creates a class. Pupils join with a code, and the seat is bound to the device rather than to an identity, so no pupil email addresses are required or wanted.',
      'What reaches a class board is the finished result of an exercise: which lesson, the score, the accuracy. The text a pupil typed is not uploaded. Schools acting as controllers can request a data processing agreement, a copy of a pupil\'s records or their deletion at the address below.',
    ],
  },
  {
    heading: 'Your rights',
    paragraphs: [
      'Wherever you live, you can ask us to show you what we hold, correct it, delete it, hand it over in a portable format, or restrict what we do with it. Most of this is a button inside the app rather than a request you have to make: Settings, then Data.',
      'If you are in the UK or the EEA you also have the right to object to processing and the right to complain to your data protection authority, which in the UK is the Information Commissioner\'s Office. If you are in California, you have the right to know, delete and correct, and the right not to be discriminated against for exercising them. We do not sell or share personal information as those terms are defined by the CCPA, and we have no financial incentives to disclose.',
      `To exercise any of these, email ${LEGAL_CONTACT} from the address on the account.`,
    ],
  },
  {
    heading: 'Security',
    paragraphs: [
      'Traffic is encrypted in transit with TLS and data is encrypted at rest. Accounts are protected by one-time sign-in links or your Google account rather than by a password we store. Access to a record is enforced at the database with row-level security, so one account cannot read another\'s data even if the application layer is wrong.',
      'No system is perfect. If we ever suffer a breach affecting your personal data, we will notify affected users and the relevant regulator without undue delay, and within seventy-two hours where the law requires it.',
    ],
  },
  {
    heading: 'Deleting everything',
    paragraphs: [
      'Settings, then Data, removes profiles and history from the device and from your account. Deleting the account itself removes the email address, every profile under it and all of their records.',
      'Clearing your browser\'s site data removes only the local copy. If you want it gone from our side too, delete the account first.',
    ],
  },
  {
    heading: 'Changes to this policy',
    paragraphs: [
      `This policy was last revised on ${LEGAL_EFFECTIVE}. If we change it in a way that materially affects how your data is handled, we will say so in the app before the change takes effect rather than quietly editing this page.`,
    ],
  },
  {
    heading: 'Contact',
    paragraphs: [
      `Questions, requests and complaints: ${LEGAL_CONTACT}. A real person reads it.`,
    ],
  },
];

export const TERMS_SECTIONS: GuideSection[] = [
  {
    heading: 'The short version',
    paragraphs: [
      'KeyTopia is free to use for learning to type, at home, in a family or in a classroom. Be decent, do not try to break it, and understand that a free learning tool comes with no guarantees. The rest of this page is the same thing said carefully.',
      `These terms take effect when you first use KeyTopia and were last revised on ${LEGAL_EFFECTIVE}.`,
    ],
  },
  {
    heading: 'Who may use KeyTopia',
    paragraphs: [
      'Anyone may read this site and take the typing test. To hold an account you must be at least sixteen, or the age of digital consent where you live if that is lower, or a teacher acting for a school.',
      'Children use KeyTopia through a profile created by a parent, guardian or teacher, who is responsible for that profile and accepts these terms on the child\'s behalf. Children do not hold accounts of their own.',
    ],
  },
  {
    heading: 'Accounts and profiles',
    paragraphs: [
      'An account is identified by an email address and secured with a one-time sign-in link or a Google sign-in. Keep access to that mailbox: anyone who can read it can reach the account. Tell us promptly if you think someone else has.',
      'One account may hold up to four explorer profiles. Profiles are for real learners rather than for resale or for sharing with the public, and we may limit or remove accounts used to circumvent that.',
    ],
  },
  {
    heading: 'Acceptable use',
    paragraphs: [
      'You agree not to do any of the following.',
    ],
    bullets: [
      'Break, overload, probe or attempt to gain unauthorised access to KeyTopia, its infrastructure or another user\'s account.',
      'Scrape, mirror or resell the service, its lesson content or its data.',
      'Use automation, scripts or hardware to fake typing results, or otherwise manipulate scores, races, class boards or leaderboards.',
      'Enter another person\'s personal information into a profile, or use a profile name that is offensive, impersonating, or identifying of a child.',
      'Use KeyTopia to harass anyone, or in any way that breaks the law where you are.',
    ],
  },
  {
    heading: 'Your content',
    paragraphs: [
      'Text you paste into the Copy desk to practise with, and the names you choose for profiles, remain yours. You grant us only the narrow permission needed to run the service for you: to store your records and display them back to you and, in a classroom, to the teacher whose class you joined.',
      'You are responsible for having the right to use any text you bring in, and for not putting anything sensitive into a practice field.',
    ],
  },
  {
    heading: 'Our content',
    paragraphs: [
      'The KeyTopia name, logo, world, artwork, lesson structure, written passages, game designs and software are original work and remain the property of their author. You may use them inside the product freely, including in a classroom.',
      'You may not copy the lesson content, artwork or code into another product, redistribute them as your own, or use the KeyTopia name or brand in a way that suggests we endorse you. Quoting a page with a link back is fine and welcome.',
    ],
  },
  {
    heading: 'Free service, and what that means',
    paragraphs: [
      'KeyTopia is provided at no charge. There is no subscription, no paid tier and no advertising, which also means there is no service level agreement, no support contract and no uptime commitment.',
      'We may change, suspend or withdraw features at any time. If we ever discontinue the service altogether we will give reasonable notice and a way to export your records first.',
    ],
  },
  {
    heading: 'Classrooms',
    paragraphs: [
      'A teacher creating a class confirms that they are authorised by their school to do so and that the school has whatever parental permissions local law requires. The school remains responsible for its pupils\' records; see the privacy policy for how that works in data protection terms.',
    ],
  },
  {
    heading: 'Measurements are indicative',
    paragraphs: [
      'Words per minute, accuracy, consistency, rank and mastery figures are produced by our own calculations for the purpose of teaching. They are useful for tracking your own progress over time. They are not a certified assessment, and should not be relied on for employment screening, examinations or any other consequential decision.',
    ],
  },
  {
    heading: 'No warranty',
    paragraphs: [
      'KeyTopia is provided as is and as available, without warranties of any kind, whether express or implied, including any implied warranty of merchantability, fitness for a particular purpose or non-infringement. We do not warrant that the service will be uninterrupted, error free, or that data will never be lost.',
    ],
  },
  {
    heading: 'Limitation of liability',
    paragraphs: [
      'To the fullest extent permitted by law, we are not liable for indirect, incidental, special or consequential losses, nor for lost data, lost profits or lost opportunity arising from your use of KeyTopia. Where liability cannot be excluded, it is limited to one hundred pounds sterling.',
      'Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot lawfully be excluded. If you are a consumer, you keep every right your local consumer law gives you, and nothing here takes those away.',
    ],
  },
  {
    heading: 'Ending your use',
    paragraphs: [
      'You may stop using KeyTopia and delete your account at any time from Settings, then Data. We may suspend or terminate an account that breaks these terms, that is used to attack the service, or where we are required to by law. Where it is reasonable to do so, we will tell you why.',
    ],
  },
  {
    heading: 'Governing law',
    paragraphs: [
      'These terms are governed by the law of the country in which the operator of KeyTopia is established, and disputes are subject to the non-exclusive jurisdiction of its courts. If you are a consumer, this does not deprive you of the protection of the mandatory law of the country where you live, and you may bring a claim in your own local courts.',
    ],
  },
  {
    heading: 'Changes to these terms',
    paragraphs: [
      'We may update these terms as the product changes. Material changes will be announced in the app before they take effect, and the revision date at the top of this page always reflects the current version. Continuing to use KeyTopia after a change means you accept the updated terms.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: [
      `Questions about these terms: ${LEGAL_CONTACT}.`,
    ],
  },
];
