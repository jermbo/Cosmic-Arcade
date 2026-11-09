// Save and load a game: on the device, as a code to copy, and the repair of old saves.

import { CREW, CREW_MAX } from '../content/crew.ts';
import type { CrewId } from '../content/crew.ts';
import { BLAST_COST, BLAST_GROWTH } from '../content/land.ts';
import { MACHINES } from '../content/machines.ts';
import type { MachineType } from '../content/machines.ts';
import { SLOT_COSTS } from '../content/nova.ts';
import { PERKS } from '../content/perks.ts';
import type { PerkId } from '../content/perks.ts';
import { PLANETS } from '../content/planets.ts';
import { RESEARCH } from '../content/research.ts';
import type { ResearchId } from '../content/research.ts';
import type { Dir } from './direction.ts';
import { upgradeCost } from './prices.ts';
import { TILE_ORE, TILE_ROCK } from './tiles.ts';
import type { BeltItem, Game, Machine, PlanetState, Ship, Stats } from './game.ts';
import { CENTER_PLOT, MAX_CELLS, cellIdx } from './grid.ts';
import { MAP_VERSION, baseTilesOf, tilesOf } from './planet-map.ts';
import { defaultSettings, makeMachine, makePlanet, makeShip, newGame } from './state.ts';

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

export function importSave(code: string): Game | null {
	try {
		return deserialize(decodeURIComponent(escape(atob(code.trim()))));
	} catch {
		return null;
	}
}
