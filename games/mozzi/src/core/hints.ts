/**
 * Hints for the player's board, in three levels: where, why, what.
 *
 * 1. First look for wrong entries (anything that differs from the answer).
 *    A wrong pane is pointed out before any new step, so a hint never builds on a mistake.
 * 2. Otherwise ask the human solver for the easiest next step, from the board as it
 *    is now. Pencil notes are ignored: they may be wrong.
 *
 * Why this always works: the generator only keeps puzzles that the solver finishes
 * from the clues. A board with more correct entries only gives the rules more to
 * work with, so the solver still finds a step. The tests check this on many boards.
 */
import { CELLS } from './grid.ts';
import type { Explanation } from './explain.ts';
import { explain } from './explain.ts';
import { isFull, nextStep } from './logic.ts';
import { findClashes } from './solve.ts';
import type { Axis, Board, Puzzle } from './types.ts';
import type { Sentence } from './words.ts';

export interface WrongHint {
	kind: 'wrong';
	cell: number;
	/** The parts that are wrong (number, color or both). */
	axes: Axis[];
	where: Sentence;
	why: Sentence[];
	/** The tiles it clashes with, if any. */
	clashWith: number[];
}

export interface StepHint {
	kind: 'step';
	ex: Explanation;
}

export type Hint = WrongHint | StepHint | { kind: 'done' } | { kind: 'stuck' };

export function wrongEntries(puzzle: Puzzle, board: Board): { cell: number; axes: Axis[] }[] {
	const out: { cell: number; axes: Axis[] }[] = [];
	for (let i = 0; i < CELLS; i++) {
		const axes: Axis[] = [];
		if (board.num[i] >= 0 && board.num[i] !== puzzle.solution.num[i]) axes.push('num');
		if (board.color[i] >= 0 && board.color[i] !== puzzle.solution.color[i]) axes.push('color');
		if (axes.length) out.push({ cell: i, axes });
	}
	return out;
}

export function getHint(puzzle: Puzzle, board: Board): Hint {
	const wrong = wrongEntries(puzzle, board);
	if (wrong.length) {
		// Prefer a wrong pane that clashes with something: it is the easiest to see.
		const clashes = findClashes(board);
		const clashing = (c: number) => clashes.filter((k) => k.cells.includes(c));
		const pick = wrong.find((w) => clashing(w.cell).length) ?? wrong[0];
		const c = pick.cell;
		const parts: Sentence = pick.axes.length === 2 ? ['its number and its color'] : pick.axes[0] === 'num' ? ['its number'] : ['its color'];
		const why: Sentence[] = [];
		const clashWith = [...new Set(clashing(c).map((k) => (k.cells[0] === c ? k.cells[1] : k.cells[0])))];
		for (const k of clashing(c)) {
			const o = k.cells[0] === c ? k.cells[1] : k.cells[0];
			if (k.kind === 'pair') why.push(['It is the same pair as ', { t: 'cell', cell: o }, '.']);
			else
				why.push([
					'It has the same ',
					k.kind === 'num' ? 'number' : 'color',
					' as ',
					{ t: 'cell', cell: o },
					', in the same ',
					Math.floor(o / 4) === Math.floor(c / 4) ? 'row' : 'column',
					'.',
				]);
		}
		if (!why.length) why.push(['It breaks no rule yet, but the window can’t be finished with it.']);
		why.push(['Take off ', ...parts, ' and try again.']);
		return { kind: 'wrong', cell: c, axes: pick.axes, where: ['Something on ', { t: 'cell', cell: c }, ' doesn’t fit.'], why, clashWith };
	}
	if (isFull(board)) return { kind: 'done' };
	const step = nextStep(board);
	if (!step) return { kind: 'stuck' };
	return { kind: 'step', ex: explain(step) };
}
