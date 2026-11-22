// Timed mode: the clock starts at TIMED_SECONDS. A turn adds time for its longest chain,
// and TIME_FOR_BIG_GROUP more when it clears a group of BIG_GROUP or more blocks.
// These are drafts: the owner tunes them after play-tests.

export const TIMED_SECONDS = 60;
export const TIME_FOR_CHAIN = { 3: 3, 4: 10, 5: 15 }; // a chain longer than 5 adds the time of 5
export const TIME_FOR_BIG_GROUP = 3;
export const BIG_GROUP = 6;
export const LOW_TIME_SECONDS = 10; // the clock turns red and starts to tick
export const LOUD_TICK_SECONDS = 5; // the tick gets louder

const LONGEST_LISTED_CHAIN = Math.max(...Object.keys(TIME_FOR_CHAIN).map(Number));

/** The seconds a Timed turn adds: by its longest chain, plus a bonus for a big group. */
export function timeForTurn(chainLength, biggestGroup = 0) {
	const timeForChain = TIME_FOR_CHAIN[Math.min(chainLength, LONGEST_LISTED_CHAIN)] || 0;
	const timeForGroup = biggestGroup >= BIG_GROUP ? TIME_FOR_BIG_GROUP : 0;
	return timeForChain + timeForGroup;
}
