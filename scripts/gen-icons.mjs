/**
 * Rasterises the KeyTopia brand SVGs in public/ into every icon size a site needs.
 * Run with: npm run icons
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const PUB = path.resolve('public');
const src = (f) => readFile(path.join(PUB, f));
const out = (f) => path.join(PUB, f);

const png = async (svgFile, size, file, height) =>
  sharp(await src(svgFile), { density: 384 })
    .resize(size, height ?? size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out(file));

const jobs = [
  // transparent marks
  ['favicon-tiny.svg', 16, 'favicon-16x16.png'],
  ['favicon-tiny.svg', 32, 'favicon-32x32.png'],
  ['favicon-tiny.svg', 48, 'favicon-48x48.png'],
  ['favicon.svg', 96, 'favicon-96x96.png'],
  ['favicon.svg', 512, 'logo-512.png'],
  // PWA / platform icons (solid background)
  ['icon-maskable.svg', 192, 'icon-192.png'],
  ['icon-maskable.svg', 512, 'icon-512.png'],
  ['icon-maskable.svg', 512, 'icon-maskable-512.png'],
  ['icon-apple.svg', 180, 'apple-touch-icon.png'],
  ['icon-apple.svg', 270, 'mstile-270.png'],
];

for (const [svgFile, size, file] of jobs) {
  await png(svgFile, size, file);
  console.log(`  ${file.padEnd(26)} ${size}×${size}`);
}

// social card
await sharp(await src('og.svg'), { density: 192 }).resize(1200, 630).png({ compressionLevel: 9 }).toFile(out('og.png'));
console.log('  og.png                     1200×630');

// multi-resolution .ico for legacy browsers / bookmarks
const ico = await pngToIco([out('favicon-16x16.png'), out('favicon-32x32.png'), out('favicon-48x48.png')]);
await writeFile(out('favicon.ico'), ico);
console.log('  favicon.ico                16/32/48');

// web app manifest
await writeFile(out('site.webmanifest'), `${JSON.stringify({
  name: 'KeyTopia — every keyboard is a world',
  short_name: 'KeyTopia',
  description: 'Learn to type beautifully: adaptive lessons, original games, races and deep analytics for every age.',
  start_url: '/app',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  background_color: '#0b1020',
  theme_color: '#0b1020',
  categories: ['education', 'games', 'productivity'],
  icons: [
    { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
    { src: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    { src: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    { src: '/icon-maskable-512.png', type: 'image/png', sizes: '512x512', purpose: 'maskable' },
  ],
}, null, 2)}\n`);
console.log('  site.webmanifest');
