/**
 * Writes the crawler-facing files into dist/ after a build.
 *
 *   robots.txt          named rules for every search and AI crawler
 *   sitemap.xml         every public URL with lastmod, priority and image
 *   sitemap-index.xml   what search consoles like to be pointed at
 *   llms.txt            curated index for LLM agents (llmstxt.org)
 *   llms-full.txt       the complete text of every public page, in one fetch
 *   <indexnow-key>.txt  IndexNow ownership proof, when a key is configured
 *
 * Generated rather than hand-written so they can never fall out of step with
 * the page registry in src/lib/seo/site.ts.
 *
 *   node scripts/gen-seo.mjs
 */

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const DIST = join(root, 'dist');
const SSR_ENTRY = join(root, 'dist-ssr', 'entry-prerender.js');

async function main() {
  const mod = await import(pathToFileURL(SSR_ENTRY).href);

  const files = [
    ['robots.txt', mod.buildRobotsTxt()],
    ['sitemap.xml', mod.buildSitemapXml()],
    ['sitemap-index.xml', mod.buildSitemapIndexXml()],
    ['llms.txt', mod.buildLlmsTxt()],
    ['llms-full.txt', mod.buildLlmsFullTxt()],
  ];

  // IndexNow (Bing, Yandex, Naver, Seznam) verifies ownership by serving the
  // key as plain text at /<key>.txt. Only emitted when a key is configured.
  const key = process.env.VITE_INDEXNOW_KEY;
  if (key) {
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
      throw new Error('VITE_INDEXNOW_KEY must be 8–128 characters of [a-zA-Z0-9-].');
    }
    files.push([`${key}.txt`, key]);
  }

  for (const [name, body] of files) {
    await writeFile(join(DIST, name), body, 'utf8');
    console.log(`  wrote  ${name.padEnd(18)}  ${(body.length / 1024).toFixed(1)} kB`);
  }

  if (!key) {
    console.log('\n  note: VITE_INDEXNOW_KEY not set — skipped the IndexNow key file.');
  }
  console.log(`\n  Base URL: ${mod.SITE_URL}`);
}

main().catch((err) => {
  console.error('\nSEO asset generation failed:\n', err);
  process.exit(1);
});
