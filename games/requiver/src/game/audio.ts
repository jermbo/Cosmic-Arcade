// All sound is made here in code, with Web Audio nodes rendered offline: oscillators, filtered noise,
// envelopes and a small reverb. The results go to KAPLAY's loadSound as WAV files; KAPLAY plays them.
// Sounds stay soft and musical: pentatonic steps, no harsh distortion.

import type { AudioPlay } from 'kaplay';
import { k } from './k.ts';

const SR = 44100;
const MSR = 22050;

// ---------- Building blocks ----------

type Ctx = OfflineAudioContext;

interface Kit {
	c: Ctx;
	/** The dry bus. */
	dry: AudioNode;
	/** The reverb send. */
	wet: AudioNode;
	noise: AudioBuffer;
}

function makeNoise(c: Ctx): AudioBuffer {
	const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
	const d = b.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	return b;
}

function makeImpulse(c: Ctx, seconds: number): AudioBuffer {
	const b = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
	const d = b.getChannelData(0);
	for (let i = 0; i < d.length; i++) {
		const t = i / d.length;
		d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3) * (t < 0.01 ? t / 0.01 : 1);
	}
	return b;
}

/** A gain with an attack, an optional hold, then an exponential decay. */
function envGain(kit: Kit, t: number, peak: number, attack: number, decay: number, dest: AudioNode, hold = 0): GainNode {
	const g = kit.c.createGain();
	g.gain.setValueAtTime(0.0001, t);
	g.gain.linearRampToValueAtTime(peak, t + attack);
	if (hold > 0) g.gain.setValueAtTime(peak, t + attack + hold);
	g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
	g.connect(dest);
	return g;
}

/** A node that feeds the dry bus and, by `wet`, the reverb. */
function mixTo(kit: Kit, wet: number): AudioNode {
	if (wet <= 0) return kit.dry;
	const g = kit.c.createGain();
	g.connect(kit.dry);
	const send = kit.c.createGain();
	send.gain.value = wet;
	g.connect(send);
	send.connect(kit.wet);
	return g;
}

interface ToneOpt {
	type?: OscillatorType;
	to?: number;
	glide?: number;
	attack?: number;
	hold?: number;
	detune?: number;
	lp?: number;
	wet?: number;
}

/** One oscillator note. */
function tone(kit: Kit, t: number, freq: number, decay: number, gain: number, o: ToneOpt = {}) {
	const osc = kit.c.createOscillator();
	osc.type = o.type ?? 'sine';
	osc.frequency.setValueAtTime(freq, t);
	if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? decay));
	if (o.detune) osc.detune.value = o.detune;
	let node: AudioNode = envGain(kit, t, gain, o.attack ?? 0.003, decay, mixTo(kit, o.wet ?? 0), o.hold ?? 0);
	if (o.lp) {
		const f = kit.c.createBiquadFilter();
		f.type = 'lowpass';
		f.frequency.value = o.lp;
		f.connect(node);
		node = f;
	}
	osc.connect(node);
	osc.start(t);
	osc.stop(t + (o.attack ?? 0.003) + (o.hold ?? 0) + decay + 0.05);
}

interface NoiseOpt {
	type?: BiquadFilterType;
	freq: number;
	to?: number;
	q?: number;
	attack?: number;
	wet?: number;
}

/** A burst of filtered noise. */
function hiss(kit: Kit, t: number, decay: number, gain: number, o: NoiseOpt) {
	const src = kit.c.createBufferSource();
	src.buffer = kit.noise;
	const f = kit.c.createBiquadFilter();
	f.type = o.type ?? 'bandpass';
	f.frequency.setValueAtTime(o.freq, t);
	if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + decay);
	f.Q.value = o.q ?? 1;
	src.connect(f);
	f.connect(envGain(kit, t, gain, o.attack ?? 0.002, decay, mixTo(kit, o.wet ?? 0)));
	src.start(t, Math.random());
	src.stop(t + (o.attack ?? 0.002) + decay + 0.05);
}

/** Renders a sound offline. `build` schedules notes on the kit. */
async function render(seconds: number, rate: number, build: (kit: Kit) => void, room = 1.4): Promise<Float32Array> {
	const c = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
	const comp = c.createDynamicsCompressor();
	comp.threshold.value = -14;
	comp.ratio.value = 3;
	comp.connect(c.destination);
	const dry = c.createGain();
	dry.connect(comp);
	const verb = c.createConvolver();
	verb.buffer = makeImpulse(c, room);
	const wetGain = c.createGain();
	wetGain.gain.value = 0.6;
	verb.connect(wetGain);
	wetGain.connect(comp);
	build({ c, dry, wet: verb, noise: makeNoise(c) });
	const out = await c.startRendering();
	return out.getChannelData(0);
}

function normalize(d: Float32Array, peak: number) {
	let max = 0;
	for (const v of d) max = Math.max(max, Math.abs(v));
	if (max > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / max;
	return d;
}

/** Packs samples into a 16-bit WAV file, which KAPLAY decodes like any loaded sound. */
function wav(data: Float32Array, rate: number): ArrayBuffer {
	const bytes = 44 + data.length * 2;
	const buf = new ArrayBuffer(bytes);
	const v = new DataView(buf);
	const text = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
	text(0, 'RIFF');
	v.setUint32(4, bytes - 8, true);
	text(8, 'WAVE');
	text(12, 'fmt ');
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true);
	v.setUint16(22, 1, true);
	v.setUint32(24, rate, true);
	v.setUint32(28, rate * 2, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	text(36, 'data');
	v.setUint32(40, data.length * 2, true);
	for (let i = 0; i < data.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true);
	return buf;
}

// ---------- Sound effects ----------
// Each entry: length in seconds, loudness (peak after normalizing), and the notes.

/** A note n semitones from middle C. */
const NOTE = (n: number) => 261.63 * Math.pow(2, n / 12);

const SFX: Record<string, [number, number, (kit: Kit) => void]> = {
	// The bow lets go: a short string, a soft slap of air, a wood knock.
	twang: [
		0.5,
		0.75,
		(kt) => {
			tone(kt, 0, 220, 0.22, 0.5, { type: 'triangle', to: 196, glide: 0.05, lp: 2400, wet: 0.12 });
			tone(kt, 0, 440, 0.08, 0.12);
			hiss(kt, 0, 0.08, 0.35, { freq: 2600, to: 900, q: 1.6 });
			tone(kt, 0, 130, 0.07, 0.35, { to: 80 });
		},
	],
	whoosh: [0.4, 0.45, (kt) => hiss(kt, 0, 0.3, 0.6, { freq: 1500, to: 450, q: 1.2, attack: 0.03, wet: 0.08 })],
	// A body hit: a soft punch.
	thunk: [
		0.3,
		0.8,
		(kt) => {
			tone(kt, 0, 150, 0.14, 0.9, { to: 62 });
			hiss(kt, 0, 0.06, 0.35, { type: 'lowpass', freq: 900 });
			hiss(kt, 0.004, 0.08, 0.2, { freq: 600, q: 1, wet: 0.06 });
		},
	],
	// A head shot: a bright wooden "tok" and a small sparkle.
	crack: [
		0.6,
		0.85,
		(kt) => {
			tone(kt, 0, 1050, 0.07, 0.5, { attack: 0.001 });
			tone(kt, 0, 1575, 0.05, 0.22, { attack: 0.001 });
			tone(kt, 0, 320, 0.09, 0.55, { to: 120 });
			tone(kt, 0.03, NOTE(28), 0.35, 0.1, { type: 'triangle', wet: 0.3 });
		},
	],
	clank: [
		0.7,
		0.6,
		(kt) => {
			[740, 1112, 1716, 2470].forEach((f, i) => tone(kt, 0, f, 0.4 - i * 0.07, 0.3 - i * 0.05, { attack: 0.001, wet: 0.25 }));
			hiss(kt, 0, 0.02, 0.25, { type: 'highpass', freq: 4000 });
		},
	],
	knock: [
		0.3,
		0.6,
		(kt) => {
			tone(kt, 0, 220, 0.09, 0.5, { attack: 0.001 });
			tone(kt, 0, 340, 0.07, 0.3, { attack: 0.001 });
			hiss(kt, 0, 0.05, 0.25, { freq: 800, q: 3, wet: 0.1 });
		},
	],
	thud: [
		0.15,
		0.45,
		(kt) => {
			hiss(kt, 0, 0.07, 0.6, { type: 'lowpass', freq: 350 });
			tone(kt, 0, 90, 0.06, 0.3, { to: 60 });
		},
	],
	poof: [
		0.4,
		0.45,
		(kt) => {
			hiss(kt, 0, 0.25, 0.6, { type: 'lowpass', freq: 1800, to: 220, attack: 0.008, wet: 0.15 });
			tone(kt, 0, 220, 0.15, 0.2, { to: 110 });
		},
	],
	boom: [
		1.2,
		0.9,
		(kt) => {
			hiss(kt, 0, 0.75, 1, { type: 'lowpass', freq: 2000, to: 120, attack: 0.004, wet: 0.25 });
			tone(kt, 0, 72, 0.55, 0.9, { to: 34 });
		},
	],
	chime: [
		0.8,
		0.45,
		(kt) => {
			tone(kt, 0, NOTE(21), 0.45, 0.25, { type: 'triangle', wet: 0.3 });
			tone(kt, 0.03, NOTE(28), 0.4, 0.18, { type: 'triangle', wet: 0.3 });
		},
	],
	tink: [
		0.5,
		0.6,
		(kt) => {
			tone(kt, 0, NOTE(31), 0.14, 0.35, { type: 'triangle', attack: 0.001, wet: 0.15 });
			hiss(kt, 0, 0.04, 0.3, { freq: 3000, q: 2 });
			tone(kt, 0, 520, 0.06, 0.3, { to: 300 });
		},
	],
	hurt: [
		0.5,
		0.85,
		(kt) => {
			tone(kt, 0, 130, 0.25, 0.9, { to: 58 });
			hiss(kt, 0, 0.18, 0.5, { type: 'lowpass', freq: 600 });
			hiss(kt, 0.01, 0.12, 0.35, { freq: 420, q: 4, wet: 0.1 });
		},
	],
	block: [0.9, 0.5, (kt) => [0, 7, 12].forEach((n, i) => tone(kt, i * 0.025, NOTE(24 + n), 0.45, 0.2, { type: 'triangle', wet: 0.35 }))],
	// The combo tick: a soft marimba note on C5. Raised in pentatonic steps when played.
	note: [
		0.6,
		0.5,
		(kt) => {
			tone(kt, 0, NOTE(12), 0.35, 0.5, { wet: 0.2 });
			tone(kt, 0, NOTE(12) * 4, 0.05, 0.12);
			tone(kt, 0, NOTE(12) * 10, 0.012, 0.05);
		},
	],
	fanfare: [
		1.4,
		0.7,
		(kt) => {
			[12, 16, 19, 24].forEach((n, i) => tone(kt, i * 0.065, NOTE(n), 0.55, 0.25, { type: 'triangle', wet: 0.3 }));
			[12, 19].forEach((n) => tone(kt, 0.26, NOTE(n), 0.6, 0.08, { type: 'sawtooth', lp: 1400, attack: 0.05, wet: 0.3 }));
		},
	],
	bonus: [
		1.4,
		0.7,
		(kt) => {
			hiss(kt, 0, 0.5, 0.45, { freq: 300, to: 3000, q: 1.2, attack: 0.2, wet: 0.2 });
			[7, 12, 16].forEach((n) => tone(kt, 0.1, NOTE(n), 0.8, 0.15, { type: 'triangle', attack: 0.05, wet: 0.35 }));
		},
	],
	zap: [
		1.2,
		0.7,
		(kt) => {
			tone(kt, 0, 600, 0.2, 0.35, { to: 2400, glide: 0.18 });
			tone(kt, 0.12, NOTE(33), 0.6, 0.18, { type: 'triangle', wet: 0.4 });
			tone(kt, 0.12, NOTE(28), 0.6, 0.15, { type: 'triangle', wet: 0.4 });
			hiss(kt, 0, 0.35, 0.2, { type: 'highpass', freq: 3000, wet: 0.2 });
		},
	],
	whistle: [0.6, 0.35, (kt) => tone(kt, 0, 1600, 0.4, 0.25, { to: 650, attack: 0.05, wet: 0.2 })],
	growl: [
		1.4,
		0.6,
		(kt) => {
			tone(kt, 0, 55, 0.6, 0.35, { type: 'sawtooth', lp: 420, attack: 0.3, hold: 0.3, wet: 0.2 });
			tone(kt, 0, 55, 0.6, 0.35, { type: 'sawtooth', lp: 420, attack: 0.3, hold: 0.3, detune: 18, wet: 0.2 });
			hiss(kt, 0, 0.8, 0.12, { freq: 250, q: 2, attack: 0.3 });
		},
	],
	roar: [
		2,
		0.8,
		(kt) => {
			hiss(kt, 0, 1.2, 0.6, { freq: 320, to: 180, q: 1.4, attack: 0.12, wet: 0.3 });
			tone(kt, 0, 66, 1.1, 0.4, { type: 'sawtooth', to: 44, lp: 600, attack: 0.1, wet: 0.3 });
		},
	],
	horn: [
		1.6,
		0.5,
		(kt) => {
			tone(kt, 0, 110, 0.5, 0.3, { type: 'sawtooth', lp: 700, attack: 0.15, hold: 0.45, wet: 0.35 });
			tone(kt, 0, 165, 0.5, 0.22, { type: 'sawtooth', lp: 700, attack: 0.15, hold: 0.45, wet: 0.35 });
		},
	],
	click: [
		0.08,
		0.35,
		(kt) => {
			tone(kt, 0, 880, 0.03, 0.3, { attack: 0.001 });
			tone(kt, 0, 1760, 0.02, 0.1, { attack: 0.001 });
		},
	],
	coin: [
		0.6,
		0.5,
		(kt) => {
			tone(kt, 0, NOTE(28), 0.15, 0.3, { type: 'triangle', wet: 0.2 });
			tone(kt, 0.07, NOTE(33), 0.35, 0.3, { type: 'triangle', wet: 0.2 });
		},
	],
	heal: [1, 0.5, (kt) => [12, 16, 19, 24].forEach((n, i) => tone(kt, i * 0.07, NOTE(n), 0.45, 0.2, { type: 'triangle', attack: 0.01, wet: 0.35 }))],
	step: [0.1, 0.35, (kt) => hiss(kt, 0, 0.06, 0.5, { type: 'lowpass', freq: 500 })],
	win: [
		2.2,
		0.7,
		(kt) => {
			[7, 9, 12, 14, 19].forEach((n, i) => tone(kt, i * 0.1, NOTE(n), 0.6, 0.22, { type: 'triangle', wet: 0.35 }));
			[7, 11, 14].forEach((n) => tone(kt, 0.55, NOTE(n), 1, 0.1, { type: 'triangle', attack: 0.08, wet: 0.4 }));
		},
	],
	lose: [
		2.6,
		0.6,
		(kt) => {
			[9, 7, 4, 2].forEach((n, i) => tone(kt, i * 0.28, NOTE(n), 0.7, 0.22, { lp: 1500, wet: 0.4 }));
			tone(kt, 1.1, NOTE(-15), 1.2, 0.3, { type: 'triangle', attack: 0.1, wet: 0.4 });
		},
	],
	split: [
		0.12,
		0.35,
		(kt) => {
			hiss(kt, 0, 0.06, 0.4, { freq: 3000, q: 2 });
			tone(kt, 0, 1200, 0.06, 0.15, { to: 1800, type: 'triangle' });
		},
	],
	bounce: [0.2, 0.4, (kt) => tone(kt, 0, 300, 0.12, 0.4, { to: 520, glide: 0.08 })],
};

/** Sounds that are in tune: never detuned at random. */
const MUSICAL = new Set(['note', 'fanfare', 'heal', 'coin', 'win', 'lose', 'chime', 'block', 'bonus', 'zap']);

// ---------- Music ----------

interface Score {
	bpm: number;
	/** Root note, in semitones from middle C. */
	root: number;
	scale: number[];
	chords: number[];
	seed: number;
}

const SCORES: Score[] = [
	{ bpm: 84, root: 2, scale: [0, 3, 5, 7, 10], chords: [0, -4, 3, -2], seed: 3 },
	{ bpm: 78, root: 4, scale: [0, 2, 3, 7, 9], chords: [0, 5, -4, -2], seed: 11 },
	{ bpm: 70, root: -3, scale: [0, 3, 5, 7, 10], chords: [0, -4, -5, -2], seed: 29 },
];

function composeMusic(kt: Kit, act: number, battle: boolean, length: number) {
	const sc = SCORES[act] ?? SCORES[0];
	const beat = 60 / sc.bpm;
	let seed = sc.seed + (battle ? 100 : 0);
	const rnd = () => {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};
	// A two-bar motif of eighth notes, varied in the second half.
	const motif: (number | null)[] = [];
	for (let i = 0; i < 16; i++) motif.push(rnd() < (battle ? 0.55 : 0.38) ? Math.floor(rnd() * 8) : null);
	// An echo for the melody.
	const delay = kt.c.createDelay(2);
	delay.delayTime.value = beat * 0.75;
	const feedback = kt.c.createGain();
	feedback.gain.value = 0.28;
	delay.connect(feedback);
	feedback.connect(delay);
	const echo = kt.c.createGain();
	echo.gain.value = 0.35;
	delay.connect(echo);
	echo.connect(kt.dry);
	const melody = kt.c.createGain();
	melody.connect(mixTo(kt, 0.35));
	melody.connect(delay);

	for (let bar = 0; bar < 8; bar++) {
		const t0 = bar * 4 * beat;
		if (t0 >= length) break;
		const root = sc.root + sc.chords[bar % sc.chords.length];
		// Pad: warm detuned saws, low passed, slow in and out.
		for (const iv of [0, 3, 7, 12]) {
			for (const d of [-7, 7]) tone(kt, t0, NOTE(root + iv - 12), 1.2, 0.035, { type: 'sawtooth', lp: 750, attack: 0.9, hold: 4 * beat - 1.2, detune: d, wet: 0.45 });
		}
		// Bass on beats 1 and 3.
		tone(kt, t0, NOTE(root - 24), 0.9, 0.32, { type: 'triangle', lp: 500 });
		tone(kt, t0 + 2 * beat, NOTE(root - 24), 0.7, 0.24, { type: 'triangle', lp: 500 });
		// Melody: soft plucks from the scale.
		for (let i = 0; i < 8; i++) {
			const step = motif[(bar % 2) * 8 + i];
			if (step === null) continue;
			const varied = bar >= 4 && rnd() < 0.3 ? step + 2 : step;
			const deg = varied % sc.scale.length;
			const oct = Math.floor(varied / sc.scale.length);
			const t = t0 + (i * beat) / 2;
			const osc = kt.c.createOscillator();
			osc.type = 'triangle';
			osc.frequency.value = NOTE(sc.root + 12 + sc.scale[deg] + 12 * oct);
			const lp = kt.c.createBiquadFilter();
			lp.type = 'lowpass';
			lp.frequency.value = 2600;
			osc.connect(lp);
			lp.connect(envGain(kt, t, 0.13, 0.006, beat * 0.9, melody));
			osc.start(t);
			osc.stop(t + beat + 0.1);
		}
		if (battle) {
			// A soft frame drum and a quiet shaker.
			for (const b of [0, 1.5, 2, 3.5]) tone(kt, t0 + b * beat, 110, 0.28, b === 0 || b === 2 ? 0.5 : 0.3, { to: 46, glide: 0.12 });
			for (let i = 0; i < 8; i++) hiss(kt, t0 + (i * beat) / 2, 0.04, i % 2 ? 0.035 : 0.06, { type: 'highpass', freq: 7000 });
			if (bar % 4 === 3) for (let i = 0; i < 3; i++) tone(kt, t0 + (3 + i / 3) * beat, 180, 0.18, 0.25, { to: 100 });
		}
	}
}

async function renderMusic(act: number, battle: boolean): Promise<Float32Array> {
	const sc = SCORES[act] ?? SCORES[0];
	const length = (8 * 4 * 60) / sc.bpm;
	const tail = 2.5;
	const raw = await render(length + tail, MSR, (kt) => composeMusic(kt, act, battle, length), 2.2);
	// Fold the reverb tail back onto the start, so the loop is seamless.
	const n = Math.floor(length * MSR);
	const out = raw.slice(0, n);
	for (let i = n; i < raw.length; i++) out[i - n] += raw[i];
	return normalize(out, 0.7);
}

// ---------- Playing ----------

let sfxVolume = 0.8;
let musicVolume = 0.5;
const loaded = new Set<string>();
let current: { key: string; play: AudioPlay } | null = null;

/** Makes every sound and all six music loops. Pass it to k.load(): KAPLAY waits before the first scene. */
export async function loadAudio(): Promise<void> {
	const jobs: Promise<void>[] = [];
	for (const [name, [seconds, peak, build]] of Object.entries(SFX)) {
		jobs.push(
			render(seconds, SR, build).then((d) => {
				k.loadSound(name, wav(normalize(d, peak), SR));
				loaded.add(name);
			}),
		);
	}
	for (let act = 0; act < SCORES.length; act++) {
		for (const battle of [false, true]) {
			const key = `music-${act}-${battle ? 'b' : 'm'}`;
			jobs.push(
				renderMusic(act, battle).then((d) => {
					k.loadSound(key, wav(d, MSR));
					loaded.add(key);
				}),
			);
		}
	}
	// A failed sound never blocks the game.
	await Promise.all(jobs.map((j) => j.catch(() => {})));
}

export function setVolumes(sfx: number, music: number) {
	sfxVolume = sfx;
	musicVolume = music;
	if (current) current.play.volume = musicVolume * 0.5;
}

/** Volume fades on a timer, so a scene change cannot cut them off. */
function fade(play: AudioPlay, to: number, seconds: number, done?: () => void) {
	const from = play.volume;
	const start = performance.now();
	const id = setInterval(() => {
		const t = Math.min(1, (performance.now() - start) / (seconds * 1000));
		play.volume = from + (to - from) * t;
		if (t >= 1) {
			clearInterval(id);
			done?.();
		}
	}, 30);
}

/** Pentatonic steps in cents, for rising combo notes. */
const PENTA = [0, 200, 400, 700, 900, 1200, 1400, 1600, 1900, 2100, 2400];
export const pentatonic = (step: number) => PENTA[Math.max(0, Math.min(PENTA.length - 1, Math.round(step)))];

const lastPlayed = new Map<string, number>();

/** Plays a sound effect. Repeats of the same sound within a few ms are merged. */
export function sfx(name: string, opt: { volume?: number; detune?: number; speed?: number } = {}) {
	if (!loaded.has(name) || sfxVolume <= 0) return;
	const now = performance.now();
	if (now - (lastPlayed.get(name) ?? 0) < 35) return;
	lastPlayed.set(name, now);
	const wobble = MUSICAL.has(name) ? 0 : (Math.random() - 0.5) * 80;
	try {
		k.play(name, { volume: (opt.volume ?? 1) * sfxVolume * 0.8, detune: (opt.detune ?? 0) + wobble, speed: opt.speed ?? 1 });
	} catch {
		// Audio not ready yet.
	}
}

/** Starts the loop for an act (map or battle). */
export function music(act: number, battle: boolean) {
	const key = `music-${act}-${battle ? 'b' : 'm'}`;
	if (current?.key === key || !loaded.has(key)) return;
	const old = current;
	if (old) fade(old.play, 0, 0.8, () => old.play.stop());
	try {
		const play = k.play(key, { loop: true, volume: 0 });
		current = { key, play };
		fade(play, musicVolume * 0.5, 1.5);
	} catch {
		current = null;
	}
}

export function stopMusic() {
	if (!current) return;
	const p = current.play;
	current = null;
	fade(p, 0, 0.8, () => p.stop());
}

/** Browsers start audio only after a tap or key. */
export function unlockAudio() {
	const resume = () => {
		if (k.audioCtx.state !== 'running') k.audioCtx.resume().catch(() => {});
	};
	window.addEventListener('pointerdown', resume, { passive: true });
	window.addEventListener('keydown', resume);
}
