// One move: the piece drops, the chain clears, and the rewards are paid.

import { audio } from './audio.js';
import { store } from './storage.js';
import { POWER_NAMES } from './view.js';
import { $, bump, showBanner } from './dom.js';
import { state, view, save, vibrate, waitFor } from './session.js';
import { bankGlints, addTime } from './hud.js';
import { timeForTurn } from './engine.js';
import { actAuto } from './powers.js';
import { checkEnd } from './ending.js';
import { makeJuice } from './juice.js';

/** Rows below the well where a piece starts when it is dropped without a drag. */
export const DROP_START_BELOW_WELL = 0.4;

// The sounds, shakes and stickers of a move. It also plays the landing thud and the Remix show.
const juice = makeJuice({ view, vibrate, onScore: () => bump($('score')), banner: showBanner });

export async function dropPiece({ slot, piece, col, left, top }) {
	const g = state.game;
	state.busy = true;
	g.pieces[slot] = piece;
	// The piece rises as one rigid shape. Only after it lands do loose blocks rise to close gaps.
	const placed = g.placeRigid(slot, col, piece);
	if (!placed) {
		state.busy = false;
		return;
	}
	if (view.hint) {
		view.hint = false;
		store.hintDone = true;
		save();
	}
	vibrate(8);
	view.dropIn(placed, left, top);
	await waitFor(() => view.settled);
	if (g.settle().length) await waitFor(() => view.settled);
	if (state.game !== g) return;
	const { length, biggest } = await resolveChain();
	if (state.game !== g) return;
	const won = g.awardChain(length, biggest);
	for (const s of g.refillTray()) view.pieceSpawned(s);
	if (g.autoPowers) {
		// Timed: good chains add time, and an earned power-up acts before the next drop.
		addTime(timeForTurn(length, biggest));
		if (won && won.kind) await actAuto(won.kind);
		if (state.game !== g) return;
	} else if (won) announceReward(won);
	// The keyboard selection moves off a slot that is now empty.
	if (view.keyCursor && !g.pieces[view.keyCursor.slot]) view.keyCursor.slot = Math.max(0, g.pieces.findIndex(Boolean));
	state.busy = false;
	checkEnd();
}

/** Runs the chain until the board is still. Returns how many steps it took and the biggest group cleared. */
export async function resolveChain() {
	const g = state.game;
	let steps = 0;
	let biggest = 0;
	for (let chain = 1; ; chain++) {
		const step = g.resolveStep(chain);
		if (!step) break;
		steps = chain;
		biggest = Math.max(biggest, step.biggest);
		juice.step(step);
		bankGlints();
		await waitFor(() => view.dying.length === 0);
		view.holdFalls = false;
		await waitFor(() => view.settled);
		if (state.game !== g) return { length: steps, biggest };
	}
	return { length: steps, biggest };
}

function announceReward(won) {
	const { bar } = view;
	if (won.lost) {
		view.fx.pop({ x: bar.x + bar.w / 2, y: bar.y - view.cell * 0.4, text: 'Bag full', sub: 'power-up lost', fill: '#FF6B6B' });
		audio.deny();
		return;
	}
	const name = POWER_NAMES[won.kind];
	view.fx.pop({ x: bar.x + bar.w / 2, y: bar.y - view.cell * 0.4, text: `${name}!`, sub: 'earned', big: true });
	audio.forge('flare');
	vibrate([15, 30, 15]);
}
