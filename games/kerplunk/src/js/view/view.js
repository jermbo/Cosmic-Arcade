// The View draws the game on the canvas, and moves what it shows a little each frame.
// It never changes the rules: the Game says where every block is, and the view slides it there.
// Each frame the page calls update(dt) and then draw().
//
// The work is split into files: layout.js (where things go), block-motion.js (how blocks move),
// remix-show.js (the Remix), and draw-well.js, draw-tray.js and power-bar.js (the drawing).

import { buildSprites } from './sprites/block-sprites.js';
import { LIGHT } from '../looks/themes.js';
import { tuning } from '../feel/tuning.js';
import { Effects } from './effects.js';
import { computeLayout } from './layout.js';
import { newBlockVisual, updateBlocks, updateDying } from './block-motion.js';
import { startRemix, updateRemix } from './remix-show.js';
import { buildWellLayer, drawWell, drawBlocks, drawDying, drawGhost } from './draw-well.js';
import { drawTray, drawDragged, drawHint } from './draw-tray.js';
import { drawBar, drawAim, hitBar } from './power-bar.js';

export { POWER_NAMES } from './power-icons.js';

const motion = tuning.motion;
const MAX_PIXEL_RATIO = 2.5;
const RETURN_TIME = 0.18; // seconds for a piece to fly back to the tray
const CHIP_POP_SPEED = 3; // a new chip in the bar pops in 1/3 of a second
const DROP_ZONE_ROOM = 1.5; // cells beside the well where a dragged piece still counts as over it
const FINGER_ROOM = 1.1; // cells: on a touch screen the piece floats this far above the finger
const SLOT_TOUCH_ROOM = { above: 0.3, below: 0.4 }; // cells around a tray slot that still count as a tap on it

export class View {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.effects = new Effects();
		this.game = null;
		this.theme = LIGHT;
		this.style = 'patterns';
		this.sprites = null;
		this.cell = 40;
		this.time = 0; // seconds since the page opened, for pulses and blinks

		// What moves on the board.
		this.blockVisuals = new Map(); // block id → its visual (see block-motion.js)
		this.dying = []; // cleared blocks that still play their clear
		this.holdFalls = false; // true while a clear plays: blocks wait before they rise
		this.remix = null; // the Remix show while it plays (see remix-show.js)
		this.remixStyle = motion.remixStyle; // a key of REMIX_STYLES
		this.landedThisFrame = 0;

		// What the player is doing.
		this.drag = null; // the piece in the player's hand
		this.returning = null; // a piece flying back to the tray: { slot, x, y, t }
		this.keyCursor = null; // the keyboard selection: { slot, col }
		this.hint = false; // show the drag hint of a first game
		this.power = null; // the power-up being used: { kind, stage, color }
		this.aim = null; // where a Blast would land: { x, y }

		// Small animations.
		this.appear = []; // for each tray slot: 0 when a new piece just came, 1 when it has popped in
		this.chipPop = []; // the same for each chip in the bar
		this.lastBagSize = 0;
		this.previewCache = { key: '', cells: null, ghost: new Set() };

		// Hooks the page sets, for sound and buzzing.
		this.onLand = null; // (blocksThatLanded)
		this.onRemix = null; // (event, value, sound)
	}

	// ---- setup ----

	/** A new theme or block style: the block images and the well are drawn again. */
	setLooks(theme, style) {
		this.theme = theme;
		this.style = style;
		this.effects.theme = theme;
		this.sprites = null;
		if (this.w) this.layout();
	}

	/** The canvas changed size. */
	resize() {
		const rect = this.canvas.getBoundingClientRect();
		this.w = Math.max(1, rect.width);
		this.h = Math.max(1, rect.height);
		this.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
		this.canvas.width = Math.round(this.w * this.pixelRatio);
		this.canvas.height = Math.round(this.h * this.pixelRatio);
		this.layout();
	}

	/** Works out where everything goes, and draws the block images again if the cell size changed. */
	layout() {
		const { game } = this;
		Object.assign(
			this,
			computeLayout({
				width: this.w,
				height: this.h,
				cols: game ? game.cols : 7,
				rows: game ? game.rows : 9,
				slotCount: game ? game.pieces.length : 2,
				autoPowers: Boolean(game && game.autoPowers),
			}),
		);
		const px = Math.round(this.cell * this.pixelRatio);
		if (!this.sprites || this.sprites.px !== px) this.sprites = buildSprites(px, { style: this.style, theme: this.theme });
		this.wellLayer = buildWellLayer(this);
	}

	/** Shows a new game. Its blocks (from a warm-up) rise into the well one after another. */
	setGame(game) {
		this.game = game;
		this.blockVisuals.clear();
		this.dying = [];
		this.remix = null;
		this.drag = null;
		this.returning = null;
		this.keyCursor = null;
		this.appear = game.pieces.map(() => 0);
		this.effects.clear();
		this.power = null;
		this.aim = null;
		this.chipPop = [];
		this.lastBagSize = game.bag.length;
		this.layout();
		game.grid.forEach((block, index) => {
			if (!block) return;
			const x = game.columnOf(index);
			const y = game.rowOf(index);
			this.blockVisuals.set(block.id, newBlockVisual(x, y + game.rows + 1, 0.05 * x + 0.04 * y));
		});
	}

	// ---- what the page tells the view ----

	/** Starts the rise of newly placed blocks from where the piece was let go (left, top in cells). */
	dropIn(placed, left, top) {
		for (const { block, dx, dy, y } of placed) {
			const startY = Math.max(top + dy, y);
			this.blockVisuals.set(block.id, { ...newBlockVisual(left + dx, startY), vy: motion.dropSpeed, dropped: true });
		}
	}

	/** A slot got a new piece: it pops in. */
	pieceSpawned(slot) {
		this.appear[slot] = 0;
		this.previewCache.key = '';
	}

	/** Marks cleared blocks to flash and break apart. Each can wait a delay first. */
	killBlocks(cleared) {
		for (const { block, x, y, delay } of cleared) {
			const visual = this.blockVisuals.get(block.id);
			this.dying.push({ block, x, y: visual ? visual.y : y, t: 0, delay: delay || 0 });
			this.blockVisuals.delete(block.id);
		}
	}

	/** Plays the Remix show for these moves. view.remix is null again when it is over. */
	startRemix(moves, styleName = this.remixStyle) {
		startRemix(this, moves, styleName);
	}

	/** True when every block is in its cell and no clear is playing. */
	get settled() {
		if (this.dying.length) return false;
		const { game } = this;
		if (!game) return true;
		return game.grid.every((block, index) => {
			if (!block) return true;
			const visual = this.blockVisuals.get(block.id);
			if (!visual) return true;
			return visual.delay <= 0 && visual.y === game.rowOf(index) && Math.abs(visual.x - game.columnOf(index)) <= 0.01;
		});
	}

	// ---- where things are ----

	/** The center of cell (x, y) in pixels. */
	cellCenter(x, y) {
		return { x: this.boardX + (x + 0.5) * this.cell, y: this.boardY + (y + 0.5) * this.cell };
	}

	/** The board cell under a point, or null outside the well. */
	cellAt(px, py) {
		const x = Math.floor((px - this.boardX) / this.cell);
		const y = Math.floor((py - this.boardY) / this.cell);
		if (!this.game || x < 0 || y < 0 || x >= this.game.cols || y >= this.game.rows) return null;
		return { x, y };
	}

	/** The tray slot under a point, or null when there is none. */
	hitSlot(px, py) {
		if (!this.slots) return null;
		const above = this.cell * SLOT_TOUCH_ROOM.above;
		const below = this.cell * SLOT_TOUCH_ROOM.below;
		const index = this.slots.findIndex((slot) => px >= slot.x && px < slot.x + slot.w && py >= slot.y - above && py < slot.y + slot.h + below);
		return index < 0 ? null : index;
	}

	/** The bar button under a point, or null. */
	hitBar(px, py) {
		return hitBar(this, px, py);
	}

	/** Where a tray piece is drawn: its top left corner, and the size of its blocks. */
	slotPiecePos(slot, piece) {
		const box = this.slots[slot];
		const size = this.trayCell;
		return { x: box.x + box.w / 2 - (piece.w * size) / 2, y: box.y + box.h / 2 - (piece.h * size) / 2, size };
	}

	/**
	 * Where a dragged piece is, and which column it would drop into.
	 * Returns { left, top, col, over, valid }: over is true above the well, valid when it also fits.
	 */
	dragGeometry(piece, point, touch) {
		const { cell, game } = this;
		const pieceW = piece.w * cell;
		const pieceH = piece.h * cell;
		const left = point.x - pieceW / 2;
		// On a touch screen the piece floats above the finger, so the finger does not hide it.
		const top = touch ? point.y - cell * FINGER_ROOM - pieceH : point.y - pieceH / 2;
		const col = Math.max(0, Math.min(game.cols - piece.w, Math.round((left - this.boardX) / cell)));
		const besideRoom = cell * DROP_ZONE_ROOM;
		const overWell = point.x > this.boardX - besideRoom && point.x < this.boardX + this.boardW + besideRoom && top + pieceH < this.boardY + this.boardH + cell * 0.6;
		return { left, top, col, over: overWell, valid: overWell && game.fits(piece, col) };
	}

	// ---- each frame ----

	update(dt) {
		this.time += dt;
		this.effects.update(dt);
		this.appear = this.appear.map((shown) => Math.min(1, shown + dt / Math.max(0.01, motion.trayPop)));
		if (this.returning) {
			this.returning.t += dt / RETURN_TIME;
			if (this.returning.t >= 1) this.returning = null;
		}
		if (!this.game) return;
		updateBlocks(this, dt);
		updateRemix(this, dt);
		this.updateChips(dt);
		// The blocks of a dropped piece that hit the stack this frame: one thud for all of them.
		if (this.landedThisFrame && this.onLand) this.onLand(this.landedThisFrame);
		this.landedThisFrame = 0;
		updateDying(this, dt);
	}

	/** A power-up that just came into the bag pops in. */
	updateChips(dt) {
		const bagSize = this.game.bag.length;
		if (bagSize > this.lastBagSize) this.chipPop[bagSize - 1] = 0;
		this.lastBagSize = bagSize;
		this.chipPop = this.chipPop.map((shown) => Math.min(1, (shown ?? 1) + dt * CHIP_POP_SPEED));
	}

	draw() {
		const { ctx, pixelRatio, effects } = this;
		ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		ctx.clearRect(0, 0, this.w, this.h);
		if (!this.game) {
			effects.drawStickers(ctx, this.cell);
			return;
		}
		// The well shakes. The bar, the tray and the stickers stay still.
		ctx.save();
		ctx.translate(effects.shakeX, effects.shakeY);
		drawWell(this);
		drawGhost(this);
		drawBlocks(this);
		drawDying(this);
		effects.drawRings(ctx);
		ctx.restore();
		drawAim(this);
		drawBar(this);
		drawTray(this);
		drawDragged(this);
		drawHint(this);
		effects.drawStickers(ctx, this.cell);
		effects.drawFlash(ctx, this.w, this.h);
	}
}
