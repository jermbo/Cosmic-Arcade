// The power-up sound sets. Each set replaces the power-up sounds and the big moments
// (all clear, game over, new best). "Today" (classic) has no set here: the sound player has it built in.
// Each sound gets the sound player and uses its tone(), noise() and voice().
// The numbers in lists such as [0, 4, 7, 12] are semitones above a MIDI note: a chord or a run.

import { tuning } from '../feel/tuning.js';
import { scaleNotes } from '../feel/sound-styles.js';
import { midiToHz, clampedAt } from './notes.js';

const sound = tuning.sound;

/** Plays a run of notes on the voice in use: one note every `gap` seconds, starting at `start`. */
function voiceRun(player, root, steps, { gap, gain, start = 0, body, echo }) {
	steps.forEach((step, i) => player.voice(midiToHz(root + step), { at: start + i * gap, gain, body, echo }));
}

/** The same run with square-wave beeps, like an 8-bit console. */
function beepRun(player, root, steps, { gap, gain, decay, start = 0 }) {
	steps.forEach((step, i) => player.tone({ freq: midiToHz(root + step), type: 'square', at: start + i * gap, decay, gain }));
}

export const POWER_SOUND_SETS = {
	instrument: {
		powerUpEarned(player) {
			voiceRun(player, 72, [0, 4, 7, 12], { gap: 0.06, gain: 0.15 });
		},
		blast(player) {
			player.tone({ freq: 90, decay: 0.45, gain: 0.42, slide: 0.4 });
			player.noise({ decay: 0.35, gain: 0.25, freq: 2200, q: 0.6, type: 'lowpass', sweep: 0.15 });
			for (const step of [0, 7, 12]) player.voice(midiToHz(60 + step), { at: 0.02, gain: 0.13 });
		},
		remixCharge(player) {
			scaleNotes(sound.scale, 14).forEach((step, i) => player.voice(midiToHz(60 + step), { at: i * 0.06, gain: 0.05 + i * 0.006, echo: 0.1 }));
			player.noise({ decay: 0.9, gain: 0.12, freq: 300, q: 3, sweep: 14 });
		},
		remixBoom(player) {
			player.tone({ freq: 70, decay: 0.8, gain: 0.5, slide: 0.35 });
			voiceRun(player, 67, [0, 4, 7, 12, 16, 19, 24], { gap: 0.04, gain: 0.11 });
		},
		remixTick(player, landed) {
			player.voice(midiToHz(79 + clampedAt(scaleNotes(sound.scale), landed)), { gain: 0.08, echo: 0.05 });
		},
		allClear(player) {
			voiceRun(player, 72, [0, 4, 7, 11, 14, 19], { gap: 0.09, gain: 0.15 });
		},
		gameOver(player) {
			voiceRun(player, 67, [7, 4, 0, -5], { gap: 0.18, gain: 0.15 });
		},
		best(player) {
			voiceRun(player, 79, [0, 4, 7, 12, 16], { start: 0.5, gap: 0.08, gain: 0.13 });
		},
	},
	cartoon: {
		powerUpEarned(player) {
			player.voice(midiToHz(84), { body: 'coin', gain: 0.2, echo: 0.1 });
		},
		blast(player) {
			player.voice(midiToHz(84), { body: 'laser', gain: 0.35, echo: 0.1 });
			player.voice(midiToHz(60), { body: 'whap', at: 0.12, gain: 0.3, echo: 0 });
			player.tone({ freq: 80, decay: 0.3, gain: 0.3, slide: 0.5 });
		},
		remixCharge(player) {
			player.voice(midiToHz(67), { body: 'slideWhistle', gain: 0.22 });
			player.voice(midiToHz(79), { body: 'slideWhistle', at: 0.4, gain: 0.22 });
		},
		remixBoom(player) {
			player.voice(midiToHz(60), { body: 'boing', gain: 0.35 });
			player.voice(midiToHz(72), { body: 'zap', at: 0.05, gain: 0.25 });
		},
		remixTick(player, landed) {
			player.voice(midiToHz(72 + (landed % 8) * 2), { body: 'corkPop', gain: 0.15, echo: 0 });
		},
		allClear(player) {
			voiceRun(player, 76, [0, 4, 7, 12, 16, 19], { body: 'coin', gap: 0.08, gain: 0.16 });
		},
		gameOver(player) {
			voiceRun(player, 67, [7, 4, 0, -5], { body: 'boing', gap: 0.2, gain: 0.22 });
		},
		best(player) {
			voiceRun(player, 79, [0, 4, 7, 12], { body: 'coin', start: 0.5, gap: 0.1, gain: 0.16 });
		},
	},
	arcade: {
		powerUpEarned(player) {
			beepRun(player, 76, [0, 4, 7, 12], { gap: 0.045, decay: 0.07, gain: 0.06 });
		},
		blast(player) {
			player.noise({ decay: 0.4, gain: 0.35, freq: 1500, q: 0.5, type: 'lowpass', sweep: 0.1 });
			player.tone({ freq: midiToHz(84), type: 'square', decay: 0.35, gain: 0.07, slide: 0.1 });
		},
		remixCharge(player) {
			player.tone({ freq: 110, type: 'square', attack: 0.05, decay: 0.9, gain: 0.05, slide: 8 });
			player.tone({ freq: 220, type: 'triangle', attack: 0.05, decay: 0.9, gain: 0.06, slide: 8 });
		},
		remixBoom(player) {
			player.noise({ decay: 0.5, gain: 0.4, freq: 3000, q: 0.5, type: 'lowpass', sweep: 0.08 });
			beepRun(player, 67, [0, 4, 7, 12, 16, 19, 24], { gap: 0.035, decay: 0.08, gain: 0.055 });
		},
		remixTick(player, landed) {
			player.tone({ freq: midiToHz(79 + (landed % 12)), type: 'square', decay: 0.04, gain: 0.04 });
		},
		allClear(player) {
			// The last note rings longer.
			[0, 4, 7, 12, 16].forEach((step, i) => player.tone({ freq: midiToHz(72 + step), type: 'square', at: i * 0.07, decay: i === 4 ? 0.45 : 0.1, gain: 0.06 }));
		},
		gameOver(player) {
			// Four notes down, and the last one slides down too.
			[7, 6, 5, 4].forEach((step, i) => {
				const last = i === 3;
				player.tone({ freq: midiToHz(64 + step), type: 'square', at: i * 0.2, decay: last ? 0.5 : 0.16, gain: 0.06, slide: last ? 0.5 : 0 });
			});
		},
		best(player) {
			beepRun(player, 79, [0, 4, 7, 12, 16, 19], { start: 0.5, gap: 0.06, decay: 0.1, gain: 0.05 });
		},
	},
	magic: {
		powerUpEarned(player) {
			voiceRun(player, 79, [0, 7, 12], { body: 'glassBell', gap: 0.07, gain: 0.14 });
			player.voice(midiToHz(98), { body: 'musicBox', at: 0.25, gain: 0.08 });
		},
		blast(player) {
			player.noise({ decay: 0.5, gain: 0.2, freq: 500, q: 0.7, sweep: 8 });
			player.tone({ freq: 80, decay: 0.4, gain: 0.25, slide: 0.5 });
			for (const step of [0, 7, 12, 16]) player.voice(midiToHz(60 + step), { body: 'glassBell', at: 0.2, gain: 0.1 });
		},
		remixCharge(player) {
			// Music-box notes of the scale, picked at random, getting louder.
			const scale = scaleNotes(sound.scale, 10);
			for (let i = 0; i < 14; i++) {
				const step = scale[Math.floor(Math.random() * scale.length)];
				player.voice(midiToHz(79 + step), { body: 'musicBox', at: i * 0.06, gain: 0.05 + i * 0.004 });
			}
			player.noise({ decay: 0.9, gain: 0.1, freq: 400, q: 1, sweep: 10 });
		},
		remixBoom(player) {
			player.noise({ decay: 0.6, gain: 0.25, freq: 5000, q: 0.5, type: 'lowpass', sweep: 0.1 });
			voiceRun(player, 67, [0, 4, 7, 12, 16, 19, 24], { body: 'glassBell', gap: 0.05, gain: 0.09 });
		},
		remixTick(player, landed) {
			player.voice(midiToHz(84 + clampedAt(scaleNotes(sound.scale), landed)), { body: 'musicBox', gain: 0.07, echo: 0.1 });
		},
		allClear(player) {
			voiceRun(player, 76, [0, 4, 7, 11, 14, 19], { body: 'glassBell', gap: 0.1, gain: 0.13 });
		},
		gameOver(player) {
			voiceRun(player, 67, [7, 4, 0, -5], { body: 'vibraphone', gap: 0.2, gain: 0.15 });
		},
		best(player) {
			voiceRun(player, 84, [0, 4, 7, 12, 16, 19], { body: 'musicBox', start: 0.5, gap: 0.08, gain: 0.12 });
		},
	},
};
