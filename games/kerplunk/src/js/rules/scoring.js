// Points and Glints for a clear.
// Glints are the coins of the game. The player sees them as "Plunks" (✦). The code and the save
// still call them glints. They are earned by combos and kept between games.

export const MIN_GROUP_SIZE = 3; // the fewest blocks of one color that clear
const POINTS_PER_BLOCK = 10;
const ALL_CLEAR_BONUS = 1000;
const ALL_CLEAR_MIN_BLOCKS = 8; // the board needs this many blocks before a full clear pays the bonus
export const GLINT_ALL_CLEAR = 10;

// The group multiplier: 3 and 4 blocks pay x1, then 5 pays x2, 6 pays x3, and so on up to x6.
const GROUP_MULT_FROM = 5;
const GROUP_MULT_MAX = 6;

/** The score multiplier for one cleared group of this size. */
export function groupMultiplier(size) {
	if (size < GROUP_MULT_FROM) return 1;
	return Math.min(GROUP_MULT_MAX, size - GROUP_MULT_FROM + 2);
}

/** Glints earned by one clear step: (chain step - 1) + (group multiplier - 1). */
export function glintsFor(chain, mult) {
	return chain - 1 + (mult - 1);
}

/** Glints earned by one clear step that empties the well. */
export function glintsForAllClear(chain, mult) {
	return glintsFor(chain, mult) + GLINT_ALL_CLEAR;
}

/**
 * The points for one chain step. Each group pays by its own size, times the chain step.
 * Blocks that only the Blast cleared pay the base rate times the chain step.
 * Returns { points, biggest }: biggest is the size of the biggest group.
 */
export function pointsForStep(groups, clearedCount, chain) {
	let points = 0;
	let blocksInGroups = 0;
	let biggest = 0;
	for (const group of groups) {
		const size = group.cells.size;
		points += size * POINTS_PER_BLOCK * chain * groupMultiplier(size);
		blocksInGroups += size;
		biggest = Math.max(biggest, size);
	}
	const blastOnlyBlocks = clearedCount - blocksInGroups;
	points += blastOnlyBlocks * POINTS_PER_BLOCK * chain;
	return { points, biggest };
}

/** True when this step emptied a well that had enough blocks in it to earn the all clear bonus. */
export function isAllClear(blocksBefore, wellIsEmpty) {
	return blocksBefore >= ALL_CLEAR_MIN_BLOCKS && wellIsEmpty;
}

/** The bonus points for an all clear. */
export function allClearBonus(allClear) {
	return allClear ? ALL_CLEAR_BONUS : 0;
}
