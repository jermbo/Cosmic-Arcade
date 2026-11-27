/**
 * All sound, made with Web Audio nodes. Each effect is rendered once into a buffer
 * with an OfflineAudioContext (filters, envelopes, a soft room reverb), then played
 * back cheaply. Notes come from one pentatonic scale, so everything sounds in tune.
 * Nothing is downloaded.
 */

export type Sfx =
	| 'select'
	| 'num0'
	| 'num1'
	| 'num2'
	| 'num3'
	| 'color0'
	| 'color1'
	| 'color2'
	| 'color3'
	| 'squish'
	| 'click'
	| 'erase'
	| 'note'
	| 'undo'
	| 'clash'
	| 'locked'
	| 'shimmer'
	| 'solve'
	| 'hint'
	| 'ui'
	| 'page';

const RATE = 44100;
// G major pentatonic.
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const G4 = 67;
const SCALE = [0, 2, 4, 7, 9]; // G A B D E
const note = (step: number) => hz(G4 + SCALE[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5));

type Render = (ctx: OfflineAudioContext, out: AudioNode, wet: AudioNode) => void;

function impulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
	const len = Math.floor(ctx.sampleRate * seconds);
	const buf = ctx.createBuffer(2, len, ctx.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const d = buf.getChannelData(ch);
		for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
	}
	return buf;
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
	const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	return buf;
}

/** A glassy bell: a few inharmonic partials that fade at different speeds. */
function glass(ctx: BaseAudioContext, dest: AudioNode, t: number, freq: number, level: number, length = 0.9) {
	const partials: [number, number, number][] = [
		[1, 1, 1],
		[2.0, 0.35, 0.6],
		[2.76, 0.22, 0.45],
		[5.4, 0.08, 0.25],
	];
	for (const [ratio, amp, life] of partials) {
		const o = ctx.createOscillator();
		o.type = 'sine';
		o.frequency.value = freq * ratio;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(level * amp, t + 0.004);
		g.gain.exponentialRampToValueAtTime(0.0001, t + length * life);
		o.connect(g).connect(dest);
		o.start(t);
		o.stop(t + length * life + 0.05);
	}
}

/** A soft wooden tock. */
function tock(ctx: BaseAudioContext, dest: AudioNode, t: number, freq: number, level: number) {
	const o = ctx.createOscillator();
	o.type = 'triangle';
	o.frequency.setValueAtTime(freq * 1.6, t);
	o.frequency.exponentialRampToValueAtTime(freq, t + 0.012);
	const g = ctx.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(level, t + 0.003);
	g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
	const lp = ctx.createBiquadFilter();
	lp.type = 'lowpass';
	lp.frequency.value = 2400;
	o.connect(g).connect(lp).connect(dest);
	o.start(t);
	o.stop(t + 0.2);
}

function noise(ctx: BaseAudioContext, dest: AudioNode, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, level: number, attack = 0.004) {
	const src = ctx.createBufferSource();
	src.buffer = noiseBuffer(ctx, dur + 0.05);
	const f = ctx.createBiquadFilter();
	f.type = type;
	f.Q.value = q;
	f.frequency.setValueAtTime(f0, t);
	f.frequency.exponentialRampToValueAtTime(f1, t + dur);
	const g = ctx.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(level, t + attack);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	src.connect(f).connect(g).connect(dest);
	src.start(t);
	src.stop(t + dur + 0.05);
}

function glide(ctx: BaseAudioContext, dest: AudioNode, t: number, f0: number, f1: number, dur: number, level: number, type: OscillatorType = 'sine') {
	const o = ctx.createOscillator();
	o.type = type;
	o.frequency.setValueAtTime(f0, t);
	o.frequency.exponentialRampToValueAtTime(f1, t + dur);
	const g = ctx.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(level, t + 0.006);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	o.connect(g).connect(dest);
	o.start(t);
	o.stop(t + dur + 0.05);
}

/** A warm pad chord: detuned saws through a slow lowpass. */
function pad(ctx: BaseAudioContext, dest: AudioNode, t: number, freqs: number[], dur: number, level: number) {
	const lp = ctx.createBiquadFilter();
	lp.type = 'lowpass';
	lp.Q.value = 0.4;
	lp.frequency.setValueAtTime(400, t);
	lp.frequency.linearRampToValueAtTime(1300, t + dur * 0.45);
	lp.frequency.linearRampToValueAtTime(500, t + dur);
	const g = ctx.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(level, t + dur * 0.35);
	g.gain.linearRampToValueAtTime(0, t + dur);
	lp.connect(g).connect(dest);
	for (const f of freqs) {
		for (const detune of [-7, 6]) {
			const o = ctx.createOscillator();
			o.type = 'sawtooth';
			o.frequency.value = f;
			o.detune.value = detune;
			o.connect(lp);
			o.start(t);
			o.stop(t + dur + 0.05);
		}
	}
}

const SOUNDS: Record<Sfx, { length: number; wet: number; render: Render }> = {
	select: { length: 0.25, wet: 0.15, render: (c, o) => glass(c, o, 0, note(12), 0.12, 0.35) },
	num0: { length: 0.3, wet: 0.2, render: (c, o) => tock(c, o, 0, note(5), 0.5) },
	num1: { length: 0.3, wet: 0.2, render: (c, o) => tock(c, o, 0, note(6), 0.5) },
	num2: { length: 0.3, wet: 0.2, render: (c, o) => tock(c, o, 0, note(7), 0.5) },
	num3: { length: 0.3, wet: 0.2, render: (c, o) => tock(c, o, 0, note(8), 0.5) },
	color0: { length: 0.9, wet: 0.35, render: (c, o) => glass(c, o, 0, note(10), 0.22) },
	color1: { length: 0.9, wet: 0.35, render: (c, o) => glass(c, o, 0, note(11), 0.22) },
	color2: { length: 0.9, wet: 0.35, render: (c, o) => glass(c, o, 0, note(12), 0.22) },
	color3: { length: 0.9, wet: 0.35, render: (c, o) => glass(c, o, 0, note(13), 0.22) },
	squish: {
		length: 0.35,
		wet: 0.1,
		render: (c, o) => {
			noise(c, o, 0, 0.2, 'bandpass', 1100, 260, 5, 0.5, 0.02);
			glide(c, o, 0.01, 260, 120, 0.16, 0.28);
		},
	},
	click: {
		length: 0.6,
		wet: 0.3,
		render: (c, o) => {
			noise(c, o, 0, 0.025, 'highpass', 5000, 3000, 0.7, 0.35);
			tock(c, o, 0, 190, 0.45);
			glass(c, o, 0.01, note(15), 0.08, 0.5);
		},
	},
	erase: { length: 0.2, wet: 0.1, render: (c, o) => glide(c, o, 0, 520, 300, 0.09, 0.22, 'triangle') },
	note: {
		length: 0.15,
		wet: 0,
		render: (c, o) => {
			noise(c, o, 0, 0.03, 'bandpass', 3800, 3000, 1.6, 0.18);
			noise(c, o, 0.045, 0.03, 'bandpass', 3400, 2800, 1.6, 0.14);
		},
	},
	undo: { length: 0.25, wet: 0.15, render: (c, o) => glide(c, o, 0, 700, 380, 0.12, 0.18, 'triangle') },
	clash: {
		length: 0.4,
		wet: 0.15,
		render: (c, o) => {
			glide(c, o, 0, 170, 120, 0.22, 0.4);
			noise(c, o, 0, 0.12, 'lowpass', 600, 200, 0.7, 0.2);
		},
	},
	locked: {
		length: 0.3,
		wet: 0.1,
		render: (c, o) => {
			tock(c, o, 0, 150, 0.4);
			tock(c, o, 0.07, 140, 0.25);
		},
	},
	shimmer: {
		length: 2.0,
		wet: 0.55,
		render: (c, o) => [12, 13, 15, 17].forEach((s, i) => glass(c, o, i * 0.07, note(s), 0.12, 1.2)),
	},
	solve: {
		length: 4.2,
		wet: 0.6,
		render: (c, o) => {
			pad(c, o, 0, [note(0) / 2, note(2) / 2, note(3) / 2, note(5) / 2], 3.6, 0.05);
			[5, 7, 8, 10, 12, 13, 15].forEach((s, i) => glass(c, o, 0.1 + i * 0.11, note(s), 0.14, 1.6));
		},
	},
	hint: { length: 1.4, wet: 0.5, render: (c, o) => [14, 12].forEach((s, i) => glass(c, o, i * 0.12, note(s), 0.13, 1.1)) },
	ui: { length: 0.1, wet: 0, render: (c, o) => tock(c, o, 0, 880, 0.18) },
	page: { length: 0.25, wet: 0.1, render: (c, o) => noise(c, o, 0, 0.14, 'bandpass', 1800, 900, 0.9, 0.12, 0.03) },
};

async function renderSound(def: { length: number; wet: number; render: Render }): Promise<AudioBuffer> {
	const off = new OfflineAudioContext(2, Math.ceil(RATE * (def.length + 0.6)), RATE);
	const dry = off.createGain();
	const verb = off.createConvolver();
	verb.buffer = impulse(off, 1.6, 3);
	const wet = off.createGain();
	wet.gain.value = def.wet;
	const bus = off.createGain();
	bus.connect(dry).connect(off.destination);
	bus.connect(verb).connect(wet).connect(off.destination);
	def.render(off, bus, wet);
	return off.startRendering();
}

// ---------------------------------------------------------------- music

/** Chords for the music: G, Em, C, D, as scale steps. */
const CHORDS = [
	[0, 2, 3],
	[4, 0, 2],
	[3, 4, 1],
	[3, 0, 1],
].map((steps) => steps.map((s) => note(s - 5)));

class Engine {
	ctx: AudioContext | null = null;
	sfxGain!: GainNode;
	musicGain!: GainNode;
	buffers = new Map<string, AudioBuffer>();
	sfxLevel = 0.8;
	musicLevel = 0.45;
	private musicOn = false;
	private nextBeat = 0;
	private beat = 0;
	private timer = 0;
	private lastStep = 7;

	/** Must run inside a tap or key press (browsers only allow sound after one). */
	unlock() {
		if (!this.ctx) {
			const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (!Ctx) return;
			this.ctx = new Ctx();
			const comp = this.ctx.createDynamicsCompressor();
			comp.threshold.value = -16;
			comp.ratio.value = 3;
			comp.connect(this.ctx.destination);
			this.sfxGain = this.ctx.createGain();
			this.musicGain = this.ctx.createGain();
			this.sfxGain.connect(comp);
			this.musicGain.connect(comp);
			this.applyLevels();
			void this.prepare();
		}
		if (this.ctx.state === 'suspended') void this.ctx.resume();
		if (this.musicOn) this.startMusic();
	}

	private async prepare() {
		for (const [name, def] of Object.entries(SOUNDS)) this.buffers.set(name, await renderSound(def));
		// Music box notes (2 octaves) and pad chords.
		for (let s = 5; s < 16; s++) this.buffers.set(`box${s}`, await renderSound({ length: 1.8, wet: 0.5, render: (c, o) => glass(c, o, 0, note(s), 0.1, 1.8) }));
		for (const [i, chord] of CHORDS.entries())
			this.buffers.set(`pad${i}`, await renderSound({ length: 6.6, wet: 0.5, render: (c, o) => pad(c, o, 0, chord, 6.6, 0.035) }));
	}

	setLevels(sfx: number, music: number) {
		this.sfxLevel = sfx;
		this.musicLevel = music;
		this.applyLevels();
	}

	private applyLevels() {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.sfxGain.gain.setTargetAtTime(this.sfxLevel * 0.9, t, 0.05);
		this.musicGain.gain.setTargetAtTime(this.musicLevel * 0.55, t, 0.3);
	}

	play(name: Sfx, opts: { delay?: number; rate?: number; gain?: number } = {}) {
		if (!this.ctx || this.sfxLevel <= 0) return;
		const buf = this.buffers.get(name);
		if (!buf) return;
		const src = this.ctx.createBufferSource();
		src.buffer = buf;
		src.playbackRate.value = opts.rate ?? 1;
		const g = this.ctx.createGain();
		g.gain.value = opts.gain ?? 1;
		src.connect(g).connect(this.sfxGain);
		src.start(this.ctx.currentTime + (opts.delay ?? 0));
	}

	/** Lowers the music for a moment (for the solve chord). */
	duck(seconds: number) {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.musicGain.gain.cancelScheduledValues(t);
		this.musicGain.gain.setTargetAtTime(this.musicLevel * 0.15, t, 0.1);
		this.musicGain.gain.setTargetAtTime(this.musicLevel * 0.55, t + seconds, 1);
	}

	setMusic(on: boolean) {
		this.musicOn = on;
		if (on) this.startMusic();
		else this.stopMusic();
	}

	private startMusic() {
		if (!this.ctx || this.timer) return;
		this.nextBeat = this.ctx.currentTime + 0.3;
		this.timer = window.setInterval(() => this.schedule(), 120);
	}

	private stopMusic() {
		clearInterval(this.timer);
		this.timer = 0;
	}

	/** A slow, sparse music box over soft chords. 66 beats a minute, in 8ths. */
	private schedule() {
		if (!this.ctx || this.musicLevel <= 0) return;
		const eighth = 60 / 66 / 2;
		while (this.nextBeat < this.ctx.currentTime + 0.4) {
			const t = this.nextBeat;
			const bar = Math.floor(this.beat / 8);
			if (this.beat % 16 === 0) this.playAt(`pad${Math.floor(bar / 2) % 4}`, t, this.musicGain, 1);
			const strong = this.beat % 4 === 0;
			if (Math.random() < (strong ? 0.75 : 0.22)) {
				// A gentle random walk on the scale, drawn toward chord tones on strong beats.
				this.lastStep = Math.max(5, Math.min(15, this.lastStep + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
				this.playAt(`box${this.lastStep}`, t, this.musicGain, strong ? 0.9 : 0.55);
			}
			this.beat++;
			this.nextBeat += eighth;
		}
	}

	private playAt(name: string, t: number, dest: AudioNode, gain: number) {
		const buf = this.buffers.get(name);
		if (!buf || !this.ctx) return;
		const src = this.ctx.createBufferSource();
		src.buffer = buf;
		const g = this.ctx.createGain();
		g.gain.value = gain;
		src.connect(g).connect(dest);
		src.start(t);
	}
}

export const audio = new Engine();
