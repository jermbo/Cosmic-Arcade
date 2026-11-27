/**
 * The human solver. It only uses rules a person can follow, one step at a time,
 * and it remembers WHY each option was ruled out, so hints can explain it.
 *
 * Inside, every tile keeps a set of the 16 pairs (number + color) it could still hold.
 * A rule removes pairs from tiles. A step is found when a tile, a line or a pair
 * has only one option left.
 */
import { CELLS, LINES, PEERS, SIZE, colOf, onlyBit, pairOf, rowOf } from './grid.ts';
import type { Line } from './grid.ts';
import type { Axis, Board } from './types.ts';
import { copyBoard } from './types.ts';

// ---------------------------------------------------------------- rules and reasons

/**
 * The tiers of logic, easiest first. A step of tier T may use every rule up to T.
 * 1 Lines: a row or column holds each number and each color once.
 * 2 Used pairs: a finished pane's pair can't appear again.
 * 3 Pair hunt: every pair appears once, so if only one tile can hold it, it goes there.
 * 4 Trades: any two rows (or columns) trade their numbers, and their colors, in pairs.
 *
 * (We also tried "twins", two tiles in a line that share the same two options.
 * In 4×4 it never found anything the rules above missed, so it was left out.)
 */
export const TIERS = [1, 2, 3, 4] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_NAMES: Record<Tier, string> = {
	1: 'Lines',
	2: 'Used pairs',
	3: 'Pair hunt',
	4: 'Trades',
};

/** Why an option was ruled out for a tile. */
export type Reason =
	/** The tile itself already has another number (or color). */
	| { kind: 'self'; axis: Axis }
	/** A tile in the same row or column (`by`) already has this number (or color). */
	| { kind: 'line'; axis: Axis; value: number; by: number }
	/** The pair is already finished in tile `by`. */
	| { kind: 'pairUsed'; pair: number; by: number }
	/**
	 * Trade: `known` is a tile in this tile's line and the tile beside it in the
	 * partner line, which show the trade `a` <-> `b`. This tile's `a` would need
	 * its `mirror` tile (same spot in the partner line) to be `b`, and it can't be.
	 */
	| { kind: 'trade'; axis: Axis; lineKind: 'row' | 'col'; known: [number, number]; a: number; b: number; mirror: number };

/** Pairs with number n are bits 4n..4n+3. Pairs with color c are bits c, c+4, c+8, c+12. */
export const NUM_PAIRS = [0, 1, 2, 3].map((n) => 0xf << (n * 4));
export const COLOR_PAIRS = [0, 1, 2, 3].map((c) => 0x1111 << c);
export const axisPairs = (axis: Axis, value: number) => (axis === 'num' ? NUM_PAIRS[value] : COLOR_PAIRS[value]);
export const known = (board: Board, axis: Axis) => (axis === 'num' ? board.num : board.color);

/** The numbers (or colors) still possible in a set of pairs. */
export function project(pairs: number, axis: Axis): number {
	let out = 0;
	for (let v = 0; v < SIZE; v++) if (pairs & axisPairs(axis, v)) out |= 1 << v;
	return out;
}

// ---------------------------------------------------------------- candidate state

export class Candidates {
	readonly board: Board;
	/** Pairs each tile could still hold (16-bit sets). */
	readonly pairs: number[];
	/** Why each (tile, pair) was ruled out. Index tile * 16 + pair. */
	readonly why: (Reason | null)[];
	readonly tier: Tier;

	constructor(board: Board, tier: Tier) {
		this.board = copyBoard(board); // a snapshot: explanations read it later
		this.tier = tier;
		this.pairs = new Array(CELLS).fill(0xffff);
		this.why = new Array(CELLS * 16).fill(null);
		this.build();
	}

	/** Removes pairs from a tile. Returns true if anything changed. */
	private cut(cell: number, mask: number, reason: Reason): boolean {
		const gone = this.pairs[cell] & mask;
		if (!gone) return false;
		this.pairs[cell] &= ~mask;
		for (let p = 0; p < 16; p++) if (gone & (1 << p)) this.why[cell * 16 + p] = reason;
		return true;
	}

	options(cell: number, axis: Axis): number {
		return project(this.pairs[cell], axis);
	}

	private build() {
		const { num, color } = this.board;
		// The tile's own known parts.
		for (let i = 0; i < CELLS; i++) {
			if (num[i] >= 0) this.cut(i, ~NUM_PAIRS[num[i]] & 0xffff, { kind: 'self', axis: 'num' });
			if (color[i] >= 0) this.cut(i, ~COLOR_PAIRS[color[i]] & 0xffff, { kind: 'self', axis: 'color' });
		}
		// Tier 1: rows and columns.
		for (let i = 0; i < CELLS; i++) {
			for (const peer of PEERS[i]) {
				if (num[i] >= 0) this.cut(peer, NUM_PAIRS[num[i]], { kind: 'line', axis: 'num', value: num[i], by: i });
				if (color[i] >= 0) this.cut(peer, COLOR_PAIRS[color[i]], { kind: 'line', axis: 'color', value: color[i], by: i });
			}
		}
		if (this.tier < 2) return;
		// Tier 2: a finished pane uses up its pair.
		for (let i = 0; i < CELLS; i++) {
			if (num[i] < 0 || color[i] < 0) continue;
			const pair = pairOf(num[i], color[i]);
			for (let j = 0; j < CELLS; j++) if (j !== i) this.cut(j, 1 << pair, { kind: 'pairUsed', pair, by: i });
		}
		// Tier 3 adds no cuts: the pair hunt is a way to find a step (see findAtTier).
		if (this.tier < 4) return;
		// Tier 4: trades, repeated until nothing changes (one cut can enable another).
		for (let guard = 0; guard < 30 && this.trades(); guard++);
	}

	/**
	 * Trades. In a finished window, any two rows (or two columns) trade their numbers
	 * in pairs: if row 1 has a 2 where row 3 has a 4, then row 1 has a 4 where row 3
	 * has a 2. The same holds for colors.
	 * So with a known trade a <-> b at one spot, line B can only put its `a` in a spot
	 * where line A can still put a `b`.
	 */
	private trades(): boolean {
		let changed = false;
		for (const axis of ['num', 'color'] as const) {
			const k = known(this.board, axis);
			for (const lineKind of ['row', 'col'] as const) {
				const at = (line: number, x: number) => (lineKind === 'row' ? line * SIZE + x : x * SIZE + line);
				for (let la = 0; la < SIZE; la++) {
					for (let lb = 0; lb < SIZE; lb++) {
						if (la === lb) continue;
						for (let x = 0; x < SIZE; x++) {
							const ca = at(la, x);
							const cb = at(lb, x);
							const a = k[ca];
							const b = k[cb];
							if (a < 0 || b < 0) continue;
							for (let y = 0; y < SIZE; y++) {
								if (y === x) continue;
								const target = at(lb, y);
								const mirror = at(la, y);
								if (!(this.options(target, axis) & (1 << a))) continue;
								if (this.options(mirror, axis) & (1 << b)) continue;
								const reason: Reason = { kind: 'trade', axis, lineKind, known: [cb, ca], a, b, mirror };
								changed = this.cut(target, axisPairs(axis, a), reason) || changed;
							}
						}
					}
				}
			}
		}
		return changed;
	}
}

// ---------------------------------------------------------------- steps

export type Technique =
	/** Only one spot in a line can take this number or color. */
	| 'onlySpot'
	/** Only one number (or color) is left for this tile. */
	| 'lastOption'
	/** Only one tile can hold this pair. */
	| 'pairHunt';

export interface Fact {
	cell: number;
	axis: Axis;
	value: number;
}

export interface Step {
	tier: Tier;
	technique: Technique;
	/** The tile that gets filled. */
	cell: number;
	/** What gets placed (1 fact, or 2 for a pair hunt when both parts are new). */
	facts: Fact[];
	axis: Axis;
	value: number;
	/** For onlySpot: the line that was scanned. */
	line?: Line;
	/** For pairHunt: the pair. */
	pair?: number;
	/** The candidate state the step was found in, for explanations. */
	cand: Candidates;
}

/** Finds a step using the rules up to this tier, or null. */
function findAtTier(board: Board, tier: Tier): Step | null {
	const cand = new Candidates(board, tier);
	const axes: Axis[] = ['num', 'color'];

	// A broken board (a tile with no options). Hints check for wrong entries first.
	for (let i = 0; i < CELLS; i++) if (cand.pairs[i] === 0) return null;

	// Only spot in a line (people find these first).
	for (const line of LINES) {
		for (const axis of axes) {
			const k = known(board, axis);
			for (let v = 0; v < SIZE; v++) {
				if (line.cells.some((c) => k[c] === v)) continue;
				const spots = line.cells.filter((c) => k[c] < 0 && cand.options(c, axis) & (1 << v));
				if (spots.length === 1)
					return { tier, technique: 'onlySpot', cell: spots[0], facts: [{ cell: spots[0], axis, value: v }], axis, value: v, line, cand };
			}
		}
	}
	// Last option in a tile.
	for (let i = 0; i < CELLS; i++) {
		for (const axis of axes) {
			if (known(board, axis)[i] >= 0) continue;
			const v = onlyBit(cand.options(i, axis));
			if (v >= 0) return { tier, technique: 'lastOption', cell: i, facts: [{ cell: i, axis, value: v }], axis, value: v, cand };
		}
	}
	if (tier < 3) return null;
	// Pair hunt: a pair that is not finished yet, with only one tile left that can hold it.
	for (let p = 0; p < 16; p++) {
		const n = p >> 2;
		const c = p & 3;
		let finished = false;
		const homes: number[] = [];
		for (let i = 0; i < CELLS; i++) {
			if (board.num[i] === n && board.color[i] === c) finished = true;
			if (cand.pairs[i] & (1 << p)) homes.push(i);
		}
		if (finished || homes.length !== 1) continue;
		const cell = homes[0];
		const facts: Fact[] = [];
		if (board.num[cell] < 0) facts.push({ cell, axis: 'num', value: n });
		if (board.color[cell] < 0) facts.push({ cell, axis: 'color', value: c });
		if (facts.length === 0) continue;
		return { tier, technique: 'pairHunt', cell, facts, axis: facts[0].axis, value: facts[0].value, pair: p, cand };
	}
	return null;
}

/** The easiest next step from this board, or null if the rules can't find one. */
export function nextStep(board: Board, maxTier: Tier = 4): Step | null {
	for (const tier of TIERS) {
		if (tier > maxTier) break;
		const step = findAtTier(board, tier);
		if (step) return step;
	}
	return null;
}

export const isFull = (board: Board) => board.num.every((v) => v >= 0) && board.color.every((v) => v >= 0);

export function applyFacts(board: Board, facts: Fact[]) {
	for (const f of facts) known(board, f.axis)[f.cell] = f.value;
}

export interface LogicRun {
	solved: boolean;
	steps: Step[];
	board: Board;
}

/** Solves as far as the rules allow, always taking the easiest step. */
export function solveLogically(start: Board, maxTier: Tier = 4): LogicRun {
	const board = copyBoard(start);
	const steps: Step[] = [];
	while (!isFull(board)) {
		const step = nextStep(board, maxTier);
		if (!step) return { solved: false, steps, board };
		steps.push(step);
		applyFacts(board, step.facts);
	}
	return { solved: true, steps, board };
}

export const sameLine = (a: number, b: number) => rowOf(a) === rowOf(b) || colOf(a) === colOf(b);
