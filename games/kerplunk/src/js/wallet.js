// Rules for Glints and best scores. Pure functions: they take the saved data and return new data.

import { DAILY_BONUS, WARMUP_COST, START_POWER_COST, BAN_COST } from './prices.js';

/** True when the wallet holds at least this many Glints. */
export function canAfford(glints, cost) {
	return glints >= cost;
}

/** The best score saved for a mode ('endless', 'timed' or 'daily'). */
export function bestScore(save, mode) {
	return mode === 'daily' ? save.daily.best : save.best[mode];
}

/** The saved bests after a finished game. isBest is true when the score beat the old best. */
export function recordBest(save, mode, score) {
	if (score <= bestScore(save, mode)) return { isBest: false, best: save.best, daily: save.daily };
	if (mode === 'daily') return { isBest: true, best: save.best, daily: { ...save.daily, best: score } };
	return { isBest: true, best: { ...save.best, [mode]: score }, daily: save.daily };
}

/** The first daily challenge run of each day pays a bonus. A claimed day pays 0. */
export function claimDailyBonus(daily) {
	if (daily.claimed) return { daily, bonus: 0 };
	return { daily: { ...daily, claimed: true }, bonus: DAILY_BONUS };
}

/** The key of a day, such as "2026-11-07". */
export function dayKey(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The daily record for a day: the same one, or a fresh one when the day has changed. */
export function dailyFor(daily, today) {
	if (daily.date === today) return daily;
	return { date: today, best: 0, claimed: false };
}

/** What the boosts picked for the start of a game cost together. Picked means a warm-up, a power-up kind, or a banned shape number. */
export function boostsCost({ warmup, power, ban }) {
	return (warmup ? WARMUP_COST : 0) + (power ? START_POWER_COST : 0) + (ban !== null ? BAN_COST : 0);
}
