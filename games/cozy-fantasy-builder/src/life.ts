/** The living things: villagers, small critters and growing trees. */

import * as THREE from 'three';
import { JOB, PIECE, TUNE } from './content.ts';
import type { JobId } from './content.ts';
import { blockAt, chooseGoal, fest } from './brain.ts';
import type { Act, BlockKind, Goal } from './brain.ts';
import { assignJobs, folkOf, makeFolk } from './folk.ts';
import type { Folk } from './folk.ts';
import { burst } from './fx.ts';
import { Kit } from './models.ts';
import { env } from './sky.ts';
import { isLand, pieceAt, S, saveSoon, touch } from './state.ts';
import { DX, DZ, key, pick, rng, turnToward, unkey } from './util.ts';
import { groundY, isWet, rebuildPiece, scalePiece, world } from './view.ts';
import { canWalk, doorCell, pathTo, reachFrom } from './walk.ts';

export { canWalk } from './walk.ts';
export { fest } from './brain.ts';

type Emote = 'heart' | 'note' | 'zzz' | 'star' | 'bloom' | 'hi';

export interface Villager {
	/** The id of its record. */
	id: number;
	/** The job that its cap shows. */
	job: JobId;
	obj: THREE.Group;
	arm: THREE.Object3D;
	/** A bun that it carries to a picnic table on a festival night. */
	treat: THREE.Object3D;
	emote: THREE.Sprite;
	emoteLeft: number;
	x: number;
	z: number;
	yaw: number;
	/** `driven`: the player steers it. */
	state: 'inside' | 'walk' | 'stay' | 'driven';
	path: [number, number][];
	wait: number;
	act: Act;
	goal: Goal | null;
	/** The block of the day that the goal was picked in. */
	block: BlockKind;
	/** Where it looks while it stays. */
	look: [number, number] | null;
	wave: number;
	step: number;
	/** While the player steers it: the height of the ground where it walks. */
	ground?: (x: number, z: number) => number;
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

export const villagers: Villager[] = [];
const critters: Critter[] = [];
const moveIn = new Map<string, number>();
/** The group that holds every elf and critter on the islands. */
export const layer = new THREE.Group();
let critterTimer = 3;

/** Things that the shell wants to hear about. */
export const lifeEvents = {
	movedIn: (_name: string) => {},
	hello: () => {},
	treeGrew: () => {},
	/** Elves got or lost jobs. */
	jobsChanged: () => {},
};

export function initLife(): void {
	world.add(layer);
}

/* Looks */

const CLOAKS = [0x4fae78, 0x3f9f9a, 0xb86fa8, 0xd9a441, 0x8a6fc8, 0xc8664a, 0x5f8fd0, 0x6fa84a];
const HAIR = [0xf2e2b0, 0xe8a85a, 0xb86a3c, 0xd9d9e8, 0x7a5a44, 0xf2c2d0];
const SKIN = [0xfff0e0, 0xf2d2b4, 0xd9a98a, 0xffe6d6];

/** A small elf: a cloak, pointed ears and a leaf cap. */
export function makeVillager(seed: number, job: JobId): { obj: THREE.Group; arm: THREE.Object3D; treat: THREE.Object3D } {
	const rand = rng(seed + 1);
	const cloak = pick(CLOAKS, rand());
	const hair = pick(HAIR, rand());
	const skin = pick(SKIN, rand());
	// The cap shows the job. A free elf has a leaf cap.
	const leaf = pick([0x3f9a6a, 0x4fae78, 0x6fc487, 0xd9a441, 0xb86fa8], rand());
	const cap = job === 'none' ? leaf : JOB[job].color;
	const k = new Kit();
	k.cyl('solid', cloak, 0.055, 0.115, 0.2, 7, 0, 0.02, 0);
	k.ball('solid', skin, 0.085, 0, 0.275, 0);
	k.ball('solid', hair, 0.088, 0, 0.29, 0.02, { sy: 0.9 });
	// Long pointed ears.
	k.cyl('solid', skin, 0.003, 0.024, 0.11, 4, 0.115, 0.24, 0.005, { rz: -1.05 });
	k.cyl('solid', skin, 0.003, 0.024, 0.11, 4, -0.115, 0.24, 0.005, { rz: 1.05 });
	// A leaf cap with a curl at the tip.
	k.cyl('solid', cap, 0.01, 0.095, 0.16, 6, 0, 0.33, 0.01, { rx: 0.25 });
	k.ball('solid', cap, 0.022, 0, 0.49, 0.06);
	k.box('solid', 0x4a3a56, 0.018, 0.024, 0.01, -0.032, 0.275, -0.08);
	k.box('solid', 0x4a3a56, 0.018, 0.024, 0.01, 0.032, 0.275, -0.08);
	k.box('solid', 0xffa8b8, 0.02, 0.012, 0.01, -0.055, 0.253, -0.07);
	k.box('solid', 0xffa8b8, 0.02, 0.012, 0.01, 0.055, 0.253, -0.07);
	k.box('solid', 0x6e4f3a, 0.045, 0.03, 0.07, -0.04, 0, -0.01);
	k.box('solid', 0x6e4f3a, 0.045, 0.03, 0.07, 0.04, 0, -0.01);
	k.ball('solid', 0xffe7a3, 0.016, 0, 0.2, -0.062);
	k.ball('solid', cloak, 0.032, -0.105, 0.15, 0);
	const obj = k.build();
	const armKit = new Kit();
	armKit.ball('solid', cloak, 0.032, 0, 0.06, 0, { sy: 1.6 });
	const arm = armKit.build();
	arm.position.set(0.1, 0.12, 0);
	obj.add(arm);
	const treat = new Kit().ball('solid', 0xffc27a, 0.045, 0, 0, 0, { sy: 0.7 }).ball('solid', 0xfff4e2, 0.02, 0, 0.03, 0).build();
	treat.position.set(0, 0.17, -0.11);
	treat.visible = false;
	obj.add(treat);
	return { obj, arm, treat };
}

function makeCritter(seed: number): THREE.Group {
	const rand = rng(seed + 3);
	const fur = pick([0xe4f2cf, 0xf7e9dc, 0xdcebf7, 0xf7dcea, 0xd9c2a8], rand());
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

const EMOTE_OF: Record<Act, Emote> = { rest: 'heart', sit: 'note', gather: 'star', shop: 'heart', sniff: 'bloom', wish: 'star', gaze: 'note', feast: 'heart', read: 'note', stroll: 'note', home: 'zzz', dance: 'note', work: 'star', eat: 'heart' };

const folkOfBody = (v: Villager): Folk | undefined => S.folk.get(v.id);

/** Sets out for the next goal. Returns false when there is nowhere to go. */
function planTrip(v: Villager, from: [number, number]): boolean {
	const f = folkOfBody(v);
	if (!f) return false;
	const plan = chooseGoal(f, from);
	v.block = blockAt(f).kind;
	if (!plan) return false;
	v.goal = plan.goal;
	v.path = plan.path;
	v.act = plan.goal.act;
	v.look = plan.goal.look;
	return true;
}

function goHome(v: Villager, label = 'Going home'): void {
	const f = folkOfBody(v);
	const door = f?.home ? doorCell(f.home) : null;
	const here: [number, number] = [Math.round(v.x), Math.round(v.z)];
	v.act = 'home';
	v.look = null;
	v.goal = { act: 'home', cell: door ? key(door[0], door[1]) : '', look: null, label, place: 'Home', stay: 10 };
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
	v.wait = v.goal?.act === 'home' ? v.goal.stay : 5 + Math.random() * 8;
	v.path = [];
	v.act = 'home';
	const f = folkOfBody(v);
	if (f) v.block = blockAt(f).kind;
}

function poof(v: Villager): void {
	burst(v.x, groundY(v.x, v.z) + 0.2, v.z, [0xffffff, 0xffe9f2], 8, 0.6);
}

function addVillager(f: Folk): Villager {
	const [x, z] = unkey(f.home ?? '0,0');
	const { obj, arm, treat } = makeVillager(f.seed, f.job);
	const emote = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTexture('heart'), transparent: true, depthWrite: false, fog: false }));
	emote.scale.setScalar(0.3);
	emote.position.y = 0.72;
	emote.visible = false;
	obj.add(emote);
	obj.visible = false;
	layer.add(obj);
	const v: Villager = { id: f.id, job: f.job, obj, arm, treat, emote, emoteLeft: 0, x, z, yaw: 0, state: 'inside', path: [], wait: 1 + Math.random() * 3, act: 'home', goal: null, block: 'sleep', look: null, wave: 0, step: Math.random() * 6 };
	villagers.push(v);
	return v;
}

/** Builds the body again, for an elf with a new job: the cap changes colour. */
function redress(v: Villager, f: Folk): void {
	const { obj, arm, treat } = makeVillager(f.seed, f.job);
	obj.add(v.emote);
	obj.visible = v.obj.visible;
	obj.position.copy(v.obj.position);
	obj.rotation.copy(v.obj.rotation);
	obj.scale.copy(v.obj.scale);
	layer.remove(v.obj);
	layer.add(obj);
	v.obj = obj;
	v.arm = arm;
	v.treat = treat;
	v.job = f.job;
}

function removeVillager(v: Villager): void {
	if (v.obj.visible) poof(v);
	layer.remove(v.obj);
	villagers.splice(villagers.indexOf(v), 1);
}

/** Brings villagers, jobs, move-in timers and critters in step with the pieces. */
export function syncLife(placed: string | null): void {
	const living = new Set<number>();
	for (const [k, p] of S.pieces) {
		if (!PIECE[p.t].home) continue;
		for (const f of folkOf(k)) {
			f.home = k;
			living.add(f.id);
		}
		if ((p.who?.length ?? 0) < (PIECE[p.t].beds ?? 1)) {
			if (!moveIn.has(k)) moveIn.set(k, TUNE.moveInDelay + Math.random() * 2);
		} else moveIn.delete(k);
	}
	for (const v of [...villagers]) if (!living.has(v.id)) removeVillager(v);
	for (const id of living) if (!villagers.some((v) => v.id === id)) addVillager(S.folk.get(id)!);
	for (const k of [...moveIn.keys()]) if (!PIECE[S.pieces.get(k)?.t ?? 'path'].home) moveIn.delete(k);
	refreshJobs();

	// A walker whose cell or way is now blocked finds a new plan.
	for (const v of villagers) {
		if (v.state === 'inside' || v.state === 'driven') continue;
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
			if (v.state === 'inside' || v.state === 'driven' || Math.hypot(v.x - px, v.z - pz) > 4.5) continue;
			v.wave = 1.8;
			v.look = [px, pz];
			showEmote(v, Math.random() < 0.5 ? 'heart' : 'hi', 1.8);
			any = true;
		}
		if (any) lifeEvents.hello();
		for (const c of critters) if (Math.hypot(c.x - px, c.z - pz) < 2.5 && c.hop >= 1) startHop(c, c.x, c.z);
	}
}

/** Gives out jobs again, and dresses the elves whose job changed. */
export function refreshJobs(): void {
	const changed = assignJobs();
	for (const v of villagers) {
		const f = folkOfBody(v);
		if (f && f.job !== v.job) {
			redress(v, f);
			// The elf thinks again about its day.
			if (v.state === 'stay') v.wait = Math.min(v.wait, 0.5);
		}
	}
	if (changed) {
		saveSoon();
		lifeEvents.jobsChanged();
	}
}

/** An elf waves. The elves near it wave back. Returns how many did. */
export function greet(id: number): number {
	const me = bodyOf(id);
	if (!me) return 0;
	me.wave = 1.4;
	showEmote(me, 'hi', 1.6);
	let n = 0;
	for (const v of villagers) {
		if (v === me || v.state === 'inside' || v.state === 'driven' || Math.hypot(v.x - me.x, v.z - me.z) > 3) continue;
		v.wave = 1.6;
		v.look = [me.x, me.z];
		v.yaw = Math.atan2(-(me.x - v.x), -(me.z - v.z));
		showEmote(v, Math.random() < 0.5 ? 'hi' : 'heart', 1.8);
		n++;
	}
	return n;
}

/** The festival begins: the elves at home wake up and come out soon. */
export function wakeElves(): void {
	for (const v of villagers) {
		if (v.state === 'inside') v.wait = Math.min(v.wait, 0.5 + Math.random() * 6);
		else if (v.state === 'stay') v.wait = Math.min(v.wait, Math.random() * 3);
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

/* Looking at villagers */

export const bodyOf = (id: number): Villager | undefined => villagers.find((v) => v.id === id);

const _sphere = new THREE.Sphere();

/** The villager nearest to a line from the eye, within a reach that grows with distance. */
export function villagerOnRay(ray: THREE.Ray, slack = 0.25): number | null {
	let best: number | null = null;
	let bestD = Infinity;
	for (const v of villagers) {
		if (!v.obj.visible) continue;
		_sphere.center.set(v.x, v.obj.position.y + 0.25, v.z);
		const along = ray.origin.distanceTo(_sphere.center);
		_sphere.radius = 0.24 + along * slack * 0.016;
		if (!ray.intersectsSphere(_sphere)) continue;
		const d = ray.distanceSqToPoint(_sphere.center);
		if (d < bestD) {
			bestD = d;
			best = v.id;
		}
	}
	return best;
}

/** The way that a villager still has to walk, from where it is now. */
export function routeOf(id: number): [number, number][] {
	const v = bodyOf(id);
	if (!v || v.state !== 'walk') return [];
	return [[v.x, v.z], ...v.path];
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

	for (const [k, left] of moveIn) {
		if (left - dt > 0) {
			moveIn.set(k, left - dt);
			continue;
		}
		moveIn.delete(k);
		const p = S.pieces.get(k);
		const beds = p ? (PIECE[p.t].beds ?? 0) : 0;
		if (!p || (p.who?.length ?? 0) >= beds) continue;
		const f = makeFolk(k);
		const wasEmpty = !p.who?.length;
		touch(k, { who: [...(p.who ?? []), f.id] });
		if (wasEmpty) rebuildPiece(k, true);
		const v = addVillager(f);
		v.wait = 0.2;
		const [x, z] = unkey(k);
		burst(x, groundY(x, z) + 0.6, z, [0xffffff, 0xffd1e0, 0xfff1a8], 16, 1);
		lifeEvents.movedIn(f.name);
		refreshJobs();
		if (p.who && p.who.length < beds) moveIn.set(k, TUNE.moveInDelay * 2 + Math.random() * 3);
		saveSoon();
	}

	for (const v of villagers) {
		const f = folkOfBody(v);
		if (!f) continue;
		if (v.state === 'driven') {
			if (v.wave > 0) v.wave -= dt;
			animate(v, dt, t);
			continue;
		}
		const block = blockAt(f).kind;
		const asleep = block === 'sleep';
		if (v.state === 'inside') {
			v.wait -= dt;
			// A new block of the day: think again soon.
			if (block !== v.block && !asleep) v.wait = Math.min(v.wait, Math.random() * 2);
			if (v.wait > 0) continue;
			if (asleep) {
				v.block = block;
				v.wait = 6;
				continue;
			}
			const door = f.home ? doorCell(f.home) : null;
			if (!door || !planTrip(v, door)) {
				v.wait = 5;
				continue;
			}
			if (v.act === 'home') {
				// It stays in, for lunch or a rest.
				v.wait = v.goal?.stay ?? 8;
				v.path = [];
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
					v.wait = v.goal?.stay ?? 5;
					showEmote(v, EMOTE_OF[v.act]);
					// Elves at the same spot stand a little apart.
					if (v.act !== 'dance') {
						const nx = v.x + (Math.random() - 0.5) * 0.36;
						const nz = v.z + (Math.random() - 0.5) * 0.36;
						if (canWalk(Math.round(nx), Math.round(nz))) {
							v.x = nx;
							v.z = nz;
						}
					}
				}
				continue;
			}
			const dx = next[0] - v.x;
			const dz = next[1] - v.z;
			const dist = Math.hypot(dx, dz);
			const speed = (asleep ? 1.1 : fest.on ? 0.85 : 0.62) * dt;
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
			const dances = v.act === 'dance' && fest.on;
			if (dances) {
				// The dance lasts as long as the festival. With room, the elves go round the tree.
				v.step += dt * 9;
				if (fest.ring) {
					const a = Math.atan2(v.z - fest.z, v.x - fest.x) + dt * 0.4;
					const r = Math.hypot(v.x - fest.x, v.z - fest.z);
					const rr = r + (1.15 - r) * Math.min(1, dt * 2);
					v.x = fest.x + Math.cos(a) * rr;
					v.z = fest.z + Math.sin(a) * rr;
				}
				if (Math.random() < dt * 0.18) showEmote(v, pick(['note', 'heart', 'star', 'note'] as const, Math.random()), 1.6);
			} else {
				v.wait -= dt;
				if (v.act === 'work') v.step += dt * 6;
				// A worker shows now and then that it is busy.
				if (v.act === 'work' && Math.random() < dt * 0.08) showEmote(v, 'star', 1.4);
			}
			if (v.look) v.yaw = Math.atan2(-(v.look[0] - v.x), -(v.look[1] - v.z));
			// The day moves on to a new block: leave soon.
			if (!dances && block !== v.block) v.wait = Math.min(v.wait, 0.8);
			if (!dances && v.wait <= 0) {
				const here: [number, number] = [Math.round(v.x), Math.round(v.z)];
				if (asleep) goHome(v, 'Going to bed');
				else if (planTrip(v, here)) {
					if (v.act === 'home') goHome(v, v.goal?.label);
					else v.state = 'walk';
				} else goHome(v);
			}
		}
		if ((v.state as string) === 'inside') continue;
		animate(v, dt, t);
	}

	updateCritters(dt);

	// Trees grow. Water helps.
	for (const [k, p] of S.pieces) {
		if (p.t !== 'tree') continue;
		const g = p.g ?? 1;
		if (g < 1) {
			const speed = isWet(k) ? 2.2 : 1;
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

/** Puts the body where the villager is, and moves its legs and arm. */
function animate(v: Villager, dt: number, t: number): void {
	const driven = v.state === 'driven';
	const walking = (v.state === 'walk' && v.wave <= 0) || (driven && v.act === 'stroll');
	const sitting = v.state === 'stay' && (v.act === 'sit' || v.act === 'rest' || v.act === 'feast' || v.act === 'eat' || v.act === 'read');
	const dancing = v.state === 'stay' && v.act === 'dance' && fest.on && v.wave <= 0;
	const working = v.state === 'stay' && v.act === 'work';
	v.treat.visible = (fest.on && v.act === 'feast') || (v.state === 'stay' && v.act === 'eat');
	if (!driven) v.obj.scale.setScalar(Math.min(1, v.obj.scale.x + dt * 4));
	const s = driven ? v.obj.scale.x : 1;
	const gy = driven && v.ground ? v.ground(v.x, v.z) : groundY(v.x, v.z);
	v.obj.position.set(v.x, gy + s * ((walking ? Math.abs(Math.sin(v.step)) * 0.035 : dancing ? Math.abs(Math.sin(v.step * 0.5)) * 0.1 : 0) - (sitting ? 0.03 : 0)), v.z);
	v.obj.rotation.y = driven ? v.yaw : turnToward(v.obj.rotation.y, v.yaw, Math.min(1, dt * 8));
	v.obj.rotation.z = walking ? Math.sin(v.step) * 0.09 : dancing ? Math.sin(v.step * 0.5) * 0.14 : 0;
	v.arm.rotation.z = v.wave > 0 ? -2.3 + Math.sin(t * 16) * 0.5 : dancing ? -2.1 + Math.sin(v.step) * 0.5 : working ? -1.2 + Math.sin(v.step) * 0.6 : walking ? Math.sin(v.step) * 0.4 : 0;
	if (v.emoteLeft > 0) {
		v.emoteLeft -= dt;
		v.emote.position.y = 0.72 + Math.sin(t * 4) * 0.02;
		v.emote.scale.setScalar(0.3 * Math.min(1, v.emoteLeft * 4, (2.4 - v.emoteLeft) * 6 + 0.3));
		if (v.emoteLeft <= 0) v.emote.visible = false;
	}
}

/** For the debug tools: where the villagers are. */
export function lifeReport(): { villagers: { name: string; job: string; state: string; act: string; doing: string; x: number; z: number }[]; critters: number } {
	return {
		villagers: villagers.map((v) => {
			const f = folkOfBody(v)!;
			return { name: f.name, job: f.job, state: v.state, act: v.act, doing: v.goal?.label ?? '', x: v.x, z: v.z };
		}),
		critters: critters.length,
	};
}
