// The editor grid of the shape lab: press or drag squares to add and remove blocks.

import { capturePointer } from '../../app/dom.js';
import { parseArt, MAX_SHAPE_WIDTH } from '../../rules/shapes/shape-list.js';
import { $ } from '../lab-page.js';
import { artFromCells } from './shape-geometry.js';
import { currentShape, colorAt } from './shape-lab-state.js';

export const GRID_WIDTH = MAX_SHAPE_WIDTH;
const GRID_HEIGHT = 6;
const squares = [];
let painting = null; // while a finger is down: { fill: true } adds blocks, { fill: false } removes them
let onEdit = () => {};

/** Builds the grid. edited() runs after each change to the shape. */
export function buildEditor(edited) {
	onEdit = edited;
	const editor = $('editor');
	editor.style.gridTemplateColumns = `repeat(${GRID_WIDTH}, var(--cell))`;
	for (let y = 0; y < GRID_HEIGHT; y++) {
		for (let x = 0; x < GRID_WIDTH; x++) editor.append(makeSquare(x, y));
	}
	editor.addEventListener('pointerdown', (event) => {
		const square = event.target.closest('.cell');
		if (!square) return;
		event.preventDefault();
		painting = { fill: !isOn(square) };
		setSquare(square, painting.fill);
		capturePointer(editor, event.pointerId);
	});
	editor.addEventListener('pointermove', (event) => {
		if (!painting) return;
		const under = document.elementFromPoint(event.clientX, event.clientY);
		const square = under && under.closest && under.closest('.cell');
		if (square && squares.includes(square)) setSquare(square, painting.fill);
	});
	const stopPainting = () => (painting = null);
	editor.addEventListener('pointerup', stopPainting);
	editor.addEventListener('pointercancel', stopPainting);
	editor.addEventListener('keydown', (event) => {
		const square = event.target.closest('.cell');
		if (!square || (event.key !== 'Enter' && event.key !== ' ')) return;
		event.preventDefault();
		setSquare(square, !isOn(square));
	});
}

function makeSquare(x, y) {
	const square = document.createElement('div');
	square.className = 'cell';
	square.dataset.x = x;
	square.dataset.y = y;
	square.tabIndex = 0;
	square.setAttribute('role', 'button');
	square.setAttribute('aria-pressed', 'false');
	square.setAttribute('aria-label', `Row ${y + 1}, column ${x + 1}`);
	squares.push(square);
	return square;
}

const isOn = (square) => square.classList.contains('on');

/** The filled squares as a list of [x, y]. */
function readGrid() {
	return squares.filter(isOn).map((square) => [Number(square.dataset.x), Number(square.dataset.y)]);
}

function setSquare(square, on) {
	if (isOn(square) === on) return;
	square.classList.toggle('on', on);
	paintSquare(square);
	currentShape().art = artFromCells(readGrid());
	onEdit();
}

/** A filled square shows a block in its color. */
function paintSquare(square) {
	const on = isOn(square);
	square.setAttribute('aria-pressed', String(on));
	for (let color = 0; color < 5; color++) square.classList.remove(`c${color}`);
	square.classList.remove('blk');
	if (on) square.classList.add('blk', `c${colorAt(Number(square.dataset.x), Number(square.dataset.y))}`);
}

/** Shows a shape on the grid. */
export function loadGrid(art) {
	const filled = new Set(parseArt(art).map(([x, y]) => `${x},${y}`));
	for (const square of squares) {
		square.classList.toggle('on', filled.has(`${square.dataset.x},${square.dataset.y}`));
		paintSquare(square);
	}
}
