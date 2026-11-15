/** The creatures of the sky: five flyers by day, and the shy ones that come out at night. */

import * as THREE from 'three';
import { ISLANDS } from './content.ts';
import { burst, fxBudget, softTexture, spark } from './fx.ts';
import { Kit } from './models.ts';
import { env, wishSources } from './sky.ts';
import { edgeRadius, pieceAt, S } from './state.ts';
import { clamp, DX, DZ, hash2, key, pick, rng, smooth, turnToward, unkey } from './util.ts';
import { allFalls, groundY, islandGroup, world } from './view.ts';
import type { Fall } from './view.ts';

/** Things that the shell wants to hear about. */
export const creatureEvents = {
	/** The player tapped a jelly that had a gift. `x` and `z` are the cell below it. */
	gift: (_x: number, _z: number) => {},
	whaleSong: () => {},
	sneeze: () => {},
	/** The player tapped a creature that has no gift now. */
	poke: (_what: 'jelly' | 'dragon' | 'whale') => {},
};

const layer = new THREE.Group();
const glowTex = softTexture('rgba(255,255,255,0.9)');
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** 1 by day, 0 at night, and the other way round. Both change softly at dusk and dawn. */
let dayF = 1;
let nightF = 0;

const softGlow = (color: number, size: number): THREE.Sprite => {
	const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
	s.scale.setScalar(size);
	return s;
};

/** Gives every mesh of a model one material, for creatures that glow or are see-through. */
function paint(obj: THREE.Object3D, mat: THREE.Material): void {
	obj.traverse((o) => {
		if (o instanceof THREE.Mesh) {
			o.material = mat;
			o.castShadow = false;
		}
	});
}

/** Turns a model to look along a direction. Models face -z. */
const yawTo = (dx: number, dz: number): number => Math.atan2(-dx, -dz);

/* 1. The sky whale: huge and slow, with a garden on its back. */

interface Whale {
	obj: THREE.Group;
	tail: THREE.Object3D;
	fins: THREE.Object3D[];
	a: number;
	song: number;
	spout: number;
}
let whale: Whale | null = null;
let goldWhale = false;

function makeWhale(gold: boolean): Whale {
	const skin = gold ? 0xe8b84a : 0x5a78c8;
	const belly = gold ? 0xfff0c0 : 0xe4ecff;
	const dark = gold ? 0xb8862a : 0x40589a;
	const k = new Kit();
	k.add('solid', new THREE.IcosahedronGeometry(1, 1), skin, 0, 0, 0, { sx: 1.25, sy: 1, sz: 3 });
	k.add('solid', new THREE.IcosahedronGeometry(1, 1), belly, 0, -0.3, -0.2, { sx: 1.16, sy: 0.82, sz: 2.75 });
	for (let i = 0; i < 5; i++) k.box('solid', dark, 0.03, 0.03, 1.5, (i - 2) * 0.28, -1.1 + Math.abs(i - 2) * 0.07, -1.5);
	for (const sx of [-1, 1]) {
		k.ball('solid', 0x2a2440, 0.1, sx * 1.0, 0.05, -1.75);
		k.ball('solid', 0xffffff, 0.035, sx * 1.06, 0.1, -1.8);
		k.ball('solid', 0xffa8c0, 0.14, sx * 0.98, -0.2, -1.6, { sx: 0.4 });
	}
	// The garden: grass, trees, a tiny home and flowers.
	k.add('solid', new THREE.IcosahedronGeometry(1, 1), 0x4fae78, 0, 0.74, 0.2, { sx: 0.9, sy: 0.32, sz: 1.8 });
	const rand = rng(8);
	for (const [x, z, h] of [[0.3, 1.1, 0.5], [-0.4, 0.5, 0.65], [0.45, -0.3, 0.45], [-0.25, -0.9, 0.4]]) {
		k.cyl('solid', 0x8a6248, 0.04, 0.06, h, 5, x, 0.95, z);
		k.ball('solid', pick([0x3f9a6a, 0x6fc487, 0xe8a8c8, 0xf2c46b], rand()), 0.26, x, 1.05 + h, z);
		k.ball('solid', 0x58b58a, 0.17, x + 0.12, 1.2 + h, z + 0.05);
	}
	k.cyl('solid', 0x8a6248, 0.13, 0.17, 0.34, 6, 0, 1.0, 0.2);
	k.ball('solid', 0x2f8f6a, 0.3, 0, 1.5, 0.2, { sy: 0.8 });
	k.ball('lamp', 0xffe7a3, 0.045, 0, 1.15, 0.04);
	for (let i = 0; i < 9; i++) k.ball('solid', pick([0xffa3c4, 0xfff1a8, 0xc9a8ff, 0xffffff], rand()), 0.06, (rand() - 0.5) * 1.2, 1.04, (rand() - 0.5) * 2.6);
	for (const [x, z] of [[0.95, 0.9], [-1.0, 0.2], [0.9, -0.6]]) k.gem('crystal', pick([0xc7a8ff, 0x9fe0ff], rand()), 0.16, x, 0.45, z, { sy: 1.8, rz: -x * 0.7 });
	k.ball('solid', dark, 0.12, 0, 0.98, -1.35, { sy: 0.3 });
	const obj = k.build();

	const tk = new Kit();
	tk.add('solid', new THREE.CylinderGeometry(0.14, 0.62, 1.7, 7), skin, 0, 0, 0.8, { rx: Math.PI / 2 });
	for (const sx of [-1, 1]) tk.ball('solid', dark, 1, sx * 0.62, 0, 1.75, { sx: 0.7, sy: 0.08, sz: 0.42, ry: sx * -0.5 });
	const tail = tk.build();
	tail.position.set(0, 0.05, 2.5);
	obj.add(tail);

	const fins: THREE.Object3D[] = [];
	for (const sx of [-1, 1]) {
		const fk = new Kit();
		fk.ball('solid', dark, 1, sx * 0.75, 0, 0.1, { sx: 0.85, sy: 0.07, sz: 0.38, ry: sx * 0.4 });
		const fin = fk.build();
		fin.position.set(sx * 1.0, -0.45, -0.7);
		fin.userData.side = sx;
		obj.add(fin);
		fins.push(fin);
	}
	obj.scale.setScalar(2);
	layer.add(obj);
	return { obj, tail, fins, a: whale?.a ?? 2.4, song: 8, spout: 4 };
}

/** The whale turns gold as a late reward. */
export function setGoldWhale(on: boolean): void {
	if (on === goldWhale && whale) return;
	goldWhale = on;
	if (whale) {
		layer.remove(whale.obj);
		whale = makeWhale(on);
	}
}

const whaleAt = (a: number, out: THREE.Vector3): THREE.Vector3 => {
	const r = 25 + 9 * Math.sin(a * 2 + 1);
	return out.set(Math.cos(a) * r, 9.5 + Math.sin(a * 1.3) * 2, Math.sin(a) * r);
};

function updateWhale(dt: number, t: number, target: THREE.Vector3): void {
	const w = whale!;
	w.obj.visible = dayF > 0.01;
	if (!w.obj.visible) return;
	w.a += dt * 0.032;
	whaleAt(w.a, _v);
	whaleAt(w.a + 0.02, _w);
	w.obj.position.copy(_v);
	w.obj.position.y += (1 - dayF) * 40;
	w.obj.rotation.y = yawTo(_w.x - _v.x, _w.z - _v.z);
	w.obj.rotation.x = Math.sin(t * 0.45) * 0.05;
	w.obj.rotation.z = Math.sin(t * 0.3) * 0.04;
	w.tail.rotation.x = Math.sin(t * 0.9) * 0.28;
	for (const f of w.fins) f.rotation.z = f.userData.side * (0.2 + Math.sin(t * 0.9 + 1) * 0.22);

	// It sings when it comes near the place the player looks at.
	w.song -= dt;
	if (w.song <= 0 && dayF > 0.9 && Math.hypot(_v.x - target.x, _v.z - target.z) < 22) {
		w.song = 50 + Math.random() * 40;
		creatureEvents.whaleSong();
		singSparks(w);
	}
	w.spout -= dt;
	if (w.spout <= 0) {
		w.spout = 7 + Math.random() * 6;
		for (let i = 0; i < 14 * fxBudget.amount; i++) spark({ x: _v.x, y: w.obj.position.y + 2.2, z: _v.z, vx: (Math.random() - 0.5) * 1.2, vy: 2.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 1.2, gravity: 3, life: 1.6, size: 0.16, color: 0xeaf8ff, alpha: 0.85 });
	}
}

function singSparks(w: Whale): void {
	const p = w.obj.position;
	for (let i = 0; i < 26; i++) {
		const a = Math.random() * Math.PI * 2;
		spark({ x: p.x + Math.cos(a) * 3, y: p.y + (Math.random() - 0.3) * 3, z: p.z + Math.sin(a) * 3, vx: Math.cos(a) * 1.4, vy: 0.5, vz: Math.sin(a) * 1.4, life: 2.5 + Math.random(), size: 0.22, color: pick([0xbfe0ff, 0xffffff, 0xd6c2ff], Math.random()), sway: 0.4, drag: 0.5 });
	}
}

/* 2. Lantern jellies: they drift in a group, pulse with light and carry small gifts. */

interface Jelly {
	obj: THREE.Group;
	bell: THREE.Object3D;
	arms: THREE.Object3D;
	glow: THREE.Sprite;
	mat: THREE.MeshLambertMaterial;
	color: number;
	ox: number;
	oy: number;
	oz: number;
	phase: number;
	/** Time until it has a gift again. */
	rest: number;
	flash: number;
}
const jellies: Jelly[] = [];
const jellyHome = new THREE.Vector3(0, 0, 0);

function makeJelly(i: number): Jelly {
	const rand = rng(i + 40);
	const color = [0xff9ac8, 0x8fe8ff, 0xc9a8ff, 0xffd98a, 0x9fffd6, 0xffb3a0][i % 6];
	const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.86, flatShading: true, side: THREE.DoubleSide, depthWrite: false });
	const light = _c.set(color).lerp(new THREE.Color(0xffffff), 0.55).getHex();
	const bk = new Kit();
	bk.add('lamp', new THREE.SphereGeometry(0.42, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.56), color, 0, 0, 0);
	bk.add('lamp', new THREE.SphereGeometry(0.27, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.6), light, 0, 0.02, 0);
	for (let j = 0; j < 8; j++) bk.ball('lamp', light, 0.05, Math.cos((j / 8) * 6.28) * 0.39, -0.06, Math.sin((j / 8) * 6.28) * 0.39);
	const bell = bk.build(false);
	const ak = new Kit();
	for (let j = 0; j < 6; j++) {
		const a = (j / 6) * Math.PI * 2;
		const len = 0.5 + rand() * 0.6;
		ak.box('lamp', j % 2 ? light : color, 0.035, len, 0.035, Math.cos(a) * 0.2, -len - 0.02, Math.sin(a) * 0.2);
		ak.ball('lamp', light, 0.04, Math.cos(a) * 0.2, -len - 0.04, Math.sin(a) * 0.2);
	}
	for (let j = 0; j < 3; j++) ak.box('lamp', light, 0.07, 0.32, 0.07, Math.cos(j * 2.1) * 0.07, -0.34, Math.sin(j * 2.1) * 0.07);
	const arms = ak.build(false);
	const obj = new THREE.Group();
	obj.add(bell, arms);
	paint(obj, mat);
	const glow = softGlow(color, 2.6);
	obj.add(glow);
	const a = (i / 6) * Math.PI * 2 + rand();
	const r = 1.6 + rand() * 2.4;
	obj.scale.setScalar(0.7);
	layer.add(obj);
	return { obj, bell, arms, glow, mat, color, ox: Math.cos(a) * r, oy: rand() * 1.8, oz: Math.sin(a) * r, phase: rand() * 6.28, rest: i < 2 ? 0 : 10 + rand() * 30, flash: 0 };
}

function updateJellies(dt: number, t: number, target: THREE.Vector3): void {
	// The group drifts to where the player looks, so a gift is never far away.
	_v.set(target.x + Math.cos(t * 0.05) * 4, 0, target.z + Math.sin(t * 0.05) * 4);
	jellyHome.lerp(_v, Math.min(1, dt * 0.18));
	for (const j of jellies) {
		const beat = Math.sin(t * 1.7 + j.phase);
		const x = jellyHome.x + j.ox + Math.sin(t * 0.13 + j.phase) * 1.1;
		const z = jellyHome.z + j.oz + Math.cos(t * 0.11 + j.phase) * 1.1;
		j.obj.position.set(x, 3.1 + j.oy + Math.sin(t * 0.5 + j.phase) * 0.35 + beat * 0.06, z);
		j.obj.rotation.y = t * 0.2 + j.phase;
		j.obj.rotation.z = Math.sin(t * 0.4 + j.phase) * 0.12;
		j.bell.scale.set(1 + beat * 0.09, 1 - beat * 0.14, 1 + beat * 0.09);
		j.arms.scale.set(1 - beat * 0.1, 1 + beat * 0.12, 1 - beat * 0.1);
		j.rest -= dt;
		j.flash = Math.max(0, j.flash - dt * 1.5);
		const ready = j.rest <= 0;
		const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + j.phase);
		j.mat.emissiveIntensity = (ready ? 0.45 + pulse * 0.35 : 0.15) + nightF * 0.5 + j.flash * 2;
		j.mat.opacity = ready ? 0.88 : 0.5;
		j.glow.material.opacity = (ready ? 0.2 + pulse * 0.18 : 0.05) + nightF * 0.2 + j.flash;
		j.glow.scale.setScalar(2.4 + pulse * 0.5 + j.flash * 3);
		// A jelly with a gift twinkles.
		if (ready && Math.random() < dt * 3 * fxBudget.amount) {
			spark({ x: x + (Math.random() - 0.5) * 0.9, y: j.obj.position.y + Math.random() * 0.6, z: z + (Math.random() - 0.5) * 0.9, vy: 0.3, life: 1.1, size: 0.11, color: 0xfff6d0, sway: 0.2 });
		}
	}
}

/* 3. Cloud rays: they glide in formation and leave a trail of sparkles. */

interface Ray {
	obj: THREE.Group;
	wings: THREE.Object3D[];
	lag: number;
	side: number;
	phase: number;
}
const rays: Ray[] = [];
let rayA = 0.5;

function makeRay(i: number): Ray {
	const k = new Kit();
	k.add('solid', new THREE.OctahedronGeometry(1, 0), 0xf4f8ff, 0, 0, 0, { sx: 0.42, sy: 0.13, sz: 0.85 });
	k.add('solid', new THREE.OctahedronGeometry(1, 0), 0xa8ccf4, 0, -0.04, 0.05, { sx: 0.36, sy: 0.1, sz: 0.7 });
	k.box('solid', 0xa8ccf4, 0.035, 0.03, 1.3, 0, 0, 1.3);
	k.ball('lamp', 0xfff1a8, 0.05, 0, 0, 1.95);
	for (const sx of [-1, 1]) {
		k.box('solid', 0xf4f8ff, 0.07, 0.04, 0.24, sx * 0.16, -0.02, -0.82, { ry: sx * 0.3 });
		k.ball('solid', 0x2a2440, 0.035, sx * 0.2, 0.06, -0.5);
	}
	const obj = k.build();
	const wings: THREE.Object3D[] = [];
	for (const sx of [-1, 1]) {
		const wk = new Kit();
		wk.ball('solid', 0xe2eefc, 1, sx * 0.62, 0, 0.05, { sx: 0.72, sy: 0.05, sz: 0.55, ry: sx * 0.35 });
		wk.ball('solid', 0xa8ccf4, 1, sx * 1.15, 0, 0.2, { sx: 0.3, sy: 0.04, sz: 0.25, ry: sx * 0.6 });
		const wing = wk.build();
		wing.position.x = sx * 0.2;
		wing.userData.side = sx;
		obj.add(wing);
		wings.push(wing);
	}
	obj.scale.setScalar(1.25);
	layer.add(obj);
	return { obj, wings, lag: Math.ceil(i / 2) * 0.085, side: i === 0 ? 0 : i % 2 ? 1 : -1, phase: i * 1.3 };
}

const rayAt = (a: number, out: THREE.Vector3): THREE.Vector3 => {
	const r = 19 + 7 * Math.sin(a * 3);
	return out.set(Math.cos(a) * r - 2, 7.5 + Math.sin(a * 2) * 2.5, Math.sin(a) * r);
};

function updateRays(dt: number, t: number): void {
	rayA -= dt * 0.1;
	for (const r of rays) {
		r.obj.visible = dayF > 0.01;
		if (!r.obj.visible) continue;
		const a = rayA + r.lag;
		rayAt(a, _v);
		rayAt(a - 0.02, _w);
		const dx = _w.x - _v.x;
		const dz = _w.z - _v.z;
		const len = Math.hypot(dx, dz) || 1;
		const off = Math.ceil(rays.indexOf(r) / 2) * 2.1 * r.side;
		r.obj.position.set(_v.x + (-dz / len) * off, _v.y + (1 - dayF) * 35 + Math.sin(t * 0.8 + r.phase) * 0.3, _v.z + (dx / len) * off);
		r.obj.rotation.y = yawTo(dx, dz);
		r.obj.rotation.z = Math.sin(a * 3) * 0.3;
		r.obj.rotation.x = (_w.y - _v.y) * 0.5;
		for (const w of r.wings) w.rotation.z = w.userData.side * Math.sin(t * 1.9 + r.phase) * 0.42;
		if (Math.random() < dt * 16 * fxBudget.amount) {
			const p = r.obj.position;
			spark({ x: p.x - (dx / len) * 2.2 + (Math.random() - 0.5) * 0.4, y: p.y + (Math.random() - 0.5) * 0.2, z: p.z - (dz / len) * 2.2 + (Math.random() - 0.5) * 0.4, vy: -0.15, life: 1.8 + Math.random(), size: 0.1 + Math.random() * 0.08, color: pick([0xffffff, 0xfff1a8, 0xbfe6ff], Math.random()), sway: 0.15 });
		}
	}
}

/* 4. Puff dragons: tiny and round. They nap on rooftops and sneeze sparks. */

interface Perch {
	k: string;
	x: number;
	y: number;
	z: number;
}
interface Dragon {
	obj: THREE.Group;
	wings: THREE.Object3D[];
	perch: Perch | null;
	from: THREE.Vector3;
	to: THREE.Vector3;
	/** 0..1 while it flies, 1 when it sits. */
	fly: number;
	time: number;
	wait: number;
	sneeze: number;
	hop: number;
	phase: number;
}
const dragons: Dragon[] = [];
let perches: Perch[] = [];

function makeDragon(i: number): Dragon {
	const [skin, belly, wing] = [
		[0x8fe0b8, 0xe6ffe8, 0xffb8d0],
		[0xffb48a, 0xfff0d6, 0xffe08a],
		[0xc2a8ff, 0xf0e6ff, 0x9fe8ff],
	][i % 3];
	const k = new Kit();
	k.ball('solid', skin, 0.2, 0, 0.2, 0, { sy: 0.95 });
	k.ball('solid', belly, 0.15, 0, 0.16, -0.08);
	k.ball('solid', skin, 0.15, 0, 0.37, -0.15);
	k.ball('solid', belly, 0.075, 0, 0.33, -0.29, { sy: 0.8 });
	for (const sx of [-1, 1]) {
		k.ball('solid', 0xffffff, 0.045, sx * 0.075, 0.42, -0.26);
		k.ball('solid', 0x2a2440, 0.026, sx * 0.08, 0.42, -0.295);
		k.ball('solid', 0x2a2440, 0.01, sx * 0.03, 0.345, -0.36);
		k.cyl('solid', 0xfff4e2, 0.004, 0.025, 0.08, 4, sx * 0.07, 0.48, -0.12, { rz: sx * -0.3 });
		k.ball('solid', 0xffa8b8, 0.03, sx * 0.125, 0.35, -0.22, { sx: 0.4 });
		k.ball('solid', skin, 0.06, sx * 0.1, 0.03, -0.06, { sy: 0.6 });
	}
	for (let j = 0; j < 3; j++) k.cyl('solid', wing, 0.003, 0.03, 0.07, 4, 0, 0.36 - j * 0.07, 0.03 + j * 0.08, { rx: 0.5 + j * 0.4 });
	k.cyl('solid', skin, 0.02, 0.06, 0.24, 5, 0, 0.02, 0.24, { rx: 1.2 });
	k.gem('solid', wing, 0.05, 0, 0.2, 0.36, { sy: 1.4 });
	const obj = k.build();
	const wings: THREE.Object3D[] = [];
	for (const sx of [-1, 1]) {
		const wk = new Kit();
		wk.ball('solid', wing, 0.17, sx * 0.14, 0, 0.02, { sx: 0.95, sy: 0.08, sz: 0.62, ry: sx * 0.3 });
		const w = wk.build();
		w.position.set(sx * 0.14, 0.3, 0.04);
		w.userData.side = sx;
		obj.add(w);
		wings.push(w);
	}
	obj.scale.setScalar(1.25);
	layer.add(obj);
	const start = new THREE.Vector3((i - 1) * 2, 0, 2);
	return { obj, wings, perch: null, from: start.clone(), to: start.clone(), fly: 1, time: 1, wait: 1 + i * 2, sneeze: 4 + i * 3, hop: 0, phase: i * 2.1 };
}

function findPerches(): void {
	perches = [];
	for (const [k, p] of S.pieces) {
		const [x, z] = unkey(k);
		if (p.t === 'cottage') perches.push({ k, x, y: 1.5, z });
		else if (p.t === 'tree' && (p.g ?? 0) >= 1) perches.push({ k, x, y: 1.18, z });
		else if (p.t === 'market') perches.push({ k, x, y: 0.82, z });
		else if (p.t === 'elder') for (const [ox, oz] of [[1.2, 0.4], [-1, -0.8]]) perches.push({ k, x: x + ox, y: 3.75, z: z + oz });
	}
}

function sendDragon(d: Dragon, target: THREE.Vector3): void {
	const taken = new Set(dragons.map((o) => o.perch));
	const free = perches.filter((p) => !taken.has(p));
	// It likes a roof near the place the player looks at.
	const near = free.filter((p) => Math.hypot(p.x - target.x, p.z - target.z) < 9);
	const list = near.length ? near : free;
	const next = list.length ? list[Math.floor(Math.random() * list.length)] : null;
	d.from.copy(d.obj.position);
	if (next) d.to.set(next.x, groundY(next.x, next.z) + next.y, next.z);
	else {
		// No roof yet: it lands on the grass of the home island.
		const cells = S.islandCells[0];
		const [x, z] = cells[Math.floor(Math.random() * cells.length)];
		d.to.set(x, groundY(x, z) + (pieceAt(x, z) ? 0.6 : 0), z);
	}
	d.perch = next;
	d.fly = 0;
	d.time = Math.max(1.2, d.from.distanceTo(d.to) / 3);
}

function doSneeze(d: Dragon, loud: boolean): void {
	d.hop = 1;
	const p = d.obj.position;
	const yaw = d.obj.rotation.y;
	const fx = -Math.sin(yaw);
	const fz = -Math.cos(yaw);
	for (let i = 0; i < 14 * fxBudget.amount; i++) {
		spark({ x: p.x + fx * 0.45, y: p.y + 0.42, z: p.z + fz * 0.45, vx: fx * (1.2 + Math.random() * 1.5) + (Math.random() - 0.5) * 0.8, vy: 0.4 + Math.random() * 0.9, vz: fz * (1.2 + Math.random() * 1.5) + (Math.random() - 0.5) * 0.8, gravity: 1.6, drag: 1.2, life: 0.7 + Math.random() * 0.6, size: 0.09 + Math.random() * 0.07, color: pick([0xffb347, 0xffe08a, 0xff8f6a, 0xffffff], Math.random()) });
	}
	if (loud) creatureEvents.sneeze();
}

function updateDragons(dt: number, t: number, target: THREE.Vector3): void {
	for (const d of dragons) {
		if (d.perch && !perches.includes(d.perch)) {
			d.perch = null;
			d.wait = 0;
		}
		const flying = d.fly < 1;
		if (flying) {
			d.fly = Math.min(1, d.fly + dt / d.time);
			const f = smooth(d.fly);
			d.obj.position.lerpVectors(d.from, d.to, f);
			d.obj.position.y += Math.sin(f * Math.PI) * (1.2 + d.from.distanceTo(d.to) * 0.12);
			const dx = d.to.x - d.from.x;
			const dz = d.to.z - d.from.z;
			if (Math.abs(dx) + Math.abs(dz) > 0.01) d.obj.rotation.y = turnToward(d.obj.rotation.y, yawTo(dx, dz), Math.min(1, dt * 6));
			d.obj.rotation.x = Math.sin(f * Math.PI) * -0.2;
			if (d.fly >= 1) {
				burst(d.to.x, d.to.y, d.to.z, [0xffffff, 0xe6ffe8], 5, 0.4);
				d.wait = 14 + Math.random() * 22;
				d.obj.rotation.y += (Math.random() - 0.5) * 2;
			}
		} else {
			// Sits and naps. The island bobs, so it follows the ground.
			if (d.perch) d.to.y = groundY(d.perch.x, d.perch.z) + d.perch.y;
			d.hop = Math.max(0, d.hop - dt * 2.5);
			d.obj.position.set(d.to.x, d.to.y + Math.sin(d.hop * Math.PI) * 0.25, d.to.z);
			d.obj.rotation.x = d.hop > 0 ? -0.3 * Math.sin(d.hop * Math.PI) : 0;
			const breath = Math.sin(t * 1.8 + d.phase) * 0.04;
			d.obj.scale.set(1.25 * (1 + breath), 1.25 * (1 - breath), 1.25 * (1 + breath));
			d.sneeze -= dt;
			if (d.sneeze <= 0) {
				d.sneeze = (nightF > 0.5 ? 18 : 7) + Math.random() * 10;
				doSneeze(d, Math.hypot(d.to.x - target.x, d.to.z - target.z) < 12);
			}
			d.wait -= dt;
			if (d.wait <= 0 && nightF < 0.5) sendDragon(d, target);
			else if (d.wait <= 0) d.wait = 10;
		}
		for (const w of d.wings) w.rotation.z = w.userData.side * (flying ? Math.sin(t * 24 + d.phase) * 0.8 - 0.1 : -1.15 - d.hop * 0.6);
	}
}

/* 5. Kite koi: ribbon fish that swim through the waterfalls. */

const KOI_SEGS = 9;
interface Koi {
	head: THREE.Group;
	segs: THREE.Object3D[];
	trail: THREE.Vector3[];
	fall: Fall | null;
	th: number;
	dir: number;
	phase: number;
	pos: THREE.Vector3;
	stay: number;
	/** 0..1 while it flies to a new waterfall. */
	move: number;
	from: THREE.Vector3;
}
const kois: Koi[] = [];

function makeKoi(i: number): Koi {
	const [base, patch, fin] = [
		[0xffffff, 0xff7a3c, 0xffb347],
		[0xffd66b, 0xffffff, 0xffe9a8],
		[0xff8fa8, 0xffffff, 0xffc2d0],
		[0xf4f8ff, 0x3c5a9a, 0x9fd0ff],
	][i % 4];
	const k = new Kit();
	k.ball('solid', base, 0.16, 0, 0, 0, { sx: 0.8, sy: 0.9, sz: 2.2 });
	k.ball('solid', patch, 0.12, 0.02, 0.07, -0.12, { sx: 0.9, sy: 0.7, sz: 1.3 });
	k.ball('solid', patch, 0.09, -0.03, 0.06, 0.18, { sy: 0.7, sz: 1.2 });
	for (const sx of [-1, 1]) {
		k.ball('solid', 0x2a2440, 0.025, sx * 0.085, 0.03, -0.26);
		k.ball('solid', fin, 0.14, sx * 0.17, -0.04, -0.05, { sx: 0.9, sy: 0.08, sz: 0.5, ry: sx * 0.5, rz: sx * -0.4 });
		k.box('solid', fin, 0.012, 0.012, 0.14, sx * 0.07, -0.05, -0.38, { ry: sx * -0.5 });
	}
	k.ball('solid', fin, 0.1, 0, 0.14, 0.05, { sx: 0.08, sy: 0.8, sz: 1.3 });
	const head = k.build();
	head.scale.setScalar(1.3);
	layer.add(head);
	const segs: THREE.Object3D[] = [];
	for (let j = 0; j < KOI_SEGS; j++) {
		const w = 0.2 * (1 - j / (KOI_SEGS + 2)) + 0.04;
		const sk = new Kit();
		sk.box('solid', j % 3 === 1 ? patch : j % 3 === 2 ? fin : base, 0.03, w, 0.26, 0, -w / 2, 0);
		const seg = sk.build();
		layer.add(seg);
		segs.push(seg);
	}
	return { head, segs, trail: [], fall: null, th: i * 1.7, dir: i % 2 ? 1 : -1, phase: i * 2.3, pos: new THREE.Vector3(0, -2, 0), stay: 0, move: 1, from: new THREE.Vector3() };
}

function updateKoi(dt: number, t: number): void {
	const falls = allFalls();
	for (const k of kois) {
		const show = dayF > 0.02 && falls.length > 0;
		k.head.visible = show;
		for (const s of k.segs) s.visible = show;
		if (!show) continue;
		if (!k.fall || !falls.includes(k.fall) || k.stay <= 0) {
			const first = !k.fall;
			k.fall = falls[Math.floor(Math.random() * falls.length)];
			k.stay = 24 + Math.random() * 30;
			k.from.copy(k.pos);
			k.move = first ? 1 : 0;
			if (first) k.trail.length = 0;
		}
		k.stay -= dt;
		const f = k.fall;
		k.th += dt * 1.25 * k.dir;
		const r = 0.85 + 0.25 * Math.sin(k.th * 0.7 + k.phase);
		const deep = Math.min(f.h * 0.6, 6);
		const y = groundY(f.x - DX[f.d] * 0.5, f.z - DZ[f.d] * 0.5) + 0.4 - (0.5 + 0.5 * Math.sin(t * 0.3 + k.phase)) * deep - (1 - dayF) * 10;
		_v.set(f.x + DX[f.d] * 1.25 + Math.cos(k.th) * r, y + Math.sin(k.th * 2) * 0.25, f.z + DZ[f.d] * 1.25 + Math.sin(k.th) * r);
		if (k.move < 1) {
			// It swims through the open sky to the next waterfall.
			k.move = Math.min(1, k.move + dt / Math.max(3, k.from.distanceTo(_v) / 4));
			const e = smooth(k.move);
			_w.lerpVectors(k.from, _v, e);
			_w.y += Math.sin(e * Math.PI) * 3;
			_v.copy(_w);
		}
		const moved = _w.copy(_v).sub(k.pos);
		if (moved.lengthSq() > 1e-6) {
			k.head.rotation.y = turnToward(k.head.rotation.y, yawTo(moved.x, moved.z), Math.min(1, dt * 10));
			k.head.rotation.x = clamp(moved.y / (Math.hypot(moved.x, moved.z) + 0.001), -1, 1) * 0.6;
		}
		k.pos.copy(_v);
		k.head.position.copy(k.pos);
		k.head.rotation.z = Math.sin(t * 5 + k.phase) * 0.12;

		// The ribbon tail follows the way the head went.
		if (!k.trail.length || k.trail[0].distanceToSquared(k.pos) > 0.004) {
			k.trail.unshift(k.pos.clone());
			if (k.trail.length > 70) k.trail.pop();
		}
		let at = 0;
		let walked = 0;
		for (let j = 0; j < KOI_SEGS; j++) {
			const want = 0.42 + j * 0.24;
			while (at < k.trail.length - 2 && walked < want) {
				walked += k.trail[at].distanceTo(k.trail[at + 1]);
				at++;
			}
			const p = k.trail[Math.min(at, k.trail.length - 1)];
			const before = k.trail[Math.max(0, Math.min(at, k.trail.length - 1) - 1)];
			const seg = k.segs[j];
			seg.position.copy(p);
			seg.position.y += Math.sin(t * 6 - j * 0.9 + k.phase) * 0.03 * j;
			if (p !== before) seg.rotation.y = yawTo(before.x - p.x, before.z - p.z);
			seg.rotation.z = Math.sin(t * 6 - j * 0.9 + k.phase) * 0.35;
		}
	}
}

/* Night: moon moths, wisps, the star fox and glow mushrooms. */

interface Moth {
	obj: THREE.Mesh;
	glow: THREE.Sprite;
	x: number;
	y: number;
	z: number;
	a: number;
	r: number;
	speed: number;
	next: number;
}
const moths: Moth[] = [];
const mothMat = new THREE.MeshBasicMaterial({ color: 0xe6f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
const mothGeo = new THREE.BufferGeometry();
mothGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.05, -0.13, 0.05, -0.05, 0, 0, -0.04, 0, 0, 0.05, 0, 0, -0.04, 0.13, 0.05, -0.05, 0, 0, 0.02, -0.09, 0.03, 0.09, 0, 0, 0.06, 0, 0, 0.02, 0, 0, 0.06, 0.09, 0.03, 0.09]), 3));

function makeMoth(i: number): Moth {
	const obj = new THREE.Mesh(mothGeo, mothMat);
	const glow = softGlow(0xbfd8ff, 0.5);
	obj.add(glow);
	layer.add(obj);
	return { obj, glow, x: 0, y: 1, z: 0, a: i * 1.1, r: 0.3 + (i % 3) * 0.12, speed: (2 + (i % 4) * 0.5) * (i % 2 ? 1 : -1), next: 0 };
}

function updateMoths(dt: number, t: number): void {
	moths.forEach((m, i) => {
		m.obj.visible = nightF > 0.02;
		if (!m.obj.visible) return;
		m.next -= dt;
		if (m.next <= 0) {
			// Moths gather at the lights. With no light, they dance over the grass.
			m.next = 12 + Math.random() * 14;
			const src = wishSources.length ? wishSources[(i * 7 + Math.floor(Math.random() * 3)) % wishSources.length] : null;
			if (src) [m.x, m.y, m.z] = [src.x, Math.min(src.y, 2.4) - 0.15, src.z];
			else {
				const [x, z] = S.islandCells[0][Math.floor(Math.random() * S.islandCells[0].length)];
				[m.x, m.y, m.z] = [x, 0.7, z];
			}
		}
		m.a += dt * m.speed * (0.7 + 0.5 * Math.sin(t * 1.3 + i));
		const r = m.r * (1 + 0.4 * Math.sin(t * 2.1 + i * 2));
		const gx = m.x + Math.cos(m.a) * r;
		const gz = m.z + Math.sin(m.a) * r;
		const gy = groundY(m.x, m.z) + m.y + Math.sin(t * 3.3 + i) * 0.1;
		m.obj.position.lerp(_v.set(gx, gy, gz), Math.min(1, dt * 3));
		m.obj.rotation.y = -m.a + (m.speed > 0 ? Math.PI : 0);
		m.obj.scale.set(nightF, nightF * (1 + Math.sin(t * 30 + i) * 2.4), nightF);
		m.glow.material.opacity = 0.5 * nightF;
	});
}

interface Wisp {
	obj: THREE.Sprite;
	core: THREE.Sprite;
	x: number;
	z: number;
	fromX: number;
	fromZ: number;
	toX: number;
	toZ: number;
	step: number;
	phase: number;
	color: number;
}
const wisps: Wisp[] = [];
let pathCells: [number, number][] = [];

function makeWisp(i: number): Wisp {
	const color = [0x8ffff0, 0xc9a8ff, 0x9fd8ff, 0xbfffb0][i % 4];
	const obj = softGlow(color, 1.1);
	const core = softGlow(0xffffff, 0.3);
	obj.add(core);
	layer.add(obj);
	return { obj, core, x: 0, z: 0, fromX: 0, fromZ: 0, toX: 0, toZ: 0, step: 2, phase: i * 1.9, color };
}

const isWalkway = (x: number, z: number): boolean => {
	const t = pieceAt(x, z)?.t;
	return t === 'path' || t === 'bridge' || t === 'dock';
};

function updateWisps(dt: number, t: number): void {
	for (const w of wisps) {
		w.obj.visible = nightF > 0.02;
		if (!w.obj.visible) {
			w.step = 2;
			continue;
		}
		if (w.step >= 2) {
			// A new night: it wakes on a path, or on the grass when there is no path.
			const list = pathCells.length ? pathCells : S.islandCells[0];
			const [x, z] = list[Math.floor(Math.random() * list.length)];
			w.x = w.fromX = w.toX = x;
			w.z = w.fromZ = w.toZ = z;
			w.step = 1;
		}
		if (w.step >= 1) {
			const cx = Math.round(w.toX);
			const cz = Math.round(w.toZ);
			const ways = [0, 1, 2, 3].map((d): [number, number] => [cx + DX[d], cz + DZ[d]]);
			const back = (c: [number, number]): boolean => c[0] === Math.round(w.fromX) && c[1] === Math.round(w.fromZ);
			let next = ways.filter((c) => isWalkway(c[0], c[1]) && !back(c));
			if (!next.length) next = ways.filter((c) => isWalkway(c[0], c[1]));
			if (!next.length) next = ways.filter((c) => S.land.has(key(c[0], c[1])) && !back(c));
			if (!next.length) next = [[cx, cz]];
			w.fromX = w.toX;
			w.fromZ = w.toZ;
			[w.toX, w.toZ] = next[Math.floor(Math.random() * next.length)];
			w.step = 0;
		}
		w.step = Math.min(1, w.step + dt * 0.7);
		const e = smooth(w.step);
		w.x = w.fromX + (w.toX - w.fromX) * e;
		w.z = w.fromZ + (w.toZ - w.fromZ) * e;
		const y = groundY(w.x, w.z) + 0.4 + Math.sin(t * 1.6 + w.phase) * 0.12;
		w.obj.position.set(w.x + Math.sin(t * 0.9 + w.phase) * 0.12, y, w.z + Math.cos(t * 0.8 + w.phase) * 0.12);
		const pulse = 0.75 + 0.25 * Math.sin(t * 3 + w.phase);
		w.obj.material.opacity = 0.75 * nightF * pulse;
		w.core.material.opacity = nightF;
		w.obj.scale.setScalar(1.1 * (0.6 + 0.4 * nightF) * pulse);
		if (Math.random() < dt * 4 * fxBudget.amount) spark({ x: w.obj.position.x, y: y - 0.05, z: w.obj.position.z, vy: 0.12, life: 1.4, size: 0.07, color: w.color, sway: 0.1 });
	}
}

interface Fox {
	obj: THREE.Group;
	legs: THREE.Object3D[];
	tail: THREE.Object3D;
	island: number;
	a: number;
	pause: number;
	run: number;
	show: number;
}
let fox: Fox | null = null;
const foxMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x7fa8ff, emissiveIntensity: 0.7, flatShading: true });

function makeFox(): Fox {
	const fur = 0xeef4ff;
	const blue = 0xa8c4ff;
	const k = new Kit();
	k.ball('solid', fur, 0.15, 0, 0.27, 0.02, { sx: 0.85, sy: 0.9, sz: 1.9 });
	k.ball('solid', fur, 0.12, 0, 0.42, -0.3);
	k.cyl('solid', fur, 0.02, 0.07, 0.16, 5, 0, 0.32, -0.44, { rx: -1.4 });
	k.ball('solid', 0x2a2440, 0.02, 0, 0.385, -0.515);
	for (const sx of [-1, 1]) {
		k.cyl('solid', blue, 0.004, 0.05, 0.14, 4, sx * 0.07, 0.5, -0.26, { rz: sx * -0.2 });
		k.ball('solid', 0x2a2440, 0.02, sx * 0.065, 0.44, -0.4);
	}
	k.gem('lamp', 0xfff1a8, 0.035, 0, 0.5, -0.36, { sy: 1.2 });
	const obj = k.build(false);
	const legs: THREE.Object3D[] = [];
	for (const [z, phase] of [[-0.18, 0], [0.22, Math.PI]]) {
		const lk = new Kit();
		for (const sx of [-1, 1]) {
			lk.box('solid', fur, 0.045, 0.2, 0.045, sx * 0.07, -0.2, 0);
			lk.box('solid', blue, 0.05, 0.05, 0.06, sx * 0.07, -0.22, -0.01);
		}
		const leg = lk.build(false);
		leg.position.set(0, 0.22, z);
		leg.userData.phase = phase;
		obj.add(leg);
		legs.push(leg);
	}
	const tk = new Kit();
	tk.ball('solid', fur, 0.11, 0, 0.05, 0.2, { sx: 0.8, sy: 0.8, sz: 2 });
	tk.ball('solid', blue, 0.08, 0, 0.09, 0.4, { sz: 1.4 });
	tk.ball('lamp', 0xfff1a8, 0.03, 0, 0.12, 0.52);
	const tail = tk.build(false);
	tail.position.set(0, 0.3, 0.26);
	obj.add(tail);
	paint(obj, foxMat);
	obj.add(softGlow(0x9fc0ff, 1.6));
	obj.children[obj.children.length - 1].position.y = 0.3;
	obj.scale.setScalar(1.35);
	layer.add(obj);
	return { obj, legs, tail, island: 0, a: 0, pause: 0, run: 10, show: 0 };
}

function updateFox(dt: number, t: number, target: THREE.Vector3): void {
	const f = fox!;
	// The fox runs on the island that the player looks at.
	let best = 0;
	for (let i = 1; i < S.islands; i++) {
		if (Math.hypot(ISLANDS[i].cx - target.x, ISLANDS[i].cz - target.z) < Math.hypot(ISLANDS[best].cx - target.x, ISLANDS[best].cz - target.z)) best = i;
	}
	const wanted = nightF > 0.3 && best === f.island ? 1 : 0;
	f.show = clamp(f.show + (wanted ? dt : -dt) * 1.5, 0, 1);
	if (f.show <= 0) {
		f.island = best;
		f.obj.visible = false;
		return;
	}
	f.obj.visible = true;
	const d = ISLANDS[f.island];
	const running = f.pause <= 0;
	if (running) {
		f.run -= dt;
		f.a += (dt * 2.6) / d.r;
		if (f.run <= 0) {
			f.pause = 3.5;
			f.run = 14 + Math.random() * 12;
		}
	} else f.pause -= dt;
	const r = edgeRadius(f.island, f.a) - 1.1;
	const x = d.cx + Math.cos(f.a) * r;
	const z = d.cz + Math.sin(f.a) * r;
	const r2 = edgeRadius(f.island, f.a + 0.05) - 1.1;
	const hop = running ? Math.abs(Math.sin(t * 9)) * 0.14 : 0;
	f.obj.position.set(x, groundY(x, z) + hop, z);
	f.obj.rotation.y = turnToward(f.obj.rotation.y, yawTo(d.cx + Math.cos(f.a + 0.05) * r2 - x, d.cz + Math.sin(f.a + 0.05) * r2 - z), Math.min(1, dt * 8));
	f.obj.rotation.x = running ? Math.sin(t * 9) * 0.12 : -0.3;
	for (const leg of f.legs) leg.rotation.x = running ? Math.sin(t * 9 + leg.userData.phase) * 0.9 : leg.userData.phase ? 0.9 : 0;
	f.tail.rotation.y = Math.sin(t * (running ? 9 : 4)) * (running ? 0.25 : 0.6);
	f.tail.rotation.x = running ? 0.2 : 0.7;
	f.obj.scale.setScalar(1.35 * smooth(f.show));
	foxMat.emissiveIntensity = 0.5 + 0.3 * Math.sin(t * 2);
	if (running && Math.random() < dt * 14 * fxBudget.amount) {
		spark({ x: x + (Math.random() - 0.5) * 0.3, y: f.obj.position.y + 0.2 + Math.random() * 0.3, z: z + (Math.random() - 0.5) * 0.3, vy: 0.25, life: 1.3 + Math.random(), size: 0.07 + Math.random() * 0.07, color: pick([0xffffff, 0xbfd8ff, 0xfff1a8], Math.random()), sway: 0.15 });
	}
}

/* Glow mushrooms open on the free grass at night. */

const shroomMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x58ffd8, emissiveIntensity: 0, flatShading: true });
const shroomGeo = (() => {
	const k = new Kit();
	k.cyl('solid', 0xf4fff8, 0.014, 0.02, 0.1, 5, 0, 0, 0);
	k.cyl('solid', 0x8ff0dc, 0.012, 0.075, 0.06, 6, 0, 0.09, 0);
	const g = (k.build(false).children[0] as THREE.Mesh).geometry;
	return g;
})();
interface Patch {
	mesh: THREE.InstancedMesh;
	spots: { x: number; z: number; s: number }[];
	parent: THREE.Group;
}
let patches: Patch[] = [];
let shroomOpen = -1;

function plantShrooms(): void {
	for (const p of patches) {
		p.parent.remove(p.mesh);
		p.mesh.dispose();
	}
	patches = [];
	shroomOpen = -1;
	for (let i = 0; i < S.islands; i++) {
		const parent = islandGroup(i);
		if (!parent) continue;
		const spots: Patch['spots'] = [];
		// The Moon Garden grows far more of them.
		const share = ISLANDS[i].name === 'Moon Garden' ? 0.5 : 0.17;
		for (const [x, z] of S.islandCells[i]) {
			if (hash2(x, z, 90) > share || S.pieces.has(key(x, z))) continue;
			const n = 1 + Math.floor(hash2(x, z, 91) * 3);
			for (let j = 0; j < n; j++) spots.push({ x: x + (hash2(x, z, 92 + j) - 0.5) * 0.8, z: z + (hash2(x, z, 96 + j) - 0.5) * 0.8, s: 0.7 + hash2(x, z, 99 + j) * 0.9 });
		}
		if (!spots.length) continue;
		const mesh = new THREE.InstancedMesh(shroomGeo, shroomMat, spots.length);
		spots.forEach((_spot, j) => mesh.setColorAt(j, _c.set([0xffffff, 0xd8c8ff, 0xc8ffe8][j % 3])));
		mesh.visible = false;
		parent.add(mesh);
		patches.push({ mesh, spots, parent });
	}
}

function updateShrooms(t: number): void {
	shroomMat.emissiveIntensity = nightF * (0.75 + 0.2 * Math.sin(t * 1.5));
	const open = Math.round(nightF * 40) / 40;
	if (open === shroomOpen) return;
	shroomOpen = open;
	for (const p of patches) {
		p.mesh.visible = open > 0;
		if (!open) continue;
		p.spots.forEach((s, j) => {
			// Each one opens a little later than the last.
			const grow = smooth(clamp(open * 1.6 - (j % 7) * 0.09, 0, 1));
			_m.compose(_v.set(s.x, 0, s.z), _q.identity(), _s.set(s.s * (0.3 + 0.7 * grow), s.s * grow, s.s * (0.3 + 0.7 * grow)));
			p.mesh.setMatrixAt(j, _m);
		});
		p.mesh.instanceMatrix.needsUpdate = true;
	}
}

/* Shell */

export function initCreatures(): void {
	world.add(layer);
	whale = makeWhale(goldWhale);
	for (let i = 0; i < 6; i++) jellies.push(makeJelly(i));
	for (let i = 0; i < 3; i++) rays.push(makeRay(i));
	for (let i = 0; i < 3; i++) dragons.push(makeDragon(i));
	for (let i = 0; i < 4; i++) kois.push(makeKoi(i));
	for (let i = 0; i < 10; i++) moths.push(makeMoth(i));
	for (let i = 0; i < 6; i++) wisps.push(makeWisp(i));
	fox = makeFox();
}

/** Brings the creatures in step with the pieces and the islands. */
export function syncCreatures(): void {
	findPerches();
	pathCells = [];
	for (const [k, p] of S.pieces) if (p.t === 'path') pathCells.push(unkey(k));
	plantShrooms();
}

/** Puts every creature back at its start, for a new game. */
export function resetCreatures(): void {
	for (const d of dragons) {
		d.perch = null;
		d.wait = 1;
	}
	for (const k of kois) k.fall = null;
	for (const j of jellies) j.rest = Math.min(j.rest, 20);
	jellyHome.set(0, 0, 0);
	syncCreatures();
}

export function updateCreatures(dt: number, target: THREE.Vector3): void {
	const t = env.time;
	dayF = 1 - smooth(clamp((env.night - 0.35) / 0.35, 0, 1));
	nightF = smooth(clamp((env.night - 0.5) / 0.35, 0, 1));
	updateWhale(dt, t, target);
	updateJellies(dt, t, target);
	updateRays(dt, t);
	updateDragons(dt, t, target);
	updateKoi(dt, t);
	updateMoths(dt, t);
	updateWisps(dt, t);
	updateFox(dt, t, target);
	updateShrooms(t);
}

/** A tap on the screen: did it hit a creature? A jelly gives its gift, a dragon sneezes, the whale sings. */
export function tapCreature(ray: THREE.Ray): boolean {
	let hit: Jelly | null = null;
	let near = 1.05;
	for (const j of jellies) {
		const d = ray.distanceToPoint(_v.copy(j.obj.position).setY(j.obj.position.y - 0.2));
		if (d < near) {
			near = d;
			hit = j;
		}
	}
	if (hit) {
		const p = hit.obj.position;
		hit.flash = 1;
		if (hit.rest > 0) {
			burst(p.x, p.y, p.z, [hit.color, 0xffffff], 6, 0.5);
			creatureEvents.poke('jelly');
			return true;
		}
		hit.rest = 50 + Math.random() * 30;
		burst(p.x, p.y, p.z, [hit.color, 0xffffff, 0xfff1a8], 30, 1.4);
		// The gift falls to the ground as a shower of light.
		const gy = groundY(p.x, p.z);
		for (let i = 0; i < 30 * fxBudget.amount; i++) {
			spark({ x: p.x + (Math.random() - 0.5) * 1.6, y: p.y - Math.random() * 0.5, z: p.z + (Math.random() - 0.5) * 1.6, vy: -(p.y - gy) / (0.9 + Math.random() * 0.5), life: 1.2 + Math.random() * 0.5, size: 0.12, color: pick([hit.color, 0xfff6d0], Math.random()), sway: 0.2 });
		}
		creatureEvents.gift(Math.round(p.x), Math.round(p.z));
		return true;
	}
	for (const d of dragons) {
		if (ray.distanceToPoint(_v.copy(d.obj.position).setY(d.obj.position.y + 0.3)) > 0.55) continue;
		if (d.fly >= 1) {
			doSneeze(d, true);
			d.wait = Math.min(d.wait, 1.2);
		}
		creatureEvents.poke('dragon');
		return true;
	}
	if (whale && whale.obj.visible && ray.distanceToPoint(whale.obj.position) < 3.5) {
		whale.song = 30;
		singSparks(whale);
		creatureEvents.whaleSong();
		creatureEvents.poke('whale');
		return true;
	}
	return false;
}
