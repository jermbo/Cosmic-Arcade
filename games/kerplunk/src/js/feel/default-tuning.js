// The built-in feel of the game: every number behind the motion and the sound.
// To make a feel from the Feel Lab the default for everyone, paste its "Copy settings" here.

import { SOUND_NAMES } from './sound-styles.js';

export const DEFAULT_TUNING = {
	motion: {
		gravity: 70, // cells per second squared, pulling blocks up to the ceiling
		dropSpeed: 4, // cells per second when a dropped piece starts to rise
		landSquash: 0.3, // how flat a dropped piece gets when it lands
		settleSquash: 0.22, // how flat a loose block gets when it rises and lands
		squashSpring: 16, // how fast a squashed block gets its shape back
		landShake: 1.5, // the shake of the well when a piece lands, in pixels
		clearTime: 0.34, // seconds: a cleared block hops, then falls and turns while it shrinks
		clearStagger: 0.035, // seconds between the blocks of one group
		hopPart: 0.3, // the part of clearTime spent on the hop
		hopSize: 3, // pixels up and left on the hop
		fallSize: 17, // pixels down on the fall
		fallSpin: 0.25, // turn on the fall, in radians
		fallEase: 2, // 1 is a steady fall, more is a slow start and a fast end
		clearGrow: 0.06, // how much a block grows on the hop
		clearEnd: 0.4, // the size of a block at the end of the fall
		chainShake: 3, // the shake on a chain of 3 or more; each chain step adds 1
		blastShake: 8,
		shakeTime: 0.107, // seconds for a shake to fall to half
		stickerTime: 1.1, // seconds a points sticker stays; a big one stays a little longer
		stickerRise: 0.9, // how far a sticker rises, in cells
		stickerPop: 0.15, // how much a sticker overshoots when it shows
		stickerTilt: -4, // degrees
		trayPop: 0.25, // seconds for a new tray piece to pop in
		remixStyle: 'scatter',
	},
	sound: {
		volume: 0.8, // all sound effects
		music: 0.32,
		tempo: 76, // music beats per minute
		bright: 20000, // a filter on the sound effects: lower is softer and darker
		echoSend: 1, // how much of each chime goes into the echo
		echoTime: 0.36,
		echoFeedback: 0.32,
		barWave: 'sine', // the body of the wooden bar: sine, triangle, square or sawtooth
		barLength: 0.55, // seconds the bar rings at most
		knock: 0.22, // the short knock above the bar's note
		knockPitch: 4, // the knock's pitch, as a multiple of the note
		click: 0.06, // the tiny click at the start of the bar
		popFrom: 0.62, // a plunk starts this low under its note ...
		popSlide: 1.8, // ... and jumps up by this much
		popLength: 0.11,
		body: 'classic', // the instrument of every note: a key of BODIES in audio/instrument-bodies.js
		clearStyle: 'rise', // how a clear plays its notes: a key of CLEAR_STYLES
		chainStyle: 'climb', // how a chain builds: a key of CHAIN_STYLES
		powerStyle: 'classic', // the power-ups and big moments: a key of POWER_STYLES
		smallStyle: 'classic', // taps, pick-ups, moves, "no" and the tick: a key of SMALL_STYLES
		scale: 'pentatonic',
		clearRoot: 72, // the first note of the clear chime (a MIDI note: 72 is C5)
		clearSpread: 0.055, // seconds between the notes of one clear chime
		thudPitch: 120, // the low thud when a piece lands, in Hz
		thudLength: 0.12,
		thudNoise: 0.5, // the knock of noise in the thud
		landPlunk: 0.55, // the plunk on top of the thud
		landPlunkPitch: 330,
		each: Object.fromEntries(SOUND_NAMES.map((name) => [name, { volume: 1, pitch: 0, length: 1 }])),
	},
};
