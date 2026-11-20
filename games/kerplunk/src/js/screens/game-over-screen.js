// The game over screen: the score, the stats, and what the player can buy to keep going.

import { SECOND_WIND_COST, EXTEND_COST } from '../shop/prices.js';
import { canAfford } from '../shop/wallet.js';
import { store } from '../app/storage.js';
import { $, showModal, setPlunkText, prefersStillness } from '../app/dom.js';
import { audio } from '../audio/sound-player.js';
import { state, vibrate } from '../play/session.js';
import { bestOf, updateWallet } from './hud.js';

const COUNT_TIME = 0.9; // seconds for the final score to count up
const COUNT_TICK_MS = 70; // a tick sound at most this often while it counts

/** reason is 'time' or 'stuck'. */
export function showGameOver({ game, reason, isBest }) {
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

/** The final score counts up from 0, fast at first and slow at the end. Then done() runs. */
function countUp(score, done) {
	const element = $('final-score');
	if (prefersStillness() || score === 0) {
		element.textContent = score.toLocaleString();
		done();
		return;
	}
	const start = performance.now();
	let lastTick = 0;
	const step = (now) => {
		const progress = Math.min(1, (now - start) / 1000 / COUNT_TIME);
		const easeOut = 1 - Math.pow(1 - progress, 3);
		element.textContent = Math.round(score * easeOut).toLocaleString();
		if (now - lastTick > COUNT_TICK_MS && progress < 1) {
			lastTick = now;
			audio.move();
		}
		if (progress < 1) requestAnimationFrame(step);
		else done();
	};
	requestAnimationFrame(step);
}

/** A new best: a sticker is stamped on the score card. */
function stampNewBest() {
	$('new-best').hidden = false;
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
	const affordable = canAfford(store.glints, cost);
	$(id).setAttribute('aria-disabled', String(!affordable));
	setPlunkText($(`${id}-cost`), affordable ? `✦ ${cost}${note}` : `✦ ${cost} · you have ✦ ${store.glints}`);
}
