// All sound is made with the Web Audio API. Nothing is loaded from files.
// Phones block audio until the first tap, so unlock() runs on every tap and key.
// The numbers live in the tuning, so the Feel Lab can change them while it plays.
//
// The sound graph:  sound effects → brightness filter → compressor → speakers
//                   music ───────────────────────────→ compressor
//                   chimes and music can also send some sound into a shared echo.

import { tuning } from '../feel/tuning.js';
import { SOUND_NAMES, scaleNotes } from '../feel/sound-styles.js';
import { BODIES, playBody } from './instrument-bodies.js';
import { planClear } from './clear-chime.js';
import { POWER_SOUND_SETS } from './power-sound-sets.js';
import { SMALL_SOUND_SETS } from './small-sound-sets.js';
import { Music } from './music.js';
import { midiToHz } from './notes.js';

const sound = tuning.sound;
const SILENT = 0.0001; // Web Audio cannot ramp to 0, so fades end here
const NORMAL_SCOPE = { volume: 1, pitch: 1, length: 1 };

class SoundPlayer {
	constructor() {
		this.ctx = null;
		this.sfxOn = true;
		this.musicOn = true;
		this.musicWanted = false;
		this.primed = false;
		this.offline = false;
		this.scope = NORMAL_SCOPE; // the volume, pitch and length of the sound that plays now
		this.backgroundMusic = new Music(this);
	}

	// ---- setup ----

	/** Creates or wakes the audio context. Call from a user gesture. */
	unlock() {
		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		if (!AudioContextClass) return;
		if (!this.ctx && !this.createContext(AudioContextClass)) return;
		// A browser can refuse to wake the sound before a tap. The next tap tries again.
		if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
		if (!this.primed) this.primeIos();
		if (this.musicWanted) this.startMusic();
	}

	createContext(AudioContextClass) {
		try {
			this.ctx = new AudioContextClass();
		} catch {
			// The browser refuses to make a sound engine: the game stays silent.
			return false;
		}
		this.build();
		return true;
	}

	/** A silent sound wakes iOS Safari. */
	primeIos() {
		const source = this.ctx.createBufferSource();
		source.buffer = this.ctx.createBuffer(1, 1, 22050);
		source.connect(this.ctx.destination);
		source.start(0);
		this.primed = true;
	}

	/** Builds the sound graph: the compressor, the effects and music channels, and the echo. */
	build() {
		const ctx = this.ctx;
		this.master = ctx.createDynamicsCompressor();
		this.master.threshold.value = -14;
		this.master.ratio.value = 4;
		this.master.connect(ctx.destination);

		// The Sound Path and the Feel Lab draw the sound from here.
		this.analyser = ctx.createAnalyser();
		this.analyser.fftSize = 2048;
		this.analyser.smoothingTimeConstant = 0.6;
		this.master.connect(this.analyser);

		// Sound effects go through a filter: the Feel Lab's "brightness".
		this.bright = ctx.createBiquadFilter();
		this.bright.type = 'lowpass';
		this.bright.connect(this.master);
		this.sfx = ctx.createGain();
		this.sfx.connect(this.bright);

		this.music = ctx.createGain();
		this.music.connect(this.master);

		this.buildEcho();
		this.applyTuning(true);
		this.noiseBuffer = makeNoise(ctx);
	}

	/** A soft echo that the music and chimes share: a delay that feeds back into itself through a soft filter. */
	buildEcho() {
		const ctx = this.ctx;
		this.echo = ctx.createDelay(2);
		this.feedback = ctx.createGain();
		const soften = ctx.createBiquadFilter();
		soften.type = 'lowpass';
		soften.frequency.value = 2400;
		this.echoIn = ctx.createGain();
		this.echoIn.gain.value = 0.5;
		this.echoIn.connect(this.echo);
		this.echo.connect(soften);
		soften.connect(this.feedback);
		this.feedback.connect(this.echo);
		soften.connect(this.master);
	}

	/** Sets the volumes, the brightness and the echo from the tuning. `now` skips the short glide. */
	applyTuning(now = false) {
		if (!this.ctx) return;
		const time = this.ctx.currentTime;
		const set = (param, value, glide) => (now ? (param.value = value) : param.setTargetAtTime(value, time, glide));
		set(this.sfx.gain, this.sfxOn ? sound.volume : 0, 0.02);
		set(this.music.gain, this.musicOn ? sound.music : 0, 0.1);
		set(this.bright.frequency, Math.min(sound.bright, this.ctx.sampleRate / 2 - 100), 0.02);
		set(this.echo.delayTime, sound.echoTime, 0.05);
		set(this.feedback.gain, Math.min(0.9, sound.echoFeedback), 0.02);
	}

	/** True when sound can play now. An offline copy (see renderSound) is always ready: it plays into a buffer. */
	get ready() {
		return Boolean(this.offline || (this.ctx && this.ctx.state === 'running'));
	}

	setSfx(on) {
		this.sfxOn = on;
		if (this.sfx) this.sfx.gain.setTargetAtTime(on ? sound.volume : 0, this.ctx.currentTime, 0.02);
	}

	setMusic(on) {
		this.musicOn = on;
		if (this.music) this.music.gain.setTargetAtTime(on ? sound.music : 0, this.ctx.currentTime, 0.2);
	}

	suspend() {
		// A refused suspend leaves the sound on, which does no harm.
		if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
	}

	resume() {
		// A browser can refuse to wake the sound before a tap. The next tap tries again.
		if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
	}

	startMusic() {
		this.musicWanted = true;
		this.backgroundMusic.start();
	}

	// ---- the sets in use ----

	/** Plays this sound with its own volume, pitch and length from the tuning (tuning.sound.each). */
	scoped(tuningKey, play) {
		const own = sound.each[tuningKey] || { volume: 1, pitch: 0, length: 1 };
		const before = this.scope;
		this.scope = { volume: own.volume, pitch: Math.pow(2, own.pitch / 12), length: own.length };
		try {
			return play();
		} finally {
			this.scope = before;
		}
	}

	/** Plays the sound of the power-up set in use, if it is not today's. Returns true when it did. */
	fromPowerSet(name, ...args) {
		const set = POWER_SOUND_SETS[sound.powerStyle];
		if (!set || !set[name]) return false;
		set[name](this, ...args);
		return true;
	}

	/** Plays the sound of the small-sound set in use, if it is not today's. Returns true when it did. */
	fromSmallSet(name, ...args) {
		const set = SMALL_SOUND_SETS[sound.smallStyle];
		if (!set || !set[name]) return false;
		set[name](this, ...args);
		return true;
	}

	/** True when a body from instrument-bodies.js plays the notes, not the built-in wooden bar. */
	get usesBody() {
		return sound.body !== 'classic' && Boolean(BODIES[sound.body]);
	}

	// ---- building blocks ----

	/**
	 * One tone. slide: the pitch glides to freq × slide over the decay. out: where it plays (the sound
	 * effects unless given; the music passes its own channel). echo: how much goes into the echo.
	 */
	tone({ freq, type = 'sine', at = 0, attack = 0.005, decay = 0.3, gain = 0.3, slide = 0, out, echo = 0 }) {
		if (!this.ready || (!out && !this.sfxOn)) return;
		if (!out) {
			// A sound effect, so it gets the volume, pitch and length of the sound that plays now.
			const scope = this.scope;
			freq *= scope.pitch;
			gain *= scope.volume;
			at *= scope.length;
			attack *= scope.length;
			decay *= scope.length;
			echo *= sound.echoSend;
		}
		if (gain <= SILENT) return;
		const ctx = this.ctx;
		const time = ctx.currentTime + at;
		const oscillator = ctx.createOscillator();
		const fade = ctx.createGain();
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(freq, time);
		if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), time + decay);
		fade.gain.setValueAtTime(SILENT, time);
		fade.gain.exponentialRampToValueAtTime(gain, time + attack);
		fade.gain.exponentialRampToValueAtTime(SILENT, time + attack + decay);
		oscillator.connect(fade);
		fade.connect(out || this.sfx);
		if (echo) this.sendToEcho(fade, echo);
		oscillator.start(time);
		oscillator.stop(time + attack + decay + 0.05);
	}

	/** A burst of filtered noise. sweep: the filter glides to freq × sweep over the decay. */
	noise({ at = 0, decay = 0.2, gain = 0.3, freq = 1200, q = 1, type = 'bandpass', sweep = 0 }) {
		if (!this.ready || !this.sfxOn) return;
		const scope = this.scope;
		freq *= scope.pitch;
		gain *= scope.volume;
		at *= scope.length;
		decay *= scope.length;
		if (gain <= SILENT) return;
		const ctx = this.ctx;
		const time = ctx.currentTime + at;
		const source = ctx.createBufferSource();
		source.buffer = this.noiseBuffer;
		const filter = ctx.createBiquadFilter();
		filter.type = type;
		filter.frequency.setValueAtTime(freq, time);
		if (sweep) filter.frequency.exponentialRampToValueAtTime(freq * sweep, time + decay);
		filter.Q.value = q;
		const fade = ctx.createGain();
		fade.gain.setValueAtTime(gain, time);
		fade.gain.exponentialRampToValueAtTime(SILENT, time + decay);
		source.connect(filter);
		filter.connect(fade);
		fade.connect(this.sfx);
		source.start(time, Math.random() * 0.5);
		source.stop(time + decay + 0.05);
	}

	/** One note of an instrument body (the one in use unless given), with the scope's volume, pitch and length. */
	voice(freq, { at = 0, gain = 0.2, echo = 0.15, body = sound.body } = {}) {
		if (!this.ready || !this.sfxOn) return;
		const scope = this.scope;
		const ctx = this.ctx;
		const out = ctx.createGain();
		out.connect(this.sfx);
		if (echo && sound.echoSend) this.sendToEcho(out, echo * sound.echoSend);
		playBody(body, ctx, out, freq * scope.pitch, ctx.currentTime + at * scope.length, gain * scope.volume, scope.length);
	}

	sendToEcho(node, amount) {
		const send = this.ctx.createGain();
		send.gain.value = amount;
		node.connect(send);
		send.connect(this.echoIn);
	}

	/** A wooden bar, like a marimba: a warm note, a short knock above it, and a tiny click. */
	bell(freq, { at = 0, gain = 0.22, decay = 0.9, echo = 0.15 } = {}) {
		if (this.usesBody) return this.voice(freq, { at, gain, echo });
		const ring = Math.min(decay, sound.barLength);
		this.tone({ freq, type: sound.barWave, at, gain, decay: ring, echo });
		this.tone({ freq: freq * sound.knockPitch, at, gain: gain * sound.knock, decay: ring * 0.18 });
		this.tone({ freq: freq * 10, type: 'triangle', at, attack: 0.002, gain: gain * sound.click, decay: 0.012 });
	}

	/** A "plunk": a round blip whose pitch jumps up, like a block that drops into water. */
	pop(freq, { at = 0, gain = 0.2, decay = sound.popLength } = {}) {
		if (this.usesBody) return this.voice(freq, { at, gain: gain * 0.9, echo: 0 });
		this.tone({ freq: freq * sound.popFrom, at, gain, decay, slide: sound.popSlide });
	}

	/** Bells up a list of semitones above a MIDI note, one every `gap` seconds. */
	bellRun(root, steps, { gap, gain, decay, start = 0 }) {
		steps.forEach((step, i) => this.bell(midiToHz(root + step), { at: start + i * gap, gain, decay }));
	}

	// ---- game sounds ----
	// Each one first asks the set in use (power-ups or small sounds). The code after that is "Today".

	ui() {
		if (this.fromSmallSet('ui')) return;
		this.tone({ freq: 880, type: 'triangle', decay: 0.07, gain: 0.12 });
	}

	pick() {
		if (this.fromSmallSet('pick')) return;
		this.tone({ freq: 660, decay: 0.08, gain: 0.14, slide: 1.5 });
	}

	move() {
		if (this.fromSmallSet('move')) return;
		this.tone({ freq: 1250, type: 'triangle', decay: 0.03, gain: 0.05 });
	}

	deny() {
		if (this.fromSmallSet('deny')) return;
		this.tone({ freq: 160, type: 'square', decay: 0.14, gain: 0.07, slide: 0.7 });
	}

	tick(urgent) {
		if (this.fromSmallSet('tick', urgent)) return;
		this.tone({ freq: urgent ? 1320 : 990, type: 'square', decay: 0.03, gain: 0.05 });
	}

	/** A piece lands: a soft wooden thud and a plunk. More blocks land harder. */
	land(blockCount = 1) {
		const gain = Math.min(0.34, 0.18 + blockCount * 0.04);
		const thud = gain * (this.usesBody ? BODIES[sound.body].thud : 1);
		this.tone({ freq: sound.thudPitch, decay: sound.thudLength, gain: thud, slide: 0.55 });
		this.noise({ decay: 0.05, gain: thud * sound.thudNoise, freq: 700, q: 0.8, type: 'lowpass' });
		this.pop(sound.landPlunkPitch, { gain: gain * sound.landPlunk });
	}

	/** The chime for a cleared match. It climbs the scale with each chain step (see clear-chime.js). */
	clear(chain, size) {
		const plan = planClear(chain, size);
		if (plan.under) this.pop(midiToHz(plan.under.note), { gain: plan.under.gain });
		for (const note of plan.notes) this.bell(midiToHz(note.note), { at: 0.03 + note.at * sound.clearSpread, gain: note.gain, echo: plan.echo });
	}

	/** A power-up was earned: three plunks up and a bell on top. */
	powerUpEarned() {
		if (this.fromPowerSet('powerUpEarned')) return;
		const root = 79;
		[0, 4, 7].forEach((step, i) => this.pop(midiToHz(root - 12 + step), { at: i * 0.06, gain: 0.16 }));
		this.bell(midiToHz(root + 12), { at: 0.18, gain: 0.12, decay: 0.4 });
	}

	/** A Blast: a low boom with a rush of noise. */
	blast() {
		if (this.fromPowerSet('blast')) return;
		this.tone({ freq: 90, decay: 0.45, gain: 0.45, slide: 0.4 });
		this.noise({ decay: 0.45, gain: 0.32, freq: 2200, q: 0.6, type: 'lowpass', sweep: 0.15 });
		this.pop(midiToHz(67), { at: 0.02, gain: 0.2, decay: 0.16 });
	}

	/** Remix: a rising whine while the board charges. */
	remixCharge() {
		if (this.fromPowerSet('remixCharge')) return;
		this.tone({ freq: 90, type: 'sawtooth', attack: 0.15, decay: 0.9, gain: 0.16, slide: 9 });
		this.tone({ freq: 180, type: 'triangle', attack: 0.15, decay: 0.9, gain: 0.14, slide: 9 });
		this.noise({ decay: 0.95, gain: 0.18, freq: 300, q: 3, sweep: 14 });
	}

	/** Remix: blocks rattling, a run of short clicks for this many seconds. */
	remixRattle(seconds) {
		for (let at = 0; at < seconds; at += 0.04) {
			this.noise({ at, decay: 0.04, gain: 0.16, freq: 1800 + Math.random() * 2600, q: 1.5 });
			if (Math.random() < 0.3) this.tone({ freq: 700 + Math.random() * 500, type: 'triangle', at, decay: 0.03, gain: 0.05 });
		}
	}

	/** Remix: the boom when the blocks fly. */
	remixBoom() {
		if (this.fromPowerSet('remixBoom')) return;
		this.tone({ freq: 70, decay: 0.8, gain: 0.55, slide: 0.35 });
		this.noise({ decay: 0.7, gain: 0.45, freq: 4000, q: 0.5, type: 'lowpass', sweep: 0.06 });
		this.bellRun(67, [0, 4, 7, 12, 16, 19, 24], { gap: 0.04, gain: 0.12, decay: 0.9 });
	}

	/** Remix: a note as blocks land. The notes climb the scale as more blocks land. */
	remixTick(landed) {
		if (this.fromPowerSet('remixTick', landed)) return;
		const scale = scaleNotes(sound.scale);
		this.bell(midiToHz(79 + scale[Math.min(landed, scale.length - 1)]), { gain: 0.09, decay: 0.4 });
	}

	/** A logo tile: one wooden note of the scale. */
	tile(index) {
		const scale = scaleNotes(sound.scale);
		const note = 72 + scale[index % scale.length];
		this.pop(midiToHz(note), { gain: 0.14 });
		this.bell(midiToHz(note), { at: 0.02, gain: 0.14, decay: 0.35 });
	}

	allClear() {
		if (this.fromPowerSet('allClear')) return;
		this.bellRun(72, [0, 4, 7, 11, 14, 19], { gap: 0.09, gain: 0.16, decay: 1.2 });
	}

	gameOver() {
		if (this.fromPowerSet('gameOver')) return;
		this.bellRun(67, [7, 4, 0, -5], { gap: 0.18, gain: 0.16, decay: 1.1 });
	}

	best() {
		if (this.fromPowerSet('best')) return;
		this.bellRun(79, [0, 4, 7, 12, 16], { start: 0.5, gap: 0.08, gain: 0.14, decay: 1 });
	}
}

function makeNoise(ctx) {
	const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
	const samples = buffer.getChannelData(0);
	for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
	return buffer;
}

// Each game sound plays inside its own scope: its volume, pitch and length from the tuning.
// Two sounds have older names in the tuning, so feels saved before the rename still load.
const METHOD_FOR_TUNING_KEY = { forge: 'powerUpEarned', flare: 'blast' };
for (const tuningKey of SOUND_NAMES) {
	const method = METHOD_FOR_TUNING_KEY[tuningKey] || tuningKey;
	const play = SoundPlayer.prototype[method];
	SoundPlayer.prototype[method] = function (...args) {
		return this.scoped(tuningKey, () => play.apply(this, args));
	};
}

export const audio = new SoundPlayer();

/**
 * Plays sounds into a buffer instead of the speakers, for a picture of them. play(player) gets a copy
 * of the sound player that uses the same tuning. Returns a promise of the AudioBuffer, or null with no offline audio.
 */
export function renderSound(play, seconds = 1.2, sampleRate = 22050) {
	const OfflineContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
	if (!OfflineContextClass) return Promise.resolve(null);
	const copy = new SoundPlayer();
	copy.offline = true;
	copy.ctx = new OfflineContextClass(1, Math.round(sampleRate * seconds), sampleRate);
	copy.build();
	play(copy);
	return copy.ctx.startRendering();
}
