/** The state of the game: the pieces, the land, the rules of placing, undo and saving. */

import { COMBOS, GOALS, ISLANDS, PIECE, PIECES, START_ISLANDS, TUNE, WORLD_RADIUS } from './content.ts';
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
	/** For a cottage: index of the villager name plus one, when a villager lives here. */
	h?: number;
}

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
	music: number;
	sound: number;
	quality: Quality;
}

interface SaveData {
	v: 1;
	pieces: Record<string, Piece>;
	lush: Record<string, number>;
	islands: number;
	unlocked: PieceId[];
	combos: string[];
	goals: string[];
	clock: number;
	tutorial: boolean;
	names: number;
}

const SAVE_KEY = 'petalwisp-isles.save';
const SETTINGS_KEY = 'petalwisp-isles.settings';

type Change = { k: string; before: Piece | null; after: Piece | null };

export const S = {
	pieces: new Map<string, Piece>(),
	lush: new Map<string, number>(),
	/** Land cells, with the index of their island. */
	land: new Map<string, number>(),
	islandCells: [] as [number, number][][],
	islands: START_ISLANDS,
	unlocked: new Set<PieceId>(),
	combos: new Set<string>(),
	goals: new Set<string>(),
	/** Time of day, 0..1. */
	clock: 0.12,
	tutorial: false,
	/** How many villager names were given out. */
	names: 0,
	settings: { music: 0.6, sound: 0.7, quality: 'medium' } as Settings,
	undo: [] as Change[][],
	redo: [] as Change[][],
	hasSave: false,
};

/** Listeners that the view and the life systems add. */
export const hooks = {
	/** Cells whose piece changed. `placed` is the cell that the player just built on, if any. */
	changed: [] as ((cells: string[], placed: string | null) => void)[],
	islandAdded: [] as ((index: number) => void)[],
};

/** The cells of one island: a round shape with a wavy edge. */
function cellsOfIsland(index: number): [number, number][] {
	const d = ISLANDS[index];
	const out: [number, number][] = [];
	const reach = Math.ceil(d.r * 1.3);
	for (let x = d.cx - reach; x <= d.cx + reach; x++) {
		for (let z = d.cz - reach; z <= d.cz + reach; z++) {
			const dx = x - d.cx;
			const dz = z - d.cz;
			const a = Math.atan2(dz, dx);
			const edge = d.r * (1 + 0.13 * Math.sin(3 * a + d.seed) + 0.07 * Math.sin(5 * a + d.seed * 1.7));
			if (Math.hypot(dx, dz) <= edge) out.push([x, z]);
		}
	}
	return out;
}

export function buildLand(): void {
	S.land.clear();
	S.islandCells = [];
	for (let i = 0; i < S.islands; i++) {
		const cells = cellsOfIsland(i);
		S.islandCells.push(cells);
		for (const [x, z] of cells) S.land.set(key(x, z), i);
	}
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
	S.undo = [];
	S.redo = [];
	buildLand();
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

export function erase(x: number, z: number): boolean {
	const k = key(x, z);
	const before = S.pieces.get(k);
	if (!before) return false;
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

/** How many sky islands a walker can reach from the main island. */
export function linkedIslands(): number {
	const seen = new Set<string>([key(0, 0)]);
	const reached = new Set<number>();
	const queue: [number, number][] = [[0, 0]];
	while (queue.length) {
		const [x, z] = queue.pop()!;
		const island = S.land.get(key(x, z));
		if (island !== undefined) reached.add(island);
		for (let d = 0; d < 4; d++) {
			const nx = x + DX[d];
			const nz = z + DZ[d];
			const k = key(nx, nz);
			if (seen.has(k)) continue;
			if (S.land.has(k) || S.pieces.get(k)?.t === 'bridge') {
				seen.add(k);
				queue.push([nx, nz]);
			}
		}
	}
	return reached.size - 1;
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
		case 'links':
			n = linkedIslands();
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
		if ('island' in g.reward && S.islands < ISLANDS.length) {
			S.islands++;
			buildLand();
			for (const h of hooks.islandAdded) h(S.islands - 1);
		}
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
		v: 1,
		pieces: Object.fromEntries(S.pieces),
		lush,
		islands: S.islands,
		unlocked: [...S.unlocked],
		combos: [...S.combos],
		goals: [...S.goals],
		clock: S.clock,
		tutorial: S.tutorial,
		names: S.names,
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
		if (data.v !== 1) return false;
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
		S.hasSave = S.pieces.size > 0 || S.goals.size > 0;
		return true;
	} catch {
		resetState();
		return false;
	}
}

export function wipeSave(): void {
	const tutorial = S.tutorial;
	resetState();
	S.tutorial = tutorial;
	S.hasSave = false;
	saveNow();
	S.hasSave = false;
}
