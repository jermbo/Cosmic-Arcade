// Ore placement rules for planet maps.
//
// 1. Every ore tile has ≥1 orthogonal ground neighbor (drill output).
// 2. At least one of those ground cells is reachable from the pad on ground only.
// 3. Each plot keeps its edge doors open and its ground in one piece, so any owned land can be crossed.

import { DX, DY } from './direction.ts';
import { TILE_GROUND, TILE_ORE } from './tiles.ts';
import { MAX_CELLS, MAX_COLS, MAX_ROWS, PLOT, STRIDE, cellIdx, plotBounds, plotCells } from './grid.ts';

export type OreAccessIssue = { cell: number; reason: 'no-exit' | 'no-path' };
export type PlotIssue = { plot: number; cell: number; reason: 'door' | 'pocket' | 'no-exit' };

/** Ground cells in the middle of each plot edge. Neighbor plots line up on them, so owned land always joins. */
export function plotDoors(plot: number): number[] {
	const b = plotBounds(plot);
	const out: number[] = [];
	for (const o of [PLOT / 2 - 1, PLOT / 2]) {
		out.push(cellIdx(b.x0 + o, b.y0), cellIdx(b.x0 + o, b.y1), cellIdx(b.x0, b.y0 + o), cellIdx(b.x1, b.y0 + o));
	}
	return out;
}

/** Plot rules: the doors are ground, all ground in the plot is one piece, and every ore borders that ground. */
export function plotIssues(tiles: Uint8Array, plot: number): PlotIssue[] {
	const b = plotBounds(plot);
	const inside = (c: number) => {
		const x = c % STRIDE;
		const y = (c / STRIDE) | 0;
		return x >= b.x0 && y >= b.y0 && x <= b.x1 && y <= b.y1;
	};
	const issues: PlotIssue[] = [];
	const doors = plotDoors(plot);
	for (const d of doors) if (tiles[d] !== TILE_GROUND) issues.push({ plot, cell: d, reason: 'door' });
	const seen = new Set<number>();
	const start = doors.find((d) => tiles[d] === TILE_GROUND);
	if (start !== undefined) {
		const q = [start];
		seen.add(start);
		for (let i = 0; i < q.length; i++) {
			for (const n of cellNeighbors(q[i]!)) {
				if (seen.has(n) || !inside(n) || tiles[n] !== TILE_GROUND) continue;
				seen.add(n);
				q.push(n);
			}
		}
	}
	for (const c of plotCells(plot)) {
		if (tiles[c] === TILE_GROUND && !seen.has(c)) issues.push({ plot, cell: c, reason: 'pocket' });
		else if (tiles[c] === TILE_ORE && !cellNeighbors(c).some((n) => inside(n) && tiles[n] === TILE_GROUND)) {
			issues.push({ plot, cell: c, reason: 'no-exit' });
		}
	}
	return issues;
}

/** Sizes of ore patches, counting diagonal touches as one patch. */
export function oreClusterSizes(tiles: Uint8Array): number[] {
	const seen = new Uint8Array(MAX_CELLS);
	const sizes: number[] = [];
	for (let c = 0; c < MAX_CELLS; c++) {
		if (tiles[c] !== TILE_ORE || seen[c]) continue;
		const q = [c];
		seen[c] = 1;
		for (let i = 0; i < q.length; i++) {
			const x = q[i]! % STRIDE;
			const y = (q[i]! / STRIDE) | 0;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || ny < 0 || nx >= MAX_COLS || ny >= MAX_ROWS) continue;
					const n = cellIdx(nx, ny);
					if (tiles[n] !== TILE_ORE || seen[n]) continue;
					seen[n] = 1;
					q.push(n);
				}
			}
		}
		sizes.push(q.length);
	}
	return sizes;
}

function cellNeighbors(c: number): number[] {
	const x = c % STRIDE;
	const y = (c / STRIDE) | 0;
	const out: number[] = [];
	for (let d = 0; d < 4; d++) {
		const nx = x + DX[d];
		const ny = y + DY[d];
		if (nx >= 0 && ny >= 0 && nx < MAX_COLS && ny < MAX_ROWS) out.push(cellIdx(nx, ny));
	}
	return out;
}

/** Ground cells next to ore — drills need one to output onto belts. */
export function oreGroundExits(tiles: Uint8Array, c: number): number[] {
	return cellNeighbors(c).filter((n) => tiles[n] === TILE_GROUND);
}

export function reachableGroundFromPad(tiles: Uint8Array, px: number, py: number): Set<number> {
	const seen = new Set<number>();
	const q: number[] = [];
	for (const n of cellNeighbors(cellIdx(px, py))) {
		if (tiles[n] === TILE_GROUND) {
			seen.add(n);
			q.push(n);
		}
	}
	for (let i = 0; i < q.length; i++) {
		const c = q[i]!;
		for (const n of cellNeighbors(c)) {
			if (tiles[n] === TILE_GROUND && !seen.has(n)) {
				seen.add(n);
				q.push(n);
			}
		}
	}
	return seen;
}

/** Step 1 — verify every ore tile meets access rules. */
export function validatePlanetTiles(tiles: Uint8Array, px: number, py: number): OreAccessIssue[] {
	const reach = reachableGroundFromPad(tiles, px, py);
	const issues: OreAccessIssue[] = [];
	for (let c = 0; c < MAX_CELLS; c++) {
		if (tiles[c] !== TILE_ORE) continue;
		const exits = oreGroundExits(tiles, c);
		if (!exits.length) issues.push({ cell: c, reason: 'no-exit' });
		else if (!exits.some((n) => reach.has(n))) issues.push({ cell: c, reason: 'no-path' });
	}
	return issues;
}
