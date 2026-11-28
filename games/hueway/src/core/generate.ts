/**
 * The puzzle maker.
 *
 * 1. Cover the grid with lines: start with every cell as its own tiny line,
 *    then keep joining two line ends that sit side by side, as long as the
 *    joined line never touches itself.
 * 2. Keep only the two ends of each line as dots.
 * 3. Ask the solver. Keep the puzzle only if it has exactly one answer.
 */
import { neighbors } from './grid.ts';
import { hashSeed, makeRng, shuffle } from './rng.ts';
import type { Rng } from './rng.ts';
import { solve } from './solve.ts';
import type { Level, Pair, Puzzle } from './types.ts';
import { LEVEL_SHAPE } from './types.ts';

/** Shortest line allowed. Two dots side by side make a dull line. */
const MIN_LENGTH = 3;

/**
 * Covers a w × h grid with at most `goal` lines that never touch themselves,
 * each at least MIN_LENGTH long. Null if it can't.
 *
 * Joins alone get stuck, so when no join helps, a short line "cuts in": it
 * joins the middle of a next-door line, and the cut-off tail becomes a line
 * of its own. That keeps things moving until the cover is good.
 */
export function coverGrid(w: number, h: number, goal: number, rng: Rng): number[][] | null {
	const n = w * h;
	const nb = neighbors(w, h);
	const lines: number[][] = Array.from({ length: n }, (_, i) => [i]);
	const owner = Array.from({ length: n }, (_, i) => i);
	const mark = new Int32Array(n);
	let stamp = 0;
	let count = n;

	const isEnd = (cell: number) => {
		const line = lines[owner[cell]];
		return line[0] === cell || line[line.length - 1] === cell;
	};
	const pickOf = <T>(list: T[]) => list[Math.floor(rng() * list.length)];

	/** True if `cells` (ending at ea) can join `other` (marked, ending at eb) without touching. */
	function clean(cells: number[], ea: number, eb: number) {
		for (const c of cells) for (const m of nb[c]) if (mark[m] === stamp && !(c === ea && m === eb)) return false;
		return true;
	}

	/** Puts `line` in slot `id`, owning its cells. */
	function place(id: number, line: number[]) {
		lines[id] = line;
		for (const c of line) owner[c] = id;
	}

	function join(ea: number, eb: number) {
		const a = owner[ea];
		const b = owner[eb];
		let la = lines[a];
		let lb = lines[b];
		if (la[la.length - 1] !== ea) la = la.slice().reverse();
		if (lb[0] !== eb) lb = lb.slice().reverse();
		lines[b] = [];
		place(a, la.concat(lb));
		count--;
	}

	function canJoin(ea: number, eb: number) {
		stamp++;
		for (const c of lines[owner[eb]]) mark[c] = stamp;
		return clean(lines[owner[ea]], ea, eb);
	}

	/** Line S (end e) cuts into line L at its middle cell x. */
	function cutIn(e: number, x: number): boolean {
		const s = owner[e];
		const l = owner[x];
		const line = lines[l];
		const at = line.indexOf(x);
		// Keep the head up to x, or x to the tail: pick one at random.
		const keepHead = rng() < 0.5;
		const kept = keepHead ? line.slice(0, at + 1) : line.slice(at).reverse();
		const rest = keepHead ? line.slice(at + 1) : line.slice(0, at).reverse();
		if (rest.length === 0) return false;
		stamp++;
		for (const c of kept) mark[c] = stamp;
		if (!clean(lines[s], e, x)) return false;
		let ls = lines[s];
		if (ls[0] !== e) ls = ls.slice().reverse();
		place(l, kept.concat(ls));
		place(s, rest);
		return true;
	}

	const short = (id: number) => lines[id].length > 0 && lines[id].length < MIN_LENGTH;

	for (let step = 0; step < n * 60; step++) {
		const shorts: number[] = [];
		for (let i = 0; i < n; i++) if (short(i)) shorts.push(i);
		if (count <= goal && shorts.length === 0) return lines.filter((l) => l.length > 0);

		// Joins that help: any join while there are too many lines, or one that grows a short line.
		const joins: [number, number][] = [];
		for (let cell = 0; cell < n; cell++) {
			if (!isEnd(cell)) continue;
			for (const m of nb[cell]) {
				if (owner[m] <= owner[cell] || !isEnd(m)) continue;
				if (count <= goal && !short(owner[cell]) && !short(owner[m])) continue;
				if (canJoin(cell, m)) joins.push([cell, m]);
			}
		}
		if (joins.length) {
			// Mostly help the shortest lines grow, so no tiny line is left behind.
			if (rng() < 0.6) {
				const len = ([a, b]: [number, number]) => Math.min(lines[owner[a]].length, lines[owner[b]].length);
				const least = Math.min(...joins.map(len));
				join(...pickOf(joins.filter((j) => len(j) === least)));
			} else join(...pickOf(joins));
			continue;
		}

		// Stuck: a short line (or any line, if there are too many) cuts into a neighbor.
		const pool = shorts.length ? shorts : lines.map((l, i) => (l.length ? i : -1)).filter((i) => i >= 0);
		const s = pickOf(pool);
		const ends = [lines[s][0], lines[s][lines[s].length - 1]];
		const tries: [number, number][] = [];
		for (const e of ends) for (const m of nb[e]) if (owner[m] !== s && !isEnd(m)) tries.push([e, m]);
		if (tries.length) cutIn(...pickOf(tries));
	}
	return null;
}

/** Tries one seed. Null if the cover failed or the puzzle has more than one answer. */
function attempt(seed: number, level: Level) {
	const rng = makeRng(seed);
	const { size, colors } = LEVEL_SHAPE[level];
	const goal = colors[0] + Math.floor(rng() * (colors[1] - colors[0] + 1));
	const lines = coverGrid(size, size, goal, rng);
	if (!lines || lines.length < colors[0]) return null;
	const order = shuffle(lines, rng);
	const pairs: Pair[] = order.map((l) => ({ a: l[0], b: l[l.length - 1] }));
	const res = solve(size, size, pairs, 2);
	if (res.count !== 1 || res.gaveUp) return null;
	return { pairs, solution: order, guesses: res.guesses, size };
}

/** How many good puzzles to make before keeping the hardest. Tune here. */
const CHOICES: Record<Level, number> = { easy: 1, medium: 2, hard: 2, expert: 3, master: 3 };

/** The same id and seed text always make the same puzzle. */
export function makePuzzle(id: string, seedText: string, level: Level): Puzzle {
	let best: Puzzle | null = null;
	let bestGuesses = -1;
	let found = 0;
	for (let n = 0; found < CHOICES[level] && n < 4000; n++) {
		const seed = hashSeed(`${seedText}#${n}`);
		const made = attempt(seed, level);
		if (!made) continue;
		found++;
		if (made.guesses > bestGuesses) {
			bestGuesses = made.guesses;
			best = { id, seed, level, w: made.size, h: made.size, pairs: made.pairs, solution: made.solution };
		}
	}
	if (!best) throw new Error(`No puzzle for ${id}`);
	return best;
}
