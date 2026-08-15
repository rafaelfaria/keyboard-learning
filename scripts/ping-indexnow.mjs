/**
 * Submits every public URL to IndexNow after a deploy.
 *
 * IndexNow is a push protocol: one request tells Bing, Yandex, Naver and Seznam
 * that URLs changed, instead of waiting for a crawl. Google does not participate,
 * which is what the sitemap and Search Console are for.
 *
 * Requires VITE_INDEXNOW_KEY — the same key gen-seo.mjs publishes at
 * /<key>.txt, which is how the endpoint verifies you own the domain.
 *
 *   VITE_INDEXNOW_KEY=<key> node scripts/ping-indexnow.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const SSR_ENTRY = join(root, 'dist-ssr', 'entry-prerender.js');

const key = process.env.VITE_INDEXNOW_KEY;
if (!key) {
  console.error('VITE_INDEXNOW_KEY is not set — nothing to submit.');
  process.exit(1);
}

const mod = await import(pathToFileURL(SSR_ENTRY).href);
const host = new URL(mod.SITE_URL).host;
const urlList = mod.allUrls();

const res = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `${mod.SITE_URL}/${key}.txt`,
    urlList,
  }),
});

// 200 = accepted, 202 = accepted but the key is still being verified.
if (res.status === 200 || res.status === 202) {
  console.log(`Submitted ${urlList.length} URLs to IndexNow (HTTP ${res.status}).`);
} else {
  console.error(`IndexNow rejected the submission: HTTP ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}
