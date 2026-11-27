/**
 * The state of one window being played, and every change the player can make.
 * Pure functions: the React side calls `step(state, action)` and gets a new state.
 */
import { CELLS, PEERS } from '../core/grid.ts';
import type { Hint } from '../core/hints.ts';
import { getHint } from '../core/hints.ts';
import { isFull } from '../core/logic.ts';
import { findClashes } from '../core/solve.ts';
import type { Axis, Board, Puzzle } from '../core/types.ts';
import { copyBoard } from '../core/types.ts';
import type { GameSave } from './save.ts';

export interface Notes {
	num: number[]; // 4-bit sets
	color: number[];
}

interface Snapshot {
	board: Board;
	notes: Notes;
}

/** What just happened, for sound and effects. */
export type Event =
	| { kind: 'place'; cell: number; axis: Axis; value: number; full: boolean }
	| { kind: 'erase'; cell: number }
	| { kind: 'note'; cell: number }
	| { kind: 'locked'; cell: number }
	| { kind: 'undo' }
	| { kind: 'clash'; cells: number[] }
	| { kind: 'solved' }
	| { kind: 'select'; cell: number }
	| { kind: 'hint' }
	| { kind: 'reset' };

export interface HintView {
	hint: Hint;
	/** 1 where, 2 why, 3 what (shown). */
	level: 1 | 2 | 3;
}

export interface Game {
	puzzle: Puzzle;
	board: Board;
	notes: Notes;
	sel: number;
	notesMode: boolean;
	past: Snapshot[];
	future: Snapshot[];
	elapsed: number;
	hints: number;
	shown: number;
	hint: HintView | null;
	solved: boolean;
	events: Event[];
	/** Bumps on every change, so effects can tell events apart. */
	tick: number;
}

const emptyNotes = (): Notes => ({ num: Array(CELLS).fill(0), color: Array(CELLS).fill(0) });

export function newGame(puzzle: Puzzle, saved?: GameSave): Game {
	const board = saved ? { num: saved.num.slice(), color: saved.color.slice() } : copyBoard(puzzle.givens);
	// The clues always win over a save.
	for (let i = 0; i < CELLS; i++) {
		if (puzzle.givens.num[i] >= 0) board.num[i] = puzzle.givens.num[i];
		if (puzzle.givens.color[i] >= 0) board.color[i] = puzzle.givens.color[i];
	}
	const notes = saved ? { num: saved.noteNum.slice(), color: saved.noteColor.slice() } : emptyNotes();
	const firstOpen = Array.from({ length: CELLS }, (_, i) => i).find((i) => board.num[i] < 0 || board.color[i] < 0) ?? 0;
	const g: Game = {
		puzzle,
		board,
		notes,
		sel: firstOpen,
		notesMode: false,
		past: [],
		future: [],
		elapsed: saved?.elapsed ?? 0,
		hints: saved?.hints ?? 0,
		shown: saved?.shown ?? 0,
		hint: null,
		solved: false,
		events: [],
		tick: 0,
	};
	g.solved = isSolved(g);
	return g;
}

export const toSave = (g: Game): GameSave => ({
	num: g.board.num,
	color: g.board.color,
	noteNum: g.notes.num,
	noteColor: g.notes.color,
	elapsed: g.elapsed,
	hints: g.hints,
	shown: g.shown,
});

export const isLocked = (g: Game, cell: number, axis: Axis) => (axis === 'num' ? g.puzzle.givens.num : g.puzzle.givens.color)[cell] >= 0;

const isSolved = (g: Game) =>
	isFull(g.board) && g.board.num.every((v, i) => v === g.puzzle.solution.num[i]) && g.board.color.every((v, i) => v === g.puzzle.solution.color[i]);

export type Action =
	| { type: 'select'; cell: number }
	| { type: 'move'; dr: number; dc: number }
	| { type: 'set'; axis: Axis; value: number; cell?: number }
	| { type: 'erase'; cell?: number }
	| { type: 'toggleNotes' }
	| { type: 'undo' }
	| { type: 'redo' }
	| { type: 'reset' }
	| { type: 'hint' }
	| { type: 'hintLevel'; level: 2 | 3 }
	| { type: 'closeHint' }
	| { type: 'time'; ms: number };

function remember(g: Game): Game {
	const snap: Snapshot = { board: copyBoard(g.board), notes: { num: g.notes.num.slice(), color: g.notes.color.slice() } };
	return { ...g, past: [...g.past.slice(-199), snap], future: [] };
}

/**
 * After a change: check clashes and the end. A full row or column is not
 * celebrated: only the whole window can be known to be right.
 */
function settle(before: Game, g: Game, events: Event[]): Game {
	const solved = isSolved(g);
	const out: Event[] = [...events];
	const changed = events.find((e) => e.kind === 'place');
	if (changed && changed.kind === 'place') {
		const clashes = findClashes(g.board).filter((c) => c.cells.includes(changed.cell));
		if (clashes.length) out.push({ kind: 'clash', cells: [...new Set(clashes.flatMap((c) => c.cells))] });
	}
	if (solved && !before.solved) out.push({ kind: 'solved' });
	return { ...g, solved, events: out, tick: g.tick + 1 };
}

/** Placing a value clears it from the notes of the tile and of its row and column. */
function clearNotes(notes: Notes, cell: number, axis: Axis, value: number): Notes {
	const list = (axis === 'num' ? notes.num : notes.color).slice();
	list[cell] = 0;
	for (const p of PEERS[cell]) list[p] &= ~(1 << value);
	return axis === 'num' ? { ...notes, num: list } : { ...notes, color: list };
}

export function step(g: Game, a: Action): Game {
	if (g.solved && a.type !== 'time' && a.type !== 'select' && a.type !== 'move') return g;
	switch (a.type) {
		case 'select':
			return { ...g, sel: a.cell, events: [{ kind: 'select', cell: a.cell }], tick: g.tick + 1 };
		case 'move': {
			const r = (Math.floor(g.sel / 4) + a.dr + 4) % 4;
			const c = ((g.sel % 4) + a.dc + 4) % 4;
			return { ...g, sel: r * 4 + c, events: [{ kind: 'select', cell: r * 4 + c }], tick: g.tick + 1 };
		}
		case 'set': {
			const cell = a.cell ?? g.sel;
			if (g.notesMode) {
				if (isLocked(g, cell, a.axis) || (a.axis === 'num' ? g.board.num : g.board.color)[cell] >= 0)
					return { ...g, events: [{ kind: 'locked', cell }], tick: g.tick + 1 };
				const n = remember(g);
				const list = (a.axis === 'num' ? n.notes.num : n.notes.color).slice();
				list[cell] ^= 1 << a.value;
				const notes = a.axis === 'num' ? { ...n.notes, num: list } : { ...n.notes, color: list };
				return { ...n, notes, events: [{ kind: 'note', cell }], tick: g.tick + 1 };
			}
			if (isLocked(g, cell, a.axis)) return { ...g, events: [{ kind: 'locked', cell }], tick: g.tick + 1 };
			const n = remember(g);
			const board = copyBoard(n.board);
			const list = a.axis === 'num' ? board.num : board.color;
			// Picking the value a tile already has takes it off again.
			if (list[cell] === a.value) {
				list[cell] = -1;
				return settle(g, { ...n, board, hint: null }, [{ kind: 'erase', cell }]);
			}
			list[cell] = a.value;
			const notes = clearNotes(n.notes, cell, a.axis, a.value);
			const full = board.num[cell] >= 0 && board.color[cell] >= 0;
			return settle(g, { ...n, board, notes, hint: null }, [{ kind: 'place', cell, axis: a.axis, value: a.value, full }]);
		}
		case 'erase': {
			const cell = a.cell ?? g.sel;
			const hasNum = g.board.num[cell] >= 0 && !isLocked(g, cell, 'num');
			const hasColor = g.board.color[cell] >= 0 && !isLocked(g, cell, 'color');
			const hasNotes = g.notes.num[cell] || g.notes.color[cell];
			if (!hasNum && !hasColor && !hasNotes) {
				const lockedAny = isLocked(g, cell, 'num') || isLocked(g, cell, 'color');
				return lockedAny ? { ...g, events: [{ kind: 'locked', cell }], tick: g.tick + 1 } : g;
			}
			const n = remember(g);
			const board = copyBoard(n.board);
			if (hasNum) board.num[cell] = -1;
			if (hasColor) board.color[cell] = -1;
			const notes = { num: n.notes.num.slice(), color: n.notes.color.slice() };
			if (!hasNum && !hasColor) {
				notes.num[cell] = 0;
				notes.color[cell] = 0;
			}
			return settle(g, { ...n, board, notes, hint: null }, [{ kind: 'erase', cell }]);
		}
		case 'toggleNotes':
			return { ...g, notesMode: !g.notesMode, events: [], tick: g.tick + 1 };
		case 'undo': {
			const last = g.past[g.past.length - 1];
			if (!last) return g;
			const now: Snapshot = { board: g.board, notes: g.notes };
			return settle(g, { ...g, board: last.board, notes: last.notes, past: g.past.slice(0, -1), future: [...g.future, now], hint: null }, [{ kind: 'undo' }]);
		}
		case 'redo': {
			const next = g.future[g.future.length - 1];
			if (!next) return g;
			const now: Snapshot = { board: g.board, notes: g.notes };
			return settle(g, { ...g, board: next.board, notes: next.notes, future: g.future.slice(0, -1), past: [...g.past, now], hint: null }, [{ kind: 'undo' }]);
		}
		case 'reset': {
			const n = remember(g);
			return settle(g, { ...n, board: copyBoard(g.puzzle.givens), notes: emptyNotes(), hint: null }, [{ kind: 'reset' }]);
		}
		case 'hint': {
			// Pressing hint again moves to the next level.
			if (g.hint && g.hint.level < 3 && (g.hint.hint.kind === 'step' || g.hint.hint.kind === 'wrong'))
				return step(g, { type: 'hintLevel', level: (g.hint.level + 1) as 2 | 3 });
			const hint = getHint(g.puzzle, g.board);
			const target = hint.kind === 'step' ? hint.ex.target : hint.kind === 'wrong' ? hint.cell : g.sel;
			return { ...g, hint: { hint, level: 1 }, hints: g.hints + 1, sel: target, events: [{ kind: 'hint' }], tick: g.tick + 1 };
		}
		case 'hintLevel': {
			if (!g.hint) return g;
			if (a.level === 2) return { ...g, hint: { ...g.hint, level: 2 }, events: [{ kind: 'hint' }], tick: g.tick + 1 };
			// Level 3 does it: places the step, or takes the wrong part off.
			const h = g.hint.hint;
			const n = remember(g);
			const board = copyBoard(n.board);
			let notes = n.notes;
			const events: Event[] = [];
			if (h.kind === 'step') {
				for (const f of h.ex.facts) {
					(f.axis === 'num' ? board.num : board.color)[f.cell] = f.value;
					notes = clearNotes(notes, f.cell, f.axis, f.value);
				}
				const f = h.ex.facts[h.ex.facts.length - 1];
				events.push({ kind: 'place', cell: f.cell, axis: f.axis, value: f.value, full: board.num[f.cell] >= 0 && board.color[f.cell] >= 0 });
			} else if (h.kind === 'wrong') {
				for (const axis of h.axes) (axis === 'num' ? board.num : board.color)[h.cell] = -1;
				events.push({ kind: 'erase', cell: h.cell });
			} else return { ...g, hint: null };
			return settle(g, { ...n, board, notes, hint: null, shown: g.shown + 1 }, events);
		}
		case 'closeHint':
			return { ...g, hint: null, events: [], tick: g.tick + 1 };
		case 'time':
			return { ...g, elapsed: g.elapsed + a.ms, events: [] };
	}
}

/** Tiles that break a rule right now. */
export function clashCells(board: Board): Set<number> {
	return new Set(findClashes(board).flatMap((c) => c.cells));
}

/** Used pairs: how many times each (number, color) pair is on the board. */
export function pairCounts(board: Board): number[] {
	const out = Array(16).fill(0);
	for (let i = 0; i < CELLS; i++) if (board.num[i] >= 0 && board.color[i] >= 0) out[board.num[i] * 4 + board.color[i]]++;
	return out;
}
