// Draws the blocks once per size, theme and block style, so each frame only copies images.
// Each block style gives each color a second clue, so the five colors stay different in grayscale.

import { BLOCK_NAMES, LIGHT, textOn } from './themes.js';

/** The five block colors in play. paintPalette() changes them when the theme changes. */
export const PALETTE = BLOCK_NAMES.map((name, i) => ({ name, base: LIGHT.blocks[i] }));

/** Paints the shared palette from a list of five #rrggbb colors. Rebuild the sprites afterwards. */
export function paintPalette(colors) {
	colors.forEach((base, i) => (PALETTE[i].base = base));
}

/** The block styles, in the order of the shop. */
export const BLOCK_STYLES = ['patterns', 'symbols', 'pips', 'silhouettes', 'faces'];

// Faces blink once every BLINK_EVERY seconds, each at its own moment, for BLINK_TIME seconds.
export const BLINK_EVERY = 6;
export const BLINK_TIME = 0.14;

export function roundRect(ctx, x, y, w, h, r) {
	r = Math.max(0, Math.min(r, w / 2, h / 2));
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

/** The shape of a Silhouettes block: square, circle, leaf, octagon, arch. */
function silhouettePath(ctx, color, x, y, w) {
	const c = x + w / 2;
	const m = y + w / 2;
	ctx.beginPath();
	switch (color) {
		case 0:
			roundRect(ctx, x, y, w, w, w * 0.08);
			return;
		case 1:
			ctx.arc(c, m, w / 2, 0, Math.PI * 2);
			break;
		case 2: {
			// A leaf: the top-left and bottom-right corners are round, the others are sharp.
			const r = w * 0.48;
			ctx.moveTo(x + r, y);
			ctx.lineTo(x + w, y);
			ctx.lineTo(x + w, y + w - r);
			ctx.arcTo(x + w, y + w, x + w - r, y + w, r);
			ctx.lineTo(x, y + w);
			ctx.lineTo(x, y + r);
			ctx.arcTo(x, y, x + r, y, r);
			break;
		}
		case 3: {
			const k = w * 0.29;
			ctx.moveTo(x + k, y);
			ctx.lineTo(x + w - k, y);
			ctx.lineTo(x + w, y + k);
			ctx.lineTo(x + w, y + w - k);
			ctx.lineTo(x + w - k, y + w);
			ctx.lineTo(x + k, y + w);
			ctx.lineTo(x, y + w - k);
			ctx.lineTo(x, y + k);
			break;
		}
		default:
			// An arch: a round top and a flat bottom.
			ctx.moveTo(x, y + w);
			ctx.lineTo(x, y + w / 2);
			ctx.arc(c, y + w / 2, w / 2, Math.PI, 0);
			ctx.lineTo(x + w, y + w);
	}
	ctx.closePath();
}

/** Patterns: stripes, dots, plain, checks, rings. The pattern is clipped to the block. */
function drawPattern(ctx, color, s, ink) {
	const k = s / 40;
	ctx.fillStyle = ink;
	ctx.strokeStyle = ink;
	ctx.globalAlpha = 0.8;
	if (color === 0) {
		ctx.lineWidth = 2 * k;
		ctx.beginPath();
		for (let d = -s; d < s * 2; d += 7 * k) {
			ctx.moveTo(d, s);
			ctx.lineTo(d + s, 0);
		}
		ctx.stroke();
	} else if (color === 1) {
		for (let y = 3.5 * k; y < s; y += 7 * k) {
			for (let x = 3.5 * k; x < s; x += 7 * k) {
				ctx.beginPath();
				ctx.arc(x, y, 1.6 * k, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	} else if (color === 3) {
		const q = 5 * k;
		for (let y = 0, row = 0; y < s; y += q, row++) for (let x = (row % 2) * q; x < s; x += q * 2) ctx.fillRect(x, y, q, q);
	} else if (color === 4) {
		ctx.lineWidth = 2 * k;
		for (let r = 4 * k; r < s * 0.75; r += 5 * k) {
			ctx.beginPath();
			ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2);
			ctx.stroke();
		}
	}
	ctx.globalAlpha = 1;
}

/** Symbols: a solid triangle, circle, diamond, square or plus. */
function drawSymbol(ctx, color, s, mark) {
	const c = s / 2;
	const r = s * 0.21;
	ctx.fillStyle = mark;
	ctx.beginPath();
	switch (color) {
		case 0:
			ctx.moveTo(c, c - r * 1.05);
			ctx.lineTo(c + r * 1.1, c + r * 0.85);
			ctx.lineTo(c - r * 1.1, c + r * 0.85);
			break;
		case 1:
			ctx.arc(c, c, r, 0, Math.PI * 2);
			break;
		case 2:
			ctx.moveTo(c, c - r * 1.2);
			ctx.lineTo(c + r * 1.2, c);
			ctx.lineTo(c, c + r * 1.2);
			ctx.lineTo(c - r * 1.2, c);
			break;
		case 3:
			ctx.rect(c - r * 0.9, c - r * 0.9, r * 1.8, r * 1.8);
			break;
		default: {
			const t = r * 0.42;
			ctx.rect(c - r * 1.1, c - t, r * 2.2, t * 2);
			ctx.rect(c - t, c - r * 1.1, t * 2, r * 2.2);
		}
	}
	ctx.closePath();
	ctx.fill();
}

const PIPS = [
	[[0, 0]],
	[[-1, -1], [1, 1]],
	[[-1, -1], [0, 0], [1, 1]],
	[[-1, -1], [1, -1], [-1, 1], [1, 1]],
	[[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
];

/** Dice pips: Ember 1 dot up to Dusk 5 dots. */
function drawPips(ctx, color, s, mark) {
	const d = s * 0.22;
	ctx.fillStyle = mark;
	for (const [px, py] of PIPS[color]) {
		ctx.beginPath();
		ctx.arc(s / 2 + px * d, s / 2 + py * d, s * 0.075, 0, Math.PI * 2);
		ctx.fill();
	}
}

/** Faces: grumpy, happy, sleepy, surprised, wink. A blink closes each open eye. */
function drawFace(ctx, color, s, mark, blink) {
	const c = s / 2;
	const ex = s * 0.17; // eye distance from the middle
	const ey = c - s * 0.06;
	ctx.fillStyle = mark;
	ctx.strokeStyle = mark;
	ctx.lineWidth = s * 0.055;
	ctx.lineCap = 'round';
	const dot = (x, r) => {
		ctx.beginPath();
		ctx.arc(x, ey, r, 0, Math.PI * 2);
		ctx.fill();
	};
	const shut = (x, w = s * 0.07) => {
		ctx.beginPath();
		ctx.moveTo(x - w, ey);
		ctx.lineTo(x + w, ey);
		ctx.stroke();
	};
	const eye = (x, r) => (blink ? shut(x) : dot(x, r));
	const line = (x1, y1, x2, y2) => {
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	};
	const my = c + s * 0.17;
	switch (color) {
		case 0: // grumpy: slanted brows, flat mouth
			eye(c - ex, s * 0.05);
			eye(c + ex, s * 0.05);
			line(c - ex - s * 0.08, ey - s * 0.14, c - ex + s * 0.07, ey - s * 0.07);
			line(c + ex + s * 0.08, ey - s * 0.14, c + ex - s * 0.07, ey - s * 0.07);
			line(c - s * 0.1, my, c + s * 0.1, my);
			break;
		case 1: // happy: round eyes, smile
			eye(c - ex, s * 0.06);
			eye(c + ex, s * 0.06);
			ctx.beginPath();
			ctx.arc(c, my - s * 0.07, s * 0.13, Math.PI * 0.15, Math.PI * 0.85);
			ctx.stroke();
			break;
		case 2: // sleepy: closed eyes, small round mouth
			for (const x of [c - ex, c + ex]) {
				ctx.beginPath();
				ctx.arc(x, ey - s * 0.02, s * 0.065, Math.PI * 0.1, Math.PI * 0.9);
				ctx.stroke();
			}
			ctx.beginPath();
			ctx.arc(c, my, s * 0.045, 0, Math.PI * 2);
			ctx.stroke();
			break;
		case 3: // surprised: big eyes, round open mouth
			eye(c - ex, s * 0.085);
			eye(c + ex, s * 0.085);
			ctx.beginPath();
			ctx.ellipse(c, my + s * 0.01, s * 0.07, s * 0.09, 0, 0, Math.PI * 2);
			ctx.fill();
			break;
		default: // wink: one eye open, one closed, half smile
			eye(c - ex, s * 0.06);
			shut(c + ex);
			ctx.beginPath();
			ctx.arc(c - s * 0.02, my - s * 0.08, s * 0.13, Math.PI * 0.1, Math.PI * 0.6);
			ctx.stroke();
	}
	ctx.lineCap = 'butt';
}

/**
 * Draws one block of a style into a square of size s at (0, 0).
 * theme gives the ink; the block color comes from PALETTE unless base is given.
 */
export function drawBlock(ctx, { style, color, s, theme, blink = false, base = PALETTE[color].base }) {
	const lw = Math.max(1, s * 0.0625); // 2.5px at a 40px block
	const gap = s * 0.05;
	const box = s - gap * 2;
	const mark = textOn(base);
	ctx.save();
	if (style === 'silhouettes') {
		silhouettePath(ctx, color, gap + lw / 2, gap + lw / 2, box - lw);
		ctx.fillStyle = base;
		ctx.fill();
		ctx.lineJoin = 'round';
		ctx.lineWidth = lw;
		ctx.strokeStyle = theme.blockInk;
		ctx.stroke();
		ctx.restore();
		return;
	}
	const r = Math.min(theme.r, 6) * (s / 40);
	roundRect(ctx, gap + lw / 2, gap + lw / 2, box - lw, box - lw, r);
	ctx.fillStyle = base;
	ctx.fill();
	ctx.save();
	ctx.clip();
	if (style === 'patterns') drawPattern(ctx, color, s, theme.blockInk);
	ctx.restore();
	if (style === 'symbols') drawSymbol(ctx, color, s, mark);
	if (style === 'pips') drawPips(ctx, color, s, mark);
	if (style === 'faces') drawFace(ctx, color, s, mark, blink);
	roundRect(ctx, gap + lw / 2, gap + lw / 2, box - lw, box - lw, r);
	ctx.lineWidth = lw;
	ctx.strokeStyle = theme.blockInk;
	ctx.stroke();
	ctx.restore();
}

function makeCanvas(px) {
	const c = document.createElement('canvas');
	c.width = c.height = Math.max(1, Math.round(px));
	return c;
}

/** Builds every block image for one cell size in device pixels. Faces also get a blink image. */
export function buildSprites(px, { style, theme }) {
	const out = { px, style, theme, plain: [], blink: [], slot: null };
	PALETTE.forEach((_, color) => {
		const c = makeCanvas(px);
		drawBlock(c.getContext('2d'), { style, color, s: px, theme });
		out.plain[color] = c;
		if (style === 'faces') {
			const b = makeCanvas(px);
			drawBlock(b.getContext('2d'), { style, color, s: px, theme, blink: true });
			out.blink[color] = b;
		}
	});
	const slot = makeCanvas(px);
	const sctx = slot.getContext('2d');
	sctx.fillStyle = theme.empty;
	roundRect(sctx, px * 0.05, px * 0.05, px * 0.9, px * 0.9, Math.min(theme.r, 6) * (px / 40));
	sctx.fill();
	out.slot = slot;
	return out;
}

/** A small canvas with a row of blocks, for the shop, the tutorial and the shape lab. */
export function blockStrip({ style, theme, size = 26, colors = [0, 1, 2, 3, 4], dpr = 2 }) {
	const c = document.createElement('canvas');
	c.width = Math.round(size * colors.length * dpr);
	c.height = Math.round(size * dpr);
	c.style.width = `${size * colors.length}px`;
	c.style.height = `${size}px`;
	const ctx = c.getContext('2d');
	colors.forEach((color, i) => {
		ctx.save();
		ctx.translate(i * size * dpr, 0);
		drawBlock(ctx, { style, color, s: size * dpr, theme, base: theme.blocks[color] });
		ctx.restore();
	});
	return c;
}
