// What a mode gets from the app, and what it gives back.
import type { Difficulty, Mark, ModeId } from '../core/types.ts';
import type { Outcome } from '../ui/results.ts';

export interface GameCtx {
	mode: ModeId;
	/** The daily date, or null for practice. */
	date: string | null;
	difficulty: Difficulty;
	seed: string;
	exit: () => void;
	help: () => void;
	finish: (outcome: Outcome) => void;
}

export interface ModeGame {
	el: HTMLElement;
	destroy: () => void;
}

export const MARK_EMOJI: Record<Mark, string> = { hit: '🟩', near: '🟨', miss: '⬜' };
