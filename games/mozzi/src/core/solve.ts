/**
 * The exact solver. It tries every possibility (backtracking), so it is the judge
 * of "exactly one solution". Players never see it: hints come from `logic.ts`.
 */
import { CELLS, PEERS, SIZE, bitCount, pairOf } from './grid.ts';
import type { Rng } from './rng.ts';
import { shuffle } from './rng.ts';
import type { Board, Solution } from './types.ts';

/** The 16 pairs a tile could hold, given only its own locked parts. */
function ownPairs(board: Board, cell: number): number {
	let mask = 0;
	for (let n = 0; n < SIZE; n++) {
		if (board.num[cell] >= 0 && board.num[cell] !== n) continue;
		for (let c = 0; c < SIZE; c++) {
			if (board.color[cell] >= 0 && board.color[cell] !== c) continue;
			mask |= 1 << pairOf(n, c);
		}
	}
	return mask;
}

/** Pairs that clash with a tile that holds `pair`: same number or same color (for row and column peers). */
const SAME_NUM_OR_COLOR: number[] = Array.from({ length: 16 }, (_, p) => {
	let mask = 0;
	for (let q = 0; q < 16; q++) if (q >> 2 === p >> 2 || (q & 3) === (p & 3)) mask |= 1 << q;
	return mask;
});

/**
 * Counts solutions, stopping at `limit`. With `out`, the first solution is written there.
 * With `rng`, it tries pairs in a random order (used to make new full windows).
 */
export function countSolutions(board: Board, limit = 2, out?: Solution, rng?: Rng): number {
	const options = Array.from({ length: CELLS }, (_, i) => ownPairs(board, i));
	const placed = new Array<number>(CELLS).fill(-1);
	let found = 0;

	const search = (usedPairs: number): void => {
		// Pick the open tile with the fewest options.
		let best = -1;
		let bestCount = 99;
		let bestMask = 0;
		for (let i = 0; i < CELLS; i++) {
			if (placed[i] >= 0) continue;
			let mask = options[i] & ~usedPairs;
			for (const peer of PEERS[i]) if (placed[peer] >= 0) mask &= ~SAME_NUM_OR_COLOR[placed[peer]];
			const count = bitCount(mask);
			if (count < bestCount) {
				best = i;
				bestCount = count;
				bestMask = mask;
				if (count === 0) return;
			}
		}
		if (best < 0) {
			found++;
			if (out && found === 1) {
				for (let i = 0; i < CELLS; i++) {
					out.num[i] = placed[i] >> 2;
					out.color[i] = placed[i] & 3;
				}
			}
			return;
		}
		let pairs: number[] = [];
		for (let p = 0; p < 16; p++) if (bestMask & (1 << p)) pairs.push(p);
		if (rng) pairs = shuffle(pairs, rng);
		for (const p of pairs) {
			placed[best] = p;
			search(usedPairs | (1 << p));
			placed[best] = -1;
			if (found >= limit) return;
		}
	};

	search(0);
	return found;
}

/** A random full window: a valid answer to an empty grid. */
export function randomSolution(rng: Rng): Solution {
	const out: Solution = { num: Array(CELLS).fill(-1), color: Array(CELLS).fill(-1) };
	const empty: Board = { num: Array(CELLS).fill(-1), color: Array(CELLS).fill(-1) };
	countSolutions(empty, 1, out, rng);
	return out;
}

/** True when the board follows every rule (it may still be unfinished). */
export function breaksNoRule(board: Board): boolean {
	return findClashes(board).length === 0;
}

export interface Clash {
	kind: 'num' | 'color' | 'pair';
	cells: [number, number];
}

/** Every pair of tiles that break a rule: same number or color in a line, or the same pair twice. */
export function findClashes(board: Board): Clash[] {
	const out: Clash[] = [];
	for (let a = 0; a < CELLS; a++) {
		for (let b = a + 1; b < CELLS; b++) {
			const sameLine = Math.floor(a / 4) === Math.floor(b / 4) || a % 4 === b % 4;
			if (sameLine && board.num[a] >= 0 && board.num[a] === board.num[b]) out.push({ kind: 'num', cells: [a, b] });
			if (sameLine && board.color[a] >= 0 && board.color[a] === board.color[b]) out.push({ kind: 'color', cells: [a, b] });
			if (
				board.num[a] >= 0 &&
				board.color[a] >= 0 &&
				board.num[a] === board.num[b] &&
				board.color[a] === board.color[b]
			)
				out.push({ kind: 'pair', cells: [a, b] });
		}
	}
	return out;
}
