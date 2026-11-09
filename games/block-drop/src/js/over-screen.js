// The game over screen: the score, the stats, and what the player can buy to keep going.

import { SECOND_WIND_COST, EXTEND_COST } from './prices.js';
import { canAfford } from './wallet.js';
import { store } from './storage.js';
import { $, showModal } from './dom.js';
import { state } from './session.js';
import { bestOf, updateWallet } from './hud.js';

export function showOver({ game, reason, isBest, dailyNote }) {
	showResult({ game, reason, isBest, dailyNote });
	showStats(game);
	showContinues(game, reason);
	updateWallet();
	$('over-lab').hidden = !state.usedLab;
	showModal('screen-over');
}

function showResult({ game, reason, isBest, dailyNote }) {
	$('over-reason').textContent = reason === 'time' ? 'Time is up' : 'No room left';
	$('final-score').textContent = game.score.toLocaleString();
	$('new-best').hidden = !isBest || game.score === 0;
	$('over-best').textContent = bestOf(state.mode).toLocaleString();
	$('over-daily').hidden = !dailyNote;
	$('over-daily').textContent = dailyNote;
}

function showStats(game) {
	$('over-chain').textContent = game.stats.bestChain ? `×${game.stats.bestChain}` : '–';
	$('over-cleared').textContent = game.stats.cleared;
	$('over-specials').textContent = `${game.stats.earned} · ${game.stats.used}`;
	$('over-glints').textContent = `✦ ${game.glints - state.freeGlints}`;
	$('over-wallet').textContent = `✦ ${store.glints.toLocaleString()}`;
}

/** The buttons that keep the game going: which show, and what each costs. */
function showContinues(game, reason) {
	const stuck = reason === 'stuck';
	$('second-wind').hidden = !(stuck && game.canSecondWind);
	$('reroll-over').hidden = !stuck;
	$('extend-time').hidden = !(reason === 'time' && !game.extensionUsed);
	showPrice('second-wind', SECOND_WIND_COST, ' · once per game');
	showPrice('reroll-over', game.rerollCost, '');
	showPrice('extend-time', EXTEND_COST, ' · once per game');
}

function showPrice(id, cost, note) {
	const ok = canAfford(store.glints, cost);
	$(id).setAttribute('aria-disabled', String(!ok));
	$(`${id}-cost`).textContent = ok ? `✦ ${cost}${note}` : `✦ ${cost} · you have ✦ ${store.glints}`;
}
