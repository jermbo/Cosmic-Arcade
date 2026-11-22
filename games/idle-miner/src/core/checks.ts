// Measure a check from the content against a game: how much the player has, and how much the check wants.

import type { Check } from '../content/checks.ts';
import type { MachineType } from '../content/machines.ts';
import type { Game } from './game.ts';
import { boughtPlots } from './grid.ts';
import { countAll, countOf } from './machine-count.ts';
import { planetIndex } from './planet-id.ts';

export function measure(g: Game, check: Check): [have: number, want: number] {
	switch (check.kind) {
		case 'taps':
			return upTo(g.stats.taps, check.count);
		case 'flights':
			return upTo(g.stats.flights, check.count);
		case 'resets':
			return upTo(g.stats.resets, check.count);
		case 'earned':
			return upTo(g.runEarned, check.credits);
		case 'income':
			return upTo(Math.floor(g.peakIncome || 0), check.perSecond);
		case 'build': {
			const have = check.on ? countOf(g, planetIndex(check.on), check.machine) : countAll(g, check.machine);
			return upTo(have, check.count);
		}
		case 'buildOnPlanets':
			return upTo(g.planets.filter((_, i) => countOf(g, i, check.machine) > 0).length, check.planets);
		case 'machineLevel':
			return upTo(check.machine === 'any' ? highestLevel(g) : highestLevelOf(g, check.machine), check.level);
		case 'research':
			return upTo(g.research[check.research], check.level);
		case 'shipUpgrades': {
			const up = g.planets[planetIndex(check.on)].up;
			return upTo(check.upgrades.reduce((sum, u) => sum + up[u], 0), check.count);
		}
		case 'shipsOnOneRoute':
			return upTo(Math.max(...g.planets.map((p) => p.up.ships)) + 1, check.count);
		case 'planetOpen':
			return yesNo(g.planets[planetIndex(check.planet)].unlocked);
		case 'landBought':
			return yesNo(g.planets.some((p) => boughtPlots(p) > 0));
		case 'perksOwned':
			return upTo(Object.keys(g.perks).length, check.count);
		case 'beaconLit':
			return yesNo(g.beaconLit);
		case 'cargoMoving': {
			const p = g.planets[planetIndex(check.from)];
			return yesNo(g.stats.flights >= 1 || p.pad.length > 0 || p.ships.some((s) => s.cargo.length > 0));
		}
		case 'unlocked':
			return yesNo(g.unlocks.includes(check.id));
	}
}

export function isMet(g: Game, check: Check): boolean {
	const [have, want] = measure(g, check);
	return have >= want;
}

/** True when any of the checks is met. */
export function anyMet(g: Game, checks: Check[]): boolean {
	return checks.some((c) => isMet(g, c));
}

function upTo(have: number, want: number): [number, number] {
	return [Math.min(have, want), want];
}

function yesNo(done: boolean): [number, number] {
	return [done ? 1 : 0, 1];
}

/** The highest level of any machine but the pad. A game with no machines counts as level 1. */
function highestLevel(g: Game): number {
	let lv = 1;
	for (const p of g.planets) for (const m of p.cells) if (m && m.t !== 'pad') lv = Math.max(lv, m.lv);
	return lv;
}

function highestLevelOf(g: Game, t: MachineType): number {
	let lv = 0;
	for (const p of g.planets) for (const m of p.cells) if (m && m.t === t) lv = Math.max(lv, m.lv);
	return lv;
}
