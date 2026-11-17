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

// Cleared blocks go one after the other, from the first block of the group.
const CLEAR_STAGGER = 0.035;

/** Rows below the well where a piece starts when it is dropped without a drag. */
export const DROP_START_BELOW_WELL = 0.4;

// A dropped piece lands: a thud, a buzz and a tiny shake of the well.
view.onLand = (count) => {
	audio.land(count);
	vibrate(6);
	view.fx.shake(1.5);
};

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
		showStep(step);
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

/** Plays the sound, particles and score pop for one chain step. */
function showStep(step) {
	view.holdFalls = true;
	killClearedBlocks(step);
	popStepScore(step);
	playStepSound(step);
	if (step.blast) showBlast(step.blast);
	if (step.allClear) showAllClear();
}

/** The blocks hop and fall, one after the other from the first block of each group. A blast goes from the middle outward. */
function killClearedBlocks(step) {
	const g = state.game;
	const delay = new Map();
	for (const grp of step.groups) [...grp.cells].forEach((idx, order) => delay.set(idx, order * CLEAR_STAGGER));
	if (step.blast) {
		for (const idx of step.blast.cells) {
			const d = Math.max(Math.abs(g.columnOf(idx) - step.blast.x), Math.abs(g.rowOf(idx) - step.blast.y)) * 0.05 + 0.06;
			delay.set(idx, Math.min(delay.get(idx) ?? Infinity, d));
		}
	}
	view.killBlocks(step.cleared.map((c) => ({ ...c, delay: delay.get(c.idx) ?? 0 })));
}

/** The points pop up where the blocks were, with the chain, group and Glints bonus under them. */
function popStepScore(step) {
	let sx = 0;
	let sy = 0;
	for (const c of step.cleared) {
		sx += c.x;
		sy += c.y;
	}
	const n = Math.max(1, step.cleared.length);
	const center = view.cellCenter(sx / n, sy / n);
	const parts = [];
	if (step.chain > 1) parts.push(`Chain ×${step.chain}`);
	if (step.mult > 1) parts.push(`Group ×${step.mult}`);
	if (step.glints > 0) parts.push(`+${step.glints} ${step.glints === 1 ? 'Plunk' : 'Plunks'}`);
	view.fx.pop({ x: center.x, y: center.y, text: `+${step.points.toLocaleString()}`, sub: parts.join(' · '), big: step.chain > 2 || step.mult > 1 });
	bump($('score'));
}

function playStepSound(step) {
	const biggest = Math.max(3, ...step.groups.map((grp) => grp.cells.size));
	audio.clear(step.chain, biggest);
	if (step.chain >= 3 || step.cleared.length >= 7) {
		view.fx.shake(3 + step.chain);
		vibrate(15);
	}
}

function showBlast(blast) {
	const { cell } = view;
	const c = view.cellCenter(blast.x, blast.y);
	view.fx.ring({ x: c.x, y: c.y, radius: cell * 2, width: 8, time: 0.4 });
	view.fx.shake(8);
	audio.flare();
	vibrate([20, 30, 20]);
}

function showAllClear() {
	showBanner('All clear!', 1400);
	view.fx.screenFlash(0.4, '#ffffff');
	audio.allClear();
}
