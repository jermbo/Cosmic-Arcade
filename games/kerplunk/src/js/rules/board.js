// The well as a grid: which cells touch, which blocks link into groups, and how loose blocks rise.
// Each function takes the game (anything with grid, cols, rows and the cell helpers of Game).
//
// The grid is one flat list of cells: index = row * cols + column. Row 0 is the ceiling.
// A cell holds a block { id, color, kind, stamp } or null when it is empty.

import { MIN_GROUP_SIZE } from './scoring.js';

/** The cells that touch a cell side to side. Diagonals do not count. */
export function neighborsOf(game, index) {
	const x = game.columnOf(index);
	const y = game.rowOf(index);
	const neighbors = [];
	if (x > 0) neighbors.push(index - 1);
	if (x < game.cols - 1) neighbors.push(index + 1);
	if (y > 0) neighbors.push(index - game.cols);
	if (y < game.rows - 1) neighbors.push(index + game.cols);
	return neighbors;
}

/**
 * Every cell linked to `start`, side to side, through cells where belongs(index) is true.
 * The start cell is always in the set. The set keeps the order the cells were found in.
 */
export function floodFill(game, start, belongs) {
	const linked = new Set([start]);
	const toVisit = [start];
	while (toVisit.length) {
		const index = toVisit.pop();
		for (const next of neighborsOf(game, index)) {
			if (linked.has(next) || !belongs(next)) continue;
			linked.add(next);
			toVisit.push(next);
		}
	}
	return linked;
}

/** Finds the groups of MIN_GROUP_SIZE or more blocks of one color that touch side to side. */
export function findGroups(game) {
	const { grid } = game;
	const inAGroup = new Uint8Array(grid.length);
	const groups = [];
	for (let start = 0; start < grid.length; start++) {
		const first = grid[start];
		if (!first || inAGroup[start]) continue;
		const sameColor = (index) => Boolean(grid[index]) && grid[index].color === first.color;
		const cells = floodFill(game, start, sameColor);
		for (const index of cells) inAGroup[index] = 1;
		if (cells.size >= MIN_GROUP_SIZE) groups.push({ cells, color: first.color });
	}
	return groups;
}

/**
 * Lifts every block up to the free cell nearest the ceiling in its column.
 * Returns the moves: [{ block, x, fromY, toY }].
 */
export function liftLooseBlocks(game) {
	const moves = [];
	for (let x = 0; x < game.cols; x++) {
		let nextFreeRow = 0;
		for (let y = 0; y < game.rows; y++) {
			const block = game.get(x, y);
			if (!block) continue;
			if (nextFreeRow !== y) {
				game.grid[game.index(x, nextFreeRow)] = block;
				game.grid[game.index(x, y)] = null;
				block.stamp = game.tick;
				moves.push({ block, x, fromY: y, toY: nextFreeRow });
			}
			nextFreeRow++;
		}
	}
	return moves;
}
