// The shape of a game, a fresh game, the planet maps, and save / load.

import { BLAST_COST, BLAST_GROWTH, CREW, CREW_MAX, MACHINES, PERKS, PLANETS, RESEARCH, SLOT_COSTS, TILE_GROUND, TILE_ORE, TILE_ROCK, upgradeCost } from './data.ts';
import {
	CENTER_PLOT,
	MAX_CELLS,
	MAX_COLS,
	MAX_ROWS,
	PLOT_RADIUS,
	PLOTS,
	cellIdx,
	inStride,
	plotBounds,
	plotIdx,
	plotRing,
} from './grid.ts';
import type { Bounds } from './grid.ts';
import { plotDoors, plotIssues, validatePlanetTiles } from './tile-access.ts';
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

/** Bump when baseTilesOf changes, so saves made on the old maps get fixed up on load. */
export const MAP_VERSION = 2;

export interface Game {
	v: 1;
	/** which map generator the layout was built on */
	map: number;
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

/** Credits a run starts with after a nova, per stardust held, so the rebuild gets going fast. */
export const NOVA_KIT = 250;

export function newGame(keep?: Game): Game {
	const perks = keep ? keep.perks : {};
	const extra = perks.hull ? 1 : 0;
	const g: Game = {
		v: 1,
		map: MAP_VERSION,
		credits: (perks.start ? 1000 : 0) + (keep ? keep.stardust * NOVA_KIT : 0),
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
		while (placed < want && tries < 200) {
			tries++;
			let x = b.x0 + Math.floor(r() * (b.x1 - b.x0 + 1));
			let y = b.y0 + Math.floor(r() * (b.y1 - b.y0 + 1));
			if (Math.abs(x - px) + Math.abs(y - py) < 3 || !free(x, y)) continue;
			const size = 2 + Math.floor(r() * 3);
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
		while (rocks < want && tries < 120) {
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
		const doors = new Set(plotDoors(plot));
		placeOre(plot, b, doors, ore);
		placeRocks(plot, b, doors, rocks + Math.floor(index / 2));
	}
	const issues = validatePlanetTiles(tiles, px, py);
	if (issues.length) {
		const msg = issues.map((i) => `cell ${i.cell} ${i.reason}`).join(', ');
		throw new Error(`${def.name}: ore accessibility failed (${msg})`);
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

/** Moves a save onto the current maps: machines that no longer fit and blasts on cells that are no longer rock are paid back. */
function fitToMap(g: Game) {
	for (let pi = 0; pi < PLANETS.length; pi++) {
		const tiles = baseTilesOf(pi);
		const value = PLANETS[pi].value;
		const kept: number[] = [];
		g.blasted[pi].forEach((c, n) => {
			if (tiles[c] === TILE_ROCK) kept.push(c);
			else g.credits += Math.ceil(BLAST_COST * value * Math.pow(BLAST_GROWTH, n));
		});
		g.blasted[pi] = kept;
		const now = tilesOf(pi, kept);
		const p = g.planets[pi];
		const bad = new Set<number>();
		p.cells.forEach((m, c) => {
			if (!m || m.t === 'pad') return;
			if (now[c] === TILE_ROCK || (m.t === 'drill' && now[c] !== TILE_ORE)) bad.add(c);
		});
		for (const c of [...bad]) {
			const link = p.cells[c]?.link;
			if (link !== undefined) bad.add(link);
		}
		const removed: Machine[] = [];
		for (const c of bad) {
			const m = p.cells[c];
			if (!m || m.t === 'pad') continue;
			removed.push(m);
			p.cells[c] = null;
			p.built[m.t] = Math.max(0, (p.built[m.t] ?? 0) - 1);
		}
		g.credits += layoutRefund(pi, removed);
	}
	g.map = MAP_VERSION;
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

// A bad number in a save (NaN, a string, a negative) would spread through the whole sim.
const amount = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
const count = (v: unknown, d = 0) => Math.floor(amount(v, d));
const ints = (v: unknown) => (Array.isArray(v) ? v.filter(Number.isInteger) : []);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isDir = (v: unknown): v is Dir => v === 0 || v === 1 || v === 2 || v === 3;

function cleanItems(v: unknown): BeltItem[] {
	if (!Array.isArray(v)) return [];
	return v.filter(isObj).map((i) => ({ k: count(i.k), p: Math.min(1, amount(i.p)), e: isDir(i.e) ? i.e : 0 }));
}

function cleanMachine(v: unknown): Machine | null {
	if (!isObj(v) || typeof v.t !== 'string' || !Object.hasOwn(MACHINES, v.t)) return null;
	const t = v.t as MachineType;
	const m = makeMachine(t, isDir(v.d) ? v.d : 0);
	m.lv = Math.min(MACHINES[t].maxLv, Math.max(1, count(v.lv, 1)));
	m.inb = ints(v.inb);
	m.out = ints(v.out);
	m.prog = Math.min(1, amount(v.prog));
	m.job = v.job === true;
	m.items = cleanItems(v.items);
	if (Number.isInteger(v.kind)) m.kind = v.kind as number;
	if (Array.isArray(v.thru)) m.thru = cleanItems(v.thru);
	if (Number.isInteger(v.link)) m.link = v.link as number;
	if (v.end === true) m.end = true;
	return m;
}

function cleanShip(v: unknown): Ship {
	const s = makeShip();
	if (!isObj(v)) return s;
	s.ph = v.ph === 1 || v.ph === 2 ? v.ph : 0;
	s.t = Math.min(1, amount(v.t));
	s.cargo = ints(v.cargo);
	s.wait = amount(v.wait);
	return s;
}

export function deserialize(text: string): Game | null {
	try {
		const raw = JSON.parse(text);
		if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.planets)) return null;
		const rawPlanets: unknown[] = raw.planets;
		const g = newGame();
		g.credits = amount(raw.credits);
		g.runEarned = amount(raw.runEarned);
		g.stardust = count(raw.stardust);
		g.peakIncome = amount(raw.peakIncome);
		g.tutorial = count(raw.tutorial);
		g.beaconLit = raw.beaconLit === true;
		g.savedAt = Math.min(Date.now(), amount(raw.savedAt, Date.now()));
		g.goals = strings(raw.goals);
		g.unlocks = strings(raw.unlocks);
		const stats = isObj(raw.stats) ? raw.stats : {};
		for (const k of Object.keys(g.stats) as (keyof Stats)[]) g.stats[k] = amount(stats[k]);
		const perks = isObj(raw.perks) ? raw.perks : {};
		for (const id of Object.keys(PERKS) as PerkId[]) if (perks[id] === true) g.perks[id] = true;
		const crew = isObj(raw.crew) ? raw.crew : {};
		const crewAt = isObj(raw.crewAt) ? raw.crewAt : {};
		for (const id of Object.keys(CREW) as CrewId[]) {
			const lv = Math.min(CREW_MAX, count(crew[id]));
			if (lv > 0) g.crew[id] = lv;
			const at = crewAt[id];
			if (Number.isInteger(at) && (at as number) >= 0 && (at as number) < PLANETS.length) g.crewAt[id] = at as number;
		}
		g.slots = Math.min(SLOT_COSTS.length, count(raw.slots));
		const research = isObj(raw.research) ? raw.research : {};
		for (const id of Object.keys(g.research) as ResearchId[]) g.research[id] = Math.min(RESEARCH[id].max, count(research[id]));
		const settings = isObj(raw.settings) ? raw.settings : {};
		const def = defaultSettings();
		g.settings = {
			sfx: Math.min(1, amount(settings.sfx, def.sfx)),
			music: Math.min(1, amount(settings.music, def.music)),
			vibrate: typeof settings.vibrate === 'boolean' ? settings.vibrate : def.vibrate,
			reduceMotion: typeof settings.reduceMotion === 'boolean' ? settings.reduceMotion : def.reduceMotion,
		};
		const blasted = Array.isArray(raw.blasted) ? raw.blasted : [];
		g.blasted = PLANETS.map((_, i) => ints(blasted[i]));
		g.planets = PLANETS.map((_, i) => {
			const base = makePlanet(i, i === 0, 0);
			const src = rawPlanets[i];
			if (!isObj(src) || !Array.isArray(src.cells)) return base;
			const up = isObj(src.up) ? src.up : {};
			const built = isObj(src.built) ? src.built : {};
			const planet: PlanetState = {
				...base,
				unlocked: i === 0 || src.unlocked === true,
				pad: ints(src.pad),
				ships: Array.isArray(src.ships) && src.ships.length ? src.ships.map(cleanShip) : base.ships,
				up: { ships: count(up.ships), speed: count(up.speed), cargo: count(up.cargo) },
				built: {},
				cells: src.cells.map(cleanMachine),
			};
			for (const t of Object.keys(MACHINES) as MachineType[]) if (count(built[t]) > 0) planet.built[t] = count(built[t]);
			if (Array.isArray(src.plots) && src.cells.length === MAX_CELLS) {
				planet.plots = ints(src.plots);
				if (!planet.plots.includes(CENTER_PLOT)) planet.plots.unshift(CENTER_PLOT);
				const [px, py] = PLANETS[i].pad;
				const padCell = cellIdx(px, py);
				if (planet.cells[padCell]?.t !== 'pad') planet.cells[padCell] = makeMachine('pad', 0);
				return planet;
			}
			// Saves from before land plots: the old map does not fit, so clear it and pay the machines back.
			g.credits += layoutRefund(i, planet.cells);
			g.blasted[i] = [];
			return { ...planet, cells: base.cells, built: {}, plots: base.plots };
		});
		if (raw.map !== MAP_VERSION) fitToMap(g);
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

/** A save code for what is on disk now, which is the last good state if the game broke since. */
export function exportStoredSave(): string | null {
	try {
		const text = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
		return text ? btoa(unescape(encodeURIComponent(text))) : null;
	} catch {
		return null;
	}
}

const ERROR_KEY = 'idle-orbit-errors';

/** Keeps the last few errors on the device, so a tester can copy them into a bug report. */
export function logError(text: string): string[] {
	let list: string[] = [];
	try {
		const old = JSON.parse(localStorage.getItem(ERROR_KEY) || '[]');
		if (Array.isArray(old)) list = old.filter((s) => typeof s === 'string');
	} catch {
		// A bad log is replaced.
	}
	list.push(`${new Date().toISOString()} ${text}`);
	list = list.slice(-10);
	try {
		localStorage.setItem(ERROR_KEY, JSON.stringify(list));
	} catch {
		// Storage is full or blocked.
	}
	return list;
}

export function importSave(code: string): Game | null {
	try {
		return deserialize(decodeURIComponent(escape(atob(code.trim()))));
	} catch {
		return null;
	}
}
