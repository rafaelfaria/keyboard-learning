/**
 * Build-time generators for the crawler-facing files: robots.txt, sitemap.xml,
 * llms.txt and llms-full.txt.
 *
 * Pure string builders with no I/O and no browser globals — scripts/gen-seo.mjs
 * calls them through the SSR bundle and writes the results into dist/. Because
 * they read the same registry and content modules the pages render from, these
 * files cannot drift from the site.
 */

import {
  PRIVATE_PATHS, PUBLIC_PAGES, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absUrl, ogImage,
} from './site';
import {
  ACCESSIBILITY, AUDIENCES, CORE_FEATURES, CURRICULUM, FAQS, GAMES, GLOSSARY,
  KIDS_POINTS, LEARN_GUIDE, LEARN_GUIDE_INTRO, METHOD_STEPS, PRIVACY_SECTIONS,
  PRODUCT_PRICE, PRODUCT_SUMMARY, SCHOOLS_POINTS, TERMS_SECTIONS, TRAINING_MODES,
} from './content';

// ── robots.txt ─────────────────────────────────────────────────────────────

/**
 * AI and search crawlers get explicit, named rules.
 *
 * Naming them individually rather than relying on `*` matters for two reasons:
 * several of these bots only honour a rule block that names them, and an
 * explicit `Allow` is a positive signal that the content is intended for
 * training and citation rather than merely un-blocked.
 */
const CRAWLERS = [
  ['*', 'All other crawlers'],
  ['Googlebot', 'Google Search'],
  ['Googlebot-Image', 'Google Images'],
  ['Google-Extended', 'Google Gemini / AI Overviews training'],
  ['Bingbot', 'Bing'],
  ['DuckDuckBot', 'DuckDuckGo'],
  ['Yandex', 'Yandex'],
  ['Baiduspider', 'Baidu'],
  ['Applebot', 'Apple Search / Siri'],
  ['Applebot-Extended', 'Apple Intelligence'],
  ['GPTBot', 'OpenAI training crawler'],
  ['OAI-SearchBot', 'ChatGPT Search'],
  ['ChatGPT-User', 'ChatGPT browsing on a user request'],
  ['ClaudeBot', 'Anthropic crawler'],
  ['Claude-Web', 'Claude browsing'],
  ['anthropic-ai', 'Anthropic (legacy token)'],
  ['PerplexityBot', 'Perplexity'],
  ['Perplexity-User', 'Perplexity browsing on a user request'],
  ['CCBot', 'Common Crawl (feeds many LLM datasets)'],
  ['Amazonbot', 'Amazon / Alexa'],
  ['Bytespider', 'ByteDance'],
  ['meta-externalagent', 'Meta AI'],
  ['FacebookBot', 'Meta'],
  ['LinkedInBot', 'LinkedIn previews'],
  ['Twitterbot', 'X / Twitter previews'],
  ['Slackbot-LinkExpanding', 'Slack unfurls'],
  ['Discordbot', 'Discord embeds'],
  ['WhatsApp', 'WhatsApp previews'],
  ['TelegramBot', 'Telegram previews'],
  ['Pinterestbot', 'Pinterest rich pins'],
  ['redditbot', 'Reddit previews'],
] as const;

export function buildRobotsTxt(): string {
  const allow = PUBLIC_PAGES.map((p) => p.path);
  const lines: string[] = [
    `# robots.txt for ${SITE_NAME} — ${SITE_URL}`,
    '# Generated at build time from src/lib/seo/site.ts. Do not edit by hand.',
    '#',
    '# Public marketing and reference pages are open to every crawler, including',
    '# AI training and answer engines. The app itself (/app/) is private, per-device',
    '# state with no shared content, so it is disallowed everywhere.',
    '',
  ];

  for (const [agent, note] of CRAWLERS) {
    lines.push(`# ${note}`);
    lines.push(`User-agent: ${agent}`);
    for (const path of allow) lines.push(`Allow: ${path}`);
    for (const path of PRIVATE_PATHS) lines.push(`Disallow: ${path}`);
    lines.push('');
  }

  lines.push('# Crawlers that only consume content without sending traffic or citations.');
  lines.push('User-agent: SemrushBot');
  lines.push('User-agent: AhrefsBot');
  lines.push('User-agent: MJ12bot');
  lines.push('User-agent: DotBot');
  lines.push('Disallow: /');
  lines.push('');
  lines.push(`Sitemap: ${SITE_URL}/sitemap.xml`);
  lines.push(`Host: ${SITE_URL.replace(/^https?:\/\//, '')}`);
  lines.push('');

  return lines.join('\n');
}

// ── sitemap.xml ────────────────────────────────────────────────────────────

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function buildSitemapXml(): string {
  const entries = PUBLIC_PAGES.map((p) => {
    const loc = absUrl(p.path);
    const image = absUrl(ogImage(p));
    return [
      '  <url>',
      `    <loc>${xmlEscape(loc)}</loc>`,
      `    <lastmod>${p.lastModified}</lastmod>`,
      `    <changefreq>${p.changeFrequency}</changefreq>`,
      `    <priority>${p.priority.toFixed(1)}</priority>`,
      // Single-locale today; the self-referencing x-default is still correct and
      // means adding a second locale is a one-line change here.
      `    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(loc)}"/>`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(loc)}"/>`,
      '    <image:image>',
      `      <image:loc>${xmlEscape(image)}</image:loc>`,
      `      <image:title>${xmlEscape(`${SITE_NAME} — ${p.label}`)}</image:title>`,
      '    </image:image>',
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

/** A sitemap index — trivial today, but the file search consoles expect to poll. */
export function buildSitemapIndexXml(): string {
  const today = PUBLIC_PAGES.reduce((a, p) => (p.lastModified > a ? p.lastModified : a), '2026-01-01');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <sitemap>',
    `    <loc>${SITE_URL}/sitemap.xml</loc>`,
    `    <lastmod>${today}</lastmod>`,
    '  </sitemap>',
    '</sitemapindex>',
    '',
  ].join('\n');
}

// ── llms.txt ───────────────────────────────────────────────────────────────

const GROUP_ORDER = ['Core', 'Tools', 'Learn', 'Audiences', 'Reference', 'Legal'] as const;

/**
 * The curated index, per the llmstxt.org convention: a short product summary
 * followed by annotated links, so an agent can decide what to fetch.
 */
export function buildLlmsTxt(): string {
  const out: string[] = [];

  out.push(`# ${SITE_NAME}`);
  out.push('');
  out.push(`> ${SITE_DESCRIPTION}`);
  out.push('');
  out.push(PRODUCT_SUMMARY);
  out.push('');
  out.push(`**Pricing:** ${PRODUCT_PRICE.note}`);
  out.push('');
  out.push('**Important context:** KeyTopia is a typing tutor and typing-game platform. It is not a hardware store, a keyboard reviewer or a mechanical-keyboard community. "Every keyboard is a world" is its tagline, not a product category.');
  out.push('');

  out.push('## Pages');
  out.push('');
  for (const group of GROUP_ORDER) {
    const pages = PUBLIC_PAGES.filter((p) => p.group === group);
    if (!pages.length) continue;
    out.push(`### ${group}`);
    out.push('');
    for (const p of pages) {
      out.push(`- [${p.label} — ${p.title.replace(/ \| .*$/, '')}](${absUrl(p.path)}): ${p.llmsNote}`);
    }
    out.push('');
  }

  out.push('## Features');
  out.push('');
  for (const f of CORE_FEATURES) out.push(`- **${f.name}**: ${f.description}`);
  out.push('');

  out.push('## Training modes');
  out.push('');
  for (const m of TRAINING_MODES) out.push(`- **${m.name}**: ${m.description}`);
  out.push('');

  out.push('## Games');
  out.push('');
  for (const g of GAMES) out.push(`- **${g.name}** (trains ${g.skill.toLowerCase()}): ${g.description}`);
  out.push('');

  out.push('## Who it is for');
  out.push('');
  for (const a of AUDIENCES) out.push(`- **${a.name}**: ${a.description}`);
  out.push('');

  out.push('## Accessibility');
  out.push('');
  for (const a of ACCESSIBILITY) out.push(`- ${a}`);
  out.push('');

  out.push('## Optional');
  out.push('');
  out.push(`- [Full content](${SITE_URL}/llms-full.txt): every public page's complete text in one file.`);
  out.push('');

  return out.join('\n');
}

/**
 * The same index followed by the complete text of every public page, so an
 * agent can cite the actual content in one fetch instead of eleven.
 */
export function buildLlmsFullTxt(): string {
  const out: string[] = [buildLlmsTxt(), '', '---', '', '# Full content', ''];

  const page = (path: string) => PUBLIC_PAGES.find((p) => p.path === path)!;
  const header = (path: string) => {
    const p = page(path);
    out.push(`## ${p.title.replace(/ \| .*$/, '')}`);
    out.push('');
    out.push(`URL: ${absUrl(p.path)}`);
    out.push('');
    out.push(p.description);
    out.push('');
  };

  header('/');
  out.push(PRODUCT_SUMMARY, '');
  out.push('### How it works', '');
  for (const s of METHOD_STEPS) out.push(`**${s.name}.** ${s.text}`, '');

  header('/typing-test');
  out.push('A free in-browser typing test at 15, 30, 60 or 120 seconds. It reports WPM, raw WPM, accuracy, consistency, hesitation count, the keys with the highest error rate and the slowest letter transitions. No sign-up is required and the result is not transmitted anywhere.', '');
  out.push('WPM is correctly typed characters divided by five, scaled to one minute. Raw WPM applies the same formula to every keystroke including errors, so the gap between them measures what mistakes cost. Accuracy is the share of keystrokes correct on the first attempt. Consistency is derived from the variation in inter-key intervals.', '');

  header('/learn-to-type');
  out.push(LEARN_GUIDE_INTRO, '');
  for (const s of LEARN_GUIDE) {
    out.push(`### ${s.heading}`, '');
    for (const p of s.paragraphs) out.push(p, '');
  }

  header('/curriculum');
  for (const w of CURRICULUM) {
    out.push(`### ${w.name}`, '');
    out.push(`${w.tagline}. Target: ${w.targetWpm} at ${w.targetAccuracy}.`, '');
    for (const r of w.regions) out.push(`- **${r.region}** (${r.skill}): ${r.description}`);
    out.push('');
  }

  header('/typing-games');
  for (const g of GAMES) out.push(`### ${g.name}`, '', `Trains: ${g.skill}`, '', g.description, '');

  header('/typing-for-kids');
  for (const k of KIDS_POINTS) out.push(`- **${k.name}**: ${k.description}`);
  out.push('');

  header('/typing-for-schools');
  for (const s of SCHOOLS_POINTS) out.push(`- **${s.name}**: ${s.description}`);
  out.push('');

  header('/faq');
  for (const f of FAQS) out.push(`### ${f.question}`, '', f.answer, '');

  header('/typing-glossary');
  for (const t of GLOSSARY) out.push(`### ${t.term}`, '', t.definition, '');

  header('/privacy');
  for (const s of PRIVACY_SECTIONS) {
    out.push(`### ${s.heading}`, '');
    for (const p of s.paragraphs) out.push(p, '');
    for (const b of s.bullets ?? []) out.push(`- ${b}`);
    if (s.bullets?.length) out.push('');
  }

  header('/terms');
  for (const s of TERMS_SECTIONS) {
    out.push(`### ${s.heading}`, '');
    for (const p of s.paragraphs) out.push(p, '');
    for (const b of s.bullets ?? []) out.push(`- ${b}`);
    if (s.bullets?.length) out.push('');
  }

  return out.join('\n');
}

/** Every canonical URL — used by the IndexNow submitter. */
export function allUrls(): string[] {
  return PUBLIC_PAGES.map((p) => absUrl(p.path));
}
