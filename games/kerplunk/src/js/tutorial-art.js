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
	ctx.font = `500 ${size}px 'DM Mono', 'Space Grotesk', system-ui, sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = color;
	ctx.fillText(text, x, y);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
/** Progress from 0 to 1 while time t goes from a to b. */
const span = (t, a, b) => clamp01((t - a) / (b - a));

/** A block that hops up and left, then falls and turns while it shrinks, as in the game. k goes 0 to 1. */
function drawClearing(ctx, { color, x, y, size, k }) {
	if (k >= 1) return;
	const hop = k < 0.3;
	const u = hop ? k / 0.3 : (k - 0.3) / 0.7;
	const e = u * u;
	const dx = hop ? -3 * u : -3 + 3 * e;
	const dy = hop ? -3 * u : -3 + 17 * e;
	const scale = hop ? 1 + 0.06 * u : 1.06 - 0.66 * e;
	ctx.save();
	ctx.globalAlpha = hop ? 1 : 1 - e;
	ctx.translate(x + size / 2 + dx, y + size / 2 + dy);
	ctx.rotate(hop ? 0 : 0.25 * e);
	ctx.drawImage(view.sprites.plain[color], (-size * scale) / 2, (-size * scale) / 2, size * scale, size * scale);
	ctx.restore();
}

/** Page 1: a piece is dragged up, rises into the well and sticks. It loops. */
export function drawTutorialDrop(ctx, time) {
	const t = time % 2.8;
	const s = 24;
	const x0 = 36;
	const y0 = 12;
	drawMiniWell(ctx, { x: x0, y: y0, cols: 5, rows: 3, size: s });
	const ceiling = [[0, 0, 1], [1, 0, 3], [3, 0, 0], [4, 0, 4], [4, 1, 2], [0, 1, 3]];
	for (const [cx, cy, col] of ceiling) drawTile(ctx, { color: col, x: x0 + cx * s, y: y0 + cy * s, size: s });
	// The piece: Dusk, Amber / ., Amber. It rests on the Tide block in column 1.
	const piece = [[0, 0, 4], [1, 0, 1], [1, 1, 1]];
	const restY = y0 + s;
	const holdY = y0 + 3 * s + 14;
	const rise = easeInOut(span(t, 0.5, 1.15));
	const landed = t >= 1.15;
	const fade = 1 - span(t, 2.45, 2.75);
	const py = holdY + (restY - holdY) * rise;
	if (!landed) for (const [dx, dy, col] of piece) drawTile(ctx, { color: col, x: x0 + (1 + dx) * s, y: restY + dy * s, size: s, alpha: 0.3 });
	// A small squash against the stack as it lands.
	const squash = landed ? Math.sin(span(t, 1.15, 1.35) * Math.PI) * 0.18 : 0;
	ctx.globalAlpha = fade;
	for (const [dx, dy, col] of piece) {
		const w = s * (1 + squash * 0.6);
		const h = s * (1 - squash);
		const x = x0 + (1 + dx) * s - (w - s) / 2;
		ctx.drawImage(view.sprites.plain[col], x, py + dy * h, w, h);
	}
	ctx.globalAlpha = 1;
	if (!landed) {
		ctx.fillStyle = view.theme.card;
		ctx.strokeStyle = view.theme.ink;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(x0 + 2.6 * s, py + 1.9 * s, 7, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
	}
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

/** Page 2: three Moss blocks link, hop and fall; the points show on a sticker; the chain climbs. */
export function drawTutorialMatch(ctx, time) {
	const t = time % 3;
	const s = 26;
	const x0 = 20;
	const y0 = 18;
	drawMiniWell(ctx, { x: x0, y: y0, cols: 4, rows: 4, size: s });
	// Moss (2) links in a bend: (0,0) (1,0) (1,1). The Moss at (2,2) only touches by a corner, so it stays.
	const group = [[0, 0], [1, 0], [1, 1]];
	const rest = [[2, 0, 1], [3, 0, 1], [2, 1, 3], [3, 1, 0], [2, 2, 2]];
	for (const [cx, cy, col] of rest) drawTile(ctx, { color: col, x: x0 + cx * s, y: y0 + cy * s, size: s });
	// The Ember under the group rises to the ceiling once the group is gone.
	const up = easeOut(span(t, 1.3, 1.55));
	drawTile(ctx, { color: 0, x: x0, y: y0 + (1 - up) * s, size: s });
	group.forEach(([cx, cy], i) => {
		const k = span(t, 0.9 + i * 0.07, 1.25 + i * 0.07);
		drawClearing(ctx, { color: 2, x: x0 + cx * s, y: y0 + cy * s, size: s, k });
	});
	if (t < 0.9) {
		ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 14);
		ctx.strokeStyle = view.theme.dark ? view.theme.ink : view.theme.blockInk;
		ctx.lineWidth = 3;
		for (const [cx, cy] of group) {
			roundRect(ctx, x0 + cx * s + 1, y0 + cy * s + 1, s - 2, s - 2, 3);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}
	const pop = span(t, 1.0, 2.1);
	if (pop > 0 && pop < 1) {
		ctx.globalAlpha = pop > 0.7 ? 1 - (pop - 0.7) / 0.3 : 1;
		drawSticker(ctx, '+30', x0 + 1 * s, y0 + 1.6 * s - easeOut(pop) * 20);
		ctx.globalAlpha = 1;
	}
	drawLabel(ctx, '→', { x: 136, y: 70, size: 20 });
	['CHAIN ×2', 'CHAIN ×3', 'CHAIN ×4'].forEach((text, i) => {
		const k = span(t, 1.3 + i * 0.3, 1.5 + i * 0.3);
		if (k <= 0) return;
		ctx.save();
		ctx.translate(180, 36 + i * 31);
		const grow = k < 1 ? 0.6 + 0.6 * Math.sin(k * Math.PI * 0.75) : 1;
		ctx.scale(grow, grow);
		drawLabel(ctx, text, { x: 0, y: 0, size: 11 + i });
		ctx.restore();
	});
}

/** Page 3: the three power-ups hop one after the other. */
export function drawTutorialPowerUps(ctx, time) {
	const names = ['prism', 'blast', 'remix'];
	const t = time % 2.4;
	names.forEach((kind, i) => {
		const k = span(t, 0.3 + i * 0.35, 0.75 + i * 0.35);
		const lift = Math.sin(k * Math.PI) * 9;
		const cx = 38 + i * 72;
		const th = view.theme;
		ctx.fillStyle = th.shadow;
		roundRect(ctx, cx - 27 + lift * 0.3, 31, 60, 60, th.r);
		ctx.fill();
		ctx.fillStyle = th.card;
		ctx.strokeStyle = th.ink;
		ctx.lineWidth = 2.5;
		roundRect(ctx, cx - 30, 28 - lift, 60, 60, th.r);
		ctx.fill();
		ctx.stroke();
		view.drawPowerIcon(kind, cx, 58 - lift, 34, ctx);
		drawLabel(ctx, POWER_NAMES[kind].toUpperCase(), { x: cx, y: 108, size: 12 });
	});
}

/** Page 4: the stack reaches the tray end, the warning pulses, and the piece below does not fit. */
export function drawTutorialEnd(ctx, time) {
	const s = 20;
	const x0 = 60;
	drawMiniWell(ctx, { x: x0, y: 14, cols: 5, rows: 6, size: s });
	const heights = [6, 5, 6, 6, 5];
	heights.forEach((h, x) => {
		for (let k = 0; k < h; k++) drawTile(ctx, { color: (x * 3 + k * 2) % 5, x: x0 + x * s, y: 14 + k * s, size: s, alpha: 0.85 });
	});
	ctx.globalAlpha = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(time * 6));
	ctx.fillStyle = '#FF6B6B';
	ctx.fillRect(x0, 14 + 6 * s - s * 1.2, 5 * s, s * 1.2);
	ctx.globalAlpha = 1;
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
