// The small pictures on the tutorial pages, drawn on a canvas.

import { GOLD, roundRect } from './sprites.js';
import { POWER_NAMES } from './view.js';
import { view } from './session.js';

function drawTile(ctx, { kind, color, x, y, size, alpha = 1 }) {
	ctx.globalAlpha = alpha;
	ctx.drawImage(view.sprites[kind][color], x, y, size, size);
	ctx.globalAlpha = 1;
}

function drawMiniWell(ctx, { x, y, cols, rows, size }) {
	ctx.fillStyle = 'rgba(9,7,22,0.85)';
	ctx.strokeStyle = GOLD;
	ctx.lineWidth = 1.5;
	roundRect(ctx, x - 4, y - 4, cols * size + 8, rows * size + 8, 8);
	ctx.fill();
	ctx.stroke();
}

function drawLabel(ctx, text, { x, y, color = GOLD, size = 13 }) {
	ctx.font = `800 ${size}px ui-rounded, system-ui, sans-serif`;
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
	for (const [cx, cy, col] of ceiling) drawTile(ctx, { kind: 'plain', color: col, x: x0 + cx * s, y: y0 + cy * s, size: s });
	// Ghost
	drawTile(ctx, { kind: 'plain', color: 1, x: x0 + 2 * s, y: y0, size: s, alpha: 0.4 });
	drawTile(ctx, { kind: 'plain', color: 1, x: x0 + 2 * s, y: y0 + s, size: s, alpha: 0.4 });
	drawTile(ctx, { kind: 'plain', color: 4, x: x0 + 1 * s, y: y0 + s, size: s, alpha: 0.4 });
	// Piece held below
	const py = y0 + 3 * s + 14;
	drawTile(ctx, { kind: 'plain', color: 4, x: x0 + 1 * s, y: py, size: s });
	drawTile(ctx, { kind: 'plain', color: 1, x: x0 + 2 * s, y: py, size: s });
	drawTile(ctx, { kind: 'plain', color: 1, x: x0 + 2 * s, y: py + s, size: s });
	ctx.fillStyle = '#fff6dc';
	ctx.beginPath();
	ctx.arc(x0 + 2.6 * s, py + 1.9 * s, 7, 0, Math.PI * 2);
	ctx.fill();
	drawLabel(ctx, 'let go', { x: 192, y: 32, color: '#b3a8d6', size: 12 });
	drawLabel(ctx, 'drag', { x: 192, y: 128, color: '#b3a8d6', size: 12 });
	ctx.strokeStyle = '#b3a8d6';
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
	for (const [cx, cy, col] of cells) drawTile(ctx, { kind: 'plain', color: col, x: x0 + cx * s, y: y0 + cy * s, size: s });
	ctx.strokeStyle = '#fff6dc';
	ctx.lineWidth = 2.5;
	for (const [cx, cy] of [[0, 0], [1, 0], [1, 1]]) {
		roundRect(ctx, x0 + cx * s + 2, y0 + cy * s + 2, s - 4, s - 4, 6);
		ctx.stroke();
	}
	drawLabel(ctx, '+30', { x: x0 + 1.5 * s, y: y0 + 2.5 * s, color: GOLD, size: 15 });
	drawLabel(ctx, '→', { x: 136, y: 70, color: '#b3a8d6', size: 22 });
	drawLabel(ctx, 'Chain ×2', { x: 180, y: 36, color: '#ffb38a', size: 13 });
	drawLabel(ctx, 'Chain ×3', { x: 180, y: 66, color: '#ff8fb1', size: 14 });
	drawLabel(ctx, 'Chain ×4', { x: 180, y: 98, color: '#e3a2ff', size: 15 });
}

export function drawTutorialPowerUps(ctx) {
	const names = ['prism', 'blast', 'remix'];
	names.forEach((kind, i) => {
		const cx = 38 + i * 72;
		ctx.fillStyle = 'rgba(242,200,121,0.16)';
		ctx.strokeStyle = GOLD;
		ctx.lineWidth = 2;
		roundRect(ctx, cx - 30, 28, 60, 60, 14);
		ctx.fill();
		ctx.stroke();
		view.drawPowerIcon(kind, cx, 58, 34, ctx);
		drawLabel(ctx, POWER_NAMES[kind], { x: cx, y: 104, color: '#fff6dc', size: 13 });
	});
}

export function drawTutorialEnd(ctx) {
	const s = 20;
	const x0 = 60;
	drawMiniWell(ctx, { x: x0, y: 14, cols: 5, rows: 6, size: s });
	const heights = [6, 5, 6, 6, 5];
	heights.forEach((h, x) => {
		for (let k = 0; k < h; k++) drawTile(ctx, { kind: 'plain', color: (x * 3 + k * 2) % 5, x: x0 + x * s, y: 14 + k * s, size: s, alpha: 0.85 });
	});
	ctx.fillStyle = 'rgba(255,80,100,0.3)';
	ctx.fillRect(x0, 14 + 6 * s - s * 1.2, 5 * s, s * 1.2);
}
