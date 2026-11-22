// A piece in the tray: { id, cells: [{ dx, dy, color }], w, h }.
// dx counts columns to the right and dy counts rows down from the top left of the piece.
// Pieces never turn, and they move as one rigid shape.

/** The width and height of a piece, in cells. */
export function pieceSize(cells) {
	let w = 0;
	let h = 0;
	for (const cell of cells) {
		w = Math.max(w, cell.dx + 1);
		h = Math.max(h, cell.dy + 1);
	}
	return { w, h };
}

/** The same piece with every block in one color (what a Prism does). It keeps the old id. */
export function paintedPiece(piece, color) {
	return { ...piece, cells: piece.cells.map((cell) => ({ ...cell, color })) };
}

/** The cells of a piece, grouped by column, top cell first (it lands against the ceiling first). */
export function cellsByColumn(piece) {
	const columns = new Map();
	for (const cell of piece.cells) {
		if (!columns.has(cell.dx)) columns.set(cell.dx, []);
		columns.get(cell.dx).push(cell);
	}
	for (const cells of columns.values()) cells.sort((a, b) => a.dy - b.dy);
	return columns;
}

/**
 * Where each cell of the piece comes to rest if dropped at column x. The piece rises as one rigid
 * shape until the top block of some column touches that column's stack (or the ceiling).
 * Blocks that rest with a gap above them rise to close it when the board settles.
 * Returns [{ cell, x, y }].
 */
export function restingCells(game, piece, x) {
	const columns = cellsByColumn(piece);
	let pieceTop = 0;
	for (const [dx, cells] of columns) {
		const stackHeight = game.height(x + dx);
		pieceTop = Math.max(pieceTop, stackHeight - cells[0].dy);
	}
	const resting = [];
	for (const [dx, cells] of columns) {
		for (const cell of cells) resting.push({ cell, x: x + dx, y: pieceTop + cell.dy });
	}
	return resting;
}
