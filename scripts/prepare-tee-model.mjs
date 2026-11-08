/**
 * Turn the hero tee's OBJ (a Marvelous Designer export) into a small GLB for
 * the web: one primitive per fabric part, centred, scaled to unit height,
 * welded, quantised and meshopt-compressed.
 *
 *   node scripts/prepare-tee-model.mjs <three dir> <in.obj> <out.glb>
 *
 * Needs @gltf-transform/core, /functions, /extensions, meshoptimizer and
 * three-mesh-bvh (with its peer three)
 * resolvable from this script's folder (they are not project dependencies;
 * install them beside a copy of the script, e.g. in a scratch folder).
 * See docs/tee-model.md.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Document, NodeIO, PropertyType } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const [threeDir, input, output] = process.argv.slice(2);
const THREE = await import(pathToFileURL(`${threeDir}/build/three.module.js`).href);
const { OBJLoader } = await import(pathToFileURL(`${threeDir}/examples/jsm/loaders/OBJLoader.js`).href);

/** Marvelous names its materials after the pattern piece; collapse them to parts. */
function partOf(name) {
	if (/collar/i.test(name)) return 'collar';
	if (/patch|label/i.test(name)) return 'label';
	return 'body';
}

const root = new OBJLoader().parse(readFileSync(input, 'utf8'));
root.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(root);
const centre = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());
const scale = 1 / size.y;

/** part → { positions, normals, uvs } */
const parts = new Map();
root.traverse((object) => {
	if (!object.isMesh) return;
	const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
	const materials = Array.isArray(object.material) ? object.material : [object.material];
	const groups = geometry.groups.length
		? geometry.groups
		: [{ start: 0, count: geometry.attributes.position.count, materialIndex: 0 }];
	const pos = geometry.attributes.position;
	const nor = geometry.attributes.normal;
	const uv = geometry.attributes.uv;
	for (const group of groups) {
		const part = partOf(materials[group.materialIndex ?? 0]?.name ?? '');
		if (!parts.has(part)) parts.set(part, { positions: [], normals: [], uvs: [] });
		const out = parts.get(part);
		for (let i = group.start; i < group.start + group.count; i++) {
			out.positions.push(
				(pos.getX(i) - centre.x) * scale,
				(pos.getY(i) - centre.y) * scale,
				(pos.getZ(i) - centre.z) * scale
			);
			if (nor) out.normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
			if (uv) out.uvs.push(uv.getX(i), uv.getY(i));
		}
	}
});

/**
 * Normals, recomputed from the triangles. The export's own normals point
 * inward on some pattern pieces while their triangles face outward; anything
 * offset along the normal (the cloth's thickness, the occlusion rays, the
 * dent) then goes the wrong way there, and the shading breaks along seams.
 * Face normals follow the winding (which is consistent: the outside renders
 * whole), accumulated per position across every piece and part so the
 * surface is smooth over sewn seams.
 */
{
	const sums = new Map();
	const keyOf = (p, i) => `${p[i].toFixed(5)},${p[i + 1].toFixed(5)},${p[i + 2].toFixed(5)}`;
	for (const data of parts.values()) {
		const p = data.positions;
		for (let f = 0; f < p.length; f += 9) {
			const ux = p[f + 3] - p[f], uy = p[f + 4] - p[f + 1], uz = p[f + 5] - p[f + 2];
			const vx = p[f + 6] - p[f], vy = p[f + 7] - p[f + 1], vz = p[f + 8] - p[f + 2];
			// Area-weighted: the cross product's length is twice the triangle's area.
			const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
			for (let c = 0; c < 9; c += 3) {
				const key = keyOf(p, f + c);
				const s = sums.get(key) ?? [0, 0, 0];
				s[0] += nx;
				s[1] += ny;
				s[2] += nz;
				sums.set(key, s);
			}
		}
	}
	let flipped = 0;
	for (const data of parts.values()) {
		const p = data.positions;
		const normals = new Array(p.length);
		for (let i = 0; i < p.length; i += 3) {
			const [x, y, z] = sums.get(keyOf(p, i));
			const len = Math.hypot(x, y, z) || 1;
			normals[i] = x / len;
			normals[i + 1] = y / len;
			normals[i + 2] = z / len;
			if (data.normals.length && normals[i] * data.normals[i] + normals[i + 1] * data.normals[i + 1] + normals[i + 2] * data.normals[i + 2] < 0) flipped++;
		}
		data.normals = normals;
	}
	console.log(`normals recomputed from winding (${flipped} of the export's pointed inward)`);
}

/**
 * Ambient occlusion, baked per vertex: the soft shadow inside every fold,
 * under the collar and in the armholes. Rays are cast over the hemisphere
 * around each vertex's normal against the whole garment (BVH-accelerated);
 * only nearby hits count, so it measures local creasing, not the far side
 * of the shirt. Stored as COLOR_0 (grey) and applied to the light in the
 * shader at runtime.
 */
const { MeshBVH } = await import('three-mesh-bvh');
const BVHTHREE = await import('three');
{
	const all = [];
	for (const data of parts.values()) for (const value of data.positions) all.push(value);
	const geometry = new BVHTHREE.BufferGeometry();
	geometry.setAttribute('position', new BVHTHREE.Float32BufferAttribute(all, 3));
	const bvh = new MeshBVH(geometry);
	const RAYS = 64;
	const REACH = 0.09; // in unit-height space: about 6 cm on this garment
	// A fixed cosine-weighted hemisphere (Fibonacci spiral), rotated per vertex.
	const dirs = [];
	for (let i = 0; i < RAYS; i++) {
		const r = Math.sqrt((i + 0.5) / RAYS);
		const phi = i * 2.399963;
		dirs.push([r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - r * r)]);
	}
	const ray = new BVHTHREE.Ray();
	const n = new BVHTHREE.Vector3();
	const t = new BVHTHREE.Vector3();
	const b = new BVHTHREE.Vector3();
	const cache = new Map();
	let done = 0;
	/**
	 * Hits nearer than this are ignored. A garment export stacks seam
	 * allowances, hems and facings a millimetre apart; counted, they print
	 * every seam as a thin black scratch. Real folds are further apart.
	 */
	const NEAR = 0.006; // ≈ 4 mm on this garment
	/** Unique positions, for smoothing across the mesh afterwards. */
	const ids = new Map();
	const idOf = (data, v) => {
		const key = `${data.positions[v * 3].toFixed(5)},${data.positions[v * 3 + 1].toFixed(5)},${data.positions[v * 3 + 2].toFixed(5)}`;
		let id = ids.get(key);
		if (id === undefined) ids.set(key, (id = ids.size));
		return id;
	};
	for (const data of parts.values()) {
		const count = data.positions.length / 3;
		data.ao = new Float32Array(count * 3);
		data.raw = new Float32Array(count);
		data.ids = new Int32Array(count);
		for (let v = 0; v < count; v++) data.ids[v] = idOf(data, v);
		for (let v = 0; v < count; v++) {
			const p = data.positions.slice(v * 3, v * 3 + 3);
			n.fromArray(data.normals, v * 3).normalize();
			const key = `${p.map((x) => x.toFixed(5)).join(',')}|${n.toArray().map((x) => x.toFixed(2)).join(',')}`;
			let ao = cache.get(key);
			if (ao === undefined) {
				t.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0).cross(n).normalize();
				b.crossVectors(n, t);
				let blocked = 0;
				const spin = (v * 0.618) % 1 * Math.PI * 2;
				const cs = Math.cos(spin);
				const sn = Math.sin(spin);
				for (const [dx0, dy0, dz] of dirs) {
					const dx = dx0 * cs - dy0 * sn;
					const dy = dx0 * sn + dy0 * cs;
					ray.direction.set(
						t.x * dx + b.x * dy + n.x * dz,
						t.y * dx + b.y * dy + n.y * dz,
						t.z * dx + b.z * dy + n.z * dz
					);
					ray.origin.set(p[0], p[1], p[2]);
					const hit = bvh.raycastFirst(ray, BVHTHREE.DoubleSide, NEAR, REACH);
					if (hit) blocked += 1 - (hit.distance - NEAR) / (REACH - NEAR);
				}
				ao = 1 - blocked / RAYS;
				cache.set(key, ao);
			}
			data.raw[v] = ao;
			if (++done % 20000 === 0) process.stdout.write(`  ao ${done}\r`);
		}
	}

	// Smooth across neighbouring vertices: occlusion in cloth is soft, and a
	// few passes wash out single-vertex specks without blurring the folds away.
	const sum = new Float32Array(ids.size);
	const weight = new Float32Array(ids.size);
	for (const data of parts.values()) {
		for (let v = 0; v < data.raw.length; v++) {
			sum[data.ids[v]] += data.raw[v];
			weight[data.ids[v]] += 1;
		}
	}
	let value = sum.map((s, i) => s / weight[i]);
	for (let pass = 0; pass < 3; pass++) {
		const next = new Float32Array(ids.size);
		const count = new Float32Array(ids.size);
		for (const data of parts.values()) {
			// Non-indexed: every three vertices are a triangle; share with its corners.
			for (let f = 0; f < data.ids.length; f += 3) {
				const tri = [data.ids[f], data.ids[f + 1], data.ids[f + 2]];
				const mean = (value[tri[0]] + value[tri[1]] + value[tri[2]]) / 3;
				for (const id of tri) {
					next[id] += mean;
					count[id] += 1;
				}
			}
		}
		value = value.map((own, i) => (count[i] ? own * 0.4 + (next[i] / count[i]) * 0.6 : own));
	}
	for (const data of parts.values()) {
		for (let v = 0; v < data.raw.length; v++) {
			// Lift the floor: cloth is translucent, folds are never black.
			const ao = 0.3 + 0.7 * Math.pow(value[data.ids[v]], 1.2);
			data.ao[v * 3] = data.ao[v * 3 + 1] = data.ao[v * 3 + 2] = ao;
		}
	}
	console.log(`ambient occlusion baked (${cache.size} samples, ${ids.size} positions, smoothed)`);

	/**
	 * Open edges, flagged in COLOR_0's green channel for the runtime rim (the
	 * cloth's visible thickness). An edge of the mesh is either a real opening
	 * — hem, cuff, neck: open air beyond it — or the edge of a seam allowance
	 * or facing tucked against another layer. Only the first should show a cut
	 * edge; a rim on the second would poke through the cloth. Test: step just
	 * past the edge, within the surface, and see whether any cloth is there.
	 */
	const edgeCount = new Map();
	const edgeDir = new Map();
	for (const data of parts.values()) {
		for (let f = 0; f < data.ids.length; f += 3) {
			for (let e = 0; e < 3; e++) {
				const a = f + e;
				const b = f + ((e + 1) % 3);
				const ka = data.ids[a];
				const kb = data.ids[b];
				const key = ka < kb ? `${ka}_${kb}` : `${kb}_${ka}`;
				edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
				if (!edgeDir.has(key)) edgeDir.set(key, { data, a, b });
			}
		}
	}
	const open = new Uint8Array(ids.size);
	const probe = new BVHTHREE.Vector3();
	const target = { point: new BVHTHREE.Vector3(), distance: 0 };
	const pa = new BVHTHREE.Vector3();
	const pb = new BVHTHREE.Vector3();
	const nn = new BVHTHREE.Vector3();
	const outward = new BVHTHREE.Vector3();
	let opens = 0;
	let boundaries = 0;
	for (const [key, count] of edgeCount) {
		if (count !== 1) continue;
		boundaries++;
		const { data, a, b } = edgeDir.get(key);
		pa.fromArray(data.positions, a * 3);
		pb.fromArray(data.positions, b * 3);
		nn.fromArray(data.normals, a * 3).add(new BVHTHREE.Vector3().fromArray(data.normals, b * 3)).normalize();
		outward.subVectors(pb, pa).cross(nn).normalize();
		probe.addVectors(pa, pb).multiplyScalar(0.5).addScaledVector(outward, 0.012);
		bvh.closestPointToPoint(probe, target);
		if (target.distance > 0.008) {
			open[data.ids[a]] = 1;
			open[data.ids[b]] = 1;
			opens++;
		}
	}
	for (const data of parts.values()) {
		for (let v = 0; v < data.ids.length; v++) data.ao[v * 3 + 1] = open[data.ids[v]];
	}
	console.log(`open edges: ${opens} of ${boundaries} boundary edges`);
}

const document = new Document();
const buffer = document.createBuffer();
const mesh = document.createMesh('tee');
for (const [part, data] of parts) {
	const count = data.positions.length / 3;
	const primitive = document
		.createPrimitive()
		.setAttribute(
			'POSITION',
			document.createAccessor().setType('VEC3').setArray(new Float32Array(data.positions)).setBuffer(buffer)
		)
		.setMaterial(document.createMaterial(part));
	if (data.normals.length === count * 3) {
		primitive.setAttribute(
			'NORMAL',
			document.createAccessor().setType('VEC3').setArray(new Float32Array(data.normals)).setBuffer(buffer)
		);
	}
	if (data.uvs.length === count * 2) {
		primitive.setAttribute(
			'TEXCOORD_0',
			document.createAccessor().setType('VEC2').setArray(new Float32Array(data.uvs)).setBuffer(buffer)
		);
	}
	primitive.setAttribute(
		'COLOR_0',
		document.createAccessor().setType('VEC3').setArray(data.ao).setBuffer(buffer)
	);
	mesh.addPrimitive(primitive);
	const uvs = data.uvs;
	let [u0, u1, v0, v1] = [Infinity, -Infinity, Infinity, -Infinity];
	for (let i = 0; i < uvs.length; i += 2) {
		u0 = Math.min(u0, uvs[i]);
		u1 = Math.max(u1, uvs[i]);
		v0 = Math.min(v0, uvs[i + 1]);
		v1 = Math.max(v1, uvs[i + 1]);
	}
	console.log(`${part}: ${count / 3} triangles, uv u ${u0.toFixed(2)}…${u1.toFixed(2)} v ${v0.toFixed(2)}…${v1.toFixed(2)}`);
}
document.createScene().addChild(document.createNode('tee').setMesh(mesh));
document.createExtension(KHRMeshQuantization);
document.createExtension(EXTMeshoptCompression).setRequired(true);

await MeshoptEncoder.ready;
await document.transform(
	weld(),
	// Materials stay apart: they differ only by name, and the name says which part it is.
	dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }),
	prune(),
	quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
	meshopt({ encoder: MeshoptEncoder, level: 'medium' })
);

const io = new NodeIO()
	.registerExtensions([KHRMeshQuantization, EXTMeshoptCompression])
	.registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await io.write(output, document);
console.log(`wrote ${output} — model was ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)}, scaled ×${scale.toExponential(3)}`);
