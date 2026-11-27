/** Shared shapes of the puzzle logic. No UI code lives in `src/core/`. */

/**
 * What is known about each tile. -1 means "not known yet".
 * `num[i]` is 0..3 (shown as 1..4) and `color[i]` is 0..3.
 */
export interface Board {
	num: number[];
	color: number[];
}

export type Axis = 'num' | 'color';

/** A full answer: every tile has a number and a color. */
export type Solution = Board;

export type Level = 'easy' | 'medium' | 'hard' | 'expert';

export const LEVELS: Level[] = ['easy', 'medium', 'hard', 'expert'];

export interface Puzzle {
	/** Stable id, e.g. "daily-2026-11-26" or "practice-medium-1234". */
	id: string;
	seed: number;
	level: Level;
	/** The locked parts. -1 means the player fills it in. */
	givens: Board;
	solution: Solution;
	rating: Rating;
}

/** How hard a puzzle is, measured by the logic it needs. */
export interface Rating {
	/** The hardest rule the solver needed (1..4). */
	maxTier: number;
	/** How many steps of each tier the solver took. Index 0 is unused. */
	steps: number[];
	/** One number to sort puzzles by. */
	score: number;
	/** How many facts were given (a full tile gives 2). */
	clues: number;
}

export const emptyBoard = (): Board => ({ num: Array(16).fill(-1), color: Array(16).fill(-1) });

export const copyBoard = (b: Board): Board => ({ num: b.num.slice(), color: b.color.slice() });
