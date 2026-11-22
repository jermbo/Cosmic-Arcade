// What the player sees while playing: score, best, clock, and the Plunks wallet.

import { TIMED_SECONDS, LOW_TIME_SECONDS } from '../rules/timed-mode.js';
import { REROLL_COST } from '../shop/prices.js';
import { canAfford, bestScore } from '../shop/wallet.js';
import { store } from '../app/storage.js';
import { $, bump, replayAnimation } from '../app/dom.js';
import { state, save } from '../play/session.js';

const SCORE_COUNT_SPEED = 9; // the shown score closes this much of the gap each second

/** Seconds as "m:ss". */
export function formatTime(seconds) {
	const whole = Math.max(0, Math.ceil(seconds));
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The best score saved for a mode. */
export const bestOf = (mode) => bestScore(store, mode);

const walletViews = [];

/** A screen that shows the wallet asks to be redrawn each time the wallet changes. */
export function onWalletUpdate(redraw) {
	walletViews.push(redraw);
}

/** Shows the wallet on the HUD and title, and the cost of the reroll button. */
export function updateWallet() {
	const amount = store.glints.toLocaleString();
	$('glints').textContent = amount;
	$('wallet-title').querySelector('.wallet__n').textContent = amount;
	const game = state.game;
	const cost = game ? game.rerollCost : REROLL_COST;
	$('reroll-cost').textContent = `✦${cost}`;
	$('reroll').setAttribute('aria-disabled', String(!game || !canAfford(store.glints, cost)));
	for (const redraw of walletViews) redraw();
}

/** Shows the wallet, and makes the Plunks on the HUD pop to show that they changed. */
export function bumpWallet() {
	updateWallet();
	bump($('hud-glints'));
}

/** Moves Plunks the player just earned into the wallet. */
export function bankGlints() {
	const game = state.game;
	if (!game || game.glints <= state.bankedGlints) return;
	store.glints += game.glints - state.bankedGlints;
	state.bankedGlints = game.glints;
	save();
	bumpWallet();
}

/** Timed: adds seconds to the clock, and shows a "+Ns" sticker on it. */
export function addTime(seconds) {
	if (seconds <= 0) return;
	state.timeLeft += seconds;
	const sticker = $('time-plus');
	sticker.textContent = `+${seconds}s`;
	sticker.hidden = false;
	replayAnimation(sticker, 'is-shown');
}

/** Called every frame: the score counts up, and the clock runs. */
export function updateHud(dt) {
	const game = state.game;
	if (!game) return;
	countScoreUp(game.score, dt);
	$('best').textContent = Math.max(bestOf(state.mode), game.score).toLocaleString();
	if (state.mode === 'timed') showClock();
}

function countScoreUp(target, dt) {
	if (state.shownScore === target) return;
	const step = Math.max(1, Math.ceil((target - state.shownScore) * Math.min(1, dt * SCORE_COUNT_SPEED)));
	state.shownScore = Math.min(target, state.shownScore + step);
	$('score').textContent = state.shownScore.toLocaleString();
}

function showClock() {
	$('time').textContent = formatTime(state.timeLeft);
	// The bar fills to TIMED_SECONDS at most; the number shows the real time.
	const fill = Math.min(1, Math.max(0, state.timeLeft / TIMED_SECONDS));
	$('time-fill').style.transform = `scaleX(${fill})`;
	$('time-box').classList.toggle('is-low', state.timeLeft <= LOW_TIME_SECONDS);
}
