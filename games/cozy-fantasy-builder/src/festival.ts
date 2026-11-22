/** The night festival: lights from the town tree, a ring dance, treats, and lantern boats on the rivers. */

import * as THREE from 'three';
import { PIECE, TUNE } from './content.ts';
import type { PieceId } from './content.ts';
import { whaleShow } from './creatures.ts';
import { burst, dropGlow, fxBudget, makeGlow, spark } from './fx.ts';
import { canWalk, fest, wakeElves } from './life.ts';
import { disposeModel, Kit, TOWN_TREE_TOP } from './models.ts';
import { airSides, isRiver, pieceAt, S, saveSoon } from './state.ts';
import { DX, DZ, turnToward, unkey } from './util.ts';
import { groundY, islandGroup, world } from './view.ts';

/** Things that the shell wants to hear about. */
export const festEvents = {
	/** `first` is true for the first festival of these islands. */
	began: (_x: number, _z: number, _first: boolean) => {},
	/** `whole` is false when the town tree was removed before the end. */
	ended: (_whole: boolean) => {},
	/** A town tree stands, and the festival comes tonight. */
	planned: () => {},
	pop: () => {},
};

/** How high a string of lights hangs on each piece. Pieces that are not here get no string. */
const HANG: Partial<Record<PieceId, number>> = { cottage: 1.0, shroomhouse: 0.8, stonehut: 0.78, nest: 1.32, market: 0.76, bakery: 0.66, teahouse: 0.9, timberhouse: 0.9, towerhouse: 1.2, workshop: 0.6, library: 0.8, lantern: 0.56, well: 0.76, board: 0.6, tower: 1.3, swing: 0.78, windmill: 0.86 };
const BULBS = [0xffd27a, 0xff9fc0, 0x9fe0ff, 0xc9a8ff, 0xb9ffb0, 0xfff1c4];
const MAX_STRINGS = 14;
const MAX_BOATS = 7;

interface Boat {
	obj: THREE.Group;
	glow: THREE.Sprite;
	x: number;
	z: number;
	from: [number, number];
	to: [number, number];
	/** Progress from one cell to the next, 0..1. */
	t: number;
	/** 0 while it sails. Above 0 it leaves: it sinks away, or it falls off the edge. */
	leave: number;
	falls: boolean;
	drop: number;
	phase: number;
}

/** The cell of the town tree that hosts the festival. */
let host = '';
let strings: THREE.Group | null = null;
let stringGlows: THREE.Sprite[] = [];
/** Where the bulbs are, for the twinkles. */
let bulbs: number[] = [];
/** Shops near the tree. Warm sparks rise from them. */
let stalls: [number, number][] = [];
let stale = false;
let lastClock = -1;
/** No second festival in the same night. */
let doneTonight = false;
let popTimer = 2;
let boatTimer = 1;
const boats: Boat[] = [];
const boatLayer = new THREE.Group();
const cordMat = new THREE.LineBasicMaterial({ color: 0x5a4636 });

function findTree(): string | null {
	for (const [k, p] of S.pieces) if (p.t === 'towntree') return k;
	return null;
}

/* The strings of lights */

function dropStrings(): void {
	if (!strings) return;
	strings.parent?.remove(strings);
	for (const g of stringGlows) dropGlow(g);
	strings.traverse((o) => {
		if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
	});
	strings = null;
	stringGlows = [];
	bulbs = [];
}

function buildStrings(): void {
	dropStrings();
	const [tx, tz] = unkey(host);
	const targets: { x: number; z: number; h: number; dist: number }[] = [];
	stalls = [];
	for (const [k, p] of S.pieces) {
		const [x, z] = unkey(k);
		const dist = Math.hypot(x - tx, z - tz);
		if (dist > TUNE.festReach || dist < 1) continue;
		if (PIECE[p.t].visit === 'shop') stalls.push([x, z]);
		const h = HANG[p.t];
		if (h !== undefined) targets.push({ x, z, h, dist });
	}
	targets.sort((a, b) => a.dist - b.dist);
	const kit = new Kit();
	const cord: number[] = [];
	const group = new THREE.Group();
	targets.slice(0, MAX_STRINGS).forEach((target, j) => {
		const n = Math.max(4, Math.round(target.dist * 2.4));
		const sag = Math.min(0.8, 0.1 * target.dist);
		let last: [number, number, number] | null = null;
		for (let i = 0; i <= n; i++) {
			const t = i / n;
			const x = tx + (target.x - tx) * t;
			const z = tz + (target.z - tz) * t;
			const y = Math.max(0.5, TOWN_TREE_TOP + (target.h - TOWN_TREE_TOP) * t - sag * 4 * t * (1 - t));
			if (last) cord.push(...last, x, y, z);
			last = [x, y, z];
			if (i === 0 || i === n) continue;
			kit.ball('lamp', BULBS[(i + j) % BULBS.length], 0.042, x, y - 0.04, z);
			bulbs.push(x, y - 0.04, z);
			if (i === Math.round(n / 2) && j % 2 === 0) {
				const glow = makeGlow(BULBS[j % BULBS.length], 1.7);
				glow.position.set(x, y, z);
				stringGlows.push(glow);
				group.add(glow);
			}
		}
	});
	if (bulbs.length) {
		group.add(kit.build(false));
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(cord, 3));
		group.add(new THREE.LineSegments(geo, cordMat));
	}
	// The strings ride on the island of the tree, so they bob with it.
	(islandGroup(S.land.get(host) ?? 0) ?? world).add(group);
	strings = group;
}

/* The lantern boats */

function makeBoat(): THREE.Group {
	const k = new Kit();
	k.ball('solid', 0x4fae78, 0.11, 0, 0.02, 0, { sy: 0.3, sz: 1.7 });
	k.ball('solid', 0x7fcf8f, 0.085, 0, 0.04, 0, { sy: 0.25, sz: 1.6 });
	k.ball('lamp', BULBS[Math.floor(Math.random() * 3)], 0.05, 0, 0.11, 0, { sy: 1.2 });
	return k.build(false);
}

const riverAt = (x: number, z: number): boolean => isRiver(pieceAt(x, z)?.t);

function launchBoat(): void {
	const cells: [number, number][] = [];
	for (const [k, p] of S.pieces) {
		if (!isRiver(p.t)) continue;
		const [x, z] = unkey(k);
		if (Math.hypot(x - fest.x, z - fest.z) > TUNE.festReach + 5) continue;
		const sides = [0, 1, 2, 3].filter((d) => riverAt(x + DX[d], z + DZ[d])).length;
		// A river end is the best place to start. A pool that stands alone has no room to sail.
		if (sides === 1) cells.push([x, z], [x, z], [x, z]);
		else if (sides > 1) cells.push([x, z]);
	}
	if (!cells.length) return;
	const [x, z] = cells[Math.floor(Math.random() * cells.length)];
	const obj = makeBoat();
	const glow = makeGlow(0xffd27a, 0.9);
	glow.position.y = 0.12;
	obj.add(glow);
	obj.scale.setScalar(0.01);
	boatLayer.add(obj);
	boats.push({ obj, glow, x, z, from: [x, z], to: [x, z], t: 1, leave: 0, falls: false, drop: 0, phase: Math.random() * 6 });
}

function removeBoat(b: Boat): void {
	boatLayer.remove(b.obj);
	dropGlow(b.glow);
	disposeModel(b.obj);
	boats.splice(boats.indexOf(b), 1);
}

function updateBoats(dt: number, time: number): void {
	for (const b of [...boats]) {
		if (b.leave > 0) {
			b.leave += dt;
			if (b.falls) {
				// Over the edge and down into the clouds.
				const d = Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1]) || 1;
				b.x += ((b.to[0] - b.from[0]) / d) * dt * 0.5;
				b.z += ((b.to[1] - b.from[1]) / d) * dt * 0.5;
				if (b.leave > 0.9) b.drop += dt * (b.leave - 0.9) * 5;
			}
			const s = Math.max(0, 1 - b.leave / (b.falls ? 3.2 : 1));
			b.obj.scale.setScalar(Math.min(1, s * 1.6));
			if (s <= 0) {
				removeBoat(b);
				continue;
			}
		} else {
			b.t += dt * 0.42;
			if (b.t >= 1) {
				const [x, z] = b.to;
				if (!riverAt(x, z)) b.leave = 0.01;
				else {
					const next = [0, 1, 2, 3].map((d): [number, number] => [x + DX[d], z + DZ[d]]).filter(([nx, nz]) => riverAt(nx, nz) && !(nx === b.from[0] && nz === b.from[1]));
					if (next.length && fest.on) {
						b.from = [x, z];
						b.to = next[Math.floor(Math.random() * next.length)];
						b.t = 0;
					} else {
						// The end of the river. At an island edge the boat sails out into the sky.
						const out = airSides(x, z).filter((d) => !pieceAt(x + DX[d], z + DZ[d]) && !(x + DX[d] === b.from[0] && z + DZ[d] === b.from[1]));
						b.leave = 0.01;
						b.falls = out.length > 0;
						b.from = [x, z];
						if (b.falls) b.to = [x + DX[out[0]], z + DZ[out[0]]];
					}
				}
			}
			if (b.leave === 0) {
				b.x = b.from[0] + (b.to[0] - b.from[0]) * b.t;
				b.z = b.from[1] + (b.to[1] - b.from[1]) * b.t;
				b.obj.scale.setScalar(Math.min(1, b.obj.scale.x + dt * 2));
			}
		}
		const dx = b.to[0] - b.from[0];
		const dz = b.to[1] - b.from[1];
		if (dx || dz) b.obj.rotation.y = turnToward(b.obj.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 4));
		b.obj.position.set(b.x, groundY(b.from[0], b.from[1]) + 0.05 + Math.sin(time * 2 + b.phase) * 0.012 - b.drop, b.z);
		b.obj.rotation.z = Math.sin(time * 1.6 + b.phase) * 0.08;
	}
}

/* Start and end */

function begin(k: string): void {
	const [x, z] = unkey(k);
	host = k;
	fest.on = true;
	fest.x = x;
	fest.z = z;
	stale = true;
	popTimer = 2.5;
	boatTimer = 3;
	whaleShow.on = true;
	whaleShow.x = x;
	whaleShow.z = z;
	wakeElves();
	burst(x, groundY(x, z) + 2.2, z, BULBS, 60, 2.2);
	festEvents.began(x, z, S.festivals === 0);
}

function end(whole: boolean): void {
	fest.on = false;
	whaleShow.on = false;
	doneTonight = true;
	dropStrings();
	if (whole) {
		S.festivals++;
		S.festDue = TUNE.festRest;
		saveSoon();
	}
	festEvents.ended(whole);
}

export function initFestival(): void {
	world.add(boatLayer);
}

/** The pieces changed. A new town tree plans a festival, and the lights follow the new town. */
export function syncFestival(placed: string | null): void {
	if (fest.on) {
		if (S.pieces.get(host)?.t !== 'towntree') end(false);
		else stale = true;
		return;
	}
	const inNight = S.clock >= TUNE.festStart && S.clock < TUNE.festEnd - 0.05;
	if (placed && S.pieces.get(placed)?.t === 'towntree' && S.festDue <= 0 && !inNight && !doneTonight) festEvents.planned();
}

/** Starts a festival now, for the debug tools. It lasts until the morning. */
export function forceFestival(): boolean {
	const k = findTree();
	if (!k || fest.on) return false;
	begin(k);
	return true;
}

/** Ends everything at once, for a new game. */
export function resetFestival(): void {
	if (fest.on) {
		fest.on = false;
		whaleShow.on = false;
		dropStrings();
		festEvents.ended(false);
	}
	for (const b of [...boats]) removeBoat(b);
	doneTonight = false;
	lastClock = -1;
}

export function updateFestival(dt: number, time: number): void {
	const c = S.clock;
	const dusk = lastClock >= 0 && lastClock < TUNE.festStart && c >= TUNE.festStart;
	if (c < TUNE.festStart) doneTonight = false;
	lastClock = c;
	const inNight = c >= TUNE.festStart && c < TUNE.festEnd;

	if (!fest.on) {
		const k = findTree();
		// A night of rest between two festivals.
		if (dusk && k && S.festDue > 0) {
			S.festDue--;
			doneTonight = true;
			saveSoon();
		} else if (k && inNight && c < TUNE.festEnd - 0.05 && !doneTonight && S.festDue <= 0) begin(k);
	} else if (!inNight) end(true);

	if (fest.on) {
		fest.ring = [-1, 0, 1].every((dx) => [-1, 0, 1].every((dz) => (!dx && !dz) || canWalk(fest.x + dx, fest.z + dz)));
		if (stale) {
			stale = false;
			buildStrings();
		}
		const y = groundY(fest.x, fest.z);
		const amount = fxBudget.amount;

		// The bulbs twinkle.
		if (bulbs.length && Math.random() < dt * 16 * amount) {
			const i = Math.floor(Math.random() * (bulbs.length / 3)) * 3;
			spark({ x: bulbs[i], y: y + bulbs[i + 1], z: bulbs[i + 2], vy: 0.05, life: 0.5 + Math.random() * 0.4, size: 0.1 + Math.random() * 0.06, color: BULBS[Math.floor(Math.random() * BULBS.length)], alpha: 0.9 });
		}
		// Blossoms fall from the town tree.
		if (Math.random() < dt * 5 * amount) {
			const a = Math.random() * Math.PI * 2;
			const r = Math.random() * 1.3;
			spark({ x: fest.x + Math.cos(a) * r, y: y + 1.6 + Math.random() * 0.8, z: fest.z + Math.sin(a) * r, vx: 0.1, vy: -0.22, life: 4, size: 0.07, color: Math.random() < 0.5 ? 0xffd1e0 : 0xfff0f5, sway: 0.4 });
		}
		// Warm sparks rise from the shops.
		for (const [sx, sz] of stalls) {
			if (Math.random() > dt * 3 * amount) continue;
			spark({ x: sx + (Math.random() - 0.5) * 0.5, y: y + 0.5, z: sz + (Math.random() - 0.5) * 0.5, vy: 0.35 + Math.random() * 0.3, life: 1.8 + Math.random(), size: 0.06, color: Math.random() < 0.5 ? 0xffd58a : 0xffb98a, sway: 0.2 });
		}
		// Star puffs pop high over the tree.
		popTimer -= dt;
		if (popTimer <= 0) {
			popTimer = 1.6 + Math.random() * 2.6;
			const tone = BULBS[Math.floor(Math.random() * BULBS.length)];
			burst(fest.x + (Math.random() - 0.5) * 7, y + 4 + Math.random() * 2.5, fest.z + (Math.random() - 0.5) * 7, [tone, 0xffffff, tone], 34, 1.7);
			festEvents.pop();
		}
		boatTimer -= dt;
		if (boatTimer <= 0) {
			boatTimer = 2.2 + Math.random() * 2;
			if (boats.length < Math.ceil(MAX_BOATS * amount)) launchBoat();
		}
	}
	updateBoats(dt, time);
}
