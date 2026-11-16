/** Draws the islands and the pieces, and keeps them in step with the state. */

import * as THREE from 'three';
import { ISLANDS, PIECE, PIECES, TUNE } from './content.ts';
import type { ComboDef, PieceId } from './content.ts';
import { burst, dropGlow, fxBudget, makeGlow, softTexture, spark } from './fx.ts';
import { blankCtx, buildPiece, disposeModel, Kit, MAT } from './models.ts';
import type { Ctx, Model } from './models.ts';
import { env, makeCloud, wishSources } from './sky.ts';
import { combosAt, isLand, pieceAt, S, spillSides } from './state.ts';
import { clamp, DX, DZ, hash2, key, rng, unkey } from './util.ts';

export const world = new THREE.Group();

/** A waterfall that pours off an island edge. `x` and `z` are where the water leaves the land. */
export interface Fall {
	x: number;
	z: number;
	d: number;
	/** How far the water falls. */
	h: number;
	island: number;
}

interface IslandView {
	group: THREE.Group;
	/** A locked island shows as a dim shape. */
	ghost: boolean;
	top: THREE.Mesh;
	tufts: THREE.InstancedMesh;
	blooms: THREE.InstancedMesh;
	clouds: THREE.Object3D[];
	glows: THREE.Sprite[];
	falls: Fall[];
	phase: number;
	/** 0 when it just appeared, 1 when it is in place. */
	rise: number;
	dirtyColor: boolean;
	dirtyDecor: boolean;
}

interface PieceView {
	holder: THREE.Group;
	model: Model;
	glows: THREE.Sprite[];
	/** Time since the pop began, or -1 when it is over. */
	pop: number;
	popSize: number;
	/** Time to stay hidden before the pop, for a bridge that grows cell by cell. */
	wait: number;
	air: boolean;
	x: number;
	z: number;
}

const islands: IslandView[] = [];
const pieces = new Map<string, PieceView>();
const bridgeGroup = new THREE.Group();
const emitters: { x: number; z: number; def: ComboDef }[] = [];
const spills: { x: number; z: number; d: number }[] = [];
let wet = new Set<string>();
let lushTimer = 0;

const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
const tuftGeo = new THREE.ConeGeometry(0.035, 0.13, 4);
tuftGeo.translate(0, 0.065, 0);
const bloomGeo = new THREE.IcosahedronGeometry(0.035, 0);
const decorMat = new THREE.MeshLambertMaterial({ flatShading: true });
const mistTexture = softTexture('rgba(255,255,255,0.55)');

const cursor = makeCursor();
let ghost: THREE.Group | null = null;
let ghostKey = '';
let cursorFlash = 0;

const DRY = new THREE.Color();
const LUSH = new THREE.Color();

const ghostMat = new THREE.MeshBasicMaterial({ color: 0xa9bce0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
const GHOST_DAY = new THREE.Color(0xa9bce0);
const GHOST_NIGHT = new THREE.Color(0x3d4590);

/** Falling water: streaks that run down, soft at the sides and at the end. */
const fallMat = new THREE.ShaderMaterial({
	uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
	vertexShader: `
		attribute float fade;
		varying vec2 vUv;
		varying float vFade;
		void main() {
			vUv = uv;
			vFade = fade;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}`,
	fragmentShader: `
		uniform float uTime;
		uniform float uNight;
		varying vec2 vUv;
		varying float vFade;
		float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
		float noise(vec2 p) {
			vec2 i = floor(p);
			vec2 f = fract(p);
			f = f * f * (3.0 - 2.0 * f);
			return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
		}
		void main() {
			float a = noise(vec2(vUv.x * 6.0, vUv.y * 1.3 - uTime * 3.0));
			float b = noise(vec2(vUv.x * 14.0 + 3.0, vUv.y * 3.0 - uTime * 5.0));
			float streak = smoothstep(0.3, 0.8, a * 0.6 + b * 0.4);
			float side = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
			vec3 col = mix(vec3(0.42, 0.74, 0.9), vec3(1.0), streak);
			col = mix(col, col * vec3(0.5, 0.62, 1.0), uNight * 0.55);
			gl_FragColor = vec4(col, side * (0.6 + 0.4 * streak) * vFade);
			#include <colorspace_fragment>
		}`,
	transparent: true,
	depthWrite: false,
	side: THREE.DoubleSide,
});

/** A ribbon of water that leaves the edge and curves down. It points along +z. */
function fallGeometry(h: number): THREE.BufferGeometry {
	const seg = 12;
	const pos: number[] = [];
	const uv: number[] = [];
	const fade: number[] = [];
	const index: number[] = [];
	for (let i = 0; i <= seg; i++) {
		const t = i / seg;
		const y = 0.05 - t * h;
		const out = 0.02 + 0.5 * Math.sqrt(t);
		const w = 0.24 + 0.12 * t;
		pos.push(-w, y, out, w, y, out);
		uv.push(0, t * h, 1, t * h);
		const f = Math.min(1, (1 - t) * 3.5);
		fade.push(f, f);
		if (i < seg) index.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setAttribute('fade', new THREE.Float32BufferAttribute(fade, 1));
	g.setIndex(index);
	return g;
}
const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export function initView(scene: THREE.Scene): void {
	scene.add(world);
	world.add(bridgeGroup, cursor, route);
}

/* Heights */

const waveAt = (x: number, z: number): number => Math.sin(env.time * 0.55 + x * 0.2 + z * 0.15) * 0.07;

/** The height of the ground on a cell now. The islands bob a little. */
export function groundY(x: number, z: number): number {
	const i = S.land.get(key(Math.round(x), Math.round(z)));
	if (i === undefined || !islands[i] || islands[i].ghost) return waveAt(x, z);
	return islands[i].group.position.y;
}

/* Lushness: grass grows near water. */

export function lushAt(k: string): number {
	return S.lush.get(k) ?? 0.12;
}

/** Makes the grass lush around a cell at once, for a jelly gift. Returns how many cells changed. */
export function blessLand(x: number, z: number, reach: number): number {
	let n = 0;
	for (let dx = -reach; dx <= reach; dx++) for (let dz = -reach; dz <= reach; dz++) {
		if (Math.abs(dx) + Math.abs(dz) > reach + 1) continue;
		const k = key(x + dx, z + dz);
		const island = S.land.get(k);
		if (island === undefined) continue;
		S.lush.set(k, 1);
		islands[island].dirtyColor = islands[island].dirtyDecor = true;
		n++;
	}
	return n;
}

function findWetCells(): void {
	wet = new Set();
	for (const [k, p] of S.pieces) {
		if (!PIECE[p.t].water) continue;
		const [x, z] = unkey(k);
		const n = TUNE.waterReach;
		for (let dx = -n; dx <= n; dx++) for (let dz = -n; dz <= n; dz++) if (Math.abs(dx) + Math.abs(dz) <= n + 1) wet.add(key(x + dx, z + dz));
	}
}

function growGrass(): void {
	for (const [k, island] of S.land) {
		const now = lushAt(k);
		let next = now;
		if (wet.has(k)) next = Math.min(1, now + 0.03);
		else {
			const [x, z] = unkey(k);
			let best = 0;
			for (let d = 0; d < 4; d++) best = Math.max(best, lushAt(key(x + DX[d], z + DZ[d])));
			if (best - 0.3 > now) next = Math.min(best - 0.3, now + 0.012);
		}
		if (next === now) continue;
		S.lush.set(k, next);
		const view = islands[island];
		if (!view || view.ghost) continue;
		view.dirtyColor = true;
		if ((now < 0.45 && next >= 0.45) || (now < 0.75 && next >= 0.75) || (now < 0.85 && next >= 0.85)) view.dirtyDecor = true;
	}
}

/* Islands */

function buildIsland(index: number, ghost: boolean): IslandView {
	const cells = S.islandCells[index];
	const def = ISLANDS[index];
	const mine = new Set(cells.map(([x, z]) => key(x, z)));
	const has = (x: number, z: number): boolean => mine.has(key(x, z));

	// How far each cell is from the edge of the island.
	const depth = new Map<string, number>();
	let ring = cells.filter(([x, z]) => [0, 1, 2, 3].some((d) => !has(x + DX[d], z + DZ[d])));
	let level = 0;
	while (ring.length) {
		level++;
		for (const [x, z] of ring) depth.set(key(x, z), level);
		const next = new Map<string, [number, number]>();
		for (const [x, z] of ring) {
			for (let d = 0; d < 4; d++) {
				const nk = key(x + DX[d], z + DZ[d]);
				if (mine.has(nk) && !depth.has(nk)) next.set(nk, [x + DX[d], z + DZ[d]]);
			}
		}
		ring = [...next.values()];
	}

	// The rock is a deep chunk: a cliff at the edge, then a long jagged point.
	const LIP = -0.7;
	const drop = (low: number): number => Math.pow(low, 1.28) * 1.05;
	const maxDepth = -LIP + drop(level);
	const cloudDepth = maxDepth * 0.7;
	const cornerY = (cx: number, cz: number): number => {
		let low = 99;
		for (const [ox, oz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) low = Math.min(low, depth.get(key(cx + ox, cz + oz)) ?? 0);
		if (low === 0) return LIP - hash2(cx, cz, def.seed + 5) * 0.3;
		const spike = hash2(cx, cz, def.seed + 7) > 0.88 ? 0.8 + low * 0.4 : 0;
		return LIP - drop(low) * (0.78 + hash2(cx, cz, def.seed) * 0.44) - spike;
	};

	const topPos: number[] = [];
	const bodyPos: number[] = [];
	const bodyCol: number[] = [];
	const earth = new THREE.Color(0x8a6248);
	const rock = new THREE.Color(def.rock);
	const deep = new THREE.Color(def.deep);
	const grassEdge = new THREE.Color(def.lush).lerp(new THREE.Color(def.dry), 0.35);
	const push = (x: number, y: number, z: number, c: THREE.Color): void => {
		bodyPos.push(x, y, z);
		bodyCol.push(c.r, c.g, c.b);
	};
	/** The rock has layers. It turns darker toward the point. */
	const rockColor = (y: number, x: number, z: number): THREE.Color => {
		const d = -y;
		const c = new THREE.Color();
		if (d < 1.7) c.copy(earth).lerp(rock, clamp((d - 0.5) / 1.2, 0, 1));
		else c.copy(rock).lerp(deep, clamp((d - 1.7) / (maxDepth * 0.7), 0, 0.8));
		const layer = Math.floor(d * 1.1 + hash2(x, z, def.seed + 2) * 0.6) % 3;
		return c.multiplyScalar((layer === 0 ? 0.88 : layer === 1 ? 1 : 1.12) * (0.96 + hash2(x, z, def.seed + 3) * 0.08));
	};

	const edges: { x: number; z: number; d: number }[] = [];
	for (const [x, z] of cells) {
		const x0 = x - 0.5;
		const x1 = x + 0.5;
		const z0 = z - 0.5;
		const z1 = z + 0.5;
		topPos.push(x0, 0, z0, x0, 0, z1, x1, 0, z0, x1, 0, z0, x0, 0, z1, x1, 0, z1);

		// The cliff: grass, earth and the first rock, where the island ends.
		for (let d = 0; d < 4; d++) {
			if (has(x + DX[d], z + DZ[d])) continue;
			edges.push({ x, z, d });
			const ax = d === 1 ? x1 : x0;
			const az = d === 2 ? z1 : z0;
			const bx = d === 3 ? x0 : x1;
			const bz = d === 0 ? z0 : z1;
			const ay = cornerY(ax + 0.5, az + 0.5);
			const by = cornerY(bx + 0.5, bz + 0.5);
			const band = (aTop: number, bTop: number, aLow: number, bLow: number, c: THREE.Color): void => {
				push(ax, aTop, az, c);
				push(bx, bTop, bz, c);
				push(ax, aLow, az, c);
				push(bx, bTop, bz, c);
				push(bx, bLow, bz, c);
				push(ax, aLow, az, c);
			};
			band(0, 0, -0.14, -0.14, grassEdge);
			band(-0.14, -0.14, -0.42, -0.42, earth);
			band(-0.42, -0.42, ay, by, rockColor((ay + by) / 2, x * 4 + d, z));
		}

		// The rock below: four triangles that meet under the middle of the cell.
		const corners: [number, number, number][] = [
			[x0, cornerY(x, z), z0],
			[x1, cornerY(x + 1, z), z0],
			[x1, cornerY(x + 1, z + 1), z1],
			[x0, cornerY(x, z + 1), z1],
		];
		const midY = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4 - 0.5 * hash2(x, z, def.seed + 1) * Math.min(3, depth.get(key(x, z)) ?? 1);
		for (let i = 0; i < 4; i++) {
			const a = corners[i];
			const b = corners[(i + 1) % 4];
			const c = rockColor((a[1] + b[1] + midY) / 3, x * 4 + i, z);
			push(a[0], a[1], a[2], c);
			push(b[0], b[1], b[2], c);
			push(x, midY, z, c);
		}
	}

	const topGeo = new THREE.BufferGeometry();
	topGeo.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
	topGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(topPos.length), 3));
	topGeo.computeVertexNormals();
	const top = new THREE.Mesh(topGeo, ghost ? ghostMat : MAT.solid);
	top.receiveShadow = !ghost;

	const bodyGeo = new THREE.BufferGeometry();
	bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(bodyPos, 3));
	bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(bodyCol, 3));
	bodyGeo.computeVertexNormals();
	const body = new THREE.Mesh(bodyGeo, ghost ? ghostMat : bodyMat);
	body.castShadow = !ghost;

	const tufts = new THREE.InstancedMesh(tuftGeo, decorMat, cells.length * 3);
	const blooms = new THREE.InstancedMesh(bloomGeo, decorMat, cells.length * 2);
	tufts.count = blooms.count = 0;
	tufts.receiveShadow = true;

	const group = new THREE.Group();
	group.add(top, body, tufts, blooms);
	const glows: THREE.Sprite[] = [];
	const falls: Fall[] = [];
	const clouds: THREE.Object3D[] = [];
	const rand = rng(def.seed + 9);
	const size = def.r / 7.6;

	const addCloud = (x: number, y: number, z: number, scale: number): void => {
		const cloud = makeCloud(rand);
		cloud.position.set(x, y, z);
		cloud.scale.setScalar(scale);
		cloud.rotation.y = rand() * 6.28;
		cloud.userData.x0 = x;
		cloud.userData.y0 = y;
		cloud.userData.phase = rand() * 6.28;
		clouds.push(cloud);
		group.add(cloud);
	};

	if (!ghost) {
		const deco = new Kit();
		const grassHex = grassEdge.getHex();
		const leafHex = new THREE.Color(def.lush).getHex();

		// Moss hangs over the cliff, and roots hang below it.
		for (const e of edges) {
			const h = hash2(e.x * 4 + e.d, e.z, def.seed + 20);
			const h2 = hash2(e.x, e.z * 4 + e.d, def.seed + 21);
			const along = DZ[e.d] !== 0;
			const px = e.x + DX[e.d] * 0.53 + (along ? (h2 - 0.5) * 0.5 : 0);
			const pz = e.z + DZ[e.d] * 0.53 + (along ? 0 : (h2 - 0.5) * 0.5);
			if (h < 0.5) {
				const w = 0.25 + h * 0.7;
				const tall = 0.2 + h2 * 0.45;
				deco.box('solid', grassHex, along ? w : 0.07, tall, along ? 0.07 : w, px, 0.02 - tall, pz);
			} else if (h < 0.7) {
				const len = 0.8 + h2 * 2.4;
				deco.cyl('solid', 0x6e4f3a, 0.04, 0.012, len, 5, px, -0.3 - len, pz, { rz: (h2 - 0.5) * 0.3, rx: (h - 0.6) * 1.5 });
				deco.ball('solid', leafHex, 0.08, px, -0.3 - len, pz, { sy: 0.6 });
			}
		}

		// Crystals grow out of the rock.
		const spots = cells.filter(([x, z]) => (depth.get(key(x, z)) ?? 0) <= 3).sort((a, b) => hash2(a[0], a[1], def.seed + 30) - hash2(b[0], b[1], def.seed + 30));
		spots.slice(0, def.gems).forEach(([x, z], i) => {
			const h = hash2(x, z, def.seed + 31);
			const h2 = hash2(x, z, def.seed + 32);
			const color = def.gemColors[i % def.gemColors.length];
			const y = cornerY(x, z) + 0.05;
			const r = 0.2 + h * 0.3;
			deco.gem('crystal', color, r, x - 0.5, y, z - 0.5, { sy: 1.9, rx: (h - 0.5) * 2, rz: (h2 - 0.5) * 2 });
			deco.gem('crystal', color, r * 0.6, x - 0.2, y + 0.1, z - 0.6, { sy: 1.7, rx: (h2 - 0.5) * 2, rz: (h - 0.5) * 2 });
			if (i % 3 === 0) {
				const glow = makeGlow(color, 2.4);
				glow.position.set(x - 0.5, y, z - 0.5);
				glows.push(glow);
				group.add(glow);
			}
		});

		// Waterfalls pour off the edge, spread around the island.
		const order = [...edges].sort((a, b) => hash2(a.x, a.z * 4 + a.d, def.seed + 40) - hash2(b.x, b.z * 4 + b.d, def.seed + 40));
		const angles: number[] = [];
		for (const e of order) {
			if (falls.length >= def.falls) break;
			const a = Math.atan2(e.z - def.cz, e.x - def.cx);
			if (angles.some((o) => Math.abs(Math.atan2(Math.sin(a - o), Math.cos(a - o))) < 1.5)) continue;
			angles.push(a);
			const fx = e.x + DX[e.d] * 0.5;
			const fz = e.z + DZ[e.d] * 0.5;
			const h = cloudDepth + 0.8;
			const along = DZ[e.d] !== 0;
			falls.push({ x: fx, z: fz, d: e.d, h, island: index });
			for (const side of [-1, 1]) deco.ball('solid', 0x9a94ac, 0.17, fx + (along ? side * 0.34 : 0), 0.03, fz + (along ? 0 : side * 0.34), { sy: 0.8, ry: side });
			deco.box('water', 0, along ? 0.5 : 0.34, 0.05, along ? 0.34 : 0.5, fx - DX[e.d] * 0.15, 0, fz - DZ[e.d] * 0.15);
			const water = new THREE.Mesh(fallGeometry(h), fallMat);
			water.position.set(fx, 0, fz);
			water.rotation.y = Math.atan2(DX[e.d], DZ[e.d]);
			water.renderOrder = 2;
			group.add(water);
			const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTexture, transparent: true, opacity: 0.4, depthWrite: false }));
			mist.scale.set(3.2, 2.2, 1);
			mist.position.set(fx + DX[e.d] * 0.6, -h + 0.4, fz + DZ[e.d] * 0.6);
			mist.userData.mist = falls.length + def.seed;
			mist.userData.x0 = mist.position.x;
			group.add(mist);
			addCloud(fx + DX[e.d] * 0.9, -h - 0.5, fz + DZ[e.d] * 0.9, size * 0.5);
		}
		group.add(deco.build(false));
	}

	// Clouds gather around the base of the rock.
	const n = Math.round(5 + def.r * 0.8);
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 + rand() * 0.5;
		const rr = def.r * (0.25 + rand() * 0.6);
		addCloud(def.cx + Math.cos(a) * rr, -cloudDepth - 0.8 - rand() * 2.4, def.cz + Math.sin(a) * rr, size * (0.5 + rand() * 0.45));
	}

	const view: IslandView = { group, ghost, top, tufts, blooms, clouds, glows, falls, phase: def.cx * 0.2 + def.cz * 0.15, rise: 1, dirtyColor: !ghost, dirtyDecor: !ghost };
	world.add(group);
	return view;
}

function dropIsland(view: IslandView): void {
	world.remove(view.group);
	for (const g of view.glows) dropGlow(g);
	view.group.traverse((o) => {
		if (o instanceof THREE.Mesh && o.geometry !== tuftGeo && o.geometry !== bloomGeo) o.geometry.dispose();
		if (o instanceof THREE.Sprite && !o.userData.glow) o.material.dispose();
	});
}

function paintIsland(index: number): void {
	const view = islands[index];
	const cells = S.islandCells[index];
	const col = view.top.geometry.getAttribute('color') as THREE.BufferAttribute;
	DRY.set(ISLANDS[index].dry);
	LUSH.set(ISLANDS[index].lush);
	cells.forEach(([x, z], i) => {
		const l = lushAt(key(x, z));
		_c.copy(DRY).lerp(LUSH, l);
		const tone = ((x + z) & 1 ? 0.975 : 1.02) + (hash2(x, z, 4) - 0.5) * 0.04;
		for (let v = 0; v < 6; v++) col.setXYZ(i * 6 + v, _c.r * tone, _c.g * tone, _c.b * tone);
	});
	col.needsUpdate = true;
	view.dirtyColor = false;
}

function decorateIsland(index: number): void {
	const view = islands[index];
	let t = 0;
	let b = 0;
	const tones = [0xffffff, 0xffd1e0, 0xfff1a8, 0xdcc6ff];
	for (const [x, z] of S.islandCells[index]) {
		const k = key(x, z);
		const l = lushAt(k);
		if (l < 0.45 || S.pieces.has(k)) continue;
		const n = l >= 0.75 ? 3 : 2;
		for (let i = 0; i < n; i++) {
			const px = x + (hash2(x, z, 10 + i) - 0.5) * 0.8;
			const pz = z + (hash2(x, z, 20 + i) - 0.5) * 0.8;
			const h = 0.6 + hash2(x, z, 30 + i) * 0.9;
			_m.compose(_v.set(px, 0, pz), _q.identity(), _s.set(1, h, 1));
			view.tufts.setMatrixAt(t, _m);
			view.tufts.setColorAt(t, _c.set(i % 2 ? 0x6fc487 : 0x4fae78));
			t++;
		}
		if (l < 0.85) continue;
		for (let i = 0; i < 2; i++) {
			if (hash2(x, z, 40 + i) < 0.35) continue;
			_m.compose(_v.set(x + (hash2(x, z, 50 + i) - 0.5) * 0.75, 0.05, z + (hash2(x, z, 60 + i) - 0.5) * 0.75), _q.identity(), _s.set(1, 0.7, 1));
			view.blooms.setMatrixAt(b, _m);
			view.blooms.setColorAt(b, _c.set(tones[Math.floor(hash2(x, z, 70 + i) * tones.length)]));
			b++;
		}
	}
	view.tufts.count = t;
	view.blooms.count = b;
	view.tufts.instanceMatrix.needsUpdate = true;
	view.blooms.instanceMatrix.needsUpdate = true;
	if (view.tufts.instanceColor) view.tufts.instanceColor.needsUpdate = true;
	if (view.blooms.instanceColor) view.blooms.instanceColor.needsUpdate = true;
	view.dirtyDecor = false;
}

/** Brings the island views in step with the state: open islands are solid, locked ones are dim. */
export function syncIslands(animate: boolean): void {
	for (let i = 0; i < ISLANDS.length; i++) {
		const ghost = i >= S.islands;
		const old = islands[i];
		if (old && old.ghost === ghost) continue;
		if (old) dropIsland(old);
		islands[i] = buildIsland(i, ghost);
		islands[i].rise = animate && !ghost ? 0 : 1;
	}
}

/** The waterfalls of the open islands. */
export function allFalls(): Fall[] {
	return islands.flatMap((v) => (v.ghost ? [] : v.falls));
}

/** The group that holds an island, so that other things can ride on it. */
export const islandGroup = (index: number): THREE.Group | undefined => islands[index]?.group;

/* Pieces */

/** The lowest seed in a group of joined cottages. They share a roof colour. */
function clusterOf(start: string): { seed: number; cells: string[] } {
	const cells = [start];
	let seed = S.pieces.get(start)?.s ?? 0;
	for (let i = 0; i < cells.length; i++) {
		const [x, z] = unkey(cells[i]);
		for (let d = 0; d < 4; d++) {
			const k = key(x + DX[d], z + DZ[d]);
			const p = S.pieces.get(k);
			if (p?.t !== 'cottage' || cells.includes(k)) continue;
			cells.push(k);
			seed = Math.min(seed, p.s);
		}
	}
	return { seed, cells };
}

function contextOf(x: number, z: number): Ctx {
	const p = pieceAt(x, z)!;
	const sides: Ctx['sides'] = [];
	const sideR: number[] = [];
	for (let d = 0; d < 4; d++) {
		const n = pieceAt(x + DX[d], z + DZ[d]);
		sides.push(n ? n.t : isLand(x + DX[d], z + DZ[d]) ? 'land' : null);
		sideR.push(n ? n.r : 0);
	}
	return {
		r: p.r,
		seed: p.s,
		growth: p.g ?? 1,
		sides,
		sideR,
		combos: combosAt(x, z).map((c) => c.id),
		spills: p.t === 'waterfall' ? spillSides(x, z) : [],
		clusterSeed: p.t === 'cottage' ? clusterOf(key(x, z)).seed : p.s,
		homed: !!p.h,
	};
}

function removeView(k: string): void {
	const v = pieces.get(k);
	if (!v) return;
	v.holder.parent?.remove(v.holder);
	disposeModel(v.model.group);
	for (const g of v.glows) dropGlow(g);
	pieces.delete(k);
}

function buildView(k: string, pop: 'big' | 'soft' | 'none'): void {
	removeView(k);
	const p = S.pieces.get(k);
	if (!p) return;
	const [x, z] = unkey(k);
	const model = buildPiece(p.t, contextOf(x, z));
	const holder = new THREE.Group();
	holder.position.set(x, 0, z);
	holder.add(model.group);
	const glows = model.glows.map((g) => {
		const s = makeGlow(g.color, g.size);
		s.position.set(g.x, g.y, g.z);
		holder.add(s);
		return s;
	});
	const island = S.land.get(k);
	const air = island === undefined;
	(air ? bridgeGroup : islands[island].group).add(holder);
	const view: PieceView = { holder, model, glows, pop: pop === 'none' ? -1 : 0, popSize: pop === 'big' ? 1 : 0.12, wait: 0, air, x, z };
	if (pop === 'big') holder.scale.setScalar(0.01);
	pieces.set(k, view);
}

/** Rebuilds the cells that changed, and the cells next to them, because pieces join up. */
export function refresh(changed: string[], placed: string | null): void {
	const todo = new Set<string>();
	for (const k of changed) {
		todo.add(k);
		const [x, z] = unkey(k);
		for (let d = 0; d < 4; d++) {
			const nk = key(x + DX[d], z + DZ[d]);
			todo.add(nk);
			if (S.pieces.get(nk)?.t === 'cottage') for (const c of clusterOf(nk).cells) todo.add(c);
		}
	}
	for (const k of todo) {
		if (!S.pieces.has(k)) removeView(k);
		else buildView(k, k === placed ? 'big' : changed.includes(k) ? 'soft' : pieces.has(k) ? 'soft' : 'none');
	}
	afterChange();
	if (placed) {
		const [x, z] = unkey(placed);
		burst(x, groundY(x, z) + 0.25, z, [0xffffff, 0xfff1a8, 0xffd1e0], 12, 0.8);
	}
}

export const isWet = (k: string): boolean => wet.has(k);

/** Makes pieces pop in one after the other, for a bridge that grows out. */
export function growIn(cells: string[], step: number, delay = 0): void {
	cells.forEach((k, i) => {
		const v = pieces.get(k);
		if (!v) return;
		v.wait = delay + i * step;
		v.pop = 0;
		v.popSize = 1;
		v.holder.scale.setScalar(0.001);
	});
}

/** Sets the size of a piece model, for a tree that grows. */
export function scalePiece(k: string, size: number): void {
	pieces.get(k)?.model.group.scale.setScalar(size);
}

/** Rebuilds one piece in place, for a tree that grew or a villager that moved in. */
export function rebuildPiece(k: string, pop: boolean): void {
	buildView(k, pop ? 'soft' : 'none');
}

function afterChange(): void {
	emitters.length = 0;
	spills.length = 0;
	wishSources.length = 0;
	for (const [k, p] of S.pieces) {
		const [x, z] = unkey(k);
		for (const c of combosAt(x, z)) if (p.t === c[c.host]) emitters.push({ x, z, def: c });
		if (p.t === 'waterfall') for (const d of spillSides(x, z)) spills.push({ x, z, d });
		if (PIECE[p.t].lanterns) wishSources.push({ x, y: 2, z, strong: true });
		else if (p.t === 'lantern') {
			// The pod hangs on the side that the vine leans to.
			const a = ((p.r - 2) * Math.PI) / 2;
			wishSources.push({ x: x + Math.cos(a) * 0.16, y: 0.6, z: z + Math.sin(a) * 0.16, strong: false });
		}
	}
	findWetCells();
	for (const v of islands) v.dirtyDecor = true;
}

/** Throws the whole view away and builds it again from the state. */
export function rebuildAll(): void {
	for (const k of [...pieces.keys()]) removeView(k);
	for (const v of islands) dropIsland(v);
	islands.length = 0;
	syncIslands(false);
	for (const k of S.pieces.keys()) buildView(k, 'none');
	afterChange();
}

/* Cursor and ghost */

function makeCursor(): THREE.Group {
	const g = new THREE.Group();
	const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false });
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
		const a = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.06), mat);
		a.position.set(sx * 0.33, 0, sz * 0.45);
		const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.3), mat);
		b.position.set(sx * 0.45, 0, sz * 0.33);
		g.add(a, b);
	}
	const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
	fill.rotation.x = -Math.PI / 2;
	g.add(fill);
	g.userData.mat = mat;
	g.userData.fill = fill.material;
	g.renderOrder = 4;
	g.visible = false;
	return g;
}

/**
 * Shows the frame on a cell. `tone` is how the cell reads: free, blocked or erase.
 * `piece` adds a floating copy of the piece that the player holds.
 */
export function showCursor(x: number, z: number, tone: 'ok' | 'bad' | 'erase' | 'plain', piece: PieceId | null, r: number): void {
	cursor.visible = true;
	cursor.position.set(x, groundY(x, z) + 0.07, z);
	const color = tone === 'ok' ? 0xffffff : tone === 'plain' ? 0xfff6d8 : 0xff8fa8;
	(cursor.userData.mat as THREE.MeshBasicMaterial).color.set(color);
	(cursor.userData.fill as THREE.MeshBasicMaterial).color.set(tone === 'ok' ? 0xb8ffd0 : color);
	const want = piece && tone === 'ok' ? `${piece}:${r}` : '';
	if (want !== ghostKey) {
		if (ghost) {
			cursor.remove(ghost);
			disposeModel(ghost);
			ghost = null;
		}
		if (piece && want) {
			const ctx = blankCtx(r);
			ctx.homed = false;
			ghost = buildPiece(piece, ctx).group;
			cursor.add(ghost);
		}
		ghostKey = want;
	}
}

export function hideCursor(): void {
	cursor.visible = false;
}

/** Shows the frame for a short time, for a tap on a touch screen. */
export function flashCursor(x: number, z: number, ok: boolean): void {
	showCursor(x, z, ok ? 'ok' : 'bad', null, 0);
	cursorFlash = 0.45;
}

/* Each frame */

export function updateView(dt: number): void {
	const t = env.time;

	fallMat.uniforms.uTime.value = t;
	fallMat.uniforms.uNight.value = env.night;
	ghostMat.color.copy(GHOST_DAY).lerp(GHOST_NIGHT, env.night);
	islands.forEach((v, i) => {
		if (v.rise < 1) v.rise = Math.min(1, v.rise + dt / 3.5);
		const e = 1 - Math.pow(1 - v.rise, 3);
		v.group.position.y = Math.sin(t * 0.55 + v.phase) * 0.07 - (1 - e) * 9 - (v.ghost ? 1.5 : 0);
		if (v.dirtyColor) paintIsland(i);
		for (const c of v.clouds) {
			c.position.x = c.userData.x0 + Math.sin(t * 0.11 + c.userData.phase) * 0.6;
			c.position.y = c.userData.y0 + Math.sin(t * 0.3 + c.userData.phase) * 0.2;
		}
		for (const o of v.group.children) {
			if (o.userData.mist === undefined) continue;
			o.position.x = o.userData.x0 + Math.sin(t * 0.13 + o.userData.mist) * 0.3;
			(o as THREE.Sprite).material.opacity = 0.34 + Math.sin(t * 0.5 + o.userData.mist) * 0.1;
		}
		// Spray where the water lands in the clouds.
		for (const f of v.falls) {
			if (v.rise < 1 || Math.random() > dt * 7 * fxBudget.amount) continue;
			const y = v.group.position.y;
			spark({ x: f.x + DX[f.d] * 0.55 + (Math.random() - 0.5) * 0.5, y: y - f.h + 0.3 + Math.random() * 0.6, z: f.z + DZ[f.d] * 0.55 + (Math.random() - 0.5) * 0.5, vx: (Math.random() - 0.5) * 0.5, vy: 0.25, vz: (Math.random() - 0.5) * 0.5, life: 2.4, size: 0.6 + Math.random() * 0.5, color: 0xffffff, alpha: 0.3 });
			if (Math.random() < 0.5) spark({ x: f.x + DX[f.d] * 0.2, y: y - 0.1, z: f.z + DZ[f.d] * 0.2, vx: DX[f.d] * 0.5 + (Math.random() - 0.5) * 0.3, vy: 0.4, vz: DZ[f.d] * 0.5 + (Math.random() - 0.5) * 0.3, gravity: 3, life: 0.9, size: 0.07, color: 0xeaf8ff, alpha: 0.9 });
		}
	});

	lushTimer -= dt;
	if (lushTimer <= 0) {
		lushTimer = 0.7;
		growGrass();
		islands.forEach((v, i) => v.dirtyDecor && !v.ghost && decorateIsland(i));
	}

	for (const v of pieces.values()) {
		if (v.air) v.holder.position.y = waveAt(v.x, v.z);
		if (v.wait > 0) {
			v.wait -= dt;
			continue;
		}
		if (v.pop >= 0) {
			v.pop += dt;
			const p = v.pop;
			const wobble = Math.exp(-p * 6);
			if (v.popSize === 1) {
				const s = 1 - Math.cos(p * 11) * wobble;
				v.holder.scale.set(s, 1 - Math.cos(p * 11 + 0.9) * wobble * 1.15, s);
			} else {
				const s = Math.sin(p * 14) * wobble * v.popSize;
				v.holder.scale.set(1 + s, 1 - s, 1 + s);
			}
			if (p > 1.1) {
				v.pop = -1;
				v.holder.scale.setScalar(1);
			}
		}
		for (const a of v.model.anims) a(v.model.group, t, dt);
	}

	// Sparkles of the magic links.
	for (const e of emitters) {
		if (Math.random() > dt * 7 * fxBudget.amount) continue;
		const y = groundY(e.x, e.z);
		const color = e.def.colors[Math.floor(Math.random() * e.def.colors.length)];
		const a = Math.random() * Math.PI * 2;
		if (e.def.motion === 'rise') {
			const r = Math.random() * 0.4;
			spark({ x: e.x + Math.cos(a) * r, y: y + 0.1, z: e.z + Math.sin(a) * r, vy: 0.25 + Math.random() * 0.3, life: 1.6 + Math.random(), size: 0.05 + Math.random() * 0.05, color, sway: 0.12 });
		} else if (e.def.motion === 'orbit') {
			const r = 0.25 + Math.random() * 0.3;
			spark({ x: e.x + Math.cos(a) * r, y: y + 0.25 + Math.random() * 0.7, z: e.z + Math.sin(a) * r, vx: -Math.sin(a) * 0.3, vz: Math.cos(a) * 0.3, vy: (Math.random() - 0.4) * 0.15, life: 2 + Math.random() * 1.5, size: 0.055, color, sway: 0.3 });
		} else {
			spark({ x: e.x + (Math.random() - 0.5) * 0.6, y: y + 0.2, z: e.z + (Math.random() - 0.5) * 0.6, vx: 0.5 + Math.random() * 0.4, vy: 0.45 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.4, life: 2.4 + Math.random(), size: 0.07, color, sway: 0.5, gravity: 0.12 });
		}
	}

	// Drops and mist of the waterfalls.
	for (const s of spills) {
		const y = groundY(s.x, s.z);
		const ex = s.x + DX[s.d] * 0.56;
		const ez = s.z + DZ[s.d] * 0.56;
		const side = (Math.random() - 0.5) * 0.2;
		if (Math.random() < dt * 22 * fxBudget.amount) {
			spark({ x: ex + (DZ[s.d] ? side : 0), y: y - Math.random() * 0.4, z: ez + (DX[s.d] ? side : 0), vx: DX[s.d] * 0.2, vz: DZ[s.d] * 0.2, vy: -0.5, gravity: 4, life: 1.1, size: 0.08, color: 0xeaf8ff, alpha: 0.9 });
		}
		if (Math.random() < dt * 9 * fxBudget.amount) {
			spark({ x: ex + (Math.random() - 0.5) * 0.4, y: y - 3 - Math.random() * 0.3, z: ez + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 0.3, vy: 0.1, vz: (Math.random() - 0.5) * 0.3, life: 2.2, size: 0.5 + Math.random() * 0.4, color: 0xffffff, alpha: 0.28 });
		}
	}

	if (cursor.visible) {
		const pulse = 1 + Math.sin(t * 5) * 0.04;
		cursor.scale.set(pulse, 1, pulse);
		if (ghost) {
			ghost.position.y = 0.12 + Math.sin(t * 3) * 0.04;
			ghost.scale.setScalar(0.92);
		}
		if (cursorFlash > 0) {
			cursorFlash -= dt;
			if (cursorFlash <= 0) hideCursor();
		}
	}
}

/** Pollen by day and fireflies at night drift near the place the camera looks at. */
export function driftPollen(dt: number, target: THREE.Vector3): void {
	if (Math.random() > dt * 5 * fxBudget.amount) return;
	const night = env.night > 0.6;
	spark({
		x: target.x + (Math.random() - 0.5) * 20,
		y: 0.3 + Math.random() * 3.5,
		z: target.z + (Math.random() - 0.5) * 20,
		vx: 0.15,
		vy: night ? 0.02 : 0.06,
		life: 6 + Math.random() * 4,
		size: night ? 0.07 : 0.05,
		color: night ? 0xf2ff9a : 0xfffbe0,
		alpha: night ? 0.9 : 0.65,
		sway: 0.25,
	});
}

/** A small picture of each piece, for the toolbar. */
export function renderIcons(renderer: THREE.WebGLRenderer): Record<string, string> {
	const out: Record<string, string> = {};
	const scene = new THREE.Scene();
	scene.add(new THREE.HemisphereLight(0xffffff, 0xe6d6f2, 2.2));
	const light = new THREE.DirectionalLight(0xfff2dc, 1.8);
	light.position.set(3, 5, 2);
	scene.add(light);
	const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
	const oldSize = renderer.getSize(new THREE.Vector2());
	const oldRatio = renderer.getPixelRatio();
	renderer.setPixelRatio(1);
	renderer.setSize(128, 128, false);
	renderer.setClearColor(0x000000, 0);
	const glowWas = MAT.glow.emissiveIntensity;
	MAT.glow.emissiveIntensity = 0.9;
	for (const def of PIECES) {
		const ctx = blankCtx(2);
		if (def.id === 'dock') ctx.r = 3;
		if (def.id === 'bridge') ctx.sides = ['land', null, 'land', null];
		if (def.id === 'path') ctx.sides = ['path', 'land', 'path', 'path'];
		if (def.id === 'tree') ctx.growth = 0.2;
		if (def.id === 'crossing') ctx.sides = ['path', 'pond', 'path', 'pond'];
		const model = buildPiece(def.id, ctx).group;
		const box = new THREE.Box3().setFromObject(model);
		const mid = box.getCenter(new THREE.Vector3());
		const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
		const dist = size * 2.5 + 0.6;
		cam.position.set(mid.x + dist * 0.62, mid.y + dist * 0.5, mid.z + dist * 0.62);
		cam.lookAt(mid);
		scene.add(model);
		renderer.render(scene, cam);
		out[def.id] = renderer.domElement.toDataURL('image/png');
		scene.remove(model);
		disposeModel(model);
	}
	MAT.glow.emissiveIntensity = glowWas;
	renderer.setPixelRatio(oldRatio);
	renderer.setSize(oldSize.x, oldSize.y, false);
	return out;
}

/* The preview of a road */

const ROUTE_MAX = 240;
const route = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthTest: false }), ROUTE_MAX);
route.count = 0;
route.renderOrder = 4;
route.frustumCulled = false;

/** Shows the cells of a road that is not built yet. `fresh` marks the cells that get a new piece. */
export function showRoute(cells: { x: number; z: number; fresh: boolean }[], water = false): void {
	route.count = Math.min(ROUTE_MAX, cells.length);
	for (let i = 0; i < route.count; i++) {
		const c = cells[i];
		const s = c.fresh ? 1 : 0.4;
		_m.compose(_v.set(c.x, groundY(c.x, c.z) + 0.1, c.z), _q.identity(), _s.set(s, 1, s));
		route.setMatrixAt(i, _m);
		route.setColorAt(i, _c.set(i === route.count - 1 ? 0xffffff : c.fresh ? (water ? 0x7fd8ff : 0xffd24a) : 0xbff5d0));
	}
	route.instanceMatrix.needsUpdate = true;
	if (route.instanceColor) route.instanceColor.needsUpdate = true;
}

/** Sparkles where a new island rises. */
export function islandSparkle(index: number): void {
	const d = ISLANDS[index];
	for (let i = 0; i < 8; i++) window.setTimeout(() => burst(d.cx + (Math.random() - 0.5) * d.r * 1.4, -1 + i * 0.3, d.cz + (Math.random() - 0.5) * d.r * 1.4, [0xffffff, 0xd4b3ff, 0xa8fff0, 0xffe28a], 26, 2.2), 400 + i * 450);
}
