// The live feel of the game: the numbers behind the sounds and the motion, in one object.
// It starts as DEFAULT_TUNING, plus anything saved from the Feel Lab or the Sound Path.
// The labs change it live. "Save to game" keeps the changes in this browser, and the game
// uses them the next time it starts.
//
// The game reads `tuning` each time it plays a sound or draws a frame. Change values in place:
// never swap tuning.motion or tuning.sound for a new object.

import { DEFAULT_TUNING } from './default-tuning.js';

const STORAGE_KEY = 'kerplunk.tuning.v1';

const deepCopy = (value) => JSON.parse(JSON.stringify(value));

/** Copies the values of `from` into `into`, but only keys the defaults have, with the same type. */
function mergeInto(into, from, shape) {
	if (!from || typeof from !== 'object') return;
	for (const key of Object.keys(shape)) {
		if (!(key in from)) continue;
		const wanted = shape[key];
		const given = from[key];
		if (wanted && typeof wanted === 'object') mergeInto(into[key], given, wanted);
		else if (isSameKindOfValue(given, wanted)) into[key] = given;
	}
}

function isSameKindOfValue(given, wanted) {
	if (typeof given !== typeof wanted) return false;
	return typeof given !== 'number' || Number.isFinite(given);
}

function readSaved() {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export const tuning = deepCopy(DEFAULT_TUNING);
const saved = typeof window === 'undefined' ? null : readSaved();
mergeInto(tuning, saved, DEFAULT_TUNING);
if (saved) console.info('Kerplunk: playing with the feel saved from the Feel Lab.');

/** True when this browser has a feel saved from the lab. */
export function hasSavedTuning() {
	return Boolean(readSaved());
}

/** Sets part of the tuning, in place. `values` is shaped like DEFAULT_TUNING (or a part of it). */
export function setTuning(values) {
	mergeInto(tuning, values, DEFAULT_TUNING);
}

/** Puts one part ('motion' or 'sound'), or all of it, back to the built-in values. */
export function resetTuning(part) {
	const fresh = deepCopy(DEFAULT_TUNING);
	if (part) setTuning({ [part]: fresh[part] });
	else setTuning(fresh);
}

/** Only the values that differ from the built-in ones. */
export function tuningDiff(from = tuning, base = DEFAULT_TUNING) {
	const changed = {};
	for (const key of Object.keys(base)) {
		if (base[key] && typeof base[key] === 'object') {
			const inner = tuningDiff(from[key], base[key]);
			if (Object.keys(inner).length) changed[key] = inner;
		} else if (from[key] !== base[key]) {
			changed[key] = from[key];
		}
	}
	return changed;
}

/** Keeps the tuning in this browser. Returns false when the browser blocks storage. */
export function saveTuning() {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tuningDiff()));
		return true;
	} catch {
		return false;
	}
}

export function clearSavedTuning() {
	try {
		window.localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Nothing was saved, or storage is blocked: either way the game uses the built-in feel.
	}
}
