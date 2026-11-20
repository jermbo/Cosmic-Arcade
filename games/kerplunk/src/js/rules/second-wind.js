// The second wind: when no piece fits, the player can pay once per game to clear the bottom rows
// of the stack (the rows farthest from the ceiling) and keep going.

export const SECOND_WIND_ROWS = 4;

/** True when the player may still buy the second wind this game: once per game, and the well has blocks. */
export function canSecondWind(game) {
	return !game.secondWindUsed && game.grid.some(Boolean);
}

/** Clears the bottom SECOND_WIND_ROWS rows of the stack. Returns the cleared cells, or null when it cannot be used. */
export function useSecondWind(game) {
	if (!canSecondWind(game)) return null;
	const lowestRow = lowestFilledRow(game);
	const cleared = [];
	game.grid.forEach((block, idx) => {
		const y = game.rowOf(idx);
		if (block && y > lowestRow - SECOND_WIND_ROWS) cleared.push({ idx, x: game.columnOf(idx), y, block });
	});
	for (const cell of cleared) game.grid[cell.idx] = null;
	game.secondWindUsed = true;
	game.tick++;
	return cleared;
}

function lowestFilledRow(game) {
	let lowest = 0;
	game.grid.forEach((block, index) => {
		if (block) lowest = Math.max(lowest, game.rowOf(index));
	});
	return lowest;
}
