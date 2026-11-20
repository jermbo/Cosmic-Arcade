// The notes of the clear chime: which notes one clear plays, from the clear style, the chain style
// and the mood (all in the tuning). The Sound Path draws these notes, and the sound player plays them.

import { tuning } from '../feel/tuning.js';
import { CLEAR_STYLES, scaleNotes } from '../feel/sound-styles.js';
import { clampedAt } from './notes.js';

const sound = tuning.sound;

const HIGHEST_CHAIN_STEP = 18; // the chain stops climbing the scale here
const BIG_GROUP_SIZE = 4; // a group this big plays the style's extra `big` notes
const FIRST_NOTE_GAIN = 0.2;
const QUIETER_EACH_NOTE = 0.03;
const QUIETEST_NOTE_GAIN = 0.08;
const ECHO = 0.15;

/**
 * The notes of one clear. Returns { notes: [{ note, at, gain }], under, echo }.
 * `note` is a MIDI note, and `at` counts in clearSpread seconds. `under` is the low plunk under
 * the chime (or null), and `echo` is how much of it goes into the echo.
 */
export function planClear(chain, size) {
	const style = CLEAR_STYLES[sound.clearStyle] || CLEAR_STYLES.rise;
	const chainStyle = sound.chainStyle;
	const noteOf = noteFinder(chain, chainStyle);

	const styleNotes = size >= BIG_GROUP_SIZE ? [...style.notes, ...style.big] : style.notes;
	const notes = styleNotes.map(([step, octave, at], i) => ({ note: noteOf(step, octave), at, gain: noteGain(i) }));
	const lastAt = Math.max(...notes.map((n) => n.at));
	const topStep = Math.max(...style.notes.map(([step]) => step));
	if (chainStyle === 'stack') notes.push(...stackedNotes(chain, noteOf, topStep, lastAt));
	if (chainStyle === 'shine' && chain >= 3) notes.push(...shineNotes(noteOf, lastAt));

	const loudness = chainStyle === 'swell' ? swellLoudness(chain) : 1;
	return {
		notes: notes.map((n) => ({ ...n, gain: n.gain * loudness })),
		under: style.under ? { note: noteOf(0, -1), gain: 0.22 * loudness } : null,
		echo: chainStyle === 'swell' ? swellEcho(chain) : ECHO,
	};
}

/**
 * A function that gives the MIDI note of a scale step and an octave, for this chain step.
 * The chain climbs the scale: each step starts one note higher (two with Leap).
 */
function noteFinder(chain, chainStyle) {
	const scale = scaleNotes(sound.scale, 32);
	const climb = chainStyle === 'leap' ? 2 * (chain - 1) : chain - 1;
	const chainStart = Math.min(climb, HIGHEST_CHAIN_STEP);
	return (step, octave) => sound.clearRoot + clampedAt(scale, chainStart + step) + 12 * octave;
}

/** Each note of a chime is a bit quieter than the one before it. */
function noteGain(index) {
	return Math.max(QUIETEST_NOTE_GAIN, FIRST_NOTE_GAIN - index * QUIETER_EACH_NOTE);
}

/** Stack: each chain step adds one more note on top, up to 5. */
function stackedNotes(chain, noteOf, topStep, lastAt) {
	const notes = [];
	for (let k = 1; k <= Math.min(chain - 1, 5); k++) notes.push({ note: noteOf(topStep + k, 0), at: lastAt + k * 0.8, gain: 0.12 });
	return notes;
}

/** Shine: from step 3, a soft sparkle an octave up. */
function shineNotes(noteOf, lastAt) {
	return [
		{ note: noteOf(0, 1), at: lastAt + 0.6, gain: 0.07 },
		{ note: noteOf(2, 1), at: lastAt + 1.2, gain: 0.06 },
	];
}

/** Swell: each chain step is a bit louder ... */
function swellLoudness(chain) {
	return Math.min(1.7, 1 + 0.12 * (chain - 1));
}

/** ... with more echo. */
function swellEcho(chain) {
	return Math.min(0.6, ECHO * (1 + 0.35 * (chain - 1)));
}
