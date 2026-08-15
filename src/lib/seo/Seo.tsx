/**
 * Route-level head management for the SPA.
 *
 * Prerendered documents already ship with the correct head (see
 * scripts/prerender.mjs). This keeps it correct after a client-side
 * navigation, and gives JS-rendering crawlers the same tags they would have
 * got from the static file.
 */

import { useEffect } from 'react';
import { applyHead, buildHead, buildNoIndexHead } from './head';
import { pageByPath, SITE_NAME } from './site';

/** Drop into any public page: `<Seo path="/faq" />`. */
export function Seo({ path }: { path: string }) {
  useEffect(() => {
    const page = pageByPath(path);
    if (page) applyHead(buildHead(page));
  }, [path]);
  return null;
}

/**
 * The app itself is private, per-device state — never indexable. robots.txt
 * disallows it, and this makes the directive explicit for any crawler that
 * reaches an app URL anyway (a shared link, for instance).
 */
export function useNoIndex(title?: string): void {
  useEffect(() => {
    applyHead(buildNoIndexHead(title ? `${title} · ${SITE_NAME}` : SITE_NAME));
  }, [title]);
}
