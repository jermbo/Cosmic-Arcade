// One move: the piece drops, the chain clears, and the rewards are paid.
// Each step waits for the view to finish its animation before the next one starts.

import { audio } from '../audio/sound-player.js';
import { store } from '../app/storage.js';
import { POWER_NAMES } from '../view/power-icons.js';
import { $, bump, showBanner } from '../app/dom.js';
import { state, view, save, vibrate, waitFor } from './session.js';
import { bankGlints, addTime } from '../screens/hud.js';
import { timeForTurn } from '../rules/timed-mode.js';
import { actAuto } from './use-power-ups.js';
import { checkEnd } from './game-end.js';
import { makeJuice } from './juice.js';

/** Rows below the well where a piece starts when it is dropped without a drag (keyboard and bot). */
export const DROP_START_BELOW_WELL = 0.4;

// The sounds, shakes and stickers of a move. It also plays the landing thud and the Remix show.
const juice = makeJuice({ view, vibrate, onScore: () => bump($('score')), banner: showBanner });

/**
 * Drops the piece of a tray slot into column `col`. left and top (in cells) are where the
 * piece was let go, so it rises from there.
 */
export async function dropPiece({ slot, piece, col, left, top }) {
	const game = state.game;
	state.busy = true;
	game.pieces[slot] = piece;
	// The piece rises as one rigid shape. Only after it lands do loose blocks rise to close gaps.
	const placed = game.placeRigid(slot, col, piece);
	if (!placed) {
		state.busy = false;
		return;
	}
	finishDragHint();
	vibrate(8);
	view.dropIn(placed, left, top);
	await waitFor(() => view.settled);
	if (game.settle().length) await waitFor(() => view.settled);
	if (state.game !== game) return; // the player left the game while it played

	const { length, biggest } = await resolveChain();
	if (state.game !== game) return;
	const reward = game.awardChain(length, biggest);
	for (const slot of game.refillTray()) view.pieceSpawned(slot);
	if (game.autoPowers) {
		// Timed: good chains add time, and an earned power-up acts before the next drop.
		addTime(timeForTurn(length, biggest));
		if (reward && reward.kind) await actAuto(reward.kind);
		if (state.game !== game) return;
	} else if (reward) {
		announceReward(reward);
	}
	moveKeyCursorOffEmptySlot(game);
	state.busy = false;
	checkEnd();
}

/** The first drop ends the drag hint for good. */
function finishDragHint() {
	if (!view.hint) return;
	view.hint = false;
	store.hintDone = true;
	save();
}

/** The keyboard selection moves off a slot that is now empty. */
function moveKeyCursorOffEmptySlot(game) {
	if (view.keyCursor && !game.pieces[view.keyCursor.slot]) view.keyCursor.slot = Math.max(0, game.pieces.findIndex(Boolean));
}

/** Runs the chain until the board is still. Returns how many steps it took and the biggest group cleared. */
export async function resolveChain() {
	const game = state.game;
	let length = 0;
	let biggest = 0;
	for (let chain = 1; ; chain++) {
		const step = game.resolveStep(chain);
		if (!step) break;
		length = chain;
		biggest = Math.max(biggest, step.biggest);
		juice.step(step);
		bankGlints();
		await waitFor(() => view.dying.length === 0);
		view.holdFalls = false;
		await waitFor(() => view.settled);
		if (state.game !== game) break;
	}
	return { length, biggest };
}

/** Endless: a sticker over the bar for an earned power-up, or for one lost to a full bag. */
function announceReward(reward) {
	const { bar } = view;
	const spot = { x: bar.x + bar.w / 2, y: bar.y - view.cell * 0.4 };
	if (reward.lost) {
		view.effects.sticker({ ...spot, text: 'Bag full', sub: 'power-up lost', fill: '#FF6B6B' });
		audio.deny();
		return;
	}
	view.effects.sticker({ ...spot, text: `${POWER_NAMES[reward.kind]}!`, sub: 'earned', big: true });
	audio.powerUpEarned();
	vibrate([15, 30, 15]);
}
