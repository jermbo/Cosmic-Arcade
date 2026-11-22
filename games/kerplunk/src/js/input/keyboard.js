// Keyboard play: move along the well, pick a piece, drop it, and pause.
// ← → move · ↓ or Tab next piece · 1 2 3 pick a piece · Space or Enter drop · Esc or P pause

import { audio } from '../audio/sound-player.js';
import { $ } from '../app/dom.js';
import { state, view, canAct } from '../play/session.js';
import { dropPiece, DROP_START_BELOW_WELL } from '../play/move.js';
import { pause, resume } from '../play/game-flow.js';

const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'Enter', 'Tab', '1', '2', '3'];
const PAUSE_KEYS = ['Escape', 'p', 'P'];

document.addEventListener('keydown', (event) => {
	if (PAUSE_KEYS.includes(event.key)) {
		togglePause(event);
		return;
	}
	if (state.screen !== 'playing' || state.paused) return;
	if (!GAME_KEYS.includes(event.key)) return;
	event.preventDefault();
	// A focused button would also take the key, so the focus leaves it.
	if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
	if (!canAct() || state.power) return;
	moveSelection(event);
});

function togglePause(event) {
	if (state.screen !== 'playing') return;
	if (state.paused && !$('screen-pause').hidden) resume();
	else pause();
	event.preventDefault();
}

/** The first key press only shows the selection. After that, the keys move it and drop the piece. */
function moveSelection(event) {
	const hadSelection = Boolean(view.keyCursor);
	if (!hadSelection) view.keyCursor = newSelection();
	const cursor = view.keyCursor;
	switch (event.key) {
		case 'ArrowLeft':
			if (hadSelection) moveCursor(cursor, -1);
			audio.move();
			break;
		case 'ArrowRight':
			if (hadSelection) moveCursor(cursor, 1);
			audio.move();
			break;
		case 'ArrowDown':
		case 'Tab':
			nextPiece(cursor, event.shiftKey ? -1 : 1);
			audio.move();
			break;
		case '1':
		case '2':
		case '3':
			pickSlot(cursor, Number(event.key) - 1);
			break;
		case ' ':
		case 'Enter':
			if (hadSelection) keyDrop();
			break;
	}
}

/** The piece starts in the middle of the well. */
function newSelection() {
	const slot = Math.max(0, state.game.pieces.findIndex(Boolean));
	return { slot, col: Math.floor((state.game.cols - 1) / 2) };
}

/** Moves the cursor one column left (-1) or right (1). The whole piece stays inside the well. */
function moveCursor(cursor, step) {
	const game = state.game;
	const piece = game.pieces[cursor.slot];
	const lastColumn = game.cols - (piece ? piece.w : 1);
	if (step < 0) cursor.col = Math.max(0, Math.min(cursor.col, lastColumn) - 1);
	else cursor.col = Math.min(lastColumn, cursor.col + 1);
}

/** The next tray piece (or the one before, with -1). It skips the empty slots. */
function nextPiece(cursor, direction) {
	const pieces = state.game.pieces;
	const count = pieces.length;
	for (let tries = 0; tries < count; tries++) {
		cursor.slot = (cursor.slot + (direction < 0 ? count - 1 : 1)) % count;
		if (pieces[cursor.slot]) break;
	}
}

function pickSlot(cursor, slot) {
	if (slot < state.game.pieces.length) cursor.slot = slot;
}

function keyDrop() {
	const game = state.game;
	const { slot } = view.keyCursor;
	const piece = game.pieces[slot];
	if (!piece) return;
	const col = Math.min(view.keyCursor.col, game.cols - piece.w);
	if (!game.fits(piece, col)) {
		audio.deny();
		view.effects.shake(3);
		return;
	}
	dropPiece({ slot, piece, col, left: col, top: game.rows + DROP_START_BELOW_WELL });
}
