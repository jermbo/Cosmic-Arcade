// Touch and mouse on the canvas: drag a piece into the well, or aim a power-up.

import { audio } from './audio.js';
import { capturePointer } from './dom.js';
import { canvas, state, view, vibrate, canAct, cancelDrag } from './session.js';
import { dropPiece } from './move.js';
import { activatePower, powerPointerDown, fireBlast } from './powers.js';

const DRAG_START_PX = 9; // a touch must move this far to count as a drag

canvas.addEventListener('pointerdown', (e) => {
	if (!canAct() || state.drag) return;
	const p = localPoint(e);
	if (state.power) {
		e.preventDefault();
		powerPointerDown(e, p);
		return;
	}
	const chip = view.hitBar(p.x, p.y);
	if (chip && chip.type === 'chip') {
		e.preventDefault();
		activatePower(chip.index);
		return;
	}
	const slot = view.hitSlot(p.x, p.y);
	if (slot === null || !state.game.pieces[slot]) return;
	e.preventDefault();
	state.drag = { slot, id: e.pointerId, sx: p.x, sy: p.y, moved: false, piece: state.game.pieces[slot], touch: e.pointerType !== 'mouse', geometry: null };
	view.drag = state.drag;
	view.keyCursor = null;
	capturePointer(canvas, e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
	if (state.power && state.power.kind === 'blast') {
		// A mouse previews the blast as it moves; a finger aims while it is down.
		const p = localPoint(e);
		const cell = view.cellAt(p.x, p.y);
		if (cell && (e.pointerType === 'mouse' || state.aiming === e.pointerId)) view.aim = cell;
		return;
	}
	const d = state.drag;
	if (!d || e.pointerId !== d.id) return;
	const p = localPoint(e);
	if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > DRAG_START_PX) {
		d.moved = true;
		audio.pick();
		vibrate(4);
	}
	if (!d.moved) return;
	const geometry = view.dragGeometry(d.piece, p, d.touch);
	if (geometry.over && d.geometry && d.geometry.over && geometry.col !== d.geometry.col) audio.move();
	d.geometry = geometry;
});

canvas.addEventListener('pointerup', (e) => {
	if (state.aiming === e.pointerId) {
		state.aiming = null;
		const p = localPoint(e);
		const cell = view.cellAt(p.x, p.y);
		if (cell && canAct()) fireBlast(cell.x, cell.y);
		else view.aim = null;
		return;
	}
	const d = state.drag;
	if (!d || e.pointerId !== d.id) return;
	state.drag = null;
	view.drag = null;
	if (!d.moved) return;
	const geometry = d.geometry;
	if (geometry && geometry.valid && canAct()) {
		dropPiece({ slot: d.slot, piece: d.piece, col: geometry.col, left: (geometry.left - view.boardX) / view.cell, top: (geometry.top - view.boardY) / view.cell });
	} else {
		if (geometry && geometry.over) audio.deny();
		view.returning = { slot: d.slot, x: geometry ? geometry.left : d.sx, y: geometry ? geometry.top : d.sy, t: 0 };
	}
});

canvas.addEventListener('pointercancel', () => {
	if (state.aiming !== null) {
		state.aiming = null;
		view.aim = null;
	}
	cancelDrag();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function localPoint(e) {
	const r = canvas.getBoundingClientRect();
	return { x: e.clientX - r.left, y: e.clientY - r.top };
}
