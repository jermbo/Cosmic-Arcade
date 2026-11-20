// The live session: which screen is open, which game runs, and the view that draws it.
// Every screen reads and changes this one state object.

import { View } from '../view/view.js';
import { store, persist } from '../app/storage.js';
import { $ } from '../app/dom.js';

export const app = $('app');
export const canvas = $('stage');
export const view = new View(canvas);

export const state = {
	screen: 'title', // 'title' | 'playing' | 'ending' | 'over'
	paused: false,
	game: null,
	mode: 'endless', // 'endless' | 'timed'
	pendingMode: 'endless', // the mode the boosts screen will start
	busy: false, // true while a move or a power-up plays: the player waits
	timeLeft: 0, // Timed: seconds on the clock
	lastTick: 0, // Timed: the last whole second that ticked
	shownScore: 0, // the score on the screen counts up to the real one
	freeGlints: 0, // glints the game had before the player took over (warm-up earnings are not banked)
	bankedGlints: 0, // glints of this game already moved into the wallet
	drag: null, // the piece in the player's hand
	power: null, // the power-up being used: { kind, stage, color }
	aiming: null, // the pointer id while a Blast is being aimed
	modalReturn: null, // the screen to go back to when a modal closes
	afterTutorial: null, // what to do when the tutorial closes
	usedLab: false, // this game uses Lab settings, so its score is marked
};

/** Buzzes the phone, if the player allows it and the browser can. */
export function vibrate(pattern) {
	if (!store.settings.vibrate || !navigator.vibrate) return;
	if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
	try {
		navigator.vibrate(pattern);
	} catch {
		// Some browsers throw when vibration is blocked.
	}
}

/** Saves the store. A note shows on the title screen when the browser blocks storage. */
export function save() {
	$('storage-note').hidden = persist();
}

// ---- waiting for the view ----
// A move waits for the animations: "await waitFor(() => view.settled)" goes on once every block is in place.

const waiters = [];

/** A promise that resolves once test() is true. The main loop checks it once each frame. */
export function waitFor(test) {
	return new Promise((resolve) => waiters.push({ test, resolve }));
}

/** Resolves the waiters whose test now passes. The main loop calls this once each frame. */
export function runWaiters() {
	for (let i = waiters.length - 1; i >= 0; i--) {
		if (!waiters[i].test()) continue;
		const [waiter] = waiters.splice(i, 1);
		waiter.resolve();
	}
}

// ---- what the player may do ----

/** True when the player may make a move now. */
export function canAct() {
	const outOfTime = state.mode === 'timed' && state.timeLeft <= 0;
	return state.screen === 'playing' && !state.paused && !state.busy && !outOfTime;
}

/** Lets go of the piece in the player's hand. It flies back to the tray. */
export function cancelDrag() {
	const drag = state.drag;
	if (!drag) return;
	if (drag.moved && drag.geometry) view.returning = { slot: drag.slot, x: drag.geometry.left, y: drag.geometry.top, t: 0 };
	state.drag = null;
	view.drag = null;
}

/** Starts using a power-up (or stops, with null). */
export function setPower(power) {
	state.power = power;
	view.power = power;
	view.aim = null;
	state.aiming = null;
}

export function cancelPower() {
	if (state.power) setPower(null);
}
