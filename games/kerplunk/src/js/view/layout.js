// Where everything goes on the screen: the well, the power-up bar and the tray.
// From top to bottom: the well, the power-up bar, then the tray with one slot for each piece.
// All sizes are in CSS pixels, and most are counted in cells (the size of one block).

const PAGE_PADDING = 14;
const MAX_CELL = 66;
const MIN_CELL = 12;
const TRAY_SCALE = 0.62; // a tray piece is at least this much of a well block
const BAR_SPACE = 0.95; // the room for the power-up bar, in cells
const NO_BAR_SPACE = 0.3; // Timed has no power-up bar, so the well gets its room
const WELL_MARGIN = 0.4; // cells of room around the well
const WELL_TO_TRAY = 0.45; // cells between the well and the tray
const TRAY_PIECE_ROWS = 3; // the tray has room for a piece 3 blocks tall
const TRAY_PADDING = 0.6; // cells of room around a tray piece

/**
 * The layout for a screen of `width` × `height`.
 * Returns { cell, boardX, boardY, boardW, boardH, bar, slots, trayCell }.
 */
export function computeLayout({ width, height, cols, rows, slotCount, autoPowers }) {
	const barSpace = autoPowers ? NO_BAR_SPACE : BAR_SPACE;
	const trayRows = TRAY_SCALE * TRAY_PIECE_ROWS + TRAY_PADDING;
	const cellByWidth = (width - PAGE_PADDING * 2) / (cols + WELL_MARGIN);
	const cellByHeight = (height - PAGE_PADDING * 2) / (rows + WELL_MARGIN + WELL_TO_TRAY + trayRows + barSpace);
	const cell = Math.max(MIN_CELL, Math.floor(Math.min(cellByWidth, cellByHeight, MAX_CELL)));

	const boardW = cell * cols;
	const boardH = cell * rows;
	const trayH = cell * trayRows;
	const gap = cell * WELL_TO_TRAY;
	const totalH = boardH + cell * WELL_MARGIN + gap + trayH + cell * barSpace;
	const spareH = Math.max(0, height - PAGE_PADDING * 2 - totalH);
	const boardX = Math.round((width - boardW) / 2);
	// A little of the spare height goes above the well, so it does not stick to the top.
	const boardY = Math.round(PAGE_PADDING + cell * 0.2 + spareH * 0.35);

	// The power-up bar sits between the well and the tray.
	const bar = { x: boardX, y: boardY + boardH + cell * 0.35, w: boardW, h: cell * 0.8 };
	const tray = trayLayout({ width, height, cell, boardW, slotCount, trayH, top: boardY + boardH + cell * 0.2 + gap + cell * barSpace });
	return { cell, boardX, boardY, boardW, boardH, bar, ...tray };
}

/** The tray slots, side by side. Spare height makes the tray pieces bigger: they are easier to grab. */
function trayLayout({ width, height, cell, boardW, slotCount, trayH, top }) {
	const trayW = Math.min(width - PAGE_PADDING * 2, Math.max(boardW + cell, cell * 3.6 * slotCount));
	const trayX = (width - trayW) / 2;
	const slotW = trayW / slotCount;
	const roomH = height - PAGE_PADDING - top;
	const trayCell = Math.max(cell * TRAY_SCALE, Math.min(cell * 0.85, slotW / 3.7, (roomH - cell * TRAY_PADDING) / TRAY_PIECE_ROWS));
	const usedH = Math.min(roomH, trayCell * TRAY_PIECE_ROWS + cell * TRAY_PADDING);
	const slots = [];
	for (let i = 0; i < slotCount; i++) slots.push({ x: trayX + i * slotW, y: top, w: slotW, h: Math.max(trayH, usedH) });
	return { slots, trayCell };
}
