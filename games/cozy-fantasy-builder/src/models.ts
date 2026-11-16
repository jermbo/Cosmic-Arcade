/** Low-poly models of the pieces, made from code. Each model is a few merged meshes. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PIECE } from './content.ts';
import type { PieceId } from './content.ts';
import { DX, DZ, pick, rng } from './util.ts';

type Channel = 'solid' | 'glow' | 'lamp' | 'water' | 'crystal';

/** Shared materials. The sky changes `glow` at night. */
export const MAT = {
	solid: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
	glow: new THREE.MeshLambertMaterial({ color: 0x9a8a78, emissive: 0xffc866, emissiveIntensity: 0, flatShading: true }),
	lamp: new THREE.MeshBasicMaterial({ vertexColors: true }),
	water: new THREE.MeshLambertMaterial({ color: 0x86d4ee, emissive: 0x2a7f9f, emissiveIntensity: 0.4, transparent: true, opacity: 0.86, flatShading: true }),
	crystal: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x6a4fa0, emissiveIntensity: 0.55, transparent: true, opacity: 0.92, flatShading: true }),
};

interface Xf {
	rx?: number;
	ry?: number;
	rz?: number;
	sx?: number;
	sy?: number;
	sz?: number;
}

export interface Glow {
	x: number;
	y: number;
	z: number;
	color: number;
	size: number;
}

/** What a piece model can do each frame. */
export type Anim = (obj: THREE.Object3D, time: number, dt: number) => void;

export interface Model {
	group: THREE.Group;
	glows: Glow[];
	anims: Anim[];
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** Collects coloured shapes and merges them into one mesh for each material. */
export class Kit {
	private parts: Record<Channel, THREE.BufferGeometry[]> = { solid: [], glow: [], lamp: [], water: [], crystal: [] };
	private base = new THREE.Matrix4();
	glows: Glow[] = [];

	/** Turns everything added after this call around the up axis. */
	yaw(angle: number): this {
		this.base.makeRotationY(angle);
		return this;
	}

	add(ch: Channel, geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, xf: Xf = {}): this {
		const g = geo.index ? geo.toNonIndexed() : geo;
		if (g !== geo) geo.dispose();
		g.deleteAttribute('uv');
		_e.set(xf.rx ?? 0, xf.ry ?? 0, xf.rz ?? 0);
		_m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(xf.sx ?? 1, xf.sy ?? 1, xf.sz ?? 1));
		_m.premultiply(this.base);
		g.applyMatrix4(_m);
		g.computeVertexNormals();
		const n = g.getAttribute('position').count;
		const colors = new Float32Array(n * 3);
		_c.set(color);
		for (let i = 0; i < n; i++) colors.set([_c.r, _c.g, _c.b], i * 3);
		g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		this.parts[ch].push(g);
		return this;
	}

	/** A box that stands on height `y`. */
	box(ch: Channel, color: number, w: number, h: number, d: number, x = 0, y = 0, z = 0, xf: Xf = {}): this {
		return this.add(ch, new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, xf);
	}

	/** A cylinder or cone that stands on height `y`. */
	cyl(ch: Channel, color: number, rTop: number, rBottom: number, h: number, sides: number, x = 0, y = 0, z = 0, xf: Xf = {}): this {
		return this.add(ch, new THREE.CylinderGeometry(rTop, rBottom, h, sides), color, x, y + h / 2, z, xf);
	}

	/** A low-poly ball around a centre. */
	ball(ch: Channel, color: number, r: number, x = 0, y = 0, z = 0, xf: Xf = {}): this {
		return this.add(ch, new THREE.IcosahedronGeometry(r, 0), color, x, y, z, xf);
	}

	gem(ch: Channel, color: number, r: number, x = 0, y = 0, z = 0, xf: Xf = {}): this {
		return this.add(ch, new THREE.OctahedronGeometry(r, 0), color, x, y, z, xf);
	}

	glow(x: number, y: number, z: number, color: number, size: number): this {
		_p.set(x, y, z).applyMatrix4(this.base);
		this.glows.push({ x: _p.x, y: _p.y, z: _p.z, color, size });
		return this;
	}

	build(shadows = true): THREE.Group {
		const group = new THREE.Group();
		for (const ch of Object.keys(this.parts) as Channel[]) {
			const list = this.parts[ch];
			if (!list.length) continue;
			const mesh = new THREE.Mesh(mergeGeometries(list), MAT[ch]);
			for (const g of list) g.dispose();
			mesh.castShadow = shadows && (ch === 'solid' || ch === 'crystal' || ch === 'glow');
			mesh.receiveShadow = shadows && ch === 'solid';
			group.add(mesh);
		}
		return group;
	}
}

/** What a model needs to know about its place. */
export interface Ctx {
	r: number;
	seed: number;
	/** Growth of a tree, 0..1. */
	growth: number;
	/** The piece on each side, 'land' for empty land, or null for open sky. */
	sides: (PieceId | 'land' | null)[];
	/** The facing of the piece on each side, when it has one. */
	sideR: number[];
	/** Ids of the combos this cell is in. */
	combos: string[];
	/** For a waterfall rock: sides where water spills. */
	spills: number[];
	/** For a cottage: a seed shared by all joined cottages. */
	clusterSeed: number;
	/** A villager lives here. */
	homed: boolean;
}

export const blankCtx = (r = 0): Ctx => ({ r, seed: 7, growth: 1, sides: ['land', 'land', 'land', 'land'], sideR: [0, 0, 0, 0], combos: [], spills: [], clusterSeed: 7, homed: true });

const yawOf = (r: number): number => (-r * Math.PI) / 2;

const BARK = 0x8a6248;
const BARK_DARK = 0x6e4f3a;
const BARK_LIGHT = 0xa67c5b;
const WOOD = 0xc49a6c;
const WOOD_DARK = 0x9a7450;
const ROPE = 0xd8c08f;
const STONE = 0xb9b8c8;
const MOSS = 0x5fae6e;
const GOLD = 0xffe7a3;
/** Crowns of the tree homes: deep greens, with a few in gold, plum and teal. */
const CANOPY = [0x3f9a6a, 0x4fae78, 0x2f8f6a, 0x5aa85a, 0x3f9a6a, 0xd9a441, 0xb86fa8, 0x3f9f9a];
const LEAVES = [0x4fae78, 0x3f9a6a, 0x6fc487, 0x58b58a, 0x7fcf8f, 0xe8a8c8, 0xf2c46b, 0x6fc9b8, 0xb79ce6];
const BLOOMS = [0xffa3c4, 0xfff1a8, 0xc9a8ff, 0xffffff, 0xffb98a, 0x9fe0ff];

const lighter = (hex: number, by: number): number => _c.set(hex).lerp(_white, by).getHex();
const _white = new THREE.Color(0xffffff);

/** Does a path arm reach toward this side? */
function pathJoins(ctx: Ctx, d: number): boolean {
	const s = ctx.sides[d];
	if (s === null || s === 'land') return false;
	if (s === 'path' || s === 'bridge' || s === 'crossing' || s === 'dock') return true;
	// A home or a shop joins when its door faces this cell.
	return !!PIECE[s].door && ctx.sideR[d] === (d + 2) % 4;
}

/** Is there river water on this side? */
const waterJoins = (ctx: Ctx, d: number): boolean => ctx.sides[d] === 'pond' || ctx.sides[d] === 'waterfall' || ctx.sides[d] === 'crossing';

/** A lantern that hangs by the door when an elf lives in a home. */
function doorLamp(k: Kit, x: number, y: number, z: number): void {
	k.box('solid', BARK_DARK, 0.012, 0.14, 0.012, x, y, z);
	k.ball('lamp', GOLD, 0.045, x, y - 0.02, z);
	k.glow(x, y - 0.02, z, 0xffd58a, 0.9);
}

/** A round door with a frame, on the front of a home. */
function roundDoor(k: Kit, r: number, y: number, z: number): void {
	k.cyl('solid', 0xe8c98a, r, r, 0.03, 9, 0, y, z, { rx: Math.PI / 2 });
	k.cyl('solid', 0x6f4530, r * 0.78, r * 0.78, 0.04, 9, 0, y - 0.005, z - 0.01, { rx: Math.PI / 2 });
	k.ball('solid', GOLD, 0.014, r * 0.4, y + 0.02, z - 0.035);
}

/** Flat stones with moss between them. */
function path(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const arms = [0, 1, 2, 3].filter((d) => pathJoins(ctx, d));
	const shade = (): number => pick([0xc9cdb6, 0xb9c2a6, 0xd6d6c2, 0xbfc7b0], rand());
	const moss = (x: number, z: number): Kit => k.ball('solid', pick([MOSS, 0x4fa068, 0x7fcf8f], rand()), 0.06 + rand() * 0.03, x, 0.02, z, { sy: 0.35 });
	if (!arms.length) {
		k.cyl('solid', shade(), 0.2, 0.22, 0.045, 7, 0, 0, 0);
		k.cyl('solid', shade(), 0.1, 0.11, 0.04, 6, 0.3, 0, 0.22);
		k.cyl('solid', shade(), 0.09, 0.1, 0.04, 6, -0.28, 0, -0.26);
		moss(0.2, -0.2);
		moss(-0.22, 0.24);
		return;
	}
	k.cyl('solid', shade(), 0.22, 0.24, 0.05, 7, 0, 0, 0, { ry: rand() * 3 });
	for (const d of arms) {
		for (let i = 0; i < 2; i++) {
			const off = 0.3 + i * 0.16;
			const side = (rand() - 0.5) * 0.08;
			k.cyl('solid', shade(), 0.12 + rand() * 0.03, 0.14, 0.042, 6, DX[d] * off + DZ[d] * side, 0, DZ[d] * off + DX[d] * side, { ry: rand() * 3 });
		}
		moss(DX[d] * 0.38 + DZ[d] * 0.2, DZ[d] * 0.38 + DX[d] * 0.2);
	}
	moss((rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5);
	if (rand() < 0.3) {
		// A tiny glow cap grows beside some stones.
		const x = rand() < 0.5 ? 0.36 : -0.36;
		k.cyl('solid', 0xfff4e2, 0.012, 0.016, 0.06, 4, x, 0, 0.36);
		k.cyl('glow', 0, 0.01, 0.04, 0.03, 5, x, 0.055, 0.36);
	}
}

/** A home grown into a tree: a round door in the trunk and a crown of leaves for a roof. */
function cottage(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.clusterSeed);
	const leaf = pick(CANOPY, rand());
	const leaf2 = lighter(leaf, 0.22);
	const own = rng(ctx.seed);
	// Homes side by side: a rope walk and shared leaves run to each neighbour.
	for (let d = 0; d < 4; d++) {
		if (ctx.sides[d] !== 'cottage') continue;
		const along = DZ[d] !== 0;
		k.box('solid', WOOD, along ? 0.12 : 0.5, 0.025, along ? 0.5 : 0.12, DX[d] * 0.3, 0.6, DZ[d] * 0.3);
		for (const side of [-1, 1]) k.box('solid', ROPE, along ? 0.012 : 0.5, 0.012, along ? 0.5 : 0.012, DX[d] * 0.3 + (along ? side * 0.07 : 0), 0.7, DZ[d] * 0.3 + (along ? 0 : side * 0.07));
		k.ball('solid', leaf, 0.3, DX[d] * 0.5, 1.02, DZ[d] * 0.5, { sy: 0.75 });
	}
	k.yaw(yawOf(ctx.r));
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * Math.PI * 2 + 0.5;
		k.cyl('solid', BARK_DARK, 0.03, 0.075, 0.3, 5, Math.cos(a) * 0.28, -0.03, Math.sin(a) * 0.28, { rz: Math.cos(a) * 0.8, rx: -Math.sin(a) * 0.8 });
	}
	k.cyl('solid', BARK, 0.21, 0.29, 0.62, 7, 0, 0, 0);
	k.cyl('solid', BARK_LIGHT, 0.13, 0.21, 0.32, 7, 0, 0.62, 0);
	// The door, with a frame and a leaf over it.
	k.cyl('solid', 0xe8c98a, 0.115, 0.115, 0.03, 9, 0, 0.115, -0.262, { rx: Math.PI / 2 });
	k.cyl('solid', 0x6f4530, 0.09, 0.09, 0.04, 9, 0, 0.11, -0.272, { rx: Math.PI / 2 });
	k.ball('solid', GOLD, 0.014, 0.045, 0.14, -0.295);
	k.ball('solid', leaf2, 0.14, 0, 0.31, -0.3, { sy: 0.3 });
	k.box('solid', 0xc9cdb6, 0.2, 0.025, 0.1, 0, 0, -0.34);
	// Round windows that glow at night.
	for (const a of [-0.85, 0.85]) k.ball('glow', 0, 0.055, Math.sin(a) * 0.225, 0.38, -Math.cos(a) * 0.225);
	k.ball('glow', 0, 0.045, 0, 0.72, -0.165);
	k.ball('glow', 0, 0.045, 0.16, 0.7, 0.06);
	// A little balcony and shelf mushrooms on the bark.
	k.cyl('solid', WOOD, 0.15, 0.13, 0.03, 7, 0.27, 0.5, 0.08);
	for (const a of [0, 1.1, 2.2]) k.box('solid', WOOD_DARK, 0.015, 0.09, 0.015, 0.27 + Math.cos(a - 0.4) * 0.13, 0.53, 0.08 + Math.sin(a - 0.4) * 0.13);
	k.cyl('solid', 0xf2d9b0, 0.085, 0.06, 0.03, 6, -0.26, 0.2 + own() * 0.06, 0.1);
	k.cyl('solid', 0xf7c9a8, 0.07, 0.05, 0.03, 6, -0.2, 0.36, 0.2);
	// The crown.
	k.ball('solid', leaf, 0.42, 0, 1.02, 0, { sy: 0.8, ry: own() * 3 });
	k.ball('solid', leaf2, 0.29, 0.25, 0.92, 0.14, { ry: own() * 3 });
	k.ball('solid', leaf, 0.27, -0.24, 0.94, -0.1, { ry: own() * 3 });
	k.ball('solid', leaf2, 0.22, 0.04, 1.32, -0.05, { ry: own() * 3 });
	k.ball('solid', leaf, 0.2, -0.05, 0.9, 0.3, { ry: own() * 3 });
	if (ctx.homed) {
		// A lantern hangs by the door when an elf lives here.
		k.box('solid', BARK_DARK, 0.012, 0.16, 0.012, 0.2, 0.5, -0.27);
		k.ball('lamp', GOLD, 0.045, 0.2, 0.47, -0.27);
		k.glow(0.2, 0.47, -0.27, 0xffd58a, 0.9);
	}
}

function tree(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const leaf = pick(LEAVES, rand());
	const leaf2 = pick(LEAVES.slice(0, 5), rand());
	const stage = ctx.growth >= 1 ? 2 : ctx.growth >= 0.45 ? 1 : 0;
	if (stage === 0) {
		k.ball('solid', 0x8a6f58, 0.1, 0, 0.01, 0, { sy: 0.4 });
		k.cyl('solid', BARK_DARK, 0.012, 0.018, 0.16, 5, 0, 0, 0);
		k.ball('solid', 0x7fcf8f, 0.055, 0.045, 0.17, 0, { sy: 0.5, rz: 0.5 });
		k.ball('solid', 0x6fc487, 0.05, -0.04, 0.14, 0.01, { sy: 0.5, rz: -0.5 });
		return;
	}
	if (stage === 1) {
		k.cyl('solid', BARK, 0.035, 0.05, 0.26, 6, 0, 0, 0);
		k.ball('solid', leaf, 0.21, 0, 0.4, 0, { ry: rand() * 3 });
		k.ball('solid', leaf2, 0.13, 0.1, 0.54, 0.04, { ry: rand() * 3 });
		return;
	}
	k.cyl('solid', BARK, 0.055, 0.09, 0.46, 6, 0, 0, 0);
	k.cyl('solid', BARK, 0.02, 0.035, 0.2, 5, 0.09, 0.3, 0.02, { rz: -0.8 });
	k.ball('solid', leaf, 0.32, 0, 0.66, 0, { ry: rand() * 3, sy: 0.9 });
	k.ball('solid', leaf2 === leaf ? lighter(leaf, 0.2) : leaf, 0.25, 0.14, 0.9, 0.05, { ry: rand() * 3 });
	k.ball('solid', lighter(leaf, 0.12), 0.2, -0.12, 1.04, -0.06, { ry: rand() * 3 });
	k.ball('solid', leaf, 0.17, 0.2, 0.52, 0.04, { ry: rand() * 3 });
	if (ctx.combos.includes('firefly')) {
		for (let i = 0; i < 5; i++) k.ball('lamp', 0xfff6a8, 0.022, (rand() - 0.5) * 0.6, 0.5 + rand() * 0.5, (rand() - 0.5) * 0.6);
		k.glow(0, 0.75, 0, 0xfff3a0, 1.3);
	}
}

function flower(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	k.cyl('solid', 0x7a5a44, 0.4, 0.43, 0.05, 8, 0, 0, 0);
	for (let i = 0; i < 9; i++) {
		const a = (i / 9) * Math.PI * 2 + rand();
		const rad = i === 0 ? 0 : 0.14 + rand() * 0.18;
		const x = Math.cos(a) * rad;
		const z = Math.sin(a) * rad;
		const h = 0.1 + rand() * 0.12;
		k.box('solid', 0x5fae6e, 0.016, h, 0.016, x, 0.04, z);
		k.ball('solid', pick(BLOOMS, rand()), 0.05, x, 0.06 + h, z, { sy: 0.7, ry: rand() * 3 });
		k.ball('solid', 0xffe08a, 0.02, x, 0.09 + h, z);
	}
}

function pond(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const joined = [0, 1, 2, 3].map((d) => waterJoins(ctx, d));
	const lo = (j: boolean): number => (j ? -0.5 : -0.41);
	const hi = (j: boolean): number => (j ? 0.5 : 0.41);
	const x0 = lo(joined[3]);
	const x1 = hi(joined[1]);
	const z0 = lo(joined[0]);
	const z1 = hi(joined[2]);
	const spring = ctx.combos.includes('spring');
	k.box(spring ? 'lamp' : 'water', spring ? 0xa9f5ee : 0, x1 - x0, 0.04, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2);
	if (spring) k.glow(0, 0.1, 0, 0x9ff3ee, 1.6);
	// Mossy stones on each side that is not joined to water.
	for (let d = 0; d < 4; d++) {
		if (joined[d]) continue;
		for (let i = -2; i <= 2; i++) {
			const t = i * 0.2 + (rand() - 0.5) * 0.05;
			const x = DX[d] * 0.44 + (DX[d] === 0 ? t : 0);
			const z = DZ[d] * 0.44 + (DZ[d] === 0 ? t : 0);
			k.ball('solid', pick([0xc4c6d0, 0xb4b8c4, 0xd2d4dc, MOSS], rand()), 0.075 + rand() * 0.03, x, 0.03, z, { sy: 0.6, ry: rand() * 3 });
		}
	}
	const lx = (rand() - 0.5) * 0.4;
	const lz = (rand() - 0.5) * 0.4;
	k.cyl('solid', 0x6fc487, 0.09, 0.09, 0.012, 7, lx, 0.04, lz);
	k.ball('solid', 0xffc1d9, 0.035, lx + 0.02, 0.07, lz, { sy: 0.7 });
}

/** A bent vine that holds glowing seed pods. The first lanterns all faced one way: that is turn 2. */
function lantern(k: Kit, ctx: Ctx): void {
	k.yaw(yawOf(ctx.r - 2));
	k.ball('solid', MOSS, 0.09, 0, 0.01, 0, { sy: 0.4 });
	k.cyl('solid', BARK_DARK, 0.025, 0.045, 0.34, 5, -0.02, 0, 0, { rz: 0.12 });
	k.cyl('solid', BARK_DARK, 0.018, 0.025, 0.3, 5, 0.02, 0.3, 0, { rz: -0.5 });
	k.cyl('solid', BARK_DARK, 0.012, 0.018, 0.16, 5, 0.13, 0.52, 0, { rz: -1.35 });
	k.ball('solid', 0x6fc487, 0.05, -0.07, 0.3, 0.02, { sy: 0.4, rz: 0.6 });
	k.ball('solid', 0x4fae78, 0.045, 0.02, 0.44, -0.04, { sy: 0.4, rz: -0.5 });
	k.box('solid', BARK_DARK, 0.008, 0.1, 0.008, 0.19, 0.48, 0);
	k.ball('solid', 0x4fae78, 0.06, 0.19, 0.47, 0, { sy: 0.4 });
	k.ball('lamp', GOLD, 0.075, 0.19, 0.39, 0, { sy: 1.15 });
	k.box('solid', BARK_DARK, 0.008, 0.07, 0.008, 0.08, 0.5, 0.03);
	k.ball('lamp', 0xfff1c4, 0.04, 0.08, 0.47, 0.03);
	k.glow(0.19, 0.4, 0, 0xffd27a, 1.6);
}

/** A rope bridge of planks, with vines that hang below. */
function bridge(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed + 2);
	const joined = ctx.sides.map((s) => s !== null);
	k.box('solid', WOOD_DARK, 0.5, 0.06, 0.5, 0, -0.11, 0);
	for (let i = -1; i <= 1; i++) k.box('solid', i === 0 ? 0xd9b78a : WOOD, 0.62, 0.05, 0.2, 0, -0.03, i * 0.207);
	for (let d = 0; d < 4; d++) {
		const along = DZ[d] !== 0;
		const px = DZ[d] === 0 ? 0 : 0.31;
		const pz = DX[d] === 0 ? 0 : 0.31;
		if (joined[d]) {
			k.box('solid', WOOD, along ? 0.62 : 0.2, 0.05, along ? 0.2 : 0.62, DX[d] * 0.405, -0.03, DZ[d] * 0.405);
			for (const side of [-1, 1]) {
				k.box('solid', ROPE, along ? 0.02 : 0.2, 0.02, along ? 0.2 : 0.02, DX[d] * 0.405 + side * px, 0.17, DZ[d] * 0.405 + side * pz);
			}
		} else {
			k.box('solid', ROPE, along ? 0.62 : 0.02, 0.02, along ? 0.02 : 0.62, DX[d] * 0.31, 0.17, DZ[d] * 0.31);
		}
	}
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
		k.box('solid', BARK_DARK, 0.05, 0.25, 0.05, sx * 0.31, -0.04, sz * 0.31);
		k.ball('solid', 0x6fc487, 0.045, sx * 0.31, 0.23, sz * 0.31, { sy: 0.7 });
	}
	for (let i = 0; i < 3; i++) {
		const len = 0.15 + rand() * 0.4;
		k.box('solid', MOSS, 0.025, len, 0.025, (rand() - 0.5) * 0.5, -0.11 - len, (rand() - 0.5) * 0.5);
	}
	if (rand() < 0.35) {
		k.ball('lamp', GOLD, 0.035, 0.31, 0.3, 0.31);
		k.glow(0.31, 0.3, 0.31, 0xffd27a, 0.8);
	}
}

function crystal(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const tones = pick([[0xc7a8ff, 0xe0ccff], [0x9fe0ff, 0xc9f0ff], [0xffb3e6, 0xffd6f1]], rand());
	k.ball('solid', STONE, 0.14, 0.05, 0.03, 0.03, { sy: 0.5 });
	k.ball('solid', 0xa9a8ba, 0.1, -0.15, 0.03, -0.08, { sy: 0.5 });
	k.ball('solid', MOSS, 0.06, 0.12, 0.05, -0.1, { sy: 0.4 });
	k.gem('crystal', tones[0], 0.17, 0, 0.3, 0, { sy: 1.9, rz: 0.08 });
	k.gem('crystal', tones[1], 0.11, 0.17, 0.18, 0.06, { sy: 1.7, rz: -0.4 });
	k.gem('crystal', tones[1], 0.09, -0.14, 0.16, -0.05, { sy: 1.7, rz: 0.45 });
	k.gem('crystal', tones[0], 0.07, 0.02, 0.12, 0.17, { sy: 1.6, rx: 0.5 });
	k.glow(0, 0.35, 0, tones[0], 1.2);
}

/** A seat cut from a fallen log. */
function bench(k: Kit, ctx: Ctx): void {
	k.yaw(yawOf(ctx.r));
	k.add('solid', new THREE.CylinderGeometry(0.105, 0.115, 0.56, 7), BARK, 0, 0.11, 0.04, { rz: Math.PI / 2 });
	k.box('solid', 0xe3c79c, 0.5, 0.025, 0.17, 0, 0.19, 0.04);
	for (const sx of [-1, 1]) {
		k.cyl('solid', 0xe3c79c, 0.1, 0.1, 0.012, 7, sx * 0.285, 0.105, 0.04, { rz: Math.PI / 2 });
		k.cyl('solid', BARK_DARK, 0.018, 0.022, 0.42, 5, sx * 0.2, 0, 0.16, { rz: sx * -0.08 });
	}
	k.box('solid', BARK_DARK, 0.5, 0.03, 0.03, 0, 0.33, 0.16);
	k.box('solid', BARK_DARK, 0.5, 0.025, 0.025, 0, 0.25, 0.16);
	k.ball('solid', 0x6fc487, 0.09, -0.12, 0.215, 0.04, { sy: 0.25 });
	k.cyl('solid', 0xfff4e2, 0.012, 0.016, 0.05, 4, 0.25, 0.2, -0.02);
	k.cyl('solid', 0xf28fa0, 0.008, 0.035, 0.03, 5, 0.25, 0.245, -0.02);
	if (ctx.combos.includes('nook')) {
		k.box('solid', 0xc9a8ff, 0.12, 0.025, 0.09, 0.12, 0.205, 0.03, { ry: 0.3 });
		k.glow(0, 0.3, 0, 0xffd58a, 1.4);
	}
}

function waterfall(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	k.ball('solid', 0xa9a8ba, 0.3, 0, 0.2, 0, { sy: 0.9, ry: rand() * 3 });
	k.ball('solid', 0x9896ac, 0.19, 0.22, 0.12, 0.16, { ry: rand() * 3 });
	k.ball('solid', 0xb9b8c8, 0.15, -0.22, 0.1, -0.14, { ry: rand() * 3 });
	k.ball('solid', MOSS, 0.1, -0.1, 0.42, 0.1, { sy: 0.5 });
	k.ball('solid', 0x4fa068, 0.07, 0.16, 0.3, -0.12, { sy: 0.5 });
	k.ball('water', 0, 0.11, 0.02, 0.44, -0.02, { sy: 0.45 });
	for (let d = 0; d < 4; d++) {
		const toPond = ctx.sides[d] === 'pond' || ctx.sides[d] === 'crossing';
		const spill = ctx.spills.includes(d);
		if (!toPond && !spill) continue;
		const along = DZ[d] !== 0;
		// A stream down the rock, then a channel to the edge of the cell.
		k.box('water', 0, along ? 0.2 : 0.05, 0.42, along ? 0.05 : 0.2, DX[d] * 0.27, 0.02, DZ[d] * 0.27, along ? { rx: -DZ[d] * 0.35 } : { rz: DX[d] * 0.35 });
		k.box('water', 0, along ? 0.22 : 0.3, 0.04, along ? 0.3 : 0.22, DX[d] * 0.36, 0, DZ[d] * 0.36);
		if (spill) k.box('water', 0, along ? 0.22 : 0.06, 5, along ? 0.06 : 0.22, DX[d] * 0.54, -4.97, DZ[d] * 0.54);
	}
	if (ctx.combos.includes('rainbow')) {
		const bands = [0xff9aa2, 0xffcf8a, 0xfff1a8, 0x9be7a5, 0x9fd0ff, 0xc9a8ff];
		bands.forEach((c, i) => k.add('lamp', new THREE.TorusGeometry(0.44 - i * 0.022, 0.011, 3, 14, Math.PI), c, 0, 0.3, 0, { ry: Math.PI / 4 }));
	}
}

/** A tall flower. Its petals are sails that turn in the wind. */
function windmill(k: Kit, ctx: Ctx): void {
	k.yaw(yawOf(ctx.r));
	k.cyl('solid', 0x4fa068, 0.045, 0.085, 0.86, 6, 0, 0, 0);
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * Math.PI * 2 + 0.6;
		k.ball('solid', i % 2 ? 0x6fc487 : 0x4fae78, 0.2, Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2, { sy: 0.18, ry: -a, sz: 0.5 });
	}
	k.ball('solid', 0x6fc487, 0.12, 0.09, 0.42, 0.03, { sy: 0.2, sz: 0.5, rz: 0.5 });
	k.ball('solid', 0x4fae78, 0.11, -0.09, 0.56, -0.02, { sy: 0.2, sz: 0.5, rz: -0.5 });
	k.ball('solid', 0x4fa068, 0.09, 0, 0.86, -0.02);
	k.box('solid', 0x4fa068, 0.035, 0.035, 0.12, 0, 0.85, -0.1);
}

/** The petals of the wind bloom. They are a part of their own, so that they can turn. */
function windmillSails(seed: number): THREE.Group {
	const rand = rng(seed);
	const tone = pick([0xffa3c4, 0xc9a8ff, 0xffd66b, 0x9fe0ff], rand());
	const k = new Kit();
	k.ball('solid', 0xffd66b, 0.065, 0, 0, 0, { sz: 0.6 });
	for (let i = 0; i < 5; i++) {
		const a = (i * Math.PI * 2) / 5;
		k.ball('solid', i % 2 ? lighter(tone, 0.45) : tone, 0.17, -Math.sin(a) * 0.22, Math.cos(a) * 0.22, 0.01, { rz: a, sx: 0.5, sy: 1.15, sz: 0.1 });
	}
	return k.build();
}

function mushroom(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const fairy = ctx.combos.includes('fairy');
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2 + rand() * 0.3;
		const x = Math.cos(a) * 0.3;
		const z = Math.sin(a) * 0.3;
		const h = 0.07 + rand() * 0.09;
		const r = 0.07 + rand() * 0.035;
		k.cyl('solid', 0xfff4e2, 0.022, 0.03, h, 5, x, 0, z);
		k.cyl('solid', pick([0xe86f86, 0xb48cf0, 0xffb060, 0xf28fb4], rand()), 0.02, r, r * 0.8, 6, x, h - 0.01, z);
		if (fairy) k.ball('lamp', 0xe9d6ff, 0.016, x, h + r * 0.85, z);
	}
	k.ball('solid', MOSS, 0.06, 0.03, 0.01, -0.02, { sy: 0.4 });
	if (fairy) k.glow(0, 0.15, 0, 0xd4b3ff, 1.6);
}

function dock(k: Kit, ctx: Ctx): void {
	k.yaw(yawOf(ctx.r));
	for (let i = 0; i < 5; i++) k.box('solid', i % 2 ? WOOD : 0xd9b78a, 0.46, 0.05, 0.15, 0, 0, 0.12 - i * 0.165);
	for (const sx of [-1, 1]) {
		k.box('solid', BARK_DARK, 0.05, 0.5, 0.05, sx * 0.2, -0.4, -0.58);
		k.box('solid', BARK_DARK, 0.05, 0.22, 0.05, sx * 0.2, -0.17, -0.1);
	}
	k.cyl('solid', BARK, 0.02, 0.03, 0.4, 5, -0.2, 0.05, -0.58);
	k.ball('solid', 0x4fae78, 0.06, -0.2, 0.47, -0.58, { sy: 0.4 });
	k.ball('lamp', GOLD, 0.05, -0.2, 0.41, -0.58);
	k.glow(-0.2, 0.41, -0.58, 0xffd27a, 1);
	k.box('solid', WOOD, 0.14, 0.1, 0.12, 0.13, 0.05, 0.02);
	k.box('solid', MOSS, 0.03, 0.3, 0.03, 0.2, -0.3, -0.3);
}

/** The leaf boat at the sky dock. A seed puff holds it up. */
function dockBoat(seed: number): THREE.Group {
	const rand = rng(seed);
	const k = new Kit();
	const tone = pick([0xfff4e2, 0xffd6ea, 0xfff1a8, 0xd6f0ff], rand());
	k.ball('solid', 0x4fae78, 0.2, 0, 0, 0, { sy: 0.4, sz: 1.6 });
	k.ball('solid', 0x6fc487, 0.16, 0, 0.03, 0, { sy: 0.3, sz: 1.5 });
	k.box('solid', ROPE, 0.01, 0.34, 0.01, 0.08, 0.04, 0.12);
	k.box('solid', ROPE, 0.01, 0.34, 0.01, -0.08, 0.04, -0.12);
	k.ball('solid', tone, 0.25, 0, 0.58, 0, { sy: 0.9 });
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2;
		k.ball('solid', 0xffffff, 0.07, Math.cos(a) * 0.2, 0.6, Math.sin(a) * 0.2);
	}
	return k.build();
}

/** A stall under a big mushroom cap. */
function market(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	k.yaw(yawOf(ctx.r));
	const cap = pick([0xe86f86, 0xb48cf0, 0xffb060, 0x4fb0a8], rand());
	k.add('solid', new THREE.CylinderGeometry(0.11, 0.12, 0.6, 7), BARK, 0, 0.12, -0.04, { rz: Math.PI / 2 });
	k.box('solid', 0xe3c79c, 0.56, 0.025, 0.2, 0, 0.215, -0.04);
	k.cyl('solid', 0xfff4e2, 0.08, 0.11, 0.6, 7, 0, 0, 0.24);
	k.cyl('solid', cap, 0.08, 0.5, 0.2, 9, 0, 0.58, 0.08);
	k.cyl('solid', lighter(cap, 0.25), 0.02, 0.09, 0.06, 7, 0, 0.77, 0.08);
	k.cyl('solid', 0xfff4e2, 0.46, 0.46, 0.02, 9, 0, 0.565, 0.08);
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2 + rand();
		k.ball('solid', 0xfffaf0, 0.045, Math.cos(a) * 0.27, 0.69, 0.08 + Math.sin(a) * 0.27, { sy: 0.4 });
	}
	for (let i = 0; i < 4; i++) k.ball('solid', pick([0xff8f9c, 0xffc27a, 0xb48cf0, 0x7fcf8f], rand()), 0.05, -0.2 + i * 0.13, 0.28, -0.04 + (rand() - 0.5) * 0.08);
	k.box('solid', WOOD_DARK, 0.16, 0.12, 0.14, 0.22, 0, -0.3);
	k.ball('solid', 0xffc27a, 0.045, 0.22, 0.15, -0.3);
	k.ball('lamp', GOLD, 0.03, -0.3, 0.46, -0.12);
	k.glow(-0.3, 0.46, -0.12, 0xffd27a, 0.8);
}

/** A thin tower grown from a twisted tree. Its horns hold a star. */
function tower(k: Kit): void {
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * Math.PI * 2;
		k.cyl('solid', BARK_DARK, 0.03, 0.07, 0.28, 5, Math.cos(a) * 0.26, -0.03, Math.sin(a) * 0.26, { rz: Math.cos(a) * 0.8, rx: -Math.sin(a) * 0.8 });
	}
	k.cyl('solid', BARK, 0.18, 0.27, 0.55, 7, 0, 0, 0);
	k.cyl('solid', BARK_LIGHT, 0.13, 0.18, 0.5, 7, 0, 0.55, 0, { ry: 0.4 });
	k.cyl('solid', BARK, 0.09, 0.13, 0.45, 7, 0, 1.05, 0, { ry: 0.8 });
	k.ball('solid', 0x3f9a6a, 0.3, 0, 0.58, 0, { sy: 0.3 });
	k.ball('solid', 0x4fae78, 0.24, 0, 1.07, 0, { sy: 0.3 });
	k.ball('solid', 0x6fc487, 0.18, 0, 1.5, 0, { sy: 0.35 });
	for (const sx of [-1, 1]) {
		k.cyl('solid', BARK_LIGHT, 0.012, 0.035, 0.34, 5, sx * 0.11, 1.5, 0, { rz: sx * -0.45 });
		k.cyl('solid', BARK_LIGHT, 0.004, 0.012, 0.16, 5, sx * 0.17, 1.8, 0, { rz: sx * 0.35 });
	}
	k.cyl('solid', 0xe8c98a, 0.1, 0.1, 0.03, 9, 0, 0.1, -0.245, { rx: Math.PI / 2 });
	k.cyl('solid', 0x6f4530, 0.08, 0.08, 0.04, 9, 0, 0.095, -0.255, { rx: Math.PI / 2 });
	for (let i = 0; i < 3; i++) {
		const a = (i / 3) * Math.PI * 2 + 0.5;
		k.ball('glow', 0, 0.05, Math.sin(a) * 0.165, 0.78, -Math.cos(a) * 0.165);
		k.ball('glow', 0, 0.04, Math.sin(a + 1) * 0.115, 1.25, -Math.cos(a + 1) * 0.115);
	}
	k.glow(0, 1.9, 0, 0xd9d0ff, 1.8);
}

function towerStar(): THREE.Group {
	return new Kit().gem('lamp', 0xf0ecff, 0.085, 0, 0, 0, { sy: 1.3 }).build(false);
}

/** The Elder Tree: far bigger than any other piece. Its crown shades the cells around it. */
function elder(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2 + 0.2;
		k.cyl('solid', BARK_DARK, 0.05, 0.13, 0.7, 5, Math.cos(a) * 0.46, -0.1, Math.sin(a) * 0.46, { rz: Math.cos(a) * 0.9, rx: -Math.sin(a) * 0.9 });
	}
	k.cyl('solid', BARK, 0.36, 0.48, 1.0, 9, 0, 0, 0);
	k.cyl('solid', BARK_LIGHT, 0.3, 0.36, 0.9, 9, 0, 1.0, 0, { ry: 0.3 });
	k.cyl('solid', BARK, 0.22, 0.3, 0.7, 9, 0, 1.9, 0, { ry: 0.6 });
	// Great boughs reach out under the crown.
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * Math.PI * 2 + 0.9;
		k.cyl('solid', BARK, 0.06, 0.13, 1.3, 6, Math.cos(a) * 0.55, 1.75, Math.sin(a) * 0.55, { rz: -Math.cos(a) * 0.95, rx: Math.sin(a) * 0.95 });
	}
	k.cyl('solid', 0xe8c98a, 0.2, 0.2, 0.04, 10, 0, 0.14, -0.44, { rx: Math.PI / 2 });
	k.cyl('solid', 0x6f4530, 0.165, 0.165, 0.05, 10, 0, 0.13, -0.455, { rx: Math.PI / 2 });
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2 + 0.4;
		const y = 0.6 + (i % 3) * 0.45;
		const r = 0.4 - y * 0.05;
		k.ball('glow', 0, 0.065, Math.sin(a) * r, y, -Math.cos(a) * r);
	}
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * Math.PI * 2 + 1.3;
		k.cyl('solid', i % 2 ? 0xf2d9b0 : 0xf7c9a8, 0.15, 0.1, 0.04, 7, Math.cos(a) * 0.46, 0.35 + i * 0.22, Math.sin(a) * 0.46);
	}
	// The crown: many great balls of leaves, with gold lights that hang below.
	const greens = [0x2f8f6a, 0x3f9a6a, 0x4fae78, 0x2f9a58, 0x58b58a];
	k.ball('solid', greens[0], 1.25, 0, 3.0, 0, { sy: 0.75 });
	for (let i = 0; i < 9; i++) {
		const a = (i / 9) * Math.PI * 2 + rand();
		const rr = 0.9 + rand() * 0.6;
		k.ball('solid', pick(greens, rand()), 0.6 + rand() * 0.35, Math.cos(a) * rr, 2.5 + rand() * 0.9, Math.sin(a) * rr, { sy: 0.8, ry: rand() * 3 });
	}
	k.ball('solid', greens[2], 0.7, 0.1, 3.8, -0.1, { sy: 0.8 });
	for (let i = 0; i < 9; i++) {
		const a = (i / 9) * Math.PI * 2 + rand();
		const rr = 0.7 + rand() * 0.8;
		const x = Math.cos(a) * rr;
		const z = Math.sin(a) * rr;
		const len = 0.25 + rand() * 0.5;
		k.box('solid', MOSS, 0.012, len, 0.012, x, 2.15 - len, z);
		k.ball('lamp', pick([GOLD, 0xfff1c4, 0xd9ffd0], rand()), 0.05, x, 2.12 - len, z);
		if (i % 3 === 0) k.glow(x, 2.12 - len, z, 0xffd58a, 1.4);
	}
	k.glow(0, 0.4, -0.6, 0xffd58a, 1.6);
	k.glow(0, 3, 0, 0xbfffd0, 5);
}

/** A pool with a small arched bridge over it. It is made when a path meets a river. */
function crossing(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const joined = [0, 1, 2, 3].map((d) => waterJoins(ctx, d));
	const walks = [0, 1, 2, 3].map((d) => pathJoins(ctx, d));
	const lo = (j: boolean): number => (j ? -0.5 : -0.41);
	const hi = (j: boolean): number => (j ? 0.5 : 0.41);
	const x0 = lo(joined[3]);
	const x1 = hi(joined[1]);
	const z0 = lo(joined[0]);
	const z1 = hi(joined[2]);
	k.box('water', 0, x1 - x0, 0.04, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2);
	// The bridge follows the path. With no path yet, it crosses the river the short way.
	const pathZ = walks[0] || walks[2];
	const pathX = walks[1] || walks[3];
	const waterZ = joined[0] || joined[2];
	const waterX = joined[1] || joined[3];
	const alongZ = pathZ !== pathX ? pathZ : waterZ !== waterX ? waterX : true;
	// Stones on the banks where the bridge does not land.
	for (let d = 0; d < 4; d++) {
		if (joined[d] || (DZ[d] !== 0) === alongZ) continue;
		for (let i = -2; i <= 2; i++) {
			const t = i * 0.2 + (rand() - 0.5) * 0.05;
			k.ball('solid', pick([0xc4c6d0, 0xb4b8c4, 0xd2d4dc, MOSS], rand()), 0.075 + rand() * 0.03, DX[d] * 0.44 + (DX[d] === 0 ? t : 0), 0.03, DZ[d] * 0.44 + (DZ[d] === 0 ? t : 0), { sy: 0.6, ry: rand() * 3 });
		}
	}
	if (!alongZ) k.yaw(Math.PI / 2);
	const arch = (z: number): number => 0.035 + 0.1 * Math.cos(z * 3.3);
	for (let i = -2; i <= 2; i++) {
		const z = i * 0.2;
		const slope = -0.33 * Math.sin(z * 3.3);
		k.box('solid', i % 2 ? WOOD : 0xd9b78a, 0.5, 0.035, 0.215, 0, arch(z), z, { rx: -Math.atan(slope) });
	}
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			k.box('solid', BARK_DARK, 0.045, 0.3, 0.045, sx * 0.27, 0, sz * 0.42);
			k.ball('solid', 0x6fc487, 0.04, sx * 0.27, 0.31, sz * 0.42, { sy: 0.7 });
		}
		k.box('solid', BARK_DARK, 0.035, 0.34, 0.035, sx * 0.27, 0.06, 0);
		for (const sz of [-1, 1]) k.box('solid', ROPE, 0.018, 0.018, 0.43, sx * 0.27, 0.3, sz * 0.21, { rx: sz * 0.19 });
	}
	if (rand() < 0.5) {
		k.ball('lamp', GOLD, 0.035, 0.27, 0.43, 0);
		k.glow(0.27, 0.43, 0, 0xffd27a, 0.8);
	}
}

/** A home under a big spotted mushroom cap. */
function shroomhouse(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const cap = pick([0xe86f86, 0xd9604a, 0xb48cf0, 0xf2a03c, 0x4fb0a8], rand());
	k.yaw(yawOf(ctx.r));
	k.cyl('solid', 0xfff4e2, 0.25, 0.31, 0.5, 8, 0, 0, 0);
	k.cyl('solid', 0xf7e6cc, 0.47, 0.47, 0.03, 9, 0, 0.44, 0);
	k.cyl('solid', cap, 0.1, 0.53, 0.34, 9, 0, 0.46, 0);
	k.cyl('solid', lighter(cap, 0.2), 0.02, 0.1, 0.09, 7, 0, 0.8, 0);
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2 + rand();
		const rr = 0.2 + (i % 2) * 0.16;
		k.ball('solid', 0xfffaf0, 0.055 + rand() * 0.02, Math.cos(a) * rr, 0.47 + (0.53 - rr) * 0.81 + 0.02, Math.sin(a) * rr, { sy: 0.45 });
	}
	roundDoor(k, 0.11, 0.115, -0.285);
	k.box('solid', 0xc9cdb6, 0.2, 0.025, 0.1, 0, 0, -0.37);
	for (const a of [-0.95, 0.95]) k.ball('glow', 0, 0.055, Math.sin(a) * 0.265, 0.3, -Math.cos(a) * 0.265);
	k.cyl('solid', STONE, 0.035, 0.045, 0.22, 5, 0.2, 0.62, 0.14);
	k.cyl('solid', 0xfff4e2, 0.02, 0.028, 0.1, 5, -0.38, 0, 0.3);
	k.cyl('solid', lighter(cap, 0.15), 0.015, 0.075, 0.06, 6, -0.38, 0.09, 0.3);
	k.ball('solid', MOSS, 0.07, 0.34, 0.02, 0.28, { sy: 0.4 });
	if (ctx.homed) doorLamp(k, 0.21, 0.32, -0.3);
}

/** A round home of sky stone, with moss for a roof. */
function stonehut(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const roof = pick([0x5fae6e, 0x4fa068, 0xc9a25a, 0x8a6fc8, 0x3f9f9a], rand());
	k.yaw(yawOf(ctx.r));
	k.cyl('solid', STONE, 0.31, 0.35, 0.42, 8, 0, 0, 0);
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2 + 1 + rand() * 0.5;
		k.ball('solid', pick([0xa9a8ba, 0xc8c7d6, 0x9896ac], rand()), 0.07 + rand() * 0.03, Math.cos(a) * 0.32, 0.08 + rand() * 0.26, Math.sin(a) * 0.32, { sz: 0.6, ry: -a });
	}
	k.cyl('solid', roof, 0.05, 0.46, 0.4, 8, 0, 0.4, 0);
	k.ball('solid', lighter(roof, 0.2), 0.08, 0, 0.8, 0, { sy: 0.7 });
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * Math.PI * 2 + rand() * 1.5;
		k.ball('solid', lighter(roof, 0.25), 0.09, Math.cos(a) * 0.26, 0.58, Math.sin(a) * 0.26, { sy: 0.45 });
	}
	k.box('solid', 0xe8c98a, 0.2, 0.28, 0.03, 0, 0, -0.335);
	k.box('solid', 0x6f4530, 0.15, 0.25, 0.04, 0, 0, -0.345);
	k.ball('solid', GOLD, 0.014, 0.04, 0.13, -0.37);
	k.box('solid', 0xc9cdb6, 0.22, 0.025, 0.1, 0, 0, -0.41);
	for (const a of [-1, 1]) k.ball('glow', 0, 0.055, Math.sin(a) * 0.31, 0.26, -Math.cos(a) * 0.31);
	k.box('solid', 0xa9a8ba, 0.09, 0.26, 0.09, 0.17, 0.5, 0.12);
	k.ball('solid', MOSS, 0.07, -0.36, 0.02, 0.26, { sy: 0.4 });
	if (ctx.homed) doorLamp(k, 0.2, 0.36, -0.36);
}

/** A small house on a deck, high up a tree. A ladder leads to it. */
function nest(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const leaf = pick(CANOPY, rand());
	const leaf2 = lighter(leaf, 0.22);
	k.yaw(yawOf(ctx.r));
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * Math.PI * 2 + 0.8;
		k.cyl('solid', BARK_DARK, 0.025, 0.06, 0.24, 5, Math.cos(a) * 0.16, -0.03, Math.sin(a) * 0.16, { rz: Math.cos(a) * 0.8, rx: -Math.sin(a) * 0.8 });
	}
	k.cyl('solid', BARK, 0.1, 0.16, 0.98, 6, 0, 0, 0.05);
	k.cyl('solid', WOOD, 0.42, 0.36, 0.05, 8, 0, 0.95, 0.05);
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2 + 0.45;
		// No rail where the ladder comes up.
		if (Math.sin(a) < -0.75) continue;
		k.box('solid', WOOD_DARK, 0.02, 0.12, 0.02, Math.cos(a) * 0.38, 1.0, 0.05 + Math.sin(a) * 0.38);
	}
	k.cyl('solid', 0xe3c79c, 0.23, 0.25, 0.3, 7, 0, 1.0, 0.09);
	k.cyl('solid', leaf, 0.03, 0.4, 0.32, 7, 0, 1.28, 0.09);
	k.ball('solid', leaf2, 0.15, 0, 1.63, 0.09, { sy: 0.8 });
	k.ball('solid', leaf, 0.2, 0.3, 1.22, 0.3, { sy: 0.7 });
	k.ball('solid', leaf2, 0.17, -0.32, 1.18, 0.2, { sy: 0.7 });
	k.box('solid', 0x6f4530, 0.1, 0.19, 0.03, -0.07, 1.0, -0.155);
	k.ball('glow', 0, 0.05, 0.1, 1.17, -0.13);
	k.ball('glow', 0, 0.045, 0.22, 1.15, 0.16);
	for (const sx of [-1, 1]) k.box('solid', WOOD_DARK, 0.018, 1.0, 0.018, sx * 0.07, 0, -0.34, { rx: -0.05 });
	for (let i = 0; i < 6; i++) k.box('solid', WOOD, 0.14, 0.018, 0.018, 0, 0.12 + i * 0.15, -0.345 + i * 0.008);
	k.box('solid', MOSS, 0.02, 0.3, 0.02, 0.3, 0.65, 0.2);
	k.box('solid', MOSS, 0.02, 0.2, 0.02, -0.26, 0.75, -0.1);
	if (ctx.homed) doorLamp(k, 0.3, 0.93, -0.2);
}

/** A slab of sky stone on two blocks. */
function stonebench(k: Kit, ctx: Ctx): void {
	k.yaw(yawOf(ctx.r));
	for (const sx of [-1, 1]) k.box('solid', 0xa9a8ba, 0.1, 0.15, 0.2, sx * 0.2, 0, 0.04);
	k.box('solid', 0xd2d4dc, 0.58, 0.05, 0.25, 0, 0.15, 0.04);
	k.box('solid', 0xb9b8c8, 0.58, 0.2, 0.05, 0, 0.15, 0.19);
	k.ball('solid', 0xc8c7d6, 0.06, -0.29, 0.36, 0.19);
	k.ball('solid', 0xc8c7d6, 0.06, 0.29, 0.36, 0.19);
	k.ball('solid', MOSS, 0.09, 0.16, 0.2, 0.06, { sy: 0.25 });
	k.ball('solid', 0x4fa068, 0.07, -0.3, 0.02, -0.06, { sy: 0.4 });
	if (ctx.combos.includes('nook')) k.glow(0, 0.3, 0, 0xffd58a, 1.4);
}

/** The frame of the swing. The seat is a part of its own, so that it can sway. */
function swing(k: Kit, ctx: Ctx): void {
	k.yaw(yawOf(ctx.r));
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) k.cyl('solid', BARK_DARK, 0.022, 0.03, 0.8, 5, sx * 0.36, 0, sz * 0.1, { rx: sz * -0.26 });
		k.ball('solid', sx > 0 ? 0x6fc487 : 0x4fae78, 0.07, sx * 0.36, 0.78, 0, { sy: 0.6 });
	}
	k.box('solid', BARK, 0.8, 0.04, 0.04, 0, 0.73, 0);
	k.ball('solid', 0xffa3c4, 0.03, 0.2, 0.79, 0);
	k.ball('solid', 0xfff1a8, 0.03, -0.12, 0.79, 0);
}

function swingSeat(): THREE.Group {
	const k = new Kit();
	for (const sx of [-1, 1]) k.box('solid', ROPE, 0.012, 0.52, 0.012, sx * 0.15, -0.52, 0);
	k.box('solid', 0xe3c79c, 0.38, 0.03, 0.15, 0, -0.55, 0);
	return k.build();
}

/** A table with two seats, a cloth and a few treats. */
function picnic(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const cloth = pick([0xff8f9c, 0x9fd0ff, 0xffd66b, 0xc9a8ff], rand());
	k.yaw(yawOf(ctx.r));
	k.box('solid', 0xe3c79c, 0.52, 0.03, 0.3, 0, 0.22, 0);
	for (const sx of [-1, 1]) k.box('solid', WOOD_DARK, 0.04, 0.22, 0.24, sx * 0.19, 0, 0);
	k.box('solid', cloth, 0.26, 0.008, 0.31, 0, 0.25, 0);
	k.box('solid', 0xfffaf0, 0.08, 0.009, 0.31, 0, 0.25, 0);
	for (const sz of [-1, 1]) {
		k.box('solid', WOOD, 0.5, 0.025, 0.11, 0, 0.11, sz * 0.31);
		for (const sx of [-1, 1]) k.box('solid', WOOD_DARK, 0.035, 0.11, 0.08, sx * 0.18, 0, sz * 0.31);
	}
	k.ball('solid', 0xffc27a, 0.04, -0.14, 0.275, 0.04, { sy: 0.7 });
	k.ball('solid', 0xf2a86a, 0.035, -0.08, 0.275, -0.06, { sy: 0.7 });
	k.cyl('solid', 0xfff4e2, 0.04, 0.035, 0.05, 6, 0.1, 0.255, -0.03);
	k.ball('solid', 0xff8f9c, 0.025, 0.1, 0.32, -0.03);
	k.cyl('solid', 0xd6f0ff, 0.022, 0.018, 0.04, 5, 0.2, 0.255, 0.07);
	k.ball('lamp', GOLD, 0.028, 0.02, 0.285, 0.08);
	k.glow(0.02, 0.3, 0.08, 0xffd27a, 0.7);
}

/** A shop with a roof like a loaf of bread. */
function bakery(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const awning = pick([0xff8f9c, 0x4fb0a8, 0xb48cf0, 0xf2a03c], rand());
	k.yaw(yawOf(ctx.r));
	k.box('solid', 0xfff0d8, 0.64, 0.4, 0.5, 0, 0, 0.07);
	for (const sx of [-1, 1]) k.box('solid', WOOD_DARK, 0.04, 0.4, 0.04, sx * 0.31, 0, -0.17);
	k.box('solid', WOOD_DARK, 0.66, 0.035, 0.52, 0, 0.385, 0.07);
	// The loaf, with three cuts on top.
	k.ball('solid', 0xd99a5a, 0.42, 0, 0.42, 0.07, { sx: 0.86, sy: 0.6, sz: 0.72 });
	for (let i = -1; i <= 1; i++) k.box('solid', 0xf2c98a, 0.05, 0.03, 0.3, i * 0.17, 0.63 - Math.abs(i) * 0.035, 0.07, { ry: 0.5 });
	k.box('solid', 0xe8c98a, 0.17, 0.27, 0.03, -0.17, 0, -0.185);
	k.box('solid', 0x6f4530, 0.13, 0.24, 0.04, -0.17, 0, -0.195);
	k.ball('solid', GOLD, 0.014, -0.13, 0.12, -0.22);
	k.box('glow', 0, 0.24, 0.15, 0.02, 0.13, 0.16, -0.185);
	k.box('solid', WOOD, 0.28, 0.02, 0.1, 0.13, 0.135, -0.23);
	for (let i = 0; i < 3; i++) k.ball('solid', i === 1 ? 0xf2a86a : 0xffc27a, 0.04, 0.05 + i * 0.08, 0.175, -0.235, { sy: 0.7 });
	for (let i = 0; i < 4; i++) k.box('solid', i % 2 ? 0xfffaf0 : awning, 0.075, 0.02, 0.15, 0.0175 + i * 0.075, 0.345, -0.25, { rx: -0.45 });
	k.cyl('solid', STONE, 0.045, 0.055, 0.26, 6, 0.2, 0.52, 0.2);
	k.box('solid', WOOD_DARK, 0.012, 0.012, 0.12, -0.3, 0.36, -0.24);
	k.add('solid', new THREE.TorusGeometry(0.035, 0.014, 4, 8), 0xd99a5a, -0.3, 0.3, -0.29);
	k.ball('lamp', GOLD, 0.03, -0.02, 0.33, -0.2);
	k.glow(-0.02, 0.33, -0.22, 0xffd27a, 0.9);
	k.box('solid', 0xc9cdb6, 0.2, 0.025, 0.1, -0.17, 0, -0.27);
}

/** An open tea house with a curved roof and paper lanterns. */
function teahouse(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const roof = pick([0x4fb0a8, 0xb86fa8, 0x5f8fd0, 0xd9604a], rand());
	k.yaw(yawOf(ctx.r));
	k.cyl('solid', WOOD, 0.44, 0.46, 0.05, 8, 0, 0, 0);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('solid', 0xb5523c, 0.04, 0.5, 0.04, sx * 0.28, 0.05, sz * 0.28);
	k.box('solid', 0xfff4e2, 0.56, 0.2, 0.02, 0, 0.05, 0.29);
	k.cyl('solid', roof, 0.2, 0.56, 0.16, 4, 0, 0.53, 0, { ry: Math.PI / 4 });
	k.cyl('solid', lighter(roof, 0.15), 0.03, 0.26, 0.2, 4, 0, 0.69, 0, { ry: Math.PI / 4 });
	k.ball('lamp', GOLD, 0.035, 0, 0.91, 0);
	k.cyl('solid', WOOD_DARK, 0.13, 0.13, 0.03, 7, 0, 0.15, 0);
	k.cyl('solid', WOOD_DARK, 0.03, 0.04, 0.1, 5, 0, 0.05, 0);
	k.ball('solid', 0xfff4e2, 0.05, 0, 0.215, 0, { sy: 0.8 });
	k.cyl('solid', 0xfff4e2, 0.008, 0.012, 0.06, 4, 0.06, 0.2, 0, { rz: -1 });
	k.ball('solid', roof, 0.015, 0, 0.26, 0);
	for (const a of [0.9, 2.6, 4.4]) k.cyl('solid', 0xd6f0ff, 0.018, 0.014, 0.025, 5, Math.cos(a) * 0.09, 0.18, Math.sin(a) * 0.09);
	for (const sx of [-1, 1]) {
		k.ball('solid', sx > 0 ? 0xffa3c4 : 0xc9a8ff, 0.08, sx * 0.2, 0.07, 0.02, { sy: 0.35 });
		k.box('solid', BARK_DARK, 0.008, 0.07, 0.008, sx * 0.34, 0.45, -0.34);
		k.ball('lamp', sx > 0 ? 0xffb98a : 0xffd27a, 0.05, sx * 0.34, 0.41, -0.34, { sy: 1.2 });
		k.glow(sx * 0.34, 0.41, -0.34, 0xffb98a, 0.9);
	}
	k.box('solid', 0xc9cdb6, 0.2, 0.025, 0.1, 0, 0, -0.47);
}

/** A stone well with a small roof and a bucket. */
function well(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const roof = pick([0x5fae6e, 0xb86fa8, 0x4fb0a8, 0xd9a441], rand());
	k.cyl('solid', STONE, 0.25, 0.28, 0.2, 8, 0, 0, 0);
	k.cyl('solid', 0xa9a8ba, 0.27, 0.27, 0.035, 8, 0, 0.19, 0);
	k.cyl('water', 0, 0.2, 0.2, 0.012, 8, 0, 0.222, 0);
	for (const sx of [-1, 1]) k.box('solid', BARK_DARK, 0.04, 0.62, 0.04, sx * 0.24, 0, 0);
	k.add('solid', new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5), WOOD, 0, 0.52, 0, { rz: Math.PI / 2 });
	k.cyl('solid', roof, 0.03, 0.38, 0.2, 4, 0, 0.6, 0, { ry: Math.PI / 4 });
	k.box('solid', ROPE, 0.01, 0.18, 0.01, 0.05, 0.34, 0);
	k.cyl('solid', WOOD, 0.05, 0.04, 0.07, 6, 0.05, 0.27, 0);
	for (let i = 0; i < 3; i++) {
		const a = rand() * 6.28;
		k.ball('solid', pick([MOSS, 0x4fa068, 0x7fcf8f], rand()), 0.07, Math.cos(a) * 0.32, 0.02, Math.sin(a) * 0.32, { sy: 0.4 });
	}
	k.ball('solid', pick(BLOOMS, rand()), 0.035, 0.3, 0.06, 0.2, { sy: 0.7 });
}

/** A board with notes from the elves, under a tiny roof. */
function board(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	k.yaw(yawOf(ctx.r));
	for (const sx of [-1, 1]) k.cyl('solid', BARK_DARK, 0.025, 0.035, 0.58, 5, sx * 0.26, 0, 0.05);
	k.box('solid', WOOD, 0.5, 0.3, 0.03, 0, 0.2, 0.05);
	k.box('solid', 0x4fa068, 0.64, 0.03, 0.16, 0, 0.56, 0.01, { rx: 0.3 });
	const notes = [0xfffaf0, 0xffd6ea, 0xd6f0ff, 0xfff1a8, 0xfffaf0];
	for (let i = 0; i < 5; i++) {
		const x = -0.17 + (i % 3) * 0.17 + (rand() - 0.5) * 0.03;
		const y = 0.25 + Math.floor(i / 3) * 0.13 + (rand() - 0.5) * 0.02;
		k.box('solid', notes[i], 0.1, 0.09, 0.006, x, y - 0.02, 0.03, { rz: (rand() - 0.5) * 0.3 });
		k.ball('solid', 0xff8f9c, 0.01, x, y + 0.055, 0.02);
	}
	k.ball('lamp', GOLD, 0.03, 0, 0.5, -0.04);
	k.glow(0, 0.5, -0.04, 0xffd27a, 0.7);
	k.ball('solid', pick(BLOOMS, rand()), 0.035, -0.3, 0.06, -0.06, { sy: 0.7 });
	k.ball('solid', MOSS, 0.06, 0.32, 0.02, -0.04, { sy: 0.4 });
}

/** Where the festival lights hang on the town tree. */
export const TOWN_TREE_TOP = 1.5;

/** The town tree: a blossom tree with a ring seat and lamps that hang from its boughs. */
function towntree(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	k.cyl('solid', 0xd6d6c2, 0.47, 0.5, 0.04, 10, 0, 0, 0);
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2 + 0.3;
		k.cyl('solid', BARK_DARK, 0.03, 0.08, 0.34, 5, Math.cos(a) * 0.24, -0.02, Math.sin(a) * 0.24, { rz: Math.cos(a) * 0.85, rx: -Math.sin(a) * 0.85 });
	}
	k.cyl('solid', BARK, 0.15, 0.23, 0.9, 8, 0, 0, 0);
	k.cyl('solid', BARK_LIGHT, 0.1, 0.15, 0.6, 8, 0, 0.9, 0, { ry: 0.4 });
	// A ring seat around the trunk.
	k.cyl('solid', 0xe3c79c, 0.38, 0.38, 0.03, 10, 0, 0.17, 0);
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * Math.PI * 2;
		k.box('solid', WOOD_DARK, 0.04, 0.14, 0.04, Math.cos(a) * 0.32, 0.04, Math.sin(a) * 0.32);
	}
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * Math.PI * 2 + 0.6;
		k.cyl('solid', BARK, 0.035, 0.08, 0.8, 5, Math.cos(a) * 0.33, 1.2, Math.sin(a) * 0.33, { rz: -Math.cos(a) * 0.95, rx: Math.sin(a) * 0.95 });
	}
	const blooms = [0xf7b8d0, 0xffd1e0, 0xe89cc0, 0xffc1d9, 0xfbe3ee];
	k.ball('solid', blooms[0], 0.68, 0, 2.05, 0, { sy: 0.78, ry: rand() * 3 });
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2 + rand() * 0.5;
		const rr = 0.48 + rand() * 0.28;
		k.ball('solid', i === 3 ? 0x6fc487 : pick(blooms, rand()), 0.34 + rand() * 0.16, Math.cos(a) * rr, 1.75 + rand() * 0.55, Math.sin(a) * rr, { sy: 0.8, ry: rand() * 3 });
	}
	k.ball('solid', blooms[1], 0.36, 0.06, 2.55, -0.05, { sy: 0.8 });
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2 + rand();
		const rr = 0.42 + rand() * 0.34;
		const x = Math.cos(a) * rr;
		const z = Math.sin(a) * rr;
		const len = 0.14 + rand() * 0.26;
		k.box('solid', MOSS, 0.01, len, 0.01, x, 1.52 - len, z);
		k.ball('lamp', pick([GOLD, 0xffd1e0, 0xfff1c4], rand()), 0.04, x, 1.5 - len, z);
		if (i % 3 === 0) k.glow(x, 1.5 - len, z, 0xffd58a, 1.2);
	}
	k.glow(0, 2, 0, 0xffd1e0, 3.4);
}

/** Builds the model of one piece. */
/** A roof with two slopes. Its ridge runs from front to back. `w` is the width, `h` the height. */
function gable(k: Kit, color: number, w: number, d: number, y: number, h: number, x = 0, z = 0): void {
	const r = w / 1.732;
	const s = h / (1.5 * r);
	k.add('solid', new THREE.CylinderGeometry(r, r, d, 3), color, x, y + 0.5 * r * s, z, { rx: -Math.PI / 2, sz: s });
}

/** A square door with a frame, on the front at -z. */
function plankDoor(k: Kit, x: number, z: number, h = 0.26): void {
	k.box('solid', 0xe8c98a, 0.17, h + 0.02, 0.03, x, 0, z);
	k.box('solid', 0x6f4530, 0.13, h, 0.04, x, 0, z - 0.008);
	k.ball('solid', GOLD, 0.013, x + 0.04, h * 0.5, z - 0.035);
}

/** Rows of sky greens in two raised beds. */
function garden(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	k.yaw(yawOf(ctx.r));
	k.box('solid', 0x7a5a44, 0.88, 0.04, 0.88, 0, 0, 0);
	const crops = ['cabbage', 'carrot', 'pumpkin', 'berry', 'bloom'];
	for (const sx of [-1, 1]) {
		k.box('solid', WOOD_DARK, 0.34, 0.09, 0.72, sx * 0.2, 0.02, 0.04);
		k.box('solid', 0x5c4030, 0.29, 0.1, 0.67, sx * 0.2, 0.02, 0.04);
		const crop = pick(crops, rand());
		for (let i = 0; i < 4; i++) {
			const z = -0.2 + i * 0.16;
			for (const dx of [-0.07, 0.07]) {
				const x = sx * 0.2 + dx;
				const y = 0.12;
				if (crop === 'cabbage') {
					k.ball('solid', 0x8fd38a, 0.055, x, y + 0.03, z, { sy: 0.8, ry: rand() });
					k.ball('solid', 0xc5efb0, 0.03, x, y + 0.06, z);
				} else if (crop === 'carrot') {
					for (const a of [-0.4, 0, 0.4]) k.cyl('solid', 0x5fae6e, 0.003, 0.012, 0.09, 4, x, y, z, { rz: a });
					k.ball('solid', 0xf2a03c, 0.02, x, y + 0.005, z);
				} else if (crop === 'pumpkin') {
					if ((i + (dx > 0 ? 1 : 0)) % 2) k.ball('solid', 0x6fa84a, 0.04, x, y + 0.02, z, { sy: 0.5 });
					else {
						k.ball('solid', 0xf2a03c, 0.055, x, y + 0.035, z, { sy: 0.75 });
						k.cyl('solid', 0x6e4f3a, 0.006, 0.008, 0.03, 4, x, y + 0.07, z);
					}
				} else if (crop === 'berry') {
					k.ball('solid', 0x4fae78, 0.06, x, y + 0.04, z, { ry: rand() });
					for (let b = 0; b < 3; b++) k.ball('solid', 0xff6f9c, 0.014, x + (rand() - 0.5) * 0.08, y + 0.05 + rand() * 0.04, z + (rand() - 0.5) * 0.08);
				} else {
					k.cyl('solid', 0x5fae6e, 0.004, 0.006, 0.1, 4, x, y, z);
					k.ball('solid', pick(BLOOMS, rand()), 0.026, x, y + 0.1, z);
				}
			}
		}
	}
	// A little fence at the back, a watering can and a scarecrow.
	for (let i = 0; i < 5; i++) k.box('solid', WOOD, 0.03, 0.18, 0.02, -0.4 + i * 0.2, 0, 0.44);
	k.box('solid', WOOD, 0.84, 0.025, 0.015, 0, 0.12, 0.445);
	k.cyl('solid', 0x8fb7c9, 0.035, 0.04, 0.06, 7, 0.38, 0.03, -0.38);
	k.cyl('solid', 0x8fb7c9, 0.006, 0.01, 0.07, 4, 0.33, 0.07, -0.38, { rz: 0.9 });
	k.box('solid', WOOD_DARK, 0.02, 0.42, 0.02, 0, 0.03, 0.3);
	k.box('solid', WOOD_DARK, 0.2, 0.02, 0.02, 0, 0.3, 0.3);
	k.box('solid', pick([0xc8664a, 0x5f8fd0, 0xb86fa8], rand()), 0.1, 0.12, 0.06, 0, 0.22, 0.3);
	k.ball('solid', 0xf2d9a0, 0.05, 0, 0.42, 0.3);
	k.cyl('solid', 0xd9a441, 0.02, 0.08, 0.05, 7, 0, 0.45, 0.3);
}

/** A wood shed with an open front, a work bench and a stove. */
function workshop(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const roof = pick([0x8a5a44, 0x5f8fd0, 0x4fa068, 0xb5523c], rand());
	k.yaw(yawOf(ctx.r));
	k.box('solid', WOOD_DARK, 0.84, 0.04, 0.8, 0, 0, 0.02);
	k.box('solid', WOOD, 0.78, 0.5, 0.06, 0, 0.04, 0.36);
	for (const sx of [-1, 1]) {
		k.box('solid', WOOD, 0.06, 0.5, 0.72, sx * 0.37, 0.04, 0.02);
		k.box('solid', WOOD_DARK, 0.07, 0.6, 0.07, sx * 0.37, 0.04, -0.33);
		k.ball('glow', 0, 0.045, sx * 0.4, 0.32, 0.08);
	}
	k.box('solid', roof, 0.96, 0.05, 0.94, 0, 0.6, 0.0, { rx: -0.22 });
	k.box('solid', lighter(roof, 0.2), 0.98, 0.03, 0.06, 0, 0.67, -0.45, { rx: -0.22 });
	// The bench, with a plank and a saw.
	k.box('solid', WOOD, 0.46, 0.035, 0.2, 0, 0.2, 0.12);
	for (const sx of [-1, 1]) k.box('solid', WOOD_DARK, 0.03, 0.2, 0.16, sx * 0.2, 0.04, 0.12);
	k.box('solid', 0xf2d9b0, 0.3, 0.02, 0.06, -0.02, 0.235, 0.1, { ry: 0.2 });
	k.box('solid', 0xc8d0dc, 0.12, 0.05, 0.005, 0.12, 0.25, 0.16);
	k.box('solid', 0xb5523c, 0.04, 0.025, 0.02, 0.19, 0.26, 0.16);
	// Tools on the back wall.
	k.box('solid', 0xc8d0dc, 0.03, 0.12, 0.01, -0.2, 0.36, 0.325);
	k.box('solid', WOOD_DARK, 0.1, 0.02, 0.01, 0.0, 0.42, 0.325);
	k.box('solid', 0x8a8a9a, 0.04, 0.04, 0.02, 0.05, 0.4, 0.325);
	// A stone stove with a chimney, and its glow.
	k.box('solid', STONE, 0.14, 0.24, 0.14, -0.26, 0.04, 0.22);
	k.box('glow', 0, 0.08, 0.06, 0.02, -0.26, 0.08, 0.145);
	k.box('solid', 0xa9a8ba, 0.08, 0.5, 0.08, -0.26, 0.28, 0.26);
	// Logs by the side.
	for (let i = 0; i < 3; i++) k.cyl('solid', i === 1 ? BARK_LIGHT : BARK, 0.045, 0.045, 0.3, 6, 0.42 + (i === 2 ? 0.045 : 0), 0.045 + (i === 2 ? 0.075 : 0) + 0.0, -0.05 + i * 0.09 - (i === 2 ? 0.135 : 0), { rx: Math.PI / 2 });
	k.box('solid', 0xc9cdb6, 0.24, 0.025, 0.1, 0, 0, -0.44);
	k.ball('lamp', GOLD, 0.035, 0.3, 0.5, -0.36);
	k.glow(0.3, 0.5, -0.36, 0xffd27a, 0.8);
}

/** A stone hall of books, with a round window and a blue roof. */
function library(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const roof = pick([0x4a5ea8, 0x5f8fd0, 0x6a5fc0, 0x3f9f9a], rand());
	k.yaw(yawOf(ctx.r));
	k.box('solid', 0xa9a8ba, 0.8, 0.06, 0.74, 0, 0, 0.04);
	k.box('solid', 0xe6e2d6, 0.72, 0.5, 0.64, 0, 0.06, 0.06);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('solid', STONE, 0.08, 0.56, 0.08, sx * 0.36, 0.04, 0.06 + sz * 0.32);
	gable(k, roof, 0.86, 0.78, 0.56, 0.36, 0, 0.06);
	k.box('solid', lighter(roof, 0.2), 0.08, 0.05, 0.8, 0, 0.92, 0.06);
	// A round window in the gable and tall windows on the sides.
	k.cyl('solid', 0xe8c98a, 0.1, 0.1, 0.03, 10, 0, 0.66, -0.26, { rx: Math.PI / 2 });
	k.cyl('glow', 0, 0.075, 0.075, 0.03, 10, 0, 0.66, -0.27, { rx: Math.PI / 2 });
	for (const sx of [-1, 1]) for (const sz of [-0.12, 0.2]) k.box('glow', 0, 0.02, 0.2, 0.1, sx * 0.365, 0.22, sz);
	// An arched door with steps.
	k.box('solid', 0xe8c98a, 0.2, 0.3, 0.03, 0, 0.06, -0.265);
	k.box('solid', 0x4a3a56, 0.15, 0.27, 0.04, 0, 0.06, -0.272);
	k.cyl('solid', 0x4a3a56, 0.075, 0.075, 0.04, 8, 0, 0.33, -0.272, { rx: Math.PI / 2 });
	k.box('solid', 0xc9cdb6, 0.28, 0.03, 0.12, 0, 0, -0.35);
	// A stack of books and a reading lamp by the door.
	for (let i = 0; i < 3; i++) k.box('solid', pick([0xb5523c, 0x5f8fd0, 0xd9a441, 0x4fa068], rand()), 0.1, 0.025, 0.07, 0.25, 0.06 + i * 0.026, -0.32, { ry: rand() - 0.5 });
	k.box('solid', BARK_DARK, 0.015, 0.3, 0.015, -0.26, 0.06, -0.33);
	k.ball('lamp', 0xd6f0ff, 0.04, -0.26, 0.38, -0.33);
	k.glow(-0.26, 0.38, -0.33, 0x9fd0ff, 0.8);
}

/** Two floors of timber frame, with a flower box and a chimney. */
function timberhouse(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const roof = pick([0xb5523c, 0x5f8fd0, 0x4fa068, 0x8a6fc8, 0xd9604a], rand());
	const wall = pick([0xfff4e2, 0xf7e6cc, 0xf2e2d0, 0xe6f0e0], rand());
	k.yaw(yawOf(ctx.r));
	k.box('solid', STONE, 0.66, 0.08, 0.6, 0, 0, 0.04);
	k.box('solid', wall, 0.6, 0.34, 0.54, 0, 0.08, 0.04);
	k.box('solid', wall, 0.68, 0.32, 0.62, 0, 0.42, 0.04);
	// Dark beams on the walls.
	for (const y of [0.08, 0.41, 0.73]) k.box('solid', BARK_DARK, y > 0.4 ? 0.7 : 0.62, 0.03, y > 0.4 ? 0.64 : 0.56, 0, y, 0.04);
	for (const sx of [-1, 1]) {
		k.box('solid', BARK_DARK, 0.03, 0.34, 0.03, sx * 0.3, 0.08, -0.235);
		k.box('solid', BARK_DARK, 0.03, 0.32, 0.03, sx * 0.34, 0.42, -0.275);
		k.box('solid', BARK_DARK, 0.025, 0.36, 0.025, sx * 0.17, 0.43, -0.276, { rz: sx * 0.6 });
	}
	gable(k, roof, 0.82, 0.74, 0.74, 0.42, 0, 0.04);
	k.box('solid', 0xa9a8ba, 0.1, 0.4, 0.1, 0.2, 0.8, 0.22);
	plankDoor(k, -0.12, -0.24);
	k.box('glow', 0, 0.12, 0.12, 0.02, 0.14, 0.18, -0.24);
	k.box('glow', 0, 0.14, 0.12, 0.02, -0.14, 0.52, -0.28);
	k.box('glow', 0, 0.14, 0.12, 0.02, 0.14, 0.52, -0.28);
	k.ball('glow', 0, 0.04, 0, 0.9, -0.33);
	// A flower box under the upper windows.
	k.box('solid', WOOD, 0.44, 0.05, 0.06, 0, 0.47, -0.32);
	for (let i = 0; i < 6; i++) k.ball('solid', pick(BLOOMS, rand()), 0.025, -0.18 + i * 0.072, 0.53, -0.32);
	k.box('solid', 0xc9cdb6, 0.2, 0.025, 0.1, -0.12, 0, -0.32);
	if (ctx.homed) doorLamp(k, 0.02, 0.32, -0.27);
}

/** A round tower of three floors under a pointed roof. */
function towerhouse(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const roof = pick([0x6a5fc0, 0xb86fa8, 0x4fb0a8, 0xd9604a, 0x5f8fd0], rand());
	k.yaw(yawOf(ctx.r));
	k.cyl('solid', STONE, 0.3, 0.34, 0.44, 9, 0, 0, 0);
	k.cyl('solid', 0xe3c79c, 0.29, 0.3, 0.38, 9, 0, 0.44, 0);
	k.cyl('solid', 0xfff4e2, 0.3, 0.29, 0.36, 9, 0, 0.82, 0);
	k.cyl('solid', BARK_DARK, 0.31, 0.31, 0.03, 9, 0, 0.44, 0);
	k.cyl('solid', BARK_DARK, 0.31, 0.31, 0.03, 9, 0, 0.82, 0);
	// A balcony round the middle floor.
	k.cyl('solid', WOOD, 0.42, 0.42, 0.03, 10, 0, 0.82, 0);
	for (let i = 0; i < 10; i++) {
		const a = (i / 10) * Math.PI * 2;
		k.box('solid', WOOD_DARK, 0.015, 0.09, 0.015, Math.cos(a) * 0.4, 0.85, Math.sin(a) * 0.4);
	}
	k.cyl('solid', roof, 0.01, 0.42, 0.62, 9, 0, 1.18, 0);
	k.cyl('solid', lighter(roof, 0.2), 0.42, 0.42, 0.03, 9, 0, 1.18, 0);
	k.box('solid', BARK_DARK, 0.012, 0.18, 0.012, 0, 1.78, 0);
	k.box('solid', pick([0xffc94d, 0xff8fab, 0x9fe0ff], rand()), 0.1, 0.06, 0.005, 0.05, 1.89, 0);
	// Windows on each floor, and the door.
	for (const [a, y] of [[-0.9, 0.26], [0.9, 0.26], [0.3, 0.6], [-1.2, 0.62], [0, 0.96], [2.0, 0.98]]) k.ball('glow', 0, 0.05, Math.sin(a) * 0.29, y, -Math.cos(a) * 0.29, { sy: 1.3 });
	k.box('solid', 0xe8c98a, 0.18, 0.28, 0.03, 0, 0, -0.325);
	k.box('solid', 0x6f4530, 0.13, 0.25, 0.04, 0, 0, -0.335);
	k.cyl('solid', 0x6f4530, 0.065, 0.065, 0.04, 8, 0, 0.25, -0.335, { rx: Math.PI / 2 });
	k.ball('solid', GOLD, 0.013, 0.04, 0.12, -0.36);
	k.box('solid', 0xc9cdb6, 0.22, 0.025, 0.1, 0, 0, -0.4);
	k.ball('solid', MOSS, 0.08, 0.3, 0.02, 0.2, { sy: 0.4 });
	if (ctx.homed) doorLamp(k, 0.18, 0.36, -0.33);
}

export function buildPiece(id: PieceId, ctx: Ctx): Model {
	const k = new Kit();
	const anims: Anim[] = [];
	const extra: THREE.Object3D[] = [];
	const phase = (ctx.seed % 100) / 10;

	switch (id) {
		case 'path':
			path(k, ctx);
			break;
		case 'cottage':
			cottage(k, ctx);
			break;
		case 'tree':
			tree(k, ctx);
			anims.push((o, t) => {
				o.rotation.z = Math.sin(t * 1.1 + phase) * 0.025;
				o.rotation.x = Math.cos(t * 0.8 + phase) * 0.02;
			});
			break;
		case 'flower':
			flower(k, ctx);
			break;
		case 'pond':
			pond(k, ctx);
			break;
		case 'lantern':
			lantern(k, ctx);
			break;
		case 'bridge':
			bridge(k, ctx);
			break;
		case 'crystal':
			crystal(k, ctx);
			break;
		case 'bench':
			bench(k, ctx);
			break;
		case 'waterfall':
			waterfall(k, ctx);
			break;
		case 'mushroom':
			mushroom(k, ctx);
			break;
		case 'market':
			market(k, ctx);
			break;
		case 'windmill': {
			windmill(k, ctx);
			const holder = new THREE.Group();
			holder.rotation.y = yawOf(ctx.r);
			const sails = windmillSails(ctx.seed);
			sails.position.set(0, 0.87, -0.19);
			holder.add(sails);
			extra.push(holder);
			anims.push((_o, _t, dt) => {
				sails.rotation.z += dt * 1.1;
			});
			break;
		}
		case 'dock': {
			dock(k, ctx);
			const holder = new THREE.Group();
			holder.rotation.y = yawOf(ctx.r);
			const boat = dockBoat(ctx.seed);
			boat.position.set(0.02, 0, -1.02);
			holder.add(boat);
			extra.push(holder);
			anims.push((_o, t) => {
				boat.position.y = -0.02 + Math.sin(t * 1.3 + phase) * 0.05;
				boat.rotation.z = Math.sin(t * 0.9 + phase) * 0.06;
			});
			break;
		}
		case 'elder':
			elder(k, ctx);
			break;
		case 'crossing':
			crossing(k, ctx);
			break;
		case 'shroomhouse':
			shroomhouse(k, ctx);
			break;
		case 'stonehut':
			stonehut(k, ctx);
			break;
		case 'nest':
			nest(k, ctx);
			break;
		case 'stonebench':
			stonebench(k, ctx);
			break;
		case 'picnic':
			picnic(k, ctx);
			break;
		case 'bakery':
			bakery(k, ctx);
			break;
		case 'teahouse':
			teahouse(k, ctx);
			break;
		case 'garden':
			garden(k, ctx);
			break;
		case 'workshop':
			workshop(k, ctx);
			break;
		case 'library':
			library(k, ctx);
			break;
		case 'timberhouse':
			timberhouse(k, ctx);
			break;
		case 'towerhouse':
			towerhouse(k, ctx);
			break;
		case 'well':
			well(k, ctx);
			break;
		case 'board':
			board(k, ctx);
			break;
		case 'towntree':
			towntree(k, ctx);
			anims.push((o, t) => {
				o.rotation.z = Math.sin(t * 0.7 + phase) * 0.012;
			});
			break;
		case 'swing': {
			swing(k, ctx);
			const holder = new THREE.Group();
			holder.rotation.y = yawOf(ctx.r);
			const seat = swingSeat();
			seat.position.y = 0.73;
			holder.add(seat);
			extra.push(holder);
			anims.push((_o, t) => {
				seat.rotation.x = Math.sin(t * 1.7 + phase) * 0.28;
			});
			break;
		}
		case 'tower': {
			tower(k);
			const star = towerStar();
			star.position.y = 1.92;
			extra.push(star);
			anims.push((_o, t) => {
				star.rotation.y = t * 1.2;
				star.position.y = 1.92 + Math.sin(t * 2) * 0.03;
			});
			break;
		}
	}

	const group = k.build();
	for (const o of extra) group.add(o);
	return { group, glows: k.glows, anims };
}

/** Frees the geometry of a model. The materials are shared and stay. */
export function disposeModel(obj: THREE.Object3D): void {
	obj.traverse((o) => {
		if (o instanceof THREE.Mesh) o.geometry.dispose();
	});
}
