// The game rules: factories, belts, ships, prices and every action a player can take.
// No DOM here, so tools/bot.ts can run it in Node.

import {
	BELT_SPACING,
	BLAST_COST,
	BRIDGE_SPAN,
	BLAST_GROWTH,
	BUF_IN,
	BUF_OUT,
	CRATE_BONUS,
	CRATE_SIZE,
	DUST_BONUS,
	DX,
	DY,
	FORM_VALUE,
	MACHINES,
	PERKS,
	PLANETS,
	PRESTIGE_PLANET,
	RESEARCH,
	SHIP_UPS,
	TILE_ORE,
	TILE_ROCK,
	BASE_OFFLINE_HOURS,
	BASE_SLOTS,
	CREW,
	CREW_MAX,
	CREW_ORDER,
	NO_BOOST,
	SLOT_COSTS,
	addCrew,
	crewCostAt,
	beltSpeed,
	formOfKind,
	isCrate,
	kindOf,
	levelSpeed,
	opposite,
	planetOfKind,
	pylonBoost,
	shipCargo,
	shipSpeed,
	stardustFor,
	tapPower,
	upgradeCost,
} from './data.ts';
import type { CrewBoost, CrewId, Dir, MachineType, PerkId, ResearchId, ShipUpgrade } from './data.ts';
import {
	MAX_CELLS,
	buyablePlots,
	cellIdx,
	cellX,
	cellY,
	countOreInCells,
	inPlay,
	nextPlotCost,
	ownedBounds,
	ownedPlots,
	plotCells,
} from './grid.ts';
import { makeMachine, makeShip, newGame, tilesOf } from './state.ts';
import type { BeltItem, Game, Machine, PlanetState } from './state.ts';

export type GameEvent =
	| { type: 'sold'; planet: number; amount: number; count: number }
	| { type: 'made'; planet: number; cell: number; t: MachineType }
	| { type: 'depart'; planet: number }
	| { type: 'dock'; planet: number }
	| { type: 'unlock'; id: string; title: string; text: string }
	| { type: 'goal'; text: string; reward: number };

export const events: GameEvent[] = [];
let emitOn = true;
export function setEvents(on: boolean) {
	emitOn = on;
	events.length = 0;
}
export function emit(e: GameEvent) {
	if (emitOn && events.length < 400) events.push(e);
}

// ---------- income meter ----------

const BUCKETS = 20;
const income = { buckets: new Array<number>(BUCKETS).fill(0), i: 0, t: 0, filled: 1 };
export function resetIncome() {
	income.buckets.fill(0);
	income.i = 0;
	income.t = 0;
	income.filled = 1;
}
function addIncome(n: number) {
	income.buckets[income.i] += n;
}
function stepIncome(dt: number) {
	income.t += dt;
	while (income.t >= 1) {
		income.t -= 1;
		income.i = (income.i + 1) % BUCKETS;
		income.buckets[income.i] = 0;
		income.filled = Math.min(BUCKETS - 1, income.filled + 1);
	}
}
/** Credits per second from cargo, over the last 20 seconds. */
export function incomeRate(): number {
	let sum = 0;
	for (let k = 0; k < BUCKETS; k++) if (k !== income.i) sum += income.buckets[k];
	return sum / income.filled;
}

// ---------- values ----------

export function sellMult(g: Game) {
	return (1 + 0.2 * g.research.market) * (1 + DUST_BONUS * g.stardust);
}

export function itemValue(k: number) {
	const f = formOfKind(k);
	const base = PLANETS[planetOfKind(k)].value * FORM_VALUE[f % 5];
	return isCrate(k) ? base * CRATE_SIZE * CRATE_BONUS : base;
}

export function tapValue(g: Game, planet: number) {
	const base = PLANETS[planet].value * tapPower(g.research.tap) * (g.perks.hands ? 5 : 1) * sellMult(g);
	return Math.max(base, incomeRate() * 0.04 * (1 + g.research.tap * 0.25));
}

/** Adds credits. Only cargo sales count toward the income meter. */
export function earn(g: Game, n: number, sale = false) {
	g.credits += n;
	g.runEarned += n;
	g.stats.allEarned += n;
	if (sale) addIncome(n);
}

export function tap(g: Game, planet: number): number {
	const v = tapValue(g, planet);
	earn(g, v);
	g.stats.taps++;
	return v;
}

// ---------- unlock checks ----------

export function machineUnlocked(g: Game, t: MachineType): boolean {
	if (t === 'drill' || t === 'belt') return true;
	if (t === 'cross' || t === 'bridge') return g.research.bridges > 0;
	if (t === 'smelter') return g.unlocks.includes('smelter');
	const i = PLANETS.findIndex((p) => p.newMachine === t);
	return i >= 0 && g.planets[i].unlocked;
}

/** Toolbar on a planet: no crushers on Cinder, etc. */
export function toolOnPlanet(g: Game, pi: number, t: MachineType): boolean {
	if (!machineUnlocked(g, t)) return false;
	if (t === 'drill' || t === 'belt' || t === 'cross' || t === 'bridge' || t === 'smelter') return true;
	const intro = PLANETS.findIndex((p) => p.newMachine === t);
	if (intro < 0) return true;
	return pi >= intro;
}

export function buyPlot(g: Game, pi: number, plot: number): { ok: true; ore: number } | { ok: false } {
	const p = g.planets[pi];
	if (!p.unlocked || !buyablePlots(p).includes(plot)) return { ok: false };
	const cost = nextPlotCost(pi, p);
	if (g.credits < cost) return { ok: false };
	g.credits -= cost;
	ownedPlots(p).push(plot);
	markDirty(p);
	return { ok: true, ore: countOreInCells(tilesOf(pi, g.blasted[pi]), plotCells(plot), TILE_ORE) };
}

export function cheapestPlot(g: Game, pi: number): number {
	const p = g.planets[pi];
	if (!buyablePlots(p).length) return 0;
	return nextPlotCost(pi, p);
}

export function offlineCapHours(g: Game) {
	return BASE_OFFLINE_HOURS + g.research.offline + (g.perks.nap ? 4 : 0);
}

// ---------- prices ----------

export function buildCost(g: Game, pi: number, t: MachineType): number {
	const def = MACHINES[t];
	const n = g.planets[pi].built[t] || 0;
	if (t === 'belt') return Math.ceil(def.cost * PLANETS[pi].value);
	return Math.ceil(def.cost * PLANETS[pi].value * Math.pow(def.growth, n));
}

export function refundOf(g: Game, pi: number, t: MachineType): number {
	const def = MACHINES[t];
	const n = Math.max(0, (g.planets[pi].built[t] || 0) - 1);
	if (t === 'belt') return Math.ceil(def.cost * PLANETS[pi].value);
	return Math.ceil(def.cost * PLANETS[pi].value * Math.pow(def.growth, n));
}

export function machineUpCost(pi: number, m: Machine) {
	return Math.ceil(upgradeCost(m.t, m.lv, PLANETS[pi].value));
}

export function shipUpCost(g: Game, pi: number, u: ShipUpgrade) {
	const def = SHIP_UPS[u];
	return Math.ceil(def.cost * PLANETS[pi].value * Math.pow(def.growth, g.planets[pi].up[u]));
}

export function researchCost(g: Game, r: ResearchId) {
	const def = RESEARCH[r];
	return Math.ceil(def.cost * Math.pow(def.growth, g.research[r]));
}

// ---------- grid helpers ----------

export const idx = cellIdx;

/** Node bot helper — playable bounds on a planet. */
export function inGrid(g: Game, pi: number, x: number, y: number) {
	return inPlay(x, y, g.planets[pi], pi);
}

export type PlaceCheck = { ok: true; cost: number } | { ok: false; why: string; cost: number };

export function canPlace(g: Game, pi: number, x: number, y: number, t: MachineType): PlaceCheck {
	const cost = buildCost(g, pi, t);
	if (t === 'cross') return { ok: false, why: 'Drag a belt across a belt', cost };
	if (t === 'bridge') return { ok: false, why: 'Drag from one end to the other', cost };
	if (!inPlay(x, y, g.planets[pi], pi)) return { ok: false, why: 'Off the map', cost };
	const tile = tilesOf(pi, g.blasted[pi])[idx(x, y)];
	const here = g.planets[pi].cells[idx(x, y)];
	if (tile === TILE_ROCK) return { ok: false, why: 'Rock in the way', cost };
	if (here) return { ok: false, why: 'Space is taken', cost };
	if (t === 'drill' && tile !== TILE_ORE) return { ok: false, why: 'Drills need an ore tile', cost };
	if (g.credits < cost) return { ok: false, why: 'Not enough credits', cost };
	return { ok: true, cost };
}

/** Best facing for a new machine: toward a belt or machine that can take items. */
export function autoDir(g: Game, pi: number, x: number, y: number, fallback: Dir): Dir {
	const planet = g.planets[pi];
	const cells = planet.cells;
	// First choice: a belt next to us that does not point at us.
	for (const d of [fallback, 0, 1, 2, 3] as Dir[]) {
		const nx = x + DX[d];
		const ny = y + DY[d];
		if (!inPlay(nx, ny, planet, pi)) continue;
		const m = cells[idx(nx, ny)];
		if (m && m.t === 'belt' && m.d !== opposite(d)) return d;
	}
	for (const d of [fallback, 0, 1, 2, 3] as Dir[]) {
		const nx = x + DX[d];
		const ny = y + DY[d];
		if (!inPlay(nx, ny, planet, pi)) continue;
		const m = cells[idx(nx, ny)];
		if (m && m.t !== 'belt' && m.t !== 'drill' && m.t !== 'pylon') return d;
	}
	return fallback;
}

export function place(g: Game, pi: number, x: number, y: number, t: MachineType, d: Dir): boolean {
	const check = canPlace(g, pi, x, y, t);
	if (!check.ok) return false;
	g.credits -= check.cost;
	const p = g.planets[pi];
	p.cells[idx(x, y)] = makeMachine(t, d);
	p.built[t] = (p.built[t] || 0) + 1;
	markDirty(p);
	return true;
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

/** Does machine n at cell nc send items into cell c? */
function feeds(n: Machine, nc: number, c: number, p: PlanetState, pi: number): boolean {
	if (n.t === 'pad' || n.t === 'pylon') return false;
	if (n.t === 'cross') return true;
	if (n.t === 'bridge' && !n.end) return false;
	return targetOf(nc, n.d, p, pi) === c;
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

/** Turns a straight belt into a crossing. Its items keep going. */
export function makeCross(g: Game, pi: number, c: number, skip: number[] = []): boolean {
	if (!straightBelt(g, pi, c, skip)) return false;
	const cost = buildCost(g, pi, 'cross');
	if (g.credits < cost) return false;
	g.credits -= cost;
	const p = g.planets[pi];
	const old = p.cells[c]!;
	const m = makeMachine('cross', 0);
	m.items = old.items.map((it) => ({ k: it.k, p: it.p, e: old.d }));
	p.cells[c] = m;
	p.built.cross = (p.built.cross || 0) + 1;
	markDirty(p);
	return true;
}

/** Can a bridge go from cell a to cell b? */
export function canBridge(g: Game, pi: number, a: number, b: number): PlaceCheck {
	const cost = buildCost(g, pi, 'bridge');
	const ax = cellX(a);
	const ay = cellY(a);
	const bx = cellX(b);
	const by = cellY(b);
	const span = Math.abs(bx - ax) + Math.abs(by - ay);
	if (ax !== bx && ay !== by) return { ok: false, why: 'Go in a straight line', cost };
	if (span < 2) return { ok: false, why: 'Drag further', cost };
	if (span > BRIDGE_SPAN) return { ok: false, why: `Up to ${BRIDGE_SPAN - 1} tiles between`, cost };
	const tiles = tilesOf(pi, g.blasted[pi]);
	const cells = g.planets[pi].cells;
	for (const c of [a, b]) {
		if (tiles[c] === TILE_ROCK) return { ok: false, why: 'An end is on a rock', cost };
		if (cells[c]) return { ok: false, why: 'An end is on a taken space', cost };
	}
	if (g.credits < cost) return { ok: false, why: 'Not enough credits', cost };
	return { ok: true, cost };
}

/** Builds a bridge: items go in at a and come out at b. */
export function placeBridge(g: Game, pi: number, a: number, b: number): boolean {
	const check = canBridge(g, pi, a, b);
	if (!check.ok) return false;
	g.credits -= check.cost;
	const p = g.planets[pi];
	const dx = Math.sign((cellX(b)) - (cellX(a)));
	const dy = Math.sign(cellY(b) - cellY(a));
	const d = (dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3) as Dir;
	const start = makeMachine('bridge', d);
	start.link = b;
	const end = makeMachine('bridge', d);
	end.link = a;
	end.end = true;
	p.cells[a] = start;
	p.cells[b] = end;
	p.built.bridge = (p.built.bridge || 0) + 1;
	markDirty(p);
	return true;
}

/** Tiles from a bridge's start to its end. */
export function bridgeSpan(c: number, link: number): number {
	return Math.abs(cellX(link) - cellX(c)) + Math.abs(cellY(link) - cellY(c));
}

/** A bridge start whose far end is still there. */
function bridgeOk(p: PlanetState, c: number, m: Machine): boolean {
	if (m.link === undefined) return false;
	const e = p.cells[m.link];
	return !!e && e.t === 'bridge' && !!e.end && e.link === c;
}

export function removeAt(g: Game, pi: number, x: number, y: number): number {
	const p = g.planets[pi];
	const m = p.cells[idx(x, y)];
	if (!m || m.t === 'pad') return 0;
	let refund = refundOf(g, pi, m.t);
	// Half the upgrade money comes back too.
	for (let lv = 1; lv < m.lv; lv++) refund += Math.floor(upgradeCost(m.t, lv, PLANETS[pi].value) * 0.5);
	p.built[m.t] = Math.max(0, (p.built[m.t] || 0) - 1);
	p.cells[idx(x, y)] = null;
	// A bridge is one piece with two ends: remove both.
	if (m.t === 'bridge' && m.link !== undefined && p.cells[m.link]?.t === 'bridge') p.cells[m.link] = null;
	g.credits += refund;
	markDirty(p);
	return refund;
}

export function rotateAt(g: Game, pi: number, x: number, y: number, d?: Dir) {
	const p = g.planets[pi];
	const m = p.cells[idx(x, y)];
	if (!m || m.t === 'pad' || m.t === 'pylon' || m.t === 'cross' || m.t === 'bridge') return;
	m.d = d === undefined ? (((m.d + 1) % 4) as Dir) : d;
	markDirty(p);
}

export function upgradeMachine(g: Game, pi: number, x: number, y: number): boolean {
	const m = g.planets[pi].cells[idx(x, y)];
	if (!m || m.lv >= MACHINES[m.t].maxLv || m.t === 'belt' || m.t === 'pad') return false;
	const cost = machineUpCost(pi, m);
	if (g.credits < cost) return false;
	g.credits -= cost;
	m.lv++;
	markDirty(g.planets[pi]);
	return true;
}

export function buyShipUp(g: Game, pi: number, u: ShipUpgrade): boolean {
	const p = g.planets[pi];
	if (p.up[u] >= SHIP_UPS[u].max) return false;
	const cost = shipUpCost(g, pi, u);
	if (g.credits < cost) return false;
	g.credits -= cost;
	p.up[u]++;
	if (u === 'ships') {
		const s = makeShip();
		s.ph = 2;
		p.ships.push(s);
	}
	return true;
}

// ---------- rocks ----------

export function blastCost(g: Game, pi: number) {
	return Math.ceil(BLAST_COST * PLANETS[pi].value * Math.pow(BLAST_GROWTH, g.blasted[pi].length));
}

export function canBlast(g: Game, pi: number, c: number): PlaceCheck {
	const cost = blastCost(g, pi);
	if (tilesOf(pi, g.blasted[pi])[c] !== TILE_ROCK) return { ok: false, why: 'No rock here', cost };
	if (!g.research.blast) return { ok: false, why: 'Research Blast Charges to clear rocks', cost };
	if (g.credits < cost) return { ok: false, why: 'Not enough credits', cost };
	return { ok: true, cost };
}

/** Clears a rock for good. Returns the price paid, or -1. */
export function blastRock(g: Game, pi: number, c: number): number {
	const check = canBlast(g, pi, c);
	if (!check.ok) return -1;
	g.credits -= check.cost;
	g.blasted[pi].push(c);
	return check.cost;
}

export function buyResearch(g: Game, r: ResearchId): boolean {
	if (g.research[r] >= RESEARCH[r].max) return false;
	const cost = researchCost(g, r);
	if (g.credits < cost) return false;
	g.credits -= cost;
	g.research[r]++;
	if (r === 'beacon') g.beaconLit = true;
	return true;
}

// ---------- crew ----------

const crewMap = new WeakMap<PlanetState, CrewBoost>();

/** The boost from all crew working on this planet. Kept fresh by syncCrew. */
export function crewOf(p: PlanetState): Readonly<CrewBoost> {
	return crewMap.get(p) ?? NO_BOOST;
}

/** Works out each planet's crew boost. Cheap; runs every tick and after crew changes. */
export function syncCrew(g: Game) {
	const boosts = g.planets.map(() => ({ ...NO_BOOST }));
	for (const id of CREW_ORDER) {
		const lv = g.crew[id] || 0;
		const pi = g.crewAt[id];
		if (lv && pi !== undefined && g.planets[pi]?.unlocked) addCrew(boosts[pi], id, lv);
	}
	g.planets.forEach((p, i) => crewMap.set(p, boosts[i]));
}

export function slotCount(g: Game) {
	return BASE_SLOTS + g.slots;
}

/** How many crew are working now. */
export function slotsUsed(g: Game) {
	return CREW_ORDER.filter((id) => g.crew[id] && g.crewAt[id] !== undefined).length;
}

/** Stardust price of the next slot, or 0 when all are bought. */
export function slotCost(g: Game) {
	return SLOT_COSTS[g.slots] ?? 0;
}

export function buySlot(g: Game): boolean {
	const cost = slotCost(g);
	if (!cost || perkPoints(g) < cost) return false;
	g.slots++;
	return true;
}

export function crewCost(g: Game, id: CrewId) {
	return Math.ceil(crewCostAt(id, g.crew[id] || 0));
}

/** Hires a crew member, or trains one already hired. */
export function buyCrew(g: Game, id: CrewId): boolean {
	const lv = g.crew[id] || 0;
	if (!CREW[id] || lv >= CREW_MAX) return false;
	const cost = crewCost(g, id);
	if (g.credits < cost) return false;
	g.credits -= cost;
	g.crew[id] = lv + 1;
	syncCrew(g);
	return true;
}

/** Sends a hired crew member to work on a planet, or to rest with -1. Free. Needs a free slot unless already working. */
export function assignCrew(g: Game, id: CrewId, pi: number): boolean {
	if (!g.crew[id]) return false;
	const at = g.crewAt[id];
	if (pi < 0) {
		if (at === undefined) return false;
		delete g.crewAt[id];
	} else {
		if (at === pi || !g.planets[pi]?.unlocked) return false;
		if (at === undefined && slotsUsed(g) >= slotCount(g)) return false;
		g.crewAt[id] = pi;
	}
	syncCrew(g);
	return true;
}

export function unlockPlanet(g: Game, pi: number): boolean {
	const p = g.planets[pi];
	if (p.unlocked || pi === 0 || !g.planets[pi - 1].unlocked) return false;
	const cost = PLANETS[pi].unlock;
	if (g.credits < cost) return false;
	g.credits -= cost;
	p.unlocked = true;
	return true;
}

export function prestigeGain(g: Game) {
	return stardustFor(g.runEarned);
}

export function canPrestige(g: Game) {
	return g.planets[PRESTIGE_PLANET].unlocked && prestigeGain(g) >= 1;
}

export function prestige(g: Game): Game {
	const gain = prestigeGain(g);
	const keep = { ...g, stardust: g.stardust + gain };
	keep.stats = { ...g.stats, resets: g.stats.resets + 1 };
	const fresh = newGame(keep);
	fresh.peakIncome = 0;
	fresh.goals = g.goals.slice();
	fresh.unlocks = Array.from(new Set([...g.unlocks, ...fresh.unlocks, 'smelter', 'ships', 'research', 'prestige']));
	resetIncome();
	return fresh;
}

/** Stardust left to spend on perks. Perks cost stardust but do not remove its sales bonus. */
export function perkPoints(g: Game) {
	let spent = 0;
	for (const id of Object.keys(g.perks) as PerkId[]) if (g.perks[id]) spent += PERKS[id].cost;
	for (let i = 0; i < g.slots; i++) spent += SLOT_COSTS[i];
	return g.stardust - spent;
}

export function buyPerk(g: Game, id: PerkId): boolean {
	if (g.perks[id] || perkPoints(g) < PERKS[id].cost) return false;
	g.perks[id] = true;
	if (id === 'hull') for (const p of g.planets) p.ships.push(makeShip());
	return true;
}

// ---------- derived grid data ----------

const boostMap = new WeakMap<PlanetState, Float32Array>();

export function markDirty(p: PlanetState) {
	boostMap.delete(p);
}

function derived(p: PlanetState, pi: number): Float32Array {
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

// ---------- the tick ----------

/** Can this machine use item k as an input at all? */
function uses(m: Machine, k: number): boolean {
	if (isCrate(k)) return false;
	if (m.t === 'compactor') return true;
	return MACHINES[m.t].inputs.includes(formOfKind(k));
}

function accepts(m: Machine, k: number): boolean {
	return uses(m, k) && m.inb.length < (m.t === 'compactor' ? 10 : BUF_IN);
}

export function padCap(p: PlanetState) {
	return 40 + shipCap(p) * 2;
}

/** Try to move an item into cell (x, y), moving in direction dir. */
function push(p: PlanetState, x: number, y: number, dir: Dir, k: number, pi: number): boolean {
	if (!inPlay(x, y, p, pi)) return false;
	const m = p.cells[idx(x, y)];
	if (!m) return false;
	switch (m.t) {
		case 'belt': {
			if (m.d === opposite(dir)) return false;
			const last = m.items[m.items.length - 1];
			if (last && last.p < BELT_SPACING) return false;
			m.items.push({ k, p: 0, e: dir });
			return true;
		}
		case 'cross': {
			// Two lanes: across (left/right) and down (up/down). Each keeps its own spacing.
			let last: BeltItem | undefined;
			for (const it of m.items) {
				if (it.e % 2 !== dir % 2) continue;
				if (it.e !== dir) return false;
				last = it;
			}
			if (last && last.p < BELT_SPACING) return false;
			m.items.push({ k, p: 0, e: dir });
			return true;
		}
		case 'bridge': {
			if (dir === opposite(m.d)) return false;
			const span = m.end || m.link === undefined ? 1 : bridgeSpan(idx(x, y), m.link);
			const last = m.items[m.items.length - 1];
			if (last && last.p < BELT_SPACING / span) return false;
			m.items.push({ k, p: 0, e: m.end ? dir : m.d });
			return true;
		}
		case 'pad':
			if (p.pad.length >= padCap(p)) return false;
			p.pad.push(k);
			return true;
		case 'drill':
		case 'pylon':
			return false;
		default:
			if (accepts(m, k)) {
				m.inb.push(k);
				return true;
			}
			// Items a machine cannot use slide straight through it, so mixed belts never jam.
			if (!uses(m, k)) {
				const thru = (m.thru ??= []);
				const last = thru[thru.length - 1];
				if (thru.length + m.out.length >= BUF_OUT || (last && last.p < BELT_SPACING)) return false;
				thru.push({ k, p: 0, e: dir });
				return true;
			}
			return false;
	}
}

/** Moves a line of items forward by step. The front one leaves through out() at the end. */
function moveLine(items: BeltItem[], step: number, span: number, out: (k: number) => boolean) {
	const front = items[0];
	front.p += step;
	if (front.p >= 1) {
		if (out(front.k)) items.shift();
		else front.p = 1;
	}
	const gap = BELT_SPACING / span;
	for (let n = items[0] === front ? 1 : 0; n < items.length; n++) {
		const lim = n === 0 ? 1 : items[n - 1].p - gap;
		items[n].p = Math.min(items[n].p + step, lim);
	}
}

function moveCross(p: PlanetState, i: number, m: Machine, bs: number, pi: number) {
	const x = cellX(i);
	const y = cellY(i);
	for (const lane of [0, 1]) {
		const items = m.items.filter((it) => it.e % 2 === lane);
		if (!items.length) continue;
		const e = items[0].e;
		moveLine(items, bs, 1, (k) => push(p, x + DX[e], y + DY[e], e, k, pi));
		// keep the other lane, plus what is left of this one
		m.items = m.items.filter((it) => it.e % 2 !== lane).concat(items);
	}
}

function tryOutput(p: PlanetState, i: number, m: Machine, dt: number, pi: number) {
	if (!m.out.length) {
		m.stuck = 0;
		return;
	}
	const x = cellX(i);
	const y = cellY(i);
	if (push(p, x + DX[m.d], y + DY[m.d], m.d, m.out[0], pi)) {
		m.out.shift();
		m.stuck = 0;
	} else if (m.out.length >= BUF_OUT) m.stuck = (m.stuck || 0) + dt;
}

/** Moves pass-through items across a machine, like a short belt that ends in its output. */
function moveThru(m: Machine, bs: number) {
	const thru = m.thru;
	if (!thru || !thru.length) return;
	const front = thru[0];
	front.p = Math.min(1, front.p + bs);
	if (front.p >= 1 && m.out.length < BUF_OUT) {
		m.out.push(front.k);
		thru.shift();
	}
	for (let n = thru[0] === front ? 1 : 0; n < thru.length; n++) {
		const lim = n === 0 ? 1 : thru[n - 1].p - BELT_SPACING;
		thru[n].p = Math.min(thru[n].p + bs, lim);
	}
}

function startJob(m: Machine): boolean {
	const def = MACHINES[m.t];
	if (m.t === 'compactor') {
		const counts = new Map<number, number>();
		for (const k of m.inb) counts.set(k, (counts.get(k) || 0) + 1);
		for (const [k, c] of counts) {
			if (c >= CRATE_SIZE) {
				let left = CRATE_SIZE;
				m.inb = m.inb.filter((v) => (v === k && left-- > 0 ? false : true));
				m.job = true;
				m.prog = 0;
				m.kind = k + 5;
				return true;
			}
		}
		return false;
	}
	if (m.inb.length < def.need || m.out.length + def.outCount > BUF_OUT) return false;
	const k = m.inb[0];
	m.inb.splice(0, def.need);
	m.kind = kindOf(planetOfKind(k), def.outForm);
	m.job = true;
	m.prog = 0;
	return true;
}

function tickPlanet(g: Game, pi: number, dt: number) {
	const p = g.planets[pi];
	const boost = derived(p, pi);
	const crew = crewOf(p);
	const bs = beltSpeed(g.research.belt, !!g.perks.belts) * dt;
	const tiles = tilesOf(pi, g.blasted[pi]);
	const box = ownedBounds(p);
	for (let y = box.y0; y <= box.y1; y++) {
		for (let x = box.x0; x <= box.x1; x++) {
			const i = cellIdx(x, y);
			const m = p.cells[i];
			if (!m) continue;
			let working = false;
			switch (m.t) {
			case 'belt': {
				const items = m.items;
				if (!items.length) break;
				const front = items[0];
				front.p += bs;
				if (front.p >= 1) {
					const x = cellX(i);
					const y = cellY(i);
					if (push(p, x + DX[m.d], y + DY[m.d], m.d, front.k, pi)) items.shift();
					else front.p = 1;
				}
				for (let n = items[0] === front ? 1 : 0; n < items.length; n++) {
					const lim = n === 0 ? 1 : items[n - 1].p - BELT_SPACING;
					items[n].p = Math.min(items[n].p + bs, lim);
				}
				break;
			}
			case 'cross':
				if (m.items.length) moveCross(p, i, m, bs, pi);
				break;
			case 'bridge': {
				if (!m.items.length) break;
				const x = cellX(i);
				const y = cellY(i);
				if (m.end) {
					moveLine(m.items, bs, 1, (k) => push(p, x + DX[m.d], y + DY[m.d], m.d, k, pi));
				} else if (bridgeOk(p, i, m)) {
					const span = bridgeSpan(i, m.link!);
					const ex = cellX(m.link!);
					const ey = cellY(m.link!);
					moveLine(m.items, bs / span, span, (k) => push(p, ex, ey, m.d, k, pi));
				}
				break;
			}
			case 'drill': {
				if (tiles[i] === TILE_ORE && m.out.length < BUF_OUT) {
					m.prog += (dt / MACHINES.drill.time) * levelSpeed(m.lv) * boost[i] * crew.drill;
					working = true;
					if (m.prog >= 1) {
						m.prog -= 1;
						m.out.push(kindOf(pi, 0));
						emit({ type: 'made', planet: pi, cell: i, t: m.t });
					}
				}
				tryOutput(p, i, m, dt, pi);
				break;
			}
			case 'pad':
			case 'pylon':
				working = m.t === 'pylon';
				break;
			default: {
				if (!m.job) startJob(m);
				if (m.job) {
					const def = MACHINES[m.t];
					m.prog += (dt / def.time) * levelSpeed(m.lv) * boost[i] * crew.machine;
					working = true;
					if (m.prog >= 1) {
						const k = m.kind ?? kindOf(pi, def.outForm);
						for (let c = 0; c < def.outCount; c++) m.out.push(k);
						m.job = false;
						m.prog = 0;
						emit({ type: 'made', planet: pi, cell: i, t: m.t });
						startJob(m);
					}
				}
				moveThru(m, bs);
				tryOutput(p, i, m, dt, pi);
			}
			}
			if (m.glow !== undefined || working) m.glow = Math.max(0, Math.min(1, (m.glow || 0) + (working ? dt * 4 : -dt * 2)));
		}
	}
	tickShips(g, pi, dt);
}

export function travelTime(p: PlanetState, pi: number) {
	return PLANETS[pi].travel / (shipSpeed(p.up.speed) * crewOf(p).shipSpeed);
}

/** How much one ship on this route carries. */
export function shipCap(p: PlanetState) {
	return Math.round(shipCargo(p.up.cargo) * crewOf(p).cargo);
}

export const SHIP_WAIT = 2.5;

function tickShips(g: Game, pi: number, dt: number) {
	const p = g.planets[pi];
	const cap = shipCap(p);
	const T = travelTime(p, pi);
	let docked = false;
	for (const s of p.ships) {
		if (s.ph === 0) {
			if (docked) continue;
			docked = true;
			// Load fast, but not all at once, so the pad visibly empties.
			let load = Math.max(1, Math.round(dt * 40));
			while (load-- > 0 && s.cargo.length < cap && p.pad.length) s.cargo.push(p.pad.shift()!);
			if (s.cargo.length) s.wait += dt;
			if (s.cargo.length >= cap || (s.cargo.length && s.wait >= SHIP_WAIT)) {
				s.ph = 1;
				s.t = 0;
				emit({ type: 'depart', planet: pi });
			}
		} else {
			s.t += dt / T;
			if (s.t >= 1) {
				s.t = 0;
				if (s.ph === 1) {
					sell(g, pi, s.cargo);
					s.cargo = [];
					s.ph = 2;
				} else {
					s.ph = 0;
					s.wait = 0;
					emit({ type: 'dock', planet: pi });
				}
			}
		}
	}
}

function sell(g: Game, pi: number, cargo: number[]) {
	let v = 0;
	let count = 0;
	for (const k of cargo) {
		v += itemValue(k);
		count += isCrate(k) ? CRATE_SIZE : 1;
	}
	v *= sellMult(g) * crewOf(g.planets[pi]).sell;
	earn(g, v, true);
	g.stats.shipped += count;
	g.stats.flights++;
	emit({ type: 'sold', planet: pi, amount: v, count });
}

export function tick(g: Game, dt: number) {
	g.stats.playTime += dt;
	stepIncome(dt);
	syncCrew(g);
	for (let pi = 0; pi < g.planets.length; pi++) if (g.planets[pi].unlocked) tickPlanet(g, pi, dt);
}

/** Runs the game for time spent away. Returns what happened. */
export function catchUp(g: Game, seconds: number) {
	const capped = Math.min(seconds, offlineCapHours(g) * 3600);
	const before = { credits: g.runEarned, shipped: g.stats.shipped, flights: g.stats.flights };
	const was = emitOn;
	setEvents(false);
	const live = Math.min(capped, 240);
	const step = 0.1;
	let t = 0;
	let markEarned = g.runEarned;
	let markShipped = g.stats.shipped;
	let markFlights = g.stats.flights;
	const markAt = Math.max(0, live - 120);
	while (t < live) {
		tick(g, step);
		t += step;
		if (t - step < markAt && t >= markAt) {
			markEarned = g.runEarned;
			markShipped = g.stats.shipped;
			markFlights = g.stats.flights;
		}
	}
	const rest = capped - live;
	if (rest > 0) {
		const span = Math.max(1, live - markAt);
		const rate = (g.runEarned - markEarned) / span;
		earn(g, rate * rest, false);
		g.stats.shipped += Math.round(((g.stats.shipped - markShipped) / span) * rest);
		g.stats.flights += Math.round(((g.stats.flights - markFlights) / span) * rest);
	}
	setEvents(was);
	return {
		away: seconds,
		counted: capped,
		earned: g.runEarned - before.credits,
		shipped: g.stats.shipped - before.shipped,
		flights: g.stats.flights - before.flights,
	};
}

// ---------- hints for a stuck player ----------

/** Seconds stuck before a machine shows as blocked on the board. */
export const STUCK_SHOW = 2;
/** Seconds stuck before a dead end shows in the banner. */
export const STUCK_DEAD = 4;
/** Seconds stuck before a backup shows in the banner. Backups are normal, so wait longer. */
export const STUCK_SLOW = 15;

/**
 * Why a machine cannot hand off its output.
 * - dead: `cell` points somewhere items cannot go (`target`, -1 when off the map). Turning `cell` fixes it.
 * - slow: the line works, but `cell` (a machine or the pad) takes items slower than they arrive.
 * `from` is the stuck machine that started the trace.
 */
export type Block = { kind: 'dead'; from: number; cell: number; target: number; dir: Dir; why: string } | { kind: 'slow'; from: number; cell: number };

function targetOf(c: number, d: Dir, planet: PlanetState, pi: number): number {
	const x = cellX(c) + DX[d];
	const y = cellY(c) + DY[d];
	return inPlay(x, y, planet, pi) ? idx(x, y) : -1;
}

/** Why cell c facing d is a dead end, or null if items can go that way. */
function deadWhy(g: Game, pi: number, c: number, d: Dir): string | null {
	const planet = g.planets[pi];
	const t = targetOf(c, d, planet, pi);
	if (t < 0) return 'points off the map';
	const n = g.planets[pi].cells[t];
	if (!n) return tilesOf(pi, g.blasted[pi])[t] === TILE_ROCK ? 'points at a rock' : 'points at empty ground';
	if (n.t === 'drill') return 'points into a drill';
	if (n.t === 'pylon') return 'points into a pylon';
	if (n.t === 'belt' && n.d === opposite(d)) return 'points into a belt going the other way';
	if (n.t === 'bridge' && n.d === opposite(d)) return 'points into the wrong end of a bridge';
	return null;
}

/** Follows the line out of a stuck machine to find what holds it up. */
export function traceBlock(g: Game, pi: number, from: number): Block | null {
	const p = g.planets[pi];
	const start = p.cells[from];
	if (!start || start.t === 'belt' || start.t === 'pad' || !start.out.length) return null;
	let k = start.out[0];
	let c = from;
	let dir = start.d;
	// Cell and way in, since a line may pass one crossing twice.
	const seen = new Set<number>([from * 4 + dir]);
	for (let step = 0; step <= MAX_CELLS * 2; step++) {
		const why = deadWhy(g, pi, c, dir);
		const t = targetOf(c, dir, p, pi);
		if (why) return { kind: 'dead', from, cell: c, target: t, dir, why };
		if (seen.has(t * 4 + dir)) return { kind: 'dead', from, cell: c, target: t, dir, why: 'feeds back into its own line' };
		seen.add(t * 4 + dir);
		const n = p.cells[t]!;
		c = t;
		if (n.t === 'belt') {
			// The front item is the one that has to get off this belt.
			if (n.items.length) k = n.items[0].k;
			dir = n.d;
			continue;
		}
		if (n.t === 'cross') {
			// Straight on, in the lane we came in by.
			const front = n.items.find((it) => it.e === dir);
			if (front) k = front.k;
			continue;
		}
		if (n.t === 'bridge') {
			if (n.items.length) k = n.items[0].k;
			dir = n.d;
			if (n.end) continue;
			// Hop to the far end.
			if (!bridgeOk(p, t, n)) return { kind: 'dead', from, cell: t, target: -1, dir: n.d, why: 'has no far end' };
			c = n.link!;
			continue;
		}
		if (n.t === 'pad') return { kind: 'slow', from, cell: t };
		// A machine with a full output is held up too, so keep following.
		if (uses(n, k) && n.out.length < BUF_OUT) return { kind: 'slow', from, cell: t };
		if (n.out.length) k = n.out[0];
		dir = n.d;
	}
	return null;
}

/** Every machine on a planet stuck longer than `min` seconds, with its cause. */
export function planetBlocks(g: Game, pi: number, min = STUCK_SHOW): (Block & { stuck: number })[] {
	const p = g.planets[pi];
	const list: (Block & { stuck: number })[] = [];
	const box = ownedBounds(p);
	for (let y = box.y0; y <= box.y1; y++) {
		for (let x = box.x0; x <= box.x1; x++) {
			const i = cellIdx(x, y);
			const m = p.cells[i];
			const stuck = m?.stuck || 0;
			if (stuck <= min) continue;
			const b = traceBlock(g, pi, i);
			if (b) list.push({ ...b, stuck });
		}
	}
	return list;
}

/** A way to turn cell c so its items can leave, or null if there is none. */
export function fixDir(g: Game, pi: number, c: number): Dir | null {
	const p = g.planets[pi];
	const m = p.cells[c];
	if (!m || m.t === 'pad' || m.t === 'pylon' || m.t === 'cross' || m.t === 'bridge') return null;
	const k = m.t === 'belt' ? m.items[0]?.k : m.out[0];
	let best: Dir | null = null;
	let bestScore = 0;
	for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
		if (deadWhy(g, pi, c, d)) continue;
		const n = p.cells[targetOf(c, d, p, pi)]!;
		// Skip anything that feeds into us, or items would go round in a circle.
		if (n.t !== 'pad' && n.d === opposite(d)) continue;
		const score = n.t === 'pad' || (k !== undefined && n.t !== 'belt' && uses(n, k)) ? 3 : n.t === 'belt' ? 2 : 1;
		if (score > bestScore) {
			best = d;
			bestScore = score;
		}
	}
	return best;
}

/** Turns a dead end toward the best open side. Returns false if nothing works. */
export function fixAt(g: Game, pi: number, c: number): boolean {
	const d = fixDir(g, pi, c);
	if (d === null) return false;
	rotateAt(g, pi, cellX(c), cellY(c), d);
	return true;
}

export function blockText(pi: number, b: Block, t: MachineType): string {
	const name = MACHINES[t].short;
	if (b.kind === 'dead') return `A ${name.toLowerCase()} on ${PLANETS[pi].name} ${b.why}.`;
	if (t === 'pad') return `${PLANETS[pi].name} pad is full. Buy ships or cargo space.`;
	return `${name} on ${PLANETS[pi].name} can't keep up. Upgrade it or build more.`;
}

export interface Problem {
	kind: 'dead' | 'slow' | 'pad';
	planet: number;
	/** the cell to fix: the dead end, the slow machine, or the pad */
	cell: number;
	text: string;
}

export function findProblem(g: Game): Problem | null {
	let slow: Problem | null = null;
	for (let pi = 0; pi < g.planets.length; pi++) {
		const p = g.planets[pi];
		if (!p.unlocked) continue;
		if (p.pad.length >= padCap(p)) {
			const cell = p.cells.findIndex((m) => m?.t === 'pad');
			return { kind: 'pad', planet: pi, cell, text: `${PLANETS[pi].name} pad is full. Buy ships or cargo space.` };
		}
		for (const b of planetBlocks(g, pi, STUCK_DEAD)) {
			const t = p.cells[b.cell]!.t;
			if (b.kind === 'dead') return { kind: 'dead', planet: pi, cell: b.cell, text: blockText(pi, b, t) };
			if (!slow && b.stuck > STUCK_SLOW) slow = { kind: t === 'pad' ? 'pad' : 'slow', planet: pi, cell: b.cell, text: blockText(pi, b, t) };
		}
	}
	return slow;
}

export function countOf(g: Game, pi: number, t: MachineType) {
	let n = 0;
	for (const m of g.planets[pi].cells) if (m && m.t === t) n++;
	return n;
}

export function countAll(g: Game, t: MachineType) {
	let n = 0;
	for (let pi = 0; pi < g.planets.length; pi++) n += countOf(g, pi, t);
	return n;
}

export type PlanetBadge = 'warn' | 'full' | 'survey' | null;

/** Small space-map hint on a planet. */
export function planetBadge(g: Game, pi: number): PlanetBadge {
	const p = g.planets[pi];
	if (!p.unlocked) return null;
	if (p.pad.length >= padCap(p)) return 'full';
	if (buyablePlots(p).length && g.credits >= nextPlotCost(pi, p)) return 'survey';
	for (const b of planetBlocks(g, pi, STUCK_DEAD)) {
		if (b.kind === 'dead') return 'warn';
	}
	return null;
}

export { RESEARCH, SHIP_UPS, MACHINES, PLANETS };
