// The list of shapes a piece can take, and how often each shows up.

import { SHAPE_ART } from './shapes.js';

/** Turns ASCII rows into a list of [dx, dy]. */
export function parseArt(rows) {
	const out = [];
	rows.forEach((row, dy) => [...row].forEach((ch, dx) => ch === '#' && out.push([dx, dy])));
	return out;
}

export const MAX_SHAPE_WIDTH = 5;

/** Checks a list of { weight, art } and returns the usable ones. */
export function cleanShapes(list) {
	const out = [];
	for (const item of Array.isArray(list) ? list : []) {
		if (!item || !Array.isArray(item.art) || !item.art.every((row) => typeof row === 'string')) continue;
		const cells = parseArt(item.art);
		const width = cells.reduce((w, [dx]) => Math.max(w, dx + 1), 0);
		if (cells.length < 2 || width > MAX_SHAPE_WIDTH) continue;
		out.push({ weight: Math.min(9, Math.max(1, Math.round(Number(item.weight)) || 1)), art: item.art.slice() });
	}
	return out;
}

// The live shape list. setShapes() swaps it (the shape lab saves its own list in the browser).
export let SHAPES = [];
let SHAPE_WEIGHTS = [];
let WEIGHT_TOTAL = 0;

export function setShapes(list) {
	const shapes = cleanShapes(list);
	if (!shapes.length) return false;
	SHAPES = shapes.map(({ art }) => parseArt(art));
	SHAPE_WEIGHTS = shapes.map(({ weight }) => weight);
	WEIGHT_TOTAL = SHAPE_WEIGHTS.reduce((a, b) => a + b, 0);
	return true;
}
setShapes(SHAPE_ART);

/**
 * Picks the index of a shape. roll is a number from 0 up to (not including) 1.
 * A banned shape is never picked, unless it is the only one.
 */
export function pickShape(roll, banned = null) {
	const skip = banned !== null && SHAPES.length > 1 ? banned : null;
	let left = roll * (WEIGHT_TOTAL - (skip !== null ? SHAPE_WEIGHTS[skip] : 0));
	let pick = 0;
	for (let i = 0; i < SHAPES.length; i++) {
		if (i === skip) continue;
		pick = i;
		if (left < SHAPE_WEIGHTS[i]) break;
		left -= SHAPE_WEIGHTS[i];
	}
	return pick;
}
