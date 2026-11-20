// The Game: the state of one game of Kerplunk, and the moves a player can make.
// No DOM here, so the rules also run in Node (see tools/sim.js and the tests in tools/).
//
// The well is a grid of cells, stored as one flat list: index = row * cols + column.
// Row 0 is the ceiling. Pieces rise from the tray at the bottom and stick to the ceiling.
// The bigger rules live in their own files. The methods here call them, so the game has one
// place to look for every move: board.js, pieces.js, scoring.js, power-ups.js, second-wind.js.

import { SHAPES, pickShape } from './shapes/shape-list.js';
import { REROLL_COST, REROLL_STEP } from '../shop/prices.js';
import { GRID_SIZES, DEFAULT_LAB, colorsForTurn } from './game-settings.js';
import { makeRng } from './random.js';
import { neighborsOf, floodFill, findGroups, liftLooseBlocks } from './board.js';
import { pieceSize, cellsByColumn, restingCells } from './pieces.js';
import { pointsForStep, groupMultiplier, glintsFor, glintsForAllClear, isAllClear, allClearBonus } from './scoring.js';
import { BAG_SIZE } from './power-ups.js';
import * as powerUps from './power-ups.js';
import * as secondWind from './second-wind.js';

const DANGER_ROWS = 3; // a column with fewer than this many free rows is in danger
const MISC_SEED_MIX = 0x9e3779b9; // makes a second seed from the first one

export class Game {
	/**
	 * @param {{ mode?: 'endless'|'timed', lab?: typeof DEFAULT_LAB, seed: number, bagSize?: number, banned?: number|null }} options
	 */
	constructor({ mode = 'endless', lab = DEFAULT_LAB, seed, bagSize = BAG_SIZE, banned = null } = {}) {
		this.mode = mode;
		this.lab = { ...DEFAULT_LAB, ...lab };
		const size = GRID_SIZES[this.lab.grid] || GRID_SIZES.medium;
		this.cols = size.cols;
		this.rows = size.rows;
		this.grid = new Array(this.cols * this.rows).fill(null);

		// Two random sources. `rng` deals only the pieces, so a daily seed deals the same pieces in the
		// same order. `rngMisc` is for the power-up deck, the Remix and the bot.
		this.rng = makeRng(seed);
		this.rngMisc = makeRng((seed ^ MISC_SEED_MIX) >>> 0);

		this.nextId = 1; // every block and piece gets its own id
		this.tick = 0; // counts the changes to the board; a block's stamp is the tick it last moved
		this.turn = 0;
		this.score = 0;
		this.glints = 0; // earned this run, warm-up included (the page keeps the wallet)
		this.stats = { cleared: 0, bestChain: 0, earned: 0, used: 0, turns: 0 };

		this.bagSize = bagSize;
		this.bag = []; // power-ups waiting to be used
		this.deck = []; // the shuffled power-ups still to draw
		this.lastPower = null;
		this.pendingBlast = null; // a Blast that the next resolveStep clears

		this.banned = banned; // the index of a shape that never shows up this game, or null
		this.rerolls = 0;
		this.extensionUsed = false; // the extra time bought in Timed
		this.secondWindUsed = false;

		this.pieces = [];
		for (let slot = 0; slot < this.lab.pieces; slot++) this.pieces.push(this.makePiece());
	}

	/** How many colors are in play now. */
	get colors() {
		return colorsForTurn(this.mode, this.turn);
	}

	// ---- cells ----

	/** The cell index of column x, row y. */
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

	/** The block at column x, row y, or null. */
	get(x, y) {
		return this.grid[this.index(x, y)];
	}

	/** How many blocks are in column x. Blocks always stack from the ceiling, with no gaps. */
	height(x) {
		let count = 0;
		for (let y = 0; y < this.rows; y++) if (this.get(x, y)) count++;
		return count;
	}

	/** How many rows past the danger line this column is stacked. 0 when it is safe. */
	dangerOf(x) {
		return Math.max(0, this.height(x) - (this.rows - DANGER_ROWS));
	}

	/** The cells that touch a cell side to side. Diagonals do not count. */
	neighborsOf(index) {
		return neighborsOf(this, index);
	}

	/** The size of the group a block of this color would join at (x, y). colorAt(index) gives the color of a cell. */
	linkedSize(colorAt, { x, y }, color) {
		return floodFill(this, this.index(x, y), (index) => colorAt(index) === color).size;
	}

	blockCount() {
		return this.grid.filter(Boolean).length;
	}

	// ---- blocks and pieces ----

	makeBlock(color) {
		return { id: this.nextId++, color, kind: 'plain', stamp: this.tick };
	}

	randomColor() {
		return Math.floor(this.rng() * this.colors);
	}

	/** A new piece: a random shape with random colors. A piece is never all one color. */
	makePiece() {
		const shape = SHAPES[pickShape(this.rng(), this.banned)];
		const colors = this.mixedColors(shape.length);
		const cells = shape.map(([dx, dy], i) => ({ dx, dy, color: colors[i] }));
		return { id: this.nextId++, cells, ...pieceSize(cells) };
	}

	mixedColors(count) {
		let colors;
		do {
			colors = Array.from({ length: count }, () => this.randomColor());
		} while (colors.every((color) => color === colors[0]));
		return colors;
	}

	/** Cells of a piece, grouped by column, top cell first. */
	columnsOf(piece) {
		return cellsByColumn(piece);
	}

	// ---- placing a piece ----

	/** The piece moves as one rigid shape, so it fits only if every block of the whole shape has room. */
	fits(piece, x) {
		if (!piece || x < 0 || x + piece.w > this.cols) return false;
		return this.landing(piece, x).every((rest) => rest.y < this.rows && !this.get(rest.x, rest.y));
	}

	/** True if the piece fits in some column. */
	canPlace(piece) {
		for (let x = 0; x <= this.cols - piece.w; x++) if (this.fits(piece, x)) return true;
		return false;
	}

	/** True if some piece in the tray fits somewhere. */
	hasMove() {
		return this.pieces.some((piece) => piece && this.canPlace(piece));
	}

	/** Where each cell of the piece comes to rest if dropped at column x: [{ cell, x, y }]. */
	landing(piece, x) {
		return restingCells(this, piece, x);
	}

	/** Puts a piece on the board and settles it at once. Returns the new blocks with their cells. */
	place(slot, x, piece = this.pieces[slot]) {
		const placed = this.placeRigid(slot, x, piece);
		if (placed) this.settle();
		return placed;
	}

	/**
	 * Puts a piece on the board in its rigid shape. Returns the new blocks with their cells, or null.
	 * Blocks with a gap above them stay put. The caller shows the rigid landing, then calls settle().
	 */
	placeRigid(slot, x, piece = this.pieces[slot]) {
		if (!this.fits(piece, x)) return null;
		this.tick++;
		const placed = this.landing(piece, x).map(({ cell, x: blockX, y }) => {
			const block = this.makeBlock(cell.color);
			this.grid[this.index(blockX, y)] = block;
			return { block, x: blockX, y, dx: cell.dx, dy: cell.dy };
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

	/** Lifts every block to the free cell nearest the ceiling in its column. Returns the moves. */
	applyGravity() {
		return liftLooseBlocks(this);
	}

	// ---- the tray ----

	refill(slot) {
		this.pieces[slot] = this.makePiece();
	}

	/**
	 * A used slot stays empty while another slot has a piece. When every slot is used,
	 * every slot gets a new piece at the same time. Returns the slots that got a piece.
	 */
	refillTray() {
		if (this.pieces.some(Boolean)) return [];
		this.pieces = this.pieces.map(() => this.makePiece());
		return this.pieces.map((_, slot) => slot);
	}

	/** What the next reroll costs. Each reroll in a game costs REROLL_STEP more. */
	get rerollCost() {
		return REROLL_COST + REROLL_STEP * this.rerolls;
	}

	/** Swaps each piece in the tray for a new one. An empty slot stays empty. The caller takes the Plunks. */
	reroll() {
		this.rerolls++;
		this.pieces = this.pieces.map((piece) => (piece ? this.makePiece() : piece));
	}

	// ---- clearing ----

	/** Finds groups of 3 or more blocks of one color that touch side to side. */
	findGroups() {
		return findGroups(this);
	}

	/**
	 * Runs one step of the chain: clear the matches (and a pending blast), then let blocks rise.
	 * Returns what happened, or null when the board is still.
	 */
	resolveStep(chain) {
		const blast = this.pendingBlast;
		this.pendingBlast = null;
		const groups = this.findGroups();
		if (!groups.length && !blast) return null;

		this.tick++;
		const blocksBefore = this.blockCount();
		const cleared = this.clearCells(groups, blast);
		const { points: groupPoints, biggest } = pointsForStep(groups, cleared.length, chain);
		const falls = this.applyGravity();
		const allClear = isAllClear(blocksBefore, this.blockCount() === 0);
		const points = groupPoints + allClearBonus(allClear);
		const mult = groupMultiplier(biggest);
		const glints = allClear ? glintsForAllClear(chain, mult) : glintsFor(chain, mult);

		this.glints += glints;
		this.score += points;
		this.stats.cleared += cleared.length;
		this.stats.bestChain = Math.max(this.stats.bestChain, chain);
		return { chain, groups, cleared, blast, falls, points, allClear, biggest, mult, glints };
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

	/** Empties the cells of the groups and of a blast. Returns the cleared cells: [{ idx, x, y, block }]. */
	clearCells(groups, blast) {
		const toClear = new Set();
		for (const group of groups) for (const index of group.cells) toClear.add(index);
		if (blast) for (const index of blast.cells) toClear.add(index);

		const cleared = [...toClear].map((idx) => ({ idx, x: this.columnOf(idx), y: this.rowOf(idx), block: this.grid[idx] }));
		for (const idx of toClear) this.grid[idx] = null;
		return cleared;
	}

	// ---- power-ups (see power-ups.js) ----

	earnsReward(chainLength, biggestGroup = 0) {
		return powerUps.earnsReward(chainLength, biggestGroup);
	}

	drawPower() {
		return powerUps.drawPower(this);
	}

	awardChain(chainLength, biggestGroup = 0) {
		return powerUps.awardChain(this, chainLength, biggestGroup);
	}

	takeFromBag(kind) {
		return powerUps.takeFromBag(this, kind);
	}

	blastArea(x, y) {
		return powerUps.blastArea(this, x, y);
	}

	useBlast(x, y) {
		return powerUps.useBlast(this, x, y);
	}

	usePrism(slot, color) {
		return powerUps.usePrism(this, slot, color);
	}

	useRemix() {
		return powerUps.useRemix(this);
	}

	/** True when an earned power-up acts at once, with no tap. */
	get autoPowers() {
		return this.mode === 'timed';
	}

	clearedBy(piece, x) {
		return powerUps.clearedBy(this, piece, x);
	}

	bestPrismColor() {
		return powerUps.bestPrismColor(this);
	}

	autoPrism() {
		return powerUps.autoPrism(this);
	}

	bestBlastCell() {
		return powerUps.bestBlastCell(this);
	}

	autoUse(kind) {
		return powerUps.autoUse(this, kind);
	}

	// ---- the end of a game ----

	get canSecondWind() {
		return secondWind.canSecondWind(this);
	}

	useSecondWind() {
		return secondWind.useSecondWind(this);
	}

	/** True when no piece fits and no Blast is left to make room. */
	get stuck() {
		return !this.hasMove() && !this.bag.includes('blast');
	}

	/** A copy to try moves on. Its random sources always give 0.5, so trying a move never uses up real ones. */
	clone() {
		const copy = Object.create(Game.prototype);
		Object.assign(copy, this);
		copy.grid = this.grid.map((block) => (block ? { ...block } : null));
		copy.pieces = this.pieces.slice();
		copy.bag = this.bag.slice();
		copy.deck = this.deck.slice();
		copy.stats = { ...this.stats };
		copy.rng = () => 0.5;
		copy.rngMisc = () => 0.5;
		return copy;
	}
}
