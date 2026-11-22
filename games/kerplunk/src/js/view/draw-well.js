// Draws the well: its card and empty cells, the danger warning, the blocks, the blocks that are
// clearing, and the ghost that shows where the active piece would land.

import { tuning } from '../feel/tuning.js';
import { BLINK_EVERY, BLINK_TIME } from './sprites/block-sprites.js';
import { roundRect, pulse, DANGER_RED } from './canvas-shapes.js';

const motion = tuning.motion;
const WELL_MARGIN = 0.6; // cells of room around the well card in its picture
const GOLDEN_RATIO_PART = 0.618034; // spreads the blinks of the faces out evenly

// ---- the well card ----

/** Draws the well card and its empty cells once into its own canvas, since they do not change. */
export function buildWellLayer(view) {
	const { cell, pixelRatio, theme, game } = view;
	const cols = game ? game.cols : 7;
	const rows = game ? game.rows : 9;
	const margin = cell * WELL_MARGIN;
	const canvas = document.createElement('canvas');
	canvas.width = Math.round((view.boardW + margin * 2) * pixelRatio);
	canvas.height = Math.round((view.boardH + margin * 2) * pixelRatio);
	const ctx = canvas.getContext('2d');
	ctx.scale(pixelRatio, pixelRatio);

	const frame = cell * 0.14; // the card is a little bigger than the cells
	const x = margin - frame;
	const y = margin - frame;
	const w = view.boardW + frame * 2;
	const h = view.boardH + frame * 2;
	ctx.fillStyle = theme.shadow;
	roundRect(ctx, x + theme.shadowOffset, y + theme.shadowOffset, w, h, theme.cornerRadius);
	ctx.fill();
	ctx.fillStyle = theme.well;
	roundRect(ctx, x, y, w, h, theme.cornerRadius);
	ctx.fill();
	const outline = theme.outlineWidth;
	ctx.lineWidth = outline;
	ctx.strokeStyle = theme.ink;
	roundRect(ctx, x + outline / 2, y + outline / 2, w - outline, h - outline, theme.cornerRadius);
	ctx.stroke();
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < cols; column++) ctx.drawImage(view.sprites.slot, margin + column * cell, margin + row * cell, cell, cell);
	}
	return { canvas, margin };
}

/** The well card, and a red warning at the tray end of each column that is close to full. */
export function drawWell(view) {
	const { ctx, cell, game, wellLayer } = view;
	const { canvas, margin } = wellLayer;
	ctx.drawImage(canvas, view.boardX - margin, view.boardY - margin, canvas.width / view.pixelRatio, canvas.height / view.pixelRatio);
	const floorY = view.boardY + view.boardH;
	ctx.fillStyle = DANGER_RED;
	for (let x = 0; x < game.cols; x++) {
		const danger = game.dangerOf(x);
		if (danger === 0) continue;
		const left = view.boardX + x * cell;
		ctx.globalAlpha = 0.18 + danger * 0.08 + 0.08 * Math.sin(view.time * 6);
		ctx.fillRect(left, floorY - cell * 0.18, cell, cell * 0.18);
		ctx.globalAlpha *= 0.45;
		ctx.fillRect(left, floorY - cell * 2, cell, cell * 2);
	}
	ctx.globalAlpha = 1;
}

// ---- blocks ----

/** The image of a block. A face blinks once every BLINK_EVERY seconds, each at its own moment. */
export function blockImage(view, block, color = block.color) {
	const { sprites } = view;
	if (sprites.blink.length) {
		const blinkMoment = ((block.id * GOLDEN_RATIO_PART) % 1) * BLINK_EVERY;
		if ((view.time + blinkMoment) % BLINK_EVERY < BLINK_TIME) return sprites.blink[color];
	}
	return sprites.plain[color];
}

/** Draws one block at cell (x, y), squashed by (sx, sy) and turned by rot. */
function drawBlockAt(view, block, x, y, { sx = 1, sy = 1, rot = 0 } = {}) {
	const { ctx, cell } = view;
	const centerX = view.boardX + (x + 0.5) * cell;
	const top = view.boardY + y * cell;
	const w = cell * sx;
	const h = cell * sy;
	const image = blockImage(view, block);
	if (!rot) {
		// A squashed block keeps its top edge against the ceiling.
		ctx.drawImage(image, centerX - w / 2, top, w, h);
		return;
	}
	ctx.save();
	ctx.translate(centerX, top + cell / 2);
	ctx.rotate(rot);
	ctx.drawImage(image, -w / 2, -h / 2, w, h);
	ctx.restore();
}

/** Every block on the board. Blocks that would match show a mark. Blocks in the air draw on top. */
export function drawBlocks(view) {
	const { game } = view;
	const willMatch = previewCells(view);
	const flying = [];
	for (let index = 0; index < game.grid.length; index++) {
		const block = game.grid[index];
		if (!block) continue;
		const visual = view.blockVisuals.get(block.id);
		if (!visual || visual.delay > 0) continue;
		if (visual.fly) {
			flying.push([block, visual]);
			continue;
		}
		drawBlockVisual(view, block, visual);
		if (willMatch && willMatch.has(index)) drawMatchMark(view, visual.x, visual.y);
	}
	for (const [block, visual] of flying) drawBlockVisual(view, block, visual);
}

function drawBlockVisual(view, block, visual) {
	drawBlockAt(view, block, visual.x + (visual.jx || 0), visual.y + (visual.jy || 0), { sx: visual.sx, sy: visual.sy, rot: visual.rot || 0 });
}

/** A pulsing outline on a block that would clear if the active piece dropped now. */
function drawMatchMark(view, x, y) {
	const { ctx, cell, theme } = view;
	ctx.globalAlpha = 0.55 + pulse(view.time, 9) * 0.45;
	ctx.strokeStyle = theme.dark ? theme.ink : theme.blockInk;
	ctx.lineWidth = Math.max(2.5, cell * 0.09);
	roundRect(ctx, view.boardX + x * cell + 1, view.boardY + y * cell + 1, cell - 2, cell - 2, cell * 0.08);
	ctx.stroke();
	ctx.globalAlpha = 1;
}

/** A cleared block hops up and left, then falls and turns while it shrinks. A face gets bigger for a moment. */
export function drawDying(view) {
	const { ctx, cell } = view;
	const growOnHop = view.style === 'faces' ? 0.3 : motion.clearGrow;
	for (const dying of view.dying) {
		if (dying.delay > 0) {
			drawBlockAt(view, dying.block, dying.x, dying.y);
			continue;
		}
		const { dx, dy, scale, rot, alpha } = clearPose(dying.t, growOnHop);
		const center = view.cellCenter(dying.x, dying.y);
		const size = cell * scale;
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.translate(center.x + dx, center.y + dy);
		ctx.rotate(rot);
		ctx.drawImage(blockImage(view, dying.block), -size / 2, -size / 2, size, size);
		ctx.restore();
	}
}

/**
 * Where a clearing block is after `t` seconds: the hop, then the fall.
 * Returns the offset in pixels, the size, the turn and how visible it is.
 * The shop's motion preview uses the same steps.
 */
export function clearPose(t, growOnHop, motionValues = motion, pixelScale = 1) {
	const progress = Math.min(1, t / Math.max(0.01, motionValues.clearTime));
	const hopPart = Math.min(0.95, Math.max(0.01, motionValues.hopPart));
	const hop = motionValues.hopSize * pixelScale;
	const biggest = 1 + growOnHop;
	if (progress < hopPart) {
		const u = progress / hopPart;
		return { dx: -hop * u, dy: -hop * u, scale: 1 + (biggest - 1) * u, rot: 0, alpha: 1 };
	}
	const u = (progress - hopPart) / (1 - hopPart);
	const fall = Math.pow(u, motionValues.fallEase);
	return {
		dx: -hop + hop * fall,
		dy: -hop + motionValues.fallSize * pixelScale * fall,
		scale: biggest - (biggest - motionValues.clearEnd) * fall,
		rot: motionValues.fallSpin * fall,
		alpha: 1 - fall,
	};
}

// ---- the ghost of the active piece ----

/** The active piece and column: from a drag, or from the keyboard cursor. Null when there is none. */
export function activeTarget(view) {
	const { drag, keyCursor, game } = view;
	if (drag && drag.moved && drag.geometry && drag.geometry.over) {
		return { piece: drag.piece, col: drag.geometry.col, valid: drag.geometry.valid };
	}
	if (keyCursor && !drag && game.pieces[keyCursor.slot]) {
		const piece = game.pieces[keyCursor.slot];
		const col = Math.min(keyCursor.col, game.cols - piece.w);
		return { piece, col, valid: game.fits(piece, col) };
	}
	return null;
}

/**
 * The cells that would match right away if the active piece dropped now, or null.
 * It tries the drop on a copy of the game, and keeps the answer until the piece or column changes.
 */
function previewCells(view) {
	const target = activeTarget(view);
	if (!target || !target.valid) return null;
	const { piece, col } = target;
	const key = `${piece.id}:${piece.cells.map((cell) => `${cell.dx}${cell.dy}`).join('')}:${col}:${view.game.turn}`;
	if (view.previewCache.key === key) return view.previewCache.cells;

	const trial = view.game.clone();
	trial.pieces[0] = piece;
	const placed = trial.place(0, col, piece);
	const cells = new Set();
	for (const group of trial.findGroups()) for (const index of group.cells) cells.add(index);
	// The ghost shows where the rigid piece rests, so note which of its cells end up in a match.
	const ghost = new Set();
	for (const block of placed) if (cells.has(trial.grid.indexOf(block.block))) ghost.add(`${block.x},${block.y}`);
	view.previewCache = { key, cells, ghost };
	return cells;
}

/** A soft beam over the columns of the active piece, and its ghost where it would land (or a red X). */
export function drawGhost(view) {
	const target = activeTarget(view);
	if (!target) return;
	const { ctx, cell, theme } = view;
	ctx.globalAlpha = target.valid ? 0.07 : 0.16;
	ctx.fillStyle = target.valid ? theme.ink : DANGER_RED;
	ctx.fillRect(view.boardX + target.col * cell, view.boardY, target.piece.w * cell, view.boardH);
	ctx.globalAlpha = 1;
	if (target.valid) drawGhostBlocks(view, target);
	else drawNoFit(view, target);
}

/** A red X at the tray end of the columns, where the piece does not fit. */
function drawNoFit(view, { piece, col }) {
	const { ctx, cell, theme } = view;
	const left = view.boardX + col * cell;
	const right = left + piece.w * cell;
	const floorY = view.boardY + view.boardH;
	ctx.strokeStyle = DANGER_RED;
	ctx.lineWidth = theme.outlineWidth;
	ctx.beginPath();
	ctx.moveTo(left + cell * 0.3, floorY - cell * 0.3);
	ctx.lineTo(right - cell * 0.3, floorY - cell * 0.7);
	ctx.moveTo(right - cell * 0.3, floorY - cell * 0.3);
	ctx.lineTo(left + cell * 0.3, floorY - cell * 0.7);
	ctx.stroke();
}

/** See-through blocks with a moving dashed outline where each block of the piece would rest. */
function drawGhostBlocks(view, { piece, col }) {
	const { ctx, cell, game, theme } = view;
	const willMatch = previewCells(view);
	for (const rest of game.landing(piece, col)) {
		const x = view.boardX + rest.x * cell;
		const y = view.boardY + rest.y * cell;
		ctx.globalAlpha = 0.4;
		ctx.drawImage(view.sprites.plain[rest.cell.color], x, y, cell, cell);
		ctx.globalAlpha = 1;
		ctx.setLineDash([cell * 0.14, cell * 0.1]);
		ctx.lineDashOffset = -view.time * cell * 0.6;
		ctx.strokeStyle = theme.ink;
		ctx.lineWidth = 2;
		roundRect(ctx, x + 3, y + 3, cell - 6, cell - 6, cell * 0.08);
		ctx.stroke();
		ctx.setLineDash([]);
		if (willMatch && view.previewCache.ghost.has(`${rest.x},${rest.y}`)) drawMatchMark(view, rest.x, rest.y);
	}
}
