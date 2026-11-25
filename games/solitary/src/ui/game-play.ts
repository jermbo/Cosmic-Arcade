import type { Move } from '../core/types.ts';
import type { Session } from '../game/session.ts';
import type { Board } from './board.ts';
import type { CardRef } from './card-ref.ts';

/** Methods GameView exposes to pointer and keyboard handlers. */
export interface GamePlaySurface {
	readonly session: Session;
	readonly board: Board;
	flushAutoMoves(): void;
	tryMove(move: Move): boolean;
	hold(card: CardRef): void;
	cancelHold(): void;
	sendHome(card: CardRef): boolean;
	dropOn(pile: string): boolean;
	drawFromStock(): void;
	clearHint(): void;
	say(text: string): void;
	topCardIndex(pile: string): number;
}