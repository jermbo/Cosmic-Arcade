// The feel the player picks in the shop: a sound profile and an animation style.
// A sound profile is a whole matched set: the instrument, the clear, the mood, the chain,
// the power-ups and the small sounds. An animation style is a set of motion numbers.
// Both start from the tuning the game loaded (tuning.js, with anything saved from the labs),
// so the free ones play exactly that.

import { tuning, setTuning } from './tuning.js';
import { SOUND_PRICES, MOTION_PRICES } from './prices.js';

// The sound keys a profile sets. Everything else (volumes, echo, the thud) stays as tuned.
const PROFILE_KEYS = ['body', 'clearStyle', 'scale', 'chainStyle', 'powerStyle', 'smallStyle'];

const sound = (id, name, text, values) => ({ id, name, text, price: SOUND_PRICES[id], values });

export const SOUND_PROFILES = [
	sound('wooden', 'Wooden', 'Warm wooden bars. The sound Kerplunk was born with.', {}),
	sound('bubbles', 'Bubbles', 'Round water blips that swoop up. Bubbly taps too.', {
		body: 'bubble',
		clearStyle: 'hop',
		scale: 'pentatonic',
		chainStyle: 'climb',
		powerStyle: 'instrument',
		smallStyle: 'bubbly',
	}),
	sound('thumbPiano', 'Thumb piano', 'A soft kalimba. Chains get a sparkle on top.', {
		body: 'kalimba',
		clearStyle: 'strum',
		scale: 'pentatonic',
		chainStyle: 'shine',
		powerStyle: 'instrument',
		smallStyle: 'soft',
	}),
	sound('woodshop', 'Woodshop', 'Dry wooden tocks with a cheeky tune.', {
		body: 'woodblock',
		clearStyle: 'rise',
		scale: 'blues',
		chainStyle: 'leap',
		powerStyle: 'instrument',
		smallStyle: 'clicky',
	}),
	sound('musicBox', 'Music box', 'Tiny, sweet and a bit magic.', {
		body: 'musicBox',
		clearStyle: 'sparkle',
		scale: 'dreamy',
		chainStyle: 'shine',
		powerStyle: 'magic',
		smallStyle: 'soft',
	}),
	sound('glass', 'Glass', 'Clear glass bells that swell as a chain grows.', {
		body: 'glassBell',
		clearStyle: 'rise',
		scale: 'dreamy',
		chainStyle: 'swell',
		powerStyle: 'magic',
		smallStyle: 'soft',
	}),
	sound('island', 'Island', 'Sunny steel drums that bounce.', {
		body: 'steelDrum',
		clearStyle: 'bounce',
		scale: 'major',
		chainStyle: 'leap',
		powerStyle: 'instrument',
		smallStyle: 'clicky',
	}),
	sound('cozyKeys', 'Cozy keys', 'A hushed felt piano. Easy on the ears.', {
		body: 'feltPiano',
		clearStyle: 'chord',
		scale: 'major',
		chainStyle: 'stack',
		powerStyle: 'instrument',
		smallStyle: 'hush',
	}),
	sound('zen', 'Zen', 'A plucked koto in a calm, moody key.', {
		body: 'koto',
		clearStyle: 'strum',
		scale: 'minor',
		chainStyle: 'shine',
		powerStyle: 'magic',
		smallStyle: 'hush',
	}),
	sound('cartoon', 'Cartoon', 'Boings, whaps, a laser Blast and a slide-whistle Remix.', {
		body: 'boing',
		clearStyle: 'bounce',
		scale: 'blues',
		chainStyle: 'leap',
		powerStyle: 'cartoon',
		smallStyle: 'cartoon',
	}),
	sound('arcade', 'Arcade', 'Coin blips and 8-bit sweeps.', {
		body: 'coin',
		clearStyle: 'sparkle',
		scale: 'major',
		chainStyle: 'leap',
		powerStyle: 'arcade',
		smallStyle: 'soft',
	}),
	sound('space', 'Space', 'Pew pew. Every drop is a laser.', {
		body: 'laser',
		clearStyle: 'cascade',
		scale: 'minor',
		chainStyle: 'swell',
		powerStyle: 'arcade',
		smallStyle: 'hush',
	}),
];

const motion = (id, name, text, values) => ({ id, name, text, price: MOTION_PRICES[id], values });

export const MOTION_STYLES = [
	motion('classic', 'Classic', 'A firm squash and a quick hop. The way Kerplunk moves.', {}),
	motion('snappy', 'Snappy', 'Fast and crisp. Blocks rise quickly and clears are short.', {
		gravity: 110,
		dropSpeed: 8,
		landSquash: 0.22,
		squashSpring: 26,
		clearTime: 0.24,
		clearStagger: 0.022,
		hopSize: 2,
		fallSize: 12,
		stickerTime: 0.9,
		trayPop: 0.15,
	}),
	motion('bouncy', 'Bouncy', 'Soft and springy. Blocks squish and wobble back.', {
		gravity: 60,
		landSquash: 0.46,
		settleSquash: 0.34,
		squashSpring: 8,
		hopSize: 7,
		clearGrow: 0.2,
		stickerPop: 0.35,
		trayPop: 0.4,
	}),
	motion('heavy', 'Heavy', 'Big thumps and shakes. Cleared blocks drop like stones.', {
		gravity: 130,
		dropSpeed: 2,
		landSquash: 0.38,
		landShake: 4,
		chainShake: 6,
		blastShake: 14,
		shakeTime: 0.16,
		fallSize: 32,
		fallEase: 3,
		fallSpin: 0.1,
		clearGrow: 0.02,
	}),
	motion('floaty', 'Floaty', 'Slow and dreamy. Blocks drift and twirl away.', {
		gravity: 28,
		dropSpeed: 2,
		landSquash: 0.15,
		squashSpring: 10,
		clearTime: 0.62,
		clearStagger: 0.06,
		hopPart: 0.45,
		hopSize: 6,
		fallSize: 10,
		fallEase: 1.4,
		fallSpin: 0.6,
		landShake: 0.5,
		stickerTime: 1.6,
		stickerRise: 1.4,
	}),
];

export const findSound = (id) => SOUND_PROFILES.find((p) => p.id === id) || SOUND_PROFILES[0];
export const findMotion = (id) => MOTION_STYLES.find((m) => m.id === id) || MOTION_STYLES[0];

// The tuning as the game loaded it: each pick starts from here, so changing picks never stacks up.
const copy = (value) => JSON.parse(JSON.stringify(value));
const base = copy(tuning);

/** The sound values of a profile, on top of the loaded tuning. */
export function soundValues(id) {
	const out = {};
	for (const key of PROFILE_KEYS) out[key] = base.sound[key];
	return { ...out, ...findSound(id).values };
}

/** Uses a sound profile and an animation style from now on. */
export function applyFeel(soundId, motionId) {
	Object.assign(tuning.sound, soundValues(soundId));
	setTuning({ motion: { ...base.motion, ...findMotion(motionId).values } });
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

/** The motion numbers of a style, on top of the loaded tuning. For the shop's small preview. */
export function motionValues(id) {
	return { ...base.motion, ...findMotion(id).values };
}

export { PROFILE_KEYS };
