// Puts the sound profile and animation style the player picked into the live tuning.
// Both start from the tuning the game loaded (with anything saved from the labs),
// so the free ones play exactly that, and changing picks never stacks up.

import { tuning, setTuning } from './tuning.js';
import { PROFILE_KEYS, findSound } from './sound-profiles.js';
import { findMotion } from './motion-styles.js';

const deepCopy = (value) => JSON.parse(JSON.stringify(value));
const loadedTuning = deepCopy(tuning);

/** The sound values of a profile, on top of the loaded tuning. */
export function soundValues(id) {
	const values = {};
	for (const key of PROFILE_KEYS) values[key] = loadedTuning.sound[key];
	return { ...values, ...findSound(id).values };
}

/** The motion numbers of a style, on top of the loaded tuning. For the shop's small preview too. */
export function motionValues(id) {
	return { ...loadedTuning.motion, ...findMotion(id).values };
}

/** Uses a sound profile and an animation style from now on. */
export function applyFeel(soundId, motionId) {
	Object.assign(tuning.sound, soundValues(soundId));
	setTuning({ motion: motionValues(motionId) });
}

/** Runs `run` with a sound profile in place of the one in use, then puts it back. Sounds are scheduled at once. */
export function withSound(id, run) {
	const before = {};
	for (const key of PROFILE_KEYS) before[key] = tuning.sound[key];
	Object.assign(tuning.sound, soundValues(id));
	try {
		return run();
	} finally {
		Object.assign(tuning.sound, before);
	}
}
