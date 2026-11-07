// All sound is made with the Web Audio API. Nothing is loaded from files.
// Phones block audio until the first tap, so unlock() runs on every tap and key.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

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
	}

	/** Creates or wakes the audio context. Call from a user gesture. */
	unlock() {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return;
		if (!this.ctx) {
			try {
				this.ctx = new AC();
			} catch {
				return;
			}
			this.build();
		}
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

		this.sfx = ctx.createGain();
		this.sfx.gain.value = this.sfxOn ? 0.8 : 0;
		this.sfx.connect(this.master);

		this.music = ctx.createGain();
		this.music.gain.value = this.musicOn ? 0.32 : 0;
		this.music.connect(this.master);

		// A soft echo that the music and chimes share.
		this.echo = ctx.createDelay(1);
		this.echo.delayTime.value = 0.36;
		const feedback = ctx.createGain();
		feedback.gain.value = 0.32;
		const tone = ctx.createBiquadFilter();
		tone.type = 'lowpass';
		tone.frequency.value = 2400;
		this.echoIn = ctx.createGain();
		this.echoIn.gain.value = 0.5;
		this.echoIn.connect(this.echo);
		this.echo.connect(tone);
		tone.connect(feedback);
		feedback.connect(this.echo);
		tone.connect(this.master);

		const len = ctx.sampleRate;
		this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = this.noiseBuf.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
	}

	get ready() {
		return this.ctx && this.ctx.state === 'running';
	}

	setSfx(on) {
		this.sfxOn = on;
		if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.02);
	}

	setMusic(on) {
		this.musicOn = on;
		if (this.music) this.music.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.2);
	}

	suspend() {
		if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
	}

	resume() {
		if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
	}

	// ---- building blocks ----

	tone({ freq, type = 'sine', at = 0, attack = 0.005, decay = 0.3, gain = 0.3, slide = 0, out, echo = 0 }) {
		if (!this.ready || (!out && !this.sfxOn)) return;
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

	/** A glassy bell: a few partials that are not quite in tune with each other. */
	bell(freq, { at = 0, gain = 0.22, decay = 0.9, echo = 0.35 } = {}) {
		this.tone({ freq, at, gain, decay, echo });
		this.tone({ freq: freq * 2.76, at, gain: gain * 0.32, decay: decay * 0.45, echo });
		this.tone({ freq: freq * 5.4, at, gain: gain * 0.12, decay: decay * 0.25 });
		this.tone({ freq: freq * 2, type: 'triangle', at, gain: gain * 0.15, decay: decay * 0.6 });
	}

	// ---- game sounds ----

	ui() {
		this.tone({ freq: 880, type: 'triangle', decay: 0.07, gain: 0.12 });
	}

	pick() {
		this.tone({ freq: 660, decay: 0.08, gain: 0.14, slide: 1.5 });
	}

	move() {
		this.tone({ freq: 1250, type: 'triangle', decay: 0.03, gain: 0.05 });
	}

	deny() {
		this.tone({ freq: 160, type: 'square', decay: 0.14, gain: 0.07, slide: 0.7 });
	}

	land(count = 1) {
		const g = Math.min(0.32, 0.16 + count * 0.04);
		this.tone({ freq: 140, decay: 0.14, gain: g, slide: 0.5 });
		this.noise({ decay: 0.07, gain: g * 0.6, freq: 900, q: 0.8, type: 'lowpass' });
		this.tone({ freq: 1900, type: 'triangle', decay: 0.04, gain: 0.04 });
	}

	/** The chime for a cleared match. It climbs the scale with each chain step. */
	clear(chain, size) {
		const root = 72;
		const n = PENTA[Math.min(chain - 1, PENTA.length - 3)];
		const notes = [root + n, root + PENTA[Math.min(chain + 1, PENTA.length - 1)]];
		if (size >= 4) notes.push(root + n + 12);
		notes.forEach((note, i) => this.bell(midi(note), { at: i * 0.055, gain: 0.2 - i * 0.03 }));
		this.noise({ decay: 0.18, gain: 0.08, freq: 6000, q: 0.7, type: 'highpass' });
	}

	forge(kind) {
		const base = kind === 'nova' ? 84 : 79;
		[0, 4, 7, 12].forEach((s, i) => this.bell(midi(base + s), { at: i * 0.05, gain: 0.12, decay: 0.5 }));
	}

	flare() {
		this.tone({ freq: 90, decay: 0.45, gain: 0.45, slide: 0.4 });
		this.noise({ decay: 0.45, gain: 0.32, freq: 2200, q: 0.6, type: 'lowpass', sweep: 0.15 });
		this.bell(midi(91), { gain: 0.1, decay: 0.6 });
	}

	nova() {
		this.tone({ freq: 60, decay: 1.2, gain: 0.5, slide: 0.5 });
		this.noise({ decay: 1.1, gain: 0.3, freq: 5000, q: 0.5, type: 'lowpass', sweep: 0.08 });
		[0, 2, 4, 7, 9, 12, 14, 16, 19, 24].forEach((s, i) => this.bell(midi(76 + s), { at: 0.04 * i, gain: 0.1, decay: 0.7 }));
	}

	/** Remix: a rising whine while the board charges. */
	remixCharge() {
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
		this.tone({ freq: 70, decay: 0.8, gain: 0.55, slide: 0.35 });
		this.noise({ decay: 0.7, gain: 0.45, freq: 4000, q: 0.5, type: 'lowpass', sweep: 0.06 });
		[0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.bell(midi(67 + s), { at: i * 0.04, gain: 0.12, decay: 0.9 }));
	}

	/** Remix: a note as blocks land. The notes climb the scale as more blocks land. */
	remixTick(n) {
		this.bell(midi(79 + PENTA[Math.min(n, PENTA.length - 1)]), { gain: 0.09, decay: 0.4 });
	}

	tick(urgent) {
		this.tone({ freq: urgent ? 1320 : 990, type: 'square', decay: 0.03, gain: 0.05 });
	}

	allClear() {
		[0, 4, 7, 11, 14, 19].forEach((s, i) => this.bell(midi(72 + s), { at: i * 0.09, gain: 0.16, decay: 1.2 }));
	}

	gameOver() {
		[7, 4, 0, -5].forEach((s, i) => this.bell(midi(67 + s), { at: i * 0.18, gain: 0.16, decay: 1.1 }));
	}

	best() {
		[0, 4, 7, 12, 16].forEach((s, i) => this.bell(midi(79 + s), { at: 0.5 + i * 0.08, gain: 0.14, decay: 1 }));
	}

	// ---- music ----

	startMusic() {
		this.musicWanted = true;
		if (!this.ctx || this.timer) return;
		this.nextBeat = this.ctx.currentTime + 0.1;
		this.timer = setInterval(() => this.schedule(), 90);
	}

	stopMusic() {
		this.musicWanted = false;
		clearInterval(this.timer);
		this.timer = null;
	}

	schedule() {
		if (!this.ready || !this.musicOn) {
			if (this.ctx) this.nextBeat = this.ctx.currentTime + 0.1;
			return;
		}
		const eighth = 60 / 76 / 2;
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

export const audio = new Audio();
