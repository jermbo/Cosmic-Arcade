/**
 * The rules of the game, as plain functions on a flat array of cells.
 * 0 is an empty square, 1 a dark pebble, 2 a light pebble. Dark moves first.
 * No DOM here, so the bot worker and the Node tests use the same code.
 */

export type Side = 1 | 2;
export type Cells = ArrayLike<number>;

export const DARK: Side = 1;
export const LIGHT: Side = 2;

/** The board sizes a player can pick. Even, so the four start pebbles sit in the center. */
export const SIZES = [6, 8, 10] as const;
export type Size = (typeof SIZES)[number];

export const other = (s: Side): Side => (s === DARK ? LIGHT : DARK);

const DIRS = [
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[0, -1],
	[0, 1],
	[1, -1],
	[1, 0],
	[1, 1],
] as const;

/** The start position: two of each color, set diagonally in the center. */
export function start(n: number): number[] {
	const cells = new Array<number>(n * n).fill(0);
	const a = n / 2 - 1;
	const b = n / 2;
	cells[a * n + a] = LIGHT;
	cells[b * n + b] = LIGHT;
	cells[a * n + b] = DARK;
	cells[b * n + a] = DARK;
	return cells;
}

export interface Flip {
	/** The squares that flip, nearest the new pebble first in each line. */
	flips: number[];
	/** How many lines (directions) flip. */
	lines: number;
}

/** What a pebble at `i` would flip. No flips means the move is not legal. */
export function flipsAt(cells: Cells, n: number, i: number, side: Side): Flip {
	const out: Flip = { flips: [], lines: 0 };
	if (cells[i] !== 0) return out;
	const r0 = Math.floor(i / n);
	const c0 = i % n;
	const them = other(side);
	for (const [dr, dc] of DIRS) {
		let r = r0 + dr;
		let c = c0 + dc;
		const line: number[] = [];
		while (r >= 0 && r < n && c >= 0 && c < n && cells[r * n + c] === them) {
			line.push(r * n + c);
			r += dr;
			c += dc;
		}
		if (line.length && r >= 0 && r < n && c >= 0 && c < n && cells[r * n + c] === side) {
			out.flips.push(...line);
			out.lines++;
		}
	}
	return out;
}

/** Quick check, with no list: does a pebble at `i` flip anything? */
export function isLegal(cells: Cells, n: number, i: number, side: Side): boolean {
	if (cells[i] !== 0) return false;
	const r0 = Math.floor(i / n);
	const c0 = i % n;
	const them = other(side);
	for (const [dr, dc] of DIRS) {
		let r = r0 + dr;
		let c = c0 + dc;
		let seen = false;
		while (r >= 0 && r < n && c >= 0 && c < n && cells[r * n + c] === them) {
			seen = true;
			r += dr;
			c += dc;
		}
		if (seen && r >= 0 && r < n && c >= 0 && c < n && cells[r * n + c] === side) return true;
	}
	return false;
}

export function legalMoves(cells: Cells, n: number, side: Side): number[] {
	const out: number[] = [];
	for (let i = 0; i < n * n; i++) if (isLegal(cells, n, i, side)) out.push(i);
	return out;
}

/** Plays a move. Returns the new cells and what flipped. The move must be legal. */
export function play(cells: Cells, n: number, i: number, side: Side): { cells: number[] } & Flip {
	const f = flipsAt(cells, n, i, side);
	const next = Array.from(cells);
	next[i] = side;
	for (const j of f.flips) next[j] = side;
	return { cells: next, ...f };
}

export function count(cells: Cells): { dark: number; light: number; empty: number } {
	let dark = 0;
	let light = 0;
	let empty = 0;
	for (let i = 0; i < cells.length; i++) {
		if (cells[i] === DARK) dark++;
		else if (cells[i] === LIGHT) light++;
		else empty++;
	}
	return { dark, light, empty };
}

/**
 * Who moves after `mover` played. The other side moves if it can.
 * If it can't, `mover` goes again (the other side passes). If neither can, the game is over.
 */
export function nextTurn(cells: Cells, n: number, mover: Side): { toMove: Side | null; passed: Side | null } {
	const them = other(mover);
	if (legalMoves(cells, n, them).length) return { toMove: them, passed: null };
	if (legalMoves(cells, n, mover).length) return { toMove: mover, passed: them };
	return { toMove: null, passed: null };
}

export const isCorner = (n: number, i: number) => i === 0 || i === n - 1 || i === n * (n - 1) || i === n * n - 1;

/** A square name for screen readers and the rules: columns A, B, C…, rows 1, 2, 3… from the top. */
export const squareName = (n: number, i: number) => `${String.fromCharCode(65 + (i % n))}${Math.floor(i / n) + 1}`;
