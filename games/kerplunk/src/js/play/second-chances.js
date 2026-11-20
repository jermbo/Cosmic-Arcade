// Spending Plunks during a game: reroll the tray, buy more time, or get a second wind.

import { EXTEND_COST, EXTEND_SECONDS, SECOND_WIND_COST } from '../shop/prices.js';
import { canAfford } from '../shop/wallet.js';
import { audio } from '../audio/sound-player.js';
import { store } from '../app/storage.js';
import { showBanner } from '../app/dom.js';
import { state, view, save, vibrate, waitFor, canAct, cancelDrag } from './session.js';
import { bumpWallet } from '../screens/hud.js';
import { checkEnd } from './game-end.js';
import { continueGame } from './game-flow.js';

/** The Reroll button during a game. */
export function rerollTray() {
	const game = state.game;
	if (!game || !canAct()) return audio.deny();
	if (!canAfford(store.glints, game.rerollCost)) return audio.deny();
	cancelDrag();
	swapTray();
	checkEnd();
}

/** Out of room, but the new pieces might fit: pay for a reroll instead of ending. */
export function rerollFromOver() {
	const game = state.game;
	if (state.screen !== 'over' || !game) return;
	if (!canAfford(store.glints, game.rerollCost)) return audio.deny();
	swapTray();
	continueGame();
	state.busy = false;
	checkEnd();
}

/** Timed: out of time, so pay for EXTEND_SECONDS more. Once per game. */
export function extendTime() {
	const game = state.game;
	if (state.screen !== 'over' || !game || game.extensionUsed) return;
	if (!canAfford(store.glints, EXTEND_COST)) return audio.deny();
	pay(EXTEND_COST);
	game.extensionUsed = true;
	continueGame();
	state.busy = false;
	state.timeLeft = EXTEND_SECONDS;
	state.lastTick = EXTEND_SECONDS;
	showBanner(`+${EXTEND_SECONDS} seconds!`, 900);
}

/** Game over, but the player pays to keep going: the bottom rows of the stack are cleared. Once per game. */
export async function secondWind() {
	const game = state.game;
	if (state.screen !== 'over' || !game || !game.canSecondWind) return;
	if (!canAfford(store.glints, SECOND_WIND_COST)) {
		audio.deny();
		return;
	}
	const cleared = game.useSecondWind();
	if (!cleared || !cleared.length) return;
	pay(SECOND_WIND_COST);
	continueGame();
	state.busy = true;
	showSecondWind(game, cleared);
	await waitFor(() => view.dying.length === 0);
	if (state.game !== game) return;
	await waitFor(() => view.settled);
	state.busy = false;
	checkEnd();
}

/** The cleared rows break apart from the ceiling down, with a shake and a boom. */
function showSecondWind(game, cleared) {
	const withDelays = cleared.map((cell) => ({ ...cell, delay: (cell.y / game.rows) * 0.2 + Math.random() * 0.15 }));
	view.killBlocks(withDelays);
	view.effects.shake(10);
	audio.blast();
	vibrate([30, 40, 30]);
	showBanner('Second wind!', 1100);
}

function pay(cost) {
	store.glints -= cost;
	save();
	bumpWallet();
}

/** Pays for a reroll and swaps the pieces in the tray. */
function swapTray() {
	const game = state.game;
	store.glints -= game.rerollCost;
	save();
	game.reroll();
	game.pieces.forEach((_, slot) => view.pieceSpawned(slot));
	audio.powerUpEarned();
	vibrate(10);
	bumpWallet();
}
