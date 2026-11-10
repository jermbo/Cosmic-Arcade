// Questions about a factory layout: where a machine sends its items, how belts look, and the pylon boosts.

import { MACHINES } from '../content/machines.ts';
import { DX, DY, opposite } from './direction.ts';
import type { Dir } from './direction.ts';
import { formOfKind, isCrate } from './items.ts';
import { pylonBoost } from './levels.ts';
import { MAX_CELLS, cellIdx, cellX, cellY, inPlay, ownedBounds } from './grid.ts';
import type { Game, Machine, PlanetState } from './game.ts';

export const idx = cellIdx;

/** Node bot helper — playable bounds on a planet. */
export function inGrid(g: Game, pi: number, x: number, y: number) {
	return inPlay(x, y, g.planets[pi], pi);
}

export function targetOf(c: number, d: Dir, planet: PlanetState, pi: number): number {
	const x = cellX(c) + DX[d];
	const y = cellY(c) + DY[d];
	return inPlay(x, y, planet, pi) ? idx(x, y) : -1;
}

/** Does machine n at cell nc send items into cell c? */
function feeds(n: Machine, nc: number, c: number, p: PlanetState, pi: number): boolean {
	if (n.t === 'pad' || n.t === 'pylon') return false;
	if (n.t === 'cross') return true;
	if (n.t === 'bridge' && !n.end) return false;
	return targetOf(nc, n.d, p, pi) === c;
}

/** A belt with nothing feeding it from the sides, so a line can cross it. Cells in `skip` do not count. */
export function straightBelt(g: Game, pi: number, c: number, skip: number[] = []): boolean {
	const p = g.planets[pi];
	const m = p.cells[c];
	if (!m || m.t !== 'belt') return false;
	for (const side of [(m.d + 1) % 4, (m.d + 3) % 4] as Dir[]) {
		const nc = targetOf(c, side, p, pi);
		const n = nc >= 0 && !skip.includes(nc) ? p.cells[nc] : null;
		if (n && feeds(n, nc, c, p, pi)) return false;
	}
	return true;
}

/** Which way each lane of a crossing flows: [across, down]. */
export function crossLanes(p: PlanetState, c: number, pi: number): [Dir, Dir] {
	const lanes: [Dir, Dir] = [0, 1];
	const m = p.cells[c]!;
	for (const axis of [0, 1] as const) {
		const it = m.items.find((i) => i.e % 2 === axis);
		if (it) {
			lanes[axis] = it.e;
			continue;
		}
		// Empty lane: go by whichever side feeds it.
		for (const d of (axis === 0 ? [0, 2] : [1, 3]) as Dir[]) {
			const nc = targetOf(c, opposite(d), p, pi);
			const n = nc >= 0 ? p.cells[nc] : null;
			if (n && n.t !== 'cross' && feeds(n, nc, c, p, pi)) {
				lanes[axis] = d;
				break;
			}
		}
	}
	return lanes;
}

/** Tiles from a bridge's start to its end. */
export function bridgeSpan(c: number, link: number): number {
	return Math.abs(cellX(link) - cellX(c)) + Math.abs(cellY(link) - cellY(c));
}

/** A bridge start whose far end is still there. */
export function bridgeOk(p: PlanetState, c: number, m: Machine): boolean {
	if (m.link === undefined) return false;
	const e = p.cells[m.link];
	return !!e && e.t === 'bridge' && !!e.end && e.link === c;
}

/** Can this machine use item k as an input at all? */
export function uses(m: Machine, k: number): boolean {
	if (isCrate(k)) return false;
	if (m.t === 'compactor') return true;
	return MACHINES[m.t].inputs.includes(formOfKind(k));
}

const boostMap = new WeakMap<PlanetState, Float32Array>();

export function markDirty(p: PlanetState) {
	boostMap.delete(p);
}

export function derived(p: PlanetState, pi: number): Float32Array {
	let b = boostMap.get(p);
	if (b) return b;
	b = new Float32Array(MAX_CELLS).fill(1);
	const box = ownedBounds(p);
	for (let y = box.y0; y <= box.y1; y++) {
		for (let x = box.x0; x <= box.x1; x++) {
			const i = cellIdx(x, y);
			const m = p.cells[i];
			if (!m) continue;
			if (m.t === 'pylon') {
				for (let oy = -1; oy <= 1; oy++)
					for (let ox = -1; ox <= 1; ox++)
						if ((ox || oy) && inPlay(x + ox, y + oy, p, pi)) b[idx(x + ox, y + oy)] += pylonBoost(m.lv);
			}
			if (m.t === 'belt') m.bend = beltBend(p, i, m, pi);
		}
	}
	boostMap.set(p, b);
	return b;
}

/** For drawing: if the only thing feeding this belt is from a side, the belt curves. */
function beltBend(p: PlanetState, i: number, m: Machine, pi: number): number {
	const x = cellX(i);
	const y = cellY(i);
	const back = opposite(m.d);
	let side = -1;
	let count = 0;
	let fromBack = false;
	for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
		if (d === m.d) continue;
		const nx = x + DX[d];
		const ny = y + DY[d];
		if (!inPlay(nx, ny, p, pi)) continue;
		const n = p.cells[idx(nx, ny)];
		if (!n || n.t === 'pylon' || n.t === 'pad') continue;
		if (n.t === 'bridge' && !n.end) continue;
		// A crossing only sends items straight on, so it counts only from behind.
		if (n.t === 'cross') {
			if (d === back) {
				count++;
				fromBack = true;
			}
			continue;
		}
		if (n.d === opposite(d)) {
			count++;
			if (d === back) fromBack = true;
			else side = d;
		}
	}
	return count === 1 && !fromBack && side >= 0 ? opposite(side as Dir) : -1;
}

export function boostAt(p: PlanetState, i: number, pi: number) {
	return derived(p, pi)[i];
}
