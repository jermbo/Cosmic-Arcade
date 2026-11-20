// The secret shape lab: draw the pieces, see how likely they are, and test how they drop.
// Open labs/shape-lab.html (or tap the version number on the title screen 7 times).
// "Save to game" keeps the list in this browser, and the game reads it when it starts.

import { parseArt, cleanShapes } from '../../rules/shapes/shape-list.js';
import { SHAPE_ART } from '../../rules/shapes/shape-art.js';
import { saveCustomShapes, clearCustomShapes, store } from '../../app/storage.js';
import { drawBlock, BLOCK_STYLES } from '../../view/sprites/block-sprites.js';
import { $, toast, copyText, wearGameTheme } from '../lab-page.js';
import { normalize, artFromCells, shapeKey, turnCells, flipAcross, flipUpsideDown, inspect, cellsWidth } from './shape-geometry.js';
import { lab, currentShape, colorAt, totalWeight, chanceOf, hasChanges, copyShapes } from './shape-lab-state.js';
import { buildEditor, loadGrid, GRID_WIDTH } from './editor-grid.js';
import { newStacks, renderTest, setupWell } from './drop-test.js';

const BLOCK_IMAGE_PX = 64;
const SHAPE_FILE = '../js/rules/shapes/shape-art.js';

// ---- the look ----

/** The lab wears the theme and the block style of the game: each block color is an image in a CSS variable. */
function showLooks() {
	const theme = wearGameTheme();
	const style = BLOCK_STYLES.includes(store.looks.style) ? store.looks.style : 'patterns';
	theme.blocks.forEach((base, color) => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = BLOCK_IMAGE_PX;
		drawBlock(canvas.getContext('2d'), { style, color, size: BLOCK_IMAGE_PX, theme, base });
		document.documentElement.style.setProperty(`--blk-c${color}`, `url(${canvas.toDataURL()})`);
	});
}

// ---- the list of shapes ----

/** A tiny picture of a shape, made of blocks. */
function thumb(art) {
	const cells = parseArt(art);
	const picture = document.createElement('div');
	picture.className = 'thumb';
	if (!cells.length) return picture;
	const width = Math.max(...cells.map(([x]) => x)) + 1;
	const height = Math.max(...cells.map(([, y]) => y)) + 1;
	picture.style.gridTemplateColumns = `repeat(${width}, 11px)`;
	const colors = new Map(cells.map(([x, y]) => [`${x},${y}`, colorAt(x, y)]));
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const square = document.createElement('i');
			const color = colors.get(`${x},${y}`);
			square.className = color === undefined ? 'e' : `blk c${color}`;
			picture.append(square);
		}
	}
	return picture;
}

function renderList() {
	$('count').textContent = lab.shapes.length;
	const list = $('list');
	list.textContent = '';
	lab.shapes.forEach((shape, index) => list.append(shapeCard(shape, index)));
	$('dirty').hidden = !hasChanges();
}

function shapeCard(shape, index) {
	const card = document.createElement('div');
	const { count } = inspect(shape.art);
	card.className = `card${index === lab.selected ? ' on' : ''}${count < 2 ? ' bad' : ''}`;
	card.tabIndex = 0;
	card.setAttribute('role', 'button');
	card.setAttribute('aria-label', `Shape ${index + 1}, ${count} blocks, ${chanceOf(shape).replace('%', ' percent')}`);
	const note = document.createElement('small');
	note.textContent = `${count} · ${chanceOf(shape)}`;
	card.append(thumb(shape.art), note);
	card.addEventListener('click', () => selectShape(index));
	card.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		selectShape(index);
	});
	return card;
}

// ---- stats and warnings ----

function renderInfo() {
	const shape = currentShape();
	const info = inspect(shape.art);
	const total = totalWeight();
	$('weight').value = shape.weight;
	$('weightNum').textContent = shape.weight;
	$('stats').innerHTML = info.count
		? `<b>${info.count}</b> blocks · <b>${info.w}</b> wide × <b>${info.h}</b> tall<br />Shows up <b>${chanceOf(shape)}</b> of the time (weight ${shape.weight} of ${total})`
		: 'Press squares to add blocks.';
	renderWarnings(shape, info);
}

function renderWarnings(shape, info) {
	const warnings = $('warn');
	warnings.textContent = '';
	const add = (className, text) => {
		const item = document.createElement('li');
		item.className = className;
		item.textContent = text;
		warnings.append(item);
	};
	if (info.count < 2) add('bad', 'A shape needs at least 2 blocks. It is skipped when you save.');
	if (info.count >= 2 && !info.connected) add('note', 'The blocks do not all touch. They still travel as one rigid shape.');
	if (info.columnHole) add('note', 'A column has a gap inside it. The blocks rest as drawn, then rise together to close the gap.');
	const twin = lab.shapes.findIndex((other, i) => i !== lab.selected && info.count && shapeKey(other.art) === shapeKey(shape.art));
	if (twin >= 0) add('bad', `Same as shape ${twin + 1}. Delete one, or raise its weight instead.`);
	if (info.count >= 2 && info.connected && !info.columnHole && twin < 0) add('ok', 'Looks good.');
}

function renderAfterEdit() {
	renderList();
	renderInfo();
	renderTest();
}

function selectShape(index) {
	lab.selected = Math.max(0, Math.min(lab.shapes.length - 1, index));
	loadGrid(currentShape().art);
	renderAfterEdit();
}

// ---- editing ----

function replaceCurrent(cells) {
	currentShape().art = artFromCells(cells);
	loadGrid(currentShape().art);
	renderAfterEdit();
}

function addShape(art, weight) {
	lab.shapes.splice(lab.selected + 1, 0, { weight, art });
	selectShape(lab.selected + 1);
}

const currentCells = () => parseArt(currentShape().art);

function turnShape() {
	const cells = currentCells();
	if (!cells.length) return;
	const turned = normalize(turnCells(cells));
	if (cellsWidth(turned) > GRID_WIDTH) return toast(`Too wide to turn: shapes can be ${GRID_WIDTH} wide at most.`);
	replaceCurrent(turned);
}

/** Adds the three other turns of the shape after it, if they are not in the list already. */
function addTurns() {
	let cells = currentCells();
	if (!cells.length) return;
	const known = new Set(lab.shapes.map((shape) => shapeKey(shape.art)));
	let added = 0;
	for (let turn = 0; turn < 3; turn++) {
		cells = normalize(turnCells(cells));
		const art = artFromCells(cells);
		if (cellsWidth(cells) > GRID_WIDTH || known.has(shapeKey(art))) continue;
		known.add(shapeKey(art));
		lab.shapes.splice(lab.selected + 1 + added, 0, { weight: currentShape().weight, art });
		added++;
	}
	renderAfterEdit();
	toast(added ? `Added ${added} turned shape${added > 1 ? 's' : ''} after this one.` : 'Every turn is already in the list.');
}

function addMirror() {
	const cells = currentCells();
	if (!cells.length) return;
	const art = artFromCells(flipAcross(cells));
	if (lab.shapes.some((shape) => shapeKey(shape.art) === shapeKey(art))) return toast('The mirror image is already in the list.');
	addShape(art, currentShape().weight);
}

function deleteShape() {
	if (lab.shapes.length <= 1) return toast('Keep at least one shape.');
	if (!window.confirm('Delete this shape?')) return;
	lab.shapes.splice(lab.selected, 1);
	selectShape(Math.min(lab.selected, lab.shapes.length - 1));
}

function newColors() {
	lab.colorSeed = (lab.colorSeed + 1 + Math.floor(Math.random() * 4)) % 50;
	loadGrid(currentShape().art);
	renderAfterEdit();
}

// ---- saving and exporting ----

function saveToGame() {
	const clean = cleanShapes(lab.shapes);
	if (!clean.length) return toast('Nothing to save: draw at least one shape with 2 or more blocks.');
	const skipped = lab.shapes.length - clean.length;
	if (!saveCustomShapes(clean)) return toast('Could not save. This browser is blocking site storage.');
	lab.baseline = JSON.stringify(lab.shapes);
	renderList();
	toast(`Saved ${clean.length} shapes${skipped ? ` (${skipped} skipped)` : ''}. Reload the game to play with them.`);
}

function backToBuiltIn() {
	if (!window.confirm('Go back to the built-in shapes? Your saved list is removed.')) return;
	clearCustomShapes();
	lab.shapes = copyShapes(SHAPE_ART);
	lab.baseline = JSON.stringify(lab.shapes);
	selectShape(0);
	toast('Back to the built-in shapes.');
}

/** The SHAPE_ART list as code. */
function codeText() {
	const lines = lab.shapes.map((shape) => `\t{ weight: ${shape.weight}, art: [${shape.art.map((row) => `'${row}'`).join(', ')}] },`).join('\n');
	return `export const SHAPE_ART = [\n${lines}\n];\n`;
}

/** The whole shape-art.js file with the new list in it, or just the list when the file cannot be read. */
async function fileText() {
	const list = codeText();
	try {
		const response = await fetch(SHAPE_FILE, { cache: 'no-store' });
		if (response.ok) {
			const text = await response.text();
			const replaced = text.replace(/export const SHAPE_ART = \[[\s\S]*?\n\];\n?/, list);
			if (replaced !== text || text.includes(list)) return replaced;
		}
	} catch {
		// Opened from a file or offline: fall back to the list alone.
	}
	return list;
}

async function copyCode() {
	const text = await fileText();
	$('code').value = text;
	$('exportPanel').hidden = false;
	if (await copyText(text)) {
		toast('Copied. Paste it over src/js/rules/shapes/shape-art.js.');
		return;
	}
	$('code').select();
	toast('Select the text below and copy it.');
}

async function downloadCode() {
	const text = await fileText();
	const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = 'shape-art.js';
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- start ----

function setup() {
	buildEditor(renderAfterEdit);
	setupWell();
	$('weight').addEventListener('input', (event) => {
		currentShape().weight = Number(event.target.value);
		renderAfterEdit();
	});
	$('add').addEventListener('click', () => addShape(['##'], 2));
	$('dup').addEventListener('click', () => addShape(currentShape().art.slice(), currentShape().weight));
	$('del').addEventListener('click', deleteShape);
	$('clear').addEventListener('click', () => replaceCurrent([]));
	$('flipH').addEventListener('click', () => currentCells().length && replaceCurrent(flipAcross(currentCells())));
	$('flipV').addEventListener('click', () => currentCells().length && replaceCurrent(flipUpsideDown(currentCells())));
	$('turn').addEventListener('click', turnShape);
	$('addTurns').addEventListener('click', addTurns);
	$('addMirror').addEventListener('click', addMirror);
	$('colors').addEventListener('click', newColors);
	$('save').addEventListener('click', saveToGame);
	$('reset').addEventListener('click', backToBuiltIn);
	$('copy').addEventListener('click', copyCode);
	$('download').addEventListener('click', downloadCode);
	$('stacks').addEventListener('click', () => newStacks());
	$('fullRow').addEventListener('click', () => newStacks('full'));
	$('maxFill').addEventListener('change', () => newStacks());
	window.addEventListener('beforeunload', (event) => {
		if (hasChanges()) event.preventDefault();
	});
	selectShape(0);
	newStacks();
}

showLooks();
setup();
