// The group bank and the hand-made puzzles, read from src/data.
import groupsData from '../data/groups.json' with { type: 'json' };
import puzzlesData from '../data/puzzles.json' with { type: 'json' };
import type { Group, HandPuzzle, Level } from './types.ts';

export const GROUPS: Group[] = (groupsData as Group[]).map((g) => ({ ...g, words: g.words.map((w) => w.toUpperCase()) }));

export const HAND_PUZZLES: HandPuzzle[] = puzzlesData as HandPuzzle[];

export const BY_LEVEL: Record<Level, Group[]> = { 1: [], 2: [], 3: [], 4: [] };
for (const g of GROUPS) BY_LEVEL[g.level].push(g);

export const GROUP_BY_ID = new Map(GROUPS.map((g) => [g.id, g]));

/** For each word, the ids of every bank group that lists it. */
export const GROUPS_OF_WORD = new Map<string, Set<string>>();
for (const g of GROUPS) {
	for (const w of g.words) {
		if (!GROUPS_OF_WORD.has(w)) GROUPS_OF_WORD.set(w, new Set());
		GROUPS_OF_WORD.get(w)!.add(g.id);
	}
}

/** Every word in the bank, so guesses of them are always valid. */
export const BANK_WORDS = [...GROUPS_OF_WORD.keys()];
