// What things cost, and what cargo sells for.

import { CREW, CREW_GROWTH } from '../content/crew.ts';
import type { CrewId } from '../content/crew.ts';
import { CRATE_BONUS, CRATE_SIZE, FORM_VALUE } from '../content/items.ts';
import { BLAST_COST, BLAST_GROWTH } from '../content/land.ts';
import { MACHINE_LEVEL, MACHINES } from '../content/machines.ts';
import type { MachineType } from '../content/machines.ts';
import { DUST_BONUS, SLOT_COSTS, STARDUST } from '../content/nova.ts';
import { PLANETS } from '../content/planets.ts';
import { RESEARCH } from '../content/research.ts';
import type { ResearchId } from '../content/research.ts';
import { SHIP_UPS } from '../content/ships.ts';
import type { ShipUpgrade } from '../content/ships.ts';
import { formOfKind, isCrate, planetOfKind } from './items.ts';
import { buyablePlots, nextPlotCost } from './grid.ts';
import type { Game, Machine } from './game.ts';
import { statAdd } from './effects.ts';

export function sellMult(g: Game) {
	return (1 + statAdd(g, 'sales')) * (1 + DUST_BONUS * g.stardust);
}

export function itemValue(k: number) {
	const f = formOfKind(k);
	const base = PLANETS[planetOfKind(k)].value * FORM_VALUE[f % 5];
	return isCrate(k) ? base * CRATE_SIZE * CRATE_BONUS : base;
}

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

export function blastCost(g: Game, pi: number) {
	return Math.ceil(BLAST_COST * PLANETS[pi].value * Math.pow(BLAST_GROWTH, g.blasted[pi].length));
}

export function crewCost(g: Game, id: CrewId) {
	return Math.ceil(crewCostAt(id, g.crew[id] || 0));
}

/** Stardust price of the next slot, or 0 when all are bought. */
export function slotCost(g: Game) {
	return SLOT_COSTS[g.slots] ?? 0;
}

export function cheapestPlot(g: Game, pi: number): number {
	const p = g.planets[pi];
	if (!buyablePlots(p).length) return 0;
	return nextPlotCost(pi, p);
}

export const upgradeCost = (t: MachineType, lv: number, planetValue: number) => MACHINES[t].cost * planetValue * Math.pow(MACHINE_LEVEL.costGrowth, lv - 1);

export const stardustFor = (runEarned: number) => Math.floor(Math.pow(runEarned / STARDUST.firstAt, STARDUST.power));

/** Cost to hire (lv 0) or to train from lv to lv + 1. */
export const crewCostAt = (id: CrewId, lv: number) => CREW[id].cost * Math.pow(CREW_GROWTH, lv);
