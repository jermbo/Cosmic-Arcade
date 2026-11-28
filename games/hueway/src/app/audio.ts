/**
 * All sound, made with Web Audio nodes. Nothing is downloaded.
 *
 * Each sound pack (a shop item) is one instrument: soft glass chimes, a wooden
 * kalimba, or a felt piano. Every effect and the music are played on that
 * instrument, on one G-major pentatonic scale, so everything is in tune.
 * Effects are rendered once per pack with an OfflineAudioContext (filters,
 * envelopes, a small room), then played back cheaply.
 *
 * Mixing rules, to keep it soft: no raw noise bursts, no sharp attacks (4 ms or
 * more), a low-pass on every voice, and quiet levels.
 */

export type Sfx = 'pick' | 'link' | 'cut' | 'clear' | 'undo' | 'blocked' | 'solve' | 'hint' | 'ui' | 'page' | 'coin' | 'buy';

const RATE = 44100;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const G3 = 55;
const SCALE = [0, 2, 4, 7, 9]; // G A B D E
/** Scale step 0 is G3; step 5 is G4, step 10 is G5. */
const note = (step: number) => hz(G3 + SCALE[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5));

type Voice = (ctx: BaseAudioContext, out: AudioNode, t: number, freq: number, level: number, length?: number) => void;

function env(ctx: BaseAudioContext, t: number, level: number, attack: number, length: number): GainNode {
	const g = ctx.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(level, t + attack);
	g.gain.exponentialRampToValueAtTime(0.0001, t + length);
	return g;
}

function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number, t: number, length: number) {
	const o = ctx.createOscillator();
	o.type = type;
	o.frequency.value = freq;
	o.start(t);
	o.stop(t + length + 0.05);
	return o;
}

function lowpass(ctx: BaseAudioContext, freq: number, q = 0.5) {
	const f = ctx.createBiquadFilter();
	f.type = 'lowpass';
	f.frequency.value = freq;
	f.Q.value = q;
	return f;
}

// ---------------------------------------------------------------- instruments

/** Soft glass bell: near-harmonic partials, the upper ones fade first. */
const bell: Voice = (ctx, out, t, f, level, length = 1.4) => {
	const lp = lowpass(ctx, 4200);
	lp.connect(out);
	for (const [ratio, amp, life] of [
		[1, 1, 1],
		[2, 0.22, 0.5],
		[3.01, 0.06, 0.28],
	] as const) {
		const o = osc(ctx, 'sine', f * ratio, t, length * life);
		o.connect(env(ctx, t, level * amp, 0.006, length * life)).connect(lp);
	}
};

/** Kalimba: a round tine with a tiny pitch settle and a soft overtone. */
const kalimba: Voice = (ctx, out, t, f, level, length = 1.1) => {
	const lp = lowpass(ctx, 3000);
	lp.connect(out);
	const o = osc(ctx, 'sine', f, t, length);
	o.frequency.setValueAtTime(f * 1.012, t);
	o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
	o.connect(env(ctx, t, level, 0.005, length)).connect(lp);
	const over = osc(ctx, 'sine', f * 5.2, t, 0.12);
	over.connect(env(ctx, t, level * 0.08, 0.004, 0.12)).connect(lp);
	const body = osc(ctx, 'triangle', f / 2, t, 0.3);
	body.connect(env(ctx, t, level * 0.12, 0.01, 0.3)).connect(lp);
};

/** Felt piano: a muted hammer, warm and close. */
const felt: Voice = (ctx, out, t, f, level, length = 1.6) => {
	const lp = ctx.createBiquadFilter();
	lp.type = 'lowpass';
	lp.Q.value = 0.3;
	lp.frequency.setValueAtTime(2400, t);
	lp.frequency.exponentialRampToValueAtTime(700, t + length * 0.6);
	lp.connect(out);
	for (const [type, ratio, amp, detune] of [
		['triangle', 1, 1, 0],
		['sine', 1, 0.5, 4],
		['sine', 2, 0.18, -3],
	] as const) {
		const o = osc(ctx, type, f * ratio, t, length);
		o.detune.value = detune;
		o.connect(env(ctx, t, level * amp, 0.008, length)).connect(lp);
	}
};

/** A warm pad for the music: stacked sines and triangles, slow in and out. */
function pad(ctx: BaseAudioContext, out: AudioNode, t: number, freqs: number[], length: number, level: number) {
	const lp = lowpass(ctx, 900, 0.3);
	const g = ctx.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(level, t + length * 0.4);
	g.gain.linearRampToValueAtTime(0, t + length);
	lp.connect(g).connect(out);
	for (const f of freqs) {
		for (const [type, detune] of [
			['sine', -5],
			['triangle', 5],
		] as const) {
			const o = osc(ctx, type, f, t, length);
			o.detune.value = detune;
			o.connect(lp);
		}
	}
}

/** A soft, round "blub" for a linked line: a falling sine through a low-pass. No noise. */
function blub(ctx: BaseAudioContext, out: AudioNode, t: number, level: number) {
	const o = osc(ctx, 'sine', 440, t, 0.18);
	o.frequency.setValueAtTime(420, t);
	o.frequency.exponentialRampToValueAtTime(190, t + 0.14);
	const lp = lowpass(ctx, 1200);
	o.connect(env(ctx, t, level, 0.008, 0.18)).connect(lp).connect(out);
}

/** A breath of air for page turns: filtered noise with a slow swell. */
function breath(ctx: BaseAudioContext, out: AudioNode, t: number, level: number) {
	const len = 0.35;
	const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	const src = ctx.createBufferSource();
	src.buffer = buf;
	const g = ctx.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(level, t + 0.12);
	g.gain.linearRampToValueAtTime(0, t + len);
	src.connect(lowpass(ctx, 800)).connect(g).connect(out);
	src.start(t);
}

// ---------------------------------------------------------------- packs

export interface Pack {
	voice: Voice;
	/** Loudness trim for this instrument. */
	trim: number;
	/** Room size (reverb mix). */
	room: number;
	/** Music: beats per minute and how busy the melody is (0..1). */
	bpm: number;
	busy: number;
}

export const PACKS: Record<string, Pack> = {
	chimes: { voice: bell, trim: 1, room: 0.45, bpm: 60, busy: 0.35 },
	kalimba: { voice: kalimba, trim: 1.1, room: 0.3, bpm: 72, busy: 0.5 },
	felt: { voice: felt, trim: 1.25, room: 0.25, bpm: 56, busy: 0.3 },
};

type Render = (ctx: BaseAudioContext, out: AudioNode, v: Voice) => void;

const SOUNDS: Record<Sfx, { length: number; render: Render }> = {
	pick: { length: 0.6, render: (c, o, v) => v(c, o, 0, note(10), 0.12, 0.5) },
	link: {
		length: 1.6,
		render: (c, o, v) => {
			blub(c, o, 0, 0.14);
			v(c, o, 0.05, note(12), 0.13, 1.1);
			v(c, o, 0.13, note(15), 0.12, 1.3);
		},
	},
	cut: { length: 0.6, render: (c, o, v) => v(c, o, 0, note(4), 0.1, 0.45) },
	clear: { length: 0.6, render: (c, o, v) => v(c, o, 0, note(3), 0.1, 0.5) },
	undo: {
		length: 0.7,
		render: (c, o, v) => {
			v(c, o, 0, note(9), 0.09, 0.4);
			v(c, o, 0.07, note(7), 0.09, 0.5);
		},
	},
	blocked: { length: 0.4, render: (c, o, v) => v(c, o, 0, note(0), 0.12, 0.3) },
	solve: {
		length: 4.5,
		render: (c, o, v) => {
			pad(c, o, 0, [note(0), note(2), note(3), note(5)], 4, 0.06);
			[5, 7, 8, 10, 12, 13, 15].forEach((s, i) => v(c, o, 0.1 + i * 0.13, note(s), 0.13, 1.8));
		},
	},
	hint: {
		length: 1.4,
		render: (c, o, v) => {
			v(c, o, 0, note(13), 0.1, 1);
			v(c, o, 0.14, note(15), 0.1, 1.1);
		},
	},
	ui: { length: 0.25, render: (c, o, v) => v(c, o, 0, note(12), 0.05, 0.18) },
	page: { length: 0.5, render: (c, o) => breath(c, o, 0, 0.05) },
	coin: {
		length: 0.8,
		render: (c, o, v) => {
			v(c, o, 0, note(15), 0.09, 0.5);
			v(c, o, 0.06, note(17), 0.09, 0.6);
		},
	},
	buy: { length: 1.6, render: (c, o, v) => [10, 12, 15, 17].forEach((s, i) => v(c, o, i * 0.07, note(s), 0.11, 1)) },
};

function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
	const len = Math.floor(ctx.sampleRate * seconds);
	const buf = ctx.createBuffer(2, len, ctx.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const d = buf.getChannelData(ch);
		for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
	}
	return buf;
}

async function render(length: number, room: number, draw: (ctx: BaseAudioContext, out: AudioNode) => void): Promise<AudioBuffer> {
	const off = new OfflineAudioContext(2, Math.ceil(RATE * (length + 1)), RATE);
	const bus = off.createGain();
	const verb = off.createConvolver();
	verb.buffer = impulse(off, 1.8);
	const wet = off.createGain();
	wet.gain.value = room;
	// A gentle overall low-pass takes the edge off.
	const tone = lowpass(off, 6000);
	bus.connect(tone).connect(off.destination);
	bus.connect(verb).connect(wet).connect(off.destination);
	draw(off, bus);
	return off.startRendering();
}

// ---------------------------------------------------------------- music

/** Gmaj7, Em7, Cmaj7, Dsus: as MIDI notes, low and close. */
const CHORDS = [
	[43, 47, 50, 54],
	[40, 47, 50, 55],
	[48, 52, 55, 59],
	[50, 55, 57, 62],
].map((c) => c.map(hz));

class Engine {
	ctx: AudioContext | null = null;
	private sfxGain!: GainNode;
	private musicGain!: GainNode;
	private buffers = new Map<string, AudioBuffer>();
	private rendering = new Map<string, Promise<void>>();
	private pack = 'chimes';
	private lastStepAt = 0;
	sfxLevel = 0.8;
	musicLevel = 0.45;
	private musicOn = false;
	private nextBeat = 0;
	private beat = 0;
	private timer = 0;
	private lastStep = 10;

	/** Must run inside a tap or key press (browsers only allow sound after one). */
	unlock() {
		if (!this.ctx) {
			const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (!Ctx) return;
			this.ctx = new Ctx();
			const comp = this.ctx.createDynamicsCompressor();
			comp.threshold.value = -20;
			comp.ratio.value = 2.5;
			comp.connect(this.ctx.destination);
			this.sfxGain = this.ctx.createGain();
			this.musicGain = this.ctx.createGain();
			this.sfxGain.connect(comp);
			this.musicGain.connect(comp);
			this.applyLevels();
			void this.prepare(this.pack);
		}
		if (this.ctx.state === 'suspended') void this.ctx.resume();
		if (this.musicOn) this.startMusic();
	}

	/** Renders every sound of a pack once. */
	private prepare(id: string): Promise<void> {
		const existing = this.rendering.get(id);
		if (existing) return existing;
		const p = PACKS[id] ?? PACKS.chimes;
		const job = (async () => {
			for (const [name, def] of Object.entries(SOUNDS))
				this.buffers.set(`${id}:${name}`, await render(def.length, p.room, (c, o) => def.render(c, o, (cc, oo, t, f, l, len) => p.voice(cc, oo, t, f, l * p.trim, len))));
			for (let s = 8; s < 20; s++) this.buffers.set(`${id}:m${s}`, await render(2, p.room + 0.15, (c, o) => p.voice(c, o, 0, note(s), 0.07 * p.trim, 1.8)));
			for (const [i, chord] of CHORDS.entries()) this.buffers.set(`pad${i}`, await render(8, 0.5, (c, o) => pad(c, o, 0, chord, 8, 0.03)));
		})();
		this.rendering.set(id, job);
		return job;
	}

	setPack(id: string) {
		this.pack = PACKS[id] ? id : 'chimes';
		if (this.ctx) void this.prepare(this.pack);
	}

	/** Plays a short phrase on a pack (for the shop). */
	async preview(id: string) {
		if (!this.ctx) return;
		await this.prepare(id);
		[10, 12, 13, 15].forEach((s, i) => this.playBuffer(`${id}:m${Math.min(19, s)}`, this.ctx!.currentTime + i * 0.16, this.sfxGain, 1.6));
	}

	setLevels(sfx: number, music: number) {
		this.sfxLevel = sfx;
		this.musicLevel = music;
		this.applyLevels();
	}

	private applyLevels() {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.sfxGain.gain.setTargetAtTime(this.sfxLevel * 0.85, t, 0.05);
		this.musicGain.gain.setTargetAtTime(this.musicLevel * 0.5, t, 0.3);
	}

	play(name: Sfx, opts: { delay?: number; gain?: number } = {}) {
		if (!this.ctx || this.sfxLevel <= 0) return;
		this.playBuffer(`${this.pack}:${name}`, this.ctx.currentTime + (opts.delay ?? 0), this.sfxGain, opts.gain ?? 1);
	}

	/**
	 * One step of a line: each line plays its own little tune as it grows.
	 * `color` picks where the tune starts, `length` walks it up the scale.
	 */
	step(color: number, length: number) {
		if (!this.ctx || this.sfxLevel <= 0) return;
		const now = this.ctx.currentTime;
		if (now - this.lastStepAt < 0.045) return;
		this.lastStepAt = now;
		const s = 8 + ((color * 2 + length) % 12);
		this.playBuffer(`${this.pack}:m${s}`, now, this.sfxGain, 0.55);
	}

	/** Lowers the music for a moment (under the solve chord). */
	duck(seconds: number) {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.musicGain.gain.cancelScheduledValues(t);
		this.musicGain.gain.setTargetAtTime(this.musicLevel * 0.12, t, 0.15);
		this.musicGain.gain.setTargetAtTime(this.musicLevel * 0.5, t + seconds, 1.2);
	}

	setMusic(on: boolean) {
		this.musicOn = on;
		if (on) this.startMusic();
		else {
			clearInterval(this.timer);
			this.timer = 0;
		}
	}

	private startMusic() {
		if (!this.ctx || this.timer) return;
		this.nextBeat = this.ctx.currentTime + 0.4;
		this.timer = window.setInterval(() => this.schedule(), 150);
	}

	/** Slow, sparse melody over soft chords. Two bars per chord, in eighths. */
	private schedule() {
		if (!this.ctx || this.musicLevel <= 0) return;
		const p = PACKS[this.pack] ?? PACKS.chimes;
		const eighth = 60 / p.bpm / 2;
		while (this.nextBeat < this.ctx.currentTime + 0.5) {
			const t = this.nextBeat;
			if (this.beat % 16 === 0) this.playBuffer(`pad${Math.floor(this.beat / 16) % 4}`, t, this.musicGain, 1);
			const strong = this.beat % 4 === 0;
			if (Math.random() < (strong ? 0.4 + p.busy * 0.5 : p.busy * 0.35)) {
				this.lastStep = Math.max(8, Math.min(19, this.lastStep + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
				this.playBuffer(`${this.pack}:m${this.lastStep}`, t, this.musicGain, strong ? 1 : 0.6);
			}
			this.beat++;
			this.nextBeat += eighth;
		}
	}

	private playBuffer(name: string, t: number, dest: AudioNode, gain: number) {
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
