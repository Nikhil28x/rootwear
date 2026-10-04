/**
 * The hero tee in 3D — built from the product's own cutout photograph.
 *
 * There is no garment model to load. The cutout PNG already knows the tee's
 * silhouette (its alpha) and its exact look (its pixels), so the mesh is grown
 * from it: the silhouette is triangulated on a grid, then inflated by its
 * distance from the edge into a soft, pillowed garment, front and back. The
 * photograph is the front's texture, so the 3D piece is the real piece.
 *
 * Motion is done on the GPU in the vertex shader, layered over three.js's
 * standard material so the lighting stays physically based:
 *   - wind: a few travelling waves, stronger toward the hem than the collar;
 *   - ripple: a tap sends a decaying ring through the cloth from that point;
 *   - flutter: how fast the piece is being turned feeds the wind, so a hard
 *     flick makes the hem move more — the cloth answers the hand.
 * Normals are re-derived from the displacement, so the folds catch light.
 *
 * The turn is a damped spring: drag sets the target, release lets it settle
 * back with a little overshoot, and at rest it leans toward the pointer. The
 * yaw is capped because only the front is photographed — turning all the way
 * round would show a back this piece does not have.
 *
 * Two entrances, depending on what the viewer has already seen:
 *   - dissolve: nothing but the placeholder sketch is on screen, so the cloth
 *     materialises from the collar down, tumbling in onto its hanger;
 *   - puff: the photograph is already showing, so the piece starts as a flat
 *     card exactly where the photo sits (lit flat, no wind) and inflates into
 *     cloth from the chest outward — the photo itself seems to fill with air.
 *
 * This module is only ever imported dynamically, in the browser —
 * three.js never sits on the page's critical path.
 */
import * as THREE from 'three';

export type ClothScene = {
	/** Fires once the first frame is on the canvas. */
	ready: Promise<void>;
	/** Starts a held entrance (the puff waits for this, frozen flat). */
	reveal(): void;
	destroy(): void;
};

/** Mask resolution across the tee's width. Higher = finer silhouette, more vertices. */
const GRID = 150;
/** World width of the tee. Height follows the photograph's aspect. */
const WIDTH = 2;
/** How far the body is pillowed out, front and back, in world units. */
const DEPTH = 0.25;
/** Distance from the edge, in mask cells, at which the pillow reaches full depth. */
const PLATEAU = 22;
/** How many ripples can run at once. More slots = longer wakes, more GPU work. */
const RIPPLES = 10;

/* ---- Ripple tuning. Every touch, click and pointer wake uses these. ---- */
/** Height of a ripple. 0.04 was subtle; raise for a bolder wave. */
const RIPPLE_INTENSITY = 0.055;
/** Rings per unit of cloth: higher = tighter, more frequent rings. */
const RIPPLE_DENSITY = 22;
/** How fast a ripple fades with distance: higher = smaller impact radius. */
const RIPPLE_FALLOFF = 2.8;
/** Seconds a ripple runs before its slot is free again. */
const RIPPLE_LIFE = 3;
/** How strongly a passing ring swells the folds it crosses. */
const RIPPLE_SWELL = 0.032;
/** Pixels the pointer must travel between wake ripples: lower = denser wake. */
const RIPPLE_SPACING = 18;

/* ---- Body motion. ---- */
/** How far the piece drifts toward the pointer on hover, in world units. */
const HOVER_DRIFT = 0.07;
/** How hard a scroll kicks the piece: world units per pixel scrolled. */
const SCROLL_KICK = 0.0006;
/** The bounce: stiffness and damping ratio of the spring that brings it home. */
const BOUNCE_STIFFNESS = 70;
const BOUNCE_DAMPING = 0.48;
/** How far a scroll turns the piece about its vertical axis. */
const SCROLL_TILT = 2;
/** Turn limits — the back is not photographed. */
const MAX_YAW = 0.75;
const MAX_PITCH = 0.32;

/* ---- The puff entrance. ---- */
/** The puff waits this long after the swap, so the flat card is on screen first. */
const PUFF_DELAY = 0.12;
/**
 * The zoom as it fills: a kick to the scale spring. ~0.85 swells it about
 * 8% at the peak (a fifth of a second in), then it settles with a small dip.
 */
const PUFF_ZOOM = 0.85;
/** Seconds the air takes to spread from the chest to the hem and sleeve ends. */
const PUFF_FILL = 1.1;

const VERTEX_HEAD = /* glsl */ `
	uniform float uTime;
	uniform float uWind;
	// Up to RIPPLES at once. xy: point in object space, z: start time, w: strength.
	uniform vec4 uRipples[${RIPPLES}];
	// The garment's fold relief (0.5 = flat), from the photograph.
	uniform sampler2D uFoldMap;
	uniform vec2 uSize;
	uniform float uSide;  // +1 front, -1 back
	uniform float uTop;   // object-space y of the collar
	uniform float uCrumple; // entry shake-out, 1 → 0
	uniform float uPuff;    // inflation, 0 (flat photo) → 1 (full pillow)
	uniform float uFront;   // how far the air has spread from the chest, 0 → 1
	varying float vPuff;

	float foldAt(vec2 p) {
		return texture2D(uFoldMap, p / uSize + 0.5).r * 2.0 - 1.0;
	}

	float clothDisp(vec2 p) {
		// More give toward the hem and the sleeve ends than at the collar.
		float fromTop = clamp((uTop - p.y) / (uTop * 2.0), 0.0, 1.0);
		float freedom = 0.18 + fromTop * fromTop * 1.25 + abs(p.x) * 0.22;

		float wave =
			sin(p.x * 2.4 + uTime * 1.25) * 0.5 +
			sin(p.y * 3.3 - uTime * 1.7 + p.x * 1.4) * 0.32 +
			sin((p.x - p.y) * 6.2 + uTime * 2.6) * 0.12;
		float d = wave * 0.03 * freedom * uWind;

		// The entry: cloth shaking itself out, fast and creased, dying away.
		d += uCrumple * 0.085 * (
			sin(p.x * 7.3 + uTime * 9.0) * sin(p.y * 6.1 - uTime * 7.0) +
			0.5 * sin((p.x + p.y) * 11.0 + uTime * 13.0)
		) * (0.4 + freedom);

		// Ripples that travel the garment's own relief: slower over a fold's
		// ridge and faster through its hollow, so a ring bends along the folds;
		// ridges lift more than hollows; and as a ring passes, the folds it
		// crosses swell for a moment, as if the cloth were pushed.
		float h = foldAt(p);
		float swell = 0.0;
		for (int i = 0; i < ${RIPPLES}; i++) {
			vec4 r = uRipples[i];
			float age = uTime - r.z;
			if (age > 0.0 && age < ${RIPPLE_LIFE.toFixed(1)} && r.w > 0.0) {
				float dist = distance(p, r.xy);
				float travel = dist * (1.0 + 0.6 * h);
				float env = exp(-age * 1.5) * exp(-dist * ${RIPPLE_FALLOFF.toFixed(3)});
				float lift = 0.5 + 0.95 * smoothstep(-0.6, 0.8, h);
				d += r.w * ${RIPPLE_INTENSITY.toFixed(4)} * lift * env * sin(travel * ${RIPPLE_DENSITY.toFixed(1)} - age * 11.0);
				float ring = travel - age * 0.82;
				swell += r.w * env * exp(-ring * ring * 7.0);
			}
		}
		d += h * ${RIPPLE_SWELL.toFixed(4)} * swell;
		return d;
	}

	// How inflated this point is: the air spreads from the chest outward,
	// reaching the shoulders, then the sleeve ends and the hem.
	float puffAt(vec2 p) {
		float k = clamp(distance(p, vec2(0.0, uTop * 0.3)) / (length(uSize) * 0.55), 0.0, 1.0);
		float w = 0.35;
		return uPuff * smoothstep(k, k + w, clamp(uFront, 0.0, 1.0) * (1.0 + w));
	}
`;

function maskFromImage(image: HTMLImageElement) {
	const cols = GRID;
	const rows = Math.round((GRID * image.naturalHeight) / image.naturalWidth);
	const canvas = document.createElement('canvas');
	canvas.width = cols;
	canvas.height = rows;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error('2d context unavailable');
	context.drawImage(image, 0, 0, cols, rows);
	const { data } = context.getImageData(0, 0, cols, rows);

	// `cover` is generous so the mesh fully covers the alpha edge (the texture's
	// own alpha then cuts the exact silhouette); `solid` drives the inflation.
	const cover = new Uint8Array(cols * rows);
	const distance = new Float32Array(cols * rows);
	for (let index = 0; index < cols * rows; index++) {
		const alpha = data[index * 4 + 3];
		cover[index] = alpha > 6 ? 1 : 0;
		distance[index] = alpha > 140 ? 1e6 : 0;
	}

	// Grow the cover two cells past the alpha edge: vertices sit at cell
	// centres, so without this the outermost half-cell — where the texture's
	// own edge falls — would be left uncovered and show as stair-steps.
	for (let pass = 0; pass < 2; pass++) {
		const grown = cover.slice();
		for (let y = 1; y < rows - 1; y++) {
			for (let x = 1; x < cols - 1; x++) {
				const index = y * cols + x;
				if (cover[index]) continue;
				if (cover[index - 1] || cover[index + 1] || cover[index - cols] || cover[index + cols]) {
					grown[index] = 1;
				}
			}
		}
		cover.set(grown);
	}

	// Two-pass chamfer distance transform: distance of each solid cell to the edge.
	const at = (x: number, y: number) => distance[y * cols + x];
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const index = y * cols + x;
			if (distance[index] === 0) continue;
			let best = distance[index];
			if (x > 0) best = Math.min(best, at(x - 1, y) + 1);
			if (y > 0) best = Math.min(best, at(x, y - 1) + 1);
			if (x > 0 && y > 0) best = Math.min(best, at(x - 1, y - 1) + 1.414);
			if (x < cols - 1 && y > 0) best = Math.min(best, at(x + 1, y - 1) + 1.414);
			distance[index] = best;
		}
	}
	for (let y = rows - 1; y >= 0; y--) {
		for (let x = cols - 1; x >= 0; x--) {
			const index = y * cols + x;
			if (distance[index] === 0) continue;
			let best = distance[index];
			if (x < cols - 1) best = Math.min(best, at(x + 1, y) + 1);
			if (y < rows - 1) best = Math.min(best, at(x, y + 1) + 1);
			if (x < cols - 1 && y < rows - 1) best = Math.min(best, at(x + 1, y + 1) + 1.414);
			if (x > 0 && y < rows - 1) best = Math.min(best, at(x - 1, y + 1) + 1.414);
			distance[index] = best;
		}
	}

	return { cols, rows, cover, distance };
}

/** One shell of the garment. `side` +1 is the front, −1 the back. */
function shellGeometry(mask: ReturnType<typeof maskFromImage>, side: 1 | -1) {
	const { cols, rows, cover, distance } = mask;
	const height = (WIDTH * rows) / cols;
	const positions: number[] = [];
	const uvs: number[] = [];
	const indexOf = new Int32Array(cols * rows).fill(-1);

	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const cell = y * cols + x;
			if (!cover[cell]) continue;
			const u = (x + 0.5) / cols;
			const v = 1 - (y + 0.5) / rows;
			const t = Math.min(distance[cell] / PLATEAU, 1);
			// Smoothstep: zero slope at the outline, so front and back close
			// tightly there and no stair-stepped edge shows when it turns.
			const puff = t * t * (3 - 2 * t);
			indexOf[cell] = positions.length / 3;
			positions.push((u - 0.5) * WIDTH, (v - 0.5) * height, side * DEPTH * puff);
			uvs.push(u, v);
		}
	}

	const indices: number[] = [];
	for (let y = 0; y < rows - 1; y++) {
		for (let x = 0; x < cols - 1; x++) {
			const a = indexOf[y * cols + x];
			const b = indexOf[y * cols + x + 1];
			const c = indexOf[(y + 1) * cols + x];
			const d = indexOf[(y + 1) * cols + x + 1];
			if (a < 0 || b < 0 || c < 0 || d < 0) continue;
			// Rows run top to bottom, so this winding faces +z; the back flips it.
			if (side === 1) indices.push(a, c, b, b, c, d);
			else indices.push(a, b, c, b, d, c);
		}
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return { geometry, height };
}

/**
 * Surface maps grown from the photograph, so any cutout gets real knit relief
 * without an authored texture set.
 *
 * The photo's brightness is read as height, but only its FINE detail: a box
 * blur is subtracted first (a high-pass), which keeps the waffle knit, the rib
 * and the embroidery and drops the broad shading the photo was lit with —
 * otherwise the baked light would be read as hills and lit a second time.
 * A Sobel pass turns that height into a tangent-space normal map; the same
 * height drives a roughness map, so raised threads are a touch duller than
 * the hollows between them.
 */
function surfaceMapsFromImage(image: HTMLImageElement, maxWidth = 640) {
	const scale = Math.min(1, maxWidth / image.naturalWidth);
	const w = Math.round(image.naturalWidth * scale);
	const h = Math.round(image.naturalHeight * scale);
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error('2d context unavailable');
	context.drawImage(image, 0, 0, w, h);
	const source = context.getImageData(0, 0, w, h);
	const px = source.data;

	const lum = new Float32Array(w * h);
	for (let i = 0; i < w * h; i++) {
		lum[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
	}

	// Separable box blur via running sums; radius ~ a few knit cells.
	const radius = 5;
	const tmp = new Float32Array(w * h);
	const low = new Float32Array(w * h);
	for (let y = 0; y < h; y++) {
		let sum = 0;
		for (let x = -radius; x <= radius; x++) sum += lum[y * w + Math.min(w - 1, Math.max(0, x))];
		for (let x = 0; x < w; x++) {
			tmp[y * w + x] = sum / (2 * radius + 1);
			const add = Math.min(w - 1, x + radius + 1);
			const drop = Math.max(0, x - radius);
			sum += lum[y * w + add] - lum[y * w + drop];
		}
	}
	for (let x = 0; x < w; x++) {
		let sum = 0;
		for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
		for (let y = 0; y < h; y++) {
			low[y * w + x] = sum / (2 * radius + 1);
			const add = Math.min(h - 1, y + radius + 1);
			const drop = Math.max(0, y - radius);
			sum += tmp[add * w + x] - tmp[drop * w + x];
		}
	}

	const height = new Float32Array(w * h);
	for (let i = 0; i < w * h; i++) height[i] = px[i * 4 + 3] > 8 ? lum[i] - low[i] : 0;

	const normal = context.createImageData(w, h);
	const rough = context.createImageData(w, h);
	const strength = 3;
	const at = (x: number, y: number) =>
		height[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = y * w + x;
			// Sobel. Rows run downward while tangent-space v runs up, hence +gy.
			const gx =
				at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
				at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
			const gy =
				at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
				at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
			let nx = -gx * strength;
			let ny = gy * strength;
			let nz = 1;
			const length = Math.hypot(nx, ny, nz);
			nx /= length;
			ny /= length;
			nz /= length;
			normal.data[i * 4] = (nx * 0.5 + 0.5) * 255;
			normal.data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255;
			normal.data[i * 4 + 2] = (nz * 0.5 + 0.5) * 255;
			normal.data[i * 4 + 3] = 255;

			// Roughness lives in the green channel for three.js.
			const r = Math.min(1, Math.max(0, 0.86 + height[i] * 1.6)) * 255;
			rough.data[i * 4] = r;
			rough.data[i * 4 + 1] = r;
			rough.data[i * 4 + 2] = r;
			rough.data[i * 4 + 3] = 255;
		}
	}

	const toTexture = (data: ImageData) => {
		const out = document.createElement('canvas');
		out.width = w;
		out.height = h;
		out.getContext('2d')!.putImageData(data, 0, 0);
		const texture = new THREE.CanvasTexture(out);
		// Data, not colour: no sRGB decode.
		texture.colorSpace = THREE.NoColorSpace;
		return texture;
	};

	return { normalMap: toTexture(normal), roughnessMap: toTexture(rough) };
}

/**
 * The fold map: the photograph's MEDIUM-scale shape — folds, the hem's drape,
 * the creases at the sleeves — as height. A band-pass of its brightness: a
 * soft blur keeps the folds and drops the knit, and subtracting a much wider
 * blur drops the studio's light falloff. Small, because it is read per
 * vertex, not per pixel.
 */
function foldMapFromImage(image: HTMLImageElement, width = 256) {
	const w = width;
	const h = Math.round((image.naturalHeight / image.naturalWidth) * w);
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error('2d context unavailable');
	context.drawImage(image, 0, 0, w, h);
	const px = context.getImageData(0, 0, w, h).data;

	const lum = new Float32Array(w * h);
	const inside = new Uint8Array(w * h);
	let mean = 0;
	let count = 0;
	for (let i = 0; i < w * h; i++) {
		lum[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
		inside[i] = px[i * 4 + 3] > 8 ? 1 : 0;
		if (inside[i]) {
			mean += lum[i];
			count++;
		}
	}
	// Outside the garment reads as its average, so the edge is not a cliff.
	mean /= Math.max(count, 1);
	for (let i = 0; i < w * h; i++) if (!inside[i]) lum[i] = mean;

	const blur = (src: Float32Array, radius: number) => {
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
	};
	const folds = blur(lum, 3);
	const light = blur(lum, 28);

	const band = new Float32Array(w * h);
	let peak = 1e-4;
	for (let i = 0; i < w * h; i++) {
		band[i] = inside[i] ? folds[i] - light[i] : 0;
		peak = Math.max(peak, Math.abs(band[i]));
	}
	const data = new Uint8Array(w * h * 4);
	for (let i = 0; i < w * h; i++) {
		const v = Math.round((0.5 + 0.5 * Math.max(-1, Math.min(1, band[i] / peak))) * 255);
		data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
		data[i * 4 + 3] = 255;
	}
	const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
	texture.colorSpace = THREE.NoColorSpace;
	texture.flipY = true;
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearFilter;
	texture.needsUpdate = true;
	return texture;
}

/** A flat fold map, for when the photograph cannot be read. */
function flatFoldMap() {
	const texture = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat);
	texture.needsUpdate = true;
	return texture;
}

function clothMaterial(
	texture: THREE.Texture,
	side: 1 | -1,
	uniforms: Record<string, THREE.IUniform>,
	backColor: THREE.Color,
	surface: ReturnType<typeof surfaceMapsFromImage> | null
) {
	// Physical, for sheen: the soft rim brightening cloth has at grazing angles.
	const material = new THREE.MeshPhysicalMaterial({
		map: texture,
		// The knit relief belongs to the photographed face only; on the back it
		// would show the chest embroidery embossed in mirror image.
		normalMap: side === 1 && surface ? surface.normalMap : null,
		normalScale: new THREE.Vector2(0.75, 0.75),
		roughnessMap: side === 1 && surface ? surface.roughnessMap : null,
		roughness: side === 1 && surface ? 1 : 0.92,
		sheen: 0.3,
		sheenRoughness: 0.8,
		sheenColor: new THREE.Color('#f3dfbf'),
		metalness: 0,
		alphaTest: 0.5,
		// With MSAA this turns the hard alpha cut into a smooth edge.
		alphaToCoverage: true,
		side: THREE.FrontSide
	});
	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, uniforms, {
			uSide: { value: side },
			uBackColor: { value: backColor }
		});
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
			.replace(
				'#include <beginnormal_vertex>',
				/* glsl */ `#include <beginnormal_vertex>
				{
					float e = 0.012;
					float dx = (clothDisp(position.xy + vec2(e, 0.0)) - clothDisp(position.xy - vec2(e, 0.0))) / (2.0 * e);
					float dy = (clothDisp(position.xy + vec2(0.0, e)) - clothDisp(position.xy - vec2(0.0, e))) / (2.0 * e);
					objectNormal = normalize(objectNormal + vec3(-dx, -dy, 0.0) * uSide * 1.6);
					// Flat, it is lit as flat as the photograph it replaces.
					objectNormal = normalize(mix(vec3(0.0, 0.0, uSide), objectNormal, clamp(puffAt(position.xy), 0.0, 1.0)));
				}`
			)
			.replace(
				'#include <begin_vertex>',
				/* glsl */ `#include <begin_vertex>
				{
					float lp = puffAt(position.xy);
					vPuff = lp;
					transformed.z = (transformed.z + clothDisp(position.xy)) * lp;
				}`
			);
		// The entry dissolve: the cloth materialises from the collar down
		// through a noise field, its leading edge glowing the brand's gold.
		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				/* glsl */ `#include <common>
				uniform float uReveal;
				varying float vPuff;
				float revealHash(vec2 p) {
					p = fract(p * vec2(123.34, 456.21));
					p += dot(p, p + 45.32);
					return fract(p.x * p.y);
				}
				float revealNoise(vec2 p) {
					vec2 i = floor(p);
					vec2 f = fract(p);
					vec2 u = f * f * (3.0 - 2.0 * f);
					return mix(
						mix(revealHash(i), revealHash(i + vec2(1.0, 0.0)), u.x),
						mix(revealHash(i + vec2(0.0, 1.0)), revealHash(i + vec2(1.0, 1.0)), u.x),
						u.y
					);
				}`
			)
			.replace(
				'#include <alphatest_fragment>',
				/* glsl */ `float revealGlow = 0.0;
				if (uReveal < 1.0) {
					vec2 ruv = vMapUv;
					float field =
						revealNoise(ruv * 9.0) * 0.32 +
						revealNoise(ruv * 26.0) * 0.18 +
						(1.0 - ruv.y) * 0.5;
					float edge = uReveal * 1.16 - 0.08;
					if (field > edge) diffuseColor.a = 0.0;
					revealGlow = smoothstep(0.07, 0.0, edge - field) * step(field, edge);
				}
				#include <alphatest_fragment>`
			)
			.replace(
				'#include <emissivemap_fragment>',
				/* glsl */ `#include <emissivemap_fragment>
				totalEmissiveRadiance += vec3(1.0, 0.74, 0.32) * revealGlow * 2.4;`
			)
			// Flat, it shows the photograph's own pixels, unlit, so it can take
			// the photo's place without a seam; the light comes in as it fills.
			.replace(
				'#include <opaque_fragment>',
				/* glsl */ `outgoingLight = mix(diffuseColor.rgb, outgoingLight, clamp(vPuff, 0.0, 1.0));
				#include <opaque_fragment>`
			);

		if (side === -1) {
			// The back keeps the photograph's alpha (so the silhouette matches)
			// but not its pixels — the chest print must not show through mirrored.
			shader.fragmentShader = shader.fragmentShader
				.replace('#include <common>', '#include <common>\nuniform vec3 uBackColor;')
				.replace(
					'#include <map_fragment>',
					'#include <map_fragment>\ndiffuseColor.rgb = uBackColor;'
				);
		}
	};
	return material;
}

export type ClothIntro = 'dissolve' | 'puff' | null;



export async function mountCloth(
	canvas: HTMLCanvasElement,
	image: HTMLImageElement,
	{ reducedMotion = false, intro = null }: { reducedMotion?: boolean; intro?: ClothIntro } = {}
): Promise<ClothScene> {
	const dissolve = intro === 'dissolve';
	const puffIn = intro === 'puff';
	if (!image.complete || !image.naturalWidth) {
		await new Promise<void>((resolve, reject) => {
			image.addEventListener('load', () => resolve(), { once: true });
			image.addEventListener('error', () => reject(new Error('image failed')), { once: true });
		});
	}

	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NoToneMapping;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

	const mask = maskFromImage(image);
	const texture = new THREE.Texture(image);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
	texture.needsUpdate = true;

	let surface: ReturnType<typeof surfaceMapsFromImage> | null = null;
	try {
		surface = surfaceMapsFromImage(image);
		surface.normalMap.anisotropy = texture.anisotropy;
	} catch (cause) {
		// Flat cloth still looks right; relief is a bonus.
		console.warn('[cloth] surface maps unavailable', cause);
	}

	const front = shellGeometry(mask, 1);
	const back = shellGeometry(mask, -1);
	const top = front.height / 2;

	let foldMap: THREE.DataTexture;
	try {
		foldMap = foldMapFromImage(image);
	} catch (cause) {
		console.warn('[cloth] fold map unavailable', cause);
		foldMap = flatFoldMap();
	}
	const ripples = Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0));
	/**
	 * Starts a ripple without cutting one short: it takes a slot whose ripple
	 * has run its course, or failing that the one with the least energy left.
	 * Ripples add together, so a moving pointer builds up a wake.
	 */
	function startRipple(x: number, y: number, strength: number) {
		let slot = 0;
		let weakest = Infinity;
		for (let i = 0; i < RIPPLES; i++) {
			const age = clock - ripples[i].z;
			if (age >= RIPPLE_LIFE || ripples[i].w <= 0) {
				slot = i;
				break;
			}
			const left = ripples[i].w * Math.exp(-age * 1.5);
			if (left < weakest) {
				weakest = left;
				slot = i;
			}
		}
		ripples[slot].set(x, y, clock, strength);
	}

	const uniforms: Record<string, THREE.IUniform> = {
		uTime: { value: 0 },
		uWind: { value: 1 },
		uRipples: { value: ripples },
		uFoldMap: { value: foldMap },
		uSize: { value: new THREE.Vector2(WIDTH, front.height) },
		uTop: { value: top },
		uCrumple: { value: dissolve ? 1 : 0 },
		uReveal: { value: dissolve ? 0 : 1 },
		uPuff: { value: puffIn ? 0 : 1 },
		uFront: { value: puffIn ? 0 : 1 }
	};
	const backColor = new THREE.Color('#b48d5d');

	const piece = new THREE.Group();
	const frontMesh = new THREE.Mesh(front.geometry, clothMaterial(texture, 1, uniforms, backColor, surface));
	const backMesh = new THREE.Mesh(back.geometry, clothMaterial(texture, -1, uniforms, backColor, surface));
	piece.add(frontMesh, backMesh);
	scene.add(piece);

	// The photograph is already lit, so the scene lights mostly flat and lets a
	// soft key from the upper left model the folds.
	scene.add(new THREE.HemisphereLight(0xfff6ea, 0x3a3020, 2.6));
	const key = new THREE.DirectionalLight(0xfff1dd, 1.1);
	key.position.set(-2.5, 3, 4);
	scene.add(key);
	const rim = new THREE.DirectionalLight(0xc9a554, 0.8);
	rim.position.set(3, 1, -2);
	scene.add(rim);

	/**
	 * Frame the piece so, at rest, it sits exactly where the photograph sat:
	 * the canvas is larger than the image (room to turn), so the mesh — which
	 * spans the whole image rectangle — fills image height / canvas height.
	 */
	function resize() {
		const { clientWidth: w, clientHeight: h } = canvas;
		if (!w || !h) return;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		const fill = image.clientHeight && h ? image.clientHeight / h : 0.78;
		camera.position.set(
			0,
			0,
			front.height / fill / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + DEPTH
		);
		camera.updateProjectionMatrix();
	}
	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(canvas);
	resize();

	/* ---- The turn: a damped spring toward a target the hand sets. */
	const spring = { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0 };
	const target = { yaw: 0, pitch: 0 };
	/**
	 * The entry, as springs rather than keyframes: it starts displaced —
	 * lifted, rolled, shrunk, twisted — and the same physics as the drag pulls
	 * it home, so it lands with a real bounce. Roll keeps the photographed
	 * face toward the viewer the whole way in.
	 */
	const entry = dissolve
		? { y: 0.36, vy: -0.4, roll: -0.55, vroll: 1.2, scale: 0.84, vscale: 0 }
		: { y: 0, vy: 0, roll: 0, vroll: 0, scale: 1, vscale: 0 };
	if (dissolve) {
		spring.yaw = 0.55;
		spring.vyaw = -2.6;
		spring.pitch = -0.18;
	}
	let entryAge = intro ? 0 : Infinity;
	let landed = !dissolve;
	/**
	 * The inflation, as an under-damped spring: it overfills a little and
	 * settles, like a breath. `breathed` marks the ring it sends through the
	 * cloth as it fills.
	 */
	const puff = { value: puffIn ? 0 : 1, velocity: 0 };
	let breathed = !puffIn;
	let inflating = false;
	let fillAge = 0;
	/** A puff holds still, flat, until reveal(): nothing may move unseen. */
	let held = puffIn;
	const lean = { yaw: 0, pitch: 0 };
	/** Where the piece sits: drifted toward the pointer, kicked by scrolling. */
	const body = { x: 0, y: 0, vx: 0, vy: 0, goalX: 0, goalY: 0 };
	/** A scroll also turns the piece about its vertical axis, sprung home. */
	const tip = { yaw: 0, vyaw: 0 };
	let dragging: { id: number; x: number; y: number; yaw: number; pitch: number } | null = null;

	const raycaster = new THREE.Raycaster();
	const ndc = new THREE.Vector2();
	let clock = 0;

	function ripple(event: PointerEvent, strength: number) {
		const rect = canvas.getBoundingClientRect();
		ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
		raycaster.setFromCamera(ndc, camera);
		const hit = raycaster.intersectObject(frontMesh, false)[0] ?? raycaster.intersectObject(backMesh, false)[0];
		if (!hit) return false;
		const local = piece.worldToLocal(hit.point.clone());
		startRipple(local.x, local.y, strength);
		return true;
	}

	function onPointerDown(event: PointerEvent) {
		if (!ripple(event, 1)) return;
		dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: target.yaw, pitch: target.pitch };
		canvas.setPointerCapture(event.pointerId);
		canvas.style.cursor = 'grabbing';
	}
	/** The last trail ripple, so a moving pointer leaves a wake, not a flood. */
	let trail = { t: 0, x: 0, y: 0 };
	function wake(event: PointerEvent, base: number) {
		const now = performance.now();
		const moved = Math.hypot(event.clientX - trail.x, event.clientY - trail.y);
		// By distance, not time: one ripple per stretch of travel, so a slow
		// pass and a fast one leave the same even wake.
		if (moved < RIPPLE_SPACING || now - trail.t < 40) return;
		const speed = moved / Math.max(now - trail.t, 16);
		if (ripple(event, Math.min(base * (0.5 + speed), base * 1.6))) {
			trail = { t: now, x: event.clientX, y: event.clientY };
		}
	}

	function onPointerMove(event: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		if (dragging && event.pointerId === dragging.id) {
			wake(event, 0.35);
			target.yaw = THREE.MathUtils.clamp(dragging.yaw + (event.clientX - dragging.x) * 0.006, -MAX_YAW, MAX_YAW);
			target.pitch = THREE.MathUtils.clamp(dragging.pitch + (event.clientY - dragging.y) * 0.004, -MAX_PITCH, MAX_PITCH);
			return;
		}
		if (event.pointerType === 'mouse') {
			// Lean only while the pointer is over the piece. Measured against a
			// canvas scrolled far off screen, the offset is huge — and it once
			// flipped the tee right over to its unphotographed back.
			const inside =
				visible &&
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom;
			if (!inside) {
				lean.yaw = 0;
				lean.pitch = 0;
				body.goalX = 0;
				body.goalY = 0;
				return;
			}
			if (!reducedMotion) wake(event, 0.12);
			lean.yaw = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1) * 0.22;
			lean.pitch = THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1) * 0.1;
			// Drift toward the pointer, on both axes.
			body.goalX = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1) * HOVER_DRIFT;
			body.goalY = -THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1) * HOVER_DRIFT * 0.7;
		}
	}

	/**
	 * Scrolling kicks the piece: it lags against the direction of travel and
	 * the bounce spring brings it home with an overshoot or two — the same
	 * either way you scroll. A hard flick also stirs the cloth.
	 */
	let lastScroll = window.scrollY;
	function onScroll() {
		const delta = window.scrollY - lastScroll;
		lastScroll = window.scrollY;
		if (!visible || reducedMotion) return;
		const kick = THREE.MathUtils.clamp(delta * SCROLL_KICK, -0.12, 0.12);
		body.vy += kick * 9;
		// Turn about its vertical axis with the motion: scrolling down swings it
		// one way, up the other, and the spring brings it back to face front.
		tip.vyaw += kick * SCROLL_TILT * 1;
	}
	window.addEventListener('scroll', onScroll, { passive: true });
	function onPointerUp(event: PointerEvent) {
		if (!dragging || event.pointerId !== dragging.id) return;
		dragging = null;
		canvas.style.cursor = '';
		// Let go: the spring carries it home, overshooting a little.
		target.yaw = 0;
		target.pitch = 0;
	}
	function onPointerLeave() {
		lean.yaw = 0;
		lean.pitch = 0;
		body.goalX = 0;
		body.goalY = 0;
	}
	canvas.addEventListener('pointerdown', onPointerDown);
	window.addEventListener('pointermove', onPointerMove, { passive: true });
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('pointercancel', onPointerUp);
	canvas.addEventListener('pointerleave', onPointerLeave);

	/* ---- Only animate while the hero is on screen and the tab is visible. */
	let visible = true;
	const visibility = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (!visible) {
			lean.yaw = 0;
			lean.pitch = 0;
		}
		if (visible) loop();
	});
	visibility.observe(canvas);

	let frame = 0;
	let last = performance.now();
	let firstFrame: () => void = () => {};
	const ready = new Promise<void>((resolve) => (firstFrame = resolve));

	function step(now: number) {
		const dt = held ? 0 : Math.min((now - last) / 1000, 1 / 20);
		last = now;
		clock += reducedMotion ? 0 : dt;

		// Idle sway plus a lean toward the pointer, unless a hand has hold of it.
		const idle = reducedMotion ? 0 : Math.sin(clock * 0.45) * 0.1;
		const goalYaw = THREE.MathUtils.clamp(
			dragging ? target.yaw : target.yaw + lean.yaw + idle,
			-MAX_YAW,
			MAX_YAW
		);
		const goalPitch = THREE.MathUtils.clamp(
			dragging ? target.pitch : target.pitch + lean.pitch,
			-MAX_PITCH,
			MAX_PITCH
		);

		// Slightly under-damped: it settles with a small overshoot, like cloth on a hanger.
		const stiffness = dragging ? 160 : 34;
		const damping = dragging ? 2 * Math.sqrt(stiffness) : 2 * Math.sqrt(stiffness) * 0.42;
		spring.vyaw += (stiffness * (goalYaw - spring.yaw) - damping * spring.vyaw) * dt;
		spring.vpitch += (stiffness * (goalPitch - spring.pitch) - damping * spring.vpitch) * dt;
		spring.yaw += spring.vyaw * dt;
		spring.pitch += spring.vpitch * dt;

		// Hard stop just past the limits (room for the spring's overshoot), so
		// no input, however odd, can ever turn the photographed front away.
		const yawStop = MAX_YAW + 0.12;
		const pitchStop = MAX_PITCH + 0.08;
		if (Math.abs(spring.yaw) > yawStop) {
			spring.yaw = Math.sign(spring.yaw) * yawStop;
			spring.vyaw = 0;
		}
		if (Math.abs(spring.pitch) > pitchStop) {
			spring.pitch = Math.sign(spring.pitch) * pitchStop;
			spring.vpitch = 0;
		}

		if (entryAge < 6) {
			entryAge += dt;
			const pull = (value: number, velocity: number, k: number, ratio: number, goal: number) =>
				velocity + (k * (goal - value) - 2 * Math.sqrt(k) * ratio * velocity) * dt;
			entry.vy = pull(entry.y, entry.vy, 30, 0.3, 0);
			entry.vroll = pull(entry.roll, entry.vroll, 26, 0.42, 0);
			entry.vscale = pull(entry.scale, entry.vscale, 34, 0.5, 1);
			entry.y += entry.vy * dt;
			entry.roll += entry.vroll * dt;
			entry.scale += entry.vscale * dt;

			// It catches on the hanger: a ring runs down from the collar.
			if (!landed && entry.y <= 0.004) {
				landed = true;
				startRipple(0, top * 0.72, 1.7);
			}
			if (dissolve) {
				uniforms.uReveal.value = Math.min(1, entryAge / 0.75);
				uniforms.uCrumple.value = Math.exp(-entryAge * 1.7);
			}
			if (puffIn && entryAge > PUFF_DELAY) {
				if (!inflating) {
					inflating = true;
					entry.vscale += PUFF_ZOOM;
				}
				fillAge += dt;
				uniforms.uFront.value = Math.min(fillAge / PUFF_FILL, 1);
				puff.velocity = pull(puff.value, puff.velocity, 38, 0.36, 1);
				puff.value += puff.velocity * dt;
				uniforms.uPuff.value = Math.max(0, puff.value);
				if (!breathed && puff.value > 0.85) {
					breathed = true;
					startRipple(0, top * 0.1, 1.3);
				}
			}
		} else {
			uniforms.uPuff.value = 1;
			uniforms.uFront.value = 1;
		}

		// The body springs toward its goal: under-damped, so it bounces.
		const bounceDamp = 2 * Math.sqrt(BOUNCE_STIFFNESS) * BOUNCE_DAMPING;
		body.vx += (BOUNCE_STIFFNESS * (body.goalX - body.x) - bounceDamp * body.vx) * dt;
		body.vy += (BOUNCE_STIFFNESS * (body.goalY - body.y) - bounceDamp * body.vy) * dt;
		body.x += body.vx * dt;
		body.y += body.vy * dt;
		// Never far: a hard scroll cannot throw it out of frame.
		body.y = THREE.MathUtils.clamp(body.y, -0.22, 0.22);

		piece.position.x = body.x;
		piece.position.y = entry.y + body.y;
		// The camera frames the pillow's front (z = DEPTH) to the photograph's
		// size, so a flat card sits there too, and only its edges fall back as it fills.
		piece.position.z = DEPTH * (1 - THREE.MathUtils.clamp(uniforms.uPuff.value, 0, 1));
		piece.scale.setScalar(entry.scale);
		// The tilt springs home a little looser than the bounce, so it trails it.
		const tipK = BOUNCE_STIFFNESS * 0.7;
		const tipDamp = 2 * Math.sqrt(tipK) * 0.25;
		tip.vyaw += (-tipK * tip.yaw - tipDamp * tip.vyaw) * dt;
		// Capped well short of the unphotographed back.
		tip.yaw = THREE.MathUtils.clamp(tip.yaw + tip.vyaw * dt, -0.6, 0.6);
		const yaw = THREE.MathUtils.clamp(spring.yaw + tip.yaw, -(MAX_YAW + 0.12), MAX_YAW + 0.12);

		piece.rotation.set(spring.pitch, yaw, entry.roll + yaw * -0.06);
		// Turning fast stirs the cloth.
		const stir = Math.min(
			Math.abs(spring.vyaw) * 1.8 + Math.abs(spring.vpitch) * 1.2 + Math.abs(body.vy) * 2.2,
			2.6
		);
		const gust = 0.85 + Math.sin(clock * 0.31) * 0.25 + Math.sin(clock * 0.83) * 0.12;
		const entryGust = entryAge < 6 ? (dissolve ? 3.2 : 1.6) * Math.exp(-entryAge * 1.4) : 0;
		uniforms.uWind.value = reducedMotion ? 0.4 : gust + stir + entryGust;
		uniforms.uTime.value = clock;

		renderer.render(scene, camera);
	}

	function loop() {
		cancelAnimationFrame(frame);
		last = performance.now();
		const tick = (now: number) => {
			step(now);
			firstFrame();
			if (visible && !document.hidden) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
	}
	const onVisibility = () => {
		if (!document.hidden && visible) loop();
	};
	document.addEventListener('visibilitychange', onVisibility);
	loop();

	return {
		ready,
		reveal() {
			held = false;
		},
		destroy() {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			visibility.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
			canvas.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerUp);
			canvas.removeEventListener('pointerleave', onPointerLeave);
			front.geometry.dispose();
			back.geometry.dispose();
			(frontMesh.material as THREE.Material).dispose();
			(backMesh.material as THREE.Material).dispose();
			texture.dispose();
			foldMap.dispose();
			surface?.normalMap.dispose();
			surface?.roughnessMap.dispose();
			renderer.dispose();
		}
	};
}
