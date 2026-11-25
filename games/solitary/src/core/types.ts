import type { Slot } from './cards.ts';

export type ModeId = 'klondike' | 'spider' | 'freecell';
export type PileKind = 'stock' | 'waste' | 'foundation' | 'tableau' | 'cell';

export interface DealOptions {
	draw: 1 | 3; // Klondike
	suits: 1 | 2 | 4; // Spider
}

/** The whole board. Small and plain, so undo can keep full copies. */
export interface State {
	piles: Record<string, Slot[]>;
	/** Cards the player took down from a foundation. Auto-move leaves them alone. */
	noAuto: number[];
	redeals: number;
}

export interface Move {
	from: string;
	index: number; // first card of the run in the source pile
	to: string;
}

export type Hint =
	| { kind: 'move'; move: Move; score: number }
	| { kind: 'stock'; score: number; text: string };

export function cloneState(state: State): State {
	const piles: Record<string, Slot[]> = {};
	for (const key in state.piles) piles[key] = state.piles[key].map((c) => ({ id: c.id, up: c.up }));
	return { piles, noAuto: state.noAuto.slice(), redeals: state.redeals };
}

/** A short key for a mode and its options: for bests and stats. */
export function variantKey(mode: ModeId, opts: DealOptions): string {
	if (mode === 'klondike') return `klondike-${opts.draw}`;
	if (mode === 'spider') return `spider-${opts.suits}`;
	return 'freecell';
}
