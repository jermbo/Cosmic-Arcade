// Instrument bodies: the voice of every note in the game (the drop, the clear chime, the chain).
// Each body is a recipe of layered tones, noise and plucked strings (see instrument-parts.js).
// note(ctx, out, freq, time, gain, length) plays one note into `out` at `time`. `length`
// stretches every decay (1 is as built). The same recipe runs in a live AudioContext and an
// OfflineAudioContext, so the Sound Path can draw a picture of each body.
//
// In a recipe, `freq * 2.76` is an overtone: a quieter, higher tone that gives the body its color.

import { tuning } from '../feel/tuning.js';
import { partial, burst, pluck } from './instrument-parts.js';

const sound = tuning.sound;

// ---- the bodies ----
// shift: semitones from the game's note to the body's sweet spot. level: so every body is about as loud.
// thud: how much of the low landing thud goes under a drop (1 is the built-in amount).

export const BODIES = {
	classic: {
		label: 'Wooden (now)',
		blurb: 'The sound Kerplunk has today. A plain marimba-like bar.',
		shift: 0,
		level: 1,
		thud: 1,
		note(ctx, out, freq, time, gain, length) {
			const decay = Math.min(0.9, sound.barLength) * length;
			partial(ctx, out, { freq, time, gain, decay, attack: 0.005, type: sound.barWave });
			partial(ctx, out, { freq: freq * sound.knockPitch, time, gain: gain * sound.knock, decay: decay * 0.18, attack: 0.005 });
			partial(ctx, out, { freq: freq * 10, time, gain: gain * sound.click, decay: 0.012, type: 'triangle' });
		},
	},
	bubble: {
		label: 'Bubble',
		blurb: 'A round blip that swoops up, like a drop of water.',
		group: 'liked',
		shift: 0,
		level: 1.2,
		thud: 0.4,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 0.16 * length, attack: 0.004, bend: 0.55, bendTime: 0.07 });
			partial(ctx, out, { freq: freq * 2, time: time + 0.03, gain: gain * 0.22, decay: 0.08 * length, attack: 0.003, bend: 0.6, bendTime: 0.05 });
		},
	},
	woodblock: {
		label: 'Woodblock',
		blurb: 'A dry, hollow tock. Short and clicky.',
		group: 'liked',
		shift: 7,
		level: 1.3,
		thud: 0.6,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 0.07 * length, attack: 0.001, bend: 1.12, bendTime: 0.012 });
			partial(ctx, out, { freq: freq * 2.71, time, gain: gain * 0.3, decay: 0.03 * length, attack: 0.001 });
			burst(ctx, out, { time, gain: gain * 0.5, decay: 0.025 * length, freq: freq * 2, q: 6 });
		},
	},
	softPluck: {
		label: 'Soft pluck',
		blurb: 'A gently plucked string, warm and rounded.',
		group: 'liked',
		shift: 0,
		level: 1.8,
		thud: 0.7,
		note(ctx, out, freq, time, gain, length) {
			pluck(ctx, out, { freq, time, gain, decay: 0.9 * length, bright: 0, tone: 2600 });
		},
	},
	glassBell: {
		label: 'Glass bell',
		blurb: 'Pure and clear, with a soft shimmer that rings on.',
		group: 'liked',
		shift: 0,
		level: 0.6,
		thud: 0.5,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 1.4 * length });
			partial(ctx, out, { freq: freq * 1.004, time, gain: gain * 0.5, decay: 1.4 * length });
			partial(ctx, out, { freq: freq * 2.76, time, gain: gain * 0.32, decay: 0.6 * length });
			partial(ctx, out, { freq: freq * 5.4, time, gain: gain * 0.15, decay: 0.3 * length });
			partial(ctx, out, { freq: freq * 8.93, time, gain: gain * 0.07, decay: 0.14 * length });
		},
	},
	kalimba: {
		label: 'Kalimba',
		blurb: 'A thumb piano: a soft metal tine with a little buzz.',
		shift: 0,
		level: 1,
		thud: 0.6,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 0.9 * length, bend: 1.012, bendTime: 0.03 });
			partial(ctx, out, { freq: freq * 6.1, time, gain: gain * 0.16, decay: 0.07 * length });
			partial(ctx, out, { freq: freq * 2, time, gain: gain * 0.08, decay: 0.3 * length });
			burst(ctx, out, { time, gain: gain * 0.25, decay: 0.008, freq: 4000, type: 'highpass' });
		},
	},
	tongueDrum: {
		label: 'Tongue drum',
		blurb: 'A steel tongue drum: deep, calm and round.',
		shift: -12,
		level: 0.95,
		thud: 0.5,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 1.3 * length, attack: 0.004 });
			partial(ctx, out, { freq: freq * 2, time, gain: gain * 0.14, decay: 0.5 * length, attack: 0.004 });
			partial(ctx, out, { freq: freq * 3, time, gain: gain * 0.05, decay: 0.25 * length, attack: 0.004 });
			burst(ctx, out, { time, gain: gain * 0.35, decay: 0.04, freq: 350, type: 'lowpass' });
		},
	},
	musicBox: {
		label: 'Music box',
		blurb: 'Tiny, bright and sweet, like a wind-up box.',
		shift: 12,
		level: 0.8,
		thud: 0.3,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 1 * length, attack: 0.001 });
			partial(ctx, out, { freq: freq * 2, time, gain: gain * 0.3, decay: 0.45 * length, attack: 0.001 });
			partial(ctx, out, { freq: freq * 3, time, gain: gain * 0.1, decay: 0.25 * length, attack: 0.001 });
			partial(ctx, out, { freq: freq * 6.8, time, gain: gain * 0.05, decay: 0.05 * length, attack: 0.001 });
		},
	},
	steelDrum: {
		label: 'Steel drum',
		blurb: 'Sunny and playful, with a gentle bend at the start.',
		shift: 0,
		level: 0.9,
		thud: 0.6,
		note(ctx, out, freq, time, gain, length) {
			const bend = { bend: 0.985, bendTime: 0.03, attack: 0.006 };
			partial(ctx, out, { freq, time, gain, decay: 0.8 * length, ...bend });
			partial(ctx, out, { freq: freq * 2, time, gain: gain * 0.55, decay: 0.6 * length, ...bend });
			partial(ctx, out, { freq: freq * 3, time, gain: gain * 0.18, decay: 0.35 * length, ...bend });
			partial(ctx, out, { freq: freq * 4.07, time, gain: gain * 0.12, decay: 0.22 * length, ...bend });
		},
	},
	vibraphone: {
		label: 'Vibraphone',
		blurb: 'Soft metal bars with a slow, dreamy wobble.',
		shift: 0,
		level: 0.9,
		thud: 0.5,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 1.6 * length, attack: 0.003, tremolo: { rate: 5.5, depth: 0.5 } });
			partial(ctx, out, { freq: freq * 4, time, gain: gain * 0.22, decay: 0.35 * length, attack: 0.003 });
			partial(ctx, out, { freq: freq * 10, time, gain: gain * 0.03, decay: 0.03, attack: 0.002 });
		},
	},
	feltPiano: {
		label: 'Felt piano',
		blurb: 'A piano with felt on the hammers: hushed and cozy.',
		shift: -5,
		level: 1.05,
		thud: 0.8,
		note(ctx, out, freq, time, gain, length) {
			const soft = { attack: 0.008, filter: 1500 };
			partial(ctx, out, { freq, time, gain, decay: 0.8 * length, type: 'triangle', ...soft });
			partial(ctx, out, { freq: freq * 2, time, gain: gain * 0.4, decay: 0.5 * length, ...soft });
			partial(ctx, out, { freq: freq * 3, time, gain: gain * 0.15, decay: 0.3 * length, ...soft });
			burst(ctx, out, { time, gain: gain * 0.4, decay: 0.05, freq: 250, type: 'lowpass' });
		},
	},
	koto: {
		label: 'Koto',
		blurb: 'A bright plucked string with a crisp attack.',
		shift: 0,
		level: 1.2,
		thud: 0.6,
		note(ctx, out, freq, time, gain, length) {
			pluck(ctx, out, { freq, time, gain, decay: 0.7 * length, bright: 2, tone: 6000 });
			burst(ctx, out, { time, gain: gain * 0.25, decay: 0.01, freq: 2500, type: 'highpass' });
		},
	},
	raindrop: {
		label: 'Raindrop',
		blurb: 'A quick falling plip, like rain on a window.',
		shift: 12,
		level: 1.1,
		thud: 0.4,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 0.09 * length, attack: 0.001, bend: 2.2, bendTime: 0.025 });
			partial(ctx, out, { freq: freq * 1.5, time: time + 0.05, gain: gain * 0.15, decay: 0.05 * length, attack: 0.001, bend: 2, bendTime: 0.02 });
		},
	},
	toyPiano: {
		label: 'Toy piano',
		blurb: 'Plinky metal rods: cute and a bit out of tune.',
		shift: 0,
		level: 0.9,
		thud: 0.5,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 0.55 * length, attack: 0.001 });
			partial(ctx, out, { freq: freq * 4.2, time, gain: gain * 0.35, decay: 0.12 * length, attack: 0.001 });
			partial(ctx, out, { freq: freq * 9.8, time, gain: gain * 0.12, decay: 0.04 * length, attack: 0.001 });
		},
	},
	ocarina: {
		label: 'Ocarina',
		blurb: 'A small clay flute: breathy and soft.',
		shift: 0,
		level: 1.1,
		thud: 0.5,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 0.4 * length, attack: 0.03, vibrato: { rate: 5, depth: 8 } });
			partial(ctx, out, { freq: freq * 2, time, gain: gain * 0.07, decay: 0.3 * length, attack: 0.03 });
			burst(ctx, out, { time, gain: gain * 0.08, decay: 0.25 * length, freq, q: 3, attack: 0.02 });
		},
	},
	clayPot: {
		label: 'Clay pot',
		blurb: 'A deep hollow "bloop" from a clay drum.',
		shift: -12,
		level: 1.3,
		thud: 0.3,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 0.35 * length, attack: 0.006, bend: 0.5, bendTime: 0.1 });
			partial(ctx, out, { freq: freq * 2.01, time, gain: gain * 0.15, decay: 0.15 * length, attack: 0.006, bend: 0.5, bendTime: 0.1 });
			burst(ctx, out, { time, gain: gain * 0.45, decay: 0.06, freq: 200, type: 'lowpass' });
		},
	},

	// ---- cartoon ----
	laser: {
		label: 'Space laser',
		blurb: 'Pew! A bright beam that zooms down in pitch.',
		group: 'cartoon',
		shift: 0,
		level: 0.55,
		thud: 0.4,
		note(ctx, out, freq, time, gain, length) {
			const zoom = { bend: 6, bendTime: 0.16 * length, attack: 0.002, decay: 0.2 * length };
			partial(ctx, out, { freq: freq * 0.5, time, gain, type: 'square', filter: 3500, ...zoom });
			partial(ctx, out, { freq: freq * 0.25, time, gain: gain * 0.6, ...zoom });
		},
	},
	zap: {
		label: 'Zap',
		blurb: 'A buzzy electric zap with a crackle.',
		group: 'cartoon',
		shift: 0,
		level: 0.5,
		thud: 0.5,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, type: 'sawtooth', decay: 0.14 * length, bend: 2, bendTime: 0.1 * length, vibrato: { rate: 70, depth: 250 }, filter: 4000 });
			burst(ctx, out, { time, gain: gain * 0.5, decay: 0.05 * length, freq: 3500, type: 'highpass' });
		},
	},
	whap: {
		label: 'Whap',
		blurb: 'A cartoon slap: a smack of air with a little bonk.',
		group: 'cartoon',
		shift: -5,
		level: 1.1,
		thud: 0.7,
		note(ctx, out, freq, time, gain, length) {
			burst(ctx, out, { time, gain: gain * 1.2, decay: 0.06 * length, freq: freq * 3, q: 1.2 });
			partial(ctx, out, { freq: freq * 0.7, time, gain: gain * 0.8, decay: 0.09 * length, attack: 0.001, bend: 1.7, bendTime: 0.03 });
		},
	},
	boing: {
		label: 'Boing',
		blurb: 'A springy wobble, like a jack-in-the-box.',
		group: 'cartoon',
		shift: -5,
		level: 0.9,
		thud: 0.5,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 0.45 * length, attack: 0.004, bend: 0.6, bendTime: 0.04, vibrato: { rate: 16, depth: 140 } });
			partial(ctx, out, { freq: freq * 2, time, gain: gain * 0.15, decay: 0.2 * length, attack: 0.004, bend: 0.6, bendTime: 0.04 });
		},
	},
	corkPop: {
		label: 'Cork pop',
		blurb: 'A quick hollow pop, like a cork from a bottle.',
		group: 'cartoon',
		shift: 0,
		level: 1.2,
		thud: 0.5,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq: freq * 1.5, time, gain, decay: 0.05 * length, attack: 0.001, bend: 0.4, bendTime: 0.015 });
			burst(ctx, out, { time, gain: gain * 0.4, decay: 0.02, freq: 2000, type: 'highpass' });
		},
	},
	squeak: {
		label: 'Squeak',
		blurb: 'A rubber toy squeak that rises and wiggles.',
		group: 'cartoon',
		shift: 7,
		level: 0.75,
		thud: 0.4,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, type: 'triangle', decay: 0.15 * length, attack: 0.012, bend: 0.75, bendTime: 0.08, vibrato: { rate: 13, depth: 45 } });
		},
	},
	slideWhistle: {
		label: 'Slide whistle',
		blurb: 'Wheee! A whistle that slides up to its note.',
		group: 'cartoon',
		shift: 0,
		level: 0.9,
		thud: 0.4,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, decay: 0.35 * length, attack: 0.03, bend: 0.5, bendTime: 0.22 * length, vibrato: { rate: 6, depth: 15 } });
			burst(ctx, out, { time, gain: gain * 0.06, decay: 0.3 * length, freq, q: 4, attack: 0.03 });
		},
	},
	coin: {
		label: 'Coin blip',
		blurb: 'An 8-bit two-note blip, like grabbing a coin.',
		group: 'cartoon',
		shift: 0,
		level: 0.45,
		thud: 0.4,
		note(ctx, out, freq, time, gain, length) {
			partial(ctx, out, { freq, time, gain, type: 'square', decay: 0.05, attack: 0.001, filter: 5000 });
			partial(ctx, out, { freq: freq * 1.5, time: time + 0.05, gain, type: 'square', decay: 0.22 * length, attack: 0.001, filter: 5000 });
		},
	},
};

export const BODY_NAMES = Object.keys(BODIES);

/** Plays one note of a body into `out`. freq is the game's note; the body moves it to its sweet spot. */
export function playBody(name, ctx, out, freq, time, gain, length = 1) {
	const body = BODIES[name] || BODIES.classic;
	const sweetSpot = freq * Math.pow(2, body.shift / 12);
	body.note(ctx, out, sweetSpot, time, gain * body.level, length);
}
