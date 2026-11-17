// The game over screen: the score, the stats, and what the player can buy to keep going.

import { SECOND_WIND_COST, EXTEND_COST } from './prices.js';
import { canAfford } from './wallet.js';
import { store } from './storage.js';
import { $, showModal, setPlunkText } from './dom.js';
import { audio } from './audio.js';
import { state, vibrate } from './session.js';
import { bestOf, updateWallet } from './hud.js';

export function showOver({ game, reason, isBest }) {
	showResult({ game, reason, isBest });
	showStats(game);
	showContinues(game, reason);
	updateWallet();
	$('over-lab').hidden = !state.usedLab;
	showModal('screen-over');
}

function showResult({ game, reason, isBest }) {
	$('over-reason').textContent = reason === 'time' ? 'Time is up' : 'No room left';
	$('new-best').hidden = true;
	countUp(game.score, () => {
		if (isBest && game.score > 0) stampNewBest();
	});
	$('over-best').textContent = bestOf(state.mode).toLocaleString();
}

const COUNT_TIME = 0.9; // seconds for the final score to count up

/** The final score counts up from 0, fast at first and slow at the end. Then done() runs. */
function countUp(score, done) {
	const el = $('final-score');
	const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (still || score === 0) {
		el.textContent = score.toLocaleString();
		done();
		return;
	}
	const start = performance.now();
	let lastTick = 0;
	const step = (now) => {
		const k = Math.min(1, (now - start) / 1000 / COUNT_TIME);
		const shown = Math.round(score * (1 - Math.pow(1 - k, 3)));
		el.textContent = shown.toLocaleString();
		if (now - lastTick > 70 && k < 1) {
			lastTick = now;
			audio.move();
		}
		if (k < 1) requestAnimationFrame(step);
		else done();
	};
	requestAnimationFrame(step);
}

/** A new best: a sticker is stamped on the score card. */
function stampNewBest() {
	const el = $('new-best');
	el.hidden = false;
	audio.land(3);
	vibrate([20, 40, 20]);
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
	setPlunkText($(`${id}-cost`), ok ? `✦ ${cost}${note}` : `✦ ${cost} · you have ✦ ${store.glints}`);
}
