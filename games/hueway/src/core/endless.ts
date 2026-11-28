/**
 * Boards for the two Endless modes.
 *
 * Clock run: boards grow as the run goes on (4×4, 4×4, 5×5, 5×5, …).
 * Road trip: line 0 is the road. It starts on the left edge, in the row where
 * the last board's road left, and ends on the right edge.
 */
import { coverGrid } from './generate.ts';
import { hashSeed, makeRng, shuffle } from './rng.ts';
import { solve } from './solve.ts';
import type { Puzzle } from './types.ts';
import { PALETTE } from './types.ts';

/** How many colors a size gets: [fewest, most]. Tune here. */
export const ENDLESS_COLORS: Record<number, [number, number]> = {
	4: [3, 3],
	5: [4, 5],
	6: [5, 6],
	7: [6, 7],
	8: [7, 8],
	9: [8, 9],
};

/** Clock run: the size of board n (from 0). Tune here. */
export const clockSize = (n: number) => Math.min(9, 4 + Math.floor(n / 2));

/** Clock run: the clock at the start, and the time a solved board gives back. Tune here. */
export const CLOCK = {
	startMs: 60_000,
	bonusMs: (size: number) => size * 4000,
};

/** Road trip: the size of stop n (from 0). Tune here. */
export const roadSize = (n: number) => Math.min(7, 5 + Math.floor(n / 5));

/** A square board with one answer. `accept` can reshape or turn down a candidate. */
function makeBoard(id: string, size: number, seedText: string, accept?: (p: Puzzle) => Puzzle | null): Puzzle | null {
	const [lo, hi] = ENDLESS_COLORS[size];
	for (let n = 0; n < 6000; n++) {
		const seed = hashSeed(`${seedText}#${n}`);
		const rng = makeRng(seed);
		const goal = Math.min(PALETTE, lo + Math.floor(rng() * (hi - lo + 1)));
		const lines = coverGrid(size, size, goal, rng);
		if (!lines || lines.length < lo) continue;
		const order = shuffle(lines, rng);
		let p: Puzzle | null = { id, seed, level: 'easy', w: size, h: size, pairs: order.map((l) => ({ a: l[0], b: l[l.length - 1] })), solution: order };
		if (accept) p = accept(p);
		if (!p) continue;
		const res = solve(size, size, p.pairs, 2);
		if (res.count === 1 && !res.gaveUp) return p;
	}
	return null;
}

/** Boards made this visit, so a board made early (while you play the last one) is ready at once. */
const made = new Map<string, Puzzle>();

export function clockBoard(run: string, n: number): Puzzle {
	const id = `clock-${run}-${n}`;
	const hit = made.get(id);
	if (hit) return hit;
	const p = makeBoard(`clock-${run}-${n}`, clockSize(n), `hueway-clock-${run}-${n}`);
	if (!p) throw new Error('No clock board');
	made.set(id, p);
	return p;
}

/** The row where a road board's road leaves on the right. */
export const exitRow = (p: Puzzle) => Math.floor(p.solution[0][p.solution[0].length - 1] / p.w);
/** The row where a road board's road comes in on the left. */
export const entryRow = (p: Puzzle) => Math.floor(p.solution[0][0] / p.w);

/**
 * Road trip stop n. `entry` is the row the road must come in on (null for the
 * first stop). Line 0 runs from that row on the left edge to the right edge.
 */
export function roadBoard(trip: string, n: number, entry: number | null): Puzzle {
	const key = `road-${trip}-${n}-${entry}`;
	const hit = made.get(key);
	if (hit) return hit;
	const size = roadSize(n);
	const pick = (p: Puzzle): Puzzle | null => {
		const w = p.w;
		const left = (c: number) => c % w === 0 && (entry === null || Math.floor(c / w) === entry);
		const right = (c: number) => c % w === w - 1;
		const k = p.solution.findIndex((l) => (left(l[0]) && right(l[l.length - 1])) || (left(l[l.length - 1]) && right(l[0])));
		if (k < 0) return null;
		let road = p.solution[k];
		if (!left(road[0])) road = road.slice().reverse();
		const solution = [road, ...p.solution.filter((_, i) => i !== k)];
		return { ...p, solution, pairs: solution.map((l) => ({ a: l[0], b: l[l.length - 1] })) };
	};
	const p = makeBoard(`road-${trip}-${n}`, size, `hueway-road-${trip}-${n}`, pick);
	if (!p) throw new Error('No road board');
	made.set(key, p);
	return p;
}
