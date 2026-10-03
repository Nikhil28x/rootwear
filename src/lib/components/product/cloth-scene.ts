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
 * This module is only ever imported dynamically, in the browser, after the
 * photograph has painted — three.js never sits on the critical path.
 */
import * as THREE from 'three';

export type ClothScene = {
	/** Fires once the first frame is on the canvas. */
	ready: Promise<void>;
	destroy(): void;
};

/** Mask resolution across the tee's width. Higher = finer silhouette, more vertices. */
const GRID = 150;
/** World width of the tee. Height follows the photograph's aspect. */
const WIDTH = 2;
/** How far the body is pillowed out, front and back, in world units. */
const DEPTH = 0.13;
/** Distance from the edge, in mask cells, at which the pillow reaches full depth. */
const PLATEAU = 22;
/** Turn limits — the back is not photographed. */
const MAX_YAW = 0.75;
const MAX_PITCH = 0.32;

const VERTEX_HEAD = /* glsl */ `
	uniform float uTime;
	uniform float uWind;
	uniform vec4 uRipple; // xy: point in object space, z: start time, w: strength
	uniform float uSide;  // +1 front, -1 back
	uniform float uTop;   // object-space y of the collar
	uniform float uCrumple; // entry shake-out, 1 → 0

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

		float age = uTime - uRipple.z;
		if (age > 0.0 && uRipple.w > 0.0) {
			float r = distance(p, uRipple.xy);
			d += uRipple.w * 0.075 * exp(-age * 1.5) * exp(-r * 1.6) * sin(r * 15.0 - age * 10.0);
		}
		return d;
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
function surfaceMapsFromImage(image: HTMLImageElement, maxWidth = 1024) {
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
				}`
			)
			.replace(
				'#include <begin_vertex>',
				/* glsl */ `#include <begin_vertex>
				transformed.z += clothDisp(position.xy);`
			);
		// The entry dissolve: the cloth materialises from the collar down
		// through a noise field, its leading edge glowing the brand's gold.
		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				/* glsl */ `#include <common>
				uniform float uReveal;
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

export async function mountCloth(
	canvas: HTMLCanvasElement,
	image: HTMLImageElement,
	{ reducedMotion = false, intro = false }: { reducedMotion?: boolean; intro?: boolean } = {}
): Promise<ClothScene> {
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

	const uniforms: Record<string, THREE.IUniform> = {
		uTime: { value: 0 },
		uWind: { value: 1 },
		uRipple: { value: new THREE.Vector4(0, 0, -100, 0) },
		uTop: { value: top },
		uCrumple: { value: intro ? 1 : 0 },
		uReveal: { value: intro ? 0 : 1 }
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
	const entry = intro
		? { y: 0.36, vy: -0.4, roll: -0.55, vroll: 1.2, scale: 0.84, vscale: 0 }
		: { y: 0, vy: 0, roll: 0, vroll: 0, scale: 1, vscale: 0 };
	if (intro) {
		spring.yaw = 0.55;
		spring.vyaw = -2.6;
		spring.pitch = -0.18;
	}
	let entryAge = intro ? 0 : Infinity;
	let landed = !intro;
	const lean = { yaw: 0, pitch: 0 };
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
		uniforms.uRipple.value.set(local.x, local.y, clock, strength);
		return true;
	}

	function onPointerDown(event: PointerEvent) {
		if (!ripple(event, 1)) return;
		dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: target.yaw, pitch: target.pitch };
		canvas.setPointerCapture(event.pointerId);
		canvas.style.cursor = 'grabbing';
	}
	function onPointerMove(event: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		if (dragging && event.pointerId === dragging.id) {
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
				return;
			}
			lean.yaw = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1) * 0.22;
			lean.pitch = THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1) * 0.1;
		}
	}
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
		const dt = Math.min((now - last) / 1000, 1 / 20);
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
				uniforms.uRipple.value.set(0, top * 0.72, clock, 1.7);
			}
			uniforms.uReveal.value = Math.min(1, entryAge / 1.05);
			uniforms.uCrumple.value = Math.exp(-entryAge * 1.7);
		}

		piece.position.y = entry.y;
		piece.scale.setScalar(entry.scale);
		piece.rotation.set(spring.pitch, spring.yaw, entry.roll + spring.yaw * -0.06);
		// Turning fast stirs the cloth.
		const stir = Math.min(Math.abs(spring.vyaw) * 1.8 + Math.abs(spring.vpitch) * 1.2, 2.2);
		const gust = 0.85 + Math.sin(clock * 0.31) * 0.25 + Math.sin(clock * 0.83) * 0.12;
		const entryGust = entryAge < 6 ? 3.2 * Math.exp(-entryAge * 1.4) : 0;
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
		destroy() {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			visibility.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
			canvas.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerUp);
			canvas.removeEventListener('pointerleave', onPointerLeave);
			front.geometry.dispose();
			back.geometry.dispose();
			(frontMesh.material as THREE.Material).dispose();
			(backMesh.material as THREE.Material).dispose();
			texture.dispose();
			surface?.normalMap.dispose();
			surface?.roughnessMap.dispose();
			renderer.dispose();
		}
	};
}
