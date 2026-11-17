// Game rules. No DOM here, so the rules also run in Node (see tools/sim.js).

import { SHAPES, pickShape } from './shape-list.js';
import { REROLL_COST, REROLL_STEP } from './prices.js';

export const GRID_SIZES = {
	small: { cols: 6, rows: 8 },
	medium: { cols: 7, rows: 9 },
	large: { cols: 8, rows: 10 },
};

export const DEFAULT_LAB = {
	grid: 'medium',
	pieces: 2,
};

// A turn earns one power-up when it makes a chain of REWARD_CHAIN steps or clears a linked
// group of REWARD_GROUP blocks. Which power-up comes from a shuffled deck, so the same one
// never shows up twice in a row. Earned power-ups wait in a bag until the player uses them.
export const POWER_KINDS = ['prism', 'blast', 'remix'];
export const REWARD_CHAIN = 3;
export const REWARD_GROUP = 6;
export const BAG_SIZE = 3;

// Group size multiplier: 3 and 4 blocks pay x1, then 5 pays x2, 6 pays x3, and so on.
const GROUP_MULT_FROM = 5;
const GROUP_MULT_MAX = 6;

/** Score multiplier for one cleared group of this size. */
export function groupMultiplier(size) {
	if (size < GROUP_MULT_FROM) return 1;
	return Math.min(GROUP_MULT_MAX, size - GROUP_MULT_FROM + 2);
}

// Glints are the meta currency. Combos earn them, and they are kept between games.
// A step earns (chain step - 1) + (group multiplier - 1), and a full clear earns a bonus.
export const GLINT_ALL_CLEAR = 10;
export const SECOND_WIND_ROWS = 4; // rows cleared from the bottom of the stack when you buy a second wind

/** A number from a date text such as "2026-11-07", so everyone gets the same daily game. */
export function dailySeed(text) {
	let h = 2166136261;
	for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return h >>> 0;
}

/** Glints earned by one clear step. */
export function glintsFor(chain, mult) {
	return chain - 1 + (mult - 1);
}

/** Glints earned by one clear step that empties the well. */
export function glintsForAllClear(chain, mult) {
	return glintsFor(chain, mult) + GLINT_ALL_CLEAR;
}

export const TIMED_SECONDS = 90;
export const LOW_TIME_SECONDS = 10; // the clock turns red and starts to tick
export const LOUD_TICK_SECONDS = 5; // the tick gets louder
export const MAX_COLORS = 5;
const COLOR_RAMP_TURN = 20;

const POINTS_PER_BLOCK = 10;
const ALL_CLEAR_BONUS = 1000;
const MIN_GROUP = 3;
const ALL_CLEAR_MIN = 8; // the board needs this many blocks before a full clear pays the bonus
const BLAST_RADIUS = 1;
const DANGER_ROWS = 3; // a column with fewer than this many free rows is in danger

/** Small seeded random source (mulberry32). */
export function makeRng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function sizeOf(cells) {
	let w = 0;
	let h = 0;
	for (const c of cells) {
		w = Math.max(w, c.dx + 1);
		h = Math.max(h, c.dy + 1);
	}
	return { w, h };
}

/** How many colors are in play after a number of turns. */
export function colorsForTurn(mode, turn) {
	if (mode === 'timed') return 4;
	return turn < COLOR_RAMP_TURN ? 4 : MAX_COLORS;
}

/** Points for one chain step. Each group pays by its own size. Blast-only blocks pay the base rate. */
function pointsForStep(groups, clearedCount, chain) {
	let points = 0;
	let inGroups = 0;
	let biggest = 0;
	for (const g of groups) {
		points += g.cells.size * POINTS_PER_BLOCK * chain * groupMultiplier(g.cells.size);
		inGroups += g.cells.size;
		biggest = Math.max(biggest, g.cells.size);
	}
	points += (clearedCount - inGroups) * POINTS_PER_BLOCK * chain;
	return { points, biggest };
}

export class Game {
	/**
	 * @param {{ mode?: 'endless'|'timed', lab?: typeof DEFAULT_LAB, seed: number, bagSize?: number, banned?: number|null }} options
	 */
	constructor({ mode = 'endless', lab = DEFAULT_LAB, seed, bagSize = BAG_SIZE, banned = null } = {}) {
		this.bagSize = bagSize;
		this.banned = banned; // the index of a shape that never shows up this game, or null
		this.rerolls = 0;
		this.extensionUsed = false;
		this.mode = mode;
		this.lab = { ...DEFAULT_LAB, ...lab };
		const size = GRID_SIZES[this.lab.grid] || GRID_SIZES.medium;
		this.cols = size.cols;
		this.rows = size.rows;
		this.rng = makeRng(seed); // pieces only, so a daily seed deals the same pieces in the same order
		this.rngMisc = makeRng((seed ^ 0x9e3779b9) >>> 0); // power-up deck, Remix and bot noise
		this.grid = new Array(this.cols * this.rows).fill(null);
		this.nextId = 1;
		this.tick = 0;
		this.turn = 0;
		this.score = 0;
		this.pendingBlast = null;
		this.bag = [];
		this.deck = [];
		this.lastPower = null;
		this.glints = 0; // earned this run, warm-up included (the game keeps the wallet)
		this.secondWindUsed = false;
		this.stats = { cleared: 0, bestChain: 0, earned: 0, used: 0, turns: 0 };
		this.pieces = [];
		for (let i = 0; i < this.lab.pieces; i++) this.pieces.push(this.makePiece());
	}

	get colors() {
		return colorsForTurn(this.mode, this.turn);
	}

	index(x, y) {
		return y * this.cols + x;
	}

	/** The column of a cell index. */
	columnOf(index) {
		return index % this.cols;
	}

	/** The row of a cell index. */
	rowOf(index) {
		return Math.floor(index / this.cols);
	}

	get(x, y) {
		return this.grid[this.index(x, y)];
	}

	height(x) {
		let h = 0;
		for (let y = 0; y < this.rows; y++) if (this.get(x, y)) h++;
		return h;
	}

	/** How many rows past the danger line this column is stacked. 0 when it is safe. */
	dangerOf(x) {
		return Math.max(0, this.height(x) - (this.rows - DANGER_ROWS));
	}

	makeBlock(color) {
		return { id: this.nextId++, color, kind: 'plain', stamp: this.tick };
	}

	randomColor() {
		return Math.floor(this.rng() * this.colors);
	}

	makePiece() {
		const pick = pickShape(this.rng(), this.banned);
		const shape = SHAPES[pick];
		let colors;
		do {
			colors = shape.map(() => this.randomColor());
		} while (colors.every((c) => c === colors[0]));
		const cells = shape.map(([dx, dy], i) => ({ dx, dy, color: colors[i] }));
		return { id: this.nextId++, cells, ...sizeOf(cells) };
	}

	/** The cells that touch a cell side to side. Diagonals do not count. */
	neighborsOf(index) {
		const x = this.columnOf(index);
		const y = this.rowOf(index);
		const out = [];
		if (x > 0) out.push(index - 1);
		if (x < this.cols - 1) out.push(index + 1);
		if (y > 0) out.push(index - this.cols);
		if (y < this.rows - 1) out.push(index + this.cols);
		return out;
	}

	/** Size of the group a block of this color would join at (x, y). Sides only, never diagonals. */
	linkedSize(colorAt, { x, y }, color) {
		const start = this.index(x, y);
		const seen = new Set([start]);
		const stack = [start];
		while (stack.length) {
			const i = stack.pop();
			for (const n of this.neighborsOf(i)) {
				if (seen.has(n) || colorAt(n) !== color) continue;
				seen.add(n);
				stack.push(n);
			}
		}
		return seen.size;
	}

	/** Cells of a piece, grouped by column, top cell first (it lands against the ceiling first). */
	columnsOf(piece) {
		const cols = new Map();
		for (const cell of piece.cells) {
			if (!cols.has(cell.dx)) cols.set(cell.dx, []);
			cols.get(cell.dx).push(cell);
		}
		for (const list of cols.values()) list.sort((a, b) => a.dy - b.dy);
		return cols;
	}

	/** The piece moves as one rigid shape, so it fits only if every block of the whole shape has room. */
	fits(piece, x) {
		if (!piece || x < 0 || x + piece.w > this.cols) return false;
		return this.landing(piece, x).every((l) => l.y < this.rows && !this.get(l.x, l.y));
	}

	/** True if the piece fits in some column. */
	canPlace(piece) {
		for (let x = 0; x <= this.cols - piece.w; x++) if (this.fits(piece, x)) return true;
		return false;
	}

	hasMove() {
		return this.pieces.some((p) => p && this.canPlace(p));
	}

	/**
	 * Where each cell of the piece comes to rest if dropped at column x. The piece rises as one rigid
	 * shape until its first block in some column touches that column's stack (or the ceiling).
	 * Blocks that rest with a gap above them rise to close it when the board settles.
	 */
	landing(piece, x) {
		const cols = this.columnsOf(piece);
		let top = 0;
		for (const [dx, list] of cols) top = Math.max(top, this.height(x + dx) - list[0].dy);
		const out = [];
		for (const [dx, list] of cols) for (const cell of list) out.push({ cell, x: x + dx, y: top + cell.dy });
		return out;
	}

	/** Puts a piece on the board and settles it at once. Returns the new blocks with their cells. */
	place(slot, x, piece = this.pieces[slot]) {
		const placed = this.placeRigid(slot, x, piece);
		if (placed) this.settle();
		return placed;
	}

	/**
	 * Puts a piece on the board in its rigid shape. Returns the new blocks with their cells.
	 * Blocks with a gap above them stay put. The caller shows the rigid landing, then calls settle().
	 */
	placeRigid(slot, x, piece = this.pieces[slot]) {
		if (!this.fits(piece, x)) return null;
		this.tick++;
		const placed = this.landing(piece, x).map(({ cell, x: bx, y }) => {
			const block = this.makeBlock(cell.color);
			this.grid[this.index(bx, y)] = block;
			return { block, x: bx, y, dx: cell.dx, dy: cell.dy };
		});
		this.pieces[slot] = null;
		this.turn++;
		this.stats.turns++;
		return placed;
	}

	/** Lifts every block with a gap above it up to the ceiling or the block above. Returns the moves. */
	settle() {
		this.tick++;
		return this.applyGravity();
	}

	refill(slot) {
		this.pieces[slot] = this.makePiece();
	}

	/** What the next reroll costs. */
	get rerollCost() {
		return REROLL_COST + REROLL_STEP * this.rerolls;
	}

	/** Swaps every piece in the tray for a new one. The caller takes the Glints. */
	reroll() {
		this.rerolls++;
		this.pieces = this.pieces.map((p) => (p ? this.makePiece() : p));
	}

	/** Finds groups of 3 or more blocks of one color that touch side to side. */
	findGroups() {
		const { grid } = this;
		const seen = new Uint8Array(grid.length);
		const groups = [];
		for (let start = 0; start < grid.length; start++) {
			const first = grid[start];
			if (!first || seen[start]) continue;
			const cells = new Set([start]);
			const stack = [start];
			seen[start] = 1;
			while (stack.length) {
				const i = stack.pop();
				for (const n of this.neighborsOf(i)) {
					if (seen[n] || !grid[n] || grid[n].color !== first.color) continue;
					seen[n] = 1;
					cells.add(n);
					stack.push(n);
				}
			}
			if (cells.size >= MIN_GROUP) groups.push({ cells, color: first.color });
		}
		return groups;
	}

	/**
	 * Runs one step of the chain: clear matches (and a pending blast), then let blocks rise.
	 * Returns null when the board is still.
	 */
	resolveStep(chain) {
		const blast = this.pendingBlast;
		this.pendingBlast = null;
		const groups = this.findGroups();
		if (!groups.length && !blast) return null;

		this.tick++;
		const before = this.grid.filter(Boolean).length;
		const cleared = this.clearCells(groups, blast);
		const { points: stepPoints, biggest } = pointsForStep(groups, cleared.length, chain);
		let points = stepPoints;
		const falls = this.applyGravity();
		const allClear = before >= ALL_CLEAR_MIN && this.grid.every((b) => !b);
		if (allClear) points += ALL_CLEAR_BONUS;

		const mult = groupMultiplier(biggest);
		const glints = allClear ? glintsForAllClear(chain, mult) : glintsFor(chain, mult);
		this.glints += glints;
		this.score += points;
		this.stats.cleared += cleared.length;
		this.stats.bestChain = Math.max(this.stats.bestChain, chain);
		return { chain, groups, cleared, blast, falls, points, allClear, biggest, mult, glints };
	}

	/** Empties the cells of the groups and of a blast. Returns the cleared cells. */
	clearCells(groups, blast) {
		const clear = new Set();
		for (const g of groups) for (const c of g.cells) clear.add(c);
		if (blast) for (const c of blast.cells) clear.add(c);

		const cleared = [...clear].map((idx) => ({
			idx,
			x: this.columnOf(idx),
			y: this.rowOf(idx),
			block: this.grid[idx],
		}));
		for (const idx of clear) this.grid[idx] = null;
		return cleared;
	}

	/** Lifts every block to the free cell nearest the ceiling in its column. */
	applyGravity() {
		const falls = [];
		for (let x = 0; x < this.cols; x++) {
			let write = 0;
			for (let y = 0; y < this.rows; y++) {
				const b = this.get(x, y);
				if (!b) continue;
				if (write !== y) {
					this.grid[this.index(x, write)] = b;
					this.grid[this.index(x, y)] = null;
					b.stamp = this.tick;
					falls.push({ block: b, x, fromY: y, toY: write });
				}
				write++;
			}
		}
		return falls;
	}

	// ---- power-ups ----

	/** True when a chain this long, or a group this big, earns a power-up. */
	earnsReward(chainLength, biggestGroup = 0) {
		return chainLength >= REWARD_CHAIN || biggestGroup >= REWARD_GROUP;
	}

	/** Next power-up from the shuffled deck. A new deck never starts with the last one drawn. */
	drawPower() {
		if (!this.deck.length) {
			const deck = POWER_KINDS.slice();
			do {
				for (let k = deck.length - 1; k > 0; k--) {
					const j = Math.floor(this.rngMisc() * (k + 1));
					[deck[k], deck[j]] = [deck[j], deck[k]];
				}
			} while (deck[deck.length - 1] === this.lastPower && deck.length > 1);
			this.deck = deck;
		}
		this.lastPower = this.deck.pop();
		return this.lastPower;
	}

	/**
	 * Puts the reward for a finished turn in the bag. Returns { kind, lost } or null.
	 * A full bag loses the reward (kind is null) and the deck keeps its card.
	 */
	awardChain(chainLength, biggestGroup = 0) {
		if (!this.earnsReward(chainLength, biggestGroup)) return null;
		if (this.bag.length >= this.bagSize) return { kind: null, lost: true };
		const kind = this.drawPower();
		this.bag.push(kind);
		this.stats.earned++;
		return { kind, lost: false };
	}

	take(kind) {
		const at = this.bag.indexOf(kind);
		if (at < 0) return false;
		this.bag.splice(at, 1);
		this.stats.used++;
		return true;
	}

	/** Occupied cells in the square around (x, y). */
	blastArea(x, y) {
		const out = [];
		for (let by = y - BLAST_RADIUS; by <= y + BLAST_RADIUS; by++) {
			for (let bx = x - BLAST_RADIUS; bx <= x + BLAST_RADIUS; bx++) {
				if (bx < 0 || by < 0 || bx >= this.cols || by >= this.rows) continue;
				if (this.get(bx, by)) out.push(this.index(bx, by));
			}
		}
		return out;
	}

	/** Arms a blast. The next resolveStep clears it. */
	useBlast(x, y) {
		const cells = this.blastArea(x, y);
		if (!cells.length || !this.take('blast')) return false;
		this.pendingBlast = { x, y, cells };
		return true;
	}

	/** Paints every cell of a tray piece one color. */
	usePrism(slot, color) {
		const piece = this.pieces[slot];
		if (!piece || !this.take('prism')) return false;
		this.pieces[slot] = { ...piece, id: this.nextId++, cells: piece.cells.map((c) => ({ ...c, color })) };
		return true;
	}

	/**
	 * Shuffles the blocks on the board. The same cells stay filled and every block keeps its color,
	 * but the blocks swap places. It tries not to leave a match, but a few can remain on a crowded board.
	 * Returns the moves [{ block, from, to }] (cell indexes), or null when nothing was used.
	 */
	useRemix() {
		const cells = [];
		this.grid.forEach((b, i) => b && cells.push(i));
		if (!cells.length || !this.take('remix')) return null;
		return this.swapBlocks(cells, this.planRemixColors(cells));
	}

	/** Plans a color for every filled cell, with the same count of each color. Tries to leave no match. */
	planRemixColors(cells) {
		const counts = new Array(MAX_COLORS).fill(0);
		for (const i of cells) counts[this.grid[i].color]++;

		let best = null;
		for (let attempt = 0; attempt < 25 && (!best || best.bad > 0); attempt++) {
			const left = counts.slice();
			const assigned = new Array(this.grid.length).fill(null);
			let bad = 0;
			for (const i of cells) {
				const x = this.columnOf(i);
				const y = this.rowOf(i);
				const options = left.flatMap((n, c) => (n > 0 ? [c] : []));
				for (let k = options.length - 1; k > 0; k--) {
					const j = Math.floor(this.rngMisc() * (k + 1));
					[options[k], options[j]] = [options[j], options[k]];
				}
				let pick = options.find((c) => this.linkedSize((n) => assigned[n], { x, y }, c) < MIN_GROUP);
				if (pick === undefined) {
					pick = options[0];
					bad++;
				}
				assigned[i] = pick;
				left[pick]--;
			}
			if (!best || bad < best.bad) best = { assigned, bad };
		}
		return best.assigned;
	}

	/** Hands each cell a block of the color planned for it, preferring one from another cell. Returns the moves. */
	swapBlocks(cells, plannedColors) {
		const pool = new Map();
		for (const i of cells) {
			const b = this.grid[i];
			if (!pool.has(b.color)) pool.set(b.color, []);
			pool.get(b.color).push({ block: b, from: i });
		}
		this.tick++;
		const next = new Array(this.grid.length).fill(null);
		const moves = [];
		for (const to of cells) {
			const list = pool.get(plannedColors[to]);
			const away = list.filter((m) => m.from !== to);
			const options = away.length ? away : list;
			const pick = options[Math.floor(this.rngMisc() * options.length)];
			list.splice(list.indexOf(pick), 1);
			next[to] = pick.block;
			pick.block.stamp = this.tick;
			moves.push({ block: pick.block, from: pick.from, to });
		}
		this.grid = next;
		return moves;
	}

	/** True when the player may still buy the second wind this run (once per run, and there must be blocks). */
	get canSecondWind() {
		return !this.secondWindUsed && this.grid.some(Boolean);
	}

	/**
	 * The second wind: clears the bottom SECOND_WIND_ROWS rows of the stack (the rows farthest from the
	 * ceiling) to make room. Returns the cleared cells, or null when it cannot be used.
	 */
	useSecondWind() {
		if (!this.canSecondWind) return null;
		let low = 0;
		this.grid.forEach((b, i) => b && (low = Math.max(low, this.rowOf(i))));
		const cleared = [];
		this.grid.forEach((block, idx) => {
			const y = this.rowOf(idx);
			if (block && y > low - SECOND_WIND_ROWS) cleared.push({ idx, x: this.columnOf(idx), y, block });
		});
		for (const c of cleared) this.grid[c.idx] = null;
		this.secondWindUsed = true;
		this.tick++;
		return cleared;
	}

	/** True when no piece fits and no blast is left to make room. */
	get stuck() {
		return !this.hasMove() && !this.bag.includes('blast');
	}

	/** Runs every chain step at once. Used by the bot and by previews. */
	resolveAll() {
		const steps = [];
		for (let chain = 1; ; chain++) {
			const step = this.resolveStep(chain);
			if (!step) break;
			steps.push(step);
		}
		return steps;
	}

	clone() {
		const g = Object.create(Game.prototype);
		Object.assign(g, this);
		g.grid = this.grid.map((b) => (b ? { ...b } : null));
		g.pieces = this.pieces.slice();
		g.bag = this.bag.slice();
		g.deck = this.deck.slice();
		g.stats = { ...this.stats };
		g.rng = () => 0.5;
		g.rngMisc = () => 0.5;
		return g;
	}
}
