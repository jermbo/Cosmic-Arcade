// The list of shapes a piece can take, and how often each one shows up.
// A shape is a list of [dx, dy] cells: dx counts columns to the right, dy counts rows down.

import { SHAPE_ART } from './shape-art.js';

export const MAX_SHAPE_WIDTH = 5;
const MIN_SHAPE_BLOCKS = 2;
const MIN_WEIGHT = 1;
const MAX_WEIGHT = 9;

/** Turns ASCII rows such as ['##', '#.'] into a list of [dx, dy] cells. '#' is a block. */
export function parseArt(rows) {
	const cells = [];
	rows.forEach((row, dy) => {
		[...row].forEach((character, dx) => {
			if (character === '#') cells.push([dx, dy]);
		});
	});
	return cells;
}

/** Checks a list of { weight, art } and returns the usable ones. Bad items are dropped, not guessed. */
export function cleanShapes(list) {
	const usable = [];
	for (const item of Array.isArray(list) ? list : []) {
		if (!isShapeItem(item)) continue;
		const cells = parseArt(item.art);
		const width = cells.reduce((widest, [dx]) => Math.max(widest, dx + 1), 0);
		if (cells.length < MIN_SHAPE_BLOCKS || width > MAX_SHAPE_WIDTH) continue;
		usable.push({ weight: cleanWeight(item.weight), art: item.art.slice() });
	}
	return usable;
}

function isShapeItem(item) {
	return Boolean(item) && Array.isArray(item.art) && item.art.every((row) => typeof row === 'string');
}

/** A weight is a whole number from 1 to 9. A missing weight counts as 1. */
function cleanWeight(weight) {
	const whole = Math.round(Number(weight)) || MIN_WEIGHT;
	return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, whole));
}

// The live shape list. setShapes() swaps it (the shape lab saves its own list in the browser).
export let SHAPES = [];
let shapeWeights = [];
let totalWeight = 0;

/** Uses a new list of { weight, art }. Returns false, and changes nothing, when no shape in it is usable. */
export function setShapes(list) {
	const shapes = cleanShapes(list);
	if (!shapes.length) return false;
	SHAPES = shapes.map(({ art }) => parseArt(art));
	shapeWeights = shapes.map(({ weight }) => weight);
	totalWeight = shapeWeights.reduce((sum, weight) => sum + weight, 0);
	return true;
}
setShapes(SHAPE_ART);

/**
 * Picks the index of a shape. roll is a number from 0 up to (not including) 1.
 * A banned shape is never picked, unless it is the only one.
 */
export function pickShape(roll, banned = null) {
	const skipped = banned !== null && SHAPES.length > 1 ? banned : null;
	const skippedWeight = skipped !== null ? shapeWeights[skipped] : 0;
	let weightLeft = roll * (totalWeight - skippedWeight);
	let picked = 0;
	for (let index = 0; index < SHAPES.length; index++) {
		if (index === skipped) continue;
		picked = index;
		if (weightLeft < shapeWeights[index]) break;
		weightLeft -= shapeWeights[index];
	}
	return picked;
}
