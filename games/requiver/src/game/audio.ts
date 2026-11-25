// All sound is made here in code: plucked strings, thunks, clanks and a small generative score per act.
// The buffers go to KAPLAY's loadSound; KAPLAY plays them.

import type { AudioPlay } from 'kaplay';
import { k } from './k.ts';

const SR = 44100;
const MSR = 22050;
const TAU = Math.PI * 2;

// ---------- Tiny synth helpers ----------

const rand = () => Math.random() * 2 - 1;

function make(seconds: number, rate = SR) {
	return new Float32Array(Math.max(1, Math.floor(seconds * rate)));
}

/** Adds a plucked string (Karplus-Strong) into `out` at `start` seconds. */
function pluck(out: Float32Array, rate: number, start: number, freq: number, dur: number, amp: number, damp = 0.996, bright = 0.5) {
	const n = Math.max(2, Math.floor(rate / freq));
	const ring = new Float32Array(n);
	for (let i = 0; i < n; i++) ring[i] = rand() * (1 - bright) + (i < n / 2 ? 1 : -1) * bright;
	const s0 = Math.floor(start * rate);
	const len = Math.floor(dur * rate);
	let idx = 0;
	for (let i = 0; i < len && s0 + i < out.length; i++) {
		const next = (idx + 1) % n;
		const v = ring[idx];
		ring[idx] = (v + ring[next]) * 0.5 * damp;
		idx = next;
		const fade = i > len - 400 ? (len - i) / 400 : 1;
		out[s0 + i] += v * amp * fade;
	}
}

/** Adds a sine with a pitch slide and an exponential decay. */
function tone(out: Float32Array, rate: number, start: number, f0: number, f1: number, dur: number, amp: number, attack = 0.002, wave: 'sine' | 'saw' | 'tri' = 'sine') {
	const s0 = Math.floor(start * rate);
	const len = Math.floor(dur * rate);
	let ph = 0;
	for (let i = 0; i < len && s0 + i < out.length; i++) {
		const t = i / len;
		const f = f0 * Math.pow(f1 / f0, t);
		ph += f / rate;
		let w: number;
		if (wave === 'saw') w = 2 * (ph % 1) - 1;
		else if (wave === 'tri') w = 1 - 4 * Math.abs((ph % 1) - 0.5);
		else w = Math.sin(TAU * ph);
		const env = Math.min(1, i / (attack * rate + 1)) * Math.exp(-t * 5);
		out[s0 + i] += w * amp * env;
	}
}

/** Adds filtered noise. `lo`/`hi` are one-pole cutoffs in Hz (lo: low pass, hi: high pass). */
function noise(out: Float32Array, rate: number, start: number, dur: number, amp: number, lo: number, hi: number, decay = 6, lo2?: number) {
	const s0 = Math.floor(start * rate);
	const len = Math.floor(dur * rate);
	let lp = 0;
	let hp = 0;
	let prev = 0;
	for (let i = 0; i < len && s0 + i < out.length; i++) {
		const t = i / len;
		const cut = lo2 ? lo * Math.pow(lo2 / lo, t) : lo;
		const a = 1 - Math.exp((-TAU * cut) / rate);
		lp += (rand() - lp) * a;
		const b = Math.exp((-TAU * hi) / rate);
		hp = b * (hp + lp - prev);
		prev = lp;
		const env = Math.min(1, i / 40) * Math.exp(-t * decay);
		out[s0 + i] += hp * amp * env;
	}
}

/** Bell or metal: several decaying partials. */
function partials(out: Float32Array, rate: number, start: number, freqs: number[], dur: number, amp: number, decay = 6) {
	freqs.forEach((f, i) => {
		const s0 = Math.floor(start * rate);
		const len = Math.floor(dur * rate);
		const a = amp / (1 + i * 0.7);
		for (let j = 0; j < len && s0 + j < out.length; j++) {
			const t = j / len;
			out[s0 + j] += Math.sin((TAU * f * j) / rate) * a * Math.exp(-t * decay * (1 + i * 0.3)) * Math.min(1, j / 30);
		}
	});
}

function normalize(out: Float32Array, peak = 0.9) {
	let max = 0;
	for (const v of out) max = Math.max(max, Math.abs(v));
	if (max > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / max;
	return out;
}

/** Packs samples into a 16-bit WAV file, which KAPLAY decodes like any loaded sound. */
function toBuffer(data: Float32Array, rate = SR): ArrayBuffer {
	const bytes = 44 + data.length * 2;
	const buf = new ArrayBuffer(bytes);
	const v = new DataView(buf);
	const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
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

const SFX: Record<string, () => Float32Array> = {
	twang: () => {
		const o = make(0.7);
		pluck(o, SR, 0, 98, 0.7, 0.9, 0.994, 0.8);
		pluck(o, SR, 0, 196.5, 0.3, 0.3, 0.99, 0.9);
		noise(o, SR, 0, 0.03, 0.8, 8000, 1500, 20);
		return normalize(o);
	},
	whoosh: () => {
		const o = make(0.35);
		noise(o, SR, 0, 0.35, 1, 600, 300, 4, 3000);
		return normalize(o, 0.6);
	},
	creak: () => {
		const o = make(0.55);
		let ph = 0;
		for (let i = 0; i < o.length; i++) {
			const t = i / o.length;
			ph += (38 + t * 40) / SR;
			const pulse = (ph % 1) < 0.08 ? 1 : 0;
			o[i] = pulse * (0.6 + rand() * 0.4) * Math.min(1, t * 6) * (1 - t * 0.4);
		}
		let lp = 0;
		for (let i = 0; i < o.length; i++) {
			lp += (o[i] - lp) * 0.25;
			o[i] = lp;
		}
		return normalize(o, 0.5);
	},
	thunk: () => {
		const o = make(0.2);
		tone(o, SR, 0, 150, 55, 0.18, 1);
		noise(o, SR, 0, 0.06, 0.7, 2500, 200, 10);
		return normalize(o);
	},
	crack: () => {
		const o = make(0.25);
		noise(o, SR, 0, 0.012, 1, 12000, 2000, 2);
		tone(o, SR, 0, 2100, 1700, 0.12, 0.6);
		tone(o, SR, 0, 960, 820, 0.2, 0.4);
		tone(o, SR, 0.005, 160, 70, 0.12, 0.6);
		return normalize(o);
	},
	clank: () => {
		const o = make(0.55);
		partials(o, SR, 0, [523, 1307, 2096, 2911, 3712], 0.55, 0.6, 5);
		noise(o, SR, 0, 0.02, 0.8, 9000, 3000, 8);
		return normalize(o);
	},
	knock: () => {
		const o = make(0.18);
		partials(o, SR, 0, [190, 420, 655], 0.18, 0.8, 9);
		noise(o, SR, 0, 0.03, 0.6, 3000, 400, 10);
		return normalize(o);
	},
	thud: () => {
		const o = make(0.12);
		noise(o, SR, 0, 0.1, 1, 900, 80, 8);
		tone(o, SR, 0, 110, 60, 0.08, 0.6);
		return normalize(o, 0.6);
	},
	poof: () => {
		const o = make(0.3);
		noise(o, SR, 0, 0.3, 1, 2600, 200, 5, 300);
		return normalize(o, 0.6);
	},
	boom: () => {
		const o = make(0.9);
		noise(o, SR, 0, 0.9, 1, 3200, 30, 5, 160);
		tone(o, SR, 0, 70, 32, 0.6, 1);
		return normalize(o);
	},
	crackle: () => {
		const o = make(0.4);
		for (let i = 0; i < 18; i++) noise(o, SR, Math.random() * 0.35, 0.01, 0.5 + Math.random() * 0.5, 7000, 1500, 3);
		return normalize(o, 0.5);
	},
	chime: () => {
		const o = make(0.5);
		partials(o, SR, 0, [2093, 3136, 4186], 0.5, 0.6, 6);
		return normalize(o, 0.5);
	},
	tink: () => {
		const o = make(0.25);
		tone(o, SR, 0, 2600, 2400, 0.12, 0.6);
		noise(o, SR, 0, 0.08, 0.7, 5000, 900, 10);
		return normalize(o);
	},
	hurt: () => {
		const o = make(0.35);
		tone(o, SR, 0, 140, 50, 0.3, 1);
		noise(o, SR, 0, 0.2, 0.9, 1800, 100, 6);
		for (let i = 0; i < o.length; i++) o[i] = Math.tanh(o[i] * 2.5);
		return normalize(o);
	},
	block: () => {
		const o = make(0.5);
		partials(o, SR, 0, [1568, 2349, 3136, 4699], 0.5, 0.6, 4);
		return normalize(o, 0.6);
	},
	note: () => {
		const o = make(0.4);
		tone(o, SR, 0, 523, 523, 0.4, 0.8);
		tone(o, SR, 0, 2092, 2092, 0.08, 0.25);
		return normalize(o, 0.6);
	},
	fanfare: () => {
		const o = make(1.1);
		[523, 659, 784, 1046].forEach((f, i) => {
			pluck(o, SR, i * 0.07, f, 0.9, 0.5, 0.997, 0.6);
			tone(o, SR, i * 0.07, f, f, 0.6, 0.2);
		});
		return normalize(o, 0.8);
	},
	bonus: () => {
		const o = make(1.1);
		noise(o, SR, 0, 0.6, 0.8, 800, 200, 3, 5000);
		[392, 523, 659, 784].forEach((f) => tone(o, SR, 0.05, f, f * 1.01, 1, 0.25, 0.02, 'tri'));
		return normalize(o, 0.85);
	},
	zap: () => {
		const o = make(0.7);
		tone(o, SR, 0, 300, 2600, 0.25, 0.7, 0.001, 'saw');
		partials(o, SR, 0.1, [1760, 2637, 3520], 0.6, 0.4, 5);
		noise(o, SR, 0, 0.4, 0.5, 9000, 2000, 4);
		return normalize(o, 0.8);
	},
	whistle: () => {
		const o = make(0.4);
		tone(o, SR, 0, 2200, 700, 0.4, 0.4);
		noise(o, SR, 0, 0.4, 0.3, 4000, 1500, 3);
		return normalize(o, 0.4);
	},
	growl: () => {
		const o = make(1.2);
		const len = o.length;
		let ph1 = 0;
		let ph2 = 0;
		let lp = 0;
		for (let i = 0; i < len; i++) {
			const t = i / len;
			ph1 += 55 / SR;
			ph2 += 83 / SR;
			const w = (2 * (ph1 % 1) - 1 + 2 * (ph2 % 1) - 1) * 0.5;
			const trem = 0.6 + 0.4 * Math.sin(TAU * 9 * (i / SR));
			lp += (w - lp) * 0.06;
			o[i] = lp * trem * Math.sin(Math.PI * t) * 1.2;
		}
		noise(o, SR, 0, 1.2, 0.25, 500, 60, 1);
		return normalize(o, 0.8);
	},
	roar: () => {
		const o = make(1.8);
		noise(o, SR, 0, 1.8, 1, 1200, 40, 2.5, 200);
		tone(o, SR, 0, 60, 30, 1.6, 0.9, 0.1, 'saw');
		return normalize(o);
	},
	horn: () => {
		const o = make(1.3);
		const len = o.length;
		let lp = 0;
		let a = 0;
		let b = 0;
		for (let i = 0; i < len; i++) {
			const t = i / len;
			a += 110 / SR;
			b += 165 / SR;
			const w = 2 * (a % 1) - 1 + (2 * (b % 1) - 1) * 0.7;
			lp += (w - lp) * 0.08;
			const env = Math.min(1, t * 7) * Math.min(1, (1 - t) * 3);
			o[i] = lp * env;
		}
		return normalize(o, 0.6);
	},
	click: () => {
		const o = make(0.05);
		tone(o, SR, 0, 1400, 1100, 0.04, 0.8);
		noise(o, SR, 0, 0.005, 0.6, 9000, 2000, 2);
		return normalize(o, 0.5);
	},
	coin: () => {
		const o = make(0.35);
		tone(o, SR, 0, 1318, 1318, 0.12, 0.6);
		tone(o, SR, 0.07, 1760, 1760, 0.28, 0.6);
		return normalize(o, 0.6);
	},
	heal: () => {
		const o = make(0.7);
		[523, 659, 784, 1046].forEach((f, i) => tone(o, SR, i * 0.08, f, f, 0.4, 0.4, 0.01));
		return normalize(o, 0.6);
	},
	step: () => {
		const o = make(0.12);
		noise(o, SR, 0, 0.1, 1, 600, 60, 9);
		return normalize(o, 0.5);
	},
	win: () => {
		const o = make(1.6);
		[392, 440, 523, 587, 784].forEach((f, i) => pluck(o, SR, i * 0.11, f, 1.2, 0.6, 0.997, 0.5));
		[392, 494, 587].forEach((f) => tone(o, SR, 0.6, f, f, 1, 0.2, 0.05, 'tri'));
		return normalize(o, 0.8);
	},
	lose: () => {
		const o = make(1.8);
		[440, 392, 349, 294].forEach((f, i) => pluck(o, SR, i * 0.22, f / 2, 1.2, 0.7, 0.996, 0.3));
		tone(o, SR, 0.9, 73, 70, 0.9, 0.4, 0.1, 'tri');
		return normalize(o, 0.8);
	},
	split: () => {
		const o = make(0.12);
		noise(o, SR, 0, 0.12, 1, 9000, 2500, 8);
		tone(o, SR, 0, 900, 1600, 0.1, 0.3);
		return normalize(o, 0.5);
	},
	bounce: () => {
		const o = make(0.15);
		tone(o, SR, 0, 280, 520, 0.14, 0.7);
		noise(o, SR, 0, 0.04, 0.5, 2000, 200, 10);
		return normalize(o, 0.5);
	},
};

// ---------- Music ----------

interface Score {
	bpm: number;
	root: number;
	scale: number[];
	chords: number[];
	seed: number;
}

const SCORES: Score[] = [
	{ bpm: 84, root: 146.83, scale: [0, 3, 5, 7, 10], chords: [0, -4, 3, -2], seed: 3 },
	{ bpm: 78, root: 164.81, scale: [0, 2, 3, 7, 9], chords: [0, 5, -4, -2], seed: 11 },
	{ bpm: 72, root: 110, scale: [0, 1, 5, 7, 8], chords: [0, 1, -4, -5], seed: 29 },
];

const semi = (f: number, n: number) => f * Math.pow(2, n / 12);

function renderMusic(act: number, battle: boolean): Float32Array {
	const sc = SCORES[act] ?? SCORES[0];
	const beat = 60 / sc.bpm;
	const bars = 8;
	const out = make(bars * 4 * beat, MSR);
	let seed = sc.seed + (battle ? 100 : 0);
	const rnd = () => {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};
	// A two-bar motif, repeated with small changes.
	const motif: (number | null)[] = [];
	for (let i = 0; i < 16; i++) motif.push(rnd() < (battle ? 0.62 : 0.42) ? Math.floor(rnd() * 7) : null);
	for (let bar = 0; bar < bars; bar++) {
		const chord = sc.chords[bar % sc.chords.length];
		const t0 = bar * 4 * beat;
		const root = semi(sc.root, chord);
		// Pad: root, fifth, minor third, as soft triangles.
		for (const iv of [0, 7, 3, 12]) tone(out, MSR, t0, semi(root, iv) / 2, semi(root, iv) / 2, 4 * beat * 1.1, 0.06, 0.6, 'tri');
		// Bass plucks.
		pluck(out, MSR, t0, root / 2, 2 * beat, 0.35, 0.995, 0.2);
		pluck(out, MSR, t0 + 2 * beat, root / 2, 2 * beat, 0.25, 0.995, 0.2);
		// Melody.
		for (let i = 0; i < 8; i++) {
			const step = motif[(bar % 2) * 8 + i];
			if (step === null) continue;
			const varied = bar >= 4 && rnd() < 0.3 ? step + 1 : step;
			const deg = varied % sc.scale.length;
			const oct = Math.floor(varied / sc.scale.length);
			const f = semi(sc.root * 2, sc.scale[deg] + 12 * oct + (chord > 0 ? 0 : 0));
			pluck(out, MSR, t0 + (i * beat) / 2, f, beat * 1.6, 0.22, 0.997, 0.55);
		}
		if (battle) {
			// Frame drum and shaker.
			for (const b of [0, 1.5, 2, 3.5]) tone(out, MSR, t0 + b * beat, 95, 42, 0.3, b === 0 || b === 2 ? 0.6 : 0.35);
			for (let i = 0; i < 8; i++) noise(out, MSR, t0 + (i * beat) / 2, 0.06, i % 2 ? 0.08 : 0.14, 8000, 4000, 8);
			if (bar % 4 === 3) for (let i = 0; i < 3; i++) tone(out, MSR, t0 + (3 + i / 3) * beat, 160, 90, 0.2, 0.3);
		}
	}
	// Soft loop seam.
	const fade = Math.floor(0.02 * MSR);
	for (let i = 0; i < fade; i++) {
		out[i] *= i / fade;
		out[out.length - 1 - i] *= i / fade;
	}
	return normalize(out, 0.7);
}

// ---------- Playing ----------

let sfxVolume = 0.8;
let musicVolume = 0.5;
const loaded = new Set<string>();
let current: { key: string; play: AudioPlay } | null = null;

/** Makes every sound and all six music loops. Call before the first scene: KAPLAY waits for them. */
export function loadAudio() {
	for (const [name, fn] of Object.entries(SFX)) {
		k.loadSound(name, toBuffer(fn()));
		loaded.add(name);
	}
	for (let act = 0; act < SCORES.length; act++) {
		for (const battle of [false, true]) {
			const key = `music-${act}-${battle ? 'b' : 'm'}`;
			k.loadSound(key, toBuffer(renderMusic(act, battle), MSR));
			loaded.add(key);
		}
	}
}

export function setVolumes(sfx: number, music: number) {
	sfxVolume = sfx;
	musicVolume = music;
	if (current) current.play.volume = musicVolume * 0.55;
}

const lastPlayed = new Map<string, number>();

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

/** Plays a sound effect. Repeats of the same sound within a few ms are merged. */
export function sfx(name: string, opt: { volume?: number; detune?: number; speed?: number } = {}) {
	if (!loaded.has(name) || sfxVolume <= 0) return;
	const now = performance.now();
	if (now - (lastPlayed.get(name) ?? 0) < 28) return;
	lastPlayed.set(name, now);
	try {
		k.play(name, { volume: (opt.volume ?? 1) * sfxVolume, detune: (opt.detune ?? 0) + (Math.random() - 0.5) * 60, speed: opt.speed ?? 1 });
	} catch {
		// Audio not ready yet.
	}
}

/** Starts the loop for an act (map or battle). Makes it on first use. */
export function music(act: number, battle: boolean) {
	const key = `music-${act}-${battle ? 'b' : 'm'}`;
	if (current?.key === key) return;
	if (!loaded.has(key)) return;
	const old = current;
	if (old) fade(old.play, 0, 0.6, () => old.play.stop());
	try {
		const play = k.play(key, { loop: true, volume: 0 });
		current = { key, play };
		fade(play, musicVolume * 0.55, 1.2);
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
