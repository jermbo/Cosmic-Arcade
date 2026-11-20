// Draws the tray (a card for each piece), the piece in the player's hand, a piece that flies
// back to the tray after a drop that did not fit, and the hint for a first-time player.

import { drawCard, drawDashedOutline, roundRect } from './canvas-shapes.js';
import { easeInOutQuad, easeOutCubic } from './easing.js';

const SLOT_SIDE_ROOM = 6; // pixels between two tray cards
const UNPLACEABLE_ALPHA = 0.3; // a piece that fits nowhere is faded

/** Draws a piece with its top left corner at (x, y), with blocks `size` pixels wide. */
export function drawPieceAt(view, piece, x, y, size, alpha = 1) {
	const { ctx } = view;
	ctx.globalAlpha = alpha;
	for (const cell of piece.cells) ctx.drawImage(view.sprites.plain[cell.color], x + cell.dx * size, y + cell.dy * size, size, size);
	ctx.globalAlpha = 1;
}

/** The tray: a card for each slot. A used slot is an empty card with a dashed outline. */
export function drawTray(view) {
	const { game, theme, cell } = view;
	game.pieces.forEach((piece, slot) => {
		const box = view.slots[slot];
		const x = box.x + SLOT_SIDE_ROOM;
		const w = box.w - SLOT_SIDE_ROOM * 2 - theme.shadowOffset;
		if (!piece) {
			drawDashedOutline(view.ctx, theme, x + 1, box.y + 1, w - 2, box.h - 2, { dash: cell * 0.16, gap: cell * 0.12, alpha: 0.55 });
			return;
		}
		const pressed = Boolean(view.drag && view.drag.slot === slot);
		drawSlotCard(view, slot, { x, y: box.y, w, h: box.h, pressed });
		// A piece in the player's hand, or on its way back, is drawn by drawDragged.
		if (pressed && view.drag.moved) return;
		if (view.returning && view.returning.slot === slot) return;
		drawTrayPiece(view, slot, piece, pressed);
	});
}

/** The card of a slot. It is in the accent color when the keyboard picked it, or a Prism can paint it. */
function drawSlotCard(view, slot, { x, y, w, h, pressed }) {
	const { ctx, theme } = view;
	const selected = view.keyCursor && view.keyCursor.slot === slot && !view.drag;
	const paintable = view.power && view.power.kind === 'prism' && view.power.stage === 'piece';
	const fill = selected || paintable ? theme.accent : theme.card;
	if (paintable) ctx.globalAlpha = 0.75 + 0.25 * Math.sin(view.time * 7);
	// A finger on the card pushes it into its shadow.
	drawCard(ctx, theme, x, y, w, h, { fill, pressed });
	ctx.globalAlpha = 1;
}

/** A tray piece, centered in its slot. A new piece pops in. */
function drawTrayPiece(view, slot, piece, pressed) {
	const { ctx, theme } = view;
	const spot = view.slotPiecePos(slot, piece);
	const shown = view.appear[slot] ?? 1; // 0 when the piece just came, 1 when it has fully popped in
	const scale = shown < 1 ? 0.5 + 0.5 * easeOutCubic(shown) + Math.sin(shown * Math.PI) * 0.12 : 1;
	const pushDown = pressed ? theme.shadowOffset : 0;
	const centerX = spot.x + (piece.w * spot.size) / 2 - theme.shadowOffset / 2 + pushDown;
	const centerY = spot.y + (piece.h * spot.size) / 2 + pushDown;
	ctx.save();
	ctx.translate(centerX, centerY);
	ctx.scale(scale, scale);
	const fits = view.game.canPlace(piece);
	drawPieceAt(view, piece, -(piece.w * spot.size) / 2, -(piece.h * spot.size) / 2, spot.size, fits ? 1 : UNPLACEABLE_ALPHA);
	ctx.restore();
}

/** The piece in the player's hand, with a hard shadow under it, and a piece flying back to the tray. */
export function drawDragged(view) {
	const { drag } = view;
	if (drag && drag.moved && drag.geometry) drawLiftedPiece(view, drag.piece, drag.geometry);
	if (view.returning) drawReturningPiece(view);
}

function drawLiftedPiece(view, piece, { left, top }) {
	const { ctx, cell, theme } = view;
	ctx.fillStyle = theme.shadow;
	ctx.globalAlpha = theme.dark ? 0.35 : 0.9;
	const shadowShift = cell * 0.05 + theme.shadowOffset * 1.5;
	for (const block of piece.cells) {
		roundRect(ctx, left + block.dx * cell + shadowShift, top + block.dy * cell + shadowShift, cell * 0.9, cell * 0.9, cell * 0.08);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	drawPieceAt(view, piece, left, top, cell);
}

/** A piece that did not fit flies back into its slot and shrinks to the tray size. */
function drawReturningPiece(view) {
	const { returning, cell } = view;
	const piece = view.game.pieces[returning.slot];
	if (!piece) return;
	const home = view.slotPiecePos(returning.slot, piece);
	const eased = easeOutCubic(returning.t);
	const size = cell + (home.size - cell) * eased;
	drawPieceAt(view, piece, returning.x + (home.x - returning.x) * eased, returning.y + (home.y - returning.y) * eased, size);
}

/** The hint for a first game: a finger moves from the first tray piece up into the well, again and again. */
export function drawHint(view) {
	if (!view.hint || view.drag || !view.game.pieces[0]) return;
	const { ctx, cell, theme } = view;
	const from = view.slotPiecePos(0, view.game.pieces[0]);
	const start = { x: from.x + from.size, y: from.y + from.size };
	const end = { x: view.boardX + view.boardW / 2, y: view.boardY + view.boardH * 0.45 };
	const loop = (view.time % 2.2) / 2.2; // 0 to 1 every 2.2 seconds
	// Rest at the tray, move up, rest in the well, then fade out.
	const moving = loop < 0.15 ? 0 : loop > 0.75 ? 1 : (loop - 0.15) / 0.6;
	const eased = easeInOutQuad(moving);
	const x = start.x + (end.x - start.x) * eased;
	const y = start.y + (end.y - start.y) * eased;
	const radius = cell * 0.26;
	ctx.globalAlpha = loop > 0.85 ? (1 - loop) / 0.15 : 1;
	ctx.fillStyle = theme.shadow;
	ctx.beginPath();
	ctx.arc(x + 3, y + 3, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = theme.card;
	ctx.strokeStyle = theme.ink;
	ctx.lineWidth = theme.outlineWidth;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.globalAlpha = 1;
}
