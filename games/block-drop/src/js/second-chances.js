// Spending Glints during a game: reroll the tray, buy more time, or get a second wind.

import { EXTEND_COST, EXTEND_SECONDS, SECOND_WIND_COST } from './prices.js';
import { canAfford } from './wallet.js';
import { audio } from './audio.js';
import { store } from './storage.js';
import { showBanner } from './dom.js';
import { state, view, save, vibrate, waitFor, canAct, cancelDrag } from './session.js';
import { bumpWallet } from './hud.js';
import { checkEnd } from './ending.js';
import { continueGame } from './flow.js';

export function rerollTray() {
	const g = state.game;
	if (!g || !canAct()) return audio.deny();
	if (!canAfford(store.glints, g.rerollCost)) return audio.deny();
	cancelDrag();
	swapTray();
	checkEnd();
}

/** Out of room, but the new pieces might fit: pay for a reroll instead of ending. */
export function rerollFromOver() {
	const g = state.game;
	if (state.screen !== 'over' || !g) return;
	if (!canAfford(store.glints, g.rerollCost)) return audio.deny();
	swapTray();
	continueGame();
	state.busy = false;
	checkEnd();
}

export function extendTime() {
	const g = state.game;
	if (state.screen !== 'over' || !g || g.extensionUsed) return;
	if (!canAfford(store.glints, EXTEND_COST)) return audio.deny();
	store.glints -= EXTEND_COST;
	g.extensionUsed = true;
	save();
	bumpWallet();
	continueGame();
	state.busy = false;
	state.timeLeft = EXTEND_SECONDS;
	state.lastTick = EXTEND_SECONDS;
	showBanner(`+${EXTEND_SECONDS} seconds!`, 900);
}

/** Game over, but the player pays to keep going: the bottom rows of the stack are cleared. Once per game. */
export async function secondWind() {
	const g = state.game;
	if (state.screen !== 'over' || !g || !g.canSecondWind) return;
	if (!canAfford(store.glints, SECOND_WIND_COST)) {
		audio.deny();
		return;
	}
	const cleared = g.useSecondWind();
	if (!cleared || !cleared.length) return;
	store.glints -= SECOND_WIND_COST;
	save();
	bumpWallet();
	continueGame();
	state.busy = true;
	view.killBlocks(cleared.map((c) => ({ ...c, delay: (c.y / g.rows) * 0.2 + Math.random() * 0.15 })));
	view.fx.shake(10);
	audio.flare();
	vibrate([30, 40, 30]);
	showBanner('Second wind!', 1100);
	await waitFor(() => view.dying.length === 0);
	if (state.game !== g) return;
	await waitFor(() => view.settled);
	state.busy = false;
	checkEnd();
}

function swapTray() {
	const g = state.game;
	store.glints -= g.rerollCost;
	save();
	g.reroll();
	g.pieces.forEach((_, i) => view.pieceSpawned(i));
	audio.forge('flare');
	vibrate(10);
	bumpWallet();
}
