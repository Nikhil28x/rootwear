/**
 * The hero tee: a real garment mesh, dressed in the photographed cloth.
 *
 * The mesh is a Marvelous Designer simulation of an oversized drop-shoulder
 * tee (static/models/tee-*.glb, see docs/tee-model.md), so its drape, folds,
 * collar and seams are real. What makes it this piece is read from the two
 * studio shots at runtime:
 *   - the cloth: its colour, and its waffle knit as relief — a patch of plain
 *     fabric cut from the front shot, laid over the whole garment by
 *     triplanar projection in object space (no dependence on the mesh's UVs);
 *   - the embroidery: only the stitching is lifted out of each photograph
 *     (pixels far from the cloth colour, away from the collar and outline),
 *     then projected like a decal — the front onto the chest, the back,
 *     mirrored, onto the upper back — registered by matching the photo's
 *     collar, hem and width to the mesh's own;
 *   - the rib: the collar's brown, sampled from the collar in the photo.
 * The inside of the cloth, seen through the hem, cuffs and neck, is the same
 * fabric in shadow.
 *
 * Motion is on the GPU, shared with the stage: a breeze that grows toward the
 * hem and cuffs, ripples from a touch, and a swing that trails the turn.
 */
import type { Garment, GarmentBuilder, ModeContext } from './core';
import { MOTION_GLSL, addRipple, applyMotion, applyPress, motionUniforms } from './core';

const MODELS = { full: '/models/tee-hi.glb', light: '/models/tee-low.glb' };

type Registration = {
	/** Photo-space (0..1, v up) of the garment's collar top and hem, and its hem half-width. */
	top: number;
	bottom: number;
	centre: number;
	half: number;
};

function pixels(image: HTMLImageElement, width: number) {
	const height = Math.round((image.naturalHeight / image.naturalWidth) * width);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d', { willReadFrequently: true })!;
	context.drawImage(image, 0, 0, width, height);
	return { canvas, context, data: context.getImageData(0, 0, width, height), width, height };
}

/** Where the garment sits in its photograph: collar top, hem, and hem width. */
function register(image: HTMLImageElement): Registration {
	const { data, width, height } = pixels(image, 256);
	const solid = (x: number, y: number) => data.data[(y * width + x) * 4 + 3] > 128;
	const mid = Math.floor(width / 2);
	let top = 0;
	let bottom = height - 1;
	while (top < height && !solid(mid, top)) top++;
	while (bottom > 0 && !solid(mid, bottom)) bottom--;
	// The hem's width, a little above its edge.
	const row = Math.round(bottom - (bottom - top) * 0.04);
	let left = 0;
	let right = width - 1;
	while (left < width && !solid(left, row)) left++;
	while (right > 0 && !solid(right, row)) right--;
	return {
		top: 1 - top / height,
		bottom: 1 - bottom / height,
		centre: (left + right) / 2 / width,
		half: (right - left) / 2 / width
	};
}

/**
 * The stitching alone, as a transparent decal: pixels whose colour is far
 * from the cloth's, kept inside the garment and below the collar band.
 */
function embroidery(image: HTMLImageElement, cloth: [number, number, number], reg: Registration) {
	const { canvas, context, data, width, height } = pixels(image, 1024);
	const px = data.data;
	// The surroundings of each pixel: the photo blurred wide. Stitching is a
	// sharp departure from it; the studio's soft shading is not, so it stays
	// on the photo and out of the decal.
	const blurred = document.createElement('canvas');
	blurred.width = width;
	blurred.height = height;
	const bctx = blurred.getContext('2d', { willReadFrequently: true })!;
	bctx.filter = 'blur(14px)';
	bctx.drawImage(image, 0, 0, width, height);
	const bg = bctx.getImageData(0, 0, width, height).data;
	const collarBand = (1 - reg.top) * height + (reg.top - reg.bottom) * height * 0.11;
	const hemBand = (1 - reg.bottom) * height - (reg.top - reg.bottom) * height * 0.05;
	const panelLeft = (reg.centre - reg.half * 0.84) * width;
	const panelRight = (reg.centre + reg.half * 0.84) * width;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			// Against the cloth colour for hue (the embroidery is never cream),
			// against the local surroundings for darkness (shading is gradual).
			const dr = px[i] - cloth[0];
			const dg = px[i + 1] - cloth[1];
			const db = px[i + 2] - cloth[2];
			const lum = (dr + dg + db) / 3;
			const chroma = Math.hypot(dr - lum, dg - lum, db - lum);
			const local = (px[i] + px[i + 1] + px[i + 2] - bg[i] - bg[i + 1] - bg[i + 2]) / 3;
			// Darkness must be a clear, local step (a stitch), not a knit hole or a fold.
			const ink = Math.max(chroma * 1.6 - 14, -local * 1.4 - 34);
			// A soft ramp: thin strokes (the script) keep their full colour.
			let a = Math.min(1, Math.max(0, (ink - 16) / 20));
			// Only inside the body panel: the side seams and armpits carry the
			// studio's shading, never stitching, and would smear at grazing angles.
			const inside =
				y > collarBand && y < hemBand && x > panelLeft && x < panelRight && px[i + 3] > 250;
			if (!inside) a = 0;
			px[i + 3] = Math.round(a * 255);
		}
	}
	context.putImageData(data, 0, 0);
	return canvas;
}

/**
 * The embroidery's normal map, baked from its decal at load. Thread sits
 * proud of the cloth and every stitch is a ridge, so height is:
 *   - the thread's coverage, softly blurred: the whole motif rises off the
 *     fabric with a bevelled edge, the way stitching padded over cloth does;
 *   - plus the stitches' own light and shade (a high-pass of brightness):
 *     each lit crest stands up, each shadowed gap between stitches sinks.
 * A Sobel pass turns height into a tangent-space normal (+u right, +v up),
 * stored in a mipmapped texture so it filters smoothly at every size.
 */
function threadNormalMap(THREE: ModeContext['THREE'], ink: HTMLCanvasElement) {
	const w = ink.width;
	const h = ink.height;
	const read = (filter: string) => {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const x = c.getContext('2d', { willReadFrequently: true })!;
		x.filter = filter;
		x.drawImage(ink, 0, 0);
		return x.getImageData(0, 0, w, h).data;
	};
	const sharp = read('none');
	const soft = read('blur(2.5px)');
	const wide = read('blur(4px)');
	const height = new Float32Array(w * h);
	for (let i = 0; i < w * h; i++) {
		const a = sharp[i * 4 + 3] / 255;
		const lum = (sharp[i * 4] + sharp[i * 4 + 1] + sharp[i * 4 + 2]) / 765;
		const lumWide = (wide[i * 4] + wide[i * 4 + 1] + wide[i * 4 + 2]) / 765;
		const bevel = soft[i * 4 + 3] / 255;
		height[i] = bevel * 0.8 + a * (lum - lumWide) * 1.6;
	}
	const out = new Uint8Array(w * h * 4);
	const at = (x: number, y: number) =>
		height[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
	const strength = 3.2;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
			// Rows run down the image; v runs up the texture.
			const gyUp = -(at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1));
			const nx = -gx * strength;
			const ny = -gyUp * strength;
			const len = Math.hypot(nx, ny, 1);
			// Image row y is texture row (h - 1 - y): DataTexture uploads rows bottom-up.
			const i = ((h - 1 - y) * w + x) * 4;
			out[i] = Math.round((nx / len * 0.5 + 0.5) * 255);
			out[i + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
			out[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
			out[i + 3] = 255;
		}
	}
	const texture = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
	texture.colorSpace = THREE.NoColorSpace;
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearMipmapLinearFilter;
	texture.generateMipmaps = true;
	texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
	texture.needsUpdate = true;
	return texture;
}

/** The average colour of plain cloth, and of the collar rib, in sRGB 0..255. */
function colours(image: HTMLImageElement, reg: Registration) {
	const { data, width, height } = pixels(image, 256);
	const px = data.data;
	const avg = (x0: number, x1: number, y0: number, y1: number, keep: (r: number, g: number, b: number) => boolean) => {
		let r = 0;
		let g = 0;
		let b = 0;
		let n = 0;
		for (let y = Math.round(y0 * height); y < Math.round(y1 * height); y++) {
			for (let x = Math.round(x0 * width); x < Math.round(x1 * width); x++) {
				const i = (y * width + x) * 4;
				if (px[i + 3] < 250 || !keep(px[i], px[i + 1], px[i + 2])) continue;
				r += px[i];
				g += px[i + 1];
				b += px[i + 2];
				n++;
			}
		}
		return n ? ([r / n, g / n, b / n] as [number, number, number]) : null;
	};
	const span = reg.top - reg.bottom;
	// Plain cloth: the lower body, either side of centre, below any print.
	const cloth = avg(reg.centre - reg.half * 0.8, reg.centre + reg.half * 0.8, 1 - reg.bottom - span * 0.3, 1 - reg.bottom - span * 0.08, () => true) ?? [215, 200, 178];
	// The rib: the darker, warmer pixels in the collar band.
	const rib =
		avg(reg.centre - reg.half * 0.5, reg.centre + reg.half * 0.5, 1 - reg.top, 1 - reg.top + span * 0.08, (r, g, b) => r + g + b < (cloth[0] + cloth[1] + cloth[2]) * 0.7) ??
		[130, 62, 32];
	return { cloth, rib };
}

/** A patch of plain knit from the photo, as a height texture that tiles (mirrored). */
function knitTile(THREE: ModeContext['THREE'], image: HTMLImageElement, reg: Registration) {
	const source = pixels(image, 1024);
	const size = 128;
	const span = reg.top - reg.bottom;
	// Lower left of the body: plain fabric, no print, no seam.
	const x0 = Math.round((reg.centre - reg.half * 0.62) * source.width);
	const y0 = Math.round((1 - reg.bottom - span * 0.24) * source.height);
	const patch = source.context.getImageData(x0, y0, size, size).data;
	const lum = new Float32Array(size * size);
	let mean = 0;
	for (let i = 0; i < size * size; i++) {
		lum[i] = (patch[i * 4] * 0.299 + patch[i * 4 + 1] * 0.587 + patch[i * 4 + 2] * 0.114) / 255;
		mean += lum[i];
	}
	mean /= size * size;
	// High-pass: keep the waffle cells, drop the studio light across the patch.
	const r = 3;
	const out = new Uint8Array(size * size * 4);
	const heightMap = new Float32Array(size * size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let s = 0;
			let n = 0;
			for (let k = -r; k <= r; k++) {
				for (let j = -r; j <= r; j++) {
					const yy = Math.min(size - 1, Math.max(0, y + k));
					const xx = Math.min(size - 1, Math.max(0, x + j));
					s += lum[yy * size + xx];
					n++;
				}
			}
			heightMap[y * size + x] = Math.max(0, Math.min(1, 0.5 + (lum[y * size + x] - s / n) * 3.2));
		}
	}
	/**
	 * RGB: a tangent-space normal map of the knit (Sobel of the height);
	 * A: the height itself. A real texture, so the GPU mipmaps and filters it:
	 * the relief fades smoothly with distance instead of shimmering.
	 */
	const at = (x: number, y: number) => heightMap[((y + size) % size) * size + ((x + size) % size)];
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
			const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
			const nx = -gx * 1.5;
			const ny = gy * 1.5;
			const len = Math.hypot(nx, ny, 1);
			const i = (y * size + x) * 4;
			out[i] = Math.round((nx / len * 0.5 + 0.5) * 255);
			out[i + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
			out[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
			out[i + 3] = Math.round(heightMap[y * size + x] * 255);
		}
	}
	const texture = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
	texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearMipmapLinearFilter;
	texture.generateMipmaps = true;
	texture.colorSpace = THREE.NoColorSpace;
	texture.anisotropy = 4;
	texture.needsUpdate = true;
	void mean;
	return { texture, pixels: size };
}

export const buildGarment: GarmentBuilder = async (context) => {
	const { THREE, renderer, front, back, height, tier } = context;
	const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
		import('three/examples/jsm/loaders/GLTFLoader.js'),
		import('three/examples/jsm/libs/meshopt_decoder.module.js')
	]);
	const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
	const gltf = await loader.loadAsync(tier === 2 ? MODELS.light : MODELS.full);

	// The model is centred at unit height. Worn, its sleeves hang rather than
	// spread, so it is set a little taller than the flat photograph to fill the
	// same width.
	const size = height * 1.2;
	const model = gltf.scene;
	model.scale.setScalar(size);
	model.updateMatrixWorld(true);
	const bounds = new THREE.Box3().setFromObject(model);
	const top = bounds.max.y;
	const span = bounds.max.y - bounds.min.y;

	// The mesh's hem width, to register the photographs against.
	let hemHalf = 0;
	const v = new THREE.Vector3();
	model.traverse((o) => {
		const mesh = o as import('three').Mesh;
		if (!mesh.isMesh || mesh.material && (mesh.material as import('three').Material).name !== 'body') return;
		const position = mesh.geometry.getAttribute('position');
		for (let i = 0; i < position.count; i++) {
			v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
			if (v.y < bounds.min.y + span * 0.06) hemHalf = Math.max(hemHalf, Math.abs(v.x));
		}
	});
	if (!hemHalf) hemHalf = (bounds.max.x - bounds.min.x) * 0.32;

	const frontReg = register(front);
	const backReg = register(back);
	const { cloth, rib } = colours(front, frontReg);
	const frontInkCanvas = embroidery(front, cloth, frontReg);
	const backInkCanvas = embroidery(back, cloth, backReg);
	const frontInk = new THREE.CanvasTexture(frontInkCanvas);
	const backInk = new THREE.CanvasTexture(backInkCanvas);
	// The stitches' relief, one normal map per side (see threadNormalMap).
	const frontThread = threadNormalMap(THREE, frontInkCanvas);
	const backThread = threadNormalMap(THREE, backInkCanvas);
	for (const t of [frontInk, backInk]) {
		t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
		t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
	}
	const knit = knitTile(THREE, front, frontReg);

	/**
	 * Photo uv = a + b · (x, y): the photo's collar top lands on the mesh's
	 * top, its hem on the mesh's hem, its hem width on the mesh's hem width.
	 */
	const mapping = (reg: Registration) =>
		new THREE.Vector4(
			reg.half / hemHalf, // u per unit x
			reg.centre, // u at x = 0
			(reg.top - reg.bottom) / span, // v per unit y
			reg.top - ((reg.top - reg.bottom) / span) * top // v at y = 0
		);
	// World size of one knit tile: the photo's own scale, carried over.
	const knitWorld = (knit.pixels / 1024 / frontReg.half) * hemHalf;

	const motion = motionUniforms(top, span);
	const srgb = (c: [number, number, number]) => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
	const shared = {
		...motion,
		uFrontInk: { value: frontInk },
		uBackInk: { value: backInk },
		uFrontThread: { value: frontThread },
		uBackThread: { value: backThread },
		uFrontMap: { value: mapping(frontReg) },
		uBackMap: { value: mapping(backReg) },
		uKnit: { value: knit.texture },
		uKnitScale: { value: 1 / knitWorld },
		uPoseRot: { value: new THREE.Matrix3() },
		uBump: { value: tier === 0 ? 0.62 : 0.45 }
	};

	/**
	 * Mesh space → the turning group's space. The GLB is quantised, so its
	 * positions are normalised and the real scale sits on its node: never
	 * assume `position` is in garment units, carry the matrix.
	 */
	let meshToPose = new THREE.Matrix4();
	model.traverse((o) => {
		if ((o as import('three').Mesh).isMesh) meshToPose = o.matrixWorld.clone();
	});
	const meshScale = meshToPose.getMaxScaleOnAxis();
	const vertexMotion = (shader: { vertexShader: string; uniforms: Record<string, unknown> }) => {
		shader.uniforms.uMeshToPose = { value: meshToPose };
		shader.vertexShader = shader.vertexShader
			.replace(
				'#include <common>',
				`#include <common>\nuniform mat4 uMeshToPose;\nattribute vec3 color;\nvarying vec3 vRest;\nvarying vec3 vRestNormal;\nvarying float vAO;\n${MOTION_GLSL}`
			)
			.replace(
				'#include <beginnormal_vertex>',
				/* glsl */ `#include <beginnormal_vertex>
				// Rest position and normal in the turning group's space.
				vRest = (uMeshToPose * vec4(position, 1.0)).xyz;
				vRestNormal = normalize(mat3(uMeshToPose) * normal);
				vAO = color.r;
				// Motion moves the cloth along ONE smooth field: outward from the body's
				// axis, by position alone. Never along each vertex's own normal: the
				// export stacks layers (allowances, facings) with normals both ways,
				// and anything per-vertex flips between neighbours and tears the mesh.
				// A field of position gives every layer at a spot the same push, and
				// neighbours nearly the same — nothing can cross or crack.
				vec3 clothOut = clothField(vRest);
				// The breeze and ripples bend the surface, so they bend its normal:
				// the gradient of the displacement, kept in the tangent plane.
				{
					float e = 0.01;
					vec3 g = vec3(
						clothWave(vRest + vec3(e, 0.0, 0.0)) - clothWave(vRest - vec3(e, 0.0, 0.0)),
						clothWave(vRest + vec3(0.0, e, 0.0)) - clothWave(vRest - vec3(0.0, e, 0.0)),
						clothWave(vRest + vec3(0.0, 0.0, e)) - clothWave(vRest - vec3(0.0, 0.0, e))
					) / (2.0 * e);
					g -= dot(g, vRestNormal) * vRestNormal;
					vec3 bent = normalize(vRestNormal - g * 0.45);
					bent = pressTilt(vRest, bent);
					// Group space and mesh space differ only by scale: the direction carries over.
					objectNormal = bent;
				}`
			)
			.replace(
				'#include <begin_vertex>',
				/* glsl */ `#include <begin_vertex>
				// Motion is computed in group space, then carried back into mesh units.
				transformed += clothOut * clothWave(vRest) * ${(0.8 / meshScale).toFixed(5)};
				transformed += clothSwing(vRest) * ${(1 / meshScale).toFixed(5)};
				transformed += clothPress(vRest, clothOut) * ${(1 / meshScale).toFixed(5)};`
			);
	};

	/**
	 * Knit relief, triplanar: the knit tile (normal in RGB, height in A) is
	 * cast along each axis of the garment and blended by which way the cloth
	 * faces. Every sample is a filtered, mipmapped texture read, so at any
	 * distance it averages out smoothly rather than aliasing; where a knit
	 * cell shrinks below a pixel or so, the relief fades out altogether.
	 * The perturbation is built in the garment's space and turned into view
	 * space with the pose's rotation (uPoseRot, set each frame).
	 */
	const KNIT_GLSL = /* glsl */ `
		uniform sampler2D uKnit;
		uniform float uKnitScale;
		uniform float uBump;
		uniform mat3 uPoseRot;
		varying vec3 vRest;
		varying vec3 vRestNormal;
		varying float vAO;
		vec3 knitWeights() {
			vec3 w = pow(abs(normalize(vRestNormal)), vec3(4.0));
			return w / (w.x + w.y + w.z);
		}
		// 1 where the knit is comfortably larger than a pixel, 0 where it is not.
		float knitDetail() {
			float footprint = length(fwidth(vRest * uKnitScale)) * 16.0; // knit cells per pixel
			return 1.0 - smoothstep(0.35, 0.8, footprint);
		}
		vec4 knitSample(vec3 w) {
			vec3 p = vRest * uKnitScale;
			return texture2D(uKnit, p.zy) * w.x + texture2D(uKnit, p.xz) * w.y + texture2D(uKnit, p.xy) * w.z;
		}
		vec3 knitNormal(vec3 n, vec3 w, float detail) {
			vec3 p = vRest * uKnitScale;
			vec2 tx = texture2D(uKnit, p.zy).xy * 2.0 - 1.0;
			vec2 ty = texture2D(uKnit, p.xz).xy * 2.0 - 1.0;
			vec2 tz = texture2D(uKnit, p.xy).xy * 2.0 - 1.0;
			vec3 offset = vec3(0.0, tx.y, tx.x) * w.x + vec3(ty.x, 0.0, ty.y) * w.y + vec3(tz.x, tz.y, 0.0) * w.z;
			vec3 view = mat3(viewMatrix) * (uPoseRot * offset);
			return normalize(n + view * uBump * detail * (gl_FrontFacing ? 1.0 : -1.0));
		}
	`;

	/**
	 * Baked occlusion (COLOR_0 in the GLB): the creases take the shadow no
	 * light reaches. Fully on the soft ambient light, partly on the direct —
	 * cloth is thin and lets some light through its folds.
	 */
	const AO_GLSL = /* glsl */ `#include <aomap_fragment>
		{
			// Shadow in cloth is warm: light that reaches a fold has passed through
			// and bounced off the same cream fabric, so it deepens toward amber, not grey.
			vec3 occlusion = vAO * mix(vec3(0.9, 0.76, 0.62), vec3(1.0), vAO);
			reflectedLight.indirectDiffuse *= occlusion;
			reflectedLight.indirectSpecular *= mix(1.0, vAO, 0.85);
			reflectedLight.directDiffuse *= mix(vec3(1.0), occlusion, 0.55);
			reflectedLight.directSpecular *= mix(1.0, vAO, 0.7);
		}`;

	/**
	 * The cloth is dry and rough, like jute: no gloss at all, a barely-there
	 * fibre sheen, and a coarse weave in strong relief (see uBump and the knit). The embroidery is the opposite —
	 * silk-like thread, glossy, catching a warm highlight in its own colour.
	 * One material does both: the decal's own mask (threadMask) switches the
	 * surface from cloth to thread, pixel by pixel.
	 */
	const fabric = new THREE.MeshPhysicalMaterial({
		color: srgb(cloth),
		roughness: 1,
		specularIntensity: 0.04,
		sheen: 0.12,
		sheenRoughness: 1,
		sheenColor: new THREE.Color('#d9c8ad'),
		metalness: 0,
		side: THREE.DoubleSide
	});
	/** The thread: glossy, its highlight tinted by its own colour, glinting along the stitches. */
	const THREAD_GLSL = /* glsl */ `
		// Brighter stitches (the lit side of each thread in the photo) glint more.
		float threadGlint = threadMask * (0.6 + threadLum * threadLum * 1.6);
		material.roughness = mix(material.roughness, 0.22, threadMask);
		material.specularColor = mix(material.specularColor, mix(vec3(0.16), diffuseColor.rgb, 0.55) * 1.35, threadGlint);
		material.specularF90 = mix(material.specularF90, 1.0, threadMask);
		#ifdef USE_SHEEN
			// Silk's soft lustre: a sheen in the thread's colour, tighter than cloth's.
			material.sheenColor = mix(material.sheenColor, diffuseColor.rgb * 2.2 + 0.08, threadMask);
			material.sheenRoughness = mix(material.sheenRoughness, 0.28, threadMask);
		#endif
	`;
	fabric.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, shared);
		vertexMotion(shader);
		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				`#include <common>\nuniform sampler2D uFrontInk;\nuniform sampler2D uBackInk;\nuniform sampler2D uFrontThread;\nuniform sampler2D uBackThread;\nuniform vec4 uFrontMap;\nuniform vec4 uBackMap;\n${KNIT_GLSL}`
			)
			.replace(
				'#include <map_fragment>',
				/* glsl */ `#include <map_fragment>
				// Where the embroidery thread is (0 → cloth, 1 → thread), and how bright.
				float threadMask = 0.0;
				float threadLum = 0.0;
				// The stitches' relief: the slope of the thread's height in the decal's uv.
				vec2 threadUv = vec2(0.0);
				vec2 threadSlope = vec2(0.0);
				vec3 knitW = knitWeights();
				float knitD = knitDetail();
				// The knit's light and shade, gently, in the cloth's own colour.
				diffuseColor.rgb *= 1.0 + (knitSample(knitW).a - 0.5) * 0.2 * knitD;
				if (gl_FrontFacing) {
					// Embroidery: the front shot on what faces forward, the back shot (mirrored) behind.
					vec2 fuv = vec2(uFrontMap.y + vRest.x * uFrontMap.x, uFrontMap.w + vRest.y * uFrontMap.z);
					vec2 buv = vec2(uBackMap.y - vRest.x * uBackMap.x, uBackMap.w + vRest.y * uBackMap.z);
					// Each photo only where the cloth faces its camera; it fades out side-on.
					float facing = smoothstep(0.12, 0.45, vRestNormal.z);
					float facingBack = smoothstep(0.12, 0.45, -vRestNormal.z);
					vec4 f = texture2D(uFrontInk, clamp(fuv, 0.0, 1.0)) * step(0.0, fuv.x) * step(fuv.x, 1.0);
					vec4 b = texture2D(uBackInk, clamp(buv, 0.0, 1.0)) * step(0.0, buv.x) * step(buv.x, 1.0);
					diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a * facing);
					diffuseColor.rgb = mix(diffuseColor.rgb, b.rgb, b.a * facingBack);
					threadMask = max(f.a * facing, b.a * facingBack);
					bool useFront = f.a * facing >= b.a * facingBack;
					vec3 thread = useFront ? f.rgb : b.rgb;
					threadLum = dot(thread, vec3(0.299, 0.587, 0.114));
					// The stitches' relief, from the baked normal map (see threadNormalMap).
					// Read wherever the thread's bevel reaches, a little past its edge.
					threadUv = useFront ? fuv : buv;
					vec4 tn = useFront ? texture2D(uFrontThread, clamp(fuv, 0.0, 1.0)) : texture2D(uBackThread, clamp(buv, 0.0, 1.0));
					// Relief per side: the front's fine script and tree read best low and
					// crisp; the back's dense satin-stitched bud carries more height.
					threadSlope = (tn.xy * 2.0 - 1.0) * (useFront ? facing * 0.38 : facingBack * 0.75);
				} else {
					// The inside of the cloth: the same fabric, in its own warm shade.
					diffuseColor.rgb *= vec3(0.7, 0.62, 0.54);
				}`
			)
			.replace(
				'#include <normal_fragment_maps>',
				/* glsl */ `#include <normal_fragment_maps>
				// The knit's relief is the cloth's, not the thread's: it fades under embroidery.
				normal = knitNormal(normal, knitW, knitD * (1.0 - threadMask));
				// Raised stitches: tilt the normal along the thread's height slope, in a
				// tangent frame built from how the decal's uv runs across the screen
				// (smooth, so the frame is stable; it also handles the mirrored back).
				if (dot(threadSlope, threadSlope) > 1e-5) {
					vec3 p = -vViewPosition;
					vec3 dp1 = dFdx(p);
					vec3 dp2 = dFdy(p);
					vec2 duv1 = dFdx(threadUv);
					vec2 duv2 = dFdy(threadUv);
					vec3 dp2perp = cross(dp2, normal);
					vec3 dp1perp = cross(normal, dp1);
					vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
					vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
					float scale = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
					// The map stores the tilt (+u, +v); add it in the surface's own frame.
					normal = normalize(normal + (T * threadSlope.x + B * threadSlope.y) * scale * (gl_FrontFacing ? 1.0 : -1.0));
				}`
			)
			.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\n${THREAD_GLSL}`)
			.replace('#include <aomap_fragment>', AO_GLSL);
	};

	// The rib is matte cotton too.
	const collar = new THREE.MeshPhysicalMaterial({
		color: srgb(rib),
		roughness: 1,
		specularIntensity: 0.04,
		sheen: 0.08,
		sheenRoughness: 1,
		sheenColor: new THREE.Color('#b98d6c'),
		side: THREE.DoubleSide
	});
	collar.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, shared);
		vertexMotion(shader);
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', `#include <common>\n${KNIT_GLSL}`)
			.replace(
				'#include <normal_fragment_maps>',
				/* glsl */ `#include <normal_fragment_maps>
				// A rib: fine vertical ridges around the collar, as an analytic
				// tilt of the normal (no derivatives), fading where a ridge is
				// thinner than a pixel so it never shimmers.
				{
					float around = atan(vRest.x, vRest.z) * 90.0;
					float fade = 1.0 - smoothstep(0.25, 0.7, fwidth(around) / 6.2832);
					vec3 tangent = normalize(vec3(cos(around / 90.0), 0.0, -sin(around / 90.0)));
					vec3 tilt = mat3(viewMatrix) * (uPoseRot * tangent) * cos(around) * 0.22 * fade;
					normal = normalize(normal + tilt * (gl_FrontFacing ? 1.0 : -1.0));
				}`
			)
			.replace('#include <aomap_fragment>', AO_GLSL);
	};

	/**
	 * Outside and inside are drawn as two passes. The export stacks seam
	 * allowances and facings a hair apart; drawn double-sided in one pass, an
	 * outer face and the inside of the layer under it tie in depth and fight,
	 * which shows as dark patches at grazing angles. Drawn separately, with
	 * the inside nudged back in depth, an outer face always wins a tie.
	 */
	/**
	 * The cloth's thickness shows where it shows in life: at the open edges.
	 * A thin rim runs along the hem, cuffs and neck, so they read as the cut
	 * edge of real fabric. The inside surface is NOT offset: the export tucks
	 * seam allowances and facings just under the outer cloth, some facing
	 * inward, and an offset "inward" would push those out through the cloth.
	 * Mesh units, because the rim's inset is applied to the raw position.
	 */
	const THICKNESS = 0.008; // world units ≈ 3 mm on this garment
	const thickMesh = (THICKNESS / meshScale).toFixed(5);

	/** The inside of a garment is in its own shade: much darker than the face. */
	const INSIDE_SHADE = 'vec3(0.24, 0.2, 0.17)';

	const insideOf = (material: import('three').MeshPhysicalMaterial) => {
		const inner = material.clone();
		inner.side = THREE.BackSide;
		inner.polygonOffset = true;
		inner.polygonOffsetFactor = 1;
		inner.polygonOffsetUnits = 4;
		inner.onBeforeCompile = (shader, r) => {
			material.onBeforeCompile(shader, r);
			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <opaque_fragment>',
				`outgoingLight *= ${INSIDE_SHADE};\n#include <opaque_fragment>`
			);
		};
		// Distinct program from the outer pass.
		inner.customProgramCacheKey = () => `tee-inside-${material.name}`;
		return inner;
	};
	fabric.name = 'fabric';
	collar.name = 'collar';

	/**
	 * The rim: a strip along every open edge of the mesh, from the outside
	 * surface to the inside one. Built from boundary edges — edges used by one
	 * triangle only, keyed by position so sewn seams between pattern pieces
	 * don't count. Each strip vertex carries the surface normal (so it moves
	 * with the cloth) and its own outward normal (so it shades as an edge).
	 */
	function rimGeometry(source: import('three').BufferGeometry) {
		const index = source.index;
		const pos = source.getAttribute('position');
		const nor = source.getAttribute('normal');
		const col = source.getAttribute('color');
		if (!index || !nor) return null;
		const keyOf = new Int32Array(pos.count);
		const ids = new Map<string, number>();
		for (let i = 0; i < pos.count; i++) {
			const key = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
			let id = ids.get(key);
			if (id === undefined) ids.set(key, (id = ids.size));
			keyOf[i] = id;
		}
		const edges = new Map<string, { a: number; b: number; count: number }>();
		for (let f = 0; f < index.count; f += 3) {
			const tri = [index.getX(f), index.getX(f + 1), index.getX(f + 2)];
			for (let e = 0; e < 3; e++) {
				const a = tri[e];
				const b = tri[(e + 1) % 3];
				const ka = keyOf[a];
				const kb = keyOf[b];
				const key = ka < kb ? `${ka}_${kb}` : `${kb}_${ka}`;
				const found = edges.get(key);
				if (found) found.count++;
				else edges.set(key, { a, b, count: 1 });
			}
		}
		const positions: number[] = [];
		const normals: number[] = [];
		const rimNormals: number[] = [];
		const colors: number[] = [];
		const insets: number[] = [];
		const pa = new THREE.Vector3();
		const pb = new THREE.Vector3();
		const na = new THREE.Vector3();
		const nb = new THREE.Vector3();
		const out = new THREE.Vector3();
		// Only real openings: the bake marks them in COLOR_0's green channel
		// (open air just past the edge, not another layer of cloth).
		const open = [...edges.values()].filter(
			({ a, b, count }) => count === 1 && !!col && col.getY(a) >= 0.5 && col.getY(b) >= 0.5
		);
		// Each corner's outward normal is the average over the edges that meet
		// there, so the rim shades as one smooth band, not a row of facets.
		const smooth = new Map<number, import('three').Vector3>();
		for (const { a, b } of open) {
			pa.fromBufferAttribute(pos, a);
			pb.fromBufferAttribute(pos, b);
			na.fromBufferAttribute(nor, a).normalize();
			nb.fromBufferAttribute(nor, b).normalize();
			// Outward across the edge, in the surface: edge direction × normal.
			out.subVectors(pb, pa).cross(na.clone().add(nb).normalize()).normalize();
			for (const v of [a, b]) {
				const sum = smooth.get(keyOf[v]) ?? new THREE.Vector3();
				smooth.set(keyOf[v], sum.add(out));
			}
		}
		for (const sum of smooth.values()) sum.normalize();
		for (const { a, b } of open) {
			pa.fromBufferAttribute(pos, a);
			pb.fromBufferAttribute(pos, b);
			na.fromBufferAttribute(nor, a).normalize();
			nb.fromBufferAttribute(nor, b).normalize();
			// Quad a0 b1 b0 / a0 a1 b1 (0 = on the outside surface, 1 = inset), facing out.
			const corners: [number, number][] = [[a, 0], [b, 1], [b, 0], [a, 0], [a, 1], [b, 1]];
			for (const [v, inset] of corners) {
				const p = v === a ? pa : pb;
				const n = v === a ? na : nb;
				const rimNormal = smooth.get(keyOf[v])!;
				positions.push(p.x, p.y, p.z);
				normals.push(n.x, n.y, n.z);
				rimNormals.push(rimNormal.x, rimNormal.y, rimNormal.z);
				const ao = col ? col.getX(v) : 1;
				colors.push(ao, ao, ao);
				insets.push(inset);
			}
		}
		if (!positions.length) return null;
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
		geometry.setAttribute('aRimNormal', new THREE.Float32BufferAttribute(rimNormals, 3));
		geometry.setAttribute('aInset', new THREE.Float32BufferAttribute(insets, 1));
		return geometry;
	}

	const rimMaterial = (colour: import('three').Color) => {
		const m = new THREE.MeshPhysicalMaterial({
			// A cut edge: the same cloth, a shade down where it turns away.
			color: colour.clone().multiplyScalar(0.92),
			roughness: 1,
			specularIntensity: 0.04,
			sheen: 0.12,
			sheenRoughness: 1,
			sheenColor: new THREE.Color('#d9c8ad')
		});
		m.onBeforeCompile = (shader) => {
			Object.assign(shader.uniforms, shared);
			vertexMotion(shader);
			shader.vertexShader = shader.vertexShader
				.replace('#include <common>', '#include <common>\nattribute vec3 aRimNormal;\nattribute float aInset;')
				.replace('#include <defaultnormal_vertex>', 'objectNormal = normalize(aRimNormal);\n#include <defaultnormal_vertex>')
				.replace(
					'#include <project_vertex>',
					`transformed -= normalize(normal) * ${thickMesh} * aInset;\n#include <project_vertex>`
				);
			shader.fragmentShader = shader.fragmentShader
				.replace('#include <common>', '#include <common>\nvarying float vAO;')
				.replace('#include <aomap_fragment>', AO_GLSL);
		};
		m.customProgramCacheKey = () => 'tee-rim';
		return m;
	};
	fabric.side = THREE.FrontSide;
	collar.side = THREE.FrontSide;
	const fabricInside = insideOf(fabric);
	const collarInside = insideOf(collar);

	const fabricRim = rimMaterial(srgb(cloth));
	const collarRim = rimMaterial(srgb(rib));

	const hitTargets: import('three').Object3D[] = [];
	const meshes: import('three').Mesh[] = [];
	const rims: import('three').BufferGeometry[] = [];
	model.traverse((o) => {
		const mesh = o as import('three').Mesh;
		if (mesh.isMesh) meshes.push(mesh);
	});
	const beside = (mesh: import('three').Mesh, twin: import('three').Mesh) => {
		twin.position.copy(mesh.position);
		twin.quaternion.copy(mesh.quaternion);
		twin.scale.copy(mesh.scale);
		mesh.parent?.add(twin);
	};
	for (const mesh of meshes) {
		const isCollar = (mesh.material as import('three').Material).name === 'collar';
		mesh.material = isCollar ? collar : fabric;
		beside(mesh, new THREE.Mesh(mesh.geometry, isCollar ? collarInside : fabricInside));
		const rim = rimGeometry(mesh.geometry);
		if (rim) {
			rims.push(rim);
			beside(mesh, new THREE.Mesh(rim, isCollar ? collarRim : fabricRim));
		}
		hitTargets.push(mesh);
	}

	const inverse = new THREE.Matrix4();
	const local = new THREE.Vector3();
	return {
		object: model,
		depth: bounds.max.z,
		hitTargets,
		press(point, toViewer, strength, pull, pressing) {
			applyPress(motion, point, toViewer, strength, pull, pressing);
		},
		update(m, pose) {
			applyMotion(motion, m);
			shared.uPoseRot.value.setFromMatrix4(pose);
		},
		poke(point, strength) {
			// Ripples run in the garment's own (unscaled-to-world) space.
			inverse.copy(model.parent ? model.parent.matrixWorld : model.matrixWorld).invert();
			local.copy(point).applyMatrix4(inverse);
			addRipple(motion, local, strength);
		},
		dispose() {
			model.traverse((o) => (o as import('three').Mesh).geometry?.dispose());
			fabric.dispose();
			fabricInside.dispose();
			collarInside.dispose();
			fabricRim.dispose();
			collarRim.dispose();
			for (const rim of rims) rim.dispose();
			collar.dispose();
			frontInk.dispose();
			backInk.dispose();
			frontThread.dispose();
			backThread.dispose();
			knit.texture.dispose();
		}
	} satisfies Garment;
};
