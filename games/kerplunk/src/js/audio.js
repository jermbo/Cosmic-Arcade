// All sound is made with the Web Audio API. Nothing is loaded from files.
// Phones block audio until the first tap, so unlock() runs on every tap and key.
// The numbers live in tuning.js, so the Feel Lab can change them while it plays.

import { tuning, SOUND_NAMES, CLEAR_STYLES, scaleNotes } from './tuning.js';
import { BODIES, playBody } from './bodies.js';

const S = tuning.sound;
const NO_SCOPE = { volume: 1, pitch: 1, length: 1 };
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const scaleAt = (list, i) => list[Math.max(0, Math.min(list.length - 1, i))];

/**
 * The notes of one clear, from the clear style, the chain style and the mood (all in tuning.js).
 * Returns { notes: [{ note, at, gain }], under, echo }: `note` is a MIDI note, and `at` counts in
 * clearSpread seconds. The Sound Path draws these notes, and clear() plays them.
 */
export function planClear(chain, size) {
	const root = S.clearRoot;
	const scale = scaleNotes(S.scale, 32);
	const style = CLEAR_STYLES[S.clearStyle] || CLEAR_STYLES.rise;
	const chainStyle = S.chainStyle;
	// The chain climbs the scale: each step starts one note higher (two with Leap).
	const base = Math.min(chainStyle === 'leap' ? 2 * (chain - 1) : chain - 1, 18);
	const noteOf = ([step, octave]) => root + scaleAt(scale, base + step) + 12 * octave;
	const list = (size >= 4 ? [...style.notes, ...style.big] : style.notes).map((n, i) => ({ note: noteOf(n), at: n[2], gain: Math.max(0.08, 0.2 - i * 0.03) }));
	const end = Math.max(...list.map((n) => n.at));
	const top = Math.max(...style.notes.map((n) => n[0]));
	if (chainStyle === 'stack') {
		for (let k = 1; k <= Math.min(chain - 1, 5); k++) list.push({ note: noteOf([top + k, 0]), at: end + k * 0.8, gain: 0.12 });
	}
	if (chainStyle === 'shine' && chain >= 3) {
		list.push({ note: noteOf([0, 1]), at: end + 0.6, gain: 0.07 }, { note: noteOf([2, 1]), at: end + 1.2, gain: 0.06 });
	}
	const loud = chainStyle === 'swell' ? Math.min(1.7, 1 + 0.12 * (chain - 1)) : 1;
	const echo = chainStyle === 'swell' ? Math.min(0.6, 0.15 * (1 + 0.35 * (chain - 1))) : 0.15;
	return {
		notes: list.map((n) => ({ ...n, gain: n.gain * loud })),
		under: style.under ? { note: noteOf([0, -1]), gain: 0.22 * loud } : null,
		echo,
	};
}

// The power-up sets: each one replaces the power-up sounds and the big moments. `this` is the audio.
const POWER = {
	instrument: {
		forge() {
			[0, 4, 7, 12].forEach((s, i) => this.voice(midi(72 + s), { at: i * 0.06, gain: 0.15 }));
		},
		flare() {
			this.tone({ freq: 90, decay: 0.45, gain: 0.42, slide: 0.4 });
			this.noise({ decay: 0.35, gain: 0.25, freq: 2200, q: 0.6, type: 'lowpass', sweep: 0.15 });
			[0, 7, 12].forEach((s) => this.voice(midi(60 + s), { at: 0.02, gain: 0.13 }));
		},
		remixCharge() {
			scaleNotes(S.scale, 14).forEach((s, i) => this.voice(midi(60 + s), { at: i * 0.06, gain: 0.05 + i * 0.006, echo: 0.1 }));
			this.noise({ decay: 0.9, gain: 0.12, freq: 300, q: 3, sweep: 14 });
		},
		remixBoom() {
			this.tone({ freq: 70, decay: 0.8, gain: 0.5, slide: 0.35 });
			[0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.voice(midi(67 + s), { at: i * 0.04, gain: 0.11 }));
		},
		remixTick(n) {
			this.voice(midi(79 + scaleAt(scaleNotes(S.scale), n)), { gain: 0.08, echo: 0.05 });
		},
		allClear() {
			[0, 4, 7, 11, 14, 19].forEach((s, i) => this.voice(midi(72 + s), { at: i * 0.09, gain: 0.15 }));
		},
		gameOver() {
			[7, 4, 0, -5].forEach((s, i) => this.voice(midi(67 + s), { at: i * 0.18, gain: 0.15 }));
		},
		best() {
			[0, 4, 7, 12, 16].forEach((s, i) => this.voice(midi(79 + s), { at: 0.5 + i * 0.08, gain: 0.13 }));
		},
	},
	cartoon: {
		forge() {
			this.voice(midi(84), { body: 'coin', gain: 0.2, echo: 0.1 });
		},
		flare() {
			this.voice(midi(84), { body: 'laser', gain: 0.35, echo: 0.1 });
			this.voice(midi(60), { body: 'whap', at: 0.12, gain: 0.3, echo: 0 });
			this.tone({ freq: 80, decay: 0.3, gain: 0.3, slide: 0.5 });
		},
		remixCharge() {
			this.voice(midi(67), { body: 'slideWhistle', gain: 0.22 });
			this.voice(midi(79), { body: 'slideWhistle', at: 0.4, gain: 0.22 });
		},
		remixBoom() {
			this.voice(midi(60), { body: 'boing', gain: 0.35 });
			this.voice(midi(72), { body: 'zap', at: 0.05, gain: 0.25 });
		},
		remixTick(n) {
			this.voice(midi(72 + (n % 8) * 2), { body: 'corkPop', gain: 0.15, echo: 0 });
		},
		allClear() {
			[0, 4, 7, 12, 16, 19].forEach((s, i) => this.voice(midi(76 + s), { body: 'coin', at: i * 0.08, gain: 0.16 }));
		},
		gameOver() {
			[7, 4, 0, -5].forEach((s, i) => this.voice(midi(67 + s), { body: 'boing', at: i * 0.2, gain: 0.22 }));
		},
		best() {
			[0, 4, 7, 12].forEach((s, i) => this.voice(midi(79 + s), { body: 'coin', at: 0.5 + i * 0.1, gain: 0.16 }));
		},
	},
	arcade: {
		forge() {
			[0, 4, 7, 12].forEach((s, i) => this.tone({ freq: midi(76 + s), type: 'square', at: i * 0.045, decay: 0.07, gain: 0.06 }));
		},
		flare() {
			this.noise({ decay: 0.4, gain: 0.35, freq: 1500, q: 0.5, type: 'lowpass', sweep: 0.1 });
			this.tone({ freq: midi(84), type: 'square', decay: 0.35, gain: 0.07, slide: 0.1 });
		},
		remixCharge() {
			this.tone({ freq: 110, type: 'square', attack: 0.05, decay: 0.9, gain: 0.05, slide: 8 });
			this.tone({ freq: 220, type: 'triangle', attack: 0.05, decay: 0.9, gain: 0.06, slide: 8 });
		},
		remixBoom() {
			this.noise({ decay: 0.5, gain: 0.4, freq: 3000, q: 0.5, type: 'lowpass', sweep: 0.08 });
			[0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone({ freq: midi(67 + s), type: 'square', at: i * 0.035, decay: 0.08, gain: 0.055 }));
		},
		remixTick(n) {
			this.tone({ freq: midi(79 + (n % 12)), type: 'square', decay: 0.04, gain: 0.04 });
		},
		allClear() {
			[0, 4, 7, 12, 16].forEach((s, i) => this.tone({ freq: midi(72 + s), type: 'square', at: i * 0.07, decay: i === 4 ? 0.45 : 0.1, gain: 0.06 }));
		},
		gameOver() {
			[7, 6, 5, 4].forEach((s, i) => this.tone({ freq: midi(64 + s), type: 'square', at: i * 0.2, decay: i === 3 ? 0.5 : 0.16, gain: 0.06, slide: i === 3 ? 0.5 : 0 }));
		},
		best() {
			[0, 4, 7, 12, 16, 19].forEach((s, i) => this.tone({ freq: midi(79 + s), type: 'square', at: 0.5 + i * 0.06, decay: 0.1, gain: 0.05 }));
		},
	},
	magic: {
		forge() {
			[0, 7, 12].forEach((s, i) => this.voice(midi(79 + s), { body: 'glassBell', at: i * 0.07, gain: 0.14 }));
			this.voice(midi(98), { body: 'musicBox', at: 0.25, gain: 0.08 });
		},
		flare() {
			this.noise({ decay: 0.5, gain: 0.2, freq: 500, q: 0.7, sweep: 8 });
			this.tone({ freq: 80, decay: 0.4, gain: 0.25, slide: 0.5 });
			[0, 7, 12, 16].forEach((s) => this.voice(midi(60 + s), { body: 'glassBell', at: 0.2, gain: 0.1 }));
		},
		remixCharge() {
			const scale = scaleNotes(S.scale, 10);
			for (let i = 0; i < 14; i++) this.voice(midi(79 + scale[Math.floor(Math.random() * scale.length)]), { body: 'musicBox', at: i * 0.06, gain: 0.05 + i * 0.004 });
			this.noise({ decay: 0.9, gain: 0.1, freq: 400, q: 1, sweep: 10 });
		},
		remixBoom() {
			this.noise({ decay: 0.6, gain: 0.25, freq: 5000, q: 0.5, type: 'lowpass', sweep: 0.1 });
			[0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.voice(midi(67 + s), { body: 'glassBell', at: i * 0.05, gain: 0.09 }));
		},
		remixTick(n) {
			this.voice(midi(84 + scaleAt(scaleNotes(S.scale), n)), { body: 'musicBox', gain: 0.07, echo: 0.1 });
		},
		allClear() {
			[0, 4, 7, 11, 14, 19].forEach((s, i) => this.voice(midi(76 + s), { body: 'glassBell', at: i * 0.1, gain: 0.13 }));
		},
		gameOver() {
			[7, 4, 0, -5].forEach((s, i) => this.voice(midi(67 + s), { body: 'vibraphone', at: i * 0.2, gain: 0.15 }));
		},
		best() {
			[0, 4, 7, 12, 16, 19].forEach((s, i) => this.voice(midi(84 + s), { body: 'musicBox', at: 0.5 + i * 0.08, gain: 0.12 }));
		},
	},
};

// The small-sound sets: a button tap, a pick-up, a move, "no" and the clock tick. `this` is the audio.
// Each set but Soft names its own body; Soft uses the drop instrument.
function smallSet(body, notes) {
	const play = (a, note, gain, at = 0) => a.voice(midi(note), { body: body || S.body, gain, at, echo: 0 });
	return {
		ui() {
			play(this, notes.ui, notes.gain * 0.8);
		},
		pick() {
			play(this, notes.pick, notes.gain);
		},
		move() {
			play(this, notes.move, notes.gain * 0.4);
		},
		deny() {
			play(this, notes.deny, notes.gain * 1.15);
			play(this, notes.deny - 1, notes.gain * 1.15, 0.09);
		},
		tick(urgent) {
			play(this, urgent ? notes.tick + 5 : notes.tick, notes.gain * 0.65);
		},
	};
}

const SMALL = {
	soft: smallSet(null, { ui: 84, pick: 79, move: 91, deny: 55, tick: 91, gain: 0.08 }),
	clicky: smallSet('woodblock', { ui: 84, pick: 79, move: 91, deny: 55, tick: 86, gain: 0.12 }),
	bubbly: smallSet('bubble', { ui: 84, pick: 76, move: 88, deny: 52, tick: 84, gain: 0.12 }),
	cartoon: {
		ui() {
			this.voice(midi(79), { body: 'corkPop', gain: 0.12, echo: 0 });
		},
		pick() {
			this.voice(midi(72), { body: 'squeak', gain: 0.1, echo: 0 });
		},
		move() {
			this.voice(midi(91), { body: 'woodblock', gain: 0.04, echo: 0 });
		},
		deny() {
			this.voice(midi(48), { body: 'boing', gain: 0.18, echo: 0 });
		},
		tick(urgent) {
			this.voice(midi(urgent ? 91 : 86), { body: 'woodblock', gain: 0.07, echo: 0 });
		},
	},
	hush: {
		ui() {
			this.tone({ freq: 880, decay: 0.06, gain: 0.05 });
		},
		pick() {
			this.tone({ freq: 660, decay: 0.07, gain: 0.06, slide: 1.5 });
		},
		move() {
			this.tone({ freq: 1250, decay: 0.03, gain: 0.02 });
		},
		deny() {
			this.tone({ freq: 160, type: 'triangle', decay: 0.14, gain: 0.05, slide: 0.7 });
		},
		tick(urgent) {
			this.tone({ freq: urgent ? 1320 : 990, decay: 0.03, gain: 0.025 });
		},
	},
};

// A slow progression in A minor: Am, F, C, G (two bars each).
const CHORDS = [
	[57, 60, 64],
	[53, 57, 60],
	[48, 52, 55],
	[55, 59, 62],
];

class Audio {
	constructor() {
		this.ctx = null;
		this.sfxOn = true;
		this.musicOn = true;
		this.musicWanted = false;
		this.nextBeat = 0;
		this.beat = 0;
		this.timer = null;
		this.scope = NO_SCOPE; // the volume, pitch and length of the sound that plays now
	}

	/** Creates or wakes the audio context. Call from a user gesture. */
	unlock() {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return;
		if (!this.ctx) {
			try {
				this.ctx = new AC();
			} catch {
				// The browser refuses to make a sound engine: the game stays silent.
				return;
			}
			this.build();
		}
		// A browser can refuse to wake the sound before a tap. The next tap tries again.
		if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
		if (!this.primed) {
			// A silent buffer wakes iOS Safari.
			const buf = this.ctx.createBuffer(1, 1, 22050);
			const src = this.ctx.createBufferSource();
			src.buffer = buf;
			src.connect(this.ctx.destination);
			src.start(0);
			this.primed = true;
		}
		if (this.musicWanted) this.startMusic();
	}

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

		// A soft echo that the music and chimes share.
		this.echo = ctx.createDelay(2);
		this.feedback = ctx.createGain();
		const tone = ctx.createBiquadFilter();
		tone.type = 'lowpass';
		tone.frequency.value = 2400;
		this.echoIn = ctx.createGain();
		this.echoIn.gain.value = 0.5;
		this.echoIn.connect(this.echo);
		this.echo.connect(tone);
		tone.connect(this.feedback);
		this.feedback.connect(this.echo);
		tone.connect(this.master);
		this.applyTuning(true);

		const len = ctx.sampleRate;
		this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = this.noiseBuf.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
	}

	/** Sets the volumes, the brightness and the echo from the tuning. `now` skips the short glide. */
	applyTuning(now = false) {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		const set = (param, value, glide) => (now ? (param.value = value) : param.setTargetAtTime(value, t, glide));
		set(this.sfx.gain, this.sfxOn ? S.volume : 0, 0.02);
		set(this.music.gain, this.musicOn ? S.music : 0, 0.1);
		set(this.bright.frequency, Math.min(S.bright, this.ctx.sampleRate / 2 - 100), 0.02);
		set(this.echo.delayTime, S.echoTime, 0.05);
		set(this.feedback.gain, Math.min(0.9, S.echoFeedback), 0.02);
	}

	/** Plays a sound with its own volume, pitch and length from the tuning. */
	scoped(name, play) {
		const each = S.each[name] || { volume: 1, pitch: 0, length: 1 };
		const before = this.scope;
		this.scope = { volume: each.volume, pitch: Math.pow(2, each.pitch / 12), length: each.length };
		try {
			return play();
		} finally {
			this.scope = before;
		}
	}

	get ready() {
		// An offline copy (see renderSound) is always ready: it plays into a buffer, not the speakers.
		return Boolean(this.offline || (this.ctx && this.ctx.state === 'running'));
	}

	/** Plays the sound of the power-up set in use, if it is not today's. Returns true when it did. */
	power(name, ...args) {
		const set = POWER[S.powerStyle];
		if (!set || !set[name]) return false;
		set[name].apply(this, args);
		return true;
	}

	/** Plays the sound of the small-sound set in use, if it is not today's. Returns true when it did. */
	small(name, ...args) {
		const set = SMALL[S.smallStyle];
		if (!set || !set[name]) return false;
		set[name].apply(this, args);
		return true;
	}

	setSfx(on) {
		this.sfxOn = on;
		if (this.sfx) this.sfx.gain.setTargetAtTime(on ? S.volume : 0, this.ctx.currentTime, 0.02);
	}

	setMusic(on) {
		this.musicOn = on;
		if (this.music) this.music.gain.setTargetAtTime(on ? S.music : 0, this.ctx.currentTime, 0.2);
	}

	suspend() {
		// A refused suspend leaves the sound on, which does no harm.
		if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
	}

	resume() {
		// A browser can refuse to wake the sound before a tap. The next tap tries again.
		if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
	}

	// ---- building blocks ----

	tone({ freq, type = 'sine', at = 0, attack = 0.005, decay = 0.3, gain = 0.3, slide = 0, out, echo = 0 }) {
		if (!this.ready || (!out && !this.sfxOn)) return;
		if (!out) {
			const k = this.scope;
			freq *= k.pitch;
			gain *= k.volume;
			at *= k.length;
			attack *= k.length;
			decay *= k.length;
			echo *= S.echoSend;
		}
		if (gain <= 0.0001) return;
		const ctx = this.ctx;
		const t = ctx.currentTime + at;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + decay);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(gain, t + attack);
		g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
		osc.connect(g);
		g.connect(out || this.sfx);
		if (echo) {
			const e = ctx.createGain();
			e.gain.value = echo;
			g.connect(e);
			e.connect(this.echoIn);
		}
		osc.start(t);
		osc.stop(t + attack + decay + 0.05);
	}

	noise({ at = 0, decay = 0.2, gain = 0.3, freq = 1200, q = 1, type = 'bandpass', sweep = 0 }) {
		if (!this.ready || !this.sfxOn) return;
		const k = this.scope;
		freq *= k.pitch;
		gain *= k.volume;
		at *= k.length;
		decay *= k.length;
		if (gain <= 0.0001) return;
		const ctx = this.ctx;
		const t = ctx.currentTime + at;
		const src = ctx.createBufferSource();
		src.buffer = this.noiseBuf;
		const f = ctx.createBiquadFilter();
		f.type = type;
		f.frequency.setValueAtTime(freq, t);
		if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + decay);
		f.Q.value = q;
		const g = ctx.createGain();
		g.gain.setValueAtTime(gain, t);
		g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
		src.connect(f);
		f.connect(g);
		g.connect(this.sfx);
		src.start(t, Math.random() * 0.5);
		src.stop(t + decay + 0.05);
	}

	/** One note of the instrument body in use (see bodies.js), with its own volume, pitch and length. */
	voice(freq, { at = 0, gain = 0.2, echo = 0.15, body = S.body } = {}) {
		if (!this.ready || !this.sfxOn) return;
		const k = this.scope;
		const ctx = this.ctx;
		const out = ctx.createGain();
		out.connect(this.sfx);
		if (echo && S.echoSend) {
			const e = ctx.createGain();
			e.gain.value = echo * S.echoSend;
			out.connect(e);
			e.connect(this.echoIn);
		}
		playBody(body, ctx, out, freq * k.pitch, ctx.currentTime + at * k.length, gain * k.volume, k.length);
	}

	/** True when a body from bodies.js plays the notes, not the built-in wooden bar. */
	get usesBody() {
		return S.body !== 'classic' && Boolean(BODIES[S.body]);
	}

	/** A wooden bar, like a marimba: a warm note, a short knock above it, and a tiny click. */
	bell(freq, { at = 0, gain = 0.22, decay = 0.9, echo = 0.15 } = {}) {
		if (this.usesBody) return this.voice(freq, { at, gain, echo });
		const d = Math.min(decay, S.barLength);
		this.tone({ freq, type: S.barWave, at, gain, decay: d, echo });
		this.tone({ freq: freq * S.knockPitch, at, gain: gain * S.knock, decay: d * 0.18 });
		this.tone({ freq: freq * 10, type: 'triangle', at, attack: 0.002, gain: gain * S.click, decay: 0.012 });
	}

	/** A "plunk": a round blip whose pitch jumps up, like a block that drops into water. */
	pop(freq, { at = 0, gain = 0.2, decay = S.popLength } = {}) {
		if (this.usesBody) return this.voice(freq, { at, gain: gain * 0.9, echo: 0 });
		this.tone({ freq: freq * S.popFrom, at, gain, decay, slide: S.popSlide });
	}

	// ---- game sounds ----

	ui() {
		if (this.small('ui')) return;
		this.tone({ freq: 880, type: 'triangle', decay: 0.07, gain: 0.12 });
	}

	pick() {
		if (this.small('pick')) return;
		this.tone({ freq: 660, decay: 0.08, gain: 0.14, slide: 1.5 });
	}

	move() {
		if (this.small('move')) return;
		this.tone({ freq: 1250, type: 'triangle', decay: 0.03, gain: 0.05 });
	}

	deny() {
		if (this.small('deny')) return;
		this.tone({ freq: 160, type: 'square', decay: 0.14, gain: 0.07, slide: 0.7 });
	}

	/** A piece lands: a soft wooden thud and a plunk. */
	land(count = 1) {
		const g = Math.min(0.34, 0.18 + count * 0.04);
		const thud = g * (this.usesBody ? BODIES[S.body].thud : 1);
		this.tone({ freq: S.thudPitch, decay: S.thudLength, gain: thud, slide: 0.55 });
		this.noise({ decay: 0.05, gain: thud * S.thudNoise, freq: 700, q: 0.8, type: 'lowpass' });
		this.pop(S.landPlunkPitch, { gain: g * S.landPlunk });
	}

	/** The chime for a cleared match. It climbs the scale with each chain step. */
	clear(chain, size) {
		const plan = planClear(chain, size);
		if (plan.under) this.pop(midi(plan.under.note), { gain: plan.under.gain });
		for (const n of plan.notes) this.bell(midi(n.note), { at: 0.03 + n.at * S.clearSpread, gain: n.gain, echo: plan.echo });
	}

	forge(kind) {
		if (this.power('forge', kind)) return;
		const base = kind === 'nova' ? 84 : 79;
		[0, 4, 7].forEach((s, i) => this.pop(midi(base - 12 + s), { at: i * 0.06, gain: 0.16 }));
		this.bell(midi(base + 12), { at: 0.18, gain: 0.12, decay: 0.4 });
	}

	flare() {
		if (this.power('flare')) return;
		this.tone({ freq: 90, decay: 0.45, gain: 0.45, slide: 0.4 });
		this.noise({ decay: 0.45, gain: 0.32, freq: 2200, q: 0.6, type: 'lowpass', sweep: 0.15 });
		this.pop(midi(67), { at: 0.02, gain: 0.2, decay: 0.16 });
	}

	nova() {
		this.tone({ freq: 60, decay: 1.2, gain: 0.5, slide: 0.5 });
		this.noise({ decay: 1.1, gain: 0.3, freq: 5000, q: 0.5, type: 'lowpass', sweep: 0.08 });
		[0, 2, 4, 7, 9, 12, 14, 16, 19, 24].forEach((s, i) => this.bell(midi(76 + s), { at: 0.04 * i, gain: 0.1, decay: 0.7 }));
	}

	/** Remix: a rising whine while the board charges. */
	remixCharge() {
		if (this.power('remixCharge')) return;
		this.tone({ freq: 90, type: 'sawtooth', attack: 0.15, decay: 0.9, gain: 0.16, slide: 9 });
		this.tone({ freq: 180, type: 'triangle', attack: 0.15, decay: 0.9, gain: 0.14, slide: 9 });
		this.noise({ decay: 0.95, gain: 0.18, freq: 300, q: 3, sweep: 14 });
	}

	/** Remix: blocks rattling, a run of short clicks for this many seconds. */
	remixRattle(seconds) {
		for (let t = 0; t < seconds; t += 0.04) {
			this.noise({ at: t, decay: 0.04, gain: 0.16, freq: 1800 + Math.random() * 2600, q: 1.5 });
			if (Math.random() < 0.3) this.tone({ freq: 700 + Math.random() * 500, type: 'triangle', at: t, decay: 0.03, gain: 0.05 });
		}
	}

	/** Remix: the blast when the colors flip. */
	remixBoom() {
		if (this.power('remixBoom')) return;
		this.tone({ freq: 70, decay: 0.8, gain: 0.55, slide: 0.35 });
		this.noise({ decay: 0.7, gain: 0.45, freq: 4000, q: 0.5, type: 'lowpass', sweep: 0.06 });
		[0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.bell(midi(67 + s), { at: i * 0.04, gain: 0.12, decay: 0.9 }));
	}

	/** Remix: a note as blocks land. The notes climb the scale as more blocks land. */
	remixTick(n) {
		if (this.power('remixTick', n)) return;
		const scale = scaleNotes(S.scale);
		this.bell(midi(79 + scale[Math.min(n, scale.length - 1)]), { gain: 0.09, decay: 0.4 });
	}

	/** A logo tile: one wooden note of the scale. */
	tile(index) {
		const scale = scaleNotes(S.scale);
		const note = 72 + scale[index % scale.length];
		this.pop(midi(note), { gain: 0.14 });
		this.bell(midi(note), { at: 0.02, gain: 0.14, decay: 0.35 });
	}

	tick(urgent) {
		if (this.small('tick', urgent)) return;
		this.tone({ freq: urgent ? 1320 : 990, type: 'square', decay: 0.03, gain: 0.05 });
	}

	allClear() {
		if (this.power('allClear')) return;
		[0, 4, 7, 11, 14, 19].forEach((s, i) => this.bell(midi(72 + s), { at: i * 0.09, gain: 0.16, decay: 1.2 }));
	}

	gameOver() {
		if (this.power('gameOver')) return;
		[7, 4, 0, -5].forEach((s, i) => this.bell(midi(67 + s), { at: i * 0.18, gain: 0.16, decay: 1.1 }));
	}

	best() {
		if (this.power('best')) return;
		[0, 4, 7, 12, 16].forEach((s, i) => this.bell(midi(79 + s), { at: 0.5 + i * 0.08, gain: 0.14, decay: 1 }));
	}

	// ---- music ----

	startMusic() {
		this.musicWanted = true;
		if (!this.ctx || this.timer) return;
		this.nextBeat = this.ctx.currentTime + 0.1;
		this.timer = setInterval(() => this.schedule(), 90);
	}

	schedule() {
		if (!this.ready || !this.musicOn) {
			if (this.ctx) this.nextBeat = this.ctx.currentTime + 0.1;
			return;
		}
		const eighth = 60 / S.tempo / 2;
		while (this.nextBeat < this.ctx.currentTime + 0.3) {
			this.playBeat(this.beat, this.nextBeat - this.ctx.currentTime, eighth);
			this.nextBeat += eighth;
			this.beat++;
		}
	}

	playBeat(beat, at, eighth) {
		const bar = Math.floor(beat / 8);
		const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
		const step = beat % 8;
		if (at < 0) return;
		if (beat % 16 === 0) {
			// Pad: long, soft triangle notes.
			for (const n of chord) {
				for (const detune of [-4, 4]) {
					this.tone({ freq: midi(n) * Math.pow(2, detune / 1200), type: 'triangle', at, attack: 1.2, decay: eighth * 16, gain: 0.05, out: this.music });
				}
			}
		}
		if (step === 0 || step === 4) {
			this.tone({ freq: midi(chord[0] - 24), at, attack: 0.02, decay: eighth * 3.5, gain: 0.16, out: this.music });
		}
		// Pluck: a few notes of the chord, one octave up, chosen at random.
		const chance = step % 2 === 0 ? 0.6 : 0.3;
		if (Math.random() < chance) {
			const pool = [...chord.map((n) => n + 12), chord[0] + 24, chord[1] + 24];
			const n = pool[Math.floor(Math.random() * pool.length)];
			this.tone({ freq: midi(n), at, attack: 0.004, decay: 0.5, gain: 0.07, out: this.music, echo: 0.6 });
		}
	}
}

// Each game sound plays inside its own scope: its volume, pitch and length from the tuning.
for (const name of SOUND_NAMES) {
	const play = Audio.prototype[name];
	Audio.prototype[name] = function (...args) {
		return this.scoped(name, () => play.apply(this, args));
	};
}

export const audio = new Audio();

/**
 * Plays sounds into a buffer instead of the speakers, for a picture of them. play(a) gets an audio
 * copy that uses the same tuning. Returns a promise of the AudioBuffer, or null with no offline audio.
 */
export function renderSound(play, seconds = 1.2, rate = 22050) {
	const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
	if (!OAC) return Promise.resolve(null);
	const copy = new Audio();
	copy.offline = true;
	copy.ctx = new OAC(1, Math.round(rate * seconds), rate);
	copy.build();
	play(copy);
	return copy.ctx.startRendering();
}
