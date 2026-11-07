// Keyboard play: move along the well, pick a piece, drop it, and pause.

import { audio } from './audio.js';
import { $ } from './dom.js';
import { state, view, canAct } from './session.js';
import { dropPiece, DROP_START_BELOW_WELL } from './move.js';
import { pause, resume } from './flow.js';

const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'Enter', 'Tab', '1', '2', '3'];

document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
		togglePause(e);
		return;
	}
	if (state.screen !== 'playing' || state.paused) return;
	if (!GAME_KEYS.includes(e.key)) return;
	e.preventDefault();
	if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
	if (!canAct() || state.power) return;
	moveSelection(e);
});

function togglePause(e) {
	if (state.screen !== 'playing') return;
	if (state.paused && !$('screen-pause').hidden) resume();
	else pause();
	e.preventDefault();
}

/** The first key press only shows the selection. After that, the keys move it and drop the piece. */
function moveSelection(e) {
	const g = state.game;
	const hadSelection = Boolean(view.keyCursor);
	if (!hadSelection) view.keyCursor = newSelection();
	const cursor = view.keyCursor;
	const piece = g.pieces[cursor.slot];
	switch (e.key) {
		case 'ArrowLeft':
			if (hadSelection) cursor.col = Math.max(0, Math.min(cursor.col, g.cols - (piece ? piece.w : 1)) - 1);
			audio.move();
			break;
		case 'ArrowRight':
			if (hadSelection) cursor.col = Math.min(g.cols - (piece ? piece.w : 1), cursor.col + 1);
			audio.move();
			break;
		case 'ArrowDown':
		case 'Tab': {
			const n = g.pieces.length;
			cursor.slot = (cursor.slot + (e.shiftKey ? n - 1 : 1)) % n;
			audio.move();
			break;
		}
		case '1':
		case '2':
		case '3': {
			const i = Number(e.key) - 1;
			if (i < g.pieces.length) cursor.slot = i;
			break;
		}
		case ' ':
		case 'Enter':
			if (hadSelection) keyDrop();
			break;
	}
}

function newSelection() {
	const slot = Math.max(0, state.game.pieces.findIndex((p) => p));
	return { slot, col: Math.floor((state.game.cols - 1) / 2) };
}

function keyDrop() {
	const g = state.game;
	const piece = g.pieces[view.keyCursor.slot];
	if (!piece) return;
	const col = Math.min(view.keyCursor.col, g.cols - piece.w);
	if (!g.fits(piece, col)) {
		audio.deny();
		view.fx.shake(3);
		return;
	}
	dropPiece({ slot: view.keyCursor.slot, piece, col, left: col, top: g.rows + DROP_START_BELOW_WELL });
}
