/** The state of the game: the pieces, the land, the rules of placing, undo and saving. */

import { COMBOS, GOALS, ISLANDS, PIECE, PIECES, START_ISLANDS, TUNE, VILLAGER_NAMES, WORLD_RADIUS } from './content.ts';
import type { ComboDef, GoalDef, PieceId } from './content.ts';
import { DX, DZ, key, unkey } from './util.ts';

export interface Piece {
	t: PieceId;
	/** Facing direction, 0..3. */
	r: number;
	/** A seed for its look. */
	s: number;
	/** Growth of a tree, 0..1. */
	g?: number;
	/** For a tree home: index of the elf name plus one, when an elf lives here. */
	h?: number;
}

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
	music: number;
	sound: number;
	quality: Quality;
}

/** What happened while the player was away. */
export interface AwayReport {
	seconds: number;
	trees: number;
	elves: string[];
	gifts: number;
}

interface SaveData {
	v: 2;
	pieces: Record<string, Piece>;
	lush: Record<string, number>;
	islands: number;
	unlocked: PieceId[];
	combos: string[];
	goals: string[];
	clock: number;
	tutorial: boolean;
	names: number;
	gifts: number;
	/** When the game was last saved, in milliseconds. */
	seen: number;
}

const SAVE_KEY = 'petalwisp-isles.save2';
const SETTINGS_KEY = 'petalwisp-isles.settings';

type Change = { k: string; before: Piece | null; after: Piece | null };

export const S = {
	pieces: new Map<string, Piece>(),
	lush: new Map<string, number>(),
	/** Land cells of the open islands, with the index of their island. */
	land: new Map<string, number>(),
	/** The cells of every island, open or not. */
	islandCells: [] as [number, number][][],
	/** How many islands are open. */
	islands: START_ISLANDS,
	unlocked: new Set<PieceId>(),
	combos: new Set<string>(),
	goals: new Set<string>(),
	/** Time of day, 0..1. */
	clock: 0.12,
	tutorial: false,
	/** How many elf names were given out. */
	names: 0,
	/** How many jelly gifts the player collected. */
	gifts: 0,
	/** Set by `load` when the player was away for a while. */
	away: null as AwayReport | null,
	settings: { music: 0.6, sound: 0.7, quality: 'medium' } as Settings,
	undo: [] as Change[][],
	redo: [] as Change[][],
	hasSave: false,
};

/** Listeners that the view and the life systems add. */
export const hooks = {
	/** Cells whose piece changed. `placed` is the cell that the player just built on, if any. */
	changed: [] as ((cells: string[], placed: string | null) => void)[],
	/** A new island opened. `cells` are the cells whose piece changed with it. */
	islandAdded: [] as ((index: number, cells: string[]) => void)[],
};

/** How far the edge of an island is from its centre, in one direction. */
export function edgeRadius(index: number, a: number): number {
	const d = ISLANDS[index];
	return d.r * (1 + 0.12 * Math.sin(3 * a + d.seed) + 0.06 * Math.sin(5 * a + d.seed * 1.7) + 0.03 * Math.sin(9 * a + d.seed * 0.6));
}

/** The cells of one island: a round shape with a wavy edge. */
function cellsOfIsland(index: number): [number, number][] {
	const d = ISLANDS[index];
	const out: [number, number][] = [];
	const reach = Math.ceil(d.r * 1.3);
	for (let x = d.cx - reach; x <= d.cx + reach; x++) {
		for (let z = d.cz - reach; z <= d.cz + reach; z++) {
			const dx = x - d.cx;
			const dz = z - d.cz;
			if (Math.hypot(dx, dz) <= edgeRadius(index, Math.atan2(dz, dx))) out.push([x, z]);
		}
	}
	return out;
}

export function buildLand(): void {
	S.land.clear();
	if (!S.islandCells.length) S.islandCells = ISLANDS.map((_, i) => cellsOfIsland(i));
	for (let i = 0; i < S.islands; i++) for (const [x, z] of S.islandCells[i]) S.land.set(key(x, z), i);
}

/** The air cells on the straight way between two islands. A walker can cross them one by one. */
function bridgeCells(a: number, b: number): string[] {
	const A = ISLANDS[a];
	const B = ISLANDS[b];
	const steps = Math.ceil(Math.hypot(B.cx - A.cx, B.cz - A.cz) * 4);
	const line: [number, number][] = [];
	for (let i = 0; i <= steps; i++) {
		const x = Math.round(A.cx + ((B.cx - A.cx) * i) / steps);
		const z = Math.round(A.cz + ((B.cz - A.cz) * i) / steps);
		const last = line[line.length - 1];
		if (last && last[0] === x && last[1] === z) continue;
		// A diagonal step gets a cell in between, so the bridge has no gap.
		if (last && last[0] !== x && last[1] !== z) line.push([x, last[1]]);
		line.push([x, z]);
	}
	return line.filter(([x, z]) => !isLand(x, z)).map(([x, z]) => key(x, z));
}

/** Puts the fixed pieces and the bridge of an open island in place. Returns the cells that changed. */
function settleIsland(index: number): string[] {
	const d = ISLANDS[index];
	const changed: string[] = [];
	for (const f of d.fixed ?? []) {
		const k = key(d.cx + f.dx, d.cz + f.dz);
		if (S.pieces.get(k)?.t === f.t) continue;
		S.pieces.set(k, { t: f.t, r: 2, s: d.seed });
		changed.push(k);
	}
	if (index > 0) {
		for (const k of bridgeCells(d.from, index)) {
			if (S.pieces.has(k)) continue;
			S.pieces.set(k, { t: 'bridge', r: 0, s: 1 });
			changed.push(k);
		}
	}
	return changed;
}

/** Opens the next island: the land appears and a bridge grows out to it. */
export function unlockIsland(): boolean {
	if (S.islands >= ISLANDS.length) return false;
	const index = S.islands++;
	buildLand();
	const changed: string[] = [];
	// A piece can stand in the air where the new island comes up. The island takes its place.
	for (const [x, z] of S.islandCells[index]) {
		const k = key(x, z);
		if (S.pieces.delete(k)) changed.push(k);
	}
	changed.push(...settleIsland(index));
	S.undo = [];
	S.redo = [];
	for (const h of hooks.islandAdded) h(index, changed);
	saveSoon();
	return true;
}

export function resetState(): void {
	S.pieces.clear();
	S.lush.clear();
	S.islands = START_ISLANDS;
	S.unlocked = new Set(PIECES.filter((p) => p.starter).map((p) => p.id));
	S.combos.clear();
	S.goals.clear();
	S.clock = 0.12;
	S.names = 0;
	S.gifts = 0;
	S.away = null;
	S.undo = [];
	S.redo = [];
	buildLand();
	for (let i = 0; i < S.islands; i++) settleIsland(i);
}

const everyLand = new Map<string, number>();

/** The island that owns a cell, open or not. */
export function islandAtCell(x: number, z: number): number | undefined {
	if (!everyLand.size) S.islandCells.forEach((cells, i) => cells.forEach(([cx, cz]) => everyLand.set(key(cx, cz), i)));
	return everyLand.get(key(x, z));
}

export const pieceAt = (x: number, z: number): Piece | undefined => S.pieces.get(key(x, z));
export const isLand = (x: number, z: number): boolean => S.land.has(key(x, z));

/** Directions from a land cell that look out into the open sky. */
export function airSides(x: number, z: number): number[] {
	const out: number[] = [];
	for (let d = 0; d < 4; d++) if (!isLand(x + DX[d], z + DZ[d])) out.push(d);
	return out;
}

/** Why a piece cannot go on a cell, or null when it can. */
export function placeProblem(id: PieceId, x: number, z: number): string | null {
	const def = PIECE[id];
	if (def.fixed) return 'This cannot be built.';
	if (Math.hypot(x, z) > WORLD_RADIUS) return 'Too far out in the sky.';
	if (S.pieces.has(key(x, z))) return 'Something is already here.';
	const land = isLand(x, z);
	if (def.on === 'air') {
		if (land) return 'Bridges go in the air, next to an edge.';
		for (let d = 0; d < 4; d++) {
			const nx = x + DX[d];
			const nz = z + DZ[d];
			if (isLand(nx, nz) || pieceAt(nx, nz)?.t === 'bridge') return null;
		}
		return 'Start a bridge at an island edge.';
	}
	if (!land) return `Put the ${def.name.toLowerCase()} on an island.`;
	if (def.on === 'edge' && airSides(x, z).length === 0) return `The ${def.name.toLowerCase()} needs an island edge.`;
	return null;
}

function apply(changes: Change[], forward: boolean, placed: string | null): void {
	for (const c of changes) {
		const p = forward ? c.after : c.before;
		if (p) S.pieces.set(c.k, { ...p });
		else S.pieces.delete(c.k);
	}
	for (const h of hooks.changed) h(changes.map((c) => c.k), placed);
	saveSoon();
}

function commit(changes: Change[], placed: string | null): void {
	S.undo.push(changes);
	if (S.undo.length > TUNE.undoDepth) S.undo.shift();
	S.redo = [];
	apply(changes, true, placed);
}

export function place(id: PieceId, x: number, z: number, r: number): boolean {
	if (placeProblem(id, x, z)) return false;
	const piece: Piece = { t: id, r, s: Math.floor(Math.random() * 100000) };
	if (id === 'tree') piece.g = 0;
	if (PIECE[id].on === 'edge') {
		const sides = airSides(x, z);
		if (!sides.includes(r)) piece.r = sides[0];
	}
	commit([{ k: key(x, z), before: null, after: piece }], key(x, z));
	return true;
}

/** Places one kind of piece on many cells as one step, for a road. Returns how many were built. */
export function placeMany(id: PieceId, cells: [number, number][]): number {
	const changes: Change[] = [];
	for (const [x, z] of cells) {
		if (placeProblem(id, x, z)) continue;
		changes.push({ k: key(x, z), before: null, after: { t: id, r: 0, s: Math.floor(Math.random() * 100000) } });
	}
	if (changes.length) commit(changes, changes[changes.length - 1].k);
	return changes.length;
}

export function erase(x: number, z: number): boolean {
	const k = key(x, z);
	const before = S.pieces.get(k);
	if (!before || PIECE[before.t].fixed) return false;
	commit([{ k, before: { ...before }, after: null }], null);
	return true;
}

/** Turns the piece on a cell a quarter turn. An edge piece only turns to face the sky. */
export function rotateAt(x: number, z: number): boolean {
	const k = key(x, z);
	const before = S.pieces.get(k);
	if (!before || !PIECE[before.t].turns) return false;
	let r = (before.r + 1) % 4;
	if (PIECE[before.t].on === 'edge') {
		const sides = airSides(x, z);
		while (!sides.includes(r)) r = (r + 1) % 4;
		if (r === before.r) return false;
	}
	commit([{ k, before: { ...before }, after: { ...before, r } }], null);
	return true;
}

export function undo(): boolean {
	const changes = S.undo.pop();
	if (!changes) return false;
	S.redo.push(changes);
	apply([...changes].reverse(), false, null);
	return true;
}

export function redo(): boolean {
	const changes = S.redo.pop();
	if (!changes) return false;
	S.undo.push(changes);
	apply(changes, true, null);
	return true;
}

/** Changes a piece with no undo step, for growth and for villagers that move in. */
export function touch(k: string, patch: Partial<Piece>): void {
	const p = S.pieces.get(k);
	if (p) Object.assign(p, patch);
}

/** The combos that a cell takes part in now. */
export function combosAt(x: number, z: number): ComboDef[] {
	const me = pieceAt(x, z);
	if (!me) return [];
	const out: ComboDef[] = [];
	for (let d = 0; d < 4; d++) {
		const other = pieceAt(x + DX[d], z + DZ[d]);
		if (!other) continue;
		for (const c of COMBOS) {
			if (((c.a === me.t && c.b === other.t) || (c.b === me.t && c.a === other.t)) && !out.includes(c)) out.push(c);
		}
	}
	return out;
}

/** True when a waterfall rock has a pond next to it. Then its water runs. */
export function waterfallRuns(x: number, z: number): boolean {
	for (let d = 0; d < 4; d++) if (pieceAt(x + DX[d], z + DZ[d])?.t === 'pond') return true;
	return false;
}

/** Sides where a running waterfall spills into the sky. */
export function spillSides(x: number, z: number): number[] {
	if (!waterfallRuns(x, z)) return [];
	return airSides(x, z).filter((d) => !pieceAt(x + DX[d], z + DZ[d]));
}

export function goalProgress(g: GoalDef): number {
	let n = 0;
	switch (g.kind) {
		case 'place':
			for (const p of S.pieces.values()) if (p.t === g.piece) n++;
			break;
		case 'villagers':
			for (const p of S.pieces.values()) if (p.t === 'cottage' && p.h) n++;
			break;
		case 'gifts':
			n = S.gifts;
			break;
		case 'combos':
			n = S.combos.size;
			break;
		case 'trees':
			for (const p of S.pieces.values()) if (p.t === 'tree' && (p.g ?? 0) >= 1) n++;
			break;
		case 'spill':
			for (const [k, p] of S.pieces) if (p.t === 'waterfall' && spillSides(...unkey(k)).length) n++;
			break;
	}
	return Math.min(n, g.n);
}

/** Marks each goal that is now met as done. Returns the new ones. */
export function checkGoals(): GoalDef[] {
	const done: GoalDef[] = [];
	for (const g of GOALS) {
		if (S.goals.has(g.id) || goalProgress(g) < g.n) continue;
		S.goals.add(g.id);
		done.push(g);
		if ('piece' in g.reward) S.unlocked.add(g.reward.piece);
		if ('island' in g.reward) unlockIsland();
	}
	if (done.length) saveSoon();
	return done;
}

export const nextGoal = (): GoalDef | undefined => GOALS.find((g) => !S.goals.has(g.id));

/* Saving */

let saveTimer = 0;

export function saveSoon(): void {
	if (saveTimer) return;
	saveTimer = window.setTimeout(saveNow, 1200);
}

export function saveNow(): void {
	window.clearTimeout(saveTimer);
	saveTimer = 0;
	const lush: Record<string, number> = {};
	for (const [k, v] of S.lush) if (v > 0.02) lush[k] = Math.round(v * 100) / 100;
	const data: SaveData = {
		v: 2,
		pieces: Object.fromEntries(S.pieces),
		lush,
		islands: S.islands,
		unlocked: [...S.unlocked],
		combos: [...S.combos],
		goals: [...S.goals],
		clock: S.clock,
		tutorial: S.tutorial,
		names: S.names,
		gifts: S.gifts,
		seen: Date.now(),
	};
	try {
		localStorage.setItem(SAVE_KEY, JSON.stringify(data));
		S.hasSave = true;
	} catch {
		/* Storage is full or blocked. The game still plays. */
	}
}

export function saveSettings(): void {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(S.settings));
	} catch {
		/* Ignored: see saveNow. */
	}
}

export function loadSettings(): void {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (raw) Object.assign(S.settings, JSON.parse(raw));
		else if (matchMedia('(pointer: coarse)').matches) S.settings.quality = 'medium';
		else S.settings.quality = 'high';
	} catch {
		/* Ignored: defaults stay. */
	}
}

/** Loads the saved islands. Returns false when there is no save, or it cannot be read. */
export function load(): boolean {
	resetState();
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return false;
		const data = JSON.parse(raw) as SaveData;
		if (data.v !== 2) return false;
		S.islands = Math.min(ISLANDS.length, Math.max(START_ISLANDS, data.islands));
		buildLand();
		for (const [k, p] of Object.entries(data.pieces)) if (PIECE[p.t]) S.pieces.set(k, p);
		for (const [k, v] of Object.entries(data.lush)) S.lush.set(k, v);
		for (const id of data.unlocked) if (PIECE[id]) S.unlocked.add(id);
		S.combos = new Set(data.combos);
		S.goals = new Set(data.goals);
		S.clock = data.clock ?? 0.12;
		S.tutorial = !!data.tutorial;
		S.names = data.names ?? 0;
		S.gifts = data.gifts ?? 0;
		for (let i = 0; i < S.islands; i++) settleIsland(i);
		S.hasSave = [...S.pieces.values()].some((p) => !PIECE[p.t].fixed) || S.goals.size > 0;
		if (S.hasSave && data.seen) catchUp((Date.now() - data.seen) / 1000);
		return true;
	} catch {
		resetState();
		return false;
	}
}

/** Lets the world live on for the time the player was away. */
function catchUp(seconds: number): void {
	const time = Math.min(TUNE.awayCap, seconds);
	if (time < 90) return;
	const report: AwayReport = { seconds, trees: 0, elves: [], gifts: 0 };
	for (const p of S.pieces.values()) {
		if (p.t === 'tree' && (p.g ?? 1) < 1) {
			p.g = Math.min(1, (p.g ?? 0) + time / TUNE.treeGrowTime);
			if (p.g >= 1) report.trees++;
		} else if (p.t === 'cottage' && !p.h) {
			const index = S.names++;
			p.h = index + 1;
			report.elves.push(VILLAGER_NAMES[index % VILLAGER_NAMES.length]);
		}
	}
	report.gifts = Math.min(3, Math.floor(time / 900));
	S.gifts += report.gifts;
	S.clock = (S.clock + time / TUNE.dayLength) % 1;
	if (report.trees || report.elves.length || report.gifts) S.away = report;
}

export function wipeSave(): void {
	const tutorial = S.tutorial;
	resetState();
	S.tutorial = tutorial;
	S.hasSave = false;
	saveNow();
	S.hasSave = false;
}
