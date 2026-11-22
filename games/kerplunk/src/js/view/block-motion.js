// How blocks move on the screen. The engine moves a block to its new cell at once; the view keeps
// a "visual" for each block that slides there over time.
//
// A visual is { x, y, vy, sx, sy, delay, forge, ... }: the position in cells, the rising speed,
// the squash (sx, sy: 1 is the normal size), and a delay in seconds before it starts to move.
// While a Remix flies, a visual also has fly, rot (turn), and jx, jy (a jitter).

import { tuning } from '../feel/tuning.js';

const motion = tuning.motion;
const SLIDE_SPEED = 20; // how fast a block slides to a new column
const CLOSE_ENOUGH = 0.01; // cells: closer than this, a block snaps into place
const HARD_LANDING_SPEED = 4; // cells per second: a loose block that rises faster than this squashes

/** A new visual for a block at (x, y), that waits `delay` seconds before it moves. */
export function newBlockVisual(x, y, delay = 0) {
	return { x, y, vy: 0, sx: 1, sy: 1, delay, forge: 0 };
}

/** Moves every block toward its cell: it rises to the ceiling, squashes when it lands, and settles. */
export function updateBlocks(view, dt) {
	const { game } = view;
	const onBoard = new Set();
	for (let index = 0; index < game.grid.length; index++) {
		const block = game.grid[index];
		if (!block) continue;
		onBoard.add(block.id);
		updateBlock(view, block, game.columnOf(index), game.rowOf(index), dt);
	}
	// A block that left the board has no visual any more.
	for (const id of view.blockVisuals.keys()) if (!onBoard.has(id)) view.blockVisuals.delete(id);
}

function updateBlock(view, block, column, row, dt) {
	const visual = visualOf(view, block, column, row);
	if (visual.fly) return; // the Remix show moves this block
	if (visual.delay > 0) {
		visual.delay -= dt;
		return;
	}
	visual.x += (column - visual.x) * Math.min(1, dt * SLIDE_SPEED);
	if (Math.abs(column - visual.x) < CLOSE_ENOUGH) visual.x = column;
	if (!view.holdFalls) riseBlock(view, visual, row, dt);
	const springBack = Math.min(1, dt * motion.squashSpring);
	visual.sx += (1 - visual.sx) * springBack;
	visual.sy += (1 - visual.sy) * springBack;
	visual.forge = Math.max(0, visual.forge - dt * 1.8);
}

/** The visual of a block. A block that has none yet gets one in its cell. */
export function visualOf(view, block, column, row) {
	let visual = view.blockVisuals.get(block.id);
	if (!visual) {
		visual = newBlockVisual(column, row);
		view.blockVisuals.set(block.id, visual);
	}
	return visual;
}

/** One block rises toward its row, faster and faster, and squashes when it lands hard. */
function riseBlock(view, visual, row, dt) {
	if (visual.y < row) {
		visual.y = row;
		return;
	}
	if (visual.y === row) return;
	visual.vy += motion.gravity * dt;
	visual.y -= visual.vy * dt;
	if (visual.y > row) return;
	visual.y = row;
	if (visual.dropped) landDroppedBlock(view, visual);
	else if (visual.vy > HARD_LANDING_SPEED) squash(visual, motion.settleSquash, 0.64);
	visual.vy = 0;
}

/** A dropped piece lands hard: a bigger squash, and the view counts it for the landing thud. */
function landDroppedBlock(view, visual) {
	visual.dropped = false;
	squash(visual, motion.landSquash, 0.67);
	view.landedThisFrame++;
}

/** Flattens a block: shorter by `amount`, and wider by a part of that. */
function squash(visual, amount, widen) {
	visual.sy = 1 - amount;
	visual.sx = 1 + amount * widen;
}

/** Cleared blocks wait for their delay, then play their clear. A finished one is removed. */
export function updateDying(view, dt) {
	for (const dying of view.dying) {
		if (dying.delay > 0) dying.delay -= dt;
		else dying.t += dt;
	}
	view.dying = view.dying.filter((dying) => dying.t < motion.clearTime);
}
