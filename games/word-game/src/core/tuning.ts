// Every number you may want to tune after a playtest.
import type { Level, ModeId } from './types.ts';

export const TUNING = {
	hearts: { crack: 4, secret: 4, link: 3 } as Record<ModeId, number>,

	crack: {
		/** Guesses to crack one locked word. */
		guesses: 6,
		/** Length of a locked word. */
		minLength: 4,
		maxLength: 6,
		points: { group: 100, crack: 100, perGuessLeft: 30, perHeart: 150 },
	},

	secret: {
		/** Tries to guess the secret word. */
		tries: 4,
		minLength: 6,
		maxLength: 8,
		/** Hearts the clue costs. It is off while you have this many hearts or fewer. */
		clueCost: 1,
		points: { group: 100, win: 300, perTryLeft: 80, perGroupLeft: 150, perHeart: 150 },
	},

	link: {
		/** Word guesses for one round, shared by its 4 slots. */
		guesses: 8,
		/** Choices shown when you name the link. */
		options: 4,
		maxLength: 7,
		points: { round: 150, perGuessLeft: 40, perHiddenWord: 60, perWord: 25, perHeart: 150 },
	},

	/** Combo: each solve in a row without a mistake adds this much to the next solve. */
	comboBonus: 0.25,
};

/** Stars for a won game, by hearts left. A lost game has 0. */
export function starsFor(heartsLeft: number, max: number): number {
	if (heartsLeft >= max) return 3;
	if (heartsLeft >= Math.ceil(max / 2)) return 2;
	return 1;
}

export const LEVEL_NAMES: Record<Level, string> = { 1: 'Easy', 2: 'Medium', 3: 'Tricky', 4: 'Sneaky' };
export const LEVEL_EMOJI: Record<Level, string> = { 1: '🟨', 2: '🟧', 3: '🟦', 4: '🟪' };
