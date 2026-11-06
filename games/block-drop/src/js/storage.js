// Saves scores and settings in localStorage. Storage can fail (private mode,
// full disk, blocked site data), so every call is wrapped and the game keeps going.

import { DEFAULT_LAB } from './engine.js';

const KEY = 'glintwell.save.v1';

const DEFAULTS = {
	best: { endless: 0, timed: 0 },
	settings: { sfx: true, music: true, vibrate: true, shake: true },
	lab: { ...DEFAULT_LAB },
	tutorialDone: false,
	iosHintDismissed: false,
};

function read() {
	try {
		const raw = window.localStorage.getItem(KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function write(data) {
	try {
		window.localStorage.setItem(KEY, JSON.stringify(data));
		return true;
	} catch {
		return false;
	}
}

const saved = read() || {};
export const store = {
	best: { ...DEFAULTS.best, ...saved.best },
	settings: { ...DEFAULTS.settings, ...saved.settings },
	lab: { ...DEFAULTS.lab, ...saved.lab },
	tutorialDone: Boolean(saved.tutorialDone),
	iosHintDismissed: Boolean(saved.iosHintDismissed),
	hintDone: Boolean(saved.hintDone),
};

export function persist() {
	return write(store);
}

export function labIsDefault() {
	return Object.keys(DEFAULT_LAB).every((k) => store.lab[k] === DEFAULT_LAB[k]);
}
