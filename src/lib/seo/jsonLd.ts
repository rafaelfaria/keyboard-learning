/**
 * Shared JSON-LD (schema.org) builders for public pages.
 *
 * Centralises structured-data construction so every page emits consistent,
 * valid nodes with stable `@id`s that reference each other — the Organization
 * and WebSite nodes are declared once on the home page and referenced by `@id`
 * everywhere else, which is what lets a crawler treat the whole site as one
 * entity rather than a pile of unrelated pages.
 *
 * All URLs resolve through `absUrl` against `VITE_SITE_URL`, the same origin
 * used by the sitemap, robots.txt and llms.txt generators.
 */

import {
  SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_LOGO, SITE_OG_IMAGE, absUrl, ogImage,
  type PublicPage, pageTitle,
} from './site';
import {
  CORE_FEATURES, FAQS, GAMES, GLOSSARY, PRODUCT_PRICE, PRODUCT_SUMMARY,
  CURRICULUM, LEARN_GUIDE, METHOD_STEPS,
  type Faq, type GlossaryTerm,
} from './content';

export type JsonLd = Record<string, unknown>;

/** Stable node identities, so nodes can cross-reference instead of duplicating. */
export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;
export const APP_ID = `${SITE_URL}/#webapp`;

export function organizationNode(): JsonLd {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    logo: {
      '@type': 'ImageObject',
      url: absUrl(SITE_LOGO),
      width: 512,
      height: 512,
    },
  };
}

export function websiteNode(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
  };
}

/**
 * The product itself. `WebApplication` (a subtype of SoftwareApplication) is
 * the honest type: KeyTopia is a browser app, not a downloadable one.
 */
export function webApplicationNode(): JsonLd {
  return {
    '@type': 'WebApplication',
    '@id': APP_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: PRODUCT_SUMMARY,
    applicationCategory: 'EducationalApplication',
    applicationSubCategory: 'Typing Tutor',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript. Works in any modern browser.',
    inLanguage: 'en',
    isAccessibleForFree: true,
    publisher: { '@id': ORG_ID },
    image: absUrl(SITE_OG_IMAGE),
    offers: {
      '@type': 'Offer',
      price: PRODUCT_PRICE.price,
      priceCurrency: PRODUCT_PRICE.currency,
      availability: 'https://schema.org/InStock',
    },
    featureList: CORE_FEATURES.map((f) => f.name),
    // Accessibility metadata (schema.org a11y vocabulary) — genuinely supported.
    accessibilityFeature: [
      'highContrastDisplay',
      'largePrint',
      'readingOrder',
      'alternativeText',
      'displayTransformability',
      'audioDescription',
      'structuralNavigation',
    ],
    accessibilityHazard: ['noFlashingHazard', 'noSoundHazard', 'noMotionSimulationHazard'],
    accessibilityControl: ['fullKeyboardControl', 'fullMouseControl', 'fullTouchControl'],
    accessMode: ['textual', 'visual'],
  };
}

/** BreadcrumbList from ordered {name, path} items. */
export function breadcrumbNode(items: { name: string; path: string }[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absUrl(item.path),
    })),
  };
}

/** The WebPage node every public page carries, wired to the site and org. */
export function webPageNode(page: PublicPage, extra: JsonLd = {}): JsonLd {
  return {
    '@type': 'WebPage',
    '@id': `${absUrl(page.path)}#webpage`,
    url: absUrl(page.path),
    name: pageTitle(page),
    description: page.description,
    isPartOf: { '@id': SITE_ID },
    about: { '@id': APP_ID },
    inLanguage: 'en',
    primaryImageOfPage: { '@type': 'ImageObject', url: absUrl(ogImage(page)) },
    datePublished: '2026-08-01',
    dateModified: page.lastModified,
    ...extra,
  };
}

export function faqNode(faqs: Faq[] = FAQS): JsonLd {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function glossaryNode(terms: GlossaryTerm[] = GLOSSARY): JsonLd {
  return {
    '@type': 'DefinedTermSet',
    '@id': `${absUrl('/typing-glossary')}#termset`,
    name: 'KeyTopia Typing Glossary',
    description: 'Definitions of typing and touch-typing terminology.',
    inLanguage: 'en',
    hasDefinedTerm: terms.map((t) => ({
      '@type': 'DefinedTerm',
      '@id': `${absUrl('/typing-glossary')}#${t.slug}`,
      name: t.term,
      description: t.definition,
      inDefinedTermSet: { '@id': `${absUrl('/typing-glossary')}#termset` },
    })),
  };
}

/** The learn-to-type pillar page as an instructional article. */
export function guideArticleNode(page: PublicPage): JsonLd {
  return {
    '@type': 'Article',
    headline: page.title,
    description: page.description,
    articleSection: LEARN_GUIDE.map((s) => s.heading),
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    datePublished: '2026-08-01',
    dateModified: page.lastModified,
    mainEntityOfPage: { '@id': `${absUrl(page.path)}#webpage` },
    image: absUrl(ogImage(page)),
    inLanguage: 'en',
  };
}

/** The three-step method, as a HowTo — eligible for how-to style surfaces. */
export function howToNode(): JsonLd {
  return {
    '@type': 'HowTo',
    name: 'How to learn touch typing with KeyTopia',
    description: 'Assess your current typing, adapt practice to your own weak keys, then advance accuracy first and speed second.',
    totalTime: 'PT15M',
    supply: { '@type': 'HowToSupply', name: 'A computer keyboard' },
    tool: { '@type': 'HowToTool', name: 'A web browser' },
    step: METHOD_STEPS.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      url: `${absUrl('/learn-to-type')}#step-${i + 1}`,
    })),
  };
}

/** The curriculum as a Course with one CourseInstance-free syllabus section per world. */
export function courseNode(): JsonLd {
  return {
    '@type': 'Course',
    '@id': `${absUrl('/curriculum')}#course`,
    name: 'The KeyTopia Typing Curriculum',
    description: 'A 41-lesson touch-typing curriculum spanning nine regions and five worlds, from home-row anchors to symbols, code, rhythm and endurance.',
    provider: { '@id': ORG_ID },
    inLanguage: 'en',
    educationalLevel: 'Beginner to advanced',
    teaches: 'Touch typing',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: PRODUCT_PRICE.price,
      priceCurrency: PRODUCT_PRICE.currency,
      category: 'Free',
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'PT15M',
    },
    syllabusSections: CURRICULUM.map((w, i) => ({
      '@type': 'Syllabus',
      position: i + 1,
      name: w.name,
      description: `${w.tagline}. Target: ${w.targetWpm} at ${w.targetAccuracy}.`,
    })),
  };
}

/** The seven games as an ItemList of VideoGame nodes. */
export function gamesListNode(): JsonLd {
  return {
    '@type': 'ItemList',
    name: 'KeyTopia typing games',
    numberOfItems: GAMES.length,
    itemListElement: GAMES.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'VideoGame',
        name: g.name,
        description: g.description,
        genre: ['Educational', 'Typing'],
        gamePlatform: 'Web browser',
        // Every game is single-player: the rivals in Quill Duel and Survivor
        // Sprint are CPU-controlled, so claiming multiplayer would be false.
        playMode: 'SinglePlayer',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any (web browser)',
        isAccessibleForFree: true,
        publisher: { '@id': ORG_ID },
        url: absUrl('/typing-games'),
      },
    })),
  };
}

/** The free typing test, described as its own tool. */
export function typingTestNode(page: PublicPage): JsonLd {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${absUrl(page.path)}#tool`,
    name: 'Free Typing Test',
    description: page.description,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any (web browser)',
    url: absUrl(page.path),
    isAccessibleForFree: true,
    publisher: { '@id': ORG_ID },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

/** Wrap nodes into a single `@graph` document — one script tag per page. */
export function graph(nodes: JsonLd[]): JsonLd {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/**
 * The complete JSON-LD graph for a given route. Every page carries the
 * Organization, WebSite, WebApplication and its own WebPage + breadcrumbs;
 * page-specific nodes are added on top.
 */
export function jsonLdForPath(page: PublicPage): JsonLd {
  const base: JsonLd[] = [organizationNode(), websiteNode(), webApplicationNode()];
  const crumbs = page.path === '/'
    ? []
    : [breadcrumbNode([{ name: 'Home', path: '/' }, { name: page.label, path: page.path }])];

  const extra: JsonLd[] = [];
  switch (page.path) {
    case '/':
      extra.push(faqNode(FAQS.slice(0, 6)), howToNode());
      break;
    case '/typing-test':
      extra.push(typingTestNode(page));
      break;
    case '/learn-to-type':
      extra.push(guideArticleNode(page), howToNode());
      break;
    case '/curriculum':
      extra.push(courseNode());
      break;
    case '/typing-games':
      extra.push(gamesListNode());
      break;
    case '/faq':
      extra.push(faqNode());
      break;
    case '/typing-glossary':
      extra.push(glossaryNode());
      break;
    default:
      break;
  }

  return graph([...base, webPageNode(page), ...crumbs, ...extra]);
}

/** Safe embedding inside a <script> tag (prevents `</script>` breakout). */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
