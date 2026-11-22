// Saves scores, the wallet and the settings in localStorage. Storage can fail (private mode,
// full disk, blocked site data), so every call is wrapped and the game keeps going.

import { DEFAULT_LAB } from '../rules/game-settings.js';

const SAVE_KEY = 'kerplunk.save.v2';
// Shapes made in the secret shape lab. Kept apart from the save, so a reset never wipes them.
// The key keeps the game's old name, so a list made before 2.0.0 still loads.
const SHAPES_KEY = 'glintwell.shapes.v1';

const DEFAULTS = {
	best: { endless: 0, timed: 0 },
	settings: { sfx: true, music: true, vibrate: true, shake: true },
	lab: { ...DEFAULT_LAB },
	glints: 0, // the wallet: the player sees these as Plunks
	perks: { bag: 0 }, // bag upgrades bought
	// The looks: the owned and the active theme, block style, sound profile and animation style,
	// and the last Random roll.
	looks: { themes: ['light'], theme: 'light', styles: ['patterns'], style: 'patterns', roll: null, sounds: ['wooden'], sound: 'wooden', motions: ['classic'], motion: 'classic' },
	tutorialDone: false,
	iosHintDismissed: false,
	hintDone: false, // the drag hint of a first game
};

function readJson(key) {
	try {
		const raw = window.localStorage.getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function writeJson(key, value) {
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}

const saved = readJson(SAVE_KEY) || {};

/** The saved data of the player. Change it, then call save() in play/session.js. */
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

/** Writes the store. Returns false when the browser blocks storage. */
export function persist() {
	return writeJson(SAVE_KEY, store);
}

/** True when the Lab settings are the built-in ones. */
export function labIsDefault() {
	return Object.keys(DEFAULT_LAB).every((key) => store.lab[key] === DEFAULT_LAB[key]);
}

// ---- the shape lab's shapes ----

export function loadCustomShapes() {
	return readJson(SHAPES_KEY);
}

export function saveCustomShapes(list) {
	return writeJson(SHAPES_KEY, list);
}

export function clearCustomShapes() {
	try {
		window.localStorage.removeItem(SHAPES_KEY);
		return true;
	} catch {
		return false;
	}
}
