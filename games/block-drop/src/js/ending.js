// The end of a game: when it is over, what it pays, and when the game over screen shows.

import { recordBest, claimDailyBonus } from './wallet.js';
import { audio } from './audio.js';
import { store } from './storage.js';
import { $, showBanner } from './dom.js';
import { state, save, vibrate, cancelDrag, cancelPower } from './session.js';
import { bestOf } from './hud.js';
import { showOver } from './over-screen.js';

const OVER_DELAY_MS = 1300; // the banner shows this long before the game over screen

export function checkEnd() {
	if (state.screen !== 'playing' || state.busy) return;
	if (state.mode === 'timed' && state.timeLeft <= 0) endGame('time');
	else if (state.game.stuck) endGame('stuck');
}

function endGame(reason) {
	cancelDrag();
	cancelPower();
	state.screen = 'ending';
	const g = state.game;
	const isBest = g.score > bestOf(state.mode);
	if (isBest) saveBest(g.score);
	const bonus = state.mode === 'daily' ? claimDailyBonus(store.daily).bonus : 0;
	if (bonus) payDailyBonus();
	const dailyNote = bonus ? `Daily bonus: +✦${bonus}` : '';
	showBanner(reason === 'time' ? 'Time!' : 'No room!', 0);
	audio.gameOver();
	vibrate([30, 60, 30]);
	setTimeout(() => {
		if (state.game !== g) return;
		$('banner').hidden = true;
		state.screen = 'over';
		showOver({ game: g, reason, isBest, dailyNote });
		if (isBest && g.score > 0) audio.best();
	}, OVER_DELAY_MS);
}

function saveBest(score) {
	const { best, daily } = recordBest(store, state.mode, score);
	store.best = best;
	store.daily = daily;
	save();
}

function payDailyBonus() {
	const claim = claimDailyBonus(store.daily);
	store.daily = claim.daily;
	store.glints += claim.bonus;
	save();
}
