/**
 * The hero tee's images: front and back cutouts, plus each side's surface maps.
 *
 *   node scripts/prepare-hero-shots.mjs <front.png> <back.png> <out dir>
 *
 * Each render is cropped to its own garment outline (plus a margin) and both
 * are fitted to one frame, so front and back stay registered: the back's
 * outline lands where the front's does when the cloth turns round.
 *
 * For each side it writes:
 *   tee-<side>.webp          the cutout, 1152 px wide, with alpha;
 *   tee-<side>-normal.webp   a tangent-space normal map of the FINE detail —
 *                            knit, rib, embroidery — read from a high-pass of
 *                            brightness, so the studio's soft light isn't
 *                            mistaken for relief (1024 px);
 *   tee-<side>-height.webp   a displacement map of the MEDIUM shape — folds,
 *                            the hem's drape — a band-pass of brightness, which
 *                            the cloth's motion runs along (lossless, 256 px).
 * Both maps are flat (128) outside the garment.
 *
 * Needs sharp resolvable from this script's folder (it is not a project
 * dependency): install it beside a copy, e.g. in a scratch folder.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const [frontPath, backPath, outDir] = process.argv.slice(2);

/** Alpha bounding box of an image, at its own resolution. */
async function alphaBox(path) {
	const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
	for (let y = 0; y < info.height; y++) {
		for (let x = 0; x < info.width; x++) {
			if (data[(y * info.width + x) * 4 + 3] > 16) {
				x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
			}
		}
	}
	return { x0, y0, x1, y1, width: info.width, height: info.height };
}

/** Separable box blur, edge-clamped. */
function blur(src, w, h, radius) {
	const tmp = new Float32Array(w * h);
	const out = new Float32Array(w * h);
	const span = 2 * radius + 1;
	for (let y = 0; y < h; y++) {
		let sum = 0;
		for (let x = -radius; x <= radius; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))];
		for (let x = 0; x < w; x++) {
			tmp[y * w + x] = sum / span;
			sum += src[y * w + Math.min(w - 1, x + radius + 1)] - src[y * w + Math.max(0, x - radius)];
		}
	}
	for (let x = 0; x < w; x++) {
		let sum = 0;
		for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
		for (let y = 0; y < h; y++) {
			out[y * w + x] = sum / span;
			sum += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x];
		}
	}
	return out;
}

async function pixels(input, width) {
	const { data, info } = await sharp(input).resize(width).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const w = info.width;
	const h = info.height;
	const lum = new Float32Array(w * h);
	const inside = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		lum[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
		inside[i] = data[i * 4 + 3] > 8 ? 1 : 0;
	}
	return { w, h, lum, inside };
}

/** Fine relief → tangent-space normal map (rows run down; v runs up, hence +gy). */
async function normalMap(input, file) {
	const { w, h, lum, inside } = await pixels(input, 1024);
	const low = blur(lum, w, h, 5);
	const height = new Float32Array(w * h);
	for (let i = 0; i < w * h; i++) height[i] = inside[i] ? lum[i] - low[i] : 0;
	const at = (x, y) => height[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
	const out = Buffer.alloc(w * h * 3);
	const strength = 3;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
			const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
			let nx = -gx * strength;
			let ny = gy * strength;
			let nz = 1;
			const len = Math.hypot(nx, ny, nz);
			const i = (y * w + x) * 3;
			out[i] = Math.round((nx / len * 0.5 + 0.5) * 255);
			out[i + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
			out[i + 2] = Math.round((nz / len * 0.5 + 0.5) * 255);
		}
	}
	// Lossy is fine for a normal map of fine noise-like detail, and a fraction of the size.
	await sharp(out, { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 68, effort: 6 }).toFile(file);
}

/** Medium shape → displacement map: folds kept, knit and studio light dropped. */
async function heightMap(input, file) {
	const { w, h, lum, inside } = await pixels(input, 256);
	let mean = 0;
	let count = 0;
	for (let i = 0; i < w * h; i++) if (inside[i]) { mean += lum[i]; count++; }
	mean /= Math.max(count, 1);
	for (let i = 0; i < w * h; i++) if (!inside[i]) lum[i] = mean;
	const folds = blur(lum, w, h, 3);
	const light = blur(lum, w, h, 28);
	const band = new Float32Array(w * h);
	let peak = 1e-4;
	for (let i = 0; i < w * h; i++) {
		band[i] = inside[i] ? folds[i] - light[i] : 0;
		peak = Math.max(peak, Math.abs(band[i]));
	}
	const out = Buffer.alloc(w * h);
	for (let i = 0; i < w * h; i++) out[i] = Math.round((0.5 + 0.5 * Math.max(-1, Math.min(1, band[i] / peak))) * 255);
	await sharp(out, { raw: { width: w, height: h, channels: 1 } }).webp({ lossless: true }).toFile(file);
}

/** An image's garment, cropped to its own outline plus a margin. */
async function cropToGarment(path) {
	const a = await alphaBox(path);
	const margin = 12;
	const left = Math.max(0, a.x0 - margin);
	const top = Math.max(0, a.y0 - margin);
	const right = Math.min(a.width - 1, a.x1 + margin);
	const bottom = Math.min(a.height - 1, a.y1 + margin);
	const box = { left, top, width: right - left + 1, height: bottom - top + 1 };
	return { box, buffer: await sharp(path).extract(box).png().toBuffer() };
}

// Every output shares one size, set by the front: the back is fitted to the
// same frame, so the two outlines register when the cloth turns round.
const WIDTH = 1152;
const front = await cropToGarment(frontPath);
const back = await cropToGarment(backPath);
const HEIGHT = Math.round((WIDTH * front.box.height) / front.box.width);

for (const [side, crop] of [['front', front], ['back', back]]) {
	const fitted = await sharp(crop.buffer).resize(WIDTH, HEIGHT, { fit: 'fill' }).png().toBuffer();
	await sharp(fitted).webp({ quality: 90, alphaQuality: 95, effort: 6 }).toFile(`${outDir}/tee-${side}.webp`);
	await normalMap(fitted, `${outDir}/tee-${side}-normal.webp`);
	await heightMap(fitted, `${outDir}/tee-${side}-height.webp`);
}
console.log(`cutouts ${WIDTH}×${HEIGHT} (front cropped ${front.box.width}×${front.box.height}, back ${back.box.width}×${back.box.height})`);
