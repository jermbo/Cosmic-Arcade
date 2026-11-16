/**
 * The inside of a home: rooms on one to three floors, the things in them, and the view to
 * decorate them. One tile is one unit. Elves are drawn bigger in here, so the rooms feel roomy.
 */

import * as THREE from 'three';
import { PIECE } from './content.ts';
import type { PieceId } from './content.ts';
import { blockAt } from './brain.ts';
import { folkOf } from './folk.ts';
import type { Folk } from './folk.ts';
import { buildFurniture, CATS, footprint, FURN, FURNITURE } from './furniture.ts';
import type { FurnCat, FurnDef } from './furniture.ts';
import { camera, setDriver } from './input.ts';
import type { Driver } from './input.ts';
import { bodyOf, makeVillager } from './life.ts';
import { Kit } from './models.ts';
import { env } from './sky.ts';
import { S, saveSoon, touch } from './state.ts';
import type { DecorItem } from './state.ts';
import { clamp, hash2, rng } from './util.ts';
import { drive } from './drive.ts';
import type { Space } from './drive.ts';

export const ELF_SCALE = 2.4;
const WALL_H = 2.6;
const WALL_T = 0.16;

export const roomScene = new THREE.Scene();

/** What the shell does for the interior. */
export const roomActions = {
	/** The player closed the room. */
	closed: () => {},
	/** The player wants to walk in as an elf of the home. */
	walkIn: (_id: number) => {},
	/** The walking elf steps out of the door. */
	goOutside: () => {},
	click: () => {},
	place: () => {},
	remove: () => {},
	toast: (_text: string, _sub: string) => {},
};

export const room = {
	open: false,
	home: '',
	level: 0,
	mode: 'decor' as 'decor' | 'walk',
};

interface Layout {
	w: number;
	d: number;
	floors: number;
	wall: number;
	floor: number;
	trim: number;
	beams: boolean;
}

const LAYOUTS: Partial<Record<PieceId, Omit<Layout, 'floors'>>> = {
	stonehut: { w: 5, d: 5, wall: 0xdedbe6, floor: 0xb08a64, trim: 0x8d8aa0, beams: false },
	shroomhouse: { w: 5, d: 5, wall: 0xfff0e0, floor: 0xc49a6c, trim: 0xe86f86, beams: false },
	cottage: { w: 6, d: 5, wall: 0xe8cfa8, floor: 0xa67c5b, trim: 0x6e4f3a, beams: true },
	nest: { w: 5, d: 5, wall: 0xf2dcb8, floor: 0xc49a6c, trim: 0x8a6248, beams: true },
	timberhouse: { w: 7, d: 6, wall: 0xfff4e2, floor: 0xb08a64, trim: 0x6e4f3a, beams: true },
	towerhouse: { w: 5, d: 5, wall: 0xf2e6d8, floor: 0xa67c5b, trim: 0x8d8aa0, beams: false },
};

function layoutOf(t: PieceId): Layout {
	const base = LAYOUTS[t] ?? { w: 5, d: 5, wall: 0xfff4e2, floor: 0xb08a64, trim: 0x6e4f3a, beams: false };
	return { ...base, floors: PIECE[t].floors ?? 1 };
}

let L: Layout = layoutOf('stonehut');

/* Tiles */

const tx = (x: number): number => x - (L.w - 1) / 2;
const tz = (z: number): number => z - (L.d - 1) / 2;
const tileOf = (wx: number, wz: number): [number, number] => [Math.round(wx + (L.w - 1) / 2), Math.round(wz + (L.d - 1) / 2)];
const inRoom = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < L.w && z < L.d;
const doorX = (): number => Math.floor(L.w / 2);

/** The column of the stairs that go up from a floor: right on even floors, left on odd ones. */
const upCol = (level: number): number => (level % 2 === 0 ? L.w - 1 : 0);
const hasUp = (level: number): boolean => level < L.floors - 1;
const hasDown = (level: number): boolean => level > 0;

/** Tiles that must stay free: the door and the stairs. */
function reserved(level: number): Set<string> {
	const out = new Set<string>();
	if (level === 0) out.add(`${doorX()},${L.d - 1}`);
	if (hasUp(level)) for (const z of [0, 1]) out.add(`${upCol(level)},${z}`);
	if (hasDown(level)) for (const z of [0, 1]) out.add(`${upCol(level - 1)},${z}`);
	return out;
}

/** Wall spots with a window or the door, where nothing hangs. Side: 0 back, 1 right, 2 front, 3 left. */
function windowSpots(level: number): Set<string> {
	const out = new Set<string>();
	out.add(`3:${Math.floor(L.d / 2)}`);
	out.add(`1:${Math.floor(L.d / 2)}`);
	if (level === 0) out.add(`2:${doorX()}`);
	else out.add(`2:${doorX()}`);
	return out;
}

/** The wall side that a tile touches, nearest to a point. */
function wallSide(x: number, z: number, px: number, pz: number): number | null {
	const sides: [number, number][] = [];
	if (z === 0) sides.push([0, Math.abs(pz - (tz(0) - 0.5))]);
	if (x === L.w - 1) sides.push([1, Math.abs(px - (tx(L.w - 1) + 0.5))]);
	if (z === L.d - 1) sides.push([2, Math.abs(pz - (tz(L.d - 1) + 0.5))]);
	if (x === 0) sides.push([3, Math.abs(px - (tx(0) - 0.5))]);
	if (!sides.length) return null;
	sides.sort((a, b) => a[1] - b[1]);
	return sides[0][0];
}

/* Decor data */

function decorOf(level: number): DecorItem[] {
	return S.pieces.get(room.home)?.decor?.[level] ?? [];
}

function setDecor(level: number, items: DecorItem[]): void {
	const p = S.pieces.get(room.home);
	if (!p) return;
	const all = [...(p.decor ?? [])];
	while (all.length <= level) all.push([]);
	all[level] = items;
	touch(room.home, { decor: all });
	saveSoon();
}

function tilesOf(def: FurnDef, x: number, z: number, r: number): [number, number][] {
	const [fw, fd] = def.place === 'wall' ? [1, 1] : footprint(def, r);
	const out: [number, number][] = [];
	for (let i = 0; i < fw; i++) for (let j = 0; j < fd; j++) out.push([x + i, z + j]);
	return out;
}

/** Why a thing cannot go here, or null when it can. `skip` is an item to leave out, when one moves. */
function problem(level: number, def: FurnDef, x: number, z: number, r: number, skip = -1): string | null {
	const tiles = tilesOf(def, x, z, r);
	if (tiles.some(([a, b]) => !inRoom(a, b))) return 'It does not fit here.';
	const items = decorOf(level).filter((_, i) => i !== skip);
	const busy = reserved(level);
	if (def.place === 'wall') {
		if (wallSide(x, z, tx(x), tz(z)) === null || !onSide(x, z, r)) return 'Hang it on a wall.';
		if (windowSpots(level).has(`${r}:${r % 2 ? z : x}`)) return 'A window or door is there.';
		if (items.some((o) => FURN[o.f].place === 'wall' && o.x === x && o.z === z && o.r === r)) return 'Something hangs there already.';
		return null;
	}
	if (tiles.some(([a, b]) => busy.has(`${a},${b}`))) return 'Keep the door and the stairs free.';
	const covers = (o: DecorItem, place: string): boolean => FURN[o.f].place === place && tilesOf(FURN[o.f], o.x, o.z, o.r).some(([a, b]) => tiles.some(([c, d]) => a === c && b === d));
	if (def.place === 'floor' && items.some((o) => covers(o, 'floor'))) return 'Something stands there already.';
	if (def.place === 'floor' && !def.surface && items.some((o) => covers(o, 'top'))) return 'Move the small things there first.';
	if (def.place === 'rug' && items.some((o) => covers(o, 'rug'))) return 'A rug lies there already.';
	if (def.place === 'ceiling' && items.some((o) => covers(o, 'ceiling'))) return 'Something hangs there already.';
	if (def.place === 'top') {
		if (items.some((o) => covers(o, 'top'))) return 'Something is there already.';
		const under = items.find((o) => covers(o, 'floor'));
		if (under && !FURN[under.f].surface) return `It cannot stand on the ${FURN[under.f].name.toLowerCase()}.`;
	}
	return null;
}

function onSide(x: number, z: number, side: number): boolean {
	return (side === 0 && z === 0) || (side === 1 && x === L.w - 1) || (side === 2 && z === L.d - 1) || (side === 3 && x === 0);
}

/** The height that a small thing stands at on a tile. */
function topHeight(level: number, x: number, z: number, skip = -1): number {
	const under = decorOf(level).find((o, i) => i !== skip && FURN[o.f].place === 'floor' && tilesOf(FURN[o.f], o.x, o.z, o.r).some(([a, b]) => a === x && b === z));
	return under ? (FURN[under.f].surface ?? 0) : 0;
}

/** Is a tile blocked for walking? */
function blocked(level: number, x: number, z: number): boolean {
	if (!inRoom(x, z)) return true;
	return decorOf(level).some((o) => FURN[o.f].block && FURN[o.f].place === 'floor' && tilesOf(FURN[o.f], o.x, o.z, o.r).some(([a, b]) => a === x && b === z));
}

/* Drawing */

const shell = new THREE.Group();
const itemsGroup = new THREE.Group();
const people = new THREE.Group();
/** The four walls, by side, each with what hangs on it. */
const walls: THREE.Group[] = [0, 1, 2, 3].map(() => new THREE.Group());
const ceiling = new THREE.Group();
const level = new THREE.Group();
level.add(shell, itemsGroup, people, ceiling, ...walls);
roomScene.add(level);
roomScene.background = new THREE.Color(0x2a2340);

const hemi = new THREE.HemisphereLight(0xfff4e2, 0x8a7a6a, 1.4);
const sunIn = new THREE.DirectionalLight(0xfff0d2, 1.4);
sunIn.position.set(-4, 6, 5);
roomScene.add(hemi, sunIn);
const LAMPS = 6;
const lamps: THREE.PointLight[] = [];
for (let i = 0; i < LAMPS; i++) {
	const l = new THREE.PointLight(0xffd58a, 0, 7, 1.6);
	lamps.push(l);
	roomScene.add(l);
}
const paneMat = new THREE.MeshBasicMaterial({ color: 0x9fd0ff });
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xb8ffd0, transparent: true, opacity: 0.55, depthWrite: false });
const pickBox = new THREE.Box3Helper(new THREE.Box3(), 0xffffff);
roomScene.add(pickBox);
pickBox.visible = false;
let ghost: THREE.Group | null = null;
let ghostKey = '';

function clear(g: THREE.Object3D): void {
	for (const o of [...g.children]) {
		g.remove(o);
		o.traverse((m) => {
			if (m instanceof THREE.Mesh && m.material !== paneMat && m.material !== ghostMat) m.geometry.dispose();
		});
	}
}

function buildShell(lv: number): void {
	clear(shell);
	clear(ceiling);
	for (const w of walls) clear(w);
	const k = new Kit();
	const W = L.w;
	const D = L.d;
	// Planks, a little different tile by tile.
	for (let x = 0; x < W; x++) {
		for (let z = 0; z < D; z++) {
			const shade = hash2(x, z, lv) * 0.12 - 0.06;
			const c = new THREE.Color(L.floor).offsetHSL(0, 0, shade).getHex();
			k.box('solid', c, 0.98, 0.1, 0.98, tx(x), -0.1, tz(z));
		}
	}
	// The way down: a hole with a rail.
	if (hasDown(lv)) {
		const cx = tx(upCol(lv - 1));
		k.box('solid', 0x2a2230, 0.98, 0.11, 1.98, cx, -0.105, tz(0.5));
		const inner = lv % 2 === 1 ? -1 : 1;
		for (let i = 0; i < 6; i++) k.box('solid', L.trim, 0.06, 0.8, 0.06, cx + inner * 0.47, 0, tz(0) - 0.4 + i * 0.36);
		k.box('solid', L.trim, 0.08, 0.06, 1.95, cx + inner * 0.47, 0.8, tz(0.5));
		k.box('solid', L.trim, 0.98, 0.06, 0.08, cx, 0.8, tz(1) + 0.47);
		// The top step shows in the hole.
		k.box('solid', 0x9a7450, 0.9, 0.08, 0.3, cx, -0.4, tz(1) + 0.3);
	}
	shell.add(k.build());

	// Stairs up, from the front tile to the back tile, into the ceiling.
	if (hasUp(lv)) {
		const s = new Kit();
		const cx = tx(upCol(lv));
		const steps = 9;
		for (let i = 0; i < steps; i++) {
			const h = ((i + 1) / steps) * WALL_H;
			s.box('solid', i % 2 ? 0xc49a6c : 0xb08a64, 0.9, 0.12, 0.26, cx, h - 0.12, tz(1) + 0.4 - i * 0.24);
			s.box('solid', 0x8a6248, 0.9, h - 0.12, 0.24, cx, 0, tz(1) + 0.4 - i * 0.24);
		}
		const inner = lv % 2 === 0 ? -1 : 1;
		s.box('solid', L.trim, 0.06, 1.0, 0.06, cx + inner * 0.45, 0, tz(1) + 0.45);
		s.box('solid', L.trim, 0.05, 0.06, 2.6, cx + inner * 0.45, 1.6, tz(0.5) - 0.05, { rx: -0.85 });
		shell.add(s.build());
	}

	// Walls, one group for each side, so the near ones can hide.
	const wallSpec: [number, number, number, number, number][] = [
		// side, centre x, centre z, length, axis (0 along x, 1 along z)
		[0, 0, tz(0) - 0.5 - WALL_T / 2, W + WALL_T * 2, 0],
		[1, tx(W - 1) + 0.5 + WALL_T / 2, 0, D + WALL_T * 2, 1],
		[2, 0, tz(D - 1) + 0.5 + WALL_T / 2, W + WALL_T * 2, 0],
		[3, tx(0) - 0.5 - WALL_T / 2, 0, D + WALL_T * 2, 1],
	];
	const spots = windowSpots(lv);
	for (const [side, cx, cz, len, axis] of wallSpec) {
		const wk = new Kit();
		const along = axis === 0;
		wk.box('solid', L.wall, along ? len : WALL_T, WALL_H, along ? WALL_T : len, cx, 0, cz);
		const inward = side === 0 || side === 3 ? 1 : -1;
		// The skirting board and a top trim.
		const off = (WALL_T / 2 + 0.02) * inward;
		wk.box('solid', L.trim, along ? len - 0.3 : 0.04, 0.14, along ? 0.04 : len - 0.3, cx + (along ? 0 : off), 0, cz + (along ? off : 0));
		wk.box('solid', L.trim, along ? len : WALL_T + 0.04, 0.1, along ? WALL_T + 0.04 : len, cx, WALL_H - 0.1, cz);
		if (L.beams) {
			const n = Math.floor((along ? W : D) / 2);
			for (let i = 0; i <= n; i++) {
				const t = -((along ? W : D) / 2) + (i * (along ? W : D)) / n;
				wk.box('solid', L.trim, along ? 0.12 : 0.04, WALL_H, along ? 0.04 : 0.12, cx + (along ? t : off), 0, cz + (along ? off : t));
			}
		}
		// Windows and the door.
		const count = along ? W : D;
		for (let i = 0; i < count; i++) {
			if (!spots.has(`${side}:${i}`)) continue;
			const px = along ? tx(i) : cx;
			const pz = along ? cz : tz(i);
			const isDoor = side === 2 && lv === 0 && i === doorX();
			if (isDoor) {
				wk.box('solid', L.trim, along ? 0.86 : WALL_T + 0.08, 1.98, along ? WALL_T + 0.08 : 0.86, px, 0, pz);
				wk.box('solid', 0x6f4530, along ? 0.7 : WALL_T + 0.1, 1.86, along ? WALL_T + 0.1 : 0.7, px, 0, pz);
				wk.ball('solid', 0xffe7a3, 0.05, px + (along ? 0.22 : off * 2), 0.95, pz + (along ? off * 2 : 0.22));
			} else {
				wk.box('solid', L.trim, along ? 0.8 : WALL_T + 0.08, 0.9, along ? WALL_T + 0.08 : 0.8, px, 1.0, pz);
				wk.box('solid', 0xffffff, along ? 0.78 : WALL_T + 0.12, 0.06, along ? WALL_T + 0.18 : 0.78, px, 0.98, pz);
				const pane = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.66 : WALL_T + 0.1, 0.74, along ? WALL_T + 0.1 : 0.66), paneMat);
				pane.position.set(px, 1.45, pz);
				walls[side].add(pane);
				wk.box('solid', L.trim, along ? 0.04 : WALL_T + 0.12, 0.74, along ? WALL_T + 0.12 : 0.04, px, 1.08, pz);
			}
		}
		walls[side].add(wk.build());
	}

	// A ceiling with beams, seen when walking inside.
	const ck = new Kit();
	ck.box('solid', new THREE.Color(L.wall).offsetHSL(0, 0, -0.08).getHex(), W + 0.3, 0.1, D + 0.3, 0, WALL_H, 0);
	for (let i = 0; i < W; i += 2) ck.box('solid', L.trim, 0.14, 0.14, D, tx(i), WALL_H - 0.14, 0);
	ceiling.add(ck.build());
}

interface Shown {
	group: THREE.Group;
	index: number;
}
let shown: Shown[] = [];
const lightSpots: { x: number; y: number; z: number; color: number; power: number }[] = [];

function itemPosition(lv: number, o: DecorItem, index: number): THREE.Vector3 {
	const def = FURN[o.f];
	const [fw, fd] = def.place === 'wall' ? [1, 1] : footprint(def, o.r);
	const x = tx(o.x) + (fw - 1) / 2;
	const z = tz(o.z) + (fd - 1) / 2;
	const y = def.place === 'top' ? topHeight(lv, o.x, o.z, index) : def.place === 'rug' ? 0.005 : 0;
	return new THREE.Vector3(x, y, z);
}

function buildItems(lv: number): void {
	clear(itemsGroup);
	for (const w of walls) for (const o of [...w.children]) if (o.userData.item) w.remove(o);
	shown = [];
	lightSpots.length = 0;
	decorOf(lv).forEach((o, i) => {
		const def = FURN[o.f];
		if (!def) return;
		const g = buildFurniture(o.f, o.c, o.x * 31 + o.z * 7 + i);
		const holder = new THREE.Group();
		holder.add(g);
		holder.position.copy(itemPosition(lv, o, i));
		holder.rotation.y = (-o.r * Math.PI) / 2;
		holder.userData.item = true;
		holder.userData.index = i;
		(def.place === 'wall' ? walls[o.r] : itemsGroup).add(holder);
		shown.push({ group: holder, index: i });
		if (def.light) {
			const p = holder.position;
			lightSpots.push({ x: p.x, y: p.y + def.light.y, z: p.z, color: def.light.color, power: def.light.power });
		}
	});
	// The brightest lights get the lamps.
	lightSpots.sort((a, b) => b.power - a.power);
	lamps.forEach((l, i) => {
		const s = lightSpots[i];
		l.visible = !!s;
		if (!s) return;
		l.position.set(s.x, s.y, s.z);
		l.color.set(s.color);
		l.userData.power = s.power;
	});
	selectItem(selected >= 0 && selected < decorOf(lv).length ? selected : -1);
}

/* The elves at home */

let peopleTimer = 0;

/** Every bed of the home, floor by floor. */
function allBeds(): { lv: number; at: THREE.Vector3; r: number }[] {
	const out: { lv: number; at: THREE.Vector3; r: number }[] = [];
	for (let lv = 0; lv < L.floors; lv++) {
		decorOf(lv).forEach((o, i) => {
			if (FURN[o.f]?.bed) out.push({ lv, at: itemPosition(lv, o, i), r: o.r });
		});
	}
	return out;
}

/** Shows the elves who are at home now, asleep in bed or about the room. */
function placePeople(): void {
	clear(people);
	const driven = room.mode === 'walk' ? drivenId : -1;
	const beds = allBeds();
	folkOf(room.home).forEach((f: Folk, n) => {
		if (f.id === driven || bodyOf(f.id)?.state !== 'inside') return;
		const asleep = blockAt(f).kind === 'sleep';
		const bed = asleep ? beds[n] : undefined;
		// An elf that is awake is on the ground floor, or on its own floor in a tall home.
		const myLevel = bed ? bed.lv : n % L.floors;
		if (myLevel !== room.level) return;
		const { obj } = makeVillager(f.seed, f.job);
		obj.scale.setScalar(ELF_SCALE);
		if (bed) {
			// Tucked in, with the head on the pillow.
			const yaw = (-bed.r * Math.PI) / 2;
			obj.position.set(bed.at.x + Math.sin(yaw) * 0.55, 0.42, bed.at.z + Math.cos(yaw) * 0.55);
			obj.rotation.set(Math.PI / 2, yaw + Math.PI, 0, 'YXZ');
		} else {
			const rand = rng(f.seed + Math.floor(env.time / 20));
			for (let tries = 0; tries < 30; tries++) {
				const x = Math.floor(rand() * L.w);
				const z = Math.floor(rand() * L.d);
				if (blocked(room.level, x, z) || reserved(room.level).has(`${x},${z}`)) continue;
				obj.position.set(tx(x), 0, tz(z));
				obj.rotation.y = rand() * Math.PI * 2;
				break;
			}
		}
		people.add(obj);
	});
}

/* Furnishing a new home */

function tryPut(lv: number, items: DecorItem[], f: string, spots: [number, number, number][], c: number): boolean {
	const def = FURN[f];
	// The check reads the decor of the home. Check against the list that is being made.
	const p = S.pieces.get(room.home)!;
	const save = p.decor;
	const all = [...(save ?? [])];
	while (all.length <= lv) all.push([]);
	all[lv] = items;
	p.decor = all;
	let ok = false;
	for (const [x, z, r] of spots) {
		if (problem(lv, def, x, z, r) === null) {
			items.push({ f, x, z, r, c });
			ok = true;
			break;
		}
	}
	p.decor = save;
	return ok;
}

/** Spots along a wall for a thing that faces into the room. */
function alongWall(side: number, def: FurnDef): [number, number, number][] {
	const out: [number, number, number][] = [];
	const [fw, fd] = footprint(def, side);
	if (side === 0) for (let x = 0; x <= L.w - fw; x++) out.push([x, 0, 0]);
	if (side === 1) for (let z = 0; z <= L.d - fd; z++) out.push([L.w - fw, z, 1]);
	if (side === 2) for (let x = 0; x <= L.w - fw; x++) out.push([x, L.d - fd, 2]);
	if (side === 3) for (let z = 0; z <= L.d - fd; z++) out.push([0, z, 3]);
	return out;
}

function everywhere(r = 0): [number, number, number][] {
	const out: [number, number, number][] = [];
	const cx = (L.w - 1) / 2;
	const cz = (L.d - 1) / 2;
	for (let x = 0; x < L.w; x++) for (let z = 0; z < L.d; z++) out.push([x, z, r]);
	// The middle of the room first.
	return out.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
}

/** Fills a new home with things, so it feels lived in. The jobs and traits of the elves add their own things. */
function furnish(): DecorItem[][] {
	const p = S.pieces.get(room.home)!;
	const folk = folkOf(room.home);
	const rand = rng(p.s + 5);
	const has = (t: string): boolean => folk.some((f) => f.traits.includes(t as never));
	const job = (j: string): boolean => folk.some((f) => f.job === j);
	const fab = (): number => Math.floor(rand() * 8);
	const out: DecorItem[][] = [];
	const beds = PIECE[p.t].beds ?? 1;
	const sideL = 3;
	const sideR = 1;
	for (let lv = 0; lv < L.floors; lv++) {
		const items: DecorItem[] = [];
		const put = (f: string, spots: [number, number, number][], c = 0): boolean => tryPut(lv, items, f, spots, c);
		const wall = (f: string, c = 0): boolean => put(f, [0, 1, 2, 3].flatMap((s) => alongWall(s, FURN[f])).sort(() => rand() - 0.5), c);
		const living = lv === 0;
		const sleeping = L.floors === 1 || lv > 0;
		if (living) {
			put('stove', alongWall(0, FURN.stove), Math.floor(rand() * 3));
			put('counter', alongWall(0, FURN.counter));
			if (job('baker') || has('sweet')) put('barrel', alongWall(0, FURN.barrel));
			put('roundrug', everywhere(), fab());
			const t = items.find((o) => o.f === 'roundrug');
			if (t) put('table', [[t.x, t.z, 0], [t.x + 1, t.z + 1, 0], [t.x + 1, t.z, 0]], Math.floor(rand() * 4));
			const tb = items.find((o) => o.f === 'table');
			if (tb) {
				// Chairs face the table.
				put('chair', [[tb.x, tb.z - 1, 0], [tb.x - 1, tb.z, 3]]);
				put('chair', [[tb.x, tb.z + 1, 2], [tb.x + 1, tb.z, 1]]);
				put(job('tea') ? 'teaset' : 'candle', [[tb.x, tb.z, 0]], fab());
			}
			if (L.w >= 6) put('fireplace', alongWall(sideL, FURN.fireplace));
			put('armchair', alongWall(sideL, FURN.armchair), fab());
			put('floorlamp', alongWall(sideR, FURN.floorlamp), Math.floor(rand() * 4));
			put('herbs', alongWall(0, FURN.herbs));
			wall('painting', Math.floor(rand() * 3));
			put('chandelier', everywhere());
		}
		if (sleeping) {
			const here = L.floors === 1 ? beds : Math.ceil(beds / (L.floors - 1));
			for (let b = 0; b < here; b++) {
				const f = here > 1 && b === 0 && rand() < 0.4 ? 'bunk' : 'bed';
				if (!put(f, [...alongWall(0, FURN[f]), ...alongWall(sideR, FURN[f]), ...alongWall(sideL, FURN[f])], fab())) put('bed', everywhere(0), fab());
				if (f === 'bunk') b++;
			}
			put('sidetable', alongWall(0, FURN.sidetable));
			const st = items.find((o) => o.f === 'sidetable');
			if (st) put('lantern', [[st.x, st.z, 0]], 1);
			put('wardrobe', alongWall(sideR, FURN.wardrobe), Math.floor(rand() * 4));
			put('longrug', everywhere(rand() < 0.5 ? 0 : 1), fab());
			wall(rand() < 0.5 ? 'mirror' : 'clock', Math.floor(rand() * 3));
			if (!living) put('hangplant', everywhere());
		}
		// Things that the jobs and traits bring.
		if (job('gardener') || has('green')) {
			put('fern', [...alongWall(2, FURN.fern), ...alongWall(sideL, FURN.fern)], Math.floor(rand() * 4));
			put('flowerpot', everywhere(), Math.floor(rand() * 4));
		}
		if ((job('scholar') || has('bookish')) && lv === L.floors - 1) {
			put('bookcase', [...alongWall(sideL, FURN.bookcase), ...alongWall(0, FURN.bookcase)]);
			put('desk', [...alongWall(sideR, FURN.desk), ...alongWall(0, FURN.desk)]);
		}
		if (job('crafter') || has('handy')) put('chest', alongWall(2, FURN.chest));
		if (has('dreamer') || job('fisher')) {
			put('globe', everywhere(), Math.floor(rand() * 3));
			if (lv === 0) put('harp', alongWall(2, FURN.harp));
		}
		if (job('lamplighter')) wall('sconce');
		if (job('tea') && lv === 0) put('cushion', everywhere(), fab());
		if (has('sweet') && lv === 0) put('basket', alongWall(2, FURN.basket));
		put('shelf', alongWall(0, FURN.shelf));
		wall('sconce');
		put('bigplant', [...alongWall(2, FURN.bigplant)].sort(() => rand() - 0.5));
		out.push(items);
	}
	return out;
}

/* The decorate view */

/** The thing that the player holds to place, or null. */
let tool: { f: string; r: number; c: number } | null = null;
/** The index of the picked thing on this floor, or -1. */
let selected = -1;
let cat: FurnCat = 'beds';
const view = { yaw: 0.5, pitch: 0.95, dist: 11 };
let drivenId = -1;
let icons: Record<string, string> = {};

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const el = {
	root: $('decor'),
	name: $('decor-name'),
	floors: $('decor-floors'),
	cats: $('decor-cats'),
	items: $('decor-items'),
	sel: $('decor-sel'),
	hint: $('decor-hint'),
	walk: $('decor-walk') as HTMLButtonElement,
};

function homeTitle(): string {
	const p = S.pieces.get(room.home);
	if (!p) return 'Home';
	const names = folkOf(room.home).map((f) => f.name);
	const who = names.length === 0 ? 'Empty' : names.length === 1 ? `${names[0]}'s` : names.length === 2 ? `${names[0]} & ${names[1]}'s` : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}'s`;
	return `${who} ${PIECE[p.t].name.toLowerCase()}`;
}

function renderFloors(): void {
	el.floors.hidden = L.floors < 2;
	el.floors.innerHTML = Array.from({ length: L.floors }, (_, i) => `<button type="button" data-floor="${i}" aria-pressed="${i === room.level}">${i === 0 ? 'Ground' : `Floor ${i + 1}`}</button>`).join('');
}

function renderCats(): void {
	el.cats.innerHTML = CATS.map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="${c.id === cat}">${c.name}</button>`).join('');
}

function renderItems(): void {
	el.items.innerHTML = FURNITURE.filter((f) => f.cat === cat)
		.map((f) => `<button type="button" class="piece piece--tile" data-furn="${f.id}" aria-pressed="${tool?.f === f.id}"><img src="${icons[f.id] ?? ''}" alt="" /><span class="piece__name">${f.name}</span></button>`)
		.join('');
}

function setHint(text: string): void {
	el.hint.textContent = text;
}

function placeHint(): void {
	if (selected >= 0) setHint('Turn it, change its colour, move it or take it away.');
	else if (!tool) setHint('Pick a thing below, then tap the room. Tap a thing to change it.');
	else {
		const def = FURN[tool.f];
		setHint(def.place === 'wall' ? `Tap near a wall to hang the ${def.name.toLowerCase()}.` : def.place === 'top' ? `Tap a table or the floor for the ${def.name.toLowerCase()}.` : `Tap the floor to place the ${def.name.toLowerCase()}.`);
	}
}

function renderSel(): void {
	el.sel.hidden = selected < 0;
	if (selected < 0) return;
	const o = decorOf(room.level)[selected];
	const def = FURN[o.f];
	el.sel.innerHTML = `<b>${def.name}</b>
		${def.place === 'wall' ? '' : '<button class="btn" type="button" data-sel="turn">Turn</button>'}
		${def.colors.length > 1 ? '<button class="btn" type="button" data-sel="color">Colour</button>' : ''}
		<button class="btn" type="button" data-sel="move">Move</button>
		<button class="btn btn--danger" type="button" data-sel="remove">Remove</button>
		<button class="round round--small" type="button" data-sel="done" aria-label="Done"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg></button>`;
}

function selectItem(i: number): void {
	selected = i;
	const s = shown.find((o) => o.index === i);
	pickBox.visible = !!s;
	if (s) {
		pickBox.box.setFromObject(s.group);
		pickBox.box.expandByScalar(0.04);
	}
	renderSel();
	placeHint();
}

function pickTool(f: string | null): void {
	if (!f || tool?.f === f) tool = null;
	else tool = { f, r: 0, c: 0 };
	selectItem(-1);
	renderItems();
	placeHint();
	dropGhost();
}

/* Pointing at the room */

const ray = new THREE.Raycaster();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();

function aim(px: number, py: number): void {
	_ndc.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
	ray.setFromCamera(_ndc, camera);
}

/** Where the held thing would go for a point on the screen. */
function target(px: number, py: number): { x: number; z: number; r: number } | null {
	if (!tool) return null;
	aim(px, py);
	const hit = ray.ray.intersectPlane(floorPlane, _hit);
	if (!hit) return null;
	const def = FURN[tool.f];
	if (def.place === 'wall') {
		// The nearest wall to the point, and the tile along it.
		const x = clamp(Math.round(hit.x + (L.w - 1) / 2), 0, L.w - 1);
		const z = clamp(Math.round(hit.z + (L.d - 1) / 2), 0, L.d - 1);
		const d = [Math.abs(hit.z - (tz(0) - 0.5)), Math.abs(hit.x - (tx(L.w - 1) + 0.5)), Math.abs(hit.z - (tz(L.d - 1) + 0.5)), Math.abs(hit.x - (tx(0) - 0.5))];
		// Only walls that the camera can see.
		for (let s = 0; s < 4; s++) if (!walls[s].visible) d[s] = Infinity;
		const side = d.indexOf(Math.min(...d));
		if (side === 0) return { x, z: 0, r: 0 };
		if (side === 1) return { x: L.w - 1, z, r: 1 };
		if (side === 2) return { x, z: L.d - 1, r: 2 };
		return { x: 0, z, r: 3 };
	}
	const [fw, fd] = footprint(def, tool.r);
	const x = clamp(Math.round(hit.x + (L.w - 1) / 2 - (fw - 1) / 2), 0, L.w - fw);
	const z = clamp(Math.round(hit.z + (L.d - 1) / 2 - (fd - 1) / 2), 0, L.d - fd);
	return { x, z, r: tool.r };
}

function dropGhost(): void {
	if (!ghost) return;
	ghost.parent?.remove(ghost);
	clear(ghost);
	ghost = null;
	ghostKey = '';
}

function showGhost(px: number, py: number): void {
	const t = target(px, py);
	if (!t || !tool) {
		dropGhost();
		return;
	}
	const k = `${tool.f}:${tool.c}`;
	if (k !== ghostKey) {
		dropGhost();
		ghost = buildFurniture(tool.f, tool.c, 1);
		ghost.traverse((o) => {
			if (o instanceof THREE.Mesh) o.material = ghostMat;
		});
		ghostKey = k;
		level.add(ghost);
	}
	const bad = problem(room.level, FURN[tool.f], t.x, t.z, t.r) !== null;
	ghostMat.color.set(bad ? 0xff8fa8 : 0xb8ffd0);
	ghost!.position.copy(itemPosition(room.level, { f: tool.f, x: t.x, z: t.z, r: t.r, c: 0 }, -1));
	ghost!.rotation.y = (-t.r * Math.PI) / 2;
}

function tap(px: number, py: number): void {
	if (tool) {
		const t = target(px, py);
		if (!t) return;
		const def = FURN[tool.f];
		const why = problem(room.level, def, t.x, t.z, t.r);
		if (why) {
			roomActions.toast(why, '');
			return;
		}
		setDecor(room.level, [...decorOf(room.level), { f: tool.f, x: t.x, z: t.z, r: t.r, c: tool.c }]);
		buildItems(room.level);
		roomActions.place();
		// A thing that was moved is placed once. A new thing can be placed again and again.
		if (moving) {
			moving = false;
			pickTool(null);
		}
		return;
	}
	aim(px, py);
	const hits = ray.intersectObjects(shown.map((s) => s.group).filter((g) => g.parent?.visible !== false), true);
	if (!hits.length) {
		selectItem(-1);
		return;
	}
	let o: THREE.Object3D | null = hits[0].object;
	while (o && o.userData.index === undefined) o = o.parent;
	if (o) {
		roomActions.click();
		selectItem(o.userData.index as number);
	}
}

let moving = false;

function onSel(act: string): void {
	const items = decorOf(room.level);
	const o = items[selected];
	if (!o) return;
	const def = FURN[o.f];
	roomActions.click();
	if (act === 'done') {
		selectItem(-1);
		return;
	}
	if (act === 'remove' || act === 'move') {
		setDecor(room.level, items.filter((_, i) => i !== selected));
		selected = -1;
		buildItems(room.level);
		if (act === 'remove') roomActions.remove();
		else {
			cat = def.cat;
			renderCats();
			tool = { f: o.f, r: o.r, c: o.c };
			moving = true;
			renderItems();
			placeHint();
		}
		return;
	}
	const next = { ...o };
	if (act === 'turn') {
		// Turn it in place. A thing that does not fit when turned stays as it is.
		for (let i = 1; i <= 4; i++) {
			const r = (o.r + i) % 4;
			if (problem(room.level, def, o.x, o.z, r, selected) === null) {
				next.r = r;
				break;
			}
		}
	} else if (act === 'color') next.c = (o.c + 1) % def.colors.length;
	setDecor(room.level, items.map((it, i) => (i === selected ? next : it)));
	buildItems(room.level);
}

/* Camera in the decorate view */

const pts = new Map<number, { x: number; y: number }>();
let pinchDist = 0;

const decorDriver: Driver = {
	down(id, x, y) {
		pts.set(id, { x, y });
		if (pts.size === 2) {
			const [a, b] = [...pts.values()];
			pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
		}
	},
	move(id, x, y, dx, dy) {
		const p = pts.get(id);
		if (!p) return;
		p.x = x;
		p.y = y;
		if (pts.size >= 2) {
			const [a, b] = [...pts.values()];
			const d = Math.hypot(a.x - b.x, a.y - b.y);
			if (pinchDist > 0) view.dist = clamp(view.dist * (pinchDist / Math.max(20, d)), 4, 30);
			pinchDist = d;
			return;
		}
		view.yaw -= dx * 0.008;
		view.pitch = clamp(view.pitch + dy * 0.006, 0.45, 1.35);
	},
	up(id, wasTap, x, y) {
		const many = pts.size > 1;
		pts.delete(id);
		if (wasTap && !many) tap(x, y);
		if (pts.size < 2) pinchDist = 0;
	},
	update(dt, keys) {
		if (keys.has('q') || keys.has('ArrowLeft')) view.yaw += dt * 1.6;
		if (keys.has('e') || keys.has('ArrowRight')) view.yaw -= dt * 1.6;
		if (keys.has('ArrowUp') || keys.has('w')) view.pitch = clamp(view.pitch + dt, 0.45, 1.35);
		if (keys.has('ArrowDown') || keys.has('s')) view.pitch = clamp(view.pitch - dt, 0.45, 1.35);
		placeCamera();
	},
	key(k) {
		if (k === 'r') {
			if (selected >= 0) onSel('turn');
			else if (tool) tool.r = (tool.r + 1) % 4;
		} else if (k === 'Delete' || k === 'Backspace' || k === 'x') {
			if (selected >= 0) onSel('remove');
		} else return ['q', 'e', 'w', 's', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k);
		return true;
	},
	wheel(f) {
		view.dist = clamp(view.dist * f, 4, 30);
	},
	hover(x, y) {
		showGhost(x, y);
	},
};

function placeCamera(): void {
	const flat = Math.cos(view.pitch) * view.dist;
	camera.position.set(Math.sin(view.yaw) * flat, Math.sin(view.pitch) * view.dist + 0.4, Math.cos(view.yaw) * flat);
	camera.lookAt(0, 0.4, 0);
	camera.updateMatrixWorld();
}

/** Hides the walls between the camera and the room. */
function cutaway(): void {
	const cx = camera.position.x;
	const cz = camera.position.z;
	const firstPerson = room.mode === 'walk' && drive.view === 'first';
	const edges = [tz(0) - 0.5, tx(L.w - 1) + 0.5, tz(L.d - 1) + 0.5, tx(0) - 0.5];
	walls[0].visible = firstPerson ? true : cz > edges[0] - 0.05;
	walls[1].visible = firstPerson ? true : cx < edges[1] + 0.05;
	walls[2].visible = firstPerson ? true : cz < edges[2] + 0.05;
	walls[3].visible = firstPerson ? true : cx > edges[3] - 0.05;
	if (room.mode === 'decor') {
		// From above, a wall that faces the camera hides.
		walls[0].visible = Math.cos(view.yaw) > -0.25;
		walls[2].visible = Math.cos(view.yaw) < 0.25;
		walls[1].visible = Math.sin(view.yaw) < 0.25;
		walls[3].visible = Math.sin(view.yaw) > -0.25;
	}
	ceiling.visible = firstPerson;
}

/* Opening and closing */

/** Shows a floor of the open home. */
function showLevel(lv: number): void {
	room.level = clamp(lv, 0, L.floors - 1);
	selected = -1;
	buildShell(room.level);
	buildItems(room.level);
	placePeople();
	renderFloors();
	dropGhost();
}

export function openRoom(home: string, mode: 'decor' | 'walk'): boolean {
	const p = S.pieces.get(home);
	if (!p || !PIECE[p.t].home) return false;
	room.open = true;
	room.home = home;
	room.mode = mode;
	L = layoutOf(p.t);
	if (!p.decor) touch(home, { decor: furnish() });
	saveSoon();
	// A tall screen needs the camera farther back to fit the room.
	view.dist = Math.max(L.w, L.d) * (camera.aspect < 1 ? 2.7 : 1.75);
	view.yaw = 0.55;
	view.pitch = 0.95;
	tool = null;
	moving = false;
	showLevel(0);
	el.name.textContent = homeTitle();
	renderCats();
	renderItems();
	placeHint();
	setMode(mode);
	return true;
}

/** Switches between decorating and walking. Walking is started by the shell with `walkSpace`. */
export function setMode(mode: 'decor' | 'walk'): void {
	room.mode = mode;
	el.root.hidden = mode !== 'decor';
	if (mode === 'decor') {
		drivenId = -1;
		setDriver(decorDriver);
		camera.near = 0.1;
		camera.updateProjectionMatrix();
		placeCamera();
		placePeople();
	} else {
		dropGhost();
		selectItem(-1);
	}
}

export function closeRoom(): void {
	if (!room.open) return;
	room.open = false;
	dropGhost();
	pickBox.visible = false;
	el.root.hidden = true;
	clear(people);
	if (room.mode === 'decor') setDriver(null);
	camera.near = 0.5;
	camera.updateProjectionMatrix();
}

/** The room as a space to walk in, for the drive module. */
export function walkSpace(id: number, deedOut: () => { label: string; run: () => void } | null): Space {
	drivenId = id;
	return {
		canStand: (x, z) => {
			const [a, b] = tileOf(x, z);
			return !blocked(room.level, a, b) && Math.abs(x) < L.w / 2 - 0.02 && Math.abs(z) < L.d / 2 - 0.02;
		},
		groundY: () => 0,
		scale: ELF_SCALE,
		holder: level,
		camDist: 1.25,
		deedAt: (x, z) => {
			const [a, b] = tileOf(x, z);
			if (room.level === 0 && a === doorX() && b === L.d - 1) return deedOut();
			if (hasUp(room.level) && a === upCol(room.level) && b <= 1) return { label: 'Go up', run: () => climb(1) };
			if (hasDown(room.level) && a === upCol(room.level - 1) && b <= 1) return { label: 'Go down', run: () => climb(-1) };
			return null;
		},
		leave: (v) => {
			v.state = 'inside';
			v.obj.visible = false;
			v.wait = 3;
		},
	};
}

/** Where a walking elf starts: just inside the door, looking into the room. */
export function doorStart(): [number, number, number] {
	return [tx(doorX()), tz(L.d - 1), 0];
}

let climbHook: (x: number, z: number) => void = () => {};

/** Lets the shell move the walking elf when it takes the stairs. */
export function onClimb(fn: (x: number, z: number) => void): void {
	climbHook = fn;
}

function climb(step: number): void {
	const from = room.level;
	showLevel(from + step);
	// Arrive at the other end of the same stairs.
	const col = step > 0 ? upCol(from) : upCol(from - 1);
	// Step off the stairs, onto the tile in front of them when it is free.
	const z = blocked(room.level, col, 2) ? 1 : 2;
	climbHook(tx(col), tz(z));
	roomActions.click();
}

/* Each frame */

export function updateRoom(dt: number): void {
	if (!room.open) return;
	const night = env.night;
	paneMat.color.set(0x9fd0ff).lerp(new THREE.Color(0x26306a), night);
	hemi.intensity = 1.25 - night * 0.65;
	sunIn.intensity = 1.3 * (1 - night) + 0.05;
	for (const l of lamps) if (l.visible) l.intensity = (l.userData.power as number) * (4 + night * 9) * (0.95 + Math.sin(env.time * 7 + l.position.x) * 0.03);
	roomScene.background = (roomScene.background as THREE.Color).set(0x6f86b8).lerp(new THREE.Color(0x141a3a), night);
	cutaway();
	peopleTimer -= dt;
	if (peopleTimer <= 0) {
		peopleTimer = 3;
		placePeople();
	}
	if (room.mode === 'decor' && pickBox.visible && selected >= 0) {
		const s = shown.find((o) => o.index === selected);
		if (s) pickBox.box.setFromObject(s.group).expandByScalar(0.04);
	}
}

export function initRoom(renderer: THREE.WebGLRenderer, makeIcons: (r: THREE.WebGLRenderer) => Record<string, string>): void {
	icons = makeIcons(renderer);
	$('decor-exit').addEventListener('click', () => {
		roomActions.click();
		closeRoom();
		roomActions.closed();
	});
	el.walk.addEventListener('click', () => {
		const f = folkOf(room.home)[0];
		roomActions.click();
		if (!f) {
			roomActions.toast('No one lives here yet', 'An elf moves in soon');
			return;
		}
		roomActions.walkIn(f.id);
	});
	el.floors.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLElement>('[data-floor]');
		if (!b) return;
		roomActions.click();
		showLevel(Number(b.dataset.floor));
	});
	el.cats.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLElement>('[data-cat]');
		if (!b) return;
		roomActions.click();
		cat = b.dataset.cat as FurnCat;
		renderCats();
		renderItems();
		el.items.scrollLeft = 0;
	});
	el.items.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLElement>('[data-furn]');
		if (!b) return;
		roomActions.click();
		moving = false;
		pickTool(b.dataset.furn!);
	});
	el.sel.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sel]');
		if (b) onSel(b.dataset.sel!);
	});
	el.items.addEventListener('wheel', (e) => {
		if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.items.scrollLeft += e.deltaY;
	}, { passive: true });
}

export const roomName = homeTitle;
