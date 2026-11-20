// The drop test of the shape lab: a random board where you can drop the shape and see where it rests.
// It uses the real engine, so a shape behaves here as it does in the game.

import { Game } from '../../rules/game.js';
import { parseArt } from '../../rules/shapes/shape-list.js';
import { $ } from '../lab-page.js';
import { currentShape, colorAt } from './shape-lab-state.js';

const SETTLE_DELAY_MS = 650; // the rigid landing shows this long before loose blocks rise

const test = { game: null, hover: -1, busy: false };
const slots = [];

/** The current shape as a tray piece, or null when it has no blocks. */
function pieceFrom(art) {
	const cells = parseArt(art).map(([dx, dy]) => ({ dx, dy, color: colorAt(dx, dy) }));
	if (!cells.length) return null;
	return { id: 1, cells, w: Math.max(...cells.map((cell) => cell.dx)) + 1, h: Math.max(...cells.map((cell) => cell.dy)) + 1 };
}

/** A new random board. mode 'full' fills almost every column. */
export function newStacks(mode) {
	const game = new Game({ lab: { grid: 'medium' }, seed: Date.now() });
	game.grid.fill(null);
	const maxHeight = Math.max(0, Math.min(game.rows, Number($('maxFill').value) || 0));
	for (let x = 0; x < game.cols; x++) {
		let height = Math.floor(Math.random() * (maxHeight + 1));
		if (mode === 'full') height = Math.max(0, game.rows - 1 - Math.floor(Math.random() * 2));
		for (let y = 0; y < height; y++) game.grid[game.index(x, y)] = game.makeBlock((x * 3 + y * 2 + Math.floor(Math.random() * 5)) % 5);
	}
	Object.assign(test, { game, hover: -1, busy: false });
	buildWell();
	renderTest();
}

function buildWell() {
	const { game } = test;
	const well = $('well');
	well.textContent = '';
	slots.length = 0;
	well.style.gridTemplateColumns = `repeat(${game.cols}, calc(var(--cell) * 0.82))`;
	for (let y = 0; y < game.rows; y++) {
		for (let x = 0; x < game.cols; x++) {
			const slot = document.createElement('div');
			slot.className = 'slot';
			slot.dataset.x = x;
			slots.push(slot);
			well.append(slot);
		}
	}
}

/** The column the piece would drop in when you point at column x: the piece is centered on it. */
function dropColumn(piece, x) {
	return Math.max(0, Math.min(test.game.cols - piece.w, x - Math.floor((piece.w - 1) / 2)));
}

/** Shows the board, the ghost of the shape under the pointer, and a hint. */
export function renderTest() {
	const { game } = test;
	if (!game) return;
	const piece = pieceFrom(currentShape().art);
	const hint = $('testHint');
	hint.className = 'hint';
	const ghost = new Set();
	let noFitColumns = null;
	if (piece && test.hover >= 0) {
		const col = dropColumn(piece, test.hover);
		if (game.fits(piece, col)) {
			for (const rest of game.landing(piece, col)) ghost.add(game.index(rest.x, rest.y));
			hint.textContent = 'Click to drop it.';
		} else {
			noFitColumns = { from: col, to: col + piece.w };
			hint.className = 'hint bad';
			hint.textContent = 'Does not fit here: the whole shape needs room at once.';
		}
	} else if (piece) {
		hint.textContent = `Fits in ${countSpots(game, piece)} of ${game.cols - piece.w + 1} spots on this board.`;
	} else {
		hint.textContent = 'Draw a shape to test it.';
	}
	slots.forEach((slot, index) => {
		const block = game.grid[index];
		const x = game.columnOf(index);
		slot.className = 'slot';
		if (block) slot.classList.add('blk', `c${block.color}`);
		if (ghost.has(index)) slot.classList.add('ghost');
		if (noFitColumns && x >= noFitColumns.from && x < noFitColumns.to) slot.classList.add('nofit');
	});
}

function countSpots(game, piece) {
	let spots = 0;
	for (let x = 0; x <= game.cols - piece.w; x++) if (game.fits(piece, x)) spots++;
	return spots;
}

/** The column of the well slot under the pointer, or -1. */
function columnUnder(event) {
	const under = document.elementFromPoint(event.clientX, event.clientY);
	return under && under.classList && under.classList.contains('slot') ? Number(under.dataset.x) : -1;
}

export function setupWell() {
	const well = $('well');
	well.addEventListener('pointermove', (event) => {
		if (test.busy) return;
		const x = columnUnder(event);
		if (x === test.hover) return;
		test.hover = x;
		renderTest();
	});
	well.addEventListener('pointerleave', () => {
		test.hover = -1;
		renderTest();
	});
	well.addEventListener('click', (event) => {
		if (test.busy) return;
		const x = columnUnder(event);
		const piece = pieceFrom(currentShape().art);
		if (x < 0 || !piece) return;
		dropShape(piece, dropColumn(piece, x));
	});
}

/** Drops the shape: it rests as drawn, then a moment later the loose blocks rise. */
function dropShape(piece, col) {
	const { game } = test;
	if (!game.fits(piece, col)) return;
	test.busy = true;
	test.hover = -1;
	game.pieces[0] = piece;
	game.placeRigid(0, col, piece);
	$('testHint').textContent = 'The shape rests as drawn...';
	renderTest();
	setTimeout(() => {
		const moved = game.settle().length;
		$('testHint').textContent = moved ? 'Then the loose blocks rise to close the gaps.' : 'Nothing was loose. Drop another.';
		test.busy = false;
		renderTest();
	}, SETTLE_DELAY_MS);
}
