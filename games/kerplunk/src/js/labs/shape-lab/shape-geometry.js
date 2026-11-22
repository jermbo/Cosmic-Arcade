// Shape math for the shape lab. A shape is a list of [x, y] cells, or ASCII art rows such as ['##', '#.'].

import { parseArt } from '../../rules/shapes/shape-list.js';

const widthOf = (cells) => Math.max(...cells.map(([x]) => x)) + 1;
const heightOf = (cells) => Math.max(...cells.map(([, y]) => y)) + 1;

/** Moves a list of cells to the top left corner. */
export function normalize(cells) {
	if (!cells.length) return [];
	const minX = Math.min(...cells.map(([x]) => x));
	const minY = Math.min(...cells.map(([, y]) => y));
	return cells.map(([x, y]) => [x - minX, y - minY]);
}

/** ASCII art rows for a list of cells. */
export function artFromCells(cells) {
	const flat = normalize(cells);
	if (!flat.length) return [];
	const rows = Array.from({ length: heightOf(flat) }, () => new Array(widthOf(flat)).fill('.'));
	for (const [x, y] of flat) rows[y][x] = '#';
	return rows.map((row) => row.join(''));
}

/** A key that is the same for two arts of the same shape. */
export const shapeKey = (art) => JSON.stringify(artFromCells(parseArt(art)));

/** A quarter turn clockwise. */
export function turnCells(cells) {
	const height = heightOf(cells);
	return cells.map(([x, y]) => [height - 1 - y, x]);
}

/** A mirror image, left to right. */
export function flipAcross(cells) {
	const width = widthOf(cells);
	return cells.map(([x, y]) => [width - 1 - x, y]);
}

/** Upside down. */
export function flipUpsideDown(cells) {
	const height = heightOf(cells);
	return cells.map(([x, y]) => [x, height - 1 - y]);
}

export function cellsWidth(cells) {
	return cells.length ? widthOf(cells) : 0;
}

/**
 * What the lab tells you about a shape: how many blocks, its size, whether every block touches
 * another (connected), and whether a column has a gap inside it (columnHole).
 */
export function inspect(art) {
	const cells = parseArt(art);
	if (!cells.length) return { count: 0, w: 0, h: 0, connected: true, columnHole: false };
	return { count: cells.length, w: widthOf(cells), h: heightOf(cells), connected: isConnected(cells), columnHole: hasColumnHole(cells) };
}

function isConnected(cells) {
	const filled = new Set(cells.map(([x, y]) => `${x},${y}`));
	const reached = new Set([`${cells[0][0]},${cells[0][1]}`]);
	const toVisit = [cells[0]];
	while (toVisit.length) {
		const [x, y] = toVisit.pop();
		for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
			const key = `${nextX},${nextY}`;
			if (!filled.has(key) || reached.has(key)) continue;
			reached.add(key);
			toVisit.push([nextX, nextY]);
		}
	}
	return reached.size === filled.size;
}

function hasColumnHole(cells) {
	for (let x = 0; x < widthOf(cells); x++) {
		const rows = cells
			.filter(([cellX]) => cellX === x)
			.map(([, y]) => y)
			.sort((a, b) => a - b);
		if (rows.length && rows[rows.length - 1] - rows[0] + 1 !== rows.length) return true;
	}
	return false;
}
