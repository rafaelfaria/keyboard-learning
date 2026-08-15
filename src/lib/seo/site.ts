/**
 * Site-wide SEO constants and the public page registry.
 *
 * Everything that needs an absolute URL — canonicals, sitemap entries, OG
 * images, JSON-LD `@id`s, llms.txt links — resolves through here, so the
 * production origin is a single env var (`VITE_SITE_URL`).
 *
 * This module is imported by both the browser bundle and the Node prerender /
 * generator scripts, so it must stay free of browser globals.
 */

/** `import.meta.env` in the browser bundle, `process.env` under Node scripts. */
const env = {
  ...((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}),
  ...((import.meta as unknown as { env?: Record<string, string> }).env ?? {}),
};

const RAW_SITE_URL = env.VITE_SITE_URL || 'https://keytopia.app';

/** Canonical origin, never with a trailing slash. */
export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, '');

export const SITE_NAME = 'KeyTopia';
export const SITE_TAGLINE = 'every keyboard is a world';
export const SITE_TITLE = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const SITE_LOCALE = 'en';
export const SITE_OG_LOCALE = 'en_US';
export const SITE_THEME_COLOR = '#0b1020';

export const SITE_DESCRIPTION =
  'KeyTopia is a free typing tutor that teaches touch typing properly: a 60-second placement test, ' +
  'adaptive lessons built from your own weak keys, seven original typing games, races and deep ' +
  'analytics: for kids, teens, adults, schools and competitive typists.';

/** Default social preview image (1200×630). */
export const SITE_OG_IMAGE = '/og.png';

/** Publisher logo used on Organization / Article-type schema nodes. */
export const SITE_LOGO = '/icon-512.png';

/** Resolve a path (or pass an absolute URL through) to an absolute URL. */
export function absUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export type ChangeFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface PublicPage {
  /** Route path — also the sitemap URL and the prerender output directory. */
  path: string;
  /** `<title>`. Brand suffix is appended automatically except on the home page. */
  title: string;
  /** `<meta name="description">` — also the sitemap-adjacent summary in llms.txt. */
  description: string;
  /** Short label used in breadcrumbs, nav and llms.txt link text. */
  label: string;
  /** One line describing the page for llms.txt. */
  llmsNote: string;
  priority: number;
  changeFrequency: ChangeFreq;
  /** ISO date of the last meaningful content change. */
  lastModified: string;
  /** Per-page social image; falls back to SITE_OG_IMAGE. */
  image?: string;
  /** llms.txt grouping. */
  group: 'Core' | 'Product' | 'Learn' | 'Tools' | 'Audiences' | 'Reference' | 'Legal';
}

const TODAY = '2026-08-12';

/**
 * Every crawlable route. This single list drives the sitemap, robots allow
 * rules, llms.txt, the prerenderer, the OG-image generator and the public
 * footer nav — add a page here and all of them pick it up.
 */
export const PUBLIC_PAGES: PublicPage[] = [
  {
    path: '/',
    label: 'Home',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    llmsNote: 'Product overview: the adaptive engine, training modes, games, races, analytics and who KeyTopia is for.',
    priority: 1.0,
    changeFrequency: 'weekly',
    lastModified: TODAY,
    group: 'Core',
  },
  {
    path: '/typing-test',
    label: 'Typing test',
    title: 'Free Typing Test: measure WPM, accuracy, rhythm and per-key speed',
    description:
      'Take a free typing test in your browser: 15, 30, 60 or 120 seconds. Get your WPM, raw speed, ' +
      'accuracy, consistency and a per-key breakdown. No sign-up, no download, results stay on your device.',
    llmsNote: 'Free in-browser typing speed test (15s–120s) reporting WPM, raw WPM, accuracy, consistency and per-key timing.',
    priority: 0.9,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Tools',
  },
  {
    path: '/learn-to-type',
    label: 'Learn to type',
    title: 'How to Learn Touch Typing: a complete, honest guide',
    description:
      'A step-by-step guide to learning touch typing: home-row anchors, correct finger assignment, ' +
      'why accuracy must come before speed, how long it really takes, and the plateaus everyone hits.',
    llmsNote: 'Pillar guide to learning touch typing. Posture, home row, finger assignment, accuracy-before-speed, realistic timelines and plateau fixes.',
    priority: 0.9,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Learn',
  },
  {
    path: '/curriculum',
    label: 'Curriculum',
    title: 'The KeyTopia Curriculum: 9 regions, 5 worlds, 41 typing lessons',
    description:
      'Every lesson in KeyTopia, in order: from the two home-row anchor keys to symbols, code, rhythm ' +
      'and endurance. Layout-aware for QWERTY, QWERTZ, AZERTY, Dvorak and Colemak.',
    llmsNote: 'The full lesson-by-lesson curriculum, grouped into five worlds and nine regions, with the skill each stage builds.',
    priority: 0.8,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Learn',
  },
  {
    path: '/typing-games',
    label: 'Typing games',
    title: 'Typing Games That Actually Train You',
    description:
      'Wordfall Defence, Keyforge, Wordflight, Quill Duel, Survivor Sprint, Cipher Run and Block Stack. ' +
      'each typing game is built around one named skill, and tells you which one it is training.',
    llmsNote: 'The seven original typing games and the specific skill each one trains.',
    priority: 0.8,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Learn',
  },
  {
    path: '/adaptive-practice',
    label: 'Adaptive practice',
    title: 'Adaptive Typing Practice: lessons built from your own weak keys',
    description:
      'How the KeyTopia engine works: a per-key mastery map updated on every keystroke, practice sets ' +
      'generated from your slowest keys and letter transitions, and a coach that names the exact fix.',
    llmsNote: 'The adaptive practice engine: the per-key mastery map, how practice sets are generated from weak keys and slow bigrams, and how the coach reports.',
    priority: 0.9,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Product',
  },
  {
    path: '/typing-practice-modes',
    label: 'Practice modes',
    title: 'Typing Practice Modes: every session names the skill it builds',
    description:
      'Speed sprints, Accuracy Lab, rhythm studio, lights out, code forge, dictation, endurance, zen and ' +
      'more. Every KeyTopia practice mode names the skill it builds, so practice always has a point.',
    llmsNote: 'The training modes, grouped into foundations, precision, feel and real-world work, with the skill each one builds.',
    priority: 0.8,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Product',
  },
  {
    path: '/typing-races',
    label: 'Typing races',
    title: 'Typing Races: rivals with real habits, ghosts of your best runs',
    description:
      'Race CPU rivals across five difficulties plus adaptive, chase the ghost of your own best run, or ' +
      'open a private room with a join code for friends or a classroom. No strangers, no chat, ever.',
    llmsNote: 'The racing system: CPU rival difficulties and habits, ghost racing against your own records, and private join-code rooms.',
    priority: 0.8,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Product',
  },
  {
    path: '/typing-analytics',
    label: 'Typing analytics',
    title: 'Typing Analytics: per-key heatmaps, rhythm fingerprints and session replay',
    description:
      'See exactly what is holding your typing back: per-key mastery heatmaps, finger and hand balance, ' +
      'rhythm fingerprints, consistency scoring and a keystroke-level replay of any session.',
    llmsNote: 'The analytics surface: per-key heatmaps, finger balance, rhythm fingerprint, consistency, session echo replay, records and the practice calendar.',
    priority: 0.8,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Product',
  },
  {
    path: '/typing-for-kids',
    label: 'For kids',
    title: 'Typing for Kids: an island world that rewards care, not screen time',
    description:
      'A typing game world for children: short quests, friendly words, a guardian companion, big visual ' +
      'feedback and safe generated names. Children never sign in, never give an email address, and never meet a stranger.',
    llmsNote: 'The kids experience: island map, quests, stickers, guardian companion, and the safety and privacy model for children.',
    priority: 0.8,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Audiences',
  },
  {
    path: '/typing-for-schools',
    label: 'For schools',
    title: 'Typing for Schools: classroom typing practice without accounts',
    description:
      'Assignable lessons, classroom race rooms with join codes, per-student accessibility profiles and ' +
      'printable progress. Pupils join with a class code instead of an email address, and only finished results leave the device.',
    llmsNote: 'The schools and classroom use case. Assignable lessons, private race rooms, accessibility profiles, teacher dashboard and the data model.',
    priority: 0.8,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Audiences',
  },
  {
    path: '/faq',
    label: 'FAQ',
    title: 'Frequently Asked Questions',
    description:
      'Is KeyTopia free? Does it work for left-handed typists, Dvorak or AZERTY? How long does learning ' +
      'to touch type take? Where is my data stored? Answers to the questions people actually ask.',
    llmsNote: 'Frequently asked questions about pricing, layouts, ages, data storage, accessibility and how progress is measured.',
    priority: 0.7,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Reference',
  },
  {
    path: '/typing-glossary',
    label: 'Glossary',
    title: 'Typing Glossary: WPM, CPM, raw speed, IKI, home row and more',
    description:
      'Plain-English definitions of the terms typing tools throw at you: WPM, raw WPM, CPM, accuracy, ' +
      'consistency, inter-key interval, rollover, touch typing, home row, bigrams and burst speed.',
    llmsNote: 'Definitions of typing terminology. WPM, raw WPM, CPM, accuracy, consistency, IKI, bigram, home row, touch typing, rollover, burst speed.',
    priority: 0.7,
    changeFrequency: 'monthly',
    lastModified: TODAY,
    group: 'Reference',
  },
  {
    path: '/privacy',
    label: 'Privacy',
    title: 'Privacy Policy',
    description:
      'What KeyTopia collects, what it deliberately never collects, who processes it, how children and ' +
      'classrooms are handled, and how to export or erase everything in one click.',
    llmsNote: 'Privacy policy: data collected, sub-processors, legal bases, retention, children and schools, and your rights.',
    priority: 0.3,
    changeFrequency: 'yearly',
    lastModified: TODAY,
    group: 'Legal',
  },
  {
    path: '/terms',
    label: 'Terms',
    title: 'Terms of Use',
    description: 'The terms under which KeyTopia is provided: who may use it, acceptable use, content and intellectual property, warranties, liability and how to end your use.',
    llmsNote: 'Terms of use: eligibility, accounts and profiles, acceptable use, content ownership, disclaimers and liability.',
    priority: 0.3,
    changeFrequency: 'yearly',
    lastModified: TODAY,
    group: 'Legal',
  },
];

export function pageByPath(path: string): PublicPage | undefined {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return PUBLIC_PAGES.find((p) => p.path === clean);
}

/** Routes that must never be indexed — the app itself is private, per-device state. */
export const PRIVATE_PATHS = ['/app/', '/onboarding', '/who', '/auth/'];

/**
 * The social preview image for a page. scripts/gen-og.mjs stamps each page's
 * own title onto the brand card and writes it to this path, so a share of
 * /faq does not look identical to a share of /typing-test in a feed.
 */
export function ogImage(page: PublicPage): string {
  if (page.image) return page.image;
  const slug = page.path === '/' ? 'home' : page.path.replace(/^\//, '').replace(/\//g, '-');
  return `/og/${slug}.png`;
}

/** Full `<title>`: brand-suffixed everywhere except the home page. */
export function pageTitle(page: Pick<PublicPage, 'path' | 'title'>): string {
  return page.path === '/' ? page.title : `${page.title} | ${SITE_NAME}`;
}
