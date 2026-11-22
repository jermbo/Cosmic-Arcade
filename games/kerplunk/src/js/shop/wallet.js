// Rules for Plunks and best scores. Pure functions: they take the saved data and return new data.

import { WARMUP_COST, START_POWER_COST, BAN_COST } from './prices.js';

/** True when the wallet holds at least this many Plunks. */
export function canAfford(glints, cost) {
	return glints >= cost;
}

/** The best score saved for a mode ('endless' or 'timed'). */
export function bestScore(save, mode) {
	return save.best[mode];
}

/** The saved bests after a finished game. isBest is true when the score beat the old best. */
export function recordBest(save, mode, score) {
	if (score <= bestScore(save, mode)) return { isBest: false, best: save.best };
	return { isBest: true, best: { ...save.best, [mode]: score } };
}

/**
 * Buys a look (a theme or a block style). owned is the list of owned ids.
 * Returns the new wallet and list, or null when it is owned already or costs too much: then nothing changes.
 */
export function buyLook(glints, owned, item) {
	if (owned.includes(item.id) || !canAfford(glints, item.price)) return null;
	return { glints: glints - item.price, owned: [...owned, item.id] };
}

/** What the boosts picked for the start of a game cost together. Picked means a warm-up, a power-up kind, or a banned shape number. */
export function boostsCost({ warmup, power, ban }) {
	return (warmup ? WARMUP_COST : 0) + (power ? START_POWER_COST : 0) + (ban !== null ? BAN_COST : 0);
}
