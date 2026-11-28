/**
 * The exact solver. It grows one line at a time from dot a toward dot b,
 * always the line with the fewest moves, and throws out dead ends early.
 *
 * Lines never touch themselves: a cell of a line sits next to only the cells
 * before and after it on that line. Puzzles are made the same way, so "one
 * answer" means one answer of this kind. The game still accepts any full board.
 */
import { neighbors } from './grid.ts';
import type { Pair } from './types.ts';

export interface SolveResult {
	/** How many answers were found, up to the limit. */
	count: number;
	/** The first answer: each path from a to b. */
	paths: number[][] | null;
	/** How many choices the search made: a rough cost of the puzzle. */
	guesses: number;
	/** True when the search ran out of budget before it could finish. */
	gaveUp: boolean;
}

export function solve(w: number, h: number, pairs: Pair[], limit = 2, budget = 400000): SolveResult {
	const n = w * h;
	const nb = neighbors(w, h);
	const k = pairs.length;
	const grid = new Int8Array(n).fill(-1);
	const head = pairs.map((p) => p.a);
	const target = pairs.map((p) => p.b);
	const done = new Array<boolean>(k).fill(false);
	const trail: number[][] = pairs.map((p) => [p.a]);
	pairs.forEach((p, c) => {
		grid[p.a] = c;
		grid[p.b] = c;
	});
	let empty = n - 2 * k;
	let count = 0;
	let paths: number[][] | null = null;
	let guesses = 0;
	let nodes = 0;
	let gaveUp = false;

	const region = new Int16Array(n);
	const seen = new Int32Array(n);
	let stamp = 0;

	/** The legal next cells of line c. */
	function moves(c: number): number[] {
		const hd = head[c];
		const tg = target[c];
		const out: number[] = [];
		// Next to its own end: it must close now, or it would touch itself.
		for (const m of nb[hd]) if (m === tg) return [tg];
		for (const m of nb[hd]) {
			if (grid[m] !== -1) continue;
			let ok = true;
			for (const q of nb[m]) if (q !== hd && q !== tg && grid[q] === c) ok = false;
			if (ok) out.push(m);
		}
		return out;
	}

	/** Cheap checks that prove the board can't be finished. */
	function stuck(): boolean {
		// Every empty cell needs two ways in or out.
		for (let i = 0; i < n; i++) {
			if (grid[i] !== -1) continue;
			let open = 0;
			for (const m of nb[i]) {
				const g = grid[m];
				if (g === -1 || (!done[g] && (m === head[g] || m === target[g]))) open++;
			}
			if (open < 2) return true;
		}
		// Split the empty cells into regions.
		region.fill(-1);
		let regions = 0;
		const stack: number[] = [];
		for (let i = 0; i < n; i++) {
			if (grid[i] !== -1 || region[i] !== -1) continue;
			region[i] = regions;
			stack.push(i);
			while (stack.length) {
				const x = stack.pop()!;
				for (const m of nb[x]) if (grid[m] === -1 && region[m] === -1) {
					region[m] = regions;
					stack.push(m);
				}
			}
			regions++;
		}
		if (regions === 0) return false;
		const fed = new Uint8Array(regions);
		for (let c = 0; c < k; c++) {
			if (done[c]) continue;
			const hd = head[c];
			const tg = target[c];
			let touching = false;
			stamp++;
			for (const m of nb[hd]) {
				if (m === tg) touching = true;
				if (grid[m] === -1) seen[region[m]] = stamp;
			}
			if (touching) continue;
			let shared = false;
			for (const m of nb[tg]) {
				if (grid[m] !== -1) continue;
				const r = region[m];
				if (seen[r] === stamp) {
					shared = true;
					fed[r] = 1;
				}
			}
			// The two ends of a line must share a region to meet.
			if (!shared) return true;
		}
		// A region no line can reach both ends into would stay empty.
		for (let r = 0; r < regions; r++) if (!fed[r]) return true;
		return false;
	}

	function search(): void {
		if (count >= limit || gaveUp) return;
		if (++nodes > budget) {
			gaveUp = true;
			return;
		}
		let best = -1;
		let bestMoves: number[] = [];
		for (let c = 0; c < k; c++) {
			if (done[c]) continue;
			const m = moves(c);
			if (m.length === 0) return;
			if (best === -1 || m.length < bestMoves.length) {
				best = c;
				bestMoves = m;
				if (m.length === 1) break;
			}
		}
		if (best === -1) {
			if (empty === 0) {
				count++;
				if (!paths) paths = trail.map((t) => t.slice());
			}
			return;
		}
		if (bestMoves.length > 1) guesses += bestMoves.length - 1;
		const c = best;
		const from = head[c];
		for (const m of bestMoves) {
			if (m === target[c]) {
				done[c] = true;
				trail[c].push(m);
				if (!stuck()) search();
				trail[c].pop();
				done[c] = false;
			} else {
				grid[m] = c;
				head[c] = m;
				empty--;
				trail[c].push(m);
				if (!stuck()) search();
				trail[c].pop();
				empty++;
				head[c] = from;
				grid[m] = -1;
			}
			if (count >= limit || gaveUp) return;
		}
	}

	if (!stuck()) search();
	return { count, paths, guesses, gaveUp };
}
