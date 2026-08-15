/**
 * Build-time prerenderer.
 *
 * KeyTopia is a client-rendered SPA, which means that without this step every
 * crawlable URL serves the same empty `<div id="root">`. Search engines will
 * eventually render the JavaScript; AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot, OAI-SearchBot) and most link-preview bots will not. This turns
 * each public route into a real HTML document with its own title, meta, canonical,
 * JSON-LD and full body text.
 *
 * Runs after `vite build` (client) and `vite build --ssr` (the prerender entry).
 * React then takes over the same DOM on mount, so the served HTML and the
 * interactive page come from the same components and cannot drift apart.
 *
 *   node scripts/prerender.mjs
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const DIST = join(root, 'dist');
const SSR_ENTRY = join(root, 'dist-ssr', 'entry-prerender.js');

const START = '<!--seo-start-->';
const END = '<!--seo-end-->';

const TEMPLATE_CACHE = join(root, 'dist-ssr', 'template.html');

/**
 * The pristine shell from `vite build`.
 *
 * Prerendering overwrites dist/index.html with the rendered home page, so on a
 * second `npm run seo` without an intervening client build the file no longer
 * has an empty `#root` to fill. The first run caches the untouched shell, and
 * later runs fall back to that cache — which makes the script re-runnable while
 * iterating on the SEO output.
 */
async function loadTemplate() {
  const built = await readFile(join(DIST, 'index.html'), 'utf8');
  if (built.includes('<div id="root"></div>')) {
    await mkdir(dirname(TEMPLATE_CACHE), { recursive: true });
    await writeFile(TEMPLATE_CACHE, built, 'utf8');
    return built;
  }
  try {
    return await readFile(TEMPLATE_CACHE, 'utf8');
  } catch {
    throw new Error(
      'dist/index.html has already been prerendered and no pristine template is cached. Run `vite build` again before prerendering.',
    );
  }
}

async function main() {
  const template = await loadTemplate();

  if (!template.includes(START) || !template.includes(END)) {
    throw new Error(`index.html is missing the ${START} / ${END} markers — prerendering cannot inject per-route head tags.`);
  }

  const { render, routes } = await import(pathToFileURL(SSR_ENTRY).href);

  const written = [];
  for (const path of routes()) {
    const { body, head } = render(path);

    const html = template
      .replace(
        new RegExp(`${START}[\\s\\S]*?${END}`),
        `${START}\n${head}\n    ${END}`,
      )
      .replace('<div id="root"></div>', `<div id="root">${body}</div>`);

    // "/" -> dist/index.html; "/faq" -> dist/faq/index.html, so any static host
    // serves the right document without rewrite rules.
    const outFile = path === '/'
      ? join(DIST, 'index.html')
      : join(DIST, path.replace(/^\//, ''), 'index.html');

    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, html, 'utf8');
    written.push({ path, bytes: html.length });
  }

  const pad = Math.max(...written.map((w) => w.path.length));
  for (const w of written) {
    console.log(`  prerendered  ${w.path.padEnd(pad)}  ${(w.bytes / 1024).toFixed(1)} kB`);
  }
  console.log(`\n  ${written.length} routes prerendered to static HTML.`);
}

main().catch((err) => {
  console.error('\nPrerender failed:\n', err);
  process.exit(1);
});
