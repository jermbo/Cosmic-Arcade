/** The living things: villagers, small critters and growing trees. */

import * as THREE from 'three';
import { PIECE, TUNE, VILLAGER_NAMES } from './content.ts';
import type { Visit } from './content.ts';
import { burst } from './fx.ts';
import { Kit } from './models.ts';
import { env } from './sky.ts';
import { isLand, pieceAt, S, saveSoon, touch } from './state.ts';
import { DX, DZ, key, pick, rng, turnToward, unkey } from './util.ts';
import { groundY, isWet, rebuildPiece, scalePiece, world } from './view.ts';

type Emote = 'heart' | 'note' | 'zzz' | 'star' | 'bloom' | 'hi';
type Act = Visit | 'stroll' | 'home';

interface Villager {
	home: string;
	name: string;
	obj: THREE.Group;
	arm: THREE.Object3D;
	emote: THREE.Sprite;
	emoteLeft: number;
	x: number;
	z: number;
	yaw: number;
	state: 'inside' | 'walk' | 'stay';
	path: [number, number][];
	wait: number;
	act: Act;
	/** Where it looks while it stays. */
	look: [number, number] | null;
	wave: number;
	step: number;
}

interface Critter {
	obj: THREE.Group;
	x: number;
	z: number;
	fromX: number;
	fromZ: number;
	toX: number;
	toZ: number;
	hop: number;
	wait: number;
	yaw: number;
}

const villagers: Villager[] = [];
const critters: Critter[] = [];
const moveIn = new Map<string, number>();
const layer = new THREE.Group();
let critterTimer = 3;

/** Things that the shell wants to hear about. */
export const lifeEvents = {
	movedIn: (_name: string) => {},
	hello: () => {},
	treeGrew: () => {},
};

export function initLife(): void {
	world.add(layer);
}

/* Looks */

const COATS = [0xf7a8b8, 0x9fd0ff, 0xb9e8b0, 0xf9dc8a, 0xc9a8ff, 0xffc49a, 0x8fded0];

function makeVillager(seed: number): { obj: THREE.Group; arm: THREE.Object3D } {
	const rand = rng(seed + 1);
	const coat = pick(COATS, rand());
	const hat = pick(COATS, rand());
	const k = new Kit();
	k.ball('solid', coat, 0.1, 0, 0.12, 0, { sy: 1.15 });
	k.ball('solid', 0xfff0e0, 0.085, 0, 0.275, 0);
	k.cyl('solid', hat, 0.012, 0.1, 0.15, 6, 0, 0.325, 0);
	k.ball('solid', 0xffffff, 0.028, 0, 0.485, 0);
	k.box('solid', 0x5a4a66, 0.018, 0.022, 0.01, -0.032, 0.275, -0.08);
	k.box('solid', 0x5a4a66, 0.018, 0.022, 0.01, 0.032, 0.275, -0.08);
	k.box('solid', 0xffb3c1, 0.02, 0.012, 0.01, -0.055, 0.255, -0.07);
	k.box('solid', 0xffb3c1, 0.02, 0.012, 0.01, 0.055, 0.255, -0.07);
	k.box('solid', 0x8a6f5a, 0.045, 0.03, 0.07, -0.04, 0, -0.01);
	k.box('solid', 0x8a6f5a, 0.045, 0.03, 0.07, 0.04, 0, -0.01);
	k.ball('solid', coat, 0.032, -0.105, 0.15, 0);
	const obj = k.build();
	const armKit = new Kit();
	armKit.ball('solid', coat, 0.032, 0, 0.06, 0, { sy: 1.6 });
	const arm = armKit.build();
	arm.position.set(0.1, 0.12, 0);
	obj.add(arm);
	return { obj, arm };
}

function makeCritter(seed: number): THREE.Group {
	const rand = rng(seed + 3);
	const fur = pick([0xe4f2cf, 0xf7e9dc, 0xdcebf7, 0xf7dcea], rand());
	const k = new Kit();
	k.ball('solid', fur, 0.085, 0, 0.075, 0, { sy: 0.85, sz: 1.2 });
	k.cyl('solid', 0x8fd3a0, 0.004, 0.028, 0.1, 4, -0.035, 0.12, 0.01, { rz: 0.25, rx: 0.2 });
	k.cyl('solid', 0x8fd3a0, 0.004, 0.028, 0.1, 4, 0.035, 0.12, 0.01, { rz: -0.25, rx: 0.2 });
	k.ball('solid', 0xffffff, 0.03, 0, 0.08, 0.1);
	k.box('solid', 0x5a4a66, 0.014, 0.016, 0.01, -0.03, 0.085, -0.095);
	k.box('solid', 0x5a4a66, 0.014, 0.016, 0.01, 0.03, 0.085, -0.095);
	k.box('solid', 0xffb3c1, 0.016, 0.01, 0.01, 0, 0.065, -0.1);
	return k.build();
}

const emoteTextures = new Map<Emote, THREE.CanvasTexture>();

function emoteTexture(kind: Emote): THREE.CanvasTexture {
	const cached = emoteTextures.get(kind);
	if (cached) return cached;
	const c = document.createElement('canvas');
	c.width = c.height = 64;
	const g = c.getContext('2d')!;
	g.fillStyle = 'rgba(255,255,255,0.95)';
	g.beginPath();
	g.arc(32, 30, 26, 0, Math.PI * 2);
	g.fill();
	g.beginPath();
	g.moveTo(24, 52);
	g.lineTo(32, 63);
	g.lineTo(40, 52);
	g.fill();
	g.lineWidth = 5;
	g.lineCap = g.lineJoin = 'round';
	if (kind === 'heart') {
		g.fillStyle = '#ff8fab';
		g.beginPath();
		g.moveTo(32, 44);
		g.bezierCurveTo(8, 28, 20, 10, 32, 23);
		g.bezierCurveTo(44, 10, 56, 28, 32, 44);
		g.fill();
	} else if (kind === 'note') {
		g.fillStyle = g.strokeStyle = '#8f7fe0';
		g.beginPath();
		g.ellipse(26, 40, 7, 5.5, -0.4, 0, Math.PI * 2);
		g.fill();
		g.beginPath();
		g.moveTo(32, 40);
		g.lineTo(32, 16);
		g.lineTo(43, 21);
		g.stroke();
	} else if (kind === 'zzz') {
		g.strokeStyle = '#7fa6e0';
		for (const [x, y, s] of [[20, 34, 9], [34, 20, 6]]) {
			g.beginPath();
			g.moveTo(x, y);
			g.lineTo(x + s, y);
			g.lineTo(x, y + s);
			g.lineTo(x + s, y + s);
			g.stroke();
		}
	} else if (kind === 'star') {
		g.fillStyle = '#ffc94d';
		g.beginPath();
		for (let i = 0; i < 10; i++) {
			const r = i % 2 ? 7 : 16;
			const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
			g.lineTo(32 + Math.cos(a) * r, 30 + Math.sin(a) * r);
		}
		g.fill();
	} else if (kind === 'bloom') {
		g.fillStyle = '#ff9fc0';
		for (let i = 0; i < 5; i++) {
			const a = (i / 5) * Math.PI * 2;
			g.beginPath();
			g.arc(32 + Math.cos(a) * 9, 30 + Math.sin(a) * 9, 7, 0, Math.PI * 2);
			g.fill();
		}
		g.fillStyle = '#ffd95e';
		g.beginPath();
		g.arc(32, 30, 6, 0, Math.PI * 2);
		g.fill();
	} else {
		g.strokeStyle = '#ffab5e';
		for (const a of [-0.7, 0, 0.7]) {
			g.beginPath();
			g.moveTo(32 + Math.sin(a) * 6, 36 - Math.cos(a) * 6);
			g.lineTo(32 + Math.sin(a) * 17, 36 - Math.cos(a) * 17);
			g.stroke();
		}
	}
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	emoteTextures.set(kind, tex);
	return tex;
}

function showEmote(v: Villager, kind: Emote, time = 2.2): void {
	v.emote.material.map = emoteTexture(kind);
	v.emote.material.needsUpdate = true;
	v.emote.visible = true;
	v.emoteLeft = time;
}

/* Walking */

/** Can a walker stand on this cell? */
function canWalk(x: number, z: number): boolean {
	const p = pieceAt(x, z);
	if (p) return !!PIECE[p.t].walk;
	return isLand(x, z);
}

const stepCost = (x: number, z: number): number => (pieceAt(x, z) ? 1 : 2.6);

/** Shortest ways from one cell to every cell that a walker can reach. */
function reachFrom(sx: number, sz: number): Map<string, { cost: number; prev: string | null }> {
	const out = new Map<string, { cost: number; prev: string | null }>();
	out.set(key(sx, sz), { cost: 0, prev: null });
	const open: string[] = [key(sx, sz)];
	while (open.length) {
		let bi = 0;
		for (let i = 1; i < open.length; i++) if (out.get(open[i])!.cost < out.get(open[bi])!.cost) bi = i;
		const k = open.splice(bi, 1)[0];
		const here = out.get(k)!;
		const [x, z] = unkey(k);
		for (let d = 0; d < 4; d++) {
			const nx = x + DX[d];
			const nz = z + DZ[d];
			if (!canWalk(nx, nz)) continue;
			const nk = key(nx, nz);
			const cost = here.cost + stepCost(nx, nz);
			const old = out.get(nk);
			if (old && old.cost <= cost) continue;
			out.set(nk, { cost, prev: k });
			if (!old) open.push(nk);
		}
	}
	return out;
}

function pathTo(reach: Map<string, { cost: number; prev: string | null }>, goal: string): [number, number][] {
	const out: [number, number][] = [];
	let k: string | null = goal;
	while (k) {
		out.unshift(unkey(k));
		k = reach.get(k)!.prev;
	}
	return out;
}

/** The cell in front of the door of a cottage, or a free cell next to it. */
function doorCell(home: string): [number, number] | null {
	const p = S.pieces.get(home);
	if (!p) return null;
	const [x, z] = unkey(home);
	for (let i = 0; i < 4; i++) {
		const d = (p.r + i) % 4;
		if (canWalk(x + DX[d], z + DZ[d])) return [x + DX[d], z + DZ[d]];
	}
	return null;
}

const EMOTE_OF: Record<Act, Emote> = { rest: 'heart', sit: 'note', gather: 'star', shop: 'heart', sniff: 'bloom', wish: 'star', gaze: 'note', stroll: 'note', home: 'zzz' };

/** Picks a place to go and the way to it. Returns false when there is nowhere to go. */
function planTrip(v: Villager, from: [number, number]): boolean {
	const reach = reachFrom(from[0], from[1]);
	const options: { k: string; act: Act; look: [number, number] | null; weight: number }[] = [];
	const dusk = env.night > 0.25;
	for (const [k, p] of S.pieces) {
		const def = PIECE[p.t];
		const [x, z] = unkey(k);
		if (def.visit) {
			const weight = def.visit === 'gather' ? (dusk ? 6 : 1) : 2;
			if (def.walk) {
				if (reach.has(k)) options.push({ k, act: def.visit, look: [x + DX[p.r], z + DZ[p.r]], weight });
				continue;
			}
			for (let d = 0; d < 4; d++) {
				const nk = key(x + DX[d], z + DZ[d]);
				if (reach.has(nk) && nk !== key(from[0], from[1])) options.push({ k: nk, act: def.visit, look: [x, z], weight: weight / 2 });
			}
		} else if (def.walk && reach.has(k) && reach.get(k)!.cost > 2) {
			options.push({ k, act: 'stroll', look: null, weight: 0.35 });
		}
	}
	// A short walk on the grass is always possible.
	for (const [k, r] of reach) if (r.cost > 2 && r.cost < 9 && !S.pieces.has(k)) options.push({ k, act: 'stroll', look: null, weight: 0.12 });
	if (!options.length) return false;
	let roll = Math.random() * options.reduce((sum, o) => sum + o.weight, 0);
	const choice = options.find((o) => (roll -= o.weight) <= 0) ?? options[0];
	v.path = pathTo(reach, choice.k);
	v.act = choice.act;
	v.look = choice.look;
	return true;
}

function goHome(v: Villager): void {
	const door = doorCell(v.home);
	const here: [number, number] = [Math.round(v.x), Math.round(v.z)];
	v.act = 'home';
	v.look = null;
	if (!door) {
		enterHome(v);
		return;
	}
	const reach = reachFrom(here[0], here[1]);
	const k = key(door[0], door[1]);
	if (!reach.has(k)) {
		poof(v);
		enterHome(v);
		return;
	}
	v.path = pathTo(reach, k);
	v.state = 'walk';
}

function enterHome(v: Villager): void {
	v.state = 'inside';
	v.obj.visible = false;
	v.emote.visible = false;
	v.wait = 5 + Math.random() * 8;
	v.path = [];
}

function poof(v: Villager): void {
	burst(v.x, groundY(v.x, v.z) + 0.2, v.z, [0xffffff, 0xffe9f2], 8, 0.6);
}

function addVillager(home: string, nameIndex: number): Villager {
	const [x, z] = unkey(home);
	const { obj, arm } = makeVillager(nameIndex * 7 + (S.pieces.get(home)?.s ?? 0));
	const emote = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTexture('heart'), transparent: true, depthWrite: false, fog: false }));
	emote.scale.setScalar(0.3);
	emote.position.y = 0.72;
	emote.visible = false;
	obj.add(emote);
	obj.visible = false;
	layer.add(obj);
	const v: Villager = { home, name: VILLAGER_NAMES[nameIndex % VILLAGER_NAMES.length], obj, arm, emote, emoteLeft: 0, x, z, yaw: 0, state: 'inside', path: [], wait: 1 + Math.random() * 3, act: 'home', look: null, wave: 0, step: Math.random() * 6 };
	villagers.push(v);
	return v;
}

function removeVillager(v: Villager): void {
	if (v.obj.visible) poof(v);
	layer.remove(v.obj);
	villagers.splice(villagers.indexOf(v), 1);
}

/** Brings villagers, move-in timers and critters in step with the pieces. */
export function syncLife(placed: string | null): void {
	for (const v of [...villagers]) {
		const p = S.pieces.get(v.home);
		if (!p || p.t !== 'cottage' || !p.h) removeVillager(v);
	}
	for (const [k, p] of S.pieces) {
		if (p.t !== 'cottage') continue;
		if (p.h) {
			if (!villagers.some((v) => v.home === k)) addVillager(k, p.h - 1);
		} else if (!moveIn.has(k)) moveIn.set(k, TUNE.moveInDelay + Math.random() * 2);
	}
	for (const k of [...moveIn.keys()]) if (S.pieces.get(k)?.t !== 'cottage') moveIn.delete(k);

	// A walker whose cell or way is now blocked finds a new plan.
	for (const v of villagers) {
		if (v.state === 'inside') continue;
		const cx = Math.round(v.x);
		const cz = Math.round(v.z);
		if (!canWalk(cx, cz)) {
			poof(v);
			enterHome(v);
			v.wait = 2;
		} else if (v.path.some(([x, z]) => !canWalk(x, z))) {
			v.path = [];
			v.state = 'stay';
			v.wait = 0.4;
		}
	}
	for (const c of critters) {
		if (pieceAt(Math.round(c.toX), Math.round(c.toZ))) c.wait = 0;
	}

	// Villagers and critters near a new piece are glad to see it.
	if (placed) {
		const [px, pz] = unkey(placed);
		let any = false;
		for (const v of villagers) {
			if (v.state === 'inside' || Math.hypot(v.x - px, v.z - pz) > 4.5) continue;
			v.wave = 1.8;
			v.look = [px, pz];
			showEmote(v, Math.random() < 0.5 ? 'heart' : 'hi', 1.8);
			any = true;
		}
		if (any) lifeEvents.hello();
		for (const c of critters) if (Math.hypot(c.x - px, c.z - pz) < 2.5 && c.hop >= 1) startHop(c, c.x, c.z);
	}
}

/** Removes every creature, for a new game. */
export function clearLife(): void {
	for (const v of [...villagers]) {
		layer.remove(v.obj);
	}
	villagers.length = 0;
	for (const c of critters) layer.remove(c.obj);
	critters.length = 0;
	moveIn.clear();
}

/* Critters */

function freeGrass(x: number, z: number): boolean {
	return isLand(x, z) && !pieceAt(x, z);
}

function startHop(c: Critter, x: number, z: number): void {
	c.fromX = c.x;
	c.fromZ = c.z;
	c.toX = x;
	c.toZ = z;
	c.hop = 0;
	if (x !== c.x || z !== c.z) c.yaw = Math.atan2(-(x - c.x), -(z - c.z));
}

function tendCritters(dt: number): void {
	critterTimer -= dt;
	if (critterTimer > 0) return;
	critterTimer = 4;
	const nature: string[] = [];
	for (const [k, p] of S.pieces) if (PIECE[p.t].nature) nature.push(k);
	const want = Math.min(TUNE.maxCritters, Math.floor(nature.length / 2));
	if (critters.length < want) {
		const [nx, nz] = unkey(nature[Math.floor(Math.random() * nature.length)]);
		const d = Math.floor(Math.random() * 4);
		const x = nx + DX[d];
		const z = nz + DZ[d];
		if (freeGrass(x, z)) {
			const obj = makeCritter(Math.floor(Math.random() * 999));
			layer.add(obj);
			critters.push({ obj, x, z, fromX: x, fromZ: z, toX: x, toZ: z, hop: 1, wait: 1, yaw: 0 });
			burst(x, groundY(x, z) + 0.1, z, [0xffffff, 0xd9f5d0], 6, 0.5);
		}
	} else if (critters.length > want) {
		const c = critters.pop()!;
		layer.remove(c.obj);
	}
}

function updateCritters(dt: number): void {
	tendCritters(dt);
	const rings: [number, number][] = [];
	for (const [k, p] of S.pieces) if (p.t === 'mushroom') rings.push(unkey(k));
	for (const c of critters) {
		if (c.hop < 1) {
			c.hop = Math.min(1, c.hop + dt / 0.38);
			c.x = c.fromX + (c.toX - c.fromX) * c.hop;
			c.z = c.fromZ + (c.toZ - c.fromZ) * c.hop;
		} else {
			c.wait -= dt;
			if (c.wait <= 0) {
				c.wait = 0.6 + Math.random() * 3;
				const cx = Math.round(c.x);
				const cz = Math.round(c.z);
				let moves = [0, 1, 2, 3].map((d): [number, number] => [cx + DX[d], cz + DZ[d]]).filter(([x, z]) => freeGrass(x, z));
				// Critters drift toward a mushroom ring.
				if (rings.length && Math.random() < 0.7) {
					const dist = (x: number, z: number): number => Math.min(...rings.map(([rx, rz]) => Math.abs(rx - x) + Math.abs(rz - z)));
					const now = dist(cx, cz);
					const closer = moves.filter(([x, z]) => dist(x, z) < now);
					if (closer.length) moves = closer;
					else if (now <= 1) moves = [];
				}
				if (!freeGrass(cx, cz) || (moves.length && Math.random() < 0.75)) {
					const to = moves[Math.floor(Math.random() * moves.length)];
					if (to) startHop(c, to[0] + (Math.random() - 0.5) * 0.4, to[1] + (Math.random() - 0.5) * 0.4);
				} else startHop(c, c.x, c.z);
			}
		}
		const arc = Math.sin(c.hop * Math.PI) * 0.16;
		c.obj.position.set(c.x, groundY(c.x, c.z) + arc, c.z);
		c.obj.rotation.y = turnToward(c.obj.rotation.y, c.yaw, Math.min(1, dt * 10));
		c.obj.scale.set(1, 1 + arc * 1.5, 1);
	}
}

/* Each frame */

export function updateLife(dt: number): void {
	const t = env.time;
	const bedtime = env.night > 0.72 || env.rain > 0.5;

	for (const [k, left] of moveIn) {
		if (left - dt > 0) {
			moveIn.set(k, left - dt);
			continue;
		}
		moveIn.delete(k);
		const p = S.pieces.get(k);
		if (!p || p.t !== 'cottage' || p.h) continue;
		const index = S.names++;
		touch(k, { h: index + 1 });
		rebuildPiece(k, true);
		const v = addVillager(k, index);
		v.wait = 0.2;
		const [x, z] = unkey(k);
		burst(x, groundY(x, z) + 0.6, z, [0xffffff, 0xffd1e0, 0xfff1a8], 16, 1);
		lifeEvents.movedIn(v.name);
		saveSoon();
	}

	for (const v of villagers) {
		if (v.state === 'inside') {
			v.wait -= dt;
			if (v.wait > 0) continue;
			if (bedtime) {
				v.wait = 6;
				continue;
			}
			const door = doorCell(v.home);
			if (!door || !planTrip(v, door)) {
				v.wait = 5;
				continue;
			}
			[v.x, v.z] = door;
			v.state = 'walk';
			v.obj.visible = true;
			v.obj.scale.setScalar(0.01);
		} else if (v.wave > 0) {
			v.wave -= dt;
		} else if (v.state === 'walk') {
			const next = v.path[0];
			if (!next) {
				if (v.act === 'home') enterHome(v);
				else {
					v.state = 'stay';
					v.wait = 4 + Math.random() * 6;
					showEmote(v, EMOTE_OF[v.act]);
				}
				continue;
			}
			const dx = next[0] - v.x;
			const dz = next[1] - v.z;
			const dist = Math.hypot(dx, dz);
			const speed = (bedtime ? 1.1 : 0.62) * dt;
			if (dist <= speed) {
				v.x = next[0];
				v.z = next[1];
				v.path.shift();
			} else {
				v.x += (dx / dist) * speed;
				v.z += (dz / dist) * speed;
				v.yaw = Math.atan2(-dx, -dz);
			}
			v.step += dt * 11;
		} else {
			v.wait -= dt;
			if (v.look) v.yaw = Math.atan2(-(v.look[0] - v.x), -(v.look[1] - v.z));
			if (v.wait <= 0 || (bedtime && v.wait > 1)) {
				const here: [number, number] = [Math.round(v.x), Math.round(v.z)];
				if (!bedtime && Math.random() < 0.45 && planTrip(v, here)) v.state = 'walk';
				else goHome(v);
			}
		}

		// A branch above can send the villager inside.
		if ((v.state as string) === 'inside') continue;
		const walking = v.state === 'walk' && v.wave <= 0;
		const sitting = v.state === 'stay' && (v.act === 'sit' || v.act === 'rest');
		const s = Math.min(1, v.obj.scale.x + dt * 4);
		v.obj.scale.setScalar(s);
		v.obj.position.set(v.x, groundY(v.x, v.z) + (walking ? Math.abs(Math.sin(v.step)) * 0.035 : 0) - (sitting ? 0.03 : 0), v.z);
		v.obj.rotation.y = turnToward(v.obj.rotation.y, v.yaw, Math.min(1, dt * 8));
		v.obj.rotation.z = walking ? Math.sin(v.step) * 0.09 : 0;
		v.arm.rotation.z = v.wave > 0 ? -2.3 + Math.sin(t * 16) * 0.5 : walking ? Math.sin(v.step) * 0.4 : 0;
		if (v.emoteLeft > 0) {
			v.emoteLeft -= dt;
			v.emote.position.y = 0.72 + Math.sin(t * 4) * 0.02;
			v.emote.scale.setScalar(0.3 * Math.min(1, v.emoteLeft * 4, (2.4 - v.emoteLeft) * 6 + 0.3));
			if (v.emoteLeft <= 0) v.emote.visible = false;
		}
	}

	updateCritters(dt);

	// Trees grow. Water and rain help.
	for (const [k, p] of S.pieces) {
		if (p.t !== 'tree') continue;
		const g = p.g ?? 1;
		if (g < 1) {
			const speed = (isWet(k) ? 2.2 : 1) * (env.rain > 0.5 ? 1.8 : 1);
			const next = Math.min(1, g + (dt / TUNE.treeGrowTime) * speed);
			p.g = next;
			if ((g < 0.45 && next >= 0.45) || next >= 1) {
				rebuildPiece(k, true);
				const [x, z] = unkey(k);
				burst(x, groundY(x, z) + 0.5, z, [0xd9f5d0, 0xffffff], 8, 0.7);
				lifeEvents.treeGrew();
				saveSoon();
			}
		}
		const gNow = p.g ?? 1;
		scalePiece(k, gNow >= 1 ? 1 : gNow >= 0.45 ? 0.8 + ((gNow - 0.45) / 0.55) * 0.45 : 0.8 + (gNow / 0.45) * 1.1);
	}
}

/** For the debug tools: where the villagers are. */
export function lifeReport(): { villagers: { name: string; state: string; act: string; x: number; z: number }[]; critters: number } {
	return { villagers: villagers.map((v) => ({ name: v.name, state: v.state, act: v.act, x: v.x, z: v.z })), critters: critters.length };
}
