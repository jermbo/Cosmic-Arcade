// The small pictures on the tutorial pages, drawn on a canvas.

import { roundRect } from './sprites.js';
import { POWER_NAMES } from './view.js';
import { view } from './session.js';

// The pictures use the blocks of the active theme and block style.
function drawTile(ctx, { color, x, y, size, alpha = 1 }) {
	ctx.globalAlpha = alpha;
	ctx.drawImage(view.sprites.plain[color], x, y, size, size);
	ctx.globalAlpha = 1;
}

function drawMiniWell(ctx, { x, y, cols, rows, size }) {
	const t = view.theme;
	ctx.fillStyle = t.shadow;
	roundRect(ctx, x - 1, y - 1, cols * size + 8, rows * size + 8, t.r);
	ctx.fill();
	ctx.fillStyle = t.well;
	ctx.strokeStyle = t.ink;
	ctx.lineWidth = 2;
	roundRect(ctx, x - 4, y - 4, cols * size + 8, rows * size + 8, t.r);
	ctx.fill();
	ctx.stroke();
}

function drawLabel(ctx, text, { x, y, color = view.theme.text, size = 13 }) {
	ctx.font = `500 ${size}px 'DM Mono', ui-monospace, monospace`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = color;
	ctx.fillText(text, x, y);
}

export function drawTutorialDrop(ctx) {
	const s = 24;
	const x0 = 36;
	const y0 = 12;
	drawMiniWell(ctx, { x: x0, y: y0, cols: 5, rows: 3, size: s });
	const ceiling = [[0, 0, 1], [1, 0, 3], [3, 0, 0], [4, 0, 4], [4, 1, 2], [0, 1, 3]];
	for (const [cx, cy, col] of ceiling) drawTile(ctx, { color: col, x: x0 + cx * s, y: y0 + cy * s, size: s });
	// Ghost
	drawTile(ctx, { color: 1, x: x0 + 2 * s, y: y0, size: s, alpha: 0.4 });
	drawTile(ctx, { color: 1, x: x0 + 2 * s, y: y0 + s, size: s, alpha: 0.4 });
	drawTile(ctx, { color: 4, x: x0 + 1 * s, y: y0 + s, size: s, alpha: 0.4 });
	// Piece held below
	const py = y0 + 3 * s + 14;
	drawTile(ctx, { color: 4, x: x0 + 1 * s, y: py, size: s });
	drawTile(ctx, { color: 1, x: x0 + 2 * s, y: py, size: s });
	drawTile(ctx, { color: 1, x: x0 + 2 * s, y: py + s, size: s });
	ctx.fillStyle = view.theme.card;
	ctx.strokeStyle = view.theme.ink;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(x0 + 2.6 * s, py + 1.9 * s, 7, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	drawLabel(ctx, 'LET GO', { x: 192, y: 32, size: 11 });
	drawLabel(ctx, 'DRAG', { x: 192, y: 128, size: 11 });
	ctx.strokeStyle = view.theme.ink;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(192, 114);
	ctx.lineTo(192, 50);
	ctx.lineTo(187, 56);
	ctx.moveTo(192, 50);
	ctx.lineTo(197, 56);
	ctx.stroke();
}

export function drawTutorialMatch(ctx) {
	const s = 26;
	const x0 = 20;
	const y0 = 18;
	drawMiniWell(ctx, { x: x0, y: y0, cols: 4, rows: 4, size: s });
	// Colors 2 link in a bend: (0,0) (1,0) (1,1). The 2 at (3,2) only touches by a corner, so it stays.
	const cells = [[0, 0, 2], [1, 0, 2], [1, 1, 2], [2, 0, 1], [3, 0, 1], [0, 1, 0], [2, 1, 3], [3, 1, 0], [2, 2, 2]];
	for (const [cx, cy, col] of cells) drawTile(ctx, { color: col, x: x0 + cx * s, y: y0 + cy * s, size: s });
	ctx.strokeStyle = view.theme.dark ? view.theme.ink : view.theme.blockInk;
	ctx.lineWidth = 3;
	for (const [cx, cy] of [[0, 0], [1, 0], [1, 1]]) {
		roundRect(ctx, x0 + cx * s + 1, y0 + cy * s + 1, s - 2, s - 2, 3);
		ctx.stroke();
	}
	drawSticker(ctx, '+30', x0 + 1.5 * s, y0 + 3.2 * s);
	drawLabel(ctx, '→', { x: 136, y: 70, size: 20 });
	drawLabel(ctx, 'CHAIN ×2', { x: 180, y: 36, size: 11 });
	drawLabel(ctx, 'CHAIN ×3', { x: 180, y: 66, size: 12 });
	drawLabel(ctx, 'CHAIN ×4', { x: 180, y: 98, size: 13 });
}

export function drawTutorialPowerUps(ctx) {
	const names = ['prism', 'blast', 'remix'];
	names.forEach((kind, i) => {
		const cx = 38 + i * 72;
		const t = view.theme;
		ctx.fillStyle = t.shadow;
		roundRect(ctx, cx - 27, 31, 60, 60, t.r);
		ctx.fill();
		ctx.fillStyle = t.card;
		ctx.strokeStyle = t.ink;
		ctx.lineWidth = 2.5;
		roundRect(ctx, cx - 30, 28, 60, 60, t.r);
		ctx.fill();
		ctx.stroke();
		view.drawPowerIcon(kind, cx, 58, 34, ctx);
		drawLabel(ctx, POWER_NAMES[kind].toUpperCase(), { x: cx, y: 108, size: 12 });
	});
}

export function drawTutorialEnd(ctx) {
	const s = 20;
	const x0 = 60;
	drawMiniWell(ctx, { x: x0, y: 14, cols: 5, rows: 6, size: s });
	const heights = [6, 5, 6, 6, 5];
	heights.forEach((h, x) => {
		for (let k = 0; k < h; k++) drawTile(ctx, { color: (x * 3 + k * 2) % 5, x: x0 + x * s, y: 14 + k * s, size: s, alpha: 0.85 });
	});
	ctx.fillStyle = 'rgba(255,107,107,0.4)';
	ctx.fillRect(x0, 14 + 6 * s - s * 1.2, 5 * s, s * 1.2);
}

/** A small sticker in the score-card color, tilted like the points of a clear. */
function drawSticker(ctx, text, x, y) {
	const t = view.theme;
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate((-4 * Math.PI) / 180);
	ctx.font = `15px '${t.display}', 'Arial Black', sans-serif`;
	const w = ctx.measureText(text).width + 14;
	ctx.fillStyle = t.shadow;
	ctx.fillRect(-w / 2 + 3, -11 + 3, w, 22);
	ctx.fillStyle = t.accent;
	ctx.fillRect(-w / 2, -11, w, 22);
	ctx.strokeStyle = t.ink;
	ctx.lineWidth = 2;
	ctx.strokeRect(-w / 2, -11, w, 22);
	ctx.fillStyle = t.onAccent;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, 0, 1);
	ctx.restore();
}
