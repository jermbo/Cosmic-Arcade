/**
 * The three bots. All their numbers live in BOTS, so they are easy to tune.
 *  - Sleepy: a random legal move, a little drawn to big flips.
 *  - Steady: the best move one step ahead, by square value, flips and what it leaves the player.
 *  - Sharp: alpha-beta search, deeper each round until its time runs out. Near the end
 *    of the game it reaches the last move, so it plays the end exactly.
 * Hints use Sharp for the player's side.
 */
import type { Cells, Side } from './rules.ts';
import { flipsAt, isLegal, legalMoves, other } from './rules.ts';

export type BotId = 'sleepy' | 'steady' | 'sharp';
export const BOT_IDS: BotId[] = ['sleepy', 'steady', 'sharp'];

export const BOTS = {
	sleepy: {
		/** Chance it takes the move that flips the most. */
		greedy: 0.25,
		/** Extra weight per flipped pebble when it picks at random. */
		flipPull: 0.35,
	},
	steady: {
		flip: 2,
		/** Cost per move it leaves the player. */
		mobility: 3,
		/** Random noise, so it does not play the same game twice. */
		noise: 4,
	},
	sharp: {
		/** Thinking time per board size, in ms. */
		time: { 6: 300, 8: 450, 10: 600 } as Record<number, number>,
		mobility: 6,
	},
};

/**
 * What each square is worth. Corners are best. The squares next to an empty corner
 * are bad (they give the corner away); once the corner is taken they are fine.
 */
export function squareValues(cells: Cells, n: number): number[] {
	const w = new Array<number>(n * n);
	const last = n - 1;
	for (let r = 0; r < n; r++) {
		for (let c = 0; c < n; c++) {
			const edgeR = r === 0 || r === last;
			const edgeC = c === 0 || c === last;
			let v = 1;
			if (edgeR && edgeC) v = 100;
			else if (edgeR || edgeC) v = 10;
			else if (r === 1 || r === last - 1 || c === 1 || c === last - 1) v = -3;
			w[r * n + c] = v;
		}
	}
	for (const [cr, cc] of [
		[0, 0],
		[0, last],
		[last, 0],
		[last, last],
	]) {
		const empty = cells[cr * n + cc] === 0;
		const dr = cr === 0 ? 1 : -1;
		const dc = cc === 0 ? 1 : -1;
		w[(cr + dr) * n + (cc + dc)] = empty ? -30 : 6; // X square
		w[cr * n + (cc + dc)] = empty ? -12 : 10; // C squares
		w[(cr + dr) * n + cc] = empty ? -12 : 10;
	}
	return w;
}

export function pickMove(cells: Cells, n: number, side: Side, bot: BotId): number {
	const moves = legalMoves(cells, n, side);
	if (moves.length <= 1) return moves[0] ?? -1;
	if (bot === 'sleepy') return sleepy(cells, n, side, moves);
	if (bot === 'steady') return steady(cells, n, side, moves);
	return sharp(cells, n, side, moves);
}

function sleepy(cells: Cells, n: number, side: Side, moves: number[]): number {
	const flips = moves.map((m) => flipsAt(cells, n, m, side).flips.length);
	if (Math.random() < BOTS.sleepy.greedy) return moves[flips.indexOf(Math.max(...flips))];
	const weights = flips.map((f) => 1 + f * BOTS.sleepy.flipPull);
	let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
	for (let k = 0; k < moves.length; k++) {
		roll -= weights[k];
		if (roll <= 0) return moves[k];
	}
	return moves[moves.length - 1];
}

function steady(cells: Cells, n: number, side: Side, moves: number[]): number {
	const w = squareValues(cells, n);
	const cfg = BOTS.steady;
	let best = moves[0];
	let bestScore = -Infinity;
	for (const m of moves) {
		const f = flipsAt(cells, n, m, side);
		const next = Array.from(cells);
		next[m] = side;
		for (const j of f.flips) next[j] = side;
		const left = legalMoves(next, n, other(side)).length;
		const score = w[m] + f.flips.length * cfg.flip - left * cfg.mobility + Math.random() * cfg.noise;
		if (score > bestScore) {
			bestScore = score;
			best = m;
		}
	}
	return best;
}

// ---------------------------------------------------------------- Sharp

class OutOfTime extends Error {}

const WIN = 100000;

/** Search state: the board is changed in place and put back after each move. */
class Search {
	nodes = 0;
	cells: Int8Array;
	n: number;
	deadline: number;
	constructor(cells: Cells, n: number, deadline: number) {
		this.cells = Int8Array.from(cells as ArrayLike<number>);
		this.n = n;
		this.deadline = deadline;
	}

	moves(side: Side): number[] {
		const out: number[] = [];
		const { cells, n } = this;
		for (let i = 0; i < n * n; i++) if (isLegal(cells, n, i, side)) out.push(i);
		return out;
	}

	apply(i: number, side: Side): number[] {
		const { flips } = flipsAt(this.cells, this.n, i, side);
		this.cells[i] = side;
		for (const j of flips) this.cells[j] = side;
		return flips;
	}

	undo(i: number, flips: number[], side: Side) {
		this.cells[i] = 0;
		const them = other(side);
		for (const j of flips) this.cells[j] = them;
	}

	/** The final score: pebble count difference, far above any guess. */
	final(side: Side): number {
		let d = 0;
		for (let i = 0; i < this.cells.length; i++) d += this.cells[i] === side ? 1 : this.cells[i] === 0 ? 0 : -1;
		return d > 0 ? WIN + d * 100 : d < 0 ? -WIN + d * 100 : 0;
	}

	guess(side: Side): number {
		const w = squareValues(this.cells, this.n);
		let pos = 0;
		for (let i = 0; i < this.cells.length; i++) {
			if (this.cells[i] === side) pos += w[i];
			else if (this.cells[i] !== 0) pos -= w[i];
		}
		const mine = this.moves(side).length;
		const theirs = this.moves(other(side)).length;
		return pos + (mine - theirs) * BOTS.sharp.mobility;
	}

	negamax(side: Side, depth: number, alpha: number, beta: number, passed: boolean): number {
		if ((++this.nodes & 1023) === 0 && performance.now() > this.deadline) throw new OutOfTime();
		const moves = this.moves(side);
		if (!moves.length) {
			if (passed) return this.final(side);
			return -this.negamax(other(side), depth, -beta, -alpha, true);
		}
		if (depth === 0) return this.guess(side);
		const w = squareValues(this.cells, this.n);
		moves.sort((a, b) => w[b] - w[a]);
		let best = -Infinity;
		for (const m of moves) {
			const flips = this.apply(m, side);
			const score = -this.negamax(other(side), depth - 1, -beta, -alpha, false);
			this.undo(m, flips, side);
			if (score > best) best = score;
			if (best > alpha) alpha = best;
			if (alpha >= beta) break;
		}
		return best;
	}
}

function sharp(cells: Cells, n: number, side: Side, moves: number[]): number {
	const time = BOTS.sharp.time[n] ?? 450;
	const s = new Search(cells, n, performance.now() + time);
	let empties = 0;
	for (let i = 0; i < n * n; i++) if (cells[i] === 0) empties++;
	const w = squareValues(cells, n);
	let order = [...moves].sort((a, b) => w[b] - w[a]);
	let best = order[0];
	try {
		for (let depth = 1; depth <= empties; depth++) {
			let alpha = -Infinity;
			let roundBest = order[0];
			const scores = new Map<number, number>();
			for (const m of order) {
				const flips = s.apply(m, side);
				const score = -s.negamax(other(side), depth - 1, -Infinity, -alpha, false);
				s.undo(m, flips, side);
				scores.set(m, score);
				if (score > alpha) {
					alpha = score;
					roundBest = m;
				}
			}
			best = roundBest;
			// Search the best moves first next round: it cuts more.
			order = [...order].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
			if (alpha >= WIN) break; // A sure win: no need to look further.
		}
	} catch (e) {
		if (!(e instanceof OutOfTime)) throw e;
	}
	return best;
}
