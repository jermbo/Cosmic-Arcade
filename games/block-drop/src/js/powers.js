// Power-ups: choosing one, aiming it, and what each one does.

import { audio } from './audio.js';
import { canvas, state, view, vibrate, waitFor, setPower } from './session.js';
import { showBanner, capturePointer } from './dom.js';
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

view.onRemix = (event, value, sound) => {
	if (event === 'charge') {
		if (!value) return; // a style with no wind-up
		if (sound === 'rattle') audio.remixRattle(value);
		else audio.remixCharge();
		vibrate([20, 40, 30, 40, 40, 40, 60]);
	} else if (event === 'boom') {
		audio.remixBoom();
		vibrate([60, 30, 80]);
		showBanner('REMIX!', 1100);
	} else if (event === 'rattle') {
		audio.remixRattle(value);
		vibrate([30, 30, 30, 30, 30, 30, 30]);
	} else if (event === 'tick') {
		audio.remixTick(Math.floor(value / 2));
	}
};

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
