# Discoverability

KeyTopia is a client-rendered SPA, so without a build step every URL would serve
the same empty `<div id="root">`. Google renders JavaScript eventually; AI
crawlers (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot) and most link-preview
bots never do. The pipeline below turns each public route into a real HTML
document, and publishes the machine-readable files that search engines and LLM
agents look for.

## The one thing to edit

`src/lib/seo/site.ts` holds the page registry. Adding an entry there is what
adds a page to:

- the prerenderer (a real HTML file in `dist/`)
- `sitemap.xml`
- `robots.txt` allow rules
- `llms.txt` and `llms-full.txt`
- the per-page OG image
- the public footer's internal link graph

A new page also needs a route in `src/main.tsx` and a component in
`src/entry-prerender.tsx`'s `ROUTES` map. The prerenderer throws if a registered
page has no component, so the two cannot silently drift.

## Files

| File | Purpose |
|---|---|
| `src/lib/seo/site.ts` | Origin, brand constants, the public page registry |
| `src/lib/seo/content.ts` | The factual copy: features, games, curriculum, FAQ, glossary, guide |
| `src/lib/seo/jsonLd.ts` | Schema.org builders, one cross-referenced `@graph` per page |
| `src/lib/seo/head.ts` | The single definition of a page's `<head>`, for both render paths |
| `src/lib/seo/Seo.tsx` | Applies that head after a client-side navigation |
| `src/lib/seo/generators.ts` | robots.txt, sitemap.xml, llms.txt, llms-full.txt |
| `src/entry-prerender.tsx` | SSR entry — build-time only |
| `scripts/prerender.mjs` | Renders each route into `dist/<route>/index.html` |
| `scripts/gen-og.mjs` | Per-page 1200×630 social cards into `dist/og/` |
| `scripts/gen-seo.mjs` | Writes the crawler files into `dist/` |
| `scripts/ping-indexnow.mjs` | Pushes every URL to IndexNow after a deploy |

`src/lib/seo/content.ts` is the single source of truth for what the product
does. The pages render it, the JSON-LD lifts structured data out of it, and
`llms-full.txt` serialises it — so the marketing copy, the structured data and
the AI-facing text cannot disagree.

## Build

```bash
npm run build
```

runs `tsc -b` → `vite build` → `vite build --ssr` → `npm run seo`
(prerender → OG images → crawler files).

To iterate on the SEO output alone without a full type-check:

```bash
npm run seo
```

`npm run preview` serves `dist/` the way a static host does — filesystem first,
SPA fallback last — so the prerendered documents are actually verifiable
locally. Check a page with:

```bash
curl -s http://localhost:4173/faq | grep -o "<title>[^<]*</title>"
```

## What ships

**Per page** — title, description, canonical, `hreflang` (self + `x-default`),
robots directives with `max-image-preview:large`, full Open Graph and Twitter
card tags, a unique OG image, and a JSON-LD `@graph`.

**Structured data** — every page carries `Organization`, `WebSite`,
`WebApplication` and its own `WebPage` + `BreadcrumbList`, wired together by
`@id` so a crawler reads the site as one entity. On top of that: `FAQPage`
(home and `/faq`), `HowTo` (the three-step method), `Article` (the pillar
guide), `Course` (the curriculum), `ItemList` of `VideoGame` (the games),
`DefinedTermSet` (the glossary) and `SoftwareApplication` (the typing test).

**Site-wide** — `robots.txt` naming 30+ crawlers individually including every
major AI agent, `sitemap.xml` with image and hreflang extensions,
`sitemap-index.xml`, `llms.txt` (the llmstxt.org curated index) and
`llms-full.txt` (every public page's complete text in one fetch).

**Hosting** — `vercel.json` sets security headers, immutable caching for hashed
assets, short-lived caching for the crawler files, and an SPA rewrite scoped so
it can never shadow a prerendered file.

## Deploy checklist

1. Set `VITE_SITE_URL` in the Vercel project (production and preview).
2. Verify the domain in [Google Search Console](https://search.google.com/search-console)
   and [Bing Webmaster Tools](https://www.bing.com/webmasters), and submit
   `https://keytopia.app/sitemap.xml` in both.
3. Optionally set `VITE_INDEXNOW_KEY` and run `npm run seo:ping` after each
   deploy — Bing, Yandex, Naver and Seznam index in hours rather than weeks.
4. Check a live page in the
   [Rich Results Test](https://search.google.com/test/rich-results) and the
   [Schema Markup Validator](https://validator.schema.org).
5. Check a share preview in the
   [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/).

## Deliberate choices

**The app is not indexed.** `/app/`, `/onboarding` and `/who` are disallowed in
`robots.txt` and emit `noindex` at runtime. They are per-device state with no
shared content — indexing them would produce duplicate, empty results.

**Scrapers that do not send traffic are blocked.** SemrushBot, AhrefsBot, MJ12bot
and DotBot get `Disallow: /`. AI crawlers are explicitly *allowed*: citation in
an AI answer is the modern equivalent of a search result.

**The home page is prerendered from `HomeOutline`, not `Landing.tsx`.** The real
landing depends on Three.js, GSAP and the profile store, none of which run in
Node. `HomeOutline` is a text-faithful version built from the same content data,
which React replaces on mount — the same claims, not a separate set.

## Not done yet

- **Hreflang for real.** The helpers emit a self-referencing cluster; when a
  second locale ships, `buildHead` and `buildSitemapXml` need the locale list.
- **A blog.** The largest remaining gap: the pages here cover the terms people
  search for about typing, but nothing here earns links over time.
- **Real Core Web Vitals work.** The main bundle is ~1.36 MB (404 kB gzipped),
  dominated by Three.js on the landing page. The prerendered pages paint their
  text before that loads, but LCP on `/` will be bound by it until the 3D scene
  is code-split behind a dynamic import.
