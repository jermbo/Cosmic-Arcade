// Seeded random numbers. The same seed always gives the same numbers in the same order,
// so a game can be played again exactly, and the tests can check it.

/**
 * A random source from a seed (the "mulberry32" method).
 * Returns a function that gives a number from 0 up to (not including) 1 each time it is called.
 */
export function makeRng(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
	};
}

/** A seed from a date text such as "2026-11-07", so everyone gets the same daily game (the "FNV-1a" hash). */
export function dailySeed(text) {
	let hash = 2166136261;
	for (const character of text) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
	return hash >>> 0;
}

/** Puts the items of a list in a random order, in place (the "Fisher-Yates" shuffle). */
export function shuffleInPlace(list, random) {
	for (let last = list.length - 1; last > 0; last--) {
		const pick = Math.floor(random() * (last + 1));
		[list[last], list[pick]] = [list[pick], list[last]];
	}
	return list;
}

/** A new random seed, for a game that does not need to be played again. */
export function randomSeed() {
	return (Math.random() * 2 ** 31) | 0;
}
