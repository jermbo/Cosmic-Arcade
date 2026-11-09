// Ore placement rules and post-generation fixes for planet maps.
//
// 1. Every ore tile has ≥1 orthogonal ground neighbor (drill output).
// 2. At least one of those ground cells is reachable from the pad on ground only.
// 3. Generation constrains random ore/rock placement; ensureOreAccessible fixes stragglers.

import { CELLS, COLS, DX, DY, ROWS, TILE_GROUND, TILE_ORE, TILE_ROCK } from './data.ts';

export type OreAccessIssue = { cell: number; reason: 'no-exit' | 'no-path' };

function cellNeighbors(c: number): number[] {
	const x = c % COLS;
	const y = (c / COLS) | 0;
	const out: number[] = [];
	for (let d = 0; d < 4; d++) {
		const nx = x + DX[d];
		const ny = y + DY[d];
		if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) out.push(ny * COLS + nx);
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
	for (const n of cellNeighbors(py * COLS + px)) {
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
	for (let c = 0; c < CELLS; c++) {
		if (tiles[c] !== TILE_ORE) continue;
		const exits = oreGroundExits(tiles, c);
		if (!exits.length) issues.push({ cell: c, reason: 'no-exit' });
		else if (!exits.some((n) => reach.has(n))) issues.push({ cell: c, reason: 'no-path' });
	}
	return issues;
}

function openOreExit(tiles: Uint8Array, c: number): void {
	if (oreGroundExits(tiles, c).length) return;
	const rocks = cellNeighbors(c).filter((n) => tiles[n] === TILE_ROCK);
	if (rocks.length) {
		tiles[rocks[0]!] = TILE_GROUND;
		return;
	}
	const ores = cellNeighbors(c).filter((n) => tiles[n] === TILE_ORE);
	if (ores.length) tiles[ores[0]!] = TILE_GROUND;
}

function connectOreToPad(tiles: Uint8Array, oreC: number, reach: Set<number>): void {
	const targets = new Set(oreGroundExits(tiles, oreC));
	if ([...targets].some((n) => reach.has(n))) return;
	const parent = new Map<number, number>();
	const q: number[] = [];
	for (const s of reach) {
		q.push(s);
		parent.set(s, -2);
	}
	const seen = new Set(reach);
	while (q.length) {
		const c = q.shift()!;
		if (targets.has(c)) {
			let cur: number | -2 = c;
			while (cur !== -2) {
				if (tiles[cur] === TILE_ROCK) tiles[cur] = TILE_GROUND;
				cur = parent.get(cur)!;
			}
			return;
		}
		for (const n of cellNeighbors(c)) {
			if (seen.has(n)) continue;
			const t = tiles[n];
			if (t !== TILE_GROUND && t !== TILE_ROCK) continue;
			seen.add(n);
			parent.set(n, c);
			q.push(n);
		}
	}
}

function pokeOpenCorridor(tiles: Uint8Array, oreC: number, reach: Set<number>): boolean {
	for (const g of oreGroundExits(tiles, oreC)) {
		if (reach.has(g)) continue;
		for (const n of cellNeighbors(g)) {
			if (tiles[n] === TILE_ROCK) {
				tiles[n] = TILE_GROUND;
				return true;
			}
		}
		for (const n of cellNeighbors(g)) {
			if (tiles[n] === TILE_ORE) {
				tiles[n] = TILE_GROUND;
				return true;
			}
		}
	}
	return false;
}

/** Step 3 — post-process a generated map. */
export function ensureOreAccessible(tiles: Uint8Array, px: number, py: number): void {
	for (let c = 0; c < CELLS; c++) if (tiles[c] === TILE_ORE) openOreExit(tiles, c);
	for (let pass = 0; pass < 64; pass++) {
		const reach = reachableGroundFromPad(tiles, px, py);
		let stuck = -1;
		for (let c = 0; c < CELLS; c++) {
			if (tiles[c] !== TILE_ORE) continue;
			if (oreGroundExits(tiles, c).some((n) => reach.has(n))) continue;
			stuck = c;
			connectOreToPad(tiles, c, reach);
			if (oreGroundExits(tiles, c).some((n) => reachableGroundFromPad(tiles, px, py).has(n))) break;
			if (!pokeOpenCorridor(tiles, c, reach)) openOreExit(tiles, c);
			break;
		}
		if (stuck < 0) return;
	}
}

/** Step 2 — only place new ore on cells that border ground. */
export function oreHasGroundExit(tiles: Uint8Array, x: number, y: number): boolean {
	for (const n of cellNeighbors(y * COLS + x)) if (tiles[n] === TILE_GROUND) return true;
	return false;
}

/** Step 2 — skip rocks that would remove an ore's last ground exit. */
export function rockSealsOre(tiles: Uint8Array, x: number, y: number): boolean {
	const c = y * COLS + x;
	for (const n of cellNeighbors(c)) {
		if (tiles[n] !== TILE_ORE) continue;
		let exits = 0;
		for (const g of cellNeighbors(n)) {
			if (g === c) continue;
			if (tiles[g] === TILE_GROUND) exits++;
		}
		if (exits === 0) return true;
	}
	return false;
}
