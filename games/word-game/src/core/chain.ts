// The daily chain: one bonus word per day and difficulty.
// Each daily you win shows 2 of its letters. Play all 3 dailies, then guess it.
import { GROUPS } from './bank.ts';
import { buildSecret, seedFor } from './builder.ts';
import { makeRng, pick, shuffle } from './rng.ts';
import { TUNING } from './tuning.ts';
import type { Difficulty, ModeId } from './types.ts';

export const CHAIN_MODES: ModeId[] = ['crack', 'secret', 'link'];

export interface Chain {
	word: string;
	clue: string;
	/** The letter spots each mode's daily shows when won. */
	spots: Record<ModeId, number[]>;
}

export function buildChain(diff: Difficulty, date: string): Chain {
	const { length, lettersPerMode } = TUNING.chain;
	const rng = makeRng(`chain|${diff}|${date}`);
	const secret = buildSecret(seedFor('secret', diff, date), diff, date).word;
	const choices: { word: string; clue: string }[] = [];
	for (const g of GROUPS) {
		if (g.level > 2) continue;
		for (const w of g.words) if (w.length === length && w !== secret) choices.push({ word: w, clue: g.theme });
	}
	const { word, clue } = pick(rng, choices);
	const order = shuffle(rng, [...word].map((_, i) => i));
	const spots = Object.fromEntries(CHAIN_MODES.map((m, k) => [m, order.slice(k * lettersPerMode, (k + 1) * lettersPerMode)])) as Record<ModeId, number[]>;
	return { word, clue, spots };
}
