/**
 * Head-tag construction, shared by the browser and the prerenderer.
 *
 * `buildHead` is the one place that decides what a page's `<head>` contains.
 * The prerenderer serialises the result into static HTML (what non-JS crawlers
 * and AI agents read), and the `<Seo>` component applies the identical set to
 * `document.head` on client-side navigation (what JS-rendering crawlers and
 * share-preview scrapers read). Both paths therefore agree by construction.
 */

import {
  SITE_NAME, SITE_OG_LOCALE, SITE_THEME_COLOR, absUrl, ogImage,
  pageTitle, type PublicPage,
} from './site';
import { jsonLdForPath, serializeJsonLd } from './jsonLd';

export interface HeadTag {
  tag: 'meta' | 'link';
  attrs: Record<string, string>;
}

export interface HeadDoc {
  title: string;
  tags: HeadTag[];
  /** Serialised JSON-LD `@graph` for this route. */
  jsonLd: string;
}

const meta = (attrs: Record<string, string>): HeadTag => ({ tag: 'meta', attrs });
const link = (attrs: Record<string, string>): HeadTag => ({ tag: 'link', attrs });

export function buildHead(page: PublicPage): HeadDoc {
  const title = pageTitle(page);
  const url = absUrl(page.path);
  const image = absUrl(ogImage(page));

  const tags: HeadTag[] = [
    meta({ name: 'description', content: page.description }),

    // Canonical + language. Single-locale today; hreflang is added here when a
    // second locale ships (see the clubhouse's alternates.ts for the pattern).
    link({ rel: 'canonical', href: url }),
    link({ rel: 'alternate', hreflang: 'en', href: url }),
    link({ rel: 'alternate', hreflang: 'x-default', href: url }),

    // Indexing directives. `max-image-preview:large` is what makes rich image
    // previews eligible in Google; the snippet limits are opt-ins, not caps.
    meta({ name: 'robots', content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' }),
    meta({ name: 'googlebot', content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' }),

    // Open Graph (Facebook, LinkedIn, WhatsApp, Slack, Discord, iMessage…)
    meta({ property: 'og:type', content: page.path === '/learn-to-type' ? 'article' : 'website' }),
    meta({ property: 'og:site_name', content: SITE_NAME }),
    meta({ property: 'og:locale', content: SITE_OG_LOCALE }),
    meta({ property: 'og:title', content: title }),
    meta({ property: 'og:description', content: page.description }),
    meta({ property: 'og:url', content: url }),
    meta({ property: 'og:image', content: image }),
    meta({ property: 'og:image:secure_url', content: image }),
    meta({ property: 'og:image:type', content: 'image/png' }),
    meta({ property: 'og:image:width', content: '1200' }),
    meta({ property: 'og:image:height', content: '630' }),
    meta({ property: 'og:image:alt', content: `${SITE_NAME}. ${page.label}` }),

    // Twitter / X
    meta({ name: 'twitter:card', content: 'summary_large_image' }),
    meta({ name: 'twitter:title', content: title }),
    meta({ name: 'twitter:description', content: page.description }),
    meta({ name: 'twitter:image', content: image }),
    meta({ name: 'twitter:image:alt', content: `${SITE_NAME}. ${page.label}` }),

    // Pinterest rich pins read og:*, but this stops the "save" overlay lying.
    meta({ name: 'author', content: SITE_NAME }),
    meta({ name: 'application-name', content: SITE_NAME }),
    meta({ name: 'theme-color', content: SITE_THEME_COLOR }),
  ];

  return { title, tags, jsonLd: serializeJsonLd(jsonLdForPath(page)) };
}

/** Head for a route that must not be indexed (the app itself). */
export function buildNoIndexHead(title: string): HeadDoc {
  return {
    title,
    tags: [meta({ name: 'robots', content: 'noindex, nofollow' })],
    jsonLd: '',
  };
}

const escapeAttr = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeText = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Serialise a HeadDoc to HTML for the prerendered document. */
export function headToHtml(head: HeadDoc): string {
  const lines = [`    <title>${escapeText(head.title)}</title>`];
  for (const t of head.tags) {
    const attrs = Object.entries(t.attrs)
      .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
      .join(' ');
    lines.push(`    <${t.tag} ${attrs} />`);
  }
  if (head.jsonLd) {
    lines.push(`    <script type="application/ld+json">${head.jsonLd}</script>`);
  }
  return lines.join('\n');
}

/**
 * Apply a HeadDoc to the live document. Tags written here are marked with
 * `data-seo` so the next navigation can remove exactly what it added without
 * disturbing the static tags in index.html (favicons, manifest, viewport).
 */
export function applyHead(head: HeadDoc): void {
  if (typeof document === 'undefined') return;
  document.title = head.title;

  document.head.querySelectorAll('[data-seo]').forEach((el) => el.remove());

  // Remove the build-time defaults this document was served with, so a
  // client-side navigation cannot leave two canonicals or two descriptions.
  const managed = new Set(head.tags.map((t) => headKey(t)));
  document.head
    .querySelectorAll('meta[name], meta[property], link[rel="canonical"], link[rel="alternate"], script[type="application/ld+json"]')
    .forEach((el) => {
      if (el.hasAttribute('data-static')) return;
      const t: HeadTag = {
        tag: el.tagName.toLowerCase() === 'link' ? 'link' : 'meta',
        attrs: {
          ...(el.getAttribute('name') ? { name: el.getAttribute('name')! } : {}),
          ...(el.getAttribute('property') ? { property: el.getAttribute('property')! } : {}),
          ...(el.getAttribute('rel') ? { rel: el.getAttribute('rel')! } : {}),
          ...(el.getAttribute('hreflang') ? { hreflang: el.getAttribute('hreflang')! } : {}),
        },
      };
      if (el.tagName.toLowerCase() === 'script' || managed.has(headKey(t))) el.remove();
    });

  for (const t of head.tags) {
    const el = document.createElement(t.tag);
    for (const [k, v] of Object.entries(t.attrs)) el.setAttribute(k, v);
    el.setAttribute('data-seo', '');
    document.head.appendChild(el);
  }

  if (head.jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = head.jsonLd;
    script.setAttribute('data-seo', '');
    document.head.appendChild(script);
  }
}

function headKey(t: HeadTag): string {
  const { name, property, rel, hreflang } = t.attrs;
  return [t.tag, name ?? '', property ?? '', rel ?? '', hreflang ?? ''].join('|');
}
