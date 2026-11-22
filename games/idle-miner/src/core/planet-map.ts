// The planet maps: where the ore and the rocks are. A seed makes the same map each time.

import { PLANET_MAP as M } from '../content/planet-maps.ts';
import type { RandomCount } from '../content/planet-maps.ts';
import { PLANETS } from '../content/planets.ts';
import { TILE_GROUND, TILE_ORE, TILE_ROCK } from './tiles.ts';
import { MAX_CELLS, MAX_COLS, MAX_ROWS, PLOT_RADIUS, PLOTS, cellIdx, inStride, plotBounds, plotIdx, plotRing } from './grid.ts';
import type { Bounds } from './grid.ts';
import { plotDoors, plotIssues, validatePlanetTiles } from './tile-access.ts';

/** Bump when baseTilesOf changes, so saves made on the old maps get fixed up on load. */
export const MAP_VERSION = 2;

function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A count from min to min + spread - 1. */
function roll(r: () => number, count: RandomCount): number {
	return count.min + Math.floor(r() * count.spread);
}

const tileCache: Uint8Array[] = [];

const blastCache = new WeakMap<readonly number[], { n: number; tiles: Uint8Array }>();

/** Clears cached base maps (tests and validate-tiles). */
export function clearPlanetTileCache(): void {
	tileCache.length = 0;
}

/** The ground of a planet now: the base map, minus any rocks that were blasted. */
export function tilesOf(index: number, blasted?: readonly number[]): Uint8Array {
	const base = baseTilesOf(index);
	if (!blasted || !blasted.length) return base;
	const hit = blastCache.get(blasted);
	if (hit && hit.n === blasted.length) return hit.tiles;
	const tiles = base.slice();
	for (const c of blasted) if (tiles[c] === TILE_ROCK) tiles[c] = TILE_GROUND;
	blastCache.set(blasted, { n: blasted.length, tiles });
	return tiles;
}

/** The ground of a planet as first made: ore, rock, plain. Same every time for a planet. */
export function baseTilesOf(index: number): Uint8Array {
	if (tileCache[index]) return tileCache[index];
	const def = PLANETS[index];
	const r = rng(def.seed * M.seedFactor);
	const tiles = new Uint8Array(MAX_CELLS);
	const [px, py] = def.pad;
	const nearPad = (x: number, y: number) => Math.abs(x - px) <= M.padClearance && Math.abs(y - py) <= M.padClearance;
	const free = (x: number, y: number) =>
		x >= 0 && y >= 0 && x < MAX_COLS && y < MAX_ROWS && !nearPad(x, y) && tiles[cellIdx(x, y)] === TILE_GROUND;
	const inBox = (b: Bounds, x: number, y: number) => x >= b.x0 && y >= b.y0 && x <= b.x1 && y <= b.y1;
	// Ore patches keep a gap of ground between them, diagonals included.
	const nearOtherOre = (x: number, y: number, patch: Set<number>) => {
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				const c = cellIdx(x + dx, y + dy);
				if (inStride(x + dx, y + dy) && tiles[c] === TILE_ORE && !patch.has(c)) return true;
			}
		}
		return false;
	};
	// Sets a tile only if the plot still follows its rules (see plotIssues).
	const trySet = (plot: number, c: number, t: number) => {
		tiles[c] = t;
		if (!plotIssues(tiles, plot).length) return true;
		tiles[c] = TILE_GROUND;
		return false;
	};
	const placeOre = (plot: number, b: Bounds, doors: Set<number>, want: number) => {
		let placed = 0;
		let tries = 0;
		while (placed < want && tries < M.oreTries) {
			tries++;
			let x = b.x0 + Math.floor(r() * (b.x1 - b.x0 + 1));
			let y = b.y0 + Math.floor(r() * (b.y1 - b.y0 + 1));
			if (Math.abs(x - px) + Math.abs(y - py) < M.oreDistanceFromPad || !free(x, y)) continue;
			const size = roll(r, M.patchSize);
			const patch = new Set<number>();
			for (let i = 0; i < size && placed < want; i++) {
				const c = cellIdx(x, y);
				if (free(x, y) && !doors.has(c) && !nearOtherOre(x, y, patch) && trySet(plot, c, TILE_ORE)) {
					patch.add(c);
					placed++;
				}
				const d = Math.floor(r() * 4);
				x += [1, 0, -1, 0][d];
				y += [0, 1, 0, -1][d];
				if (!inBox(b, x, y)) break;
			}
		}
	};
	const placeRocks = (plot: number, b: Bounds, doors: Set<number>, want: number) => {
		let rocks = 0;
		let tries = 0;
		while (rocks < want && tries < M.rockTries) {
			tries++;
			const x = b.x0 + Math.floor(r() * (b.x1 - b.x0 + 1));
			const y = b.y0 + Math.floor(r() * (b.y1 - b.y0 + 1));
			const c = cellIdx(x, y);
			if (free(x, y) && !doors.has(c) && trySet(plot, c, TILE_ROCK)) rocks++;
		}
	};
	// One plot next to the start is always rich, so the first purchase pays off.
	const firstRich = [
		plotIdx(PLOT_RADIUS + 1, PLOT_RADIUS),
		plotIdx(PLOT_RADIUS, PLOT_RADIUS + 1),
		plotIdx(PLOT_RADIUS - 1, PLOT_RADIUS),
		plotIdx(PLOT_RADIUS, PLOT_RADIUS - 1),
	][Math.floor(r() * 4)];
	for (let plot = 0; plot < PLOTS * PLOTS; plot++) {
		const ring = plotRing(plot);
		const b = plotBounds(plot);
		let ore: number;
		let rocks: number;
		if (ring === 0) {
			ore = roll(r, M.start.ore);
			rocks = roll(r, M.start.rocks);
		} else {
			const chance = plot === firstRich ? 0 : r();
			const rich = M.richChance.base + ring * M.richChance.perRing;
			if (chance < rich) {
				ore = roll(r, M.rich.ore) + ring * M.richOrePerRing;
				rocks = roll(r, M.rich.rocks);
			} else if (chance < rich + M.rockyChance) {
				ore = roll(r, M.rocky.ore);
				rocks = roll(r, M.rocky.rocks);
			} else {
				ore = roll(r, M.plain.ore);
				rocks = roll(r, M.plain.rocks);
			}
		}
		const doors = new Set(plotDoors(plot));
		placeOre(plot, b, doors, ore);
		placeRocks(plot, b, doors, rocks + Math.floor(index / M.extraRockEveryPlanets));
	}
	const issues = validatePlanetTiles(tiles, px, py);
	if (issues.length) {
		const msg = issues.map((i) => `cell ${i.cell} ${i.reason}`).join(', ');
		throw new Error(`${def.name}: ore accessibility failed (${msg})`);
	}
	tileCache[index] = tiles;
	return tiles;
}
