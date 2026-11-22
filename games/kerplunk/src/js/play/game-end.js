// The end of a game: when it is over, the new best score, and when the game over screen shows.

import { recordBest } from '../shop/wallet.js';
import { audio } from '../audio/sound-player.js';
import { store } from '../app/storage.js';
import { $, showBanner } from '../app/dom.js';
import { state, save, vibrate, cancelDrag, cancelPower } from './session.js';
import { bestOf } from '../screens/hud.js';
import { showGameOver } from '../screens/game-over-screen.js';

const OVER_DELAY_MS = 1300; // the banner shows this long before the game over screen
const BEST_SOUND_DELAY_MS = 900;

/** Ends the game if the clock ran out (Timed) or no piece fits. It waits while a move plays. */
export function checkEnd() {
	if (state.screen !== 'playing' || state.busy) return;
	if (state.mode === 'timed' && state.timeLeft <= 0) endGame('time');
	else if (state.game.stuck) endGame('stuck');
}

/** reason is 'time' or 'stuck'. */
function endGame(reason) {
	cancelDrag();
	cancelPower();
	state.screen = 'ending';
	const game = state.game;
	const isBest = game.score > bestOf(state.mode);
	if (isBest) saveBest(game.score);
	showBanner(reason === 'time' ? 'Time!' : 'No room!', 0);
	audio.gameOver();
	vibrate([30, 60, 30]);
	setTimeout(() => showOverScreen(game, reason, isBest), OVER_DELAY_MS);
}

function showOverScreen(game, reason, isBest) {
	if (state.game !== game) return; // the player already started a new game
	$('banner').hidden = true;
	state.screen = 'over';
	showGameOver({ game, reason, isBest });
	if (isBest && game.score > 0) setTimeout(() => audio.best(), BEST_SOUND_DELAY_MS);
}

function saveBest(score) {
	store.best = recordBest(store, state.mode, score).best;
	save();
}
