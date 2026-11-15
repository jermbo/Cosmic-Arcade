/** Low-poly models of the pieces, made from code. Each model is a few merged meshes. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PieceId } from './content.ts';
import { DX, DZ, pick, rng } from './util.ts';

type Channel = 'solid' | 'glow' | 'lamp' | 'water' | 'crystal';

/** Shared materials. The sky changes `glow` at night. */
export const MAT = {
	solid: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
	glow: new THREE.MeshLambertMaterial({ color: 0x8a7f9a, emissive: 0xffcf7a, emissiveIntensity: 0, flatShading: true }),
	lamp: new THREE.MeshBasicMaterial({ vertexColors: true }),
	water: new THREE.MeshLambertMaterial({ color: 0x9adcf0, emissive: 0x2a6f8f, emissiveIntensity: 0.35, transparent: true, opacity: 0.86, flatShading: true }),
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

/** A roof shape: a triangle pushed along z. It stands on y = 0. */
function prism(w: number, h: number, d: number): THREE.BufferGeometry {
	const x = w / 2;
	const z = d / 2;
	// prettier-ignore
	const v = [
		-x, 0, z, x, 0, z, 0, h, z,
		x, 0, -z, -x, 0, -z, 0, h, -z,
		x, 0, z, x, 0, -z, 0, h, -z, x, 0, z, 0, h, -z, 0, h, z,
		-x, 0, -z, -x, 0, z, 0, h, z, -x, 0, -z, 0, h, z, 0, h, -z,
	];
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
	return g;
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

const WALLS = [0xfff4e2, 0xfde7ef, 0xe6f5ea, 0xece6fb, 0xfff0d2];
const ROOFS = [0xf2978a, 0x7fc8c2, 0xb79ce6, 0xf2c46b, 0xf29bb8, 0x8fb8ec];
const WOOD = 0xd9b38c;
const WOOD_DARK = 0xb98f6c;
const STONE = 0xc9c4d8;
const LEAVES = [0x8fd3a0, 0x79c49a, 0xa6dba0, 0x8fd3a0, 0x93d6b4, 0xf7b8cf, 0xf9c6dc, 0x86d1c4, 0xf5d58a];
const BLOOMS = [0xffb3cb, 0xfff1a8, 0xd9b8ff, 0xffffff, 0xffc9a3, 0xa8e0ff];

/** Does a path arm reach toward this side? */
function pathJoins(ctx: Ctx, d: number): boolean {
	const s = ctx.sides[d];
	if (s === 'path' || s === 'bridge') return true;
	// A cottage, a bench, a stall or a dock joins when it faces this cell.
	if (s === 'cottage' || s === 'market') return ctx.sideR[d] === (d + 2) % 4;
	if (s === 'dock') return true;
	return false;
}

function path(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const arms = [0, 1, 2, 3].filter((d) => pathJoins(ctx, d));
	const shade = (): number => pick([0xefe4cc, 0xe8dcc0, 0xf3ead6], rand());
	if (!arms.length) {
		k.cyl('solid', shade(), 0.2, 0.22, 0.045, 7, 0, 0, 0);
		k.cyl('solid', shade(), 0.09, 0.1, 0.04, 6, 0.3, 0, 0.22);
		k.cyl('solid', shade(), 0.08, 0.09, 0.04, 6, -0.28, 0, -0.26);
		return;
	}
	k.box('solid', shade(), 0.38, 0.045, 0.38, 0, 0, 0);
	for (const d of arms) {
		const along = DZ[d] !== 0;
		for (let i = 0; i < 2; i++) {
			const off = 0.275 + i * 0.16;
			k.box('solid', shade(), along ? 0.36 : 0.15, 0.04, along ? 0.15 : 0.36, DX[d] * off, 0, DZ[d] * off);
		}
	}
}

function cottage(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.clusterSeed);
	const wall = pick(WALLS, rand());
	const roof = pick(ROOFS, rand());
	// Joined cottages: a wall and a roof run to each cottage next door.
	for (let d = 0; d < 4; d++) {
		if (ctx.sides[d] !== 'cottage') continue;
		const along = DZ[d] !== 0;
		k.box('solid', wall, along ? 0.5 : 0.52, 0.38, along ? 0.52 : 0.5, DX[d] * 0.25, 0, DZ[d] * 0.25);
		k.add('solid', prism(0.62, 0.28, 0.52), roof, DX[d] * 0.25, 0.38, DZ[d] * 0.25, { ry: along ? 0 : Math.PI / 2 });
	}
	k.yaw(yawOf(ctx.r));
	k.box('solid', wall, 0.64, 0.4, 0.56, 0, 0, 0);
	k.add('solid', prism(0.72, 0.36, 0.76), roof, 0, 0.4, 0, { ry: Math.PI / 2 });
	k.box('solid', 0xa87c5f, 0.14, 0.22, 0.03, 0, 0, -0.285);
	k.box('solid', 0xe8d9b8, 0.2, 0.03, 0.08, 0, 0, -0.33);
	k.box('glow', 0, 0.11, 0.11, 0.02, -0.2, 0.17, -0.285);
	k.box('glow', 0, 0.11, 0.11, 0.02, 0.2, 0.17, -0.285);
	k.box('glow', 0, 0.02, 0.11, 0.12, 0.325, 0.17, 0.05);
	k.box('glow', 0, 0.02, 0.11, 0.12, -0.325, 0.17, 0.05);
	k.box('solid', 0xd7b9a5, 0.09, 0.26, 0.09, 0.2, 0.46, 0.12);
	if (ctx.homed) k.glow(0, 0.2, -0.36, 0xffd58a, 0.7);
}

function tree(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const leaf = pick(LEAVES, rand());
	const leaf2 = pick(LEAVES.slice(0, 5), rand());
	const stage = ctx.growth >= 1 ? 2 : ctx.growth >= 0.45 ? 1 : 0;
	if (stage === 0) {
		k.ball('solid', 0xb08968, 0.1, 0, 0.01, 0, { sy: 0.4 });
		k.cyl('solid', 0x9a7455, 0.012, 0.018, 0.16, 5, 0, 0, 0);
		k.ball('solid', 0xa6dba0, 0.055, 0.045, 0.17, 0, { sy: 0.5, rz: 0.5 });
		k.ball('solid', 0x8fd3a0, 0.05, -0.04, 0.14, 0.01, { sy: 0.5, rz: -0.5 });
		return;
	}
	if (stage === 1) {
		k.cyl('solid', 0x9a7455, 0.035, 0.05, 0.26, 6, 0, 0, 0);
		k.ball('solid', leaf, 0.21, 0, 0.4, 0, { ry: rand() * 3 });
		k.ball('solid', leaf2, 0.13, 0.1, 0.54, 0.04, { ry: rand() * 3 });
		return;
	}
	k.cyl('solid', 0x9a7455, 0.055, 0.085, 0.42, 6, 0, 0, 0);
	k.ball('solid', leaf, 0.31, 0, 0.6, 0, { ry: rand() * 3, sy: 0.9 });
	k.ball('solid', leaf2 === leaf ? 0x9fdcae : leaf, 0.24, 0.13, 0.84, 0.05, { ry: rand() * 3 });
	k.ball('solid', leaf, 0.19, -0.11, 0.97, -0.06, { ry: rand() * 3 });
	if (ctx.combos.includes('firefly')) {
		for (let i = 0; i < 5; i++) k.ball('lamp', 0xfff6a8, 0.022, (rand() - 0.5) * 0.6, 0.5 + rand() * 0.5, (rand() - 0.5) * 0.6);
		k.glow(0, 0.75, 0, 0xfff3a0, 1.3);
	}
}

function flower(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	k.cyl('solid', 0xb89272, 0.4, 0.43, 0.05, 8, 0, 0, 0);
	for (let i = 0; i < 9; i++) {
		const a = (i / 9) * Math.PI * 2 + rand();
		const rad = i === 0 ? 0 : 0.14 + rand() * 0.18;
		const x = Math.cos(a) * rad;
		const z = Math.sin(a) * rad;
		const h = 0.1 + rand() * 0.1;
		k.box('solid', 0x8fcf8f, 0.016, h, 0.016, x, 0.04, z);
		k.ball('solid', pick(BLOOMS, rand()), 0.05, x, 0.06 + h, z, { sy: 0.7, ry: rand() * 3 });
		k.ball('solid', 0xffe08a, 0.02, x, 0.09 + h, z);
	}
}

function pond(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const joined = ctx.sides.map((s) => s === 'pond' || s === 'waterfall');
	const lo = (j: boolean): number => (j ? -0.5 : -0.41);
	const hi = (j: boolean): number => (j ? 0.5 : 0.41);
	const x0 = lo(joined[3]);
	const x1 = hi(joined[1]);
	const z0 = lo(joined[0]);
	const z1 = hi(joined[2]);
	const spring = ctx.combos.includes('spring');
	k.box(spring ? 'lamp' : 'water', spring ? 0xa9f5ee : 0, x1 - x0, 0.04, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2);
	if (spring) k.glow(0, 0.1, 0, 0x9ff3ee, 1.6);
	// Stones on each side that is not joined to water.
	for (let d = 0; d < 4; d++) {
		if (joined[d]) continue;
		for (let i = -2; i <= 2; i++) {
			const t = i * 0.2 + (rand() - 0.5) * 0.05;
			const x = DX[d] * 0.44 + (DX[d] === 0 ? t : 0);
			const z = DZ[d] * 0.44 + (DZ[d] === 0 ? t : 0);
			k.ball('solid', pick([0xd9d4e4, 0xcfc8dc, 0xe6e1ee], rand()), 0.075 + rand() * 0.03, x, 0.03, z, { sy: 0.6, ry: rand() * 3 });
		}
	}
	const lx = (rand() - 0.5) * 0.4;
	const lz = (rand() - 0.5) * 0.4;
	k.cyl('solid', 0x8fd3a0, 0.09, 0.09, 0.012, 7, lx, 0.04, lz);
	k.ball('solid', 0xffc1d9, 0.035, lx + 0.02, 0.07, lz, { sy: 0.7 });
}

function lantern(k: Kit): void {
	k.cyl('solid', STONE, 0.07, 0.09, 0.05, 6, 0, 0, 0);
	k.box('solid', 0x7a6a86, 0.04, 0.56, 0.04, 0, 0.04, 0);
	k.box('solid', 0x7a6a86, 0.2, 0.03, 0.03, 0.08, 0.57, 0);
	k.box('solid', 0x7a6a86, 0.012, 0.07, 0.012, 0.16, 0.5, 0);
	k.cyl('solid', 0x7a6a86, 0.02, 0.085, 0.05, 4, 0.16, 0.46, 0, { ry: Math.PI / 4 });
	k.box('lamp', 0xffe7a3, 0.1, 0.12, 0.1, 0.16, 0.34, 0);
	k.box('solid', 0x7a6a86, 0.11, 0.015, 0.11, 0.16, 0.325, 0);
	k.glow(0.16, 0.4, 0, 0xffd27a, 1.5);
}

function bridge(k: Kit, ctx: Ctx): void {
	const joined = ctx.sides.map((s) => s !== null);
	k.box('solid', WOOD_DARK, 0.5, 0.08, 0.5, 0, -0.12, 0);
	for (let i = -1; i <= 1; i++) k.box('solid', i === 0 ? 0xe3c19c : WOOD, 0.62, 0.06, 0.2, 0, -0.03, i * 0.207);
	for (let d = 0; d < 4; d++) {
		const along = DZ[d] !== 0;
		const px = DZ[d] === 0 ? 0 : 0.31;
		const pz = DX[d] === 0 ? 0 : 0.31;
		if (joined[d]) {
			k.box('solid', WOOD, along ? 0.62 : 0.2, 0.06, along ? 0.2 : 0.62, DX[d] * 0.405, -0.03, DZ[d] * 0.405);
			for (const side of [-1, 1]) {
				k.box('solid', 0xfff4e2, along ? 0.025 : 0.2, 0.025, along ? 0.2 : 0.025, DX[d] * 0.405 + side * px, 0.17, DZ[d] * 0.405 + side * pz);
			}
		} else {
			k.box('solid', 0xfff4e2, along ? 0.62 : 0.025, 0.025, along ? 0.025 : 0.62, DX[d] * 0.31, 0.17, DZ[d] * 0.31);
		}
	}
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
		k.box('solid', WOOD_DARK, 0.05, 0.24, 0.05, sx * 0.31, -0.03, sz * 0.31);
		k.ball('solid', 0xf7b8cf, 0.035, sx * 0.31, 0.23, sz * 0.31);
	}
}

function crystal(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	const tones = pick([[0xc7a8ff, 0xe0ccff], [0x9fe0ff, 0xc9f0ff], [0xffb3e6, 0xffd6f1]], rand());
	k.ball('solid', STONE, 0.14, 0.05, 0.03, 0.03, { sy: 0.5 });
	k.ball('solid', 0xb9b4c9, 0.1, -0.15, 0.03, -0.08, { sy: 0.5 });
	k.gem('crystal', tones[0], 0.17, 0, 0.3, 0, { sy: 1.9, rz: 0.08 });
	k.gem('crystal', tones[1], 0.11, 0.17, 0.18, 0.06, { sy: 1.7, rz: -0.4 });
	k.gem('crystal', tones[1], 0.09, -0.14, 0.16, -0.05, { sy: 1.7, rz: 0.45 });
	k.gem('crystal', tones[0], 0.07, 0.02, 0.12, 0.17, { sy: 1.6, rx: 0.5 });
	k.glow(0, 0.35, 0, tones[0], 1.2);
}

function bench(k: Kit, ctx: Ctx): void {
	k.yaw(yawOf(ctx.r));
	k.box('solid', WOOD, 0.54, 0.04, 0.2, 0, 0.15, 0.04);
	k.box('solid', WOOD, 0.54, 0.16, 0.035, 0, 0.23, 0.15);
	for (const sx of [-1, 1]) {
		k.box('solid', WOOD_DARK, 0.04, 0.15, 0.04, sx * 0.22, 0, -0.03);
		k.box('solid', WOOD_DARK, 0.04, 0.4, 0.04, sx * 0.22, 0, 0.15);
	}
	k.box('solid', 0xf7b8cf, 0.2, 0.03, 0.17, -0.12, 0.19, 0.04);
	if (ctx.combos.includes('nook')) {
		k.box('solid', 0xc9a8ff, 0.12, 0.025, 0.09, 0.14, 0.19, 0.03, { ry: 0.3 });
		k.glow(0, 0.3, 0, 0xffd58a, 1.4);
	}
}

function waterfall(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	k.ball('solid', 0xbdb8cf, 0.3, 0, 0.2, 0, { sy: 0.9, ry: rand() * 3 });
	k.ball('solid', 0xaaa5c0, 0.19, 0.22, 0.12, 0.16, { ry: rand() * 3 });
	k.ball('solid', 0xcbc6da, 0.15, -0.22, 0.1, -0.14, { ry: rand() * 3 });
	k.ball('solid', 0x9fd9a8, 0.08, -0.1, 0.42, 0.1, { sy: 0.5 });
	k.ball('water', 0, 0.11, 0.02, 0.44, -0.02, { sy: 0.45 });
	for (let d = 0; d < 4; d++) {
		const toPond = ctx.sides[d] === 'pond';
		const spill = ctx.spills.includes(d);
		if (!toPond && !spill) continue;
		const along = DZ[d] !== 0;
		// A stream down the rock, then a channel to the edge of the cell.
		k.box('water', 0, along ? 0.2 : 0.05, 0.42, along ? 0.05 : 0.2, DX[d] * 0.27, 0.02, DZ[d] * 0.27, along ? { rx: -DZ[d] * 0.35 } : { rz: DX[d] * 0.35 });
		k.box('water', 0, along ? 0.22 : 0.3, 0.04, along ? 0.3 : 0.22, DX[d] * 0.36, 0, DZ[d] * 0.36);
		if (spill) k.box('water', 0, along ? 0.22 : 0.06, 3.2, along ? 0.06 : 0.22, DX[d] * 0.52, -3.17, DZ[d] * 0.52);
	}
	if (ctx.combos.includes('rainbow')) {
		const bands = [0xff9aa2, 0xffcf8a, 0xfff1a8, 0x9be7a5, 0x9fd0ff, 0xc9a8ff];
		bands.forEach((c, i) => k.add('lamp', new THREE.TorusGeometry(0.44 - i * 0.022, 0.011, 3, 14, Math.PI), c, 0, 0.3, 0, { ry: Math.PI / 4 }));
	}
}

function windmill(k: Kit, ctx: Ctx): void {
	k.yaw(yawOf(ctx.r));
	k.cyl('solid', 0xfff4e2, 0.17, 0.27, 0.8, 6, 0, 0, 0);
	k.cyl('solid', 0xf7d9c4, 0.2, 0.2, 0.05, 6, 0, 0.78, 0);
	k.cyl('solid', 0xf2978a, 0.02, 0.24, 0.3, 6, 0, 0.83, 0);
	k.box('solid', 0xa87c5f, 0.13, 0.2, 0.04, 0, 0, -0.255);
	k.box('glow', 0, 0.09, 0.09, 0.03, 0, 0.42, -0.215);
	k.box('solid', WOOD_DARK, 0.04, 0.04, 0.14, 0, 0.72, -0.24);
}

/** The sails of the windmill. They are a part of their own, so that they can turn. */
function windmillSails(): THREE.Group {
	const k = new Kit();
	k.ball('solid', WOOD_DARK, 0.05, 0, 0, 0);
	for (let i = 0; i < 4; i++) {
		const a = (i * Math.PI) / 2;
		k.box('solid', WOOD, 0.025, 0.42, 0.02, -Math.sin(a) * 0.21, Math.cos(a) * 0.21 - 0.21, 0, { rz: a });
		k.box('solid', 0xfffaf0, 0.11, 0.3, 0.012, -Math.sin(a) * 0.26 + Math.cos(a) * 0.055, Math.cos(a) * 0.26 + Math.sin(a) * 0.055 - 0.15, 0, { rz: a });
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
		k.cyl('solid', pick([0xf28fa0, 0xc9a8f0, 0xffc48a, 0xf7a8c4], rand()), 0.02, r, r * 0.8, 6, x, h - 0.01, z);
		if (fairy) k.ball('lamp', 0xe9d6ff, 0.016, x, h + r * 0.85, z);
	}
	k.ball('solid', 0x9fd9a8, 0.06, 0.03, 0.01, -0.02, { sy: 0.4 });
	if (fairy) k.glow(0, 0.15, 0, 0xd4b3ff, 1.6);
}

function dock(k: Kit, ctx: Ctx): void {
	k.yaw(yawOf(ctx.r));
	for (let i = 0; i < 5; i++) k.box('solid', i % 2 ? WOOD : 0xe3c19c, 0.46, 0.05, 0.15, 0, 0, 0.12 - i * 0.165);
	for (const sx of [-1, 1]) {
		k.box('solid', WOOD_DARK, 0.05, 0.5, 0.05, sx * 0.2, -0.4, -0.58);
		k.box('solid', WOOD_DARK, 0.05, 0.22, 0.05, sx * 0.2, -0.17, -0.1);
	}
	k.box('solid', 0xfff4e2, 0.05, 0.36, 0.05, -0.2, 0.05, -0.58);
	k.box('solid', 0xf2978a, 0.055, 0.07, 0.055, -0.2, 0.2, -0.58);
	k.ball('lamp', 0xffe7a3, 0.05, -0.2, 0.46, -0.58);
	k.glow(-0.2, 0.46, -0.58, 0xffd27a, 1);
	k.box('solid', WOOD, 0.14, 0.1, 0.12, 0.13, 0.05, 0.02);
}

/** The balloon boat at the sky dock. */
function dockBoat(seed: number): THREE.Group {
	const rand = rng(seed);
	const k = new Kit();
	const tone = pick([0xf9a8c4, 0xa8d8f9, 0xf9dc8a, 0xb9e8b0], rand());
	k.ball('solid', 0xf7d2b0, 0.2, 0, 0, 0, { sy: 0.45, sz: 1.5 });
	k.box('solid', WOOD_DARK, 0.3, 0.03, 0.42, 0, 0.05, 0);
	k.box('solid', WOOD_DARK, 0.012, 0.3, 0.012, 0.1, 0.06, 0.12);
	k.box('solid', WOOD_DARK, 0.012, 0.3, 0.012, -0.1, 0.06, -0.12);
	k.ball('solid', tone, 0.24, 0, 0.56, 0, { sy: 0.9 });
	k.ball('solid', 0xfff4e2, 0.13, 0, 0.36, 0, { sy: 0.5 });
	return k.build();
}

function market(k: Kit, ctx: Ctx): void {
	const rand = rng(ctx.seed);
	k.yaw(yawOf(ctx.r));
	k.box('solid', 0xfff4e2, 0.64, 0.2, 0.3, 0, 0, 0.04);
	k.box('solid', WOOD, 0.68, 0.03, 0.34, 0, 0.2, 0.04);
	for (const sx of [-1, 1]) for (const sz of [-0.15, 0.23]) k.box('solid', WOOD_DARK, 0.035, 0.58, 0.035, sx * 0.32, 0, sz);
	const stripe = pick([0xf7a8b8, 0x9fd0ff, 0xb9e8b0, 0xf9dc8a], rand());
	for (let i = 0; i < 6; i++) k.box('solid', i % 2 ? 0xfffaf0 : stripe, 0.125, 0.03, 0.56, -0.3125 + i * 0.125, 0.58, 0.02, { rx: 0.22 });
	for (let i = 0; i < 4; i++) k.ball('solid', pick([0xff9aa2, 0xffcf8a, 0xc9a8ff, 0x9be7a5], rand()), 0.05, -0.22 + i * 0.14, 0.27, 0.02 + (rand() - 0.5) * 0.1);
	k.box('solid', WOOD_DARK, 0.16, 0.12, 0.14, 0.2, 0, -0.27);
	k.ball('solid', 0xffcf8a, 0.045, 0.2, 0.15, -0.27);
}

function tower(k: Kit): void {
	k.cyl('solid', 0xe9e4f4, 0.2, 0.27, 0.5, 8, 0, 0, 0);
	k.cyl('solid', 0xf4f0fb, 0.15, 0.2, 0.5, 8, 0, 0.5, 0);
	k.cyl('solid', 0xd9cff0, 0.25, 0.22, 0.05, 8, 0, 1.0, 0);
	k.cyl('solid', 0xf4f0fb, 0.13, 0.15, 0.3, 8, 0, 1.05, 0);
	k.cyl('solid', 0xb9a0e8, 0.015, 0.21, 0.42, 8, 0, 1.33, 0);
	k.box('solid', 0xa87c5f, 0.12, 0.2, 0.04, 0, 0, -0.25);
	for (let i = 0; i < 3; i++) {
		const a = (i / 3) * Math.PI * 2;
		k.box('glow', 0, 0.07, 0.11, 0.03, Math.sin(a) * 0.165, 0.68, -Math.cos(a) * 0.165, { ry: -a });
		k.box('glow', 0, 0.06, 0.09, 0.03, Math.sin(a + 1) * 0.13, 1.14, -Math.cos(a + 1) * 0.13, { ry: -a - 1 });
	}
	k.glow(0, 1.9, 0, 0xfff0a0, 1.6);
}

function towerStar(): THREE.Group {
	return new Kit().gem('lamp', 0xfff3a8, 0.085, 0, 0, 0, { sy: 1.3 }).build(false);
}

/** Builds the model of one piece. */
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
			lantern(k);
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
			const sails = windmillSails();
			sails.position.set(0, 0.74, -0.33);
			holder.add(sails);
			extra.push(holder);
			anims.push((_o, _t, dt) => {
				sails.rotation.z += dt * 0.9;
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
		case 'tower': {
			tower(k);
			const star = towerStar();
			star.position.y = 1.88;
			extra.push(star);
			anims.push((_o, t) => {
				star.rotation.y = t * 1.2;
				star.position.y = 1.88 + Math.sin(t * 2) * 0.03;
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
