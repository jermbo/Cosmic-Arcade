/**
 * One puzzle being played. No UI code here.
 *
 * `paths[k]` is the line of color k: the cells from one of its dots, in order.
 * An empty array means nothing is drawn. A drag works on a copy, so a line that
 * the drag cuts comes back if the drag pulls away again before the finger lifts.
 */
import { isNext, stepsBetween } from '../core/grid.ts';
import type { Puzzle } from '../core/types.ts';

export type Paths = number[][];

export interface Drag {
	color: number;
	/** The lines when the drag began. */
	base: Paths;
	/** The line being drawn. */
	path: number[];
}

/** Cell → the color of the dot on it, or -1. */
export function dotMap(p: Puzzle): Int8Array {
	const out = new Int8Array(p.w * p.h).fill(-1);
	p.pairs.forEach((pair, k) => {
		out[pair.a] = k;
		out[pair.b] = k;
	});
	return out;
}

export const emptyPaths = (p: Puzzle): Paths => p.pairs.map(() => []);

/** Cell → the color of the line on it (dots count), or -1. */
export function owners(p: Puzzle, paths: Paths): Int8Array {
	const out = dotMap(p);
	paths.forEach((path, k) => path.forEach((c) => (out[c] = k)));
	return out;
}

/** True when line k runs from one of its dots to the other. */
export function isLinked(p: Puzzle, paths: Paths, k: number): boolean {
	const path = paths[k];
	if (path.length < 2) return false;
	const { a, b } = p.pairs[k];
	const s = path[0];
	const e = path[path.length - 1];
	return (s === a && e === b) || (s === b && e === a);
}

export function progress(p: Puzzle, paths: Paths) {
	const own = owners(p, paths);
	let filled = 0;
	for (const o of own) if (o >= 0) filled++;
	const linked = p.pairs.filter((_, k) => isLinked(p, paths, k)).length;
	return { linked, total: p.pairs.length, filled, cells: p.w * p.h, fillPct: Math.round((filled / (p.w * p.h)) * 100) };
}

export function isSolved(p: Puzzle, paths: Paths): boolean {
	const pr = progress(p, paths);
	return pr.linked === pr.total && pr.filled === pr.cells;
}

/**
 * Starts a drag on a cell. A dot starts its line over (so a tap on a dot clears
 * its line). A line cell picks the line up from there.
 */
export function startDrag(p: Puzzle, paths: Paths, cell: number): Drag | null {
	const dot = dotMap(p)[cell];
	if (dot >= 0) return { color: dot, base: paths, path: [cell] };
	for (let k = 0; k < paths.length; k++) {
		const at = paths[k].indexOf(cell);
		if (at >= 0) return { color: k, base: paths, path: paths[k].slice(0, at + 1) };
	}
	return null;
}

/** One step to a neighbor cell. Returns the same drag if the step is not allowed. */
function step(p: Puzzle, dots: Int8Array, d: Drag, next: number): Drag {
	const path = d.path;
	const head = path[path.length - 1];
	if (!isNext(p.w, head, next)) return d;
	const back = path.indexOf(next);
	if (back >= 0) return { ...d, path: path.slice(0, back + 1) };
	const linked = path.length > 1 && dots[head] === d.color;
	if (linked) return d;
	const dot = dots[next];
	if (dot >= 0 && dot !== d.color) return d;
	return { ...d, path: [...path, next] };
}

/** Moves the drag to a cell, walking through the cells between for a fast finger. */
export function dragTo(p: Puzzle, d: Drag, cell: number): Drag {
	const dots = dotMap(p);
	let cur = d;
	for (const c of stepsBetween(p.w, cur.path[cur.path.length - 1], cell)) {
		const next = step(p, dots, cur, c);
		if (next === cur) break;
		cur = next;
	}
	return cur;
}

/** The board as it looks during the drag: other lines are cut where the drag crosses them. */
export function dragView(d: Drag): Paths {
	const on = new Set(d.path);
	return d.base.map((path, k) => {
		if (k === d.color) return d.path.length > 1 ? d.path : [];
		const cut = path.findIndex((c) => on.has(c));
		if (cut < 0) return path;
		return cut > 1 ? path.slice(0, cut) : [];
	});
}

/** Lines that the drag cut short (for a soft sound). */
export function cutColors(d: Drag, view: Paths): number[] {
	return d.base.map((path, k) => (k !== d.color && view[k].length < path.length ? k : -1)).filter((k) => k >= 0);
}

export const samePaths = (a: Paths, b: Paths) => a.length === b.length && a.every((x, k) => x.length === b[k].length && x.every((c, i) => c === b[k][i]));

/** Draws the answer line of color k and cuts what was in its way. */
export function showLine(p: Puzzle, paths: Paths, k: number): Paths {
	const line = p.solution[k];
	const on = new Set(line);
	return paths.map((path, j) => {
		if (j === k) return line.slice();
		const cut = path.findIndex((c) => on.has(c));
		if (cut < 0) return path;
		return cut > 1 ? path.slice(0, cut) : [];
	});
}

/**
 * The line a hint should show: of the lines that are not yet right, the one of
 * middle length. The longest gives away too much, the shortest too little.
 * -1 if all are right.
 */
export function hintColor(p: Puzzle, paths: Paths): number {
	const wrong = p.solution
		.map((line, k) => {
			const mine = paths[k];
			const right = mine.length === line.length && (mine.every((c, i) => c === line[i]) || mine.every((c, i) => c === line[line.length - 1 - i]));
			return right ? -1 : k;
		})
		.filter((k) => k >= 0)
		.sort((a, b) => p.solution[a].length - p.solution[b].length || a - b);
	return wrong.length ? wrong[Math.floor(wrong.length / 2)] : -1;
}
