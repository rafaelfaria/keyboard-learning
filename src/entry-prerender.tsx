/**
 * SSR entry used only at build time by scripts/prerender.mjs.
 *
 * It renders the public pages to static HTML so that crawlers which do not
 * execute JavaScript — every AI agent crawler, most link-preview bots, and
 * Googlebot on its first pass — see the real content instead of an empty
 * `<div id="root">`.
 *
 * It must never import the store, the sound engine, GSAP or Three.js: those
 * touch browser globals at module scope and would crash in Node. That is why
 * the home page is prerendered from `HomeOutline` (a text-faithful version of
 * the landing page built from the same content data) rather than from
 * `Landing.tsx` itself.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import {
  AdaptivePracticePage, AnalyticsPage, CurriculumPage, FaqPage, GlossaryPage,
  HomeOutline, KidsPage, LearnToTypePage, PracticeModesPage, PrivacyPage,
  RacesPage, SchoolsPage, TermsPage, TypingGamesPage,
} from './pages/public/pages';
import { TypingTestPage } from './pages/public/TypingTest';
import { buildHead, headToHtml } from './lib/seo/head';
import { pageByPath, PUBLIC_PAGES } from './lib/seo/site';

// Re-exported so scripts/gen-seo.mjs can reach the generators through the same
// compiled bundle rather than needing its own TypeScript pipeline.
export {
  allUrls, buildLlmsFullTxt, buildLlmsTxt, buildRobotsTxt, buildSitemapIndexXml, buildSitemapXml,
} from './lib/seo/generators';
export { SITE_URL, PUBLIC_PAGES } from './lib/seo/site';

const ROUTES: Record<string, () => React.ReactElement> = {
  '/': HomeOutline,
  '/typing-test': TypingTestPage,
  '/learn-to-type': LearnToTypePage,
  '/curriculum': CurriculumPage,
  '/typing-games': TypingGamesPage,
  '/adaptive-practice': AdaptivePracticePage,
  '/typing-practice-modes': PracticeModesPage,
  '/typing-races': RacesPage,
  '/typing-analytics': AnalyticsPage,
  '/typing-for-kids': KidsPage,
  '/typing-for-schools': SchoolsPage,
  '/faq': FaqPage,
  '/typing-glossary': GlossaryPage,
  '/privacy': PrivacyPage,
  '/terms': TermsPage,
};

export interface Rendered {
  path: string;
  /** Markup for `<div id="root">`. */
  body: string;
  /** Serialised `<head>` content: title, meta, canonical, JSON-LD. */
  head: string;
}

export function routes(): string[] {
  return PUBLIC_PAGES.map((p) => p.path);
}

export function render(path: string): Rendered {
  const Page = ROUTES[path];
  if (!Page) throw new Error(`No prerender component registered for ${path}`);
  const page = pageByPath(path);
  if (!page) throw new Error(`No PublicPage registered for ${path}`);

  const body = renderToStaticMarkup(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>,
  );

  return { path, body, head: headToHtml(buildHead(page)) };
}
