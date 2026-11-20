// The small-sound sets: a button tap, a pick-up, a move, "no" and the clock tick.
// "Today" (classic) has no set here: the sound player has it built in.
// Each sound gets the sound player and uses its tone() and voice().

import { tuning } from '../feel/tuning.js';
import { midiToHz } from './notes.js';

const sound = tuning.sound;

/**
 * A set that plays every small sound as one note of an instrument body.
 * body null means the drop instrument in use. notes gives the MIDI note of each sound, and gain the volume.
 */
function noteSet(body, notes) {
	const play = (player, note, gain, at = 0) => player.voice(midiToHz(note), { body: body || sound.body, gain, at, echo: 0 });
	return {
		ui: (player) => play(player, notes.ui, notes.gain * 0.8),
		pick: (player) => play(player, notes.pick, notes.gain),
		move: (player) => play(player, notes.move, notes.gain * 0.4),
		deny: (player) => {
			// Two notes, the second one a step lower: "uh-uh".
			play(player, notes.deny, notes.gain * 1.15);
			play(player, notes.deny - 1, notes.gain * 1.15, 0.09);
		},
		tick: (player, urgent) => play(player, urgent ? notes.tick + 5 : notes.tick, notes.gain * 0.65),
	};
}

export const SMALL_SOUND_SETS = {
	soft: noteSet(null, { ui: 84, pick: 79, move: 91, deny: 55, tick: 91, gain: 0.08 }),
	clicky: noteSet('woodblock', { ui: 84, pick: 79, move: 91, deny: 55, tick: 86, gain: 0.12 }),
	bubbly: noteSet('bubble', { ui: 84, pick: 76, move: 88, deny: 52, tick: 84, gain: 0.12 }),
	cartoon: {
		ui: (player) => player.voice(midiToHz(79), { body: 'corkPop', gain: 0.12, echo: 0 }),
		pick: (player) => player.voice(midiToHz(72), { body: 'squeak', gain: 0.1, echo: 0 }),
		move: (player) => player.voice(midiToHz(91), { body: 'woodblock', gain: 0.04, echo: 0 }),
		deny: (player) => player.voice(midiToHz(48), { body: 'boing', gain: 0.18, echo: 0 }),
		tick: (player, urgent) => player.voice(midiToHz(urgent ? 91 : 86), { body: 'woodblock', gain: 0.07, echo: 0 }),
	},
	hush: {
		ui: (player) => player.tone({ freq: 880, decay: 0.06, gain: 0.05 }),
		pick: (player) => player.tone({ freq: 660, decay: 0.07, gain: 0.06, slide: 1.5 }),
		move: (player) => player.tone({ freq: 1250, decay: 0.03, gain: 0.02 }),
		deny: (player) => player.tone({ freq: 160, type: 'triangle', decay: 0.14, gain: 0.05, slide: 0.7 }),
		tick: (player, urgent) => player.tone({ freq: urgent ? 1320 : 990, decay: 0.03, gain: 0.025 }),
	},
};
