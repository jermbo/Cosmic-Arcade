// Building on a planet: place, remove, turn and upgrade machines, lay crossings and bridges, blast rocks, buy land.

import { BRIDGE_SPAN, MACHINE_LEVEL, MACHINES } from '../content/machines.ts';
import type { MachineType } from '../content/machines.ts';
import { PLANETS } from '../content/planets.ts';
import { DX, DY, opposite } from './direction.ts';
import type { Dir } from './direction.ts';
import { upgradeCost } from './prices.ts';
import { TILE_ORE, TILE_ROCK } from './tiles.ts';
import { buyablePlots, cellX, cellY, countOreInCells, inPlay, nextPlotCost, ownedPlots, plotCells } from './grid.ts';
import { introPlanet, machineUnlocked } from './machine-unlock.ts';
import { hasPower } from './effects.ts';
import { tilesOf } from './planet-map.ts';
import { makeMachine } from './state.ts';
import type { Game } from './game.ts';
import { buildCost, refundOf, machineUpCost, blastCost } from './prices.ts';
import { idx, straightBelt, markDirty } from './layout.ts';

/** Toolbar on a planet: no crushers on Cinder, etc. */
export function toolOnPlanet(g: Game, pi: number, t: MachineType): boolean {
	if (!machineUnlocked(g, t)) return false;
	if (MACHINES[t].unlock) return true;
	const intro = introPlanet(t);
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

export function removeAt(g: Game, pi: number, x: number, y: number): number {
	const p = g.planets[pi];
	const m = p.cells[idx(x, y)];
	if (!m || m.t === 'pad') return 0;
	let refund = refundOf(g, pi, m.t);
	// Half the upgrade money comes back too.
	for (let lv = 1; lv < m.lv; lv++) refund += Math.floor(upgradeCost(m.t, lv, PLANETS[pi].value) * MACHINE_LEVEL.refund);
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

export function canBlast(g: Game, pi: number, c: number): PlaceCheck {
	const cost = blastCost(g, pi);
	if (tilesOf(pi, g.blasted[pi])[c] !== TILE_ROCK) return { ok: false, why: 'No rock here', cost };
	if (!hasPower(g, 'blastRocks')) return { ok: false, why: 'Research Blast Charges to clear rocks', cost };
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
