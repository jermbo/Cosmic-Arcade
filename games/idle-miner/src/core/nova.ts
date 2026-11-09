// The Nova Reset: stardust for a run, the reset itself, and the perks that stardust buys.

import { PRESTIGE_PLANET, SLOT_COSTS } from '../content/nova.ts';
import { KEPT_AFTER_NOVA } from '../content/unlocks.ts';
import { planetIndex } from './planet-id.ts';
import { PERKS } from '../content/perks.ts';
import type { PerkId } from '../content/perks.ts';
import { stardustFor } from './prices.ts';
import { makeShip, newGame, noResearch } from './state.ts';
import { statAdd } from './effects.ts';
import type { Game } from './game.ts';
import { resetIncome } from './income.ts';

export function prestigeGain(g: Game) {
	return stardustFor(g.runEarned);
}

export function canPrestige(g: Game) {
	return g.planets[planetIndex(PRESTIGE_PLANET)].unlocked && prestigeGain(g) >= 1;
}

export function prestige(g: Game): Game {
	const gain = prestigeGain(g);
	const keep = { ...g, stardust: g.stardust + gain };
	keep.stats = { ...g.stats, resets: g.stats.resets + 1 };
	const fresh = newGame(keep);
	fresh.peakIncome = 0;
	fresh.goals = g.goals.slice();
	fresh.unlocks = Array.from(new Set([...g.unlocks, ...fresh.unlocks, ...KEPT_AFTER_NOVA]));
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
	const ships = statAdd({ research: noResearch(), perks: { [id]: true } }, 'extraShips');
	for (const p of g.planets) for (let i = 0; i < ships; i++) p.ships.push(makeShip());
	return true;
}
