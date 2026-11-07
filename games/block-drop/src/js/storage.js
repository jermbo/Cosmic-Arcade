// Saves scores and settings in localStorage. Storage can fail (private mode,
// full disk, blocked site data), so every call is wrapped and the game keeps going.

import { DEFAULT_LAB } from './engine.js';

const KEY = 'glintwell.save.v1';

const DEFAULTS = {
	best: { endless: 0, timed: 0 },
	settings: { sfx: true, music: true, vibrate: true, shake: true },
	lab: { ...DEFAULT_LAB },
	glints: 0,
	perks: { bag: 0, skins: ['classic'], skin: 'classic' },
	daily: { date: '', best: 0, claimed: false },
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
	daily: { ...DEFAULTS.daily, ...saved.daily },
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
