// The shape of a game, a fresh game, the planet maps, and save / load.

import { MACHINES, PLANETS, TILE_GROUND, TILE_ORE, TILE_ROCK, upgradeCost } from './data.ts';
import {
	CENTER_PLOT,
	MAX_CELLS,
	MAX_COLS,
	MAX_ROWS,
	PLOT_RADIUS,
	PLOTS,
	STRIDE,
	cellIdx,
	plotBounds,
	plotIdx,
	plotRing,
} from './grid.ts';
import type { Bounds } from './grid.ts';
import { ensureOreAccessible, oreHasGroundExit, rockSealsOre, validatePlanetTiles } from './tile-access.ts';
import type { CrewId, Dir, MachineType, PerkId, ResearchId, ShipUpgrade } from './data.ts';

export interface BeltItem {
	/** item kind */
	k: number;
	/** progress along the belt, 0..1 */
	p: number;
	/** direction it moved when it came in */
	e: Dir;
}

export interface Machine {
	t: MachineType;
	d: Dir;
	lv: number;
	/** input buffer */
	inb: number[];
	/** output buffer */
	out: number[];
	/** job progress 0..1 */
	prog: number;
	job: boolean;
	/** belt items, front first */
	items: BeltItem[];
	/** item kind the current job makes */
	kind?: number;
	/** view only: glow 0..1, not saved */
	glow?: number;
	/** view only: input side for belt curves, -1 for straight */
	bend?: number;
	/** items passing through that this machine cannot use, front first */
	thru?: BeltItem[];
	/** blocked for a while (seconds), for hints */
	stuck?: number;
	/** bridge only: the cell of the other end */
	link?: number;
	/** bridge only: true for the end items come out of */
	end?: boolean;
}

export interface Ship {
	/** 0 at planet, 1 flying home, 2 flying back */
	ph: 0 | 1 | 2;
	t: number;
	cargo: number[];
	wait: number;
}

export interface PlanetState {
	unlocked: boolean;
	cells: (Machine | null)[];
	pad: number[];
	ships: Ship[];
	up: Record<ShipUpgrade, number>;
	/** counts of each machine bought, for prices */
	built: Partial<Record<MachineType, number>>;
	/** Owned land plots (see grid.ts). Always includes the center plot. */
	plots: number[];
}

export interface Settings {
	sfx: number;
	music: number;
	vibrate: boolean;
	reduceMotion: boolean;
}

export interface Stats {
	taps: number;
	shipped: number;
	flights: number;
	playTime: number;
	resets: number;
	allEarned: number;
}

export interface Game {
	v: 1;
	/** per planet: rock cells that were blasted away. Kept through a nova. */
	blasted: number[][];
	credits: number;
	/** earned this run */
	runEarned: number;
	stardust: number;
	perks: Partial<Record<PerkId, boolean>>;
	/** hired crew, by level. Kept through a nova. */
	crew: Partial<Record<CrewId, number>>;
	/** where each crew member works: a planet index. Missing means resting. Kept through a nova. */
	crewAt: Partial<Record<CrewId, number>>;
	/** crew slots bought with stardust. Kept through a nova. */
	slots: number;
	research: Record<ResearchId, number>;
	planets: PlanetState[];
	goals: string[];
	unlocks: string[];
	stats: Stats;
	settings: Settings;
	tutorial: number;
	beaconLit: boolean;
	peakIncome: number;
	savedAt: number;
}

export function makeShip(): Ship {
	return { ph: 0, t: 0, cargo: [], wait: 0 };
}

export function makeMachine(t: MachineType, d: Dir): Machine {
	return { t, d, lv: 1, inb: [], out: [], prog: 0, job: false, items: [] };
}

function makePlanet(index: number, unlocked: boolean, extraShips: number): PlanetState {
	const cells: (Machine | null)[] = new Array(MAX_CELLS).fill(null);
	const [px, py] = PLANETS[index].pad;
	cells[cellIdx(px, py)] = makeMachine('pad', 0);
	const ships: Ship[] = [];
	for (let i = 0; i < 1 + extraShips; i++) ships.push(makeShip());
	return { unlocked, cells, pad: [], ships, up: { ships: 0, speed: 0, cargo: 0 }, built: {}, plots: [CENTER_PLOT] };
}

export function defaultSettings(): Settings {
	return { sfx: 0.8, music: 0.5, vibrate: true, reduceMotion: false };
}

/** After a nova only Cinder is open, so working crew go back there. */
function crewHome(at: Partial<Record<CrewId, number>>) {
	const out: Partial<Record<CrewId, number>> = {};
	for (const id of Object.keys(at) as CrewId[]) if (at[id] !== undefined) out[id] = 0;
	return out;
}

export function newGame(keep?: Game): Game {
	const perks = keep ? keep.perks : {};
	const extra = perks.hull ? 1 : 0;
	const g: Game = {
		v: 1,
		credits: perks.start ? 1000 : 0,
		runEarned: 0,
		stardust: keep ? keep.stardust : 0,
		perks,
		crew: keep ? { ...keep.crew } : {},
		crewAt: keep ? crewHome(keep.crewAt) : {},
		slots: keep ? keep.slots : 0,
		research: { belt: 0, tap: 0, market: 0, offline: 0, blast: 0, bridges: 0, beacon: 0 },
		blasted: keep ? keep.blasted.map((a) => a.slice()) : PLANETS.map(() => []),
		planets: PLANETS.map((_, i) => makePlanet(i, i === 0, extra)),
		goals: [],
		unlocks: [],
		stats: keep ? keep.stats : { taps: 0, shipped: 0, flights: 0, playTime: 0, resets: 0, allEarned: 0 },
		settings: keep ? keep.settings : defaultSettings(),
		tutorial: keep ? 99 : 0,
		beaconLit: keep ? keep.beaconLit : false,
		peakIncome: 0,
		savedAt: Date.now(),
	};
	if (keep && perks.blueprint) {
		const old = keep.planets[0];
		const p = g.planets[0];
		// The layout comes back at level 1. Kept machines keep their count for prices.
		p.cells = old.cells.map((m) => (m ? makeMachine(m.t, m.d) : null));
		p.built = { ...old.built };
		p.plots = old.plots.slice();
	}
	if (keep && perks.start) g.unlocks.push('smelter', 'ships', 'research');
	return g;
}

// ---------- planet maps ----------

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
	const r = rng(def.seed * 7919);
	const tiles = new Uint8Array(MAX_CELLS);
	const [px, py] = def.pad;
	const nearPad = (x: number, y: number) => Math.abs(x - px) <= 1 && Math.abs(y - py) <= 1;
	const free = (x: number, y: number) =>
		x >= 0 && y >= 0 && x < MAX_COLS && y < MAX_ROWS && !nearPad(x, y) && tiles[cellIdx(x, y)] === TILE_GROUND;
	const inBox = (b: Bounds, x: number, y: number) => x >= b.x0 && y >= b.y0 && x <= b.x1 && y <= b.y1;
	const placeOre = (b: Bounds, want: number) => {
		let placed = 0;
		let tries = 0;
		while (placed < want && tries < 200) {
			tries++;
			let x = b.x0 + Math.floor(r() * (b.x1 - b.x0 + 1));
			let y = b.y0 + Math.floor(r() * (b.y1 - b.y0 + 1));
			if (Math.abs(x - px) + Math.abs(y - py) < 3 || !free(x, y)) continue;
			const size = 2 + Math.floor(r() * 3);
			for (let i = 0; i < size && placed < want; i++) {
				if (free(x, y) && oreHasGroundExit(tiles, x, y, STRIDE, MAX_COLS, MAX_ROWS)) {
					tiles[cellIdx(x, y)] = TILE_ORE;
					placed++;
				}
				const d = Math.floor(r() * 4);
				x += [1, 0, -1, 0][d];
				y += [0, 1, 0, -1][d];
				if (!inBox(b, x, y)) break;
			}
		}
	};
	const placeRocks = (b: Bounds, want: number) => {
		let rocks = 0;
		let tries = 0;
		while (rocks < want && tries < 120) {
			tries++;
			const x = b.x0 + Math.floor(r() * (b.x1 - b.x0 + 1));
			const y = b.y0 + Math.floor(r() * (b.y1 - b.y0 + 1));
			if (!free(x, y) || rockSealsOre(tiles, x, y, STRIDE, MAX_COLS, MAX_ROWS)) continue;
			tiles[cellIdx(x, y)] = TILE_ROCK;
			rocks++;
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
			ore = 4 + Math.floor(r() * 6); // 4–9 starter nodes
			rocks = 1 + Math.floor(r() * 2);
		} else {
			// Richer land further out; some plots are mostly rock.
			const roll = plot === firstRich ? 0 : r();
			const rich = 0.15 + ring * 0.12;
			if (roll < rich) {
				ore = 7 + ring * 2 + Math.floor(r() * 4);
				rocks = 1 + Math.floor(r() * 3);
			} else if (roll < rich + 0.3) {
				ore = Math.floor(r() * 3);
				rocks = 6 + Math.floor(r() * 5);
			} else {
				ore = 2 + Math.floor(r() * 4);
				rocks = 2 + Math.floor(r() * 3);
			}
		}
		placeOre(b, ore);
		placeRocks(b, rocks + Math.floor(index / 2));
	}
	ensureOreAccessible(tiles, px, py);
	const issues = validatePlanetTiles(tiles, px, py);
	if (issues.length) {
		const msg = issues.map((i) => `cell ${i.cell} ${i.reason}`).join(', ');
		throw new Error(`${def.name}: ore accessibility failed after fix-up (${msg})`);
	}
	tileCache[index] = tiles;
	return tiles;
}

/** What a layout cost to build, for paying it back. */
function layoutRefund(pi: number, cells: (Machine | null)[]): number {
	const value = PLANETS[pi].value;
	const count: Partial<Record<MachineType, number>> = {};
	let total = 0;
	for (const m of cells) {
		if (!m || m.t === 'pad') continue;
		const def = MACHINES[m.t];
		const n = count[m.t] ?? 0;
		count[m.t] = n + 1;
		total += m.t === 'belt' ? def.cost * value : def.cost * value * Math.pow(def.growth, n);
		for (let lv = 1; lv < (m.lv || 1); lv++) total += upgradeCost(m.t, lv, value);
	}
	return Math.ceil(total);
}

// ---------- save / load ----------

const KEY = 'idle-orbit-save-v1';
/** The game's first name. Saves made under it still load. */
const OLD_KEY = 'ore-drift-save-v1';

export function serialize(g: Game): string {
	const plain = {
		...g,
		planets: g.planets.map((p) => ({
			...p,
			cells: p.cells.map((m) => (m ? { t: m.t, d: m.d, lv: m.lv, inb: m.inb, out: m.out, prog: round(m.prog), job: m.job, kind: m.kind, items: m.items.map((i) => ({ k: i.k, p: round(i.p), e: i.e })), thru: m.thru?.length ? m.thru.map((i) => ({ k: i.k, p: round(i.p), e: i.e })) : undefined, link: m.link, end: m.end || undefined } : null)),
		})),
	};
	return JSON.stringify(plain);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function deserialize(text: string): Game | null {
	try {
		const raw = JSON.parse(text);
		if (!raw || raw.v !== 1 || !Array.isArray(raw.planets)) return null;
		const g = newGame();
		Object.assign(g, raw);
		g.settings = { ...defaultSettings(), ...raw.settings };
		g.crew = { ...raw.crew };
		g.crewAt = { ...raw.crewAt };
		g.slots = Number.isInteger(raw.slots) ? raw.slots : 0;
		g.research = { belt: 0, tap: 0, market: 0, offline: 0, blast: 0, bridges: 0, beacon: 0, ...raw.research };
		g.blasted = PLANETS.map((_, i) => (Array.isArray(raw.blasted?.[i]) ? raw.blasted[i].filter(Number.isInteger) : []));
		g.planets = PLANETS.map((_, i) => {
			const base = makePlanet(i, i === 0, 0);
			const src = raw.planets[i];
			if (!src) return base;
			const { expand: _e, revealed: _r, survey: _s, ...kept } = src;
			const planet: PlanetState = {
				...base,
				...kept,
				up: { ...base.up, ...src.up },
				cells: (src.cells as (Machine | null)[]).map((m) => (m ? { ...makeMachine(m.t, m.d), ...m, items: m.items || [] } : null)),
			};
			if (Array.isArray(src.plots) && src.cells.length === MAX_CELLS) {
				planet.plots = src.plots.filter(Number.isInteger);
				return planet;
			}
			// Saves from before land plots: the old map does not fit, so clear it and pay the machines back.
			g.credits += layoutRefund(i, planet.cells);
			g.blasted[i] = [];
			return { ...planet, cells: base.cells, built: {}, plots: base.plots };
		});
		return g;
	} catch {
		return null;
	}
}

export function saveGame(g: Game) {
	g.savedAt = Date.now();
	try {
		localStorage.setItem(KEY, serialize(g));
	} catch {
		// Storage is full or blocked; the game keeps running.
	}
}

export function loadGame(): Game | null {
	try {
		const text = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
		return text ? deserialize(text) : null;
	} catch {
		return null;
	}
}

export function clearSave() {
	try {
		localStorage.removeItem(KEY);
		localStorage.removeItem(OLD_KEY);
	} catch {
		// Nothing to clear.
	}
}

/** Short text to copy out a save. */
export function exportSave(g: Game): string {
	return btoa(unescape(encodeURIComponent(serialize(g))));
}

export function importSave(code: string): Game | null {
	try {
		return deserialize(decodeURIComponent(escape(atob(code.trim()))));
	} catch {
		return null;
	}
}
