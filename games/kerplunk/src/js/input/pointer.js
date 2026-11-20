// Touch and mouse on the canvas: drag a piece into the well, tap a power-up, or aim a Blast.

import { audio } from '../audio/sound-player.js';
import { capturePointer } from '../app/dom.js';
import { canvas, state, view, vibrate, canAct, cancelDrag } from '../play/session.js';
import { dropPiece } from '../play/move.js';
import { activatePower, powerPointerDown, fireBlast } from '../play/use-power-ups.js';

const DRAG_START_PX = 9; // a touch must move this far to count as a drag

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerCancel);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

/** The point of a pointer event, in canvas pixels. */
function localPoint(event) {
	const rect = canvas.getBoundingClientRect();
	return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function onPointerDown(event) {
	if (!canAct() || state.drag) return;
	const point = localPoint(event);
	if (state.power) {
		event.preventDefault();
		powerPointerDown(event, point);
		return;
	}
	const button = view.hitBar(point.x, point.y);
	if (button && button.type === 'chip') {
		event.preventDefault();
		activatePower(button.index);
		return;
	}
	const slot = view.hitSlot(point.x, point.y);
	if (slot === null || !state.game.pieces[slot]) return;
	event.preventDefault();
	pickUpPiece(event, slot, point);
}

/** The piece stays in its slot until the pointer moves far enough to count as a drag. */
function pickUpPiece(event, slot, point) {
	state.drag = {
		slot,
		id: event.pointerId,
		startX: point.x,
		startY: point.y,
		moved: false,
		piece: state.game.pieces[slot],
		touch: event.pointerType !== 'mouse',
		geometry: null, // where the piece is now (see view.dragGeometry)
	};
	view.drag = state.drag;
	view.keyCursor = null;
	capturePointer(canvas, event.pointerId);
}

function onPointerMove(event) {
	if (state.power && state.power.kind === 'blast') {
		aimBlast(event);
		return;
	}
	const drag = state.drag;
	if (!drag || event.pointerId !== drag.id) return;
	const point = localPoint(event);
	if (!drag.moved && Math.hypot(point.x - drag.startX, point.y - drag.startY) > DRAG_START_PX) {
		drag.moved = true;
		audio.pick();
		vibrate(4);
	}
	if (!drag.moved) return;
	const geometry = view.dragGeometry(drag.piece, point, drag.touch);
	const changedColumn = geometry.over && drag.geometry && drag.geometry.over && geometry.col !== drag.geometry.col;
	if (changedColumn) audio.move();
	drag.geometry = geometry;
}

/** A mouse previews the Blast as it moves; a finger aims while it is down. */
function aimBlast(event) {
	const point = localPoint(event);
	const cell = view.cellAt(point.x, point.y);
	if (cell && (event.pointerType === 'mouse' || state.aiming === event.pointerId)) view.aim = cell;
}

function onPointerUp(event) {
	if (state.aiming === event.pointerId) {
		releaseBlast(event);
		return;
	}
	const drag = state.drag;
	if (!drag || event.pointerId !== drag.id) return;
	state.drag = null;
	view.drag = null;
	if (!drag.moved) return;
	const geometry = drag.geometry;
	if (geometry && geometry.valid && canAct()) {
		const left = (geometry.left - view.boardX) / view.cell;
		const top = (geometry.top - view.boardY) / view.cell;
		dropPiece({ slot: drag.slot, piece: drag.piece, col: geometry.col, left, top });
		return;
	}
	// It does not fit here: it flies back to the tray.
	if (geometry && geometry.over) audio.deny();
	view.returning = { slot: drag.slot, x: geometry ? geometry.left : drag.startX, y: geometry ? geometry.top : drag.startY, t: 0 };
}

/** Letting go of the well fires the Blast where the finger is. */
function releaseBlast(event) {
	state.aiming = null;
	const point = localPoint(event);
	const cell = view.cellAt(point.x, point.y);
	if (cell && canAct()) fireBlast(cell.x, cell.y);
	else view.aim = null;
}

function onPointerCancel() {
	if (state.aiming !== null) {
		state.aiming = null;
		view.aim = null;
	}
	cancelDrag();
}
