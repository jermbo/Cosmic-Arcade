// Glintwell: screens, input, and the flow of a game.

import { Game, rotatePiece, TIMED_SECONDS, DEFAULT_LAB, CHAIN_REWARDS } from './engine.js';
import { View, POWER_NAMES } from './view.js';
import { audio } from './audio.js';
import { store, persist, labIsDefault } from './storage.js';
import { PALETTE, GOLD, roundRect } from './sprites.js';
import { VERSION } from './version.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const canvas = $('stage');
const view = new View(canvas);

const CHAIN_COLORS = [GOLD, '#ffb38a', '#ff8fb1', '#e3a2ff', '#9fd8ff'];

const state = {
	screen: 'title', // 'title' | 'playing' | 'ending' | 'over'
	paused: false,
	game: null,
	mode: 'endless',
	busy: false,
	timeLeft: 0,
	lastTick: 0,
	shownScore: 0,
	drag: null,
	power: null, // power-up being used: { kind, stage, color }
	aiming: null, // pointer id while a blast is being aimed
	modalReturn: null,
	afterTutorial: null,
	storageOk: true,
	usedLab: false,
};

// ---- small helpers ----

function vibrate(pattern) {
	if (!store.settings.vibrate || !navigator.vibrate) return;
	if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
	try {
		navigator.vibrate(pattern);
	} catch {
		// Some browsers throw when vibration is blocked.
	}
}

function save() {
	state.storageOk = persist();
	$('storage-note').hidden = state.storageOk;
}

const waiters = [];
function waitFor(test) {
	return new Promise((resolve) => waiters.push({ test, resolve }));
}

function showModal(id) {
	for (const el of document.querySelectorAll('.screen--modal')) el.hidden = el.id !== id;
}

function hideModals() {
	showModal(null);
}

function formatTime(t) {
	const s = Math.max(0, Math.ceil(t));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---- HUD ----

function updateBestLabels() {
	$('best-endless').textContent = `Best ${store.best.endless.toLocaleString()}`;
	$('best-timed').textContent = `Best ${store.best.timed.toLocaleString()}`;
}

function bump(el) {
	el.classList.remove('is-bump');
	void el.offsetWidth;
	el.classList.add('is-bump');
}

function updateHud(dt) {
	const g = state.game;
	if (!g) return;
	const target = g.score;
	if (state.shownScore !== target) {
		state.shownScore += Math.max(1, Math.ceil((target - state.shownScore) * Math.min(1, dt * 9)));
		if (state.shownScore > target) state.shownScore = target;
		$('score').textContent = state.shownScore.toLocaleString();
	}
	$('best').textContent = Math.max(store.best[state.mode], g.score).toLocaleString();
	if (state.mode === 'timed') {
		$('time').textContent = formatTime(state.timeLeft);
		$('time-fill').style.transform = `scaleX(${Math.max(0, state.timeLeft / TIMED_SECONDS)})`;
		$('time-box').classList.toggle('is-low', state.timeLeft <= 10);
	}
}

// ---- game flow ----

function startGame(mode) {
	if (!store.tutorialDone) {
		state.afterTutorial = () => startGame(mode);
		openTutorial();
		return;
	}
	hideModals();
	$('screen-title').hidden = true;
	$('banner').hidden = true;
	state.mode = mode;
	state.game = new Game({ mode, lab: store.lab, seed: (Math.random() * 2 ** 31) | 0 });
	state.usedLab = !labIsDefault();
	state.screen = 'playing';
	state.paused = false;
	state.busy = false;
	state.timeLeft = TIMED_SECONDS;
	state.lastTick = TIMED_SECONDS;
	state.shownScore = 0;
	state.drag = null;
	state.power = null;
	state.aiming = null;
	app.dataset.screen = 'game';
	$('time-box').hidden = mode !== 'timed';
	$('lab-chip').hidden = !state.usedLab;
	$('score').textContent = '0';
	view.resize();
	view.setGame(state.game);
	view.hint = !store.hintDone;
	updateHud(0);
	audio.land(3);
}

function quitToTitle() {
	hideModals();
	$('banner').hidden = true;
	state.screen = 'title';
	state.paused = false;
	state.game = null;
	state.power = null;
	view.power = null;
	app.dataset.screen = 'title';
	view.game = null;
	view.fx.clear();
	view.layout();
	updateBestLabels();
	$('screen-title').hidden = false;
}

function pause() {
	if (state.screen !== 'playing' || state.paused) return;
	cancelDrag();
	cancelPower();
	state.paused = true;
	showModal('screen-pause');
}

function resume() {
	state.paused = false;
	hideModals();
}

async function dropPiece(slot, piece, col, left, top) {
	const g = state.game;
	state.busy = true;
	g.pieces[slot] = piece;
	const placed = g.place(slot, col, piece);
	if (!placed) {
		state.busy = false;
		return;
	}
	if (view.hint) {
		view.hint = false;
		store.hintDone = true;
		save();
	}
	vibrate(8);
	view.dropIn(placed, left, top);
	await waitFor(() => view.settled);
	const length = await resolveChain();
	if (state.game !== g) return;
	const won = g.awardChain(length);
	if (won) announceReward(won);
	g.refill(slot);
	view.pieceSpawned(slot);
	state.busy = false;
	checkEnd();
}

/** Runs the chain until the board is still. Returns how many steps it took. */
async function resolveChain() {
	const g = state.game;
	let steps = 0;
	for (let chain = 1; ; chain++) {
		const step = g.resolveStep(chain);
		if (!step) break;
		steps = chain;
		showStep(step);
		await waitFor(() => view.dying.length === 0);
		view.holdFalls = false;
		await waitFor(() => view.settled);
		if (state.game !== g) return steps;
	}
	return steps;
}

function announceReward(won) {
	const { bar } = view;
	const name = POWER_NAMES[won.kind];
	if (won.lost) {
		view.fx.pop(bar.x + bar.w / 2, bar.y - view.cell * 0.4, `Bag full: ${name} lost`, '', '#ff8fb1');
		audio.deny();
		return;
	}
	view.fx.pop(bar.x + bar.w / 2, bar.y - view.cell * 0.4, `${name} earned!`, '', GOLD, true);
	audio.forge('flare');
	vibrate([15, 30, 15]);
}

/** Plays the sound, particles and score pop for one chain step. */
function showStep(step) {
	const g = state.game;
	const { cell } = view;
	view.holdFalls = true;

	const delay = new Map();
	for (const grp of step.groups) for (const idx of grp.cells) delay.set(idx, 0);
	if (step.blast) {
		for (const idx of step.blast.cells) {
			const d = Math.max(Math.abs((idx % g.cols) - step.blast.x), Math.abs(Math.floor(idx / g.cols) - step.blast.y)) * 0.05 + 0.06;
			delay.set(idx, Math.min(delay.get(idx) ?? Infinity, d));
		}
	}
	view.killBlocks(step.cleared.map((c) => ({ ...c, delay: delay.get(c.idx) ?? 0 })));

	let sx = 0;
	let sy = 0;
	for (const c of step.cleared) {
		sx += c.x;
		sy += c.y;
	}
	const n = Math.max(1, step.cleared.length);
	const center = view.cellCenter(sx / n, sy / n);
	const color = CHAIN_COLORS[Math.min(step.chain - 1, CHAIN_COLORS.length - 1)];
	const sub = step.chain > 1 ? `Chain ×${step.chain}` : '';
	view.fx.pop(center.x, center.y, `+${step.points.toLocaleString()}`, sub, color, step.chain > 2);
	bump($('score'));

	const biggest = Math.max(3, ...step.groups.map((grp) => grp.cells.size));
	audio.clear(step.chain, biggest);
	if (step.chain >= 3 || step.cleared.length >= 7) {
		view.fx.shake(3 + step.chain);
		vibrate(15);
	}

	if (step.blast) {
		const c = view.cellCenter(step.blast.x, step.blast.y);
		view.fx.ring(c.x, c.y, cell * 2, PALETTE[2].light, 10, 0.45);
		view.fx.ring(c.x, c.y, cell * 1.3, '#fff6dc', 5, 0.3);
		view.fx.burst(c.x, c.y, 16, cell * 6, 2, cell * 0.6);
		view.fx.shake(8);
		audio.flare();
		vibrate([20, 30, 20]);
	}

	if (step.allClear) {
		showBanner('All clear!', 1400);
		view.fx.screenFlash(0.5, '#fff6dc');
		audio.allClear();
	}
}

function showBanner(text, ms) {
	const b = $('banner');
	b.textContent = text;
	b.hidden = false;
	b.style.animation = 'none';
	void b.offsetWidth;
	b.style.animation = '';
	clearTimeout(showBanner.timer);
	if (ms) showBanner.timer = setTimeout(() => (b.hidden = true), ms);
}

function checkEnd() {
	if (state.screen !== 'playing' || state.busy) return;
	if (state.mode === 'timed' && state.timeLeft <= 0) endGame('time');
	else if (state.game.stuck) endGame('stuck');
}

function endGame(reason) {
	cancelDrag();
	cancelPower();
	state.screen = 'ending';
	const g = state.game;
	const best = store.best[state.mode];
	const isBest = g.score > best;
	if (isBest) {
		store.best[state.mode] = g.score;
		save();
	}
	showBanner(reason === 'time' ? 'Time!' : 'No room!', 0);
	audio.gameOver();
	vibrate([30, 60, 30]);
	setTimeout(() => {
		if (state.game !== g) return;
		$('banner').hidden = true;
		state.screen = 'over';
		$('over-reason').textContent = reason === 'time' ? 'Time is up' : 'No room left';
		$('final-score').textContent = g.score.toLocaleString();
		$('new-best').hidden = !isBest || g.score === 0;
		$('over-best').textContent = store.best[state.mode].toLocaleString();
		$('over-chain').textContent = g.stats.bestChain ? `×${g.stats.bestChain}` : '–';
		$('over-cleared').textContent = g.stats.cleared;
		$('over-specials').textContent = `${g.stats.earned} · ${g.stats.used}`;
		$('over-lab').hidden = !state.usedLab;
		showModal('screen-over');
		if (isBest && g.score > 0) audio.best();
	}, 1300);
}

// ---- pointer input ----

function localPoint(e) {
	const r = canvas.getBoundingClientRect();
	return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function canAct() {
	return state.screen === 'playing' && !state.paused && !state.busy && !(state.mode === 'timed' && state.timeLeft <= 0);
}

function rotateSlot(slot) {
	const g = state.game;
	if (!g.pieces[slot]) return;
	g.pieces[slot] = rotatePiece(g.pieces[slot]);
	view.appear[slot] = 0.55;
	audio.rotate();
}

function cancelDrag() {
	const d = state.drag;
	if (!d) return;
	if (d.moved && d.geo) view.returning = { slot: d.slot, x: d.geo.left, y: d.geo.top, t: 0 };
	state.drag = null;
	view.drag = null;
}

// ---- power-ups ----

function setPower(power) {
	state.power = power;
	view.power = power;
	view.aim = null;
	state.aiming = null;
}

function cancelPower() {
	if (state.power) setPower(null);
}

/** Tapping a chip in the bar. Remix fires at once; the others wait for a target. */
function activatePower(index) {
	const kind = state.game.bag[index];
	if (!kind) return;
	audio.ui();
	if (kind === 'remix') useRemix();
	else setPower({ kind, stage: kind === 'prism' ? 'color' : 'aim', color: null });
}

async function useRemix() {
	const g = state.game;
	if (!g.useRemix()) return;
	state.busy = true;
	view.glowAll();
	view.fx.screenFlash(0.25, '#bfe6ff');
	audio.forge('flare');
	vibrate([15, 30, 15]);
	showBanner('Remix!', 900);
	await new Promise((resolve) => setTimeout(resolve, 450));
	// On a crowded board a few matches can remain. They clear like any other chain.
	await resolveChain();
	if (state.game !== g) return;
	state.busy = false;
	checkEnd();
}

async function fireBlast(x, y) {
	const g = state.game;
	if (!g.useBlast(x, y)) {
		audio.deny();
		return;
	}
	setPower(null);
	state.busy = true;
	await resolveChain();
	if (state.game !== g) return;
	state.busy = false;
	checkEnd();
}

function paintSlot(slot) {
	const g = state.game;
	if (!g.usePrism(slot, state.power.color)) return;
	setPower(null);
	view.pieceSpawned(slot);
	audio.forge('flare');
	vibrate(10);
}

/** Pointer down while a power-up is waiting for its target. */
function powerPointerDown(e, p) {
	const power = state.power;
	const hit = view.hitBar(p.x, p.y);
	if (hit && hit.type === 'cancel') {
		audio.ui();
		setPower(null);
	} else if (power.kind === 'prism' && power.stage === 'color') {
		if (hit && hit.type === 'color') {
			audio.ui();
			power.color = hit.color;
			power.stage = 'piece';
		}
	} else if (power.kind === 'prism') {
		const slot = view.hitSlot(p.x, p.y);
		if (slot >= 0 && state.game.pieces[slot]) paintSlot(slot);
	} else {
		const cell = view.cellAt(p.x, p.y);
		if (!cell) return;
		state.aiming = e.pointerId;
		view.aim = cell;
		try {
			canvas.setPointerCapture(e.pointerId);
		} catch {
			// Capture can fail if the pointer is already gone.
		}
	}
}

canvas.addEventListener('pointerdown', (e) => {
	if (!canAct() || state.drag) return;
	const p = localPoint(e);
	if (state.power) {
		e.preventDefault();
		powerPointerDown(e, p);
		return;
	}
	const chip = view.hitBar(p.x, p.y);
	if (chip && chip.type === 'chip') {
		e.preventDefault();
		activatePower(chip.index);
		return;
	}
	const slot = view.hitSlot(p.x, p.y);
	if (slot < 0 || !state.game.pieces[slot]) return;
	e.preventDefault();
	state.drag = { slot, id: e.pointerId, sx: p.x, sy: p.y, moved: false, piece: state.game.pieces[slot], touch: e.pointerType !== 'mouse', geo: null };
	view.drag = state.drag;
	view.kb = null;
	try {
		canvas.setPointerCapture(e.pointerId);
	} catch {
		// Capture can fail if the pointer is already gone.
	}
});

canvas.addEventListener('pointermove', (e) => {
	if (state.power && state.power.kind === 'blast') {
		// A mouse previews the blast as it moves; a finger aims while it is down.
		const p = localPoint(e);
		const cell = view.cellAt(p.x, p.y);
		if (cell && (e.pointerType === 'mouse' || state.aiming === e.pointerId)) view.aim = cell;
		return;
	}
	const d = state.drag;
	if (!d || e.pointerId !== d.id) return;
	const p = localPoint(e);
	if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 9) {
		d.moved = true;
		audio.pick();
		vibrate(4);
	}
	if (!d.moved) return;
	const geo = view.dragGeometry(d.piece, p.x, p.y, d.touch);
	if (geo.over && d.geo && d.geo.over && geo.col !== d.geo.col) audio.move();
	d.geo = geo;
});

canvas.addEventListener('pointerup', (e) => {
	if (state.aiming === e.pointerId) {
		state.aiming = null;
		const p = localPoint(e);
		const cell = view.cellAt(p.x, p.y);
		if (cell && canAct()) fireBlast(cell.x, cell.y);
		else view.aim = null;
		return;
	}
	const d = state.drag;
	if (!d || e.pointerId !== d.id) return;
	state.drag = null;
	view.drag = null;
	if (!d.moved) {
		rotateSlot(d.slot);
		return;
	}
	const geo = d.geo;
	if (geo && geo.valid && canAct()) {
		dropPiece(d.slot, d.piece, geo.col, (geo.left - view.boardX) / view.cell, (geo.top - view.boardY) / view.cell);
	} else {
		if (geo && geo.over) audio.deny();
		view.returning = { slot: d.slot, x: geo ? geo.left : d.sx, y: geo ? geo.top : d.sy, t: 0 };
	}
});

canvas.addEventListener('pointercancel', () => {
	if (state.aiming !== null) {
		state.aiming = null;
		view.aim = null;
	}
	cancelDrag();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- keyboard input ----

function ensureKb() {
	if (!view.kb) {
		const slot = Math.max(0, state.game.pieces.findIndex((p) => p));
		view.kb = { slot, col: Math.floor((state.game.cols - 1) / 2) };
		return false;
	}
	return true;
}

function keyDrop() {
	const g = state.game;
	const piece = g.pieces[view.kb.slot];
	if (!piece) return;
	const col = Math.min(view.kb.col, g.cols - piece.w);
	if (!g.fits(piece, col)) {
		audio.deny();
		view.fx.shake(3);
		return;
	}
	dropPiece(view.kb.slot, piece, col, col, g.rows + 0.4);
}

document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
		if (state.screen === 'playing') {
			if (state.paused && !$('screen-pause').hidden) resume();
			else pause();
			e.preventDefault();
		}
		return;
	}
	if (state.screen !== 'playing' || state.paused) return;
	const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'Tab', 'x', 'X', 'z', 'Z', '1', '2', '3'];
	if (!keys.includes(e.key)) return;
	e.preventDefault();
	if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
	if (!canAct() || state.power) return;
	const g = state.game;
	const had = ensureKb();
	const kb = view.kb;
	const piece = g.pieces[kb.slot];
	switch (e.key) {
		case 'ArrowLeft':
			if (had) kb.col = Math.max(0, Math.min(kb.col, g.cols - (piece ? piece.w : 1)) - 1);
			audio.move();
			break;
		case 'ArrowRight':
			if (had) kb.col = Math.min(g.cols - (piece ? piece.w : 1), kb.col + 1);
			audio.move();
			break;
		case 'ArrowUp':
		case 'x':
		case 'X':
		case 'z':
		case 'Z':
			rotateSlot(kb.slot);
			break;
		case 'ArrowDown':
		case 'Tab': {
			const n = g.pieces.length;
			kb.slot = (kb.slot + (e.shiftKey ? n - 1 : 1)) % n;
			audio.move();
			break;
		}
		case '1':
		case '2':
		case '3': {
			const i = Number(e.key) - 1;
			if (i < g.pieces.length) kb.slot = i;
			break;
		}
		case ' ':
		case 'Enter':
			if (had) keyDrop();
			break;
	}
});

// ---- audio unlock ----

function unlockAudio() {
	audio.unlock();
}
for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, unlockAudio, { capture: true, passive: true });

// Stop iOS pinch zoom and double-tap zoom.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

// ---- buttons ----

const actions = {
	'play-endless': () => startGame('endless'),
	'play-timed': () => startGame('timed'),
	resume,
	restart: () => startGame(state.mode),
	quit: quitToTitle,
	settings: () => openSettings(),
	'close-settings': () => closeSettings(),
	tutorial: () => openTutorial(),
	'tutorial-next': () => tutorialStep(1),
	'tutorial-skip': () => closeTutorial(),
	'dismiss-ios': () => {
		$('ios-hint').hidden = true;
		store.iosHintDismissed = true;
		save();
	},
	'lab-reset': () => {
		store.lab = { ...DEFAULT_LAB };
		save();
		syncSettings();
	},
	'reset-best': () => {
		const b = $('reset-best');
		if (b.dataset.armed) {
			store.best = { endless: 0, timed: 0 };
			save();
			updateBestLabels();
			b.textContent = 'Best scores reset';
			delete b.dataset.armed;
			setTimeout(() => (b.textContent = 'Reset best scores'), 1500);
		} else {
			b.dataset.armed = '1';
			b.textContent = 'Tap again to reset';
			setTimeout(() => {
				if (b.dataset.armed) {
					delete b.dataset.armed;
					b.textContent = 'Reset best scores';
				}
			}, 3000);
		}
	},
};

app.addEventListener('click', (e) => {
	const btn = e.target.closest('[data-action]');
	if (!btn || !actions[btn.dataset.action]) return;
	audio.ui();
	actions[btn.dataset.action]();
});

$('pause-button').addEventListener('click', () => {
	audio.ui();
	pause();
});

// ---- settings ----

function openSettings() {
	state.modalReturn = state.screen === 'title' ? 'title' : 'screen-pause';
	syncSettings();
	showModal('screen-settings');
	$('screen-title').hidden = true;
}

function closeSettings() {
	if (state.modalReturn === 'title') {
		hideModals();
		$('screen-title').hidden = false;
	} else {
		showModal(state.modalReturn);
	}
}

function syncSettings() {
	for (const input of document.querySelectorAll('[data-setting]')) input.checked = Boolean(store.settings[input.dataset.setting]);
	for (const input of document.querySelectorAll('.lab input[type=radio]')) {
		input.checked = String(store.lab[input.name]) === input.value;
	}
}

function applySettings() {
	audio.setSfx(store.settings.sfx);
	audio.setMusic(store.settings.music);
	view.fx.shakeOn = store.settings.shake;
}

document.addEventListener('change', (e) => {
	const input = e.target;
	if (input.dataset.setting) {
		store.settings[input.dataset.setting] = input.checked;
		applySettings();
		save();
		audio.ui();
	} else if (input.closest('.lab')) {
		let value = input.value;
		if (input.name === 'pieces') value = Number(value);
		store.lab[input.name] = value;
		save();
		audio.ui();
	}
});

// ---- tutorial ----

const rewardAt = (kind) => CHAIN_REWARDS.find((r) => r.kind === kind).chain;

const TUTORIAL = [
	{
		title: 'Drop into the well',
		text: 'Drag a piece up into the well and let go. It <b>rises and sticks to the ceiling</b>. The ghost shows where each block lands. <b>Tap a piece to turn it.</b>',
		draw: drawTutorialDrop,
	},
	{
		title: 'Match 3 or more',
		text: 'Link 3 or more blocks of one color. They can bend around corners, but <b>not diagonally</b>. They break, the blocks below rise, and new matches chain. <b>Each chain step raises the multiplier.</b>',
		draw: drawTutorialMatch,
	},
	{
		title: 'Chain for power-ups',
		text: `Long chains in one turn fill the bar under the well. Use them when you choose. <b>Prism</b> (chain ${rewardAt('prism')}) paints a piece one color. <b>Blast</b> (chain ${rewardAt('blast')}) clears a 3×3 area. <b>Remix</b> (chain ${rewardAt('remix')}) mixes the board colors.`,
		draw: drawTutorialPowerUps,
	},
	{
		title: 'Keep room to play',
		text: 'The game ends when no piece fits. Endless has no clock. Timed gives you 90 seconds.<br /><span class="tutorial__keys">Keys: <kbd>←</kbd> <kbd>→</kbd> move · <kbd>↑</kbd> turn · <kbd>↓</kbd> next piece · <kbd>Space</kbd> drop</span>',
		draw: drawTutorialEnd,
	},
];
let tutorialPage = 0;

function openTutorial() {
	state.modalReturn = !$('screen-settings').hidden ? 'screen-settings' : state.screen === 'title' ? 'title' : 'screen-pause';
	tutorialPage = 0;
	$('screen-title').hidden = true;
	showModal('screen-tutorial');
	renderTutorial();
}

function tutorialStep(delta) {
	tutorialPage += delta;
	if (tutorialPage >= TUTORIAL.length) closeTutorial();
	else renderTutorial();
}

function closeTutorial() {
	store.tutorialDone = true;
	save();
	const next = state.afterTutorial;
	state.afterTutorial = null;
	if (next) return next();
	if (state.modalReturn === 'title') {
		hideModals();
		$('screen-title').hidden = false;
	} else {
		if (state.modalReturn === 'screen-settings') syncSettings();
		showModal(state.modalReturn);
	}
}

function renderTutorial() {
	const page = TUTORIAL[tutorialPage];
	const box = $('tutorial');
	box.innerHTML = `<canvas width="440" height="300"></canvas><h3>${page.title}</h3><p>${page.text}</p>`;
	const keys = box.querySelector('.tutorial__keys');
	if (keys && !window.matchMedia('(pointer: fine)').matches) keys.previousElementSibling.remove(), keys.remove();
	const c = box.querySelector('canvas');
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	c.width = 220 * dpr;
	c.height = 150 * dpr;
	const ctx = c.getContext('2d');
	ctx.scale(dpr, dpr);
	page.draw(ctx);
	$('tutorial-dots').innerHTML = TUTORIAL.map((_, i) => `<span class="${i === tutorialPage ? 'is-on' : ''}"></span>`).join('');
	$('tutorial-next').textContent = tutorialPage === TUTORIAL.length - 1 ? (state.afterTutorial ? "Let's play" : 'Done') : 'Next';
}

function tile(ctx, kind, color, x, y, s, alpha = 1) {
	ctx.globalAlpha = alpha;
	ctx.drawImage(view.sprites[kind][color], x, y, s, s);
	ctx.globalAlpha = 1;
}

function miniWell(ctx, x, y, cols, rows, s) {
	ctx.fillStyle = 'rgba(9,7,22,0.85)';
	ctx.strokeStyle = GOLD;
	ctx.lineWidth = 1.5;
	roundRect(ctx, x - 4, y - 4, cols * s + 8, rows * s + 8, 8);
	ctx.fill();
	ctx.stroke();
}

function label(ctx, text, x, y, color = GOLD, size = 13) {
	ctx.font = `800 ${size}px ui-rounded, system-ui, sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = color;
	ctx.fillText(text, x, y);
}

function drawTutorialDrop(ctx) {
	const s = 24;
	const x0 = 36;
	const y0 = 12;
	miniWell(ctx, x0, y0, 5, 3, s);
	const ceiling = [[0, 0, 1], [1, 0, 3], [3, 0, 0], [4, 0, 4], [4, 1, 2], [0, 1, 3]];
	for (const [cx, cy, col] of ceiling) tile(ctx, 'plain', col, x0 + cx * s, y0 + cy * s, s);
	// Ghost
	tile(ctx, 'plain', 1, x0 + 2 * s, y0, s, 0.4);
	tile(ctx, 'plain', 1, x0 + 2 * s, y0 + s, s, 0.4);
	tile(ctx, 'plain', 4, x0 + 1 * s, y0 + s, s, 0.4);
	// Piece held below
	const py = y0 + 3 * s + 14;
	tile(ctx, 'plain', 4, x0 + 1 * s, py, s);
	tile(ctx, 'plain', 1, x0 + 2 * s, py, s);
	tile(ctx, 'plain', 1, x0 + 2 * s, py + s, s);
	ctx.fillStyle = '#fff6dc';
	ctx.beginPath();
	ctx.arc(x0 + 2.6 * s, py + 1.9 * s, 7, 0, Math.PI * 2);
	ctx.fill();
	label(ctx, 'let go', 192, 32, '#b3a8d6', 12);
	label(ctx, 'drag', 192, 128, '#b3a8d6', 12);
	ctx.strokeStyle = '#b3a8d6';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(192, 114);
	ctx.lineTo(192, 50);
	ctx.lineTo(187, 56);
	ctx.moveTo(192, 50);
	ctx.lineTo(197, 56);
	ctx.stroke();
}

function drawTutorialMatch(ctx) {
	const s = 26;
	const x0 = 20;
	const y0 = 18;
	miniWell(ctx, x0, y0, 4, 4, s);
	// Colors 2 link in a bend: (0,0) (1,0) (1,1). The 2 at (3,2) only touches by a corner, so it stays.
	const cells = [[0, 0, 2], [1, 0, 2], [1, 1, 2], [2, 0, 1], [3, 0, 1], [0, 1, 0], [2, 1, 3], [3, 1, 0], [2, 2, 2]];
	for (const [cx, cy, col] of cells) tile(ctx, 'plain', col, x0 + cx * s, y0 + cy * s, s);
	ctx.strokeStyle = '#fff6dc';
	ctx.lineWidth = 2.5;
	for (const [cx, cy] of [[0, 0], [1, 0], [1, 1]]) {
		roundRect(ctx, x0 + cx * s + 2, y0 + cy * s + 2, s - 4, s - 4, 6);
		ctx.stroke();
	}
	label(ctx, '+30', x0 + 1.5 * s, y0 + 2.5 * s, GOLD, 15);
	label(ctx, '→', 136, 70, '#b3a8d6', 22);
	label(ctx, 'Chain ×2', 180, 36, '#ffb38a', 13);
	label(ctx, 'Chain ×3', 180, 66, '#ff8fb1', 14);
	label(ctx, 'Chain ×4', 180, 98, '#e3a2ff', 15);
}

function drawTutorialPowerUps(ctx) {
	const names = ['prism', 'blast', 'remix'];
	names.forEach((kind, i) => {
		const cx = 38 + i * 72;
		ctx.fillStyle = 'rgba(242,200,121,0.16)';
		ctx.strokeStyle = GOLD;
		ctx.lineWidth = 2;
		roundRect(ctx, cx - 30, 28, 60, 60, 14);
		ctx.fill();
		ctx.stroke();
		view.drawPowerIcon(kind, cx, 58, 34, ctx);
		label(ctx, POWER_NAMES[kind], cx, 104, '#fff6dc', 13);
		label(ctx, `chain ${rewardAt(kind)}`, cx, 122, '#b3a8d6', 11);
	});
}

function drawTutorialEnd(ctx) {
	const s = 20;
	const x0 = 60;
	miniWell(ctx, x0, 14, 5, 6, s);
	const heights = [6, 5, 6, 6, 5];
	heights.forEach((h, x) => {
		for (let k = 0; k < h; k++) tile(ctx, 'plain', (x * 3 + k * 2) % 5, x0 + x * s, 14 + k * s, s, 0.85);
	});
	ctx.fillStyle = 'rgba(255,80,100,0.3)';
	ctx.fillRect(x0, 14 + 6 * s - s * 1.2, 5 * s, s * 1.2);
}

// ---- install help ----

let installEvent = null;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

window.addEventListener('beforeinstallprompt', (e) => {
	e.preventDefault();
	installEvent = e;
	$('install-button').hidden = false;
});

window.addEventListener('appinstalled', () => {
	installEvent = null;
	$('install-button').hidden = true;
});

$('install-button').addEventListener('click', async () => {
	if (!installEvent) return;
	installEvent.prompt();
	try {
		await installEvent.userChoice;
	} catch {
		// The prompt was closed.
	}
	installEvent = null;
	$('install-button').hidden = true;
});

if (isIOS && !isStandalone() && !store.iosHintDismissed) $('ios-hint').hidden = false;
if (location.pathname.includes('/play/') && !isStandalone()) $('arcade-link').hidden = false;

// ---- service worker and updates ----

let updateRequested = false;
let registration = null;

function showUpdateToast() {
	$('update-toast').hidden = false;
}

$('update-toast').addEventListener('click', () => {
	const waiting = registration && registration.waiting;
	updateRequested = true;
	if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
	else location.reload();
});

// Add ?dev to the URL to turn the offline cache off while you edit files.
const devMode = new URLSearchParams(location.search).has('dev');
if (devMode && 'serviceWorker' in navigator) {
	navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister()));
	if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}

if ('serviceWorker' in navigator && window.isSecureContext && !devMode) {
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		// The first install also changes the controller; only reload when the player asked.
		if (updateRequested) location.reload();
	});
	window.addEventListener('load', async () => {
		try {
			registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
		} catch {
			return;
		}
		const check = () => {
			if (registration.waiting && navigator.serviceWorker.controller) showUpdateToast();
		};
		// The update can start before this code runs, so also watch a worker that is already installing.
		const track = (sw) => sw && sw.addEventListener('statechange', () => sw.state === 'installed' && check());
		check();
		track(registration.installing);
		registration.addEventListener('updatefound', () => track(registration.installing));
		setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
	});
}

// ---- page visibility ----

document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		pause();
		audio.suspend();
	} else {
		audio.resume();
		if (registration) registration.update().catch(() => {});
	}
});
window.addEventListener('blur', pause);

// ---- main loop ----

let last = performance.now();
function frame(now) {
	const dt = Math.min(0.05, (now - last) / 1000);
	last = now;
	if (!state.paused) {
		view.update(dt);
		if (state.screen === 'playing' && state.mode === 'timed' && state.timeLeft > 0) {
			state.timeLeft -= dt;
			const whole = Math.ceil(state.timeLeft);
			if (whole < state.lastTick && whole <= 10 && whole >= 0) audio.tick(whole <= 5);
			state.lastTick = whole;
			if (state.timeLeft <= 0) {
				state.timeLeft = 0;
				checkEnd();
			}
		}
		for (let i = waiters.length - 1; i >= 0; i--) {
			if (waiters[i].test()) {
				const w = waiters.splice(i, 1)[0];
				w.resolve();
			}
		}
	}
	updateHud(dt);
	view.draw();
	requestAnimationFrame(frame);
}

// ---- boot ----

function buildLogo() {
	const box = $('logo-gems');
	box.innerHTML = '';
	[0, 1, 'nova', 3, 4].forEach((c, i) => {
		const img = document.createElement('img');
		img.alt = '';
		img.src = (c === 'nova' ? view.sprites.nova[2] : view.sprites.plain[c]).toDataURL();
		img.style.animationDelay = `${i * 0.18}s`;
		box.appendChild(img);
	});
}

window.addEventListener('resize', () => view.resize());
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => view.resize());

$('version-title').textContent = `v${VERSION}`;
$('version-settings').textContent = `Glintwell v${VERSION}`;
$('vibrate-row').hidden = !('vibrate' in navigator);
applySettings();
audio.startMusic();
view.resize();
buildLogo();
updateBestLabels();
save();
requestAnimationFrame(frame);

// ---- test hooks: add ?debug to the URL ----

if (new URLSearchParams(location.search).has('debug')) {
	/** Picks the move that scores best now and keeps the stacks low. */
	const bestMove = () => {
		const g = state.game;
		let best = null;
		g.pieces.forEach((piece, slot) => {
			let p = piece;
			for (let r = 0; r < 4 && p; r++) {
				for (let x = 0; x <= g.cols - p.w; x++) {
					if (!g.fits(p, x)) continue;
					const c = g.clone();
					const before = c.score;
					c.place(slot, x, p);
					c.resolveAll();
					let filled = 0;
					for (let i = 0; i < c.grid.length; i++) if (c.grid[i]) filled++;
					const v = c.score - before - filled * 4 + Math.random();
					if (!best || v > best.v) best = { v, slot, x, p };
				}
				p = rotatePiece(p);
			}
		});
		return best;
	};
	window.glintwell = {
		state,
		view,
		store,
		/** Plays n moves with the bot, with full animation. */
		async bot(n = 1000) {
			for (let i = 0; i < n && state.screen === 'playing'; i++) {
				await waitFor(() => !state.busy && !state.paused);
				if (state.screen !== 'playing') break;
				const m = bestMove();
				if (!m) break;
				await dropPiece(m.slot, m.p, m.x, m.x, state.game.rows + 0.4);
			}
			return { screen: state.screen, score: state.game && state.game.score, stats: state.game && state.game.stats };
		},
		setTime(t) {
			state.timeLeft = t;
		},
		/** Puts power-ups in the bag: give('prism', 'blast', 'remix'). */
		give(...kinds) {
			for (const kind of kinds) state.game.bag.push(kind);
		},
	};
}
