/**
 * The 3D tee hero: the stage every mode shares.
 *
 * The garment (garment.ts) only builds the tee and moves its surface.
 * Everything around it lives here: the renderer and lights, the soft contact
 * shadow, the turn (a full 360°, front and back), ripples, and the
 * frame-rate governor that keeps it smooth on any device.
 *
 * The turn, in layers:
 *   - auto: a slow, constant turn that shows front then back;
 *   - drag: the hand takes the yaw directly; let go and it coasts on its
 *     momentum, slowing with friction, until the auto turn picks it up again;
 *   - seek: the Front / Back buttons spring it to a face and hold it there;
 *   - scroll: as the hero leaves the screen the piece turns to its back.
 * The mode is told the angular velocity, so cloth can lag and swing with it.
 *
 * The governor watches frame times. If the device cannot hold the frame
 * rate it steps the quality down (pixel ratio first, then the mode's own
 * detail), and if even the lowest tier is too slow it gives up and hands the
 * photograph back. A tee that stutters is worse than a still one.
 *
 * Imported dynamically, in the browser only.
 */
import * as THREE from 'three';

export type Side = 'front' | 'back';
/** 0 = full detail, 1 = reduced, 2 = minimum. */
export type Tier = 0 | 1 | 2;

/** World width of the tee. Height follows the photograph's aspect. */
export const WIDTH = 2;
/** How many ripples can run at once. */
export const RIPPLES = 8;
export const RIPPLE_LIFE = 2.6;

/** Radians per second of the idle turn: one full turn in about 20 s. */
const AUTO_SPEED = 0.32;
/** Seconds after a hand lets go, or a button is pressed, before the auto turn resumes. */
const AUTO_RESUME = 2.4;
const SEEK_HOLD = 6;
/** Friction on a released spin, per second. */
const COAST_FRICTION = 1.6;
const MAX_PITCH = 0.32;
/** Frames slower than this, at the median, step the quality down. */
const SLOW_FRAME_MS = 26;
/** At the lowest tier, frames slower than this give up on 3D entirely. */
const GIVE_UP_FRAME_MS = 40;

/** Each frame, the mode is told how the piece is moving. */
export type Motion = {
	time: number;
	dt: number;
	/** Total yaw, radians, unbounded. */
	yaw: number;
	/** Radians per second. */
	yawVelocity: number;
	pitch: number;
	pitchVelocity: number;
	/** Vertical velocity of the body, world units per second. */
	bobVelocity: number;
	/** 0 → calm, ~1 → normal breeze, more when stirred. */
	wind: number;
};

export type ModeContext = {
	THREE: typeof THREE;
	renderer: THREE.WebGLRenderer;
	front: HTMLImageElement;
	back: HTMLImageElement;
	frontTexture: THREE.Texture;
	backTexture: THREE.Texture;
	/** The piece's average cloth colour, for insides and unprinted areas. */
	cloth: THREE.Color;
	/** Height of the photograph in world units (its width is WIDTH). */
	height: number;
	tier: Tier;
	reducedMotion: boolean;
};

export type Garment = {
	/** Added to the turning group (shell, model) — or, if `world`, to the scene. */
	object: THREE.Object3D;
	/** True when the garment simulates in world space and reads the pose itself. */
	world?: boolean;
	/** How far the surface stands proud of z = 0 toward the camera, at rest. */
	depth: number;
	/** Objects to raycast for touches. */
	hitTargets: THREE.Object3D[];
	/** Each frame, before render. `pose` is the turning group's world matrix. */
	update(motion: Motion, pose: THREE.Matrix4): void;
	/** A touch at a world-space point. */
	poke(point: THREE.Vector3, strength: number): void;
	/**
	 * Each frame: where the pointer presses into the cloth, in the turning
	 * group's space (null when it is off the piece), the direction toward the
	 * viewer in that space, and how hard (0 → 1; a held press is 1).
	 */
	press?(
		point: THREE.Vector3 | null,
		toViewer: THREE.Vector3,
		strength: number,
		/** The hand's motion across the cloth, group space (length ~ speed, 1 = brisk). */
		pull: THREE.Vector3,
		/** 0 = hovering (creases), 1 = pressed (dent). */
		pressing: number
	): void;
	/** Drop to a lower tier where the mode can (fewer iterations, coarser detail). */
	setTier?(tier: Tier): void;
	dispose(): void;
};

export type GarmentBuilder = (context: ModeContext) => Garment | Promise<Garment>;

export type TeeStats = { fps: number; tier: Tier };

export type TeeScene = {
	/** Resolves once the first frame is on the canvas. */
	ready: Promise<void>;
	face(side: Side): void;
	/** Let a held scene start moving. */
	reveal(): void;
	/** Render the current frame and return it as a PNG data URL (to make the poster). */
	snapshot(): string;
	destroy(): void;
};

export type MountOptions = {
	reducedMotion?: boolean;
	/** The visible face changed (front ↔ back). */
	onSide?: (side: Side) => void;
	/** The device cannot run it: show the photograph instead. */
	onFallback?: () => void;
	/** Roughly twice a second, for the dev readout. */
	onStats?: (stats: TeeStats) => void;
	/** The element whose scroll-out turns the piece (the hero). Defaults to the canvas. */
	scrollAnchor?: Element | null;
	/**
	 * Start frozen on the first frame until reveal(). The poster placeholder
	 * is that exact frame, so the swap from poster to canvas is invisible.
	 */
	hold?: boolean;
};

/** A first guess at what the device can do, before any frame is measured. */
export function initialTier(): Tier {
	const nav = navigator as Navigator & { deviceMemory?: number };
	const cores = nav.hardwareConcurrency ?? 4;
	const memory = nav.deviceMemory ?? 8;
	const coarse = window.matchMedia('(pointer: coarse)').matches;
	if (cores <= 2 || memory <= 2) return 2;
	if (coarse || cores <= 4 || memory <= 4) return 1;
	return 0;
}

const PIXEL_RATIO: Record<Tier, number> = { 0: 2, 1: 1.5, 2: 1 };

/**
 * The shared GLSL for surface motion: wind that grows toward the hem and the
 * sleeve ends, and ripples that run out from a touch. Positions are in the
 * garment's local space; ripple points are given in that space too.
 */
export const MOTION_GLSL = /* glsl */ `
	uniform float uTime;
	uniform float uWind;
	uniform float uYawVel;
	uniform float uBobVel;
	uniform float uTop;
	uniform float uSpan;
	uniform vec4 uRipplePos[${RIPPLES}];
	uniform float uRippleAmp[${RIPPLES}];
	// The pointer pressing in: xyz where (group space), w how hard; and toward the viewer.
	uniform vec4 uPress;
	uniform vec3 uPressView;
	const float PRESS_RADIUS = 0.24;

	/**
	 * The one direction cloth moves in: outward from the body's vertical axis,
	 * a function of position only. Continuous everywhere the garment is, so
	 * neighbouring vertices — and stacked layers at the same spot — always move
	 * together. (Per-vertex normals flip between layers and tear the mesh.)
	 */
	vec3 clothField(vec3 p) {
		return normalize(vec3(p.x, 0.0, p.z) + vec3(0.0, 0.0, 0.001));
	}

	// xyz: unused; w: how far the held press has pulled the cloth (a spring, so
	// it overshoots a touch as it's grabbed and bounces back when let go).
	uniform vec4 uPull;

	/**
	 * Click and hold pinches the cloth and pulls it toward you, like someone
	 * taking the shirt between finger and thumb and drawing it closer:
	 *   - a tent: the point comes out furthest, the cloth around it follows in a
	 *     long, soft slope (a Lorentzian, so the pinch is sharp, the base broad);
	 *   - tension wrinkles: the pulled cloth draws into fine radial folds that
	 *     run out from the pinch and die away.
	 * The pull goes toward the viewer for every layer at a spot alike, so
	 * stacked layers stay stacked. Shape and shading share one formula.
	 */
	const float PULL_HEIGHT = 0.22;   // how far the pinch comes out, world units
	const float PULL_SHARPNESS = 1.5; // higher = a narrower tent
	const float WRINKLES = 7.0;       // radial tension folds around the pinch
	const float WRINKLE_DEPTH = 0.011;

	struct Touch {
		vec3 v;        // offset from the pinch, in the view plane
		float r;       // distance, in radii
		float facing;  // only where the cloth faces the viewer
		float angle;   // around the pinch
		vec3 radial;   // away from the pinch
		vec3 around;   // around it
	};
	Touch touchAt(vec3 p) {
		Touch t;
		t.v = p - uPress.xyz;
		t.v -= dot(t.v, uPressView) * uPressView;
		t.r = length(t.v) / PRESS_RADIUS;
		t.facing = smoothstep(0.2, 0.6, dot(clothField(p), uPressView));
		vec3 b1 = normalize(cross(uPressView, vec3(0.0, 1.0, 0.0)) + vec3(1e-5));
		vec3 b2 = cross(uPressView, b1);
		t.angle = atan(dot(t.v, b2), dot(t.v, b1));
		t.radial = t.r > 1e-4 ? normalize(t.v) : vec3(0.0);
		t.around = -sin(t.angle) * b1 + cos(t.angle) * b2;
		return t;
	}

	vec3 clothPress(vec3 p, vec3 n) {
		float pull = uPull.w * uPress.w;
		if (abs(pull) <= 0.0005) return vec3(0.0);
		Touch t = touchAt(p);
		float q = t.r * PULL_SHARPNESS;
		float tent = PULL_HEIGHT * pow(1.0 + q * q, -1.5);
		float wrinkle = sin(t.angle * WRINKLES) * WRINKLE_DEPTH * t.r * exp(-t.r * 0.9);
		return (uPressView * tent + n * wrinkle) * pull * t.facing;
	}
	// The pinch's shading: the tent's slopes face away from the point, the
	// wrinkles' sides face around it — the normal tilts by the shape's gradient.
	vec3 pressTilt(vec3 p, vec3 n) {
		float pull = uPull.w * uPress.w;
		if (abs(pull) <= 0.0005) return n;
		Touch t = touchAt(p);
		float q = t.r * PULL_SHARPNESS;
		float slope = 3.0 * PULL_HEIGHT * PULL_SHARPNESS * PULL_SHARPNESS * t.r * pow(1.0 + q * q, -2.5) / PRESS_RADIUS;
		float wrinkleSlope = cos(t.angle * WRINKLES) * WRINKLES * WRINKLE_DEPTH * exp(-t.r * 0.9) / PRESS_RADIUS;
		vec3 tilt = t.radial * slope - t.around * wrinkleSlope;
		return normalize(n + tilt * pull * t.facing);
	}

	// How free the cloth is here: pinned at the collar, loose at the hem and cuffs.
	float clothFreedom(vec3 p) {
		float fromTop = clamp((uTop - p.y) / (uSpan), 0.0, 1.0);
		return 0.12 + fromTop * fromTop * 1.3 + smoothstep(0.45, 1.0, abs(p.x)) * 0.5;
	}

	// A soft limit: linear for small x, easing to ±limit. Cloth stretches,
	// then resists — and it can never be thrown through itself.
	float soft(float x, float limit) {
		float e = exp(-2.0 * abs(x) / limit);
		return sign(x) * limit * (1.0 - e) / (1.0 + e);
	}

	// Out-of-plane displacement: breeze plus ripples, each soft-limited, and the
	// sum held well inside the garment's own thickness (front to back is ~0.4
	// here), so a hard flick or a burst of taps can't push one side into the other.
	float clothWave(vec3 p) {
		float free = clothFreedom(p);
		float wave =
			sin(p.x * 2.3 + uTime * 1.2) * 0.5 +
			sin(p.y * 3.1 - uTime * 1.65 + p.x * 1.3) * 0.32 +
			sin((p.x - p.y) * 6.0 + uTime * 2.5) * 0.1;
		float d = wave * 0.024 * free * soft(uWind, 1.8);
		float rip = 0.0;
		for (int i = 0; i < ${RIPPLES}; i++) {
			vec4 r = uRipplePos[i];
			float age = uTime - r.w;
			float amp = uRippleAmp[i];
			if (amp > 0.0 && age > 0.0 && age < ${RIPPLE_LIFE.toFixed(1)}) {
				float dist = distance(p, r.xyz);
				float env = exp(-age * 1.5) * exp(-dist * 2.2);
				rip += amp * 0.08 * env * sin(dist * 18.0 - age * 10.0);
			}
		}
		d += soft(rip, 0.04);
		return soft(d, 0.05);
	}

	// The swing: as it turns, the loose cloth trails behind the turn (opposite
	// its motion about the vertical axis); as it bobs, the hem lags the body.
	// The turn rate is soft-limited: a hard flick swings the hem fully, but a
	// faster one only swings it as far, never further.
	vec3 clothSwing(vec3 p) {
		float free = clothFreedom(p);
		float w = soft(uYawVel, 1.4);
		float k = 0.09 * free;
		return vec3(
			-w * p.z * k,
			-soft(uBobVel, 0.6) * 0.1 * free,
			w * p.x * k
		);
	}
`;

/** Uniforms MOTION_GLSL reads. One object, shared by every material of a mode. */
export function motionUniforms(top: number, span: number) {
	return {
		uTime: { value: 0 },
		uWind: { value: 1 },
		uYawVel: { value: 0 },
		uBobVel: { value: 0 },
		uTop: { value: top },
		uSpan: { value: span },
		uRipplePos: {
			value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, 0, -100))
		},
		uRippleAmp: { value: new Array(RIPPLES).fill(0) },
		uPress: { value: new THREE.Vector4(0, 0, 0, 0) },
		uPressView: { value: new THREE.Vector3(0, 0, 1) },
		uPull: { value: new THREE.Vector4(0, 0, 0, 0) }
	};
}

/** Feed the pointer's touch to the shared uniforms (see Garment.press). */
export function applyPress(
	uniforms: MotionUniforms,
	point: THREE.Vector3 | null,
	toViewer: THREE.Vector3,
	strength: number,
	pull: THREE.Vector3,
	pressing: number
) {
	if (point) uniforms.uPress.value.set(point.x, point.y, point.z, strength);
	else uniforms.uPress.value.w = 0;
	uniforms.uPressView.value.copy(toViewer);
	uniforms.uPull.value.set(pull.x, pull.y, pull.z, pressing);
}

export type MotionUniforms = ReturnType<typeof motionUniforms>;

/** Feed one frame of motion to the shared uniforms. */
export function applyMotion(uniforms: MotionUniforms, motion: Motion) {
	uniforms.uTime.value = motion.time;
	uniforms.uWind.value = motion.wind;
	uniforms.uYawVel.value = THREE.MathUtils.clamp(motion.yawVelocity, -6, 6);
	uniforms.uBobVel.value = THREE.MathUtils.clamp(motion.bobVelocity, -3, 3);
}

/** Start a ripple in a free slot, or over the one with least energy left. */
export function addRipple(uniforms: MotionUniforms, local: THREE.Vector3, strength: number) {
	const now = uniforms.uTime.value;
	let slot = 0;
	let weakest = Infinity;
	for (let i = 0; i < RIPPLES; i++) {
		const age = now - uniforms.uRipplePos.value[i].w;
		const amp = uniforms.uRippleAmp.value[i];
		if (age >= RIPPLE_LIFE || amp <= 0) {
			slot = i;
			break;
		}
		const left = amp * Math.exp(-age * 1.6);
		if (left < weakest) {
			weakest = left;
			slot = i;
		}
	}
	uniforms.uRipplePos.value[slot].set(local.x, local.y, local.z, now);
	uniforms.uRippleAmp.value[slot] = strength;
}

/** Wait for an image to have pixels. */
export function loaded(image: HTMLImageElement): Promise<void> {
	if (image.complete && image.naturalWidth) return Promise.resolve();
	return new Promise((resolve, reject) => {
		image.addEventListener('load', () => resolve(), { once: true });
		image.addEventListener('error', () => reject(new Error(`image failed: ${image.src}`)), {
			once: true
		});
	});
}

/** A soft, round shadow on the floor under the piece. One quad, no shadow maps. */
function contactShadow() {
	const size = 128;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d')!;
	const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
	gradient.addColorStop(0.45, 'rgba(0,0,0,0.22)');
	gradient.addColorStop(1, 'rgba(0,0,0,0)');
	context.fillStyle = gradient;
	context.fillRect(0, 0, size, size);
	const texture = new THREE.CanvasTexture(canvas);
	const material = new THREE.MeshBasicMaterial({
		map: texture,
		transparent: true,
		depthWrite: false
	});
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
	mesh.rotation.x = -Math.PI / 2;
	mesh.renderOrder = -1;
	return {
		mesh,
		dispose() {
			texture.dispose();
			material.dispose();
			mesh.geometry.dispose();
		}
	};
}

/** The shortest signed angle from a to b. */
function shortest(from: number, to: number) {
	return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export async function mountTee(
	canvas: HTMLCanvasElement,
	front: HTMLImageElement,
	back: HTMLImageElement,
	build: GarmentBuilder,
	options: MountOptions = {}
): Promise<TeeScene> {
	const { reducedMotion = false, onSide, onFallback, onStats } = options;
	await Promise.all([loaded(front), loaded(back)]);

	let tier = initialTier();
	/**
	 * The page's <img> elements hold the layout (and the camera is framed to
	 * them), but the textures load their own copies: a srcset can swap an
	 * element's source between sizes, and a texture whose pixels change size
	 * after upload fails to update. Low tiers take the small files.
	 */
	const fresh = async (element: HTMLImageElement) => {
		const small = element.srcset.split(',')[0]?.trim().split(' ')[0];
		const image = new Image();
		image.decoding = 'async';
		image.src = tier === 2 && small ? small : element.src;
		await loaded(image);
		return image;
	};
	const layout = front;
	[front, back] = await Promise.all([fresh(front), fresh(back)]);
	const renderer = new THREE.WebGLRenderer({
		canvas,
		alpha: true,
		antialias: tier < 2,
		powerPreference: 'high-performance'
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO[tier]));
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	// Filmic but colour-true: highlights roll off softly, the cloth keeps its hue.
	renderer.toneMapping = THREE.NeutralToneMapping;
	renderer.toneMappingExposure = 0.9;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);

	const texture = (image: HTMLImageElement) => {
		const t = new THREE.Texture(image);
		t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
		t.needsUpdate = true;
		return t;
	};
	const frontTexture = texture(front);
	const backTexture = texture(back);
	const height = (WIDTH * front.naturalHeight) / front.naturalWidth;

	const { clothColour } = await import('../cloth-scene');
	const cloth = clothColour(front) ?? new THREE.Color('#d9c8b0');

	const garment = await build({
		THREE,
		renderer,
		front,
		back,
		frontTexture,
		backTexture,
		cloth,
		height,
		tier,
		reducedMotion
	});

	/** The turning group: yaw, pitch, bob. Garments in world space read its matrix. */
	const pose = new THREE.Group();
	scene.add(pose);
	if (garment.world) scene.add(garment.object);
	else pose.add(garment.object);

	/**
	 * A photographic studio, fixed in the world so the turning piece moves
	 * through it:
	 *   - image-based light from a soft-box room (prefiltered once): the broad
	 *     wrap of light and the gentle sheen a real studio gives cloth;
	 *   - a warm key, high and to the left, that carves the folds;
	 *   - a soft warm fill opposite, so the shadow side keeps the cloth's hue;
	 *   - a warm rim from behind, so the silhouette separates from the dark.
	 * The baked occlusion in the model (see garment.ts) puts the shadow in the
	 * creases that no light can reach.
	 */
	const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
	const pmrem = new THREE.PMREMGenerator(renderer);
	const room = new RoomEnvironment();
	const environment = pmrem.fromScene(room, 0.04).texture;
	room.dispose();
	pmrem.dispose();
	scene.environment = environment;
	scene.environmentIntensity = 0.32;
	scene.add(new THREE.HemisphereLight(0xfff1de, 0x5a4632, 0.55));
	const KEY = 2.0;
	const RIM = 1.6;
	const RIM_LEFT = 0.9;
	const key = new THREE.DirectionalLight(0xffe4c4, KEY);
	key.position.set(-2.6, 3.2, 3.4);
	scene.add(key);
	const fill = new THREE.DirectionalLight(0xffe6cf, 0.35);
	fill.position.set(3, 0.6, 2.2);
	scene.add(fill);
	const rim = new THREE.DirectionalLight(0xffcf8a, RIM);
	rim.position.set(1.8, 2.2, -3.5);
	scene.add(rim);
	const rimLeft = new THREE.DirectionalLight(0xffe2b8, RIM_LEFT);
	rimLeft.position.set(-3, 0.5, -2.5);
	scene.add(rimLeft);

	const shadow = contactShadow();
	shadow.mesh.scale.set(WIDTH * 1.05, WIDTH * 0.32, 1);
	shadow.mesh.position.y = -height / 2 - 0.32;
	scene.add(shadow.mesh);

	/** Frame the piece so at rest its front sits where the photograph sat. */
	function resize() {
		const { clientWidth: w, clientHeight: h } = canvas;
		if (!w || !h) return;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		const fill = layout.clientHeight && h ? layout.clientHeight / h : 0.62;
		const distance =
			height / fill / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + garment.depth;
		camera.position.set(0, 0, distance);
		camera.lookAt(0, 0, 0);
		camera.updateProjectionMatrix();
	}
	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(canvas);
	resize();

	/* ---- The turn. ---- */
	type TurnMode = 'auto' | 'drag' | 'coast' | 'seek';
	const turn = {
		mode: 'auto' as TurnMode,
		yaw: 0,
		velocity: 0,
		pitch: 0,
		pitchVelocity: 0,
		/** auto: eases in from rest; coast/seek: when to hand back to auto. */
		since: 0,
		seekTo: 0,
		/** The scroll's share of the yaw, sprung, so a fast scroll does not snap it. */
		scroll: 0,
		scrollVelocity: 0
	};
	const body = { x: 0, y: 0, vx: 0, vy: 0, goalX: 0, goalY: 0, leanYaw: 0, leanPitch: 0 };
	let drag: {
		id: number;
		x: number;
		y: number;
		yaw: number;
		pitch: number;
		lastX: number;
		lastT: number;
		speed: number;
	} | null = null;
	let clock = 0;
	let side: Side = 'front';

	const raycaster = new THREE.Raycaster();
	const ndc = new THREE.Vector2();
	function hitAt(clientX: number, clientY: number) {
		const rect = canvas.getBoundingClientRect();
		ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
		raycaster.setFromCamera(ndc, camera);
		return raycaster.intersectObjects(garment.hitTargets, false)[0] ?? null;
	}

	/** Where the pointer is over the canvas (client px), for the press dent. */
	let pointer: { x: number; y: number } | null = null;
	function onPointerDown(event: PointerEvent) {
		// No text selection or drag starting on the canvas, on the piece or beside
		// it. (Touch scrolling is left to touch-action, so the page still scrolls.)
		if (event.pointerType === 'mouse') event.preventDefault();
		const hit = hitAt(event.clientX, event.clientY);
		if (!hit) return;
		event.preventDefault();
		// The grab: the pinch pulls out on a spring (see the touch in step()).
		pointer = { x: event.clientX, y: event.clientY };
		drag = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			yaw: turn.yaw,
			pitch: turn.pitch,
			lastX: event.clientX,
			lastT: performance.now(),
			speed: 0
		};
		turn.mode = 'drag';
		canvas.setPointerCapture(event.pointerId);
		canvas.style.cursor = 'grabbing';
	}

	function onPointerMove(event: PointerEvent) {
		if (drag && event.pointerId === drag.id) {
			const now = performance.now();
			// The yaw follows the hand one to one: half the canvas is half a turn.
			const perPixel = Math.PI / Math.max(canvas.clientWidth * 0.5, 200);
			turn.yaw = drag.yaw + (event.clientX - drag.x) * perPixel;
			turn.pitch = THREE.MathUtils.clamp(drag.pitch + (event.clientY - drag.y) * 0.004, -MAX_PITCH, MAX_PITCH);
			const dt = Math.max((now - drag.lastT) / 1000, 1 / 240);
			const instant = ((event.clientX - drag.lastX) * perPixel) / dt;
			// Smoothed, so the flick at release is the hand's real speed, not one jittery sample.
			drag.speed = drag.speed * 0.6 + instant * 0.4;
			drag.lastX = event.clientX;
			drag.lastT = now;
			// The pinch follows the hand while it turns the piece.
			pointer = { x: event.clientX, y: event.clientY };
			return;
		}
		// Held on the poster frame: nothing may move it until the swap is done.
		if (event.pointerType !== 'mouse' || !visible || held) return;
		const rect = canvas.getBoundingClientRect();
		const inside =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;
		if (!inside) {
			body.goalX = body.goalY = body.leanYaw = body.leanPitch = 0;
			pointer = null;
			return;
		}
		const nx = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
		const ny = THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
		// The piece turns to meet the pointer, clearly: it follows your hand.
		body.goalX = nx * 0.1;
		body.goalY = -ny * 0.07;
		body.leanYaw = nx * 0.45;
		body.leanPitch = ny * 0.2;
		pointer = { x: event.clientX, y: event.clientY };
		if (!reducedMotion) wake(event);
	}

	/**
	 * Hover: a slight ripple where the hand passes. Spaced by distance and
	 * time, and soft, so it reads as a breath across the cloth, not a splash.
	 */
	let trail = { t: 0, x: 0, y: 0 };
	function wake(event: PointerEvent) {
		const now = performance.now();
		const moved = Math.hypot(event.clientX - trail.x, event.clientY - trail.y);
		if (moved < 34 || now - trail.t < 90) return;
		const hit = hitAt(event.clientX, event.clientY);
		if (!hit) return;
		garment.poke(hit.point, 0.16);
		trail = { t: now, x: event.clientX, y: event.clientY };
	}

	function onPointerUp(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.id) return;
		// A pause before letting go means no flick.
		const stale = performance.now() - drag.lastT > 80;
		turn.velocity = stale ? 0 : THREE.MathUtils.clamp(drag.speed, -14, 14);
		// Let go: the pinch springs back, and the cloth shivers out from it.
		if (press.has) garment.poke(press.world, 0.9);
		if (event.pointerType !== 'mouse') pointer = null;
		turn.mode = 'coast';
		turn.since = 0;
		drag = null;
		canvas.style.cursor = '';
	}

	function onPointerLeave() {
		body.goalX = body.goalY = body.leanYaw = body.leanPitch = 0;
		if (!drag) pointer = null;
	}

	let lastScrollY = window.scrollY;
	function onScroll() {
		const delta = window.scrollY - lastScrollY;
		lastScrollY = window.scrollY;
		if (!visible || reducedMotion) return;
		body.vy += THREE.MathUtils.clamp(delta * 0.0006, -0.1, 0.1) * 9;
	}

	canvas.addEventListener('pointerdown', onPointerDown);
	window.addEventListener('pointermove', onPointerMove, { passive: true });
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('pointercancel', onPointerUp);
	canvas.addEventListener('pointerleave', onPointerLeave);
	window.addEventListener('scroll', onScroll, { passive: true });

	/** How far the hero has scrolled away, 0 → 1. */
	const anchor = options.scrollAnchor ?? canvas;
	function scrollProgress() {
		const rect = anchor.getBoundingClientRect();
		return THREE.MathUtils.clamp(-rect.top / Math.max(rect.height * 0.8, 1), 0, 1);
	}

	/* ---- Frame-rate governor. ---- */
	const frameTimes: number[] = [];
	let sinceCheck = 0;
	let warmup = 1.2;
	let statsTimer = 0;
	let gaveUp = false;
	function govern(ms: number, dt: number) {
		frameTimes.push(ms);
		if (frameTimes.length > 90) frameTimes.shift();
		statsTimer += dt;
		if (statsTimer > 0.5 && onStats) {
			statsTimer = 0;
			const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
			onStats({ fps: Math.round(1000 / Math.max(avg, 1)), tier });
		}
		if (warmup > 0) {
			warmup -= dt;
			return;
		}
		sinceCheck += dt;
		if (sinceCheck < 1.5 || frameTimes.length < 45) return;
		sinceCheck = 0;
		const sorted = [...frameTimes].sort((a, b) => a - b);
		const median = sorted[Math.floor(sorted.length / 2)];
		if (tier < 2 && median > SLOW_FRAME_MS) {
			tier = (tier + 1) as Tier;
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO[tier]));
			resize();
			garment.setTier?.(tier);
			frameTimes.length = 0;
			warmup = 0.6;
		} else if (tier === 2 && median > GIVE_UP_FRAME_MS && !gaveUp) {
			gaveUp = true;
			onFallback?.();
		}
	}

	/* ---- Only animate while on screen and the tab is visible. ---- */
	let visible = true;
	const visibility = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (visible) loop();
	});
	visibility.observe(canvas);

	let frame = 0;
	let last = performance.now();
	let firstFrame: () => void = () => {};
	let held = options.hold ?? false;
	const ready = new Promise<void>((resolve) => (firstFrame = resolve));
	const spin = { autoRamp: 0 };
	const lean = { yaw: 0, v: 0 };
	const squash = { value: 0, v: 0 };
	/** The reveal's light: 1 at the moment it comes alive, fading to 0. */
	const flare = { value: 0 };
	const roll = { value: 0, v: 0 };
	const press = {
		strength: 0,
		pressing: 0,
		pullV: 0,
		tracking: false,
		last: new THREE.Vector3(),
		velocity: new THREE.Vector3(),
		pull: new THREE.Vector3(),
		has: false,
		world: new THREE.Vector3(),
		local: new THREE.Vector3(),
		view: new THREE.Vector3()
	};
	const pressPlane = new THREE.Plane();
	const inversePose = new THREE.Matrix4();

	function step(now: number) {
		const ms = now - last;
		const dt = held ? 0 : Math.min(ms / 1000, 1 / 20);
		last = now;
		clock += dt;

		// Yaw.
		if (turn.mode === 'auto') {
			// Ease the auto turn in, so resuming never jerks.
			spin.autoRamp = Math.min(1, spin.autoRamp + dt / 1.6);
			const goal = reducedMotion ? 0 : AUTO_SPEED * spin.autoRamp;
			turn.velocity += (goal - turn.velocity) * Math.min(1, dt * 2.5);
			turn.yaw += turn.velocity * dt;
		} else if (turn.mode === 'coast') {
			turn.velocity *= Math.exp(-COAST_FRICTION * dt);
			turn.yaw += turn.velocity * dt;
			turn.since += dt;
			if (Math.abs(turn.velocity) < AUTO_SPEED && turn.since > AUTO_RESUME) {
				turn.mode = 'auto';
				spin.autoRamp = Math.abs(turn.velocity) / AUTO_SPEED;
			}
		} else if (turn.mode === 'seek') {
			// A critically damped spring onto the chosen face.
			const k = 26;
			const c = 2 * Math.sqrt(k) * 0.82;
			turn.velocity += (k * (turn.seekTo - turn.yaw) - c * turn.velocity) * dt;
			turn.yaw += turn.velocity * dt;
			turn.since += dt;
			if (turn.since > SEEK_HOLD) {
				turn.mode = 'auto';
				spin.autoRamp = 0;
			}
		} else if (drag) {
			// While dragged, the yaw is set by the hand; report the hand's speed.
			turn.velocity = drag.speed;
		}

		// Scroll turns it to its back as the hero leaves.
		const scrollGoal = reducedMotion ? 0 : scrollProgress() * Math.PI;
		const sk = 40;
		turn.scrollVelocity += (sk * (scrollGoal - turn.scroll) - 2 * Math.sqrt(sk) * turn.scrollVelocity) * dt;
		turn.scroll += turn.scrollVelocity * dt;

		// Pitch springs back to the hover lean when not held.
		if (!drag) {
			const k = 34;
			const c = 2 * Math.sqrt(k) * 0.45;
			turn.pitchVelocity += (k * (body.leanPitch - turn.pitch) - c * turn.pitchVelocity) * dt;
			turn.pitch += turn.pitchVelocity * dt;
		}

		// The body: hover drift, scroll kick, a slow float.
		const bk = 70;
		const bc = 2 * Math.sqrt(bk) * 0.48;
		body.vx += (bk * (body.goalX - body.x) - bc * body.vx) * dt;
		body.vy += (bk * (body.goalY - body.y) - bc * body.vy) * dt;
		body.x += body.vx * dt;
		body.y = THREE.MathUtils.clamp(body.y + body.vy * dt, -0.2, 0.2);
		const float = reducedMotion ? 0 : Math.sin(clock * 1.1) * 0.025;
		const floatVelocity = reducedMotion ? 0 : Math.cos(clock * 1.1) * 0.0275;

		// The hover lean, sprung (a little loose, so it overshoots as it turns to you).
		const lk = 30;
		lean.v += (lk * ((drag ? 0 : body.leanYaw) - lean.yaw) - 2 * Math.sqrt(lk) * 0.55 * lean.v) * dt;
		lean.yaw += lean.v * dt;
		// Dragging tilts it with the hand's speed, like cloth on a hanger flicked sideways.
		const rk = 40;
		const rollGoal = drag ? THREE.MathUtils.clamp(-drag.speed * 0.03, -0.22, 0.22) : 0;
		roll.v += (rk * (rollGoal - roll.value) - 2 * Math.sqrt(rk) * 0.35 * roll.v) * dt;
		roll.value += roll.v * dt;
		// The squash: kicked by a press or a breath, it rings out on a spring.
		const sk2 = 160;
		squash.v += (sk2 * (0 - squash.value) - 2 * Math.sqrt(sk2) * 0.22 * squash.v) * dt;
		squash.value += squash.v * dt;
		// The reveal's rim-light flare, fading out over a second or so.
		if (flare.value > 0.001) {
			flare.value *= Math.exp(-dt * 1.8);
			rim.intensity = RIM * (1 + flare.value * 2.2);
			rimLeft.intensity = RIM_LEFT * (1 + flare.value * 2.2);
			key.intensity = KEY * (1 + flare.value * 0.25);
		}

		const yaw = turn.yaw + turn.scroll + lean.yaw;
		const yawVelocity = turn.velocity + turn.scrollVelocity + lean.v;
		// A held pull draws the whole piece toward you and tips it into the pinch:
		// the pinched side comes forward, as if the shirt were being tugged closer.
		const tug = Math.max(press.pressing, 0) * press.strength;
		const tugX = press.has ? THREE.MathUtils.clamp(press.local.x, -0.6, 0.6) : 0;
		const tugY = press.has ? THREE.MathUtils.clamp(press.local.y, -0.6, 0.6) : 0;
		pose.position.set(body.x, body.y + float, tug * 0.14);
		pose.rotation.set(turn.pitch + tugY * tug * 0.35, yaw - tugX * tug * 0.3, roll.value);
		// Volume-preserving: squashed shorter, it goes a touch wider.
		pose.scale.set(1 - squash.value * 0.5, 1 + squash.value, 1 - squash.value * 0.5);
		pose.updateMatrixWorld(true);

		// The touch: where the pointer meets the piece, carried into its own space.
		const pressGoal = pointer && !reducedMotion ? 1 : 0;
		press.strength += (pressGoal - press.strength) * Math.min(1, dt * 10);
		// Hover creases; a held press dents. Blended, so one turns into the other.
		// The pull is a spring: it overshoots a touch as the cloth is grabbed, and
		// on release it snaps back past rest and settles, like stretched fabric.
		const pk = 120;
		press.pullV += (pk * ((drag ? 1 : 0) - press.pressing) - 2 * Math.sqrt(pk) * 0.42 * press.pullV) * dt;
		press.pressing += press.pullV * dt;
		if (garment.press) {
			if (pointer) {
				const rect = canvas.getBoundingClientRect();
				ndc.set(((pointer.x - rect.left) / rect.width) * 2 - 1, -((pointer.y - rect.top) / rect.height) * 2 + 1);
				raycaster.setFromCamera(ndc, camera);
				// The plane through the piece, facing the camera, at its front.
				pressPlane.set(new THREE.Vector3(0, 0, 1), -garment.depth * 0.6);
				if (raycaster.ray.intersectPlane(pressPlane, press.world)) press.has = true;
			}
			inversePose.copy(pose.matrixWorld).invert();
			press.local.copy(press.world).applyMatrix4(inversePose);
			press.view.copy(camera.position).applyMatrix4(inversePose).sub(press.local).normalize();
			// The hand's motion over the cloth, in the cloth's own space (so the piece
			// turning under a still hand counts too), smoothed, ~1 for a brisk pass.
			if (pointer && press.has && dt > 0) {
				if (press.tracking) {
					press.velocity.subVectors(press.local, press.last).divideScalar(dt * 0.7);
					press.pull.lerp(press.velocity, Math.min(1, dt * 6));
					if (press.pull.length() > 1.5) press.pull.setLength(1.5);
				}
				press.last.copy(press.local);
				press.tracking = true;
			} else {
				press.pull.multiplyScalar(Math.exp(-dt * 4));
				press.tracking = false;
			}
			garment.press(
				press.has && press.strength > 0.002 ? press.local : null,
				press.view,
				press.strength,
				press.pull,
				press.pressing
			);
		}

		// The shadow tightens and darkens as the piece comes down.
		const lift = body.y + float;
		shadow.mesh.scale.set(WIDTH * (1.05 - lift * 0.6), WIDTH * 0.3 * (1 - lift * 0.4), 1);
		(shadow.mesh.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(0.9 - lift * 1.6, 0.4, 1);

		// Moving it stirs the cloth: a hard turn or bounce sets the hem going.
		const stir = Math.min(
			Math.abs(yawVelocity) * 0.6 + Math.abs(turn.pitchVelocity) * 1.2 + Math.abs(body.vy) * 2.4 + Math.abs(squash.v) * 0.8,
			3.2
		);
		const gust = 0.85 + Math.sin(clock * 0.31) * 0.22 + Math.sin(clock * 0.83) * 0.1;
		garment.update(
			{
				time: clock,
				dt,
				yaw,
				yawVelocity,
				pitch: turn.pitch,
				pitchVelocity: turn.pitchVelocity,
				bobVelocity: body.vy + floatVelocity,
				wind: reducedMotion ? 0.3 : gust + stir
			},
			pose.matrixWorld
		);

		const facing: Side = Math.cos(yaw) >= 0 ? 'front' : 'back';
		if (facing !== side) {
			side = facing;
			onSide?.(side);
		}

		renderer.render(scene, camera);
		govern(ms, dt);
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
		face(target) {
			const current = turn.yaw + turn.scroll;
			const goal = target === 'front' ? 0 : Math.PI;
			turn.seekTo = turn.yaw + shortest(current, goal);
			turn.mode = 'seek';
			turn.since = 0;
		},
		reveal() {
			if (!held) return;
			held = false;
			if (reducedMotion) return;
			/**
			 * The moment the picture becomes an object. It lifts off the page
			 * with a breath, swings round far enough to show it has a side and
			 * a back (a coast, so it slows into the idle turn on its own), the
			 * rim light flares across its edge, and a ripple runs down from the
			 * collar as if it had just been picked up.
			 */
			squash.v += 0.8;
			body.vy += 1.1;
			turn.mode = 'coast';
			turn.velocity = 3.2;
			turn.since = 0;
			flare.value = 1;
			garment.poke(pose.localToWorld(new THREE.Vector3(0, height * 0.42, garment.depth * 0.6)), 1.3);
			setTimeout(
				() => garment.poke(pose.localToWorld(new THREE.Vector3(0, height * 0.05, garment.depth)), 1),
				220
			);
		},
		snapshot() {
			// Read back in the same task as the render, so the drawing buffer is intact.
			renderer.render(scene, camera);
			return canvas.toDataURL('image/png');
		},
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
			window.removeEventListener('scroll', onScroll);
			garment.dispose();
			shadow.dispose();
			environment.dispose();
			frontTexture.dispose();
			backTexture.dispose();
			renderer.dispose();
		}
	};
}
