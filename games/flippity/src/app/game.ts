/** One game in progress, as plain data, and the steps that change it. Saved as it is. */
import type { BotId } from '../core/bot.ts';
import type { Side, Size } from '../core/rules.ts';
import { DARK, count, isCorner, nextTurn, play, start } from '../core/rules.ts';
import type { Earning } from './shop.ts';
import { moveEarnings } from './shop.ts';

export type Opponent = BotId | 'pair';

/** The game before a move, so undo can go back to it. */
export interface Snap {
	cells: number[];
	toMove: Side;
	last: number;
	/** How many earnings there were. */
	earned: number;
	mover: Side;
}

export interface GameState {
	n: Size;
	opponent: Opponent;
	/** The player's side against a bot. Dark in pass and play (not used). */
	human: Side;
	cells: number[];
	/** Null when the game is over. */
	toMove: Side | null;
	/** The square of the last pebble, or -1. */
	last: number;
	/** The side that had to pass on the last turn, for the note. */
	passed: Side | null;
	history: Snap[];
	/** Pips the player's moves earned this game. They go to the wallet at the end. */
	earned: Earning[];
	hints: number;
	undos: number;
}

export function newGame(n: Size, opponent: Opponent, human: Side): GameState {
	return { n, opponent, human: opponent === 'pair' ? DARK : human, cells: start(n), toMove: DARK, last: -1, passed: null, history: [], earned: [], hints: 0, undos: 0 };
}

export const isBotTurn = (g: GameState) => g.opponent !== 'pair' && g.toMove !== null && g.toMove !== g.human;

export interface MoveResult {
	game: GameState;
	flips: number[];
	lines: number;
	earnedNow: Earning[];
}

/** Plays a legal move for the side to move. */
export function applyMove(g: GameState, i: number): MoveResult {
	const side = g.toMove!;
	const r = play(g.cells, g.n, i, side);
	const turn = nextTurn(r.cells, g.n, side);
	const pays = g.opponent !== 'pair' && side === g.human;
	const earnedNow = pays ? moveEarnings(r.flips.length, r.lines, isCorner(g.n, i)) : [];
	const snap: Snap = { cells: g.cells, toMove: side, last: g.last, earned: g.earned.length, mover: side };
	return {
		game: { ...g, cells: r.cells, toMove: turn.toMove, passed: turn.passed, last: i, history: [...g.history, snap], earned: [...g.earned, ...earnedNow] },
		flips: r.flips,
		lines: r.lines,
		earnedNow,
	};
}

/**
 * Goes back one move in pass and play. Against a bot it goes back to before the
 * player's last move (so the bot's reply goes too). Null when there is nothing to undo.
 */
export function undoMove(g: GameState): GameState | null {
	const h = [...g.history];
	if (!h.length) return null;
	if (g.opponent !== 'pair' && !h.some((s) => s.mover === g.human)) return null;
	let snap = h.pop()!;
	if (g.opponent !== 'pair') while (snap.mover !== g.human) snap = h.pop()!;
	return { ...g, cells: snap.cells, toMove: snap.toMove, last: snap.last, passed: null, history: h, earned: g.earned.slice(0, snap.earned) };
}

export function canUndo(g: GameState) {
	if (!g.history.length) return false;
	return g.opponent === 'pair' || g.history.some((s) => s.mover === g.human);
}

export type Outcome = 'win' | 'loss' | 'draw';

export function result(g: GameState) {
	const c = count(g.cells);
	const winner: Side | 0 = c.dark > c.light ? 1 : c.light > c.dark ? 2 : 0;
	const outcome: Outcome = winner === 0 ? 'draw' : winner === g.human ? 'win' : 'loss';
	return { ...c, winner, outcome };
}
