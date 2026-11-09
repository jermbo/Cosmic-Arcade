// The live session: which screen is open, which game runs, and the view that draws it.
// Every screen reads and changes this one state.

import { View } from './view.js';
import { store, persist } from './storage.js';
import { $ } from './dom.js';

export const app = $('app');
export const canvas = $('stage');
export const view = new View(canvas);

export const state = {
	screen: 'title', // 'title' | 'playing' | 'ending' | 'over'
	paused: false,
	game: null,
	mode: 'endless',
	busy: false,
	timeLeft: 0,
	lastTick: 0,
	shownScore: 0,
	freeGlints: 0, // glints the game had before the player took over (warm-up earnings are not banked)
	bankedGlints: 0,
	drag: null,
	power: null, // power-up being used: { kind, stage, color }
	aiming: null, // pointer id while a blast is being aimed
	modalReturn: null,
	afterTutorial: null,
	usedLab: false,
};

export function vibrate(pattern) {
	if (!store.settings.vibrate || !navigator.vibrate) return;
	if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
	try {
		navigator.vibrate(pattern);
	} catch {
		// Some browsers throw when vibration is blocked.
	}
}

export function save() {
	$('storage-note').hidden = persist();
}

const waiters = [];
export function waitFor(test) {
	return new Promise((resolve) => waiters.push({ test, resolve }));
}

/** Resolves the waiters whose test now passes. The main loop calls this once for each frame. */
export function runWaiters() {
	for (let i = waiters.length - 1; i >= 0; i--) {
		if (waiters[i].test()) {
			const w = waiters.splice(i, 1)[0];
			w.resolve();
		}
	}
}

export function canAct() {
	return state.screen === 'playing' && !state.paused && !state.busy && !(state.mode === 'timed' && state.timeLeft <= 0);
}

export function cancelDrag() {
	const d = state.drag;
	if (!d) return;
	if (d.moved && d.geometry) view.returning = { slot: d.slot, x: d.geometry.left, y: d.geometry.top, t: 0 };
	state.drag = null;
	view.drag = null;
}

export function setPower(power) {
	state.power = power;
	view.power = power;
	view.aim = null;
	state.aiming = null;
}

export function cancelPower() {
	if (state.power) setPower(null);
}
