// Game rules. No DOM here, so the rules also run in Node (see tools/sim.js).

export const GRID_SIZES = {
	small: { cols: 6, rows: 8 },
	medium: { cols: 7, rows: 9 },
	large: { cols: 8, rows: 10 },
};

export const DEFAULT_LAB = {
	grid: 'medium',
	pieces: 2,
};

// Power-ups come from the length of a chain in one turn (the highest tier reached).
// They go into a bag and the player uses them when they choose.
// Design asked for 5 / 8 / 10, but the sim (tools/sim.js) shows chains of 5+ almost never
// happen with linked matches, so the play-test build uses 3 / 5 / 7. Change the numbers here.
export const CHAIN_REWARDS = [
	{ chain: 7, kind: 'remix' }, // mixes the colors of every block on the board
	{ chain: 5, kind: 'blast' }, // clears a 3x3 area the player picks
	{ chain: 3, kind: 'prism' }, // paints one tray piece a single color
];
export const BAG_SIZE = 3;

export const TIMED_SECONDS = 90;
export const MAX_COLORS = 5;
const COLOR_RAMP_TURN = 20;

const POINTS_PER_BLOCK = 10;
const ALL_CLEAR_BONUS = 1000;
const MIN_GROUP = 3;
const ALL_CLEAR_MIN = 8; // the board needs this many blocks before a full clear pays the bonus
const BLAST_RADIUS = 1;

// Each shape is a list of [dx, dy]. Rotation makes the other forms.
const SHAPES = [
	[[0, 0], [1, 0], [2, 0]],
	[[0, 0], [0, 1], [0, 2]],
	[[0, 0], [1, 0], [0, 1]],
	[[0, 0], [1, 0], [1, 1]],
	[[1, 0], [0, 1], [1, 1]],
	[[0, 0], [0, 1], [1, 1]],
];

/** Small seeded random source (mulberry32). */
export function makeRng(seed = Date.now()) {
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

/** Turns a piece 90 degrees clockwise. Colors move with their cells. */
export function rotatePiece(piece) {
	const cells = piece.cells.map((c) => ({ dx: piece.h - 1 - c.dy, dy: c.dx, color: c.color }));
	return { ...piece, cells, ...sizeOf(cells) };
}

/** How many colors are in play after a number of turns. */
export function colorsForTurn(mode, turn) {
	if (mode === 'timed') return 4;
	return turn < COLOR_RAMP_TURN ? 4 : MAX_COLORS;
}

export class Game {
	/**
	 * @param {{ mode?: 'endless'|'timed', lab?: typeof DEFAULT_LAB, seed?: number }} options
	 */
	constructor({ mode = 'endless', lab = DEFAULT_LAB, seed = Date.now() } = {}) {
		this.mode = mode;
		this.lab = { ...DEFAULT_LAB, ...lab };
		const size = GRID_SIZES[this.lab.grid] || GRID_SIZES.medium;
		this.cols = size.cols;
		this.rows = size.rows;
		this.rng = makeRng(seed);
		this.grid = new Array(this.cols * this.rows).fill(null);
		this.nextId = 1;
		this.tick = 0;
		this.turn = 0;
		this.score = 0;
		this.pendingBlast = null;
		this.bag = [];
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

	get(x, y) {
		return this.grid[this.index(x, y)];
	}

	height(x) {
		let h = 0;
		for (let y = 0; y < this.rows; y++) if (this.get(x, y)) h++;
		return h;
	}

	makeBlock(color, kind = 'plain') {
		return { id: this.nextId++, color, kind, stamp: this.tick };
	}

	randomColor() {
		return Math.floor(this.rng() * this.colors);
	}

	makePiece() {
		const shape = SHAPES[Math.floor(this.rng() * SHAPES.length)];
		let colors;
		do {
			colors = shape.map(() => this.randomColor());
		} while (colors.every((c) => c === colors[0]));
		const cells = shape.map(([dx, dy], i) => ({ dx, dy, color: colors[i] }));
		return { id: this.nextId++, cells, ...sizeOf(cells) };
	}

	/** Size of the group a block of this color would join at (x, y). Sides only, never diagonals. */
	linkedSize(colorAt, x, y, color) {
		const start = this.index(x, y);
		const seen = new Set([start]);
		const stack = [start];
		while (stack.length) {
			const i = stack.pop();
			const cx = i % this.cols;
			const cy = (i - cx) / this.cols;
			for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
				if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
				const n = this.index(nx, ny);
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

	fits(piece, x) {
		if (!piece || x < 0 || x + piece.w > this.cols) return false;
		for (const [dx, list] of this.columnsOf(piece)) {
			if (list.length > this.rows - this.height(x + dx)) return false;
		}
		return true;
	}

	/** True if the piece fits somewhere in any rotation. */
	canPlaceAny(piece) {
		let p = piece;
		for (let r = 0; r < 4; r++) {
			for (let x = 0; x <= this.cols - p.w; x++) if (this.fits(p, x)) return true;
			p = rotatePiece(p);
		}
		return false;
	}

	hasMove() {
		return this.pieces.some((p) => p && this.canPlaceAny(p));
	}

	/** Where each cell of the piece lands if dropped at column x. */
	landing(piece, x) {
		const out = [];
		for (const [dx, list] of this.columnsOf(piece)) {
			const top = this.height(x + dx);
			list.forEach((cell, k) => out.push({ cell, x: x + dx, y: top + k }));
		}
		return out;
	}

	/** Puts a piece on the board. Returns the new blocks with their land cells. */
	place(slot, x, piece = this.pieces[slot]) {
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

	refill(slot) {
		this.pieces[slot] = this.makePiece();
	}

	/** Finds groups of 3 or more blocks of one color that touch side to side. */
	findGroups() {
		const { cols, rows, grid } = this;
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
				const x = i % cols;
				const y = (i - x) / cols;
				for (const n of [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, y > 0 ? i - cols : -1, y < rows - 1 ? i + cols : -1]) {
					if (n < 0 || seen[n] || !grid[n] || grid[n].color !== first.color) continue;
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
		const clear = new Set();
		for (const g of groups) for (const c of g.cells) clear.add(c);
		if (blast) for (const c of blast.cells) clear.add(c);

		const cleared = [...clear].map((idx) => ({
			idx,
			x: idx % this.cols,
			y: Math.floor(idx / this.cols),
			block: this.grid[idx],
		}));
		for (const idx of clear) this.grid[idx] = null;

		let points = cleared.length * POINTS_PER_BLOCK * chain;
		const falls = this.applyGravity();
		const allClear = before >= ALL_CLEAR_MIN && this.grid.every((b) => !b);
		if (allClear) points += ALL_CLEAR_BONUS;

		this.score += points;
		this.stats.cleared += cleared.length;
		this.stats.bestChain = Math.max(this.stats.bestChain, chain);
		return { chain, groups, cleared, blast, falls, points, allClear };
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

	/** The power-up a chain of this length earns, if any. */
	rewardFor(chainLength) {
		const tier = CHAIN_REWARDS.find((r) => chainLength >= r.chain);
		return tier ? tier.kind : null;
	}

	/** Puts the reward for a finished chain in the bag. Returns { kind, lost } or null. */
	awardChain(chainLength) {
		const kind = this.rewardFor(chainLength);
		if (!kind) return null;
		if (this.bag.length >= BAG_SIZE) return { kind, lost: true };
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
	 * Mixes the colors of the blocks on the board. Blocks stay where they are.
	 * It tries not to leave a match, but a few can remain on a crowded board.
	 * Returns the blocks that changed, or null when nothing was used.
	 */
	useRemix() {
		const cells = [];
		this.grid.forEach((b, i) => b && cells.push(i));
		if (!cells.length || !this.take('remix')) return null;
		const counts = new Array(MAX_COLORS).fill(0);
		for (const i of cells) counts[this.grid[i].color]++;

		let best = null;
		for (let attempt = 0; attempt < 25 && (!best || best.bad > 0); attempt++) {
			const left = counts.slice();
			const assigned = new Array(this.grid.length).fill(-1);
			let bad = 0;
			for (const i of cells) {
				const x = i % this.cols;
				const y = (i - x) / this.cols;
				const options = left.map((n, c) => (n > 0 ? c : -1)).filter((c) => c >= 0);
				for (let k = options.length - 1; k > 0; k--) {
					const j = Math.floor(this.rng() * (k + 1));
					[options[k], options[j]] = [options[j], options[k]];
				}
				let pick = options.find((c) => this.linkedSize((n) => assigned[n], x, y, c) < MIN_GROUP);
				if (pick === undefined) {
					pick = options[0];
					bad++;
				}
				assigned[i] = pick;
				left[pick]--;
			}
			if (!best || bad < best.bad) best = { assigned, bad };
		}
		this.tick++;
		const changed = [];
		for (const i of cells) {
			const b = this.grid[i];
			b.color = best.assigned[i];
			changed.push(b);
		}
		return changed;
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
		g.stats = { ...this.stats };
		g.rng = () => 0.5;
		return g;
	}
}
