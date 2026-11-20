// Small helpers for musical notes.
// A MIDI note is a number for a piano key: 60 is middle C, and each step is one semitone.

const A4_NOTE = 69;
const A4_HZ = 440;

/** The pitch in Hz of a MIDI note. */
export function midiToHz(note) {
	return A4_HZ * Math.pow(2, (note - A4_NOTE) / 12);
}

/** The item at `index`, kept inside the list: below 0 gives the first item, past the end gives the last. */
export function clampedAt(list, index) {
	return list[Math.max(0, Math.min(list.length - 1, index))];
}
