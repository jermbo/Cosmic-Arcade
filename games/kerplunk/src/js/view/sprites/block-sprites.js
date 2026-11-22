// Block images. Each block is drawn once per size, theme and block style, so each frame only
// copies images (drawing images is much faster than drawing shapes).

import { BLOCK_NAMES, LIGHT, textOn } from '../../looks/themes.js';
import { roundRect } from '../canvas-shapes.js';
import { drawPattern, drawSymbol, drawPips, drawFace, silhouettePath } from './block-marks.js';

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

const BASE_SIZE = 40; // the outline and corner numbers were set for a 40px block
const MAX_BLOCK_CORNER = 6;

/**
 * Draws one block of a style into a square of `size` pixels at (0, 0).
 * theme gives the ink. The block color comes from PALETTE unless base is given.
 */
export function drawBlock(ctx, { style, color, size, theme, blink = false, base = PALETTE[color].base }) {
	const outline = Math.max(1, size * 0.0625); // 2.5px at a 40px block
	const gap = size * 0.05; // the space between two blocks
	const box = size - gap * 2;
	const inset = gap + outline / 2;
	ctx.save();
	if (style === 'silhouettes') {
		drawSilhouette(ctx, { color, inset, box, outline, base, theme });
		ctx.restore();
		return;
	}
	const corner = blockCorner(theme, size);
	roundRect(ctx, inset, inset, box - outline, box - outline, corner);
	ctx.fillStyle = base;
	ctx.fill();
	if (style === 'patterns') {
		ctx.save();
		ctx.clip();
		drawPattern(ctx, color, size, theme.blockInk);
		ctx.restore();
	}
	const markColor = textOn(base);
	if (style === 'symbols') drawSymbol(ctx, color, size, markColor);
	if (style === 'pips') drawPips(ctx, color, size, markColor);
	if (style === 'faces') drawFace(ctx, color, size, markColor, blink);
	roundRect(ctx, inset, inset, box - outline, box - outline, corner);
	ctx.lineWidth = outline;
	ctx.strokeStyle = theme.blockInk;
	ctx.stroke();
	ctx.restore();
}

function drawSilhouette(ctx, { color, inset, box, outline, base, theme }) {
	silhouettePath(ctx, color, inset, inset, box - outline);
	ctx.fillStyle = base;
	ctx.fill();
	ctx.lineJoin = 'round';
	ctx.lineWidth = outline;
	ctx.strokeStyle = theme.blockInk;
	ctx.stroke();
}

/** Blocks follow the theme's corners, but never rounder than 6px at 40px. */
function blockCorner(theme, size) {
	return Math.min(theme.cornerRadius, MAX_BLOCK_CORNER) * (size / BASE_SIZE);
}

function makeCanvas(size) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = Math.max(1, Math.round(size));
	return canvas;
}

/**
 * Builds every block image for one cell size in device pixels: { px, plain, blink, slot }.
 * plain[color] is a block, blink[color] the same face with its eyes shut (faces only), slot an empty cell.
 */
export function buildSprites(px, { style, theme }) {
	const sprites = { px, style, theme, plain: [], blink: [], slot: null };
	PALETTE.forEach((_, color) => {
		sprites.plain[color] = blockImage(px, { style, color, theme });
		if (style === 'faces') sprites.blink[color] = blockImage(px, { style, color, theme, blink: true });
	});
	sprites.slot = emptySlotImage(px, theme);
	return sprites;
}

function blockImage(px, options) {
	const canvas = makeCanvas(px);
	drawBlock(canvas.getContext('2d'), { ...options, size: px });
	return canvas;
}

function emptySlotImage(px, theme) {
	const canvas = makeCanvas(px);
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = theme.empty;
	roundRect(ctx, px * 0.05, px * 0.05, px * 0.9, px * 0.9, blockCorner(theme, px));
	ctx.fill();
	return canvas;
}

/** A small canvas with a row of blocks, for the shop. */
export function blockStrip({ style, theme, size = 26, colors = [0, 1, 2, 3, 4], pixelRatio = 2 }) {
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(size * colors.length * pixelRatio);
	canvas.height = Math.round(size * pixelRatio);
	canvas.style.width = `${size * colors.length}px`;
	canvas.style.height = `${size}px`;
	const ctx = canvas.getContext('2d');
	colors.forEach((color, i) => {
		ctx.save();
		ctx.translate(i * size * pixelRatio, 0);
		drawBlock(ctx, { style, color, size: size * pixelRatio, theme, base: theme.blocks[color] });
		ctx.restore();
	});
	return canvas;
}
