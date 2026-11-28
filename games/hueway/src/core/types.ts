/** The shapes of a puzzle. Cells are numbered row × width + column. */

export const LEVELS = ['easy', 'medium', 'hard', 'expert', 'master'] as const;
export type Level = (typeof LEVELS)[number];

/** One color: its two dots. */
export interface Pair {
	a: number;
	b: number;
}

export interface Puzzle {
	id: string;
	seed: number;
	level: Level;
	w: number;
	h: number;
	/** Pair k uses color k. */
	pairs: Pair[];
	/** The answer: each path from dot a to dot b. */
	solution: number[][];
}

/** The size and color count of each level. Tune here. */
export const LEVEL_SHAPE: Record<Level, { size: number; colors: [number, number] }> = {
	easy: { size: 5, colors: [4, 5] },
	medium: { size: 6, colors: [5, 6] },
	hard: { size: 7, colors: [6, 7] },
	expert: { size: 8, colors: [7, 8] },
	master: { size: 9, colors: [8, 9] },
};

/** How many colors the palette has. The biggest puzzle must not use more. */
export const PALETTE = 10;
