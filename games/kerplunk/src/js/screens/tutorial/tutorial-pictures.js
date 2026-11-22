// The small moving pictures on the tutorial pages, drawn on a 220 × 150 canvas.
// Each draw function gets the time in seconds and loops by itself.
// The pictures use the blocks of the active theme and block style.

import { roundRect, DANGER_RED, MONO_FONT } from '../../view/canvas-shapes.js';
import { POWER_NAMES, drawPowerIcon } from '../../view/power-icons.js';
import { progressBetween, easeInOutQuad, easeOutCubic } from '../../view/easing.js';
import { view } from '../../play/session.js';

// ---- helpers ----

function drawTile(ctx, { color, x, y, size, alpha = 1 }) {
	ctx.globalAlpha = alpha;
	ctx.drawImage(view.sprites.plain[color], x, y, size, size);
	ctx.globalAlpha = 1;
}

/** A small well card, with its top left cell at (x, y). */
function drawMiniWell(ctx, { x, y, cols, rows, size }) {
	const theme = view.theme;
	const w = cols * size + 8;
	const h = rows * size + 8;
	ctx.fillStyle = theme.shadow;
	roundRect(ctx, x - 1, y - 1, w, h, theme.cornerRadius);
	ctx.fill();
	ctx.fillStyle = theme.well;
	ctx.strokeStyle = theme.ink;
	ctx.lineWidth = 2;
	roundRect(ctx, x - 4, y - 4, w, h, theme.cornerRadius);
	ctx.fill();
	ctx.stroke();
}

function drawLabel(ctx, text, { x, y, color = view.theme.text, size = 13 }) {
	ctx.font = `500 ${size}px ${MONO_FONT}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = color;
	ctx.fillText(text, x, y);
}

/** A block that hops up and left, then falls and turns while it shrinks, as in the game. progress goes 0 to 1. */
function drawClearing(ctx, { color, x, y, size, progress }) {
	if (progress >= 1) return;
	const hopping = progress < 0.3;
	const u = hopping ? progress / 0.3 : (progress - 0.3) / 0.7;
	const fall = u * u;
	const dx = hopping ? -3 * u : -3 + 3 * fall;
	const dy = hopping ? -3 * u : -3 + 17 * fall;
	const scale = hopping ? 1 + 0.06 * u : 1.06 - 0.66 * fall;
	ctx.save();
	ctx.globalAlpha = hopping ? 1 : 1 - fall;
	ctx.translate(x + size / 2 + dx, y + size / 2 + dy);
	ctx.rotate(hopping ? 0 : 0.25 * fall);
	ctx.drawImage(view.sprites.plain[color], (-size * scale) / 2, (-size * scale) / 2, size * scale, size * scale);
	ctx.restore();
}

/** A small sticker in the score-card color, tilted like the points of a clear. */
function drawSticker(ctx, text, x, y) {
	const theme = view.theme;
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate((-4 * Math.PI) / 180);
	ctx.font = `15px '${theme.displayFont}', 'Arial Black', sans-serif`;
	const w = ctx.measureText(text).width + 14;
	ctx.fillStyle = theme.shadow;
	ctx.fillRect(-w / 2 + 3, -11 + 3, w, 22);
	ctx.fillStyle = theme.accent;
	ctx.fillRect(-w / 2, -11, w, 22);
	ctx.strokeStyle = theme.ink;
	ctx.lineWidth = 2;
	ctx.strokeRect(-w / 2, -11, w, 22);
	ctx.fillStyle = theme.onAccent;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, 0, 1);
	ctx.restore();
}

/** An arrow from (x, fromY) up to (x, toY). */
function drawUpArrow(ctx, x, fromY, toY) {
	ctx.strokeStyle = view.theme.ink;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(x, fromY);
	ctx.lineTo(x, toY);
	ctx.lineTo(x - 5, toY + 6);
	ctx.moveTo(x, toY);
	ctx.lineTo(x + 5, toY + 6);
	ctx.stroke();
}

// ---- the pages ----

/** Page 1: a piece is dragged up, rises into the well and sticks. It loops. */
export function drawDropPicture(ctx, time) {
	const t = time % 2.8;
	const size = 24;
	const wellX = 36;
	const wellY = 12;
	drawMiniWell(ctx, { x: wellX, y: wellY, cols: 5, rows: 3, size });
	// [column, row, color] of the blocks already on the ceiling.
	const stack = [[0, 0, 1], [1, 0, 3], [3, 0, 0], [4, 0, 4], [4, 1, 2], [0, 1, 3]];
	for (const [column, row, color] of stack) drawTile(ctx, { color, x: wellX + column * size, y: wellY + row * size, size });

	// The piece: Dusk, Amber / ., Amber. It rests on the Tide block in column 1.
	const piece = [[0, 0, 4], [1, 0, 1], [1, 1, 1]];
	const restY = wellY + size;
	const holdY = wellY + 3 * size + 14;
	const rise = easeInOutQuad(progressBetween(t, 0.5, 1.15));
	const landed = t >= 1.15;
	const fade = 1 - progressBetween(t, 2.45, 2.75);
	const pieceY = holdY + (restY - holdY) * rise;
	// The ghost shows where it lands.
	if (!landed) for (const [dx, dy, color] of piece) drawTile(ctx, { color, x: wellX + (1 + dx) * size, y: restY + dy * size, size, alpha: 0.3 });
	// A small squash against the stack as it lands.
	const squash = landed ? Math.sin(progressBetween(t, 1.15, 1.35) * Math.PI) * 0.18 : 0;
	ctx.globalAlpha = fade;
	for (const [dx, dy, color] of piece) {
		const w = size * (1 + squash * 0.6);
		const h = size * (1 - squash);
		const x = wellX + (1 + dx) * size - (w - size) / 2;
		ctx.drawImage(view.sprites.plain[color], x, pieceY + dy * h, w, h);
	}
	ctx.globalAlpha = 1;
	if (!landed) drawFinger(ctx, wellX + 2.6 * size, pieceY + 1.9 * size);
	drawLabel(ctx, 'LET GO', { x: 192, y: 32, size: 11 });
	drawLabel(ctx, 'DRAG', { x: 192, y: 128, size: 11 });
	drawUpArrow(ctx, 192, 114, 50);
}

function drawFinger(ctx, x, y) {
	ctx.fillStyle = view.theme.card;
	ctx.strokeStyle = view.theme.ink;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(x, y, 7, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
}

/** Page 2: three Moss blocks link, hop and fall; the points show on a sticker; the chain climbs. */
export function drawMatchPicture(ctx, time) {
	const t = time % 3;
	const size = 26;
	const wellX = 20;
	const wellY = 18;
	drawMiniWell(ctx, { x: wellX, y: wellY, cols: 4, rows: 4, size });
	// Moss (2) links in a bend: (0,0) (1,0) (1,1). The Moss at (2,2) only touches by a corner, so it stays.
	const group = [[0, 0], [1, 0], [1, 1]];
	const others = [[2, 0, 1], [3, 0, 1], [2, 1, 3], [3, 1, 0], [2, 2, 2]];
	for (const [column, row, color] of others) drawTile(ctx, { color, x: wellX + column * size, y: wellY + row * size, size });
	// The Ember under the group rises to the ceiling once the group is gone.
	const up = easeOutCubic(progressBetween(t, 1.3, 1.55));
	drawTile(ctx, { color: 0, x: wellX, y: wellY + (1 - up) * size, size });
	group.forEach(([column, row], i) => {
		const progress = progressBetween(t, 0.9 + i * 0.07, 1.25 + i * 0.07);
		drawClearing(ctx, { color: 2, x: wellX + column * size, y: wellY + row * size, size, progress });
	});
	if (t < 0.9) drawGroupMarks(ctx, group, { wellX, wellY, size, t });
	const stickerLife = progressBetween(t, 1.0, 2.1);
	if (stickerLife > 0 && stickerLife < 1) {
		ctx.globalAlpha = stickerLife > 0.7 ? 1 - (stickerLife - 0.7) / 0.3 : 1;
		drawSticker(ctx, '+30', wellX + size, wellY + 1.6 * size - easeOutCubic(stickerLife) * 20);
		ctx.globalAlpha = 1;
	}
	drawLabel(ctx, '→', { x: 136, y: 70, size: 20 });
	['CHAIN ×2', 'CHAIN ×3', 'CHAIN ×4'].forEach((text, i) => drawChainLabel(ctx, text, i, t));
}

/** The pulsing outline on the blocks that will match. */
function drawGroupMarks(ctx, group, { wellX, wellY, size, t }) {
	ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 14);
	ctx.strokeStyle = view.theme.dark ? view.theme.ink : view.theme.blockInk;
	ctx.lineWidth = 3;
	for (const [column, row] of group) {
		roundRect(ctx, wellX + column * size + 1, wellY + row * size + 1, size - 2, size - 2, 3);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
}

/** "CHAIN ×2", "×3", "×4" pop in one after the other, each a bit bigger. */
function drawChainLabel(ctx, text, index, t) {
	const progress = progressBetween(t, 1.3 + index * 0.3, 1.5 + index * 0.3);
	if (progress <= 0) return;
	ctx.save();
	ctx.translate(180, 36 + index * 31);
	const grow = progress < 1 ? 0.6 + 0.6 * Math.sin(progress * Math.PI * 0.75) : 1;
	ctx.scale(grow, grow);
	drawLabel(ctx, text, { x: 0, y: 0, size: 11 + index });
	ctx.restore();
}

/** Page 3: the three power-ups hop one after the other. */
export function drawPowerUpsPicture(ctx, time) {
	const t = time % 2.4;
	const theme = view.theme;
	['prism', 'blast', 'remix'].forEach((kind, i) => {
		const hop = progressBetween(t, 0.3 + i * 0.35, 0.75 + i * 0.35);
		const lift = Math.sin(hop * Math.PI) * 9;
		const centerX = 38 + i * 72;
		ctx.fillStyle = theme.shadow;
		roundRect(ctx, centerX - 27 + lift * 0.3, 31, 60, 60, theme.cornerRadius);
		ctx.fill();
		ctx.fillStyle = theme.card;
		ctx.strokeStyle = theme.ink;
		ctx.lineWidth = 2.5;
		roundRect(ctx, centerX - 30, 28 - lift, 60, 60, theme.cornerRadius);
		ctx.fill();
		ctx.stroke();
		drawPowerIcon(ctx, kind, centerX, 58 - lift, 34, theme.ink);
		drawLabel(ctx, POWER_NAMES[kind].toUpperCase(), { x: centerX, y: 108, size: 12 });
	});
}

/** Page 4: the stack reaches the tray end, the warning pulses, and no piece fits. */
export function drawEndPicture(ctx, time) {
	const size = 20;
	const wellX = 60;
	const wellY = 14;
	drawMiniWell(ctx, { x: wellX, y: wellY, cols: 5, rows: 6, size });
	const heights = [6, 5, 6, 6, 5];
	heights.forEach((height, column) => {
		for (let row = 0; row < height; row++) drawTile(ctx, { color: (column * 3 + row * 2) % 5, x: wellX + column * size, y: wellY + row * size, size, alpha: 0.85 });
	});
	ctx.globalAlpha = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(time * 6));
	ctx.fillStyle = DANGER_RED;
	ctx.fillRect(wellX, wellY + 6 * size - size * 1.2, 5 * size, size * 1.2);
	ctx.globalAlpha = 1;
}
