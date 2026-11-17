// What the player sees while playing: score, best, clock, and the Glints wallet.

import { TIMED_SECONDS, LOW_TIME_SECONDS } from './engine.js';
import { REROLL_COST } from './prices.js';
import { canAfford, bestScore } from './wallet.js';
import { store } from './storage.js';
import { $, bump } from './dom.js';
import { state, save } from './session.js';

export function formatTime(t) {
	const s = Math.max(0, Math.ceil(t));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const bestOf = (mode) => bestScore(store, mode);

const walletViews = [];

/** A screen that shows the wallet asks to be redrawn each time the wallet changes. */
export function onWalletUpdate(redraw) {
	walletViews.push(redraw);
}

/** Shows the wallet on the HUD and title, and the cost of the reroll button. */
export function updateWallet() {
	const n = store.glints.toLocaleString();
	$('glints').textContent = n;
	$('wallet-title').querySelector('.wallet__n').textContent = n;
	const g = state.game;
	const cost = g ? g.rerollCost : REROLL_COST;
	$('reroll-cost').textContent = `✦${cost}`;
	$('reroll').setAttribute('aria-disabled', String(!g || !canAfford(store.glints, cost)));
	for (const redraw of walletViews) redraw();
}

/** Shows the wallet, and makes the Glints on the HUD pop to show that they changed. */
export function bumpWallet() {
	updateWallet();
	bump($('hud-glints'));
}

/** Moves glints the player just earned into the wallet. */
export function bankGlints() {
	const g = state.game;
	if (!g || g.glints <= state.bankedGlints) return;
	store.glints += g.glints - state.bankedGlints;
	state.bankedGlints = g.glints;
	save();
	bumpWallet();
}

export function updateHud(dt) {
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
		$('time-box').classList.toggle('is-low', state.timeLeft <= LOW_TIME_SECONDS);
	}
}
