import type { DealOptions, ModeId, State } from '../core/types.ts';
import { load, remove, save } from './storage.ts';

/** The game in progress, so a closed tab can carry on. Undo history is not kept. */
export interface SavedGame {
	v: 1;
	mode: ModeId;
	opts: DealOptions;
	seed: number;
	state: State;
	moves: number;
	elapsed: number;
	hintsUsed: boolean;
}

const KEY = 'solitary.game.v1';

export function loadGame(): SavedGame | null {
	const game = load<Partial<SavedGame>>(KEY, {});
	return game.v === 1 && game.state ? (game as SavedGame) : null;
}

export function saveGame(game: SavedGame) {
	save(KEY, game);
}

export function clearGame() {
	remove(KEY);
}
