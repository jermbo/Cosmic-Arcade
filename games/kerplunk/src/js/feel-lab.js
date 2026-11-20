// The secret Feel Lab: play a moment of the game again and again, and tune how it moves and sounds.
// Open feel-lab.html (there is a link in the shape lab). "Save to game" keeps the feel in this browser.
// The stage uses the real view, engine and juice of the game, so what you see here is what you get.

import { Game } from './engine.js';
import { View } from './view.js';
import { audio } from './audio.js';
import { makeJuice } from './juice.js';
import { store } from './storage.js';
import { themeFor } from './themes.js';
import { writeVariables } from './theme-vars.js';
import { paintPalette, BLOCK_STYLES } from './sprites.js';
import { tuning, DEFAULT_TUNING, setTuning, resetTuning, tuningDiff, saveTuning, clearSavedTuning } from './tuning.js';
import { startScope } from './sound-scope.js';
import { MOTION_GROUPS, SOUND_GROUPS, SOUND_LIST, MOTION_PRESETS, SOUND_PRESETS, SCENES } from './feel-lab-knobs.js';

const $ = (id) => document.getElementById(id);
const copy = (value) => JSON.parse(JSON.stringify(value));
const SPEEDS = [
	[1, '1×'],
	[0.5, '½×'],
	[0.25, '¼×'],
];
const STYLE_NAMES = { patterns: 'Patterns', symbols: 'Symbols', pips: 'Dice pips', silhouettes: 'Silhouettes', faces: 'Faces' };
const START_BELOW_WELL = 0.4; // where a dropped piece starts, as in the game
const PAUSE_BEFORE = 0.45; // seconds of stillness before the moment plays
const PAUSE_AFTER = 0.9; // and after, before a loop plays it again

// ---- the stage ----

const canvas = $('stage');
const view = new View(canvas);
const juice = makeJuice({ view, banner: showBanner });

const lab = {
	scene: 'clear',
	loop: true,
	speed: 1,
	run: 0, // each play gets a number; an older play stops when a new one starts
	busy: false,
	clock: 0,
	style: BLOCK_STYLES.includes(store.looks.style) ? store.looks.style : 'patterns',
	boards: {}, // a board found for each scene, so a loop plays the same moment
	compare: { motion: null, sound: null }, // your values, kept while you hear the built-in ones
	saved: JSON.stringify(tuningDiff()),
};

function showLooks() {
	const theme = themeFor(store.looks);
	writeVariables(theme);
	paintPalette(theme.blocks);
	view.setLooks(theme, lab.style);
	if (document.fonts) for (const font of [`20px '${theme.display}'`, "500 20px 'DM Mono'"]) document.fonts.load(font).catch(() => {});
}

const waiters = [];
const waitFor = (test) => new Promise((resolve) => waiters.push({ test, resolve }));
const waitTime = (seconds) => {
	const until = lab.clock + seconds;
	return waitFor(() => lab.clock >= until);
};

let last = performance.now();
function frame(now) {
	const dt = Math.min(0.05, (now - last) / 1000) * lab.speed;
	last = now;
	lab.clock += dt;
	view.update(dt);
	for (let i = waiters.length - 1; i >= 0; i--) {
		if (waiters[i].test()) waiters.splice(i, 1)[0].resolve();
	}
	view.draw();
	requestAnimationFrame(frame);
}

let bannerTimer = 0;
function showBanner(text, ms) {
	const b = $('banner');
	b.textContent = text;
	b.hidden = false;
	b.style.animation = 'none';
	void b.offsetWidth;
	b.style.animation = '';
	clearTimeout(bannerTimer);
	bannerTimer = setTimeout(() => (b.hidden = true), ms / lab.speed);
}

// ---- boards ----

/** Fills the well to about `fill` with blocks that make no match. */
function fillWell(g, fill) {
	const heights = Array.from({ length: g.cols }, () => 0);
	const target = Math.round(g.cols * g.rows * fill);
	const colorAt = (i) => (g.grid[i] ? g.grid[i].color : null);
	for (let n = 0; n < target; n++) {
		const open = heights.map((h, x) => (h < g.rows - 2 ? x : -1)).filter((x) => x >= 0);
		if (!open.length) break;
		const x = open[Math.floor(Math.random() * open.length)];
		const y = heights[x]++;
		const colors = [...Array(g.colors).keys()].sort(() => Math.random() - 0.5);
		const color = colors.find((c) => g.linkedSize(colorAt, { x, y }, c) < 3) ?? colors[0];
		g.grid[g.index(x, y)] = g.makeBlock(color);
	}
}

const WANTS = {
	drop: (steps) => steps.length === 0,
	clear: (steps) => steps.length === 1 && steps[0].biggest <= 4,
	chain: (steps) => steps.length >= 3,
	big: (steps) => steps.length >= 1 && steps[0].biggest >= 6,
};

/** Looks for a board and a drop that make the scene: no clear, one clear, a chain or a big group. */
function findBoard(scene) {
	const want = WANTS[scene];
	const started = performance.now();
	let fallback = null;
	for (let tries = 0; performance.now() - started < 1500; tries++) {
		const g = new Game({ seed: (Math.random() * 2 ** 31) | 0 });
		fillWell(g, 0.3 + Math.random() * 0.3);
		const pieces = [g.pieces[0], g.pieces[1], g.makePiece(), g.makePiece(), g.makePiece()];
		for (const piece of pieces) {
			for (let x = 0; x <= g.cols - piece.w; x++) {
				if (!g.fits(piece, x)) continue;
				const test = g.clone();
				test.place(0, x, piece);
				const steps = test.resolveAll();
				const board = { colors: g.grid.map((b) => (b ? b.color : null)), piece, other: g.pieces[1] === piece ? g.pieces[0] : g.pieces[1], x };
				if (want(steps)) return board;
				if (scene === 'chain' && steps.length === 2) fallback = board;
			}
		}
	}
	return fallback;
}

/** A game with the colors of a board: blocks sit in their cells, still, ready for the moment. */
function gameFrom(colors, pieces = []) {
	const g = new Game({ seed: 1 });
	g.grid = colors.map((c) => (c === null ? null : g.makeBlock(c)));
	if (pieces.length) g.pieces = pieces.map((p) => ({ ...p, cells: p.cells.map((c) => ({ ...c })) }));
	view.setGame(g);
	g.grid.forEach((b, i) => {
		if (!b) return;
		const v = view.blockVisuals.get(b.id);
		v.y = g.rowOf(i);
		v.delay = 0;
	});
	return g;
}

function randomColors(fill) {
	const g = new Game({ seed: (Math.random() * 2 ** 31) | 0 });
	fillWell(g, fill);
	return g.grid.map((b) => (b ? b.color : null));
}

// ---- scenes ----

/** Runs every chain step until the well is still, like the game does. */
async function resolveChain(g, run) {
	for (let chain = 1; ; chain++) {
		const step = g.resolveStep(chain);
		if (!step || run !== lab.run) return;
		juice.step(step);
		await waitFor(() => view.dying.length === 0);
		view.holdFalls = false;
		await waitFor(() => view.settled);
	}
}

async function playDrop(run) {
	const scene = lab.scene;
	if (!lab.boards[scene]) lab.boards[scene] = findBoard(scene);
	const board = lab.boards[scene];
	if (!board) return toast('Could not find a board for this scene. Try New board.');
	const g = gameFrom(board.colors, [board.piece, board.other]);
	await waitTime(PAUSE_BEFORE);
	if (run !== lab.run) return;
	const placed = g.placeRigid(0, board.x, g.pieces[0]);
	view.dropIn(placed, board.x, g.rows + START_BELOW_WELL);
	await waitFor(() => view.settled);
	if (g.settle().length) await waitFor(() => view.settled);
	if (run !== lab.run) return;
	await resolveChain(g, run);
}

async function playPower(run, kind) {
	if (!lab.boards[kind]) lab.boards[kind] = randomColors(0.6);
	const g = gameFrom(lab.boards[kind]);
	g.bag.push(kind);
	await waitTime(PAUSE_BEFORE);
	if (run !== lab.run) return;
	if (kind === 'blast') {
		const cell = g.bestBlastCell();
		if (cell && g.useBlast(cell.x, cell.y)) await resolveChain(g, run);
	} else {
		const moves = g.useRemix();
		if (!moves) return;
		view.startRemix(moves, tuning.motion.remixStyle);
		await waitFor(() => !view.remix);
		if (run === lab.run) await resolveChain(g, run);
	}
}

async function playEarned(run) {
	if (!lab.boards.earned) lab.boards.earned = randomColors(0.35);
	gameFrom(lab.boards.earned);
	await waitTime(PAUSE_BEFORE);
	if (run !== lab.run) return;
	const { bar } = view;
	view.fx.pop({ x: bar.x + bar.w / 2, y: bar.y - view.cell * 0.4, text: 'Blast!', sub: 'earned', big: true });
	audio.forge('flare');
	view.game.bag.push('blast');
	await waitTime(tuning.motion.stickerTime * 1.36);
}

async function play() {
	audio.unlock();
	const run = ++lab.run;
	lab.busy = true;
	view.fx.clear();
	view.holdFalls = false;
	try {
		do {
			if (lab.scene === 'blast' || lab.scene === 'remix') await playPower(run, lab.scene);
			else if (lab.scene === 'earned') await playEarned(run);
			else await playDrop(run);
			if (run !== lab.run) return;
			await waitTime(PAUSE_AFTER);
		} while (lab.loop && run === lab.run);
	} finally {
		if (run === lab.run) lab.busy = false;
	}
}

/** After a knob changes: play the moment again, unless a loop will show it soon anyway. */
function replaySoon() {
	if (!lab.busy) play();
}

// ---- knobs ----

const isChanged = (part, key) => tuning[part][key] !== DEFAULT_TUNING[part][key];

function format(value, step) {
	if (typeof value !== 'number') return value;
	const places = step >= 1 ? 0 : Math.min(3, String(step).split('.')[1].length);
	return value.toFixed(places);
}

/** One knob: a name, its value (tap it to go back to the built-in value), a slider or a menu, and a hint. */
function knobRow(part, knob, { onChange, target = tuning[part], base = DEFAULT_TUNING[part], id }) {
	const row = document.createElement('div');
	row.className = 'knob';
	const head = document.createElement('div');
	head.className = 'knob-head';
	const label = document.createElement('label');
	label.textContent = knob.label;
	label.htmlFor = id;
	const value = document.createElement('button');
	value.type = 'button';
	value.className = 'knob-value';
	value.title = 'Back to the built-in value';
	head.append(label, value);
	let input;
	if (knob.options) {
		input = document.createElement('select');
		for (const [v, text] of knob.options) input.add(new Option(text, v));
	} else {
		input = document.createElement('input');
		input.type = 'range';
		input.min = knob.min;
		input.max = knob.max;
		input.step = knob.step;
	}
	input.id = id;
	const show = () => {
		const v = target[knob.key];
		input.value = v;
		const changed = v !== base[knob.key];
		value.textContent = knob.options ? (changed ? 'changed' : 'built-in') : format(v, knob.step);
		value.classList.toggle('on', changed);
		input.disabled = Boolean(lab.compare[part]);
	};
	const set = (v, done) => {
		target[knob.key] = v;
		show();
		markDirty();
		if (part === 'sound') audio.applyTuning();
		if (done) onChange?.(knob.key);
	};
	const read = () => (knob.options ? input.value : Number(input.value));
	input.addEventListener('input', () => set(read(), false));
	input.addEventListener('change', () => set(read(), true));
	value.addEventListener('click', () => set(base[knob.key], true));
	row.append(head, input);
	if (knob.hint) {
		const hint = document.createElement('p');
		hint.className = 'knob-hint';
		hint.textContent = knob.hint;
		row.append(hint);
	}
	row.show = show;
	show();
	return row;
}

const rows = { motion: [], sound: [] };

function buildGroups(part, groups, into, onChange) {
	for (const group of groups) {
		const box = document.createElement('details');
		box.className = 'group';
		box.open = true;
		const sum = document.createElement('summary');
		sum.textContent = group.title;
		box.append(sum);
		for (const knob of group.knobs) {
			const row = knobRow(part, knob, { onChange, id: `${part}-${knob.key}` });
			rows[part].push(row);
			box.append(row);
		}
		into.append(box);
	}
}

const PITCH = { key: 'pitch', label: 'Pitch', min: -12, max: 12, step: 1 };
const VOLUME = { key: 'volume', label: 'Volume', min: 0, max: 2, step: 0.05 };
const LENGTH = { key: 'length', label: 'Length', min: 0.25, max: 3, step: 0.05 };

function buildSoundList() {
	const into = $('soundList');
	for (const group of SOUND_LIST) {
		const box = document.createElement('details');
		box.className = 'group';
		const sum = document.createElement('summary');
		sum.textContent = group.title;
		box.append(sum);
		for (const [name, label, playIt] of group.sounds) {
			const card = document.createElement('div');
			card.className = 'sound';
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'sound-play';
			btn.textContent = `▶ ${label}`;
			btn.addEventListener('click', () => {
				audio.unlock();
				playIt(audio);
			});
			card.append(btn);
			const opts = { target: tuning.sound.each[name], base: DEFAULT_TUNING.sound.each[name], onChange: () => playIt(audio) };
			for (const knob of [VOLUME, PITCH, LENGTH]) {
				const row = knobRow('sound', knob, { ...opts, id: `each-${name}-${knob.key}` });
				// The rows keep the object they change, so a preset or a reset (which change it in place) shows at once.
				rows.sound.push(row);
				card.append(row);
			}
			box.append(card);
		}
		into.append(box);
	}
}

// A changed sound knob plays a sound that uses it.
const SOUND_PREVIEW = {
	thudPitch: () => audio.land(2),
	thudLength: () => audio.land(2),
	thudNoise: () => audio.land(2),
	landPlunk: () => audio.land(2),
	landPlunkPitch: () => audio.land(2),
	music: null,
	tempo: null,
	scale: () => chainClimb(4),
	clearRoot: () => chainClimb(3),
	clearStyle: () => chainClimb(3),
	chainStyle: () => chainClimb(5),
	powerStyle: () => audio.flare(),
	smallStyle: () => {
		audio.pick();
		setTimeout(() => audio.deny(), 300);
	},
};

function previewSound(key) {
	if (key in SOUND_PREVIEW) return SOUND_PREVIEW[key]?.();
	audio.clear(2, 4);
}

function chainClimb(steps = 8) {
	audio.unlock();
	for (let chain = 1; chain <= steps; chain++) setTimeout(() => audio.clear(chain, chain > 4 ? 5 : 3), (chain - 1) * 380);
}

function refresh(part) {
	for (const row of rows[part]) row.show();
	if (part === 'sound') audio.applyTuning();
	if (part === 'motion') view.remixStyle = tuning.motion.remixStyle;
	markDirty();
}

function buildPresets(part, presets, into) {
	for (const [name, preset] of Object.entries(presets)) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.textContent = preset.label;
		btn.addEventListener('click', () => {
			endCompare(part);
			resetTuning(part);
			setTuning({ [part]: preset.values });
			refresh(part);
			toast(`${preset.label}. Every ${part} knob starts from this now.`);
			if (part === 'sound') chainClimb(4);
			else replaySoon();
		});
		into.append(btn);
	}
}

/** Compare: hear or see the built-in values, then go back to yours. */
function toggleCompare(part) {
	const btn = $(`${part}Compare`);
	if (lab.compare[part]) {
		endCompare(part);
	} else {
		lab.compare[part] = copy(tuning[part]);
		resetTuning(part);
		btn.setAttribute('aria-pressed', 'true');
		btn.textContent = 'Now: built-in. Tap for yours';
		refresh(part);
	}
	if (part === 'sound') chainClimb(4);
	else replaySoon();
}

function endCompare(part) {
	if (!lab.compare[part]) return;
	setTuning({ [part]: lab.compare[part] });
	lab.compare[part] = null;
	const btn = $(`${part}Compare`);
	btn.setAttribute('aria-pressed', 'false');
	btn.textContent = 'Compare with built-in';
	refresh(part);
}

// ---- save, copy, reset ----

function markDirty() {
	const mine = lab.compare.motion || lab.compare.sound ? null : JSON.stringify(tuningDiff());
	$('dirty').hidden = mine === null || mine === lab.saved;
}

let toastTimer = 0;
function toast(text) {
	const el = $('toast');
	el.textContent = text;
	el.hidden = false;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

function settingsText() {
	return JSON.stringify(tuningDiff(), null, '\t');
}

$('save').addEventListener('click', () => {
	endCompare('motion');
	endCompare('sound');
	const diff = tuningDiff();
	if (!Object.keys(diff).length) {
		clearSavedTuning();
		lab.saved = JSON.stringify(diff);
		markDirty();
		return toast('Nothing changed: the game uses the built-in feel.');
	}
	if (!saveTuning()) return toast('Could not save. This browser is blocking site storage.');
	lab.saved = JSON.stringify(diff);
	markDirty();
	toast('Saved. Reload the game to play with this feel.');
});

$('copy').addEventListener('click', async () => {
	endCompare('motion');
	endCompare('sound');
	const text = settingsText();
	$('code').value = text;
	$('exportPanel').hidden = false;
	try {
		await navigator.clipboard.writeText(text);
		toast('Copied. Send it to Claude to make it the feel for everyone.');
	} catch {
		toast('Select the text below and copy it.');
	}
	$('exportPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

$('reset').addEventListener('click', () => {
	if (!confirm('Put every knob back to the built-in value, and remove the saved feel from the game?')) return;
	lab.compare.motion = lab.compare.sound = null;
	for (const part of ['motion', 'sound']) {
		$(`${part}Compare`).setAttribute('aria-pressed', 'false');
		$(`${part}Compare`).textContent = 'Compare with built-in';
	}
	resetTuning();
	clearSavedTuning();
	lab.saved = JSON.stringify(tuningDiff());
	refresh('motion');
	refresh('sound');
	toast('Back to the built-in feel.');
});

// ---- stage controls ----

function pressed(btn, on) {
	btn.setAttribute('aria-pressed', String(on));
}

function buildStageControls() {
	for (const [name, label] of SCENES) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.textContent = label;
		btn.dataset.scene = name;
		pressed(btn, name === lab.scene);
		btn.addEventListener('click', () => {
			lab.scene = name;
			for (const b of $('scenes').children) pressed(b, b.dataset.scene === name);
			play();
		});
		$('scenes').append(btn);
	}
	for (const [speed, label] of SPEEDS) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.textContent = label;
		btn.dataset.speed = speed;
		pressed(btn, speed === lab.speed);
		btn.addEventListener('click', () => {
			lab.speed = speed;
			for (const b of $('speeds').children) pressed(b, Number(b.dataset.speed) === speed);
		});
		$('speeds').append(btn);
	}
	for (const style of BLOCK_STYLES) $('blockStyle').add(new Option(STYLE_NAMES[style] || style, style));
	$('blockStyle').value = lab.style;
	$('blockStyle').addEventListener('change', () => {
		lab.style = $('blockStyle').value;
		showLooks();
		view.layout();
	});
	$('play').addEventListener('click', play);
	$('loop').addEventListener('click', () => {
		lab.loop = !lab.loop;
		pressed($('loop'), lab.loop);
		if (lab.loop && !lab.busy) play();
	});
	$('newBoard').addEventListener('click', () => {
		delete lab.boards[lab.scene];
		play();
	});
	audio.musicOn = false;
	$('music').addEventListener('click', () => {
		audio.unlock();
		const on = !audio.musicOn;
		audio.setMusic(on);
		audio.startMusic();
		pressed($('music'), on);
	});
	canvas.addEventListener('pointerdown', play);
	document.addEventListener('keydown', (e) => {
		if (e.code !== 'Space' || e.target.closest('input, select, button, textarea')) return;
		e.preventDefault();
		play();
	});
}

function buildTabs() {
	for (const part of ['motion', 'sound']) {
		$(`tab-${part}`).addEventListener('click', () => {
			for (const other of ['motion', 'sound']) {
				$(`tab-${other}`).setAttribute('aria-selected', String(other === part));
				$(`pane-${other}`).hidden = other !== part;
			}
		});
	}
}

// Phones block audio until the first tap.
for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });

showLooks();
buildTabs();
buildStageControls();
buildGroups('motion', MOTION_GROUPS, $('motionKnobs'), (key) => {
	if (key === 'remixStyle') view.remixStyle = tuning.motion.remixStyle;
	replaySoon();
});
buildGroups('sound', SOUND_GROUPS, $('soundKnobs'), previewSound);
buildSoundList();
buildPresets('motion', MOTION_PRESETS, $('motionPresets'));
buildPresets('sound', SOUND_PRESETS, $('soundPresets'));
$('motionCompare').addEventListener('click', () => toggleCompare('motion'));
$('soundCompare').addEventListener('click', () => toggleCompare('sound'));
$('climb').addEventListener('click', () => chainClimb(8));
markDirty();

startScope($('scope'));
new ResizeObserver(() => view.resize()).observe($('stageBox'));
view.resize();
requestAnimationFrame(frame);
play();

// For the console: feelLab.tuning, feelLab.view, feelLab.lab.
window.feelLab = { lab, view, tuning };
