// The life of a game: start it, pause it, and go back to the title.

import { Game, TIMED_SECONDS, BAG_SIZE } from './engine.js';
import { autoPlay, WARMUP_ROUNDS } from './bot.js';
import { audio } from './audio.js';
import { store, labIsDefault } from './storage.js';
import { $, hideModals, showModal, showBanner } from './dom.js';
import { app, state, view, cancelDrag, cancelPower } from './session.js';
import { updateHud, updateWallet } from './hud.js';
import { updateBestLabels } from './title.js';
import { canOfferBoosts, openBoosts } from './boosts.js';
import { actAuto } from './powers.js';
import { rollForGame } from './looks.js';
import { checkEnd } from './ending.js';
import { openTutorial } from './tutorial.js';

export function startGame(mode) {
	if (!store.tutorialDone) {
		state.afterTutorial = () => startGame(mode);
		openTutorial();
		return;
	}
	state.pendingMode = mode;
	// With Glints to spend, offer boosts for this game first.
	if (canOfferBoosts()) {
		openBoosts();
		return;
	}
	beginGame(mode, null);
}

export function beginGame(mode, boosts) {
	hideModals();
	$('screen-title').hidden = true;
	$('banner').hidden = true;
	state.mode = mode;
	rollForGame(); // with Random in use, each new game gets a new look
	state.game = createGame(mode, boosts);
	resetRound(mode);
	const warmedUp = Boolean(boosts && boosts.warmup);
	showRound(mode, warmedUp);
	if (state.game.autoPowers && state.game.bag.length) actStartPowers(state.game);
}

/** Timed: a "Start with a power-up" boost acts at the start of the game. */
async function actStartPowers(game) {
	state.busy = true;
	while (state.game === game && game.bag.length) await actAuto(game.bag[0]);
	if (state.game !== game) return;
	state.busy = false;
	checkEnd();
}

/** A new game, with the boosts the player bought. */
function createGame(mode, boosts) {
	const game = new Game({
		mode,
		lab: store.lab,
		seed: randomSeed(),
		bagSize: BAG_SIZE + store.perks.bag,
		banned: boosts && boosts.ban !== null ? boosts.ban : null,
	});
	if (boosts && boosts.power) game.bag.push(boosts.power);
	if (boosts && boosts.warmup) autoPlay(game, WARMUP_ROUNDS);
	return game;
}

function randomSeed() {
	return (Math.random() * 2 ** 31) | 0;
}

/** Puts the session state back to the start of a round. */
function resetRound(mode) {
	state.freeGlints = state.game.glints;
	state.bankedGlints = state.game.glints;
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
}

function showRound(mode, warmedUp) {
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

/** Back to playing after the game over screen: the player paid to keep going. */
export function continueGame() {
	hideModals();
	state.screen = 'playing';
	state.paused = false;
}

export function quitToTitle() {
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

export function pause() {
	if (state.screen !== 'playing' || state.paused) return;
	cancelDrag();
	cancelPower();
	state.paused = true;
	showModal('screen-pause');
}

export function resume() {
	state.paused = false;
	hideModals();
}
