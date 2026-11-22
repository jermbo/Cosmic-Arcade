// Using power-ups in the page: choosing one in the bar, aiming it, and playing what it does.
// (The rules of each power-up are in rules/power-ups.js.)

import { audio } from '../audio/sound-player.js';
import { POWER_NAMES } from '../view/power-icons.js';
import { canvas, state, view, vibrate, waitFor, setPower } from './session.js';
import { capturePointer } from '../app/dom.js';
import { resolveChain } from './move.js';
import { checkEnd } from './game-end.js';

/** Tapping a chip in the bar. Remix fires at once; the others wait for a target. */
export function activatePower(index) {
	const kind = state.game.bag[index];
	if (!kind) return;
	audio.ui();
	if (kind === 'remix') useRemix();
	else setPower({ kind, stage: kind === 'prism' ? 'color' : 'aim', color: null });
}

/** Runs a power-up move: the player waits while it plays, then the game checks for its end. */
async function playPowerMove(game, play) {
	state.busy = true;
	await play();
	if (state.game !== game) return; // the player left the game while it played
	state.busy = false;
	checkEnd();
}

export async function useRemix() {
	const game = state.game;
	const moves = game.useRemix();
	if (!moves) return;
	await playPowerMove(game, async () => {
		await showRemix(moves);
		// On a crowded board a few matches can remain. They clear like any other chain.
		if (state.game === game) await resolveChain();
	});
}

function showRemix(moves) {
	view.startRemix(moves);
	return waitFor(() => !view.remix);
}

export async function fireBlast(x, y) {
	const game = state.game;
	if (!game.useBlast(x, y)) {
		audio.deny();
		return;
	}
	setPower(null);
	await playPowerMove(game, resolveChain);
}

/** A Prism with its color picked paints the piece in this slot. */
function paintSlot(slot) {
	if (!state.game.usePrism(slot, state.power.color)) return;
	setPower(null);
	view.pieceSpawned(slot);
	audio.powerUpEarned();
	vibrate(10);
}

/**
 * Timed: an earned power-up acts by itself, with the same animation as a tapped one,
 * and a sticker with its name. The caller keeps state.busy on while it runs.
 */
export async function actAuto(kind) {
	const game = state.game;
	const middle = view.cellCenter((game.cols - 1) / 2, (game.rows - 1) / 2);
	view.effects.sticker({ x: middle.x, y: middle.y, text: POWER_NAMES[kind], sub: '', big: true });
	if (kind === 'prism') autoPrism(game);
	else if (kind === 'blast') await autoBlast(game);
	else await autoRemix(game);
	// A power-up that had nothing to act on is spent all the same: Timed has no bar to keep it in.
	if (state.game === game) game.takeFromBag(kind);
}

function autoPrism(game) {
	if (game.autoPrism() === null) return;
	game.pieces.forEach((piece, slot) => piece && view.pieceSpawned(slot));
	audio.powerUpEarned();
	vibrate(10);
}

async function autoBlast(game) {
	const cell = game.bestBlastCell();
	if (cell && game.useBlast(cell.x, cell.y)) await resolveChain();
}

async function autoRemix(game) {
	const moves = game.useRemix();
	if (!moves) return;
	await showRemix(moves);
	if (state.game === game) await resolveChain();
}

/** A pointer goes down while a power-up waits for its target. point is in canvas pixels. */
export function powerPointerDown(event, point) {
	const power = state.power;
	const button = view.hitBar(point.x, point.y);
	if (button && button.type === 'cancel') {
		audio.ui();
		setPower(null);
		return;
	}
	if (power.kind === 'prism' && power.stage === 'color') {
		pickPrismColor(power, button);
		return;
	}
	if (power.kind === 'prism') {
		const slot = view.hitSlot(point.x, point.y);
		if (slot !== null && state.game.pieces[slot]) paintSlot(slot);
		return;
	}
	startAiming(event, point);
}

function pickPrismColor(power, button) {
	if (!button || button.type !== 'color') return;
	audio.ui();
	power.color = button.color;
	power.stage = 'piece';
}

/** A Blast: the finger aims it while it is down, and the Blast fires when it lets go (see pointer.js). */
function startAiming(event, point) {
	const cell = view.cellAt(point.x, point.y);
	if (!cell) return;
	state.aiming = event.pointerId;
	view.aim = cell;
	capturePointer(canvas, event.pointerId);
}
