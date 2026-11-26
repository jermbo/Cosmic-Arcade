// The economy and the endless modes, all in one place to tune after a playtest.
// Shop prices live with each item in src/shop/catalog.ts.
import type { Difficulty, ModeId } from './types.ts';

export const CURRENCY = { name: 'Coins', one: 'coin' };

/** Coins a player earns. */
export const EARN = {
	/** Per star in a won daily. */
	dailyPerStar: 10,
	/** Per star in a won practice game (half the daily rate). */
	practicePerStar: 5,
	/** Each puzzle cleared in Endless Run, plus a bonus when no heart was lost. */
	runPuzzle: 10,
	runPerfect: 5,
	/** Each group sorted in Blitz. */
	blitzPerGroup: 2,
	/** Solving the daily chain. */
	chain: 30,
	/** Filling a Kin Book set. */
	bookSet: 50,
	/** Coins a new player starts with, to try the shop. */
	start: 50,
};

/** Endless Run: puzzles until the hearts run out. */
export const RUN = {
	hearts: 5,
	maxHearts: 5,
	/** Modes take turns in this order. */
	rotation: ['crack', 'secret', 'link'] as ModeId[],
	/** The difficulty goes up after this many puzzles. */
	tierEvery: 3,
	/** Difficulty per tier. The last one repeats forever. */
	tiers: ['easy', 'medium', 'hard'] as Difficulty[],
	/** Hearts won back for a puzzle with no mistakes. */
	perfectHeal: 1,
	/** Puzzles cleared for 1, 2 and 3 stars. */
	stars: [3, 6, 9],
};

/** Blitz: sort as many groups as you can before the clock runs out. */
export const BLITZ = {
	seconds: 120,
	/** Seconds added for each group sorted. */
	solveBonus: 4,
	/** Seconds lost for a wrong pick. */
	mistakePenalty: 6,
	pointsPerGroup: 100,
	/** Extra points for clearing a whole board. */
	boardBonus: 200,
	/** Groups needed for 1, 2 and 3 stars. */
	stars: [4, 8, 12],
};
