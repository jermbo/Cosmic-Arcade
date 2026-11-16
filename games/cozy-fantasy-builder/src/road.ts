/** Drawing a road: the player drags from one cell to another, sees the way, then says yes or no. */

import { PIECE, WORLD_RADIUS } from './content.ts';
import type { PieceId } from './content.ts';
import { isLand, isRiver, pieceAt, placeMany, placeProblem } from './state.ts';
import { DX, DZ, key } from './util.ts';
import { showRoute } from './view.ts';

export interface RouteCell {
	x: number;
	z: number;
	/** A new path goes here. The other cells are already a way to walk. */
	fresh: boolean;
}

export const road = {
	/** The player drags now. */
	active: false,
	/** The drag is over and the road waits for a yes or a no. */
	pending: false,
	cells: [] as RouteCell[],
	/** How many new pieces the road needs. */
	fresh: 0,
	/** What the drag draws: a path or a river. */
	tool: 'path' as PieceId,
};

let startX = 0;
let startZ = 0;
let endKey = '';

/** Finds the best way between two cells. It goes around buildings and likes straight lines and old roads. */
function findRoute(sx: number, sz: number, tx: number, tz: number): RouteCell[] {
	const pad = 7;
	const x0 = Math.min(sx, tx) - pad;
	const x1 = Math.max(sx, tx) + pad;
	const z0 = Math.min(sz, tz) - pad;
	const z1 = Math.max(sz, tz) + pad;
	const ends = new Set([key(sx, sz), key(tx, tz)]);
	const open = (x: number, z: number): boolean => {
		if (x < x0 || x > x1 || z < z0 || z > z1 || Math.hypot(x, z) > WORLD_RADIUS) return false;
		const p = pieceAt(x, z);
		if (!p) return isLand(x, z);
		if (ends.has(key(x, z))) return true;
		// A path can cross a river, and a river can cross a path.
		if (road.tool === 'pond') return isRiver(p.t) || p.t === 'path' || p.t === 'waterfall';
		return !!PIECE[p.t].walk || p.t === 'pond';
	};
	/** An old road of the same kind is cheap. A crossing costs more, so the road crosses the short way. */
	const stepCost = (x: number, z: number): number => {
		const p = pieceAt(x, z);
		if (!p) return 1;
		if (p.t === 'crossing') return 0.35;
		const same = road.tool === 'pond' ? p.t !== 'path' : p.t !== 'pond';
		return same ? 0.35 : 1.6;
	};
	if (!open(sx, sz) || !open(tx, tz)) return [];

	// Each state is a cell and the direction of the last step, so that a turn can cost a little.
	const id = (x: number, z: number, d: number): string => `${x},${z},${d}`;
	const cost = new Map<string, number>();
	const prev = new Map<string, string | null>();
	const at = new Map<string, [number, number, number]>();
	const queue: string[] = [];
	for (let d = 0; d < 4; d++) {
		const s = id(sx, sz, d);
		cost.set(s, 0);
		prev.set(s, null);
		at.set(s, [sx, sz, d]);
		queue.push(s);
	}
	let goal: string | null = null;
	while (queue.length) {
		let bi = 0;
		for (let i = 1; i < queue.length; i++) if (cost.get(queue[i])! < cost.get(queue[bi])!) bi = i;
		const cur = queue.splice(bi, 1)[0];
		const [x, z, dir] = at.get(cur)!;
		if (x === tx && z === tz) {
			goal = cur;
			break;
		}
		for (let d = 0; d < 4; d++) {
			const nx = x + DX[d];
			const nz = z + DZ[d];
			if (!open(nx, nz)) continue;
			const step = stepCost(nx, nz) + (d === dir || (x === sx && z === sz) ? 0 : 0.15);
			const n = id(nx, nz, d);
			const c = cost.get(cur)! + step;
			const old = cost.get(n);
			if (old !== undefined && old <= c) continue;
			cost.set(n, c);
			prev.set(n, cur);
			at.set(n, [nx, nz, d]);
			if (old === undefined) queue.push(n);
		}
	}
	const out: RouteCell[] = [];
	for (let k = goal; k; k = prev.get(k) ?? null) {
		const [x, z] = at.get(k)!;
		out.unshift({ x, z, fresh: placeProblem(road.tool, x, z) === null });
	}
	return out;
}

function set(cells: RouteCell[]): void {
	road.cells = cells;
	road.fresh = cells.filter((c) => c.fresh).length;
	showRoute(cells, road.tool === 'pond');
}

export function roadStart(x: number, z: number, tool: PieceId = 'path'): void {
	road.tool = tool;
	road.active = true;
	road.pending = false;
	startX = x;
	startZ = z;
	endKey = '';
	set([]);
}

/** The finger moved to a new cell. */
export function roadTo(x: number, z: number): void {
	if (!road.active || key(x, z) === endKey) return;
	endKey = key(x, z);
	const cells = findRoute(startX, startZ, x, z);
	// With no way to the new cell, the last good road stays.
	if (cells.length || !road.cells.length) set(cells);
}

/** The finger lifts. The road now waits for the player. Returns false when there is nothing to build. */
export function roadDrop(): boolean {
	road.active = false;
	road.pending = road.fresh > 0;
	if (!road.pending) set([]);
	return road.pending;
}

export function roadCancel(): void {
	road.active = road.pending = false;
	set([]);
}

/** Builds the road. Returns how many paths were placed. */
export function roadCommit(): number {
	const cells = road.cells.filter((c) => c.fresh).map((c): [number, number] => [c.x, c.z]);
	roadCancel();
	return placeMany(road.tool, cells);
}
