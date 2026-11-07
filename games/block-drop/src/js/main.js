// Glintwell: screens, input, and the flow of a game.

import { Game, SHAPES, TIMED_SECONDS, DEFAULT_LAB, REWARD_CHAIN, REWARD_GROUP, POWER_KINDS, WARMUP_COST, WARMUP_ROUNDS, SECOND_WIND_COST, START_POWER_COST, BAN_COST, REROLL_COST, EXTEND_COST, EXTEND_SECONDS, DAILY_BONUS, BAG_UPGRADE_COSTS, dailySeed, setShapes } from './engine.js';
import { SKINS, applySkin, BAG_BASE, BAG_MAX_UPGRADES } from './shop.js';
import { View, POWER_NAMES, REMIX_STYLES, REMIX_STYLE_NAMES } from './view.js';
import { audio } from './audio.js';
import { store, persist, labIsDefault, loadCustomShapes } from './storage.js';
import { PALETTE, GOLD, roundRect } from './sprites.js';
import { VERSION } from './version.js';

// Shapes saved from the secret shape lab replace the built-in list.
const customShapes = loadCustomShapes();
const usingCustomShapes = Boolean(customShapes) && setShapes(customShapes);
if (usingCustomShapes) console.info('Glintwell: playing with the custom shapes from the shape lab.');

applySkin(store.perks.skin);

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
	freeGlints: 0, // glints the game had before the player took over (warm-up earnings are not banked)
	bankedGlints: 0,
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

const todayKey = () => {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The daily challenge starts fresh each day. */
function syncDaily() {
	if (store.daily.date === todayKey()) return;
	store.daily = { date: todayKey(), best: 0, claimed: false };
	save();
}

const bestOf = (mode) => (mode === 'daily' ? store.daily.best : store.best[mode]);

function updateBestLabels() {
	syncDaily();
	$('daily-sub').textContent = store.daily.claimed ? `Today's best ${store.daily.best.toLocaleString()}` : `First run pays ✦${DAILY_BONUS}`;
	$('best-endless').textContent = `Best ${store.best.endless.toLocaleString()}`;
	$('best-timed').textContent = `Best ${store.best.timed.toLocaleString()}`;
}

// ---- Glints ----

/** Shows the wallet on the HUD and title, and the state of the warm-up buttons. */
function updateWallet(bumpIt = false) {
	const n = store.glints.toLocaleString();
	$('glints').textContent = n;
	$('wallet-title').querySelector('.wallet__n').textContent = n;
	if (bumpIt) bump($('hud-glints'));
	const g = state.game;
	const cost = g ? g.rerollCost : REROLL_COST;
	$('reroll-cost').textContent = `✦${cost}`;
	$('reroll').setAttribute('aria-disabled', String(!g || store.glints < cost));
	if (!$('screen-start').hidden) renderStart();
	if (!$('screen-shop').hidden) renderShop();
}

/** Moves glints the player just earned into the wallet. */
function bankGlints() {
	const g = state.game;
	if (!g || g.glints <= state.bankedGlints) return;
	store.glints += g.glints - state.bankedGlints;
	state.bankedGlints = g.glints;
	save();
	updateWallet(true);
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
	$('best').textContent = Math.max(bestOf(state.mode), g.score).toLocaleString();
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
	if (mode === 'daily') syncDaily();
	state.pendingMode = mode;
	// With Glints to spend, offer boosts for this game first.
	if (store.glints >= MIN_BOOST_COST) {
		pre.warmup = false;
		pre.power = null;
		pre.ban = null;
		renderStart();
		showModal('screen-start');
		return;
	}
	beginGame(mode, null);
}

function beginGame(mode, boosts) {
	hideModals();
	$('screen-title').hidden = true;
	$('banner').hidden = true;
	state.mode = mode;
	const daily = mode === 'daily';
	state.game = new Game({
		mode,
		lab: daily ? DEFAULT_LAB : store.lab,
		seed: daily ? dailySeed(todayKey()) : (Math.random() * 2 ** 31) | 0,
		bagSize: BAG_BASE + store.perks.bag,
		banned: boosts && boosts.ban !== null ? boosts.ban : null,
	});
	let warmedUp = false;
	if (boosts && boosts.power) state.game.bag.push(boosts.power);
	if (boosts && boosts.warmup) {
		state.game.autoPlay(WARMUP_ROUNDS);
		warmedUp = true;
	}
	state.freeGlints = state.game.glints;
	state.bankedGlints = state.game.glints;
	state.usedLab = !daily && !labIsDefault();
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
	view.hint = !store.hintDone && !warmedUp;
	updateHud(0);
	updateWallet();
	audio.land(3);
	if (warmedUp) showBanner('Warm-up done!', 1200);
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
	updateWallet();
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
	// The piece rises as one rigid shape. Only after it lands do loose blocks rise to close gaps.
	const placed = g.place(slot, col, piece, { settle: false });
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
	if (g.settle().length) await waitFor(() => view.settled);
	if (state.game !== g) return;
	const { length, biggest } = await resolveChain();
	if (state.game !== g) return;
	const won = g.awardChain(length, biggest);
	if (won) announceReward(won);
	g.refill(slot);
	view.pieceSpawned(slot);
	state.busy = false;
	checkEnd();
}

/** Runs the chain until the board is still. Returns how many steps it took and the biggest group cleared. */
async function resolveChain() {
	const g = state.game;
	let steps = 0;
	let biggest = 0;
	for (let chain = 1; ; chain++) {
		const step = g.resolveStep(chain);
		if (!step) break;
		steps = chain;
		biggest = Math.max(biggest, step.biggest);
		showStep(step);
		bankGlints();
		await waitFor(() => view.dying.length === 0);
		view.holdFalls = false;
		await waitFor(() => view.settled);
		if (state.game !== g) return { length: steps, biggest };
	}
	return { length: steps, biggest };
}

function announceReward(won) {
	const { bar } = view;
	if (won.lost) {
		view.fx.pop(bar.x + bar.w / 2, bar.y - view.cell * 0.4, 'Bag full: power-up lost', '', '#ff8fb1');
		audio.deny();
		return;
	}
	const name = POWER_NAMES[won.kind];
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
	const parts = [];
	if (step.chain > 1) parts.push(`Chain ×${step.chain}`);
	if (step.mult > 1) parts.push(`Group ×${step.mult}`);
	if (step.glints > 0) parts.push(`+${step.glints} ✦`);
	view.fx.pop(center.x, center.y, `+${step.points.toLocaleString()}`, parts.join(' · '), color, step.chain > 2 || step.mult > 1);
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
	const best = bestOf(state.mode);
	const isBest = g.score > best;
	if (isBest) {
		if (state.mode === 'daily') store.daily.best = g.score;
		else store.best[state.mode] = g.score;
		save();
	}
	let dailyNote = '';
	if (state.mode === 'daily' && !store.daily.claimed) {
		store.daily.claimed = true;
		store.glints += DAILY_BONUS;
		dailyNote = `Daily bonus: +✦${DAILY_BONUS}`;
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
		$('over-best').textContent = bestOf(state.mode).toLocaleString();
		$('over-daily').hidden = !dailyNote;
		$('over-daily').textContent = dailyNote;
		$('over-chain').textContent = g.stats.bestChain ? `×${g.stats.bestChain}` : '–';
		$('over-cleared').textContent = g.stats.cleared;
		$('over-specials').textContent = `${g.stats.earned} · ${g.stats.used}`;
		$('over-glints').textContent = `✦ ${g.glints - state.freeGlints}`;
		$('over-wallet').textContent = `✦ ${store.glints.toLocaleString()}`;
		const price = (id, cost, note) => {
			const ok = store.glints >= cost;
			$(id).setAttribute('aria-disabled', String(!ok));
			$(`${id}-cost`).textContent = ok ? `✦ ${cost}${note}` : `✦ ${cost} · you have ✦ ${store.glints}`;
		};
		const stuck = reason === 'stuck';
		$('second-wind').hidden = !(stuck && g.canSecondWind);
		$('reroll-over').hidden = !stuck;
		$('extend-time').hidden = !(reason === 'time' && !g.extensionUsed);
		price('second-wind', SECOND_WIND_COST, ' · once per game');
		price('reroll-over', g.rerollCost, '');
		price('extend-time', EXTEND_COST, ' · once per game');
		updateWallet();
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

view.onRemix = (event, value, sound) => {
	if (event === 'charge') {
		if (!value) return; // a style with no wind-up
		if (sound === 'rattle') audio.remixRattle(value);
		else audio.remixCharge();
		vibrate([20, 40, 30, 40, 40, 40, 60]);
	} else if (event === 'boom') {
		audio.remixBoom();
		vibrate([60, 30, 80]);
		showBanner('REMIX!', 1100);
	} else if (event === 'rattle') {
		audio.remixRattle(value);
		vibrate([30, 30, 30, 30, 30, 30, 30]);
	} else if (event === 'tick') {
		audio.remixTick(Math.floor(value / 2));
	}
};

async function useRemix() {
	const g = state.game;
	const moves = g.useRemix();
	if (!moves) return;
	state.busy = true;
	view.startRemix(moves);
	await waitFor(() => !view.remix);
	if (state.game !== g) return;
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
	if (!d.moved) return;
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
	const keys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'Enter', 'Tab', '1', '2', '3'];
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

// ---- boosts at the start of a game ----

const pre = { warmup: false, power: null, ban: null };
const MIN_BOOST_COST = Math.min(WARMUP_COST, START_POWER_COST, BAN_COST);
const preCost = () => (pre.warmup ? WARMUP_COST : 0) + (pre.power ? START_POWER_COST : 0) + (pre.ban !== null ? BAN_COST : 0);
const preCanAdd = (cost) => store.glints - preCost() >= cost;

function togglePre(what, kind) {
	if (what === 'warmup') {
		if (!pre.warmup && !preCanAdd(WARMUP_COST)) return audio.deny();
		pre.warmup = !pre.warmup;
	} else {
		if (pre.power === null && !preCanAdd(START_POWER_COST)) return audio.deny();
		pre.power = pre.power === kind ? null : kind;
	}
	renderStart();
}

/** A tiny picture of a shape (a list of [dx, dy]) for the ban picker. */
function shapeThumb(cells) {
	const el = document.createElement('div');
	el.className = 'shapethumb';
	const w = Math.max(...cells.map(([x]) => x)) + 1;
	const h = Math.max(...cells.map(([, y]) => y)) + 1;
	el.style.gridTemplateColumns = `repeat(${w}, 12px)`;
	const on = new Set(cells.map(([x, y]) => `${x},${y}`));
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = document.createElement('i');
			if (on.has(`${x},${y}`)) i.style.background = PALETTE[(x * 7 + y * 13) % 5].base;
			else i.style.visibility = 'hidden';
			el.append(i);
		}
	}
	return el;
}

function renderStart() {
	const mark = (el, pressed, enabled) => {
		el.setAttribute('aria-pressed', String(pressed));
		el.setAttribute('aria-disabled', String(!pressed && !enabled));
	};
	const room = (cost) => preCanAdd(cost);
	$('start-wallet').textContent = `✦ ${store.glints.toLocaleString()} Glints`;
	const warm = document.querySelector('[data-action="start-warmup"]');
	mark(warm, pre.warmup, room(WARMUP_COST));
	$('cost-warmup').textContent = `✦ ${WARMUP_COST} · score and power-ups it earns are yours`;
	for (const b of document.querySelectorAll('[data-action="start-power"]')) mark(b, pre.power === b.dataset.kind, pre.power !== null || room(START_POWER_COST));
	$('cost-power').textContent = `✦ ${START_POWER_COST} for one`;
	const ban = document.querySelector('[data-action="start-ban"]');
	mark(ban, pre.ban !== null, room(BAN_COST));
	const label = $('ban-label');
	label.textContent = pre.ban === null ? 'Ban a shape from this game' : 'Banned shape (tap to change)';
	if (pre.ban !== null && SHAPES[pre.ban]) label.append(' ', shapeThumb(SHAPES[pre.ban]));
	$('cost-ban').textContent = `✦ ${BAN_COST}`;
	const total = preCost();
	$('start-total').textContent = total ? `✦ ${total}` : 'Free';
}

function renderBanGrid() {
	const grid = $('shape-grid');
	grid.textContent = '';
	const total = SHAPES.length;
	SHAPES.forEach((cells, i) => {
		const card = document.createElement('button');
		card.type = 'button';
		card.className = 'shapecard';
		card.setAttribute('aria-label', `Ban shape ${i + 1}, ${cells.length} blocks`);
		card.append(shapeThumb(cells));
		const small = document.createElement('small');
		small.textContent = `${cells.length} blocks`;
		card.append(small);
		card.addEventListener('click', () => {
			audio.ui();
			pre.ban = i;
			renderStart();
			showModal('screen-start');
		});
		grid.append(card);
	});
	if (!total) grid.textContent = 'No shapes.';
}

// ---- shop ----

function openShop() {
	renderShop();
	showModal('screen-shop');
}

function renderShop() {
	$('shop-wallet').textContent = `✦ ${store.glints.toLocaleString()} Glints`;
	const body = $('shop-body');
	body.textContent = '';
	const make = (tag, cls, text) => {
		const el = document.createElement(tag);
		if (cls) el.className = cls;
		if (text !== undefined) el.textContent = text;
		return el;
	};
	const buy = (label, enabled, onClick) => {
		const b = make('button', 'button', label);
		b.type = 'button';
		b.setAttribute('aria-disabled', String(!enabled));
		b.addEventListener('click', (e) => {
			e.stopPropagation();
			if (!enabled) return audio.deny();
			audio.ui();
			onClick();
		});
		return b;
	};

	const level = store.perks.bag;
	const bag = make('div', 'shop__item');
	bag.append(make('h3', '', 'Power-up bag'));
	bag.append(make('p', '', level >= BAG_MAX_UPGRADES ? `Holds ${BAG_BASE + level}. Fully upgraded.` : `Holds ${BAG_BASE + level}. Upgrade to hold ${BAG_BASE + level + 1}.`));
	if (level < BAG_MAX_UPGRADES) {
		const cost = BAG_UPGRADE_COSTS[level];
		bag.append(buy(`Buy ✦${cost}`, store.glints >= cost, () => {
			store.glints -= cost;
			store.perks.bag++;
			save();
			updateWallet(true);
		}));
	}
	body.append(bag);

	for (const skin of SKINS) {
		const owned = store.perks.skins.includes(skin.id);
		const active = store.perks.skin === skin.id;
		const item = make('div', `shop__item${active ? ' is-on' : ''}`);
		item.append(make('h3', '', `${skin.name} blocks`));
		const sw = make('div', 'swatches');
		for (const c of skin.colors) {
			const i = document.createElement('i');
			i.style.background = c.base;
			sw.append(i);
		}
		item.append(sw);
		if (active) {
			const inUse = make('button', 'button', 'In use');
			inUse.type = 'button';
			inUse.setAttribute('aria-disabled', 'true');
			item.append(inUse);
		} else if (owned) item.append(buy('Use', true, () => useSkin(skin.id)));
		else
			item.append(
				buy(`Buy ✦${skin.price}`, store.glints >= skin.price, () => {
					store.glints -= skin.price;
					store.perks.skins.push(skin.id);
					save();
					useSkin(skin.id);
				}),
			);
		body.append(item);
	}
}

function useSkin(id) {
	store.perks.skin = id;
	applySkin(id);
	view.sprites = null;
	view.layout();
	buildLogo();
	save();
	updateWallet(true);
	renderShop();
}

// ---- rerolling the tray and buying more time ----

function swapTray() {
	const g = state.game;
	store.glints -= g.rerollCost;
	save();
	g.reroll();
	g.pieces.forEach((_, i) => view.pieceSpawned(i));
	audio.forge('flare');
	vibrate(10);
	updateWallet(true);
}

function rerollTray() {
	const g = state.game;
	if (!g || !canAct()) return audio.deny();
	if (store.glints < g.rerollCost) return audio.deny();
	cancelDrag();
	swapTray();
	checkEnd();
}

/** Out of room, but the new pieces might fit: pay for a reroll instead of ending. */
function rerollFromOver() {
	const g = state.game;
	if (state.screen !== 'over' || !g) return;
	if (store.glints < g.rerollCost) return audio.deny();
	swapTray();
	hideModals();
	state.screen = 'playing';
	state.paused = false;
	state.busy = false;
	checkEnd();
}

function extendTime() {
	const g = state.game;
	if (state.screen !== 'over' || !g || g.extensionUsed) return;
	if (store.glints < EXTEND_COST) return audio.deny();
	store.glints -= EXTEND_COST;
	g.extensionUsed = true;
	save();
	updateWallet(true);
	hideModals();
	state.screen = 'playing';
	state.paused = false;
	state.busy = false;
	state.timeLeft = EXTEND_SECONDS;
	state.lastTick = EXTEND_SECONDS;
	showBanner(`+${EXTEND_SECONDS} seconds!`, 900);
}

/** Game over, but the player pays to keep going: the bottom rows of the stack are cleared. Once per game. */
async function secondWind() {
	const g = state.game;
	if (state.screen !== 'over' || !g || !g.canSecondWind) return;
	if (store.glints < SECOND_WIND_COST) {
		audio.deny();
		return;
	}
	const cleared = g.useSecondWind();
	if (!cleared || !cleared.length) return;
	store.glints -= SECOND_WIND_COST;
	save();
	updateWallet(true);
	hideModals();
	state.screen = 'playing';
	state.paused = false;
	state.busy = true;
	view.killBlocks(cleared.map((c) => ({ ...c, delay: (c.y / g.rows) * 0.2 + Math.random() * 0.15 })));
	view.fx.shake(10);
	audio.flare();
	vibrate([30, 40, 30]);
	showBanner('Second wind!', 1100);
	await waitFor(() => view.dying.length === 0);
	if (state.game !== g) return;
	await waitFor(() => view.settled);
	state.busy = false;
	checkEnd();
}

const actions = {
	'play-daily': () => startGame('daily'),
	shop: openShop,
	'shop-back': () => hideModals(),
	reroll: rerollTray,
	'reroll-over': rerollFromOver,
	'extend-time': extendTime,
	'start-warmup': () => togglePre('warmup'),
	'start-power': (btn) => togglePre('power', btn.dataset.kind),
	'start-ban': () => {
		if (pre.ban === null && !preCanAdd(BAN_COST)) return audio.deny();
		renderBanGrid();
		showModal('screen-ban');
	},
	'ban-none': () => {
		pre.ban = null;
		renderStart();
		showModal('screen-start');
	},
	'start-go': () => {
		const total = preCost();
		if (store.glints < total) return audio.deny();
		store.glints -= total;
		if (total) save();
		beginGame(state.pendingMode, { ...pre });
	},
	'start-skip': () => beginGame(state.pendingMode, null),
	'second-wind': secondWind,
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
	actions[btn.dataset.action](btn);
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

const TUTORIAL = [
	{
		title: 'Drop into the well',
		text: 'Drag a piece up into the well and let go. It <b>rises and sticks to the ceiling</b>. The ghost shows where each block lands. <b>Pieces never turn: you get what you get.</b>',
		draw: drawTutorialDrop,
	},
	{
		title: 'Match 3 or more',
		text: 'Link 3 or more blocks of one color. They can bend around corners, but <b>not diagonally</b>. They break, the blocks below rise, and new matches chain. <b>Each chain step raises the multiplier.</b> <b>Big groups pay more:</b> 5 blocks pay ×2, 6 pay ×3, and so on.',
		draw: drawTutorialMatch,
	},
	{
		title: 'Earn power-ups',
		text: `A chain of ${REWARD_CHAIN} or a group of ${REWARD_GROUP} earns a power-up for the bar under the well. You get all three kinds in turn, never the same one twice in a row. <b>Prism</b> paints a piece one color. <b>Blast</b> clears a 3×3 area. <b>Remix</b> shuffles every block on the board.`,
		draw: drawTutorialPowerUps,
	},
	{
		title: 'Keep room to play',
		text: `The game ends when no piece fits. Endless has no clock. Timed gives you 90 seconds. <b>Combos earn Glints (✦).</b> Spend them in the Shop, on boosts before a game, on a Reroll, or to keep going when you run out of room.<br /><span class="tutorial__keys">Keys: <kbd>←</kbd> <kbd>→</kbd> move · <kbd>↓</kbd> next piece · <kbd>Space</kbd> drop</span>`,
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
// A secret door: tap the version number 7 times to open the shape lab.
{
	let taps = 0;
	let timer = 0;
	const door = () => {
		taps++;
		clearTimeout(timer);
		timer = setTimeout(() => (taps = 0), 1500);
		if (taps >= 7) location.href = 'shape-lab.html';
	};
	$('version-title').addEventListener('click', door);
	$('version-settings').addEventListener('click', door);
}
$('version-settings').textContent = `Glintwell v${VERSION}`;
$('vibrate-row').hidden = !('vibrate' in navigator);
applySettings();
updateWallet();
audio.startMusic();
view.resize();
buildLogo();
updateBestLabels();
save();
requestAnimationFrame(frame);

// ---- cheats and test hooks ----
// On for localhost and for any page opened with ?debug. Off on a real host.
// Keys (hold Shift): 1 Prism, 2 Blast, 3 Remix, 4 all three, 5 drop 50 blocks, 6 fill the well, 7 next Remix style, 8 play this style again, 9 add 100 Glints, 0 empty the bag.
// Console: glintwell.help()

const cheatsOn = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || new URLSearchParams(location.search).has('debug');

if (cheatsOn) {
	/** Picks the move that scores best now and keeps the stacks low. */
	const bestMove = () => {
		const g = state.game;
		let best = null;
		g.pieces.forEach((piece, slot) => {
			if (!piece) return;
			for (let x = 0; x <= g.cols - piece.w; x++) {
				if (!g.fits(piece, x)) continue;
				const c = g.clone();
				const before = c.score;
				c.place(slot, x, piece);
				c.resolveAll();
				let filled = 0;
				for (let i = 0; i < c.grid.length; i++) if (c.grid[i]) filled++;
				const v = c.score - before - filled * 4 + Math.random();
				if (!best || v > best.v) best = { v, slot, x, p: piece };
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
		/** Puts power-ups in the bag: give('prism', 'blast', 'remix'). The bag holds 3. */
		give(...kinds) {
			const g = state.game;
			if (!g) return [];
			for (const kind of kinds) {
				if (!POWER_KINDS.includes(kind)) {
					console.warn(`Unknown power-up "${kind}". Use: ${POWER_KINDS.join(', ')}`);
					continue;
				}
				if (g.bag.length >= g.bagSize) {
					console.warn(`The bag is full (${g.bagSize}). Use one or call glintwell.empty().`);
					break;
				}
				g.bag.push(kind);
				view.fx.pop(view.bar.x + view.bar.w / 2, view.bar.y - view.cell * 0.4, `Cheat: ${POWER_NAMES[kind]}`, '', GOLD);
			}
			return g.bag.slice();
		},
		prism: () => cheat.give('prism'),
		blast: () => cheat.give('blast'),
		/** The Remix styles you can pick: remix('swirl'). */
		remixStyles() {
			return REMIX_STYLE_NAMES.slice();
		},
		/** Gives a Remix and fires it at once. Pass a style name to pick one (it stays picked). */
		remix(style) {
			if (!state.game || state.busy) return;
			if (style) {
				if (!REMIX_STYLES[style]) {
					console.warn(`Unknown style "${style}". Use: ${REMIX_STYLE_NAMES.join(', ')}`);
					return;
				}
				view.remixStyle = style;
			}
			const { bag } = state.game;
			if (!bag.includes('remix')) {
				if (bag.length >= state.game.bagSize) bag.pop();
				cheat.give('remix');
			}
			const at = REMIX_STYLE_NAMES.indexOf(view.remixStyle) + 1;
			view.fx.pop(view.boardX + view.boardW / 2, view.boardY + view.cell * 0.6, `${REMIX_STYLES[view.remixStyle].label} (${at}/${REMIX_STYLE_NAMES.length})`, '', GOLD, true);
			useRemix();
		},
		/** Shows the next style, one after another. An empty well is filled first. */
		async nextRemix() {
			const g = state.game;
			if (!g || state.busy) return;
			if (!g.grid.some(Boolean)) {
				cheat.fill(0.6);
				await new Promise((resolve) => setTimeout(resolve, 1500));
			}
			cheat.demo = (cheat.demo + 1) % REMIX_STYLE_NAMES.length;
			cheat.remix(REMIX_STYLE_NAMES[cheat.demo]);
		},
		demo: -1,
		/** Adds Glints to the wallet: glints(500). */
		glints(n = 100) {
			store.glints = Math.max(0, store.glints + Math.floor(n));
			save();
			updateWallet(true);
			return store.glints;
		},
		/** One of each power-up. */
		all() {
			cheat.empty();
			return cheat.give(...POWER_KINDS);
		},
		empty() {
			if (state.game) state.game.bag.length = 0;
		},
		/** Adds up to n random blocks (default 50) that rise into the well. They do not match, so nothing clears. */
		drop(n = 50) {
			const g = state.game;
			if (!g || state.busy) return 0;
			const colors = g.colors;
			const heights = Array.from({ length: g.cols }, (_, x) => g.height(x));
			let added = 0;
			for (; added < n; added++) {
				const open = heights.map((h, x) => (h < g.rows ? x : -1)).filter((x) => x >= 0);
				if (!open.length) break;
				const x = open[Math.floor(Math.random() * open.length)];
				const y = heights[x]++;
				const options = [...Array(colors).keys()].sort(() => Math.random() - 0.5);
				const color = options.find((c) => g.linkedSize((i) => (g.grid[i] ? g.grid[i].color : -1), x, y, c) < 3) ?? options[0];
				const block = g.makeBlock(color);
				g.grid[g.index(x, y)] = block;
				view.vis.set(block.id, view.newVis(x, y + g.rows + 1, added * 0.012));
			}
			return added;
		},
		/** Empties the well, then fills it: fill(0.6) is 60% full. */
		fill(amount = 0.6) {
			const g = state.game;
			if (!g || state.busy) return 0;
			g.grid.fill(null);
			return cheat.drop(Math.round(g.cols * g.rows * Math.min(1, Math.max(0, amount))));
		},
		help() {
			console.info(
				[
					'Glintwell cheats',
					'  Hold Shift and press: 1 Prism, 2 Blast, 3 Remix, 4 all three, 5 drop 50 blocks, 6 fill the well, 7 next Remix style, 8 play it again, 9 add 100 Glints, 0 empty the bag',
					'  glintwell.give("remix", "blast")  add power-ups (bag holds 3)',
					'  glintwell.prism() / blast()       add one',
					'  glintwell.remix("swirl")          fire a Remix in that style (glintwell.remixStyles() lists them)',
					'  glintwell.nextRemix()             show the next Remix style',
					'  glintwell.glints(500)             add Glints to the wallet',
					'  glintwell.all() / empty()         one of each / clear the bag',
					'  glintwell.drop(50)                drop 50 random blocks into the well',
					'  glintwell.fill(0.6)               empty the well, then fill it 60%',
					'  glintwell.bot(50)                 play 50 moves',
					'  glintwell.setTime(5)              set the clock in Timed mode',
				].join('\n'),
			);
		},
	};
	const cheat = window.glintwell;
	document.addEventListener('keydown', (e) => {
		if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || state.screen !== 'playing' || state.paused || !state.game) return;
		const codes = { Digit1: () => cheat.give('prism'), Digit2: () => cheat.give('blast'), Digit3: () => cheat.give('remix'), Digit4: () => cheat.all(), Digit7: () => cheat.nextRemix(), Digit8: () => cheat.remix(), Digit9: () => cheat.glints(100), Digit5: () => cheat.drop(50), Digit6: () => cheat.fill(0.6), Digit0: () => cheat.empty() };
		const run = codes[e.code];
		if (!run) return;
		e.preventDefault();
		run();
	});
	console.info('Glintwell cheats are on. Type glintwell.help()');
}
