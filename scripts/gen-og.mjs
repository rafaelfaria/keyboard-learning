/**
 * Renders a per-page social preview image into dist/og/<slug>.png.
 *
 * A single shared OG image means every share of every page looks identical in
 * a feed, which costs click-through. This stamps each page's own title onto the
 * brand card, reusing public/og.svg so the artwork stays in one place.
 *
 * Runs after the build (it reads the page registry from the SSR bundle) and
 * writes into dist/, alongside the prerendered HTML that references it.
 *
 *   node scripts/gen-og.mjs
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const DIST = join(root, 'dist');
const SSR_ENTRY = join(root, 'dist-ssr', 'entry-prerender.js');

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy wrap by character budget — good enough for a fixed-size card. */
function wrap(text, maxChars, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[,.:;\s]+$/, '')}…`;
  }
  return lines;
}

/** Horizontal room for text: card width, minus the logo column and a margin. */
const TEXT_WIDTH = 1200 - 404 - 44;
/** Manrope Bold averages a little over half the font size per character. */
const CHAR_RATIO = 0.56;

const budget = (fontSize) => Math.floor(TEXT_WIDTH / (fontSize * CHAR_RATIO));

/** Replace the text block in og.svg with this page's copy. */
function cardSvg(template, { heading, sub }) {
  // Largest size at which the heading still fits in three lines. Wrapping is
  // measured against the size, not a fixed character count, so a short-but-wide
  // heading cannot run off the edge of the card.
  let size = 82;
  let headLines = wrap(heading, budget(size), 3);
  for (const candidate of [82, 70, 60, 52]) {
    const lines = wrap(heading, budget(candidate), 3);
    const longest = Math.max(...lines.map((l) => l.length));
    if (longest <= budget(candidate)) {
      size = candidate;
      headLines = lines;
      break;
    }
  }

  const subLines = wrap(sub, 46, 3);
  const top = 268 - (headLines.length - 1) * (size * 0.52);

  const head = headLines
    .map((l, i) => `<text x="404" y="${Math.round(top + i * size * 1.12)}" font-family="Manrope, system-ui, sans-serif" font-size="${size}" font-weight="800" fill="#eef1fb">${esc(l)}</text>`)
    .join('\n  ');

  const subTop = Math.round(top + headLines.length * size * 1.12 + 42);
  const subs = subLines
    .map((l, i) => `<text x="404" y="${subTop + i * 40}" font-family="Manrope, system-ui, sans-serif" font-size="28" font-weight="500" fill="#22d3ee">${esc(l)}</text>`)
    .join('\n  ');

  const brand = `<text x="404" y="${subTop + subLines.length * 40 + 46}" font-family="Manrope, system-ui, sans-serif" font-size="26" font-weight="600" fill="#8b93b8">keytopia.app</text>`;

  // Everything from the first <text> onward in the template is replaced.
  return template.replace(/\s*<text[\s\S]*?<\/svg>/, `\n  ${head}\n  ${subs}\n  ${brand}\n</svg>`);
}

async function main() {
  const mod = await import(pathToFileURL(SSR_ENTRY).href);
  const { PUBLIC_PAGES } = await import(pathToFileURL(SSR_ENTRY).href).then((m) => m);

  const pages = PUBLIC_PAGES ?? mod.PUBLIC_PAGES;
  if (!pages) throw new Error('The SSR bundle does not export PUBLIC_PAGES.');

  const template = await readFile(join(root, 'public', 'og.svg'), 'utf8');
  await mkdir(join(DIST, 'og'), { recursive: true });

  for (const page of pages) {
    const slug = page.path === '/' ? 'home' : page.path.replace(/^\//, '').replace(/\//g, '-');
    const heading = page.path === '/'
      ? 'Learn to type beautifully'
      : page.title.replace(/ \| .*$/, '').replace(/ — .*$/, '');
    const sub = page.path === '/'
      ? 'Adaptive lessons, seven games, races and deep analytics. Free.'
      : page.description;

    const svg = cardSvg(template, { heading, sub });
    const out = join(DIST, 'og', `${slug}.png`);
    await sharp(Buffer.from(svg), { density: 192 })
      .resize(1200, 630)
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`  og/${slug}.png`.padEnd(34) + '1200×630');
  }

  // Keep the generic card at /og.png for anything not in the registry.
  const generic = await sharp(await readFile(join(root, 'public', 'og.svg')), { density: 192 })
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(join(DIST, 'og.png'), generic);
  console.log('  og.png'.padEnd(34) + '1200×630');
}

main().catch((err) => {
  console.error('\nOG image generation failed:\n', err);
  process.exit(1);
});
