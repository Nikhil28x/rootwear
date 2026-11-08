/**
 * Render the hero tee's poster: the 3D scene's own first frame, so the swap
 * from poster to live canvas is pixel for pixel.
 *
 *   pnpm dev                       # in another terminal
 *   node scripts/make-tee-poster.mjs <page url> <out dir>
 *
 * e.g. node scripts/make-tee-poster.mjs http://localhost:5173/drops/01-pineapple-haze/tee static/images/drop-01
 *
 * Needs playwright-core and sharp resolvable from this script's folder (not
 * project dependencies: install them beside a copy, as for prepare-tee-model),
 * and Microsoft Edge (or set CHANNEL=chrome). Re-run whenever the model, the photographs, the
 * lighting or the garment's shading change. See docs/tee-model.md.
 */
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';

const [url, outDir] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`${url}${url.includes('?') ? '&' : '?'}tee-poster`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => typeof window.__teeSnapshot === 'function', null, { timeout: 60000 });
const dataUrl = await page.evaluate(() => window.__teeSnapshot());
await browser.close();

const png = Buffer.from(dataUrl.split(',')[1], 'base64');
for (const width of [1600, 800]) {
	await sharp(png)
		.resize(width)
		.webp({ quality: 88, alphaQuality: 92, effort: 6 })
		.toFile(`${outDir}/tee-poster-${width}.webp`);
}
const { width, height } = await sharp(png).metadata();
console.log(`poster from a ${width}×${height} frame → ${outDir}/tee-poster-{1600,800}.webp`);
