// Mining by hand: what a tap on a planet is worth, and the tap.

import { TAP_INCOME_SHARE } from '../content/economy.ts';
import { PLANETS } from '../content/planets.ts';
import { statAdd, statTimes } from './effects.ts';
import type { Game } from './game.ts';
import { incomeRate, earn } from './income.ts';
import { sellMult } from './prices.ts';

export function tapValue(g: Game, planet: number) {
	const base = PLANETS[planet].value * statTimes(g, 'tapPower') * sellMult(g);
	return Math.max(base, incomeRate() * TAP_INCOME_SHARE * (1 + statAdd(g, 'tapFloor')));
}

export function tap(g: Game, planet: number): number {
	const v = tapValue(g, planet);
	earn(g, v);
	g.stats.taps++;
	return v;
}
