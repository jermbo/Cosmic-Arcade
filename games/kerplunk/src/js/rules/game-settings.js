// The size of the well, the number of tray pieces, and how many colors are in play.

export const GRID_SIZES = {
	small: { cols: 6, rows: 8 },
	medium: { cols: 7, rows: 9 },
	large: { cols: 8, rows: 10 },
};

// "The Lab" is the part of the settings screen with options to try: the well size and the tray size.
export const DEFAULT_LAB = {
	grid: 'medium',
	pieces: 2,
};

export const MAX_COLORS = 5;
const START_COLORS = 4;
const FIFTH_COLOR_TURN = 20; // in Endless, the fifth color joins at this turn

/** How many colors are in play after a number of turns. Timed always has four. */
export function colorsForTurn(mode, turn) {
	if (mode === 'timed') return START_COLORS;
	return turn < FIFTH_COLOR_TURN ? START_COLORS : MAX_COLORS;
}
