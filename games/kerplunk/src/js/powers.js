// Power-ups: choosing one, aiming it, and what each one does.

import { audio } from './audio.js';
import { POWER_NAMES } from './view.js';
import { canvas, state, view, vibrate, waitFor, setPower } from './session.js';
import { capturePointer } from './dom.js';
import { resolveChain } from './move.js';
import { checkEnd } from './ending.js';

/** Tapping a chip in the bar. Remix fires at once; the others wait for a target. */
export function activatePower(index) {
	const kind = state.game.bag[index];
	if (!kind) return;
	audio.ui();
	if (kind === 'remix') useRemix();
	else setPower({ kind, stage: kind === 'prism' ? 'color' : 'aim', color: null });
}

export async function useRemix() {
	const g = state.game;
	const moves = g.useRemix();
	if (!moves) return;
	state.busy = true;
	view.startRemix(moves);
	await waitFor(() => !view.remix);
	if (state.game !== g) return;
	// On a crowded board a few matches can remain. They clear like any other chain.
	await resolveChain();
	if (state.game !== g) return;
	state.busy = false;
	checkEnd();
}

export async function fireBlast(x, y) {
	const g = state.game;
	if (!g.useBlast(x, y)) {
		audio.deny();
		return;
	}
	setPower(null);
	state.busy = true;
	await resolveChain();
	if (state.game !== g) return;
	state.busy = false;
	checkEnd();
}

/**
 * Timed: an earned power-up acts by itself, with the same animation as a tapped one,
 * and a sticker with its name. The caller keeps state.busy on while it runs.
 */
export async function actAuto(kind) {
	const g = state.game;
	const mid = view.cellCenter((g.cols - 1) / 2, (g.rows - 1) / 2);
	view.fx.pop({ x: mid.x, y: mid.y, text: POWER_NAMES[kind], sub: '', big: true, sticker: true });
	if (kind === 'prism') {
		if (g.autoPrism() !== null) {
			g.pieces.forEach((p, i) => p && view.pieceSpawned(i));
			audio.forge('flare');
			vibrate(10);
		}
	} else if (kind === 'blast') {
		const cell = g.bestBlastCell();
		if (cell && g.useBlast(cell.x, cell.y)) await resolveChain();
	} else {
		const moves = g.useRemix();
		if (moves) {
			view.startRemix(moves);
			await waitFor(() => !view.remix);
			if (state.game === g) await resolveChain();
		}
	}
	// A power-up that had nothing to act on is spent all the same: Timed has no bar to keep it in.
	if (state.game === g) g.take(kind);
}

function paintSlot(slot) {
	const g = state.game;
	if (!g.usePrism(slot, state.power.color)) return;
	setPower(null);
	view.pieceSpawned(slot);
	audio.forge('flare');
	vibrate(10);
}

/** Pointer down while a power-up is waiting for its target. */
export function powerPointerDown(e, p) {
	const power = state.power;
	const hit = view.hitBar(p.x, p.y);
	if (hit && hit.type === 'cancel') {
		audio.ui();
		setPower(null);
	} else if (power.kind === 'prism' && power.stage === 'color') {
		if (hit && hit.type === 'color') {
			audio.ui();
			power.color = hit.color;
			power.stage = 'piece';
		}
	} else if (power.kind === 'prism') {
		const slot = view.hitSlot(p.x, p.y);
		if (slot !== null && state.game.pieces[slot]) paintSlot(slot);
	} else {
		const cell = view.cellAt(p.x, p.y);
		if (!cell) return;
		state.aiming = e.pointerId;
		view.aim = cell;
		capturePointer(canvas, e.pointerId);
	}
}
