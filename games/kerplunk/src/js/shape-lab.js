// The secret shape lab: draw the pieces, see how likely they are, and test how they drop.
// Open shape-lab.html (or tap the version number on the title screen 7 times).
// "Save to game" keeps the list in this browser, and the game reads it when it starts.

import { Game } from './engine.js';
import { capturePointer } from './dom.js';
import { parseArt, cleanShapes, MAX_SHAPE_WIDTH } from './shape-list.js';
import { SHAPE_ART } from './shapes.js';
import { loadCustomShapes, saveCustomShapes, clearCustomShapes } from './storage.js';

const GRID_W = MAX_SHAPE_WIDTH;
const GRID_H = 6;
const $ = (id) => document.getElementById(id);
const clone = (list) => list.map(({ weight, art }) => ({ weight, art: art.slice() }));

// ---- shape helpers ----

/** Moves a list of [dx, dy] to the top left corner. */
function normalize(cells) {
	if (!cells.length) return [];
	const minX = Math.min(...cells.map(([x]) => x));
	const minY = Math.min(...cells.map(([, y]) => y));
	return cells.map(([x, y]) => [x - minX, y - minY]);
}

function artFromCells(cells) {
	const flat = normalize(cells);
	if (!flat.length) return [];
	const w = Math.max(...flat.map(([x]) => x)) + 1;
	const h = Math.max(...flat.map(([, y]) => y)) + 1;
	const rows = Array.from({ length: h }, () => new Array(w).fill('.'));
	for (const [x, y] of flat) rows[y][x] = '#';
	return rows.map((r) => r.join(''));
}

const key = (art) => JSON.stringify(artFromCells(parseArt(art)));
const turnCells = (cells) => {
	const h = Math.max(...cells.map(([, y]) => y)) + 1;
	return cells.map(([x, y]) => [h - 1 - y, x]);
};
const flipHCells = (cells) => {
	const w = Math.max(...cells.map(([x]) => x)) + 1;
	return cells.map(([x, y]) => [w - 1 - x, y]);
};
const flipVCells = (cells) => {
	const h = Math.max(...cells.map(([, y]) => y)) + 1;
	return cells.map(([x, y]) => [x, h - 1 - y]);
};

function inspect(art) {
	const cells = parseArt(art);
	if (!cells.length) return { count: 0, w: 0, h: 0, connected: true, columnHole: false };
	const w = Math.max(...cells.map(([x]) => x)) + 1;
	const h = Math.max(...cells.map(([, y]) => y)) + 1;
	const set = new Set(cells.map(([x, y]) => `${x},${y}`));
	const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
	const stack = [cells[0]];
	while (stack.length) {
		const [x, y] = stack.pop();
		for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
			const k = `${nx},${ny}`;
			if (set.has(k) && !seen.has(k)) {
				seen.add(k);
				stack.push([nx, ny]);
			}
		}
	}
	let columnHole = false;
	for (let x = 0; x < w; x++) {
		const ys = cells.filter(([cx]) => cx === x).map(([, y]) => y).sort((a, b) => a - b);
		if (ys.length && ys[ys.length - 1] - ys[0] + 1 !== ys.length) columnHole = true;
	}
	return { count: cells.length, w, h, connected: seen.size === set.size, columnHole };
}

// ---- state ----

const saved = loadCustomShapes();
let shapes = cleanShapes(saved);
if (!shapes.length) shapes = clone(SHAPE_ART);
let baseline = JSON.stringify(cleanShapes(saved).length ? cleanShapes(saved) : SHAPE_ART);
let selected = 0;
let colorSeed = 3;
let toastTimer = 0;
let drag = null; // { paint: true | false }

const current = () => shapes[selected];
const colorAt = (x, y) => (x * 7 + y * 13 + colorSeed) % 5;

function toast(text) {
	const el = $('toast');
	el.textContent = text;
	el.hidden = false;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

// ---- shape list ----

function thumb(art) {
	const cells = parseArt(art);
	const el = document.createElement('div');
	el.className = 'thumb';
	if (!cells.length) return el;
	const w = Math.max(...cells.map(([x]) => x)) + 1;
	const h = Math.max(...cells.map(([, y]) => y)) + 1;
	el.style.gridTemplateColumns = `repeat(${w}, 11px)`;
	const on = new Map(cells.map(([x, y]) => [`${x},${y}`, colorAt(x, y)]));
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = document.createElement('i');
			const c = on.get(`${x},${y}`);
			i.className = c === undefined ? 'e' : `blk c${c}`;
			el.append(i);
		}
	}
	return el;
}

function renderList() {
	const total = shapes.reduce((sum, s) => sum + s.weight, 0);
	$('count').textContent = shapes.length;
	const list = $('list');
	list.textContent = '';
	shapes.forEach((s, i) => {
		const card = document.createElement('div');
		const stats = inspect(s.art);
		card.className = `card${i === selected ? ' on' : ''}${stats.count < 2 ? ' bad' : ''}`;
		card.tabIndex = 0;
		card.setAttribute('role', 'button');
		card.setAttribute('aria-label', `Shape ${i + 1}, ${stats.count} blocks, ${((s.weight / total) * 100).toFixed(1)} percent`);
		card.append(thumb(s.art));
		const small = document.createElement('small');
		small.textContent = `${stats.count} · ${((s.weight / total) * 100).toFixed(1)}%`;
		card.append(small);
		const select = () => selectShape(i);
		card.addEventListener('click', select);
		card.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				select();
			}
		});
		list.append(card);
	});
	const dirty = JSON.stringify(shapes) !== baseline;
	$('dirty').hidden = !dirty;
}

// ---- editor grid ----

const cellEls = [];
function buildEditor() {
	const ed = $('editor');
	ed.style.gridTemplateColumns = `repeat(${GRID_W}, var(--cell))`;
	for (let y = 0; y < GRID_H; y++) {
		for (let x = 0; x < GRID_W; x++) {
			const c = document.createElement('div');
			c.className = 'cell';
			c.dataset.x = x;
			c.dataset.y = y;
			c.tabIndex = 0;
			c.setAttribute('role', 'button');
			c.setAttribute('aria-pressed', 'false');
			c.setAttribute('aria-label', `Row ${y + 1}, column ${x + 1}`);
			cellEls.push(c);
			ed.append(c);
		}
	}
	ed.addEventListener('pointerdown', (e) => {
		const c = e.target.closest('.cell');
		if (!c) return;
		e.preventDefault();
		drag = { paint: !c.classList.contains('on') };
		setCell(c, drag.paint);
		capturePointer(ed, e.pointerId);
	});
	ed.addEventListener('pointermove', (e) => {
		if (!drag) return;
		const el = document.elementFromPoint(e.clientX, e.clientY);
		const c = el && el.closest && el.closest('.cell');
		if (c && cellEls.includes(c)) setCell(c, drag.paint);
	});
	const stop = () => {
		drag = null;
	};
	ed.addEventListener('pointerup', stop);
	ed.addEventListener('pointercancel', stop);
	ed.addEventListener('keydown', (e) => {
		const c = e.target.closest('.cell');
		if (!c || (e.key !== 'Enter' && e.key !== ' ')) return;
		e.preventDefault();
		setCell(c, !c.classList.contains('on'));
	});
}

function readGrid() {
	const cells = [];
	for (const c of cellEls) if (c.classList.contains('on')) cells.push([Number(c.dataset.x), Number(c.dataset.y)]);
	return cells;
}

function setCell(c, on) {
	if (c.classList.contains('on') === on) return;
	c.classList.toggle('on', on);
	paintCell(c);
	current().art = artFromCells(readGrid());
	renderAfterEdit();
}

function paintCell(c) {
	const on = c.classList.contains('on');
	c.setAttribute('aria-pressed', String(on));
	for (let i = 0; i < 5; i++) c.classList.remove(`c${i}`);
	c.classList.remove('blk');
	if (on) c.classList.add('blk', `c${colorAt(Number(c.dataset.x), Number(c.dataset.y))}`);
}

function loadGrid(art) {
	const cells = new Set(parseArt(art).map(([x, y]) => `${x},${y}`));
	for (const c of cellEls) {
		c.classList.toggle('on', cells.has(`${c.dataset.x},${c.dataset.y}`));
		paintCell(c);
	}
}

// ---- stats and warnings ----

function renderInfo() {
	const s = current();
	const info = inspect(s.art);
	const total = shapes.reduce((sum, item) => sum + item.weight, 0);
	$('weight').value = s.weight;
	$('weightNum').textContent = s.weight;
	$('stats').innerHTML = info.count
		? `<b>${info.count}</b> blocks · <b>${info.w}</b> wide × <b>${info.h}</b> tall<br />Shows up <b>${((s.weight / total) * 100).toFixed(1)}%</b> of the time (weight ${s.weight} of ${total})`
		: 'Press squares to add blocks.';
	const warn = $('warn');
	warn.textContent = '';
	const add = (cls, text) => {
		const li = document.createElement('li');
		li.className = cls;
		li.textContent = text;
		warn.append(li);
	};
	if (info.count < 2) add('bad', 'A shape needs at least 2 blocks. It is skipped when you save.');
	if (info.count >= 2 && !info.connected) add('note', 'The blocks do not all touch. They still travel as one rigid shape.');
	if (info.columnHole) add('note', 'A column has a gap inside it. The blocks rest as drawn, then rise together to close the gap.');
	const twin = shapes.findIndex((o, i) => i !== selected && info.count && key(o.art) === key(s.art));
	if (twin >= 0) add('bad', `Same as shape ${twin + 1}. Delete one, or raise its weight instead.`);
	if (info.count >= 2 && info.connected && !info.columnHole && twin < 0) add('ok', 'Looks good.');
}

function renderAfterEdit() {
	renderList();
	renderInfo();
	renderTest();
}

function selectShape(i) {
	selected = Math.max(0, Math.min(shapes.length - 1, i));
	loadGrid(current().art);
	renderAfterEdit();
}

// ---- drop test ----

const test = { game: null, hover: -1, busy: false };

function pieceFrom(art) {
	const cells = parseArt(art).map(([dx, dy]) => ({ dx, dy, color: colorAt(dx, dy) }));
	if (!cells.length) return null;
	return { id: 1, cells, w: Math.max(...cells.map((c) => c.dx)) + 1, h: Math.max(...cells.map((c) => c.dy)) + 1 };
}

function newStacks(mode) {
	const g = new Game({ lab: { grid: 'medium' }, seed: Date.now() });
	g.grid.fill(null);
	const max = Math.max(0, Math.min(g.rows, Number($('maxFill').value) || 0));
	for (let x = 0; x < g.cols; x++) {
		let h = Math.floor(Math.random() * (max + 1));
		if (mode === 'full') h = Math.max(0, g.rows - 1 - Math.floor(Math.random() * 2));
		for (let y = 0; y < h; y++) g.grid[g.index(x, y)] = g.makeBlock((x * 3 + y * 2 + Math.floor(Math.random() * 5)) % 5);
	}
	test.game = g;
	test.hover = -1;
	test.busy = false;
	buildWell();
	renderTest();
}

const slotEls = [];
function buildWell() {
	const g = test.game;
	const well = $('well');
	well.textContent = '';
	slotEls.length = 0;
	well.style.gridTemplateColumns = `repeat(${g.cols}, calc(var(--cell) * 0.82))`;
	for (let y = 0; y < g.rows; y++) {
		for (let x = 0; x < g.cols; x++) {
			const s = document.createElement('div');
			s.className = 'slot';
			s.dataset.x = x;
			slotEls.push(s);
			well.append(s);
		}
	}
}

/** The column the piece would drop in when you point at column x. */
function dropColumn(piece, x) {
	return Math.max(0, Math.min(test.game.cols - piece.w, x - Math.floor((piece.w - 1) / 2)));
}

function renderTest() {
	const g = test.game;
	if (!g) return;
	const piece = pieceFrom(current().art);
	const hint = $('testHint');
	hint.className = 'hint';
	const ghost = new Set();
	let bad = false;
	let col = -1;
	if (piece && test.hover >= 0) {
		col = dropColumn(piece, test.hover);
		const fits = g.fits(piece, col);
		if (fits) {
			for (const l of g.landing(piece, col)) ghost.add(g.index(l.x, l.y));
			hint.textContent = 'Click to drop it.';
		} else {
			bad = true;
			hint.className = 'hint bad';
			hint.textContent = 'Does not fit here: the whole shape needs room at once.';
		}
	} else if (piece) {
		let spots = 0;
		for (let x = 0; x <= g.cols - piece.w; x++) if (g.fits(piece, x)) spots++;
		hint.textContent = `Fits in ${spots} of ${g.cols - piece.w + 1} spots on this board.`;
	} else {
		hint.textContent = 'Draw a shape to test it.';
	}
	slotEls.forEach((s, i) => {
		const b = g.grid[i];
		const x = g.columnOf(i);
		s.className = 'slot';
		if (b) s.classList.add('blk', `c${b.color}`);
		if (ghost.has(i)) s.classList.add('ghost');
		if (bad && piece && x >= col && x < col + piece.w) s.classList.add('nofit');
	});
}

function wellPoint(e) {
	const el = document.elementFromPoint(e.clientX, e.clientY);
	return el && el.classList && el.classList.contains('slot') ? Number(el.dataset.x) : -1;
}

function setupWell() {
	const well = $('well');
	well.addEventListener('pointermove', (e) => {
		if (test.busy) return;
		const x = wellPoint(e);
		if (x !== test.hover) {
			test.hover = x;
			renderTest();
		}
	});
	well.addEventListener('pointerleave', () => {
		test.hover = -1;
		renderTest();
	});
	well.addEventListener('click', (e) => {
		if (test.busy) return;
		const x = wellPoint(e);
		const piece = pieceFrom(current().art);
		if (x < 0 || !piece) return;
		const col = dropColumn(piece, x);
		const g = test.game;
		if (!g.fits(piece, col)) return;
		test.busy = true;
		test.hover = -1;
		g.pieces[0] = piece;
		g.placeRigid(0, col, piece);
		$('testHint').textContent = 'The shape rests as drawn...';
		renderTest();
		setTimeout(() => {
			const moved = g.settle().length;
			$('testHint').textContent = moved ? 'Then the loose blocks rise to close the gaps.' : 'Nothing was loose. Drop another.';
			test.busy = false;
			renderTest();
		}, 650);
	});
}

// ---- actions ----

function replaceCurrent(cells) {
	current().art = artFromCells(cells);
	loadGrid(current().art);
	renderAfterEdit();
}

function addShape(art, weight) {
	shapes.splice(selected + 1, 0, { weight, art });
	selectShape(selected + 1);
}

function codeText() {
	const body = shapes.map((s) => `\t{ weight: ${s.weight}, art: [${s.art.map((r) => `'${r}'`).join(', ')}] },`).join('\n');
	return `export const SHAPE_ART = [\n${body}\n];\n`;
}

async function fileText() {
	const list = codeText();
	try {
		const res = await fetch('js/shapes.js', { cache: 'no-store' });
		if (res.ok) {
			const text = await res.text();
			const next = text.replace(/export const SHAPE_ART = \[[\s\S]*?\n\];\n?/, list);
			if (next !== text || text.includes(list)) return next;
		}
	} catch {
		// Opened from a file or offline: fall back to the list alone.
	}
	return list;
}

function setup() {
	buildEditor();
	setupWell();
	$('weight').addEventListener('input', (e) => {
		current().weight = Number(e.target.value);
		renderAfterEdit();
	});
	$('add').addEventListener('click', () => addShape(['##'], 2));
	$('dup').addEventListener('click', () => addShape(current().art.slice(), current().weight));
	$('del').addEventListener('click', () => {
		if (shapes.length <= 1) return toast('Keep at least one shape.');
		if (!window.confirm('Delete this shape?')) return;
		shapes.splice(selected, 1);
		selectShape(Math.min(selected, shapes.length - 1));
	});
	$('clear').addEventListener('click', () => replaceCurrent([]));
	const cellsNow = () => parseArt(current().art);
	$('flipH').addEventListener('click', () => cellsNow().length && replaceCurrent(flipHCells(cellsNow())));
	$('flipV').addEventListener('click', () => cellsNow().length && replaceCurrent(flipVCells(cellsNow())));
	$('turn').addEventListener('click', () => {
		const cells = cellsNow();
		if (!cells.length) return;
		const turned = normalize(turnCells(cells));
		const w = Math.max(...turned.map(([x]) => x)) + 1;
		if (w > GRID_W) return toast(`Too wide to turn: shapes can be ${GRID_W} wide at most.`);
		replaceCurrent(turned);
	});
	$('addTurns').addEventListener('click', () => {
		let cells = cellsNow();
		if (!cells.length) return;
		const known = new Set(shapes.map((s) => key(s.art)));
		let added = 0;
		for (let i = 0; i < 3; i++) {
			cells = normalize(turnCells(cells));
			const art = artFromCells(cells);
			const w = Math.max(...cells.map(([x]) => x)) + 1;
			if (w > GRID_W || known.has(key(art))) continue;
			known.add(key(art));
			shapes.splice(selected + 1 + added, 0, { weight: current().weight, art });
			added++;
		}
		renderAfterEdit();
		toast(added ? `Added ${added} turned shape${added > 1 ? 's' : ''} after this one.` : 'Every turn is already in the list.');
	});
	$('addMirror').addEventListener('click', () => {
		const cells = cellsNow();
		if (!cells.length) return;
		const art = artFromCells(flipHCells(cells));
		if (shapes.some((s) => key(s.art) === key(art))) return toast('The mirror image is already in the list.');
		addShape(art, current().weight);
	});
	$('colors').addEventListener('click', () => {
		colorSeed = (colorSeed + 1 + Math.floor(Math.random() * 4)) % 50;
		loadGrid(current().art);
		renderAfterEdit();
	});
	$('save').addEventListener('click', () => {
		const clean = cleanShapes(shapes);
		if (!clean.length) return toast('Nothing to save: draw at least one shape with 2 or more blocks.');
		const skipped = shapes.length - clean.length;
		if (!saveCustomShapes(clean)) return toast('Could not save. This browser is blocking site storage.');
		baseline = JSON.stringify(shapes);
		renderList();
		toast(`Saved ${clean.length} shapes${skipped ? ` (${skipped} skipped)` : ''}. Reload the game to play with them.`);
	});
	$('reset').addEventListener('click', () => {
		if (!window.confirm('Go back to the built-in shapes? Your saved list is removed.')) return;
		clearCustomShapes();
		shapes = clone(SHAPE_ART);
		baseline = JSON.stringify(shapes);
		selectShape(0);
		toast('Back to the built-in shapes.');
	});
	$('copy').addEventListener('click', async () => {
		const text = await fileText();
		$('code').value = text;
		$('exportPanel').hidden = false;
		try {
			await navigator.clipboard.writeText(text);
			toast('Copied. Paste it over src/js/shapes.js.');
		} catch {
			$('code').select();
			toast('Select the text below and copy it.');
		}
	});
	$('download').addEventListener('click', async () => {
		const text = await fileText();
		const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = 'shapes.js';
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	});
	$('stacks').addEventListener('click', () => newStacks());
	$('fullRow').addEventListener('click', () => newStacks('full'));
	$('maxFill').addEventListener('change', () => newStacks());
	window.addEventListener('beforeunload', (e) => {
		if (JSON.stringify(shapes) !== baseline) e.preventDefault();
	});
	selectShape(0);
	newStacks();
}

setup();
