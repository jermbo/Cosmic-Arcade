// Every number you may want to tune after a playtest.
import type { Difficulty, Level } from './types.ts';

export interface DiffTuning {
	name: string;
	blurb: string;
	/** Bank levels of the 4 groups on a board, easiest first. */
	levels: Level[];
	/** False: any letters count as a guess, real word or not. */
	checkWords: boolean;
	/** Times you can ask Kip for a hint in one game. */
	hints: number;
	crack: {
		hearts: number;
		/** Guesses to crack one locked word. */
		guesses: number;
		/** Length of a locked word. */
		minLength: number;
		maxLength: number;
		/** Letters of each locked word shown from the start: the first one, plus this many more. */
		showFirst: boolean;
		showExtra: number;
	};
	secret: {
		hearts: number;
		/** Tries to guess the secret word. */
		tries: number;
		minLength: number;
		maxLength: number;
		/** free: shown from the start. paid: costs a heart. none: no clue. */
		clue: 'free' | 'paid' | 'none';
	};
	link: {
		hearts: number;
		/** Word guesses for one round, shared by its 4 slots. */
		guesses: number;
		/** Choices shown when you name the link. */
		options: number;
		/** Show the last letter of each word too, not just the first. */
		showLast: boolean;
	};
}

export const DIFFICULTY: Record<Difficulty, DiffTuning> = {
	easy: {
		name: 'Easy',
		blurb: 'Plain groups, letters given, more guesses.',
		levels: [1, 1, 2, 3],
		checkWords: false,
		hints: 3,
		crack: { hearts: 5, guesses: 8, minLength: 4, maxLength: 5, showFirst: true, showExtra: 1 },
		secret: { hearts: 5, tries: 6, minLength: 6, maxLength: 7, clue: 'free' },
		link: { hearts: 4, guesses: 10, options: 3, showLast: true },
	},
	medium: {
		name: 'Medium',
		blurb: 'One group of each kind. First letters given.',
		levels: [1, 2, 3, 4],
		checkWords: true,
		hints: 2,
		crack: { hearts: 4, guesses: 7, minLength: 4, maxLength: 6, showFirst: true, showExtra: 0 },
		secret: { hearts: 4, tries: 4, minLength: 6, maxLength: 8, clue: 'paid' },
		link: { hearts: 3, guesses: 8, options: 4, showLast: false },
	},
	hard: {
		name: 'Hard',
		blurb: 'Sneaky groups, no letters given, fewer guesses.',
		levels: [2, 3, 4, 4],
		checkWords: true,
		hints: 1,
		crack: { hearts: 4, guesses: 6, minLength: 4, maxLength: 6, showFirst: false, showExtra: 0 },
		secret: { hearts: 4, tries: 3, minLength: 6, maxLength: 8, clue: 'none' },
		link: { hearts: 3, guesses: 6, options: 5, showLast: false },
	},
};

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export const TUNING = {
	crack: { points: { group: 100, crack: 100, perGuessLeft: 30, perHeart: 150 } },
	secret: { cluePrice: 1, points: { group: 100, win: 300, perTryLeft: 80, perGroupLeft: 150, perHeart: 150 } },
	link: { maxLength: 7, points: { round: 150, perGuessLeft: 40, perHiddenWord: 60, perWord: 25, perHeart: 150 } },
	/** The daily chain: a bonus word filled by the 3 dailies of one difficulty. */
	chain: { length: 6, tries: 4, lettersPerMode: 2 },
	/** Points a hint from Kip costs (before the difficulty scale). */
	hintCost: 40,
	/** Combo: each solve in a row without a mistake adds this much to the next solve. */
	comboBonus: 0.25,
	/** Score is multiplied by this, so harder games score more. */
	scoreScale: { easy: 0.6, medium: 1, hard: 1.5 } as Record<Difficulty, number>,
};

/** Stars for a won game, by hearts left. A lost game has 0. */
export function starsFor(heartsLeft: number, max: number): number {
	if (heartsLeft >= max) return 3;
	if (heartsLeft >= Math.ceil(max / 2)) return 2;
	return 1;
}

/** Board colors go by place on the board (1 = easiest group), not by bank level. */
export const LEVEL_NAMES: Record<Level, string> = { 1: 'Warm-up', 2: 'Steady', 3: 'Tricky', 4: 'Sneaky' };
export const LEVEL_EMOJI: Record<Level, string> = { 1: '🟨', 2: '🟧', 3: '🟦', 4: '🟪' };
