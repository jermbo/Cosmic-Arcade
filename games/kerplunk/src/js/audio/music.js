// The background music: a slow loop in A minor, made from soft tones as it plays.
// It counts in eighth notes. A bar has 8 of them, and each chord lasts two bars.

import { tuning } from '../feel/tuning.js';
import { midiToHz } from './notes.js';

const sound = tuning.sound;

// Am, F, C, G, as MIDI notes.
const CHORDS = [
	[57, 60, 64],
	[53, 57, 60],
	[48, 52, 55],
	[55, 59, 62],
];
const EIGHTHS_PER_BAR = 8;
const BARS_PER_CHORD = 2;
const SCHEDULE_EVERY_MS = 90; // how often the music plans the next notes
const PLAN_AHEAD = 0.3; // seconds of notes planned ahead, so a slow frame never skips a note
const START_DELAY = 0.1;

export class Music {
	/** player is the sound player: the music plays its tones into player.music. */
	constructor(player) {
		this.player = player;
		this.nextEighthTime = 0;
		this.eighth = 0;
		this.timer = null;
	}

	get playing() {
		return Boolean(this.timer);
	}

	start() {
		const { ctx } = this.player;
		if (!ctx || this.timer) return;
		this.nextEighthTime = ctx.currentTime + START_DELAY;
		this.timer = setInterval(() => this.schedule(), SCHEDULE_EVERY_MS);
	}

	/** Plans every eighth note that starts in the next PLAN_AHEAD seconds. */
	schedule() {
		const { player } = this;
		if (!player.ready || !player.musicOn) {
			if (player.ctx) this.nextEighthTime = player.ctx.currentTime + START_DELAY;
			return;
		}
		const eighthLength = 60 / sound.tempo / 2;
		while (this.nextEighthTime < player.ctx.currentTime + PLAN_AHEAD) {
			this.playEighth(this.eighth, this.nextEighthTime - player.ctx.currentTime, eighthLength);
			this.nextEighthTime += eighthLength;
			this.eighth++;
		}
	}

	/** One eighth note: a pad at the start of each chord, a bass on beats 1 and 3, and sometimes a pluck. */
	playEighth(eighth, at, eighthLength) {
		if (at < 0) return;
		const bar = Math.floor(eighth / EIGHTHS_PER_BAR);
		const chord = CHORDS[Math.floor(bar / BARS_PER_CHORD) % CHORDS.length];
		const inBar = eighth % EIGHTHS_PER_BAR;
		if (eighth % (EIGHTHS_PER_BAR * BARS_PER_CHORD) === 0) this.playPad(chord, at, eighthLength);
		if (inBar === 0 || inBar === 4) this.playBass(chord, at, eighthLength);
		this.maybePluck(chord, at, inBar);
	}

	/** Long, soft triangle notes, each played twice a little out of tune for a wide sound. */
	playPad(chord, at, eighthLength) {
		for (const note of chord) {
			for (const cents of [-4, 4]) {
				const freq = midiToHz(note) * Math.pow(2, cents / 1200);
				this.player.tone({ freq, type: 'triangle', at, attack: 1.2, decay: eighthLength * 16, gain: 0.05, out: this.player.music });
			}
		}
	}

	/** The root of the chord, two octaves down. */
	playBass(chord, at, eighthLength) {
		this.player.tone({ freq: midiToHz(chord[0] - 24), at, attack: 0.02, decay: eighthLength * 3.5, gain: 0.16, out: this.player.music });
	}

	/** A note of the chord one or two octaves up, chosen at random. More likely on the beat. */
	maybePluck(chord, at, inBar) {
		const chance = inBar % 2 === 0 ? 0.6 : 0.3;
		if (Math.random() >= chance) return;
		const choices = [...chord.map((note) => note + 12), chord[0] + 24, chord[1] + 24];
		const note = choices[Math.floor(Math.random() * choices.length)];
		this.player.tone({ freq: midiToHz(note), at, attack: 0.004, decay: 0.5, gain: 0.07, out: this.player.music, echo: 0.6 });
	}
}
