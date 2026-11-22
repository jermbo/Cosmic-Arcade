// The life of a game: start it, pause it, and go back to the title.
// Start: the tutorial first (once), then the boosts screen (when the player has Plunks to spend),
// then the game.

import { Game } from '../rules/game.js';
import { BAG_SIZE } from '../rules/power-ups.js';
import { TIMED_SECONDS } from '../rules/timed-mode.js';
import { randomSeed } from '../rules/random.js';
import { autoPlay, WARMUP_ROUNDS } from '../rules/bot.js';
import { audio } from '../audio/sound-player.js';
import { store, labIsDefault } from '../app/storage.js';
import { $, hideModals, showModal, showBanner } from '../app/dom.js';
import { app, state, view, cancelDrag, cancelPower } from './session.js';
import { updateHud, updateWallet } from '../screens/hud.js';
import { updateBestLabels } from '../screens/title.js';
import { canOfferBoosts, openBoosts } from '../screens/boosts-screen.js';
import { actAuto } from './use-power-ups.js';
import { rollForGame } from '../looks/looks.js';
import { checkEnd } from './game-end.js';
import { openTutorial } from '../screens/tutorial/tutorial.js';

/** The Play button of a mode. */
export function startGame(mode) {
	if (!store.tutorialDone) {
		state.afterTutorial = () => startGame(mode);
		openTutorial();
		return;
	}
	state.pendingMode = mode;
	// With Plunks to spend, offer boosts for this game first.
	if (canOfferBoosts()) {
		openBoosts();
		return;
	}
	beginGame(mode, null);
}

/** Starts a game of this mode, with the boosts the player bought ({ warmup, power, ban }, or null). */
export function beginGame(mode, boosts) {
	hideModals();
	$('screen-title').hidden = true;
	$('banner').hidden = true;
	state.mode = mode;
	rollForGame(); // with Random in use, each new game gets a new look
	state.game = createGame(mode, boosts);
	resetRound();
	const warmedUp = Boolean(boosts && boosts.warmup);
	showRound(mode, warmedUp);
	if (state.game.autoPowers && state.game.bag.length) actStartPowers(state.game);
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

/** Timed: a "Start with a power-up" boost acts at the start of the game. */
async function actStartPowers(game) {
	state.busy = true;
	while (state.game === game && game.bag.length) await actAuto(game.bag[0]);
	if (state.game !== game) return;
	state.busy = false;
	checkEnd();
}

/** Puts the session state back to the start of a round. */
function resetRound() {
	Object.assign(state, {
		freeGlints: state.game.glints,
		bankedGlints: state.game.glints,
		usedLab: !labIsDefault(),
		screen: 'playing',
		paused: false,
		busy: false,
		timeLeft: TIMED_SECONDS,
		lastTick: TIMED_SECONDS,
		shownScore: 0,
		drag: null,
		power: null,
		aiming: null,
	});
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
	Object.assign(state, { screen: 'title', paused: false, game: null, power: null });
	view.power = null;
	view.game = null;
	view.effects.clear();
	view.layout();
	app.dataset.screen = 'title';
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
