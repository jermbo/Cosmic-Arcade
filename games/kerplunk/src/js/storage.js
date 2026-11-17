// Saves scores and settings in localStorage. Storage can fail (private mode,
// full disk, blocked site data), so every call is wrapped and the game keeps going.

import { DEFAULT_LAB } from './engine.js';

const KEY = 'kerplunk.save.v2';

const DEFAULTS = {
	best: { endless: 0, timed: 0 },
	settings: { sfx: true, music: true, vibrate: true, shake: true },
	lab: { ...DEFAULT_LAB },
	glints: 0,
	perks: { bag: 0 },
	// The looks: the owned and the active theme and block style, and the last Random roll.
	looks: { themes: ['light'], theme: 'light', styles: ['patterns'], style: 'patterns', roll: null },
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
	glints: Math.max(0, Math.floor(Number(saved.glints) || 0)),
	perks: { ...DEFAULTS.perks, ...saved.perks },
	looks: { ...DEFAULTS.looks, ...saved.looks },
	tutorialDone: Boolean(saved.tutorialDone),
	iosHintDismissed: Boolean(saved.iosHintDismissed),
	hintDone: Boolean(saved.hintDone),
};

// Shapes made in the secret shape lab (shape-lab.html). Kept apart from the save so a reset never wipes them.
const SHAPES_KEY = 'glintwell.shapes.v1';

export function loadCustomShapes() {
	try {
		const raw = window.localStorage.getItem(SHAPES_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function saveCustomShapes(list) {
	try {
		window.localStorage.setItem(SHAPES_KEY, JSON.stringify(list));
		return true;
	} catch {
		return false;
	}
}

export function clearCustomShapes() {
	try {
		window.localStorage.removeItem(SHAPES_KEY);
		return true;
	} catch {
		return false;
	}
}

export function persist() {
	return write(store);
}

export function labIsDefault() {
	return Object.keys(DEFAULT_LAB).every((k) => store.lab[k] === DEFAULT_LAB[k]);
}
