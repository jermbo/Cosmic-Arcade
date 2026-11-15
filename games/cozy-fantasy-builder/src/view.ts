/** Draws the islands and the pieces, and keeps them in step with the state. */

import * as THREE from 'three';
import { ISLANDS, PIECE, PIECES, TUNE } from './content.ts';
import type { ComboDef, PieceId } from './content.ts';
import { burst, dropGlow, fxBudget, makeGlow, softTexture, spark } from './fx.ts';
import { blankCtx, buildPiece, disposeModel, Kit, MAT } from './models.ts';
import type { Ctx, Model } from './models.ts';
import { env, wishSources } from './sky.ts';
import { combosAt, isLand, pieceAt, S, spillSides } from './state.ts';
import { clamp, DX, DZ, hash2, key, unkey } from './util.ts';

export const world = new THREE.Group();

interface IslandView {
	group: THREE.Group;
	top: THREE.Mesh;
	tufts: THREE.InstancedMesh;
	blooms: THREE.InstancedMesh;
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

const DRY = new THREE.Color(0xc3de8c);
const LUSH = new THREE.Color(0x72d08f);
const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export function initView(scene: THREE.Scene): void {
	scene.add(world);
	world.add(bridgeGroup, cursor);
}

/* Heights */

const waveAt = (x: number, z: number): number => Math.sin(env.time * 0.55 + x * 0.2 + z * 0.15) * 0.07;

/** The height of the ground on a cell now. The islands bob a little. */
export function groundY(x: number, z: number): number {
	const i = S.land.get(key(Math.round(x), Math.round(z)));
	if (i === undefined || !islands[i]) return waveAt(x, z);
	return islands[i].group.position.y;
}

/* Lushness: grass grows near water. */

export function lushAt(k: string): number {
	return S.lush.get(k) ?? 0.12;
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
			if (env.rain > 0.5 && next < 0.5) next += 0.006;
		}
		if (next === now) continue;
		S.lush.set(k, next);
		const view = islands[island];
		if (!view) continue;
		view.dirtyColor = true;
		if ((now < 0.45 && next >= 0.45) || (now < 0.75 && next >= 0.75) || (now < 0.85 && next >= 0.85)) view.dirtyDecor = true;
	}
}

/* Islands */

function buildIsland(index: number): IslandView {
	const cells = S.islandCells[index];
	const def = ISLANDS[index];
	const mine = new Set(cells.map(([x, z]) => key(x, z)));
	const has = (x: number, z: number): boolean => mine.has(key(x, z));

	// How far each cell is from the edge of the island.
	const depth = new Map<string, number>();
	let ring = cells.filter(([x, z]) => [0, 1, 2, 3].some((d) => !has(x + DX[d], z + DZ[d])));
	let level = 1;
	while (ring.length) {
		for (const [x, z] of ring) depth.set(key(x, z), level);
		const nextRing: [number, number][] = [];
		for (const [x, z] of ring) {
			for (let d = 0; d < 4; d++) {
				const n: [number, number] = [x + DX[d], z + DZ[d]];
				const nk = key(n[0], n[1]);
				if (mine.has(nk) && !depth.has(nk) && !nextRing.some((c) => c[0] === n[0] && c[1] === n[1])) nextRing.push(n);
			}
		}
		ring = nextRing.filter(([x, z]) => !depth.has(key(x, z)));
		level++;
	}

	const LIP = -0.34;
	/** The depth of the rock under one corner of the grid. */
	const cornerY = (cx: number, cz: number): number => {
		let low = 99;
		for (const [ox, oz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) low = Math.min(low, depth.get(key(cx + ox, cz + oz)) ?? 0);
		if (low === 0) return LIP;
		return LIP - Math.pow(low, 0.95) * 0.72 * (0.75 + hash2(cx, cz, def.seed) * 0.5);
	};

	const topPos: number[] = [];
	const bodyPos: number[] = [];
	const bodyCol: number[] = [];
	const earth = new THREE.Color(0xd3ad8c);
	const rock = new THREE.Color(0x9b90b8);
	const grassEdge = new THREE.Color(0x9ccf8f);
	const push = (x: number, y: number, z: number, c: THREE.Color): void => {
		bodyPos.push(x, y, z);
		bodyCol.push(c.r, c.g, c.b);
	};
	const rockColor = (y: number): THREE.Color => _c.copy(earth).lerp(rock, clamp((-y - 0.3) / 2.2, 0, 1)).clone();

	for (const [x, z] of cells) {
		const x0 = x - 0.5;
		const x1 = x + 0.5;
		const z0 = z - 0.5;
		const z1 = z + 0.5;
		topPos.push(x0, 0, z0, x0, 0, z1, x1, 0, z0, x1, 0, z0, x0, 0, z1, x1, 0, z1);

		// The sides of the grass and earth layer, where the island ends.
		for (let d = 0; d < 4; d++) {
			if (has(x + DX[d], z + DZ[d])) continue;
			const ax = d === 1 ? x1 : d === 3 ? x0 : x0;
			const az = d === 0 ? z0 : d === 2 ? z1 : z0;
			const bx = d === 1 ? x1 : d === 3 ? x0 : x1;
			const bz = d === 0 ? z0 : d === 2 ? z1 : z1;
			const band = (yTop: number, yLow: number, c: THREE.Color): void => {
				push(ax, yTop, az, c);
				push(bx, yTop, bz, c);
				push(ax, yLow, az, c);
				push(bx, yTop, bz, c);
				push(bx, yLow, bz, c);
				push(ax, yLow, az, c);
			};
			band(0, -0.1, grassEdge);
			band(-0.1, LIP, earth);
		}

		// The rock below: four triangles that meet under the middle of the cell.
		const corners: [number, number, number][] = [
			[x0, cornerY(x, z), z0],
			[x1, cornerY(x + 1, z), z0],
			[x1, cornerY(x + 1, z + 1), z1],
			[x0, cornerY(x, z + 1), z1],
		];
		const midY = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4 - 0.25 * hash2(x, z, def.seed + 1) * Math.min(2, depth.get(key(x, z)) ?? 1);
		for (let i = 0; i < 4; i++) {
			const a = corners[i];
			const b = corners[(i + 1) % 4];
			const c = rockColor((a[1] + b[1] + midY) / 3);
			push(a[0], a[1], a[2], c);
			push(b[0], b[1], b[2], c);
			push(x, midY, z, c);
		}
	}

	const topGeo = new THREE.BufferGeometry();
	topGeo.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
	topGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(topPos.length), 3));
	topGeo.computeVertexNormals();
	const top = new THREE.Mesh(topGeo, MAT.solid);
	top.receiveShadow = true;

	const bodyGeo = new THREE.BufferGeometry();
	bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(bodyPos, 3));
	bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(bodyCol, 3));
	bodyGeo.computeVertexNormals();
	const body = new THREE.Mesh(bodyGeo, bodyMat);
	body.castShadow = true;

	const tufts = new THREE.InstancedMesh(tuftGeo, decorMat, cells.length * 3);
	const blooms = new THREE.InstancedMesh(bloomGeo, decorMat, cells.length * 2);
	tufts.count = blooms.count = 0;
	tufts.receiveShadow = true;

	const group = new THREE.Group();
	group.add(top, body, tufts, blooms);

	// Crystals hang under the island, and mist drifts below it.
	const gems = new Kit();
	const lowest = -LIP + Math.pow(level, 0.95) * 0.6;
	for (let i = 0; i < 3; i++) {
		const gx = def.cx + (hash2(i, 1, def.seed) - 0.5) * def.r * 0.7;
		const gz = def.cz + (hash2(i, 2, def.seed) - 0.5) * def.r * 0.7;
		gems.gem('crystal', [0xc7a8ff, 0x9fe0ff, 0xffb3e6][i], 0.16 + hash2(i, 3, def.seed) * 0.12, gx, -lowest * (0.75 + hash2(i, 4, def.seed) * 0.3), gz, { sy: 2.2 });
	}
	group.add(gems.build(false));
	for (let i = 0; i < 3; i++) {
		const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTexture, transparent: true, opacity: 0.32, depthWrite: false }));
		mist.scale.set(def.r * 2.6, def.r * 1.1, 1);
		mist.position.set(def.cx + (i - 1) * def.r * 0.7, -lowest - 0.6 - i * 0.5, def.cz + (hash2(i, 9, def.seed) - 0.5) * def.r);
		mist.userData.mist = i + def.seed;
		mist.userData.x0 = mist.position.x;
		group.add(mist);
	}

	const view: IslandView = { group, top, tufts, blooms, phase: def.cx * 0.2 + def.cz * 0.15, rise: 1, dirtyColor: true, dirtyDecor: true };
	world.add(group);
	return view;
}

function paintIsland(index: number): void {
	const view = islands[index];
	const cells = S.islandCells[index];
	const col = view.top.geometry.getAttribute('color') as THREE.BufferAttribute;
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
			view.tufts.setColorAt(t, _c.set(i % 2 ? 0x8fd89f : 0x76c990));
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

/** Adds the view of each island that the state has and the view does not. */
export function syncIslands(animate: boolean): void {
	while (islands.length < S.islands) {
		const view = buildIsland(islands.length);
		view.rise = animate ? 0 : 1;
		islands.push(view);
	}
}

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
	const view: PieceView = { holder, model, glows, pop: pop === 'none' ? -1 : 0, popSize: pop === 'big' ? 1 : 0.12, air, x, z };
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
		else if (p.t === 'lantern') wishSources.push({ x: x + 0.16, y: 0.6, z, strong: false });
	}
	findWetCells();
	for (const v of islands) v.dirtyDecor = true;
}

/** Throws the whole view away and builds it again from the state. */
export function rebuildAll(): void {
	for (const k of [...pieces.keys()]) removeView(k);
	for (const v of islands) {
		world.remove(v.group);
		v.group.traverse((o) => {
			if (o instanceof THREE.Mesh && o.geometry !== tuftGeo && o.geometry !== bloomGeo) o.geometry.dispose();
		});
	}
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

	islands.forEach((v, i) => {
		if (v.rise < 1) v.rise = Math.min(1, v.rise + dt / 3.5);
		const e = 1 - Math.pow(1 - v.rise, 3);
		v.group.position.y = Math.sin(t * 0.55 + v.phase) * 0.07 - (1 - e) * 16;
		if (v.dirtyColor) paintIsland(i);
		for (const o of v.group.children) {
			if (o.userData.mist === undefined) continue;
			o.position.x = o.userData.x0 + Math.sin(t * 0.13 + o.userData.mist) * 0.8;
			(o as THREE.Sprite).material.opacity = 0.2 + Math.sin(t * 0.3 + o.userData.mist) * 0.08 + env.night * 0.05;
		}
	});

	lushTimer -= dt;
	if (lushTimer <= 0) {
		lushTimer = 0.7;
		growGrass();
		islands.forEach((v, i) => v.dirtyDecor && decorateIsland(i));
	}

	for (const v of pieces.values()) {
		if (v.air) v.holder.position.y = waveAt(v.x, v.z);
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
		for (const a of v.model.anims) a(v.model.group, t, dt * (1 + env.rain));
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

/** Sparkles where a new island rises. */
export function islandSparkle(index: number): void {
	const d = ISLANDS[index];
	for (let i = 0; i < 5; i++) window.setTimeout(() => burst(d.cx + (Math.random() - 0.5) * d.r, -1 + i * 0.3, d.cz + (Math.random() - 0.5) * d.r, [0xffffff, 0xd4b3ff, 0xa8fff0], 14, 1.6), 600 + i * 500);
}
