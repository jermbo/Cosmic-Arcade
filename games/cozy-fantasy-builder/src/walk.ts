/** Where walkers can go, and the shortest ways there. */

import { PIECE } from './content.ts';
import { isLand, pieceAt, S } from './state.ts';
import { DX, DZ, key, unkey } from './util.ts';

export type Reach = Map<string, { cost: number; prev: string | null }>;

/** Can a walker stand on this cell? */
export function canWalk(x: number, z: number): boolean {
	const p = pieceAt(x, z);
	if (p) return !!PIECE[p.t].walk;
	return isLand(x, z);
}

const stepCost = (x: number, z: number): number => (pieceAt(x, z) ? 1 : 2.6);

/** Shortest ways from one cell to every cell that a walker can reach. */
export function reachFrom(sx: number, sz: number): Reach {
	const out: Reach = new Map();
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

export function pathTo(reach: Reach, goal: string): [number, number][] {
	const out: [number, number][] = [];
	let k: string | null = goal;
	while (k) {
		out.unshift(unkey(k));
		k = reach.get(k)!.prev;
	}
	return out;
}

/** The cell in front of the door of a building, or a free cell next to it. */
export function doorCell(at: string): [number, number] | null {
	const p = S.pieces.get(at);
	if (!p) return null;
	const [x, z] = unkey(at);
	for (let i = 0; i < 4; i++) {
		const d = (p.r + i) % 4;
		if (canWalk(x + DX[d], z + DZ[d])) return [x + DX[d], z + DZ[d]];
	}
	return null;
}
