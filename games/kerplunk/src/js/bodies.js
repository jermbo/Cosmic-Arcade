// Instrument bodies: the voice of every note in the game (the drop, the clear chime, the chain).
// Each body is a recipe of layered tones, noise and plucked strings, made with the Web Audio API.
// note(ctx, out, freq, t, gain, len) plays one note into `out` at time t. `len` stretches every
// decay (1 is as built). The same recipe runs in a live AudioContext and an OfflineAudioContext,
// so the Sound Path can draw a picture of each body.

import { tuning } from './tuning.js';

const S = tuning.sound;

// ---- building blocks ----

const noiseBuffers = new WeakMap();
function noiseBuffer(ctx) {
	let buf = noiseBuffers.get(ctx);
	if (!buf) {
		buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		noiseBuffers.set(ctx, buf);
	}
	return buf;
}

/** A gain that rises in `attack` seconds to `peak`, then fades out over `decay` seconds. */
function envelope(ctx, t, peak, attack, decay) {
	const g = ctx.createGain();
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
	g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
	return g;
}

/**
 * One tone. bend: the pitch starts at freq × bend and glides to freq in bendTime.
 * vibrato and tremolo: { rate, depth } wobble the pitch (depth in cents) or the volume (depth 0..1).
 */
function partial(ctx, out, { freq, t, gain, decay, attack = 0.002, type = 'sine', bend = 1, bendTime = 0.02, vibrato, tremolo, filter }) {
	const osc = ctx.createOscillator();
	osc.type = type;
	osc.frequency.setValueAtTime(freq * bend, t);
	if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(freq, t + bendTime);
	const g = envelope(ctx, t, gain, attack, decay);
	let head = osc;
	if (filter) {
		const f = ctx.createBiquadFilter();
		f.type = 'lowpass';
		f.frequency.value = filter;
		osc.connect(f);
		head = f;
	}
	head.connect(g);
	let out2 = g;
	if (tremolo) {
		const amp = ctx.createGain();
		amp.gain.value = 1 - tremolo.depth / 2;
		const lfo = ctx.createOscillator();
		lfo.frequency.value = tremolo.rate;
		const depth = ctx.createGain();
		depth.gain.value = tremolo.depth / 2;
		lfo.connect(depth);
		depth.connect(amp.gain);
		g.connect(amp);
		out2 = amp;
		lfo.start(t);
		lfo.stop(t + attack + decay + 0.05);
	}
	if (vibrato) {
		const lfo = ctx.createOscillator();
		lfo.frequency.value = vibrato.rate;
		const depth = ctx.createGain();
		depth.gain.value = freq * (Math.pow(2, vibrato.depth / 1200) - 1);
		lfo.connect(depth);
		depth.connect(osc.frequency);
		lfo.start(t);
		lfo.stop(t + attack + decay + 0.05);
	}
	out2.connect(out);
	osc.start(t);
	osc.stop(t + attack + decay + 0.05);
}

/** A short burst of filtered noise: a knock, a breath, a click. */
function burst(ctx, out, { t, gain, decay, freq = 1000, q = 1, type = 'bandpass', attack = 0.001 }) {
	const src = ctx.createBufferSource();
	src.buffer = noiseBuffer(ctx);
	const f = ctx.createBiquadFilter();
	f.type = type;
	f.frequency.value = freq;
	f.Q.value = q;
	const g = envelope(ctx, t, gain, attack, decay);
	src.connect(f);
	f.connect(g);
	g.connect(out);
	src.start(t, Math.random() * 0.5);
	src.stop(t + attack + decay + 0.05);
}

// A plucked string (Karplus-Strong): a burst of noise that loops through a short delay and softens.
const strings = new WeakMap();
function stringBuffer(ctx, freq, decay, bright) {
	let cache = strings.get(ctx);
	if (!cache) strings.set(ctx, (cache = new Map()));
	const key = `${Math.round(freq * 10)}:${decay.toFixed(2)}:${bright}`;
	if (cache.has(key)) return cache.get(key);
	const sr = ctx.sampleRate;
	const n = Math.max(2, Math.round(sr / freq));
	const len = Math.ceil(sr * (decay + 0.1));
	const buf = ctx.createBuffer(1, len, sr);
	const y = buf.getChannelData(0);
	// Softer noise for a softer pluck: each pass of averaging takes off some of the top.
	const seed = new Float32Array(n);
	for (let i = 0; i < n; i++) seed[i] = Math.random() * 2 - 1;
	for (let pass = 0; pass < 3 - bright; pass++) for (let i = 1; i < n; i++) seed[i] = (seed[i] + seed[i - 1]) / 2;
	y.set(seed.subarray(0, Math.min(n, len)));
	const fade = Math.pow(0.001, 1 / (decay * freq)); // the loss in each trip round the loop
	for (let i = n; i < len; i++) y[i] = fade * 0.5 * (y[i - n] + y[i - n + 1]);
	cache.set(key, buf);
	return buf;
}

function pluck(ctx, out, { freq, t, gain, decay, bright = 1, tone = 4000 }) {
	const src = ctx.createBufferSource();
	src.buffer = stringBuffer(ctx, freq, decay, bright);
	const f = ctx.createBiquadFilter();
	f.type = 'lowpass';
	f.frequency.value = tone;
	const g = ctx.createGain();
	g.gain.value = gain * 1.6;
	src.connect(f);
	f.connect(g);
	g.connect(out);
	src.start(t);
	src.stop(t + decay + 0.1);
}

// ---- the bodies ----
// shift: semitones from the game's note to the body's sweet spot. level: so every body is about as loud.
// thud: how much of the low landing thud goes under a drop (1 is the built-in amount).

export const BODIES = {
	classic: {
		label: 'Wooden (now)',
		blurb: 'The sound Kerplunk has today. A plain marimba-like bar.',
		shift: 0,
		level: 1,
		thud: 1,
		note(ctx, out, f, t, g, len) {
			const d = Math.min(0.9, S.barLength) * len;
			partial(ctx, out, { freq: f, t, gain: g, decay: d, attack: 0.005, type: S.barWave });
			partial(ctx, out, { freq: f * S.knockPitch, t, gain: g * S.knock, decay: d * 0.18, attack: 0.005 });
			partial(ctx, out, { freq: f * 10, t, gain: g * S.click, decay: 0.012, type: 'triangle' });
		},
	},
	bubble: {
		label: 'Bubble',
		blurb: 'A round blip that swoops up, like a drop of water.',
		group: 'liked',
		shift: 0,
		level: 1.2,
		thud: 0.4,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 0.16 * len, attack: 0.004, bend: 0.55, bendTime: 0.07 });
			partial(ctx, out, { freq: f * 2, t: t + 0.03, gain: g * 0.22, decay: 0.08 * len, attack: 0.003, bend: 0.6, bendTime: 0.05 });
		},
	},
	woodblock: {
		label: 'Woodblock',
		blurb: 'A dry, hollow tock. Short and clicky.',
		group: 'liked',
		shift: 7,
		level: 1.3,
		thud: 0.6,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 0.07 * len, attack: 0.001, bend: 1.12, bendTime: 0.012 });
			partial(ctx, out, { freq: f * 2.71, t, gain: g * 0.3, decay: 0.03 * len, attack: 0.001 });
			burst(ctx, out, { t, gain: g * 0.5, decay: 0.025 * len, freq: f * 2, q: 6 });
		},
	},
	softPluck: {
		label: 'Soft pluck',
		blurb: 'A gently plucked string, warm and rounded.',
		group: 'liked',
		shift: 0,
		level: 1.8,
		thud: 0.7,
		note(ctx, out, f, t, g, len) {
			pluck(ctx, out, { freq: f, t, gain: g, decay: 0.9 * len, bright: 0, tone: 2600 });
		},
	},
	glassBell: {
		label: 'Glass bell',
		blurb: 'Pure and clear, with a soft shimmer that rings on.',
		group: 'liked',
		shift: 0,
		level: 0.6,
		thud: 0.5,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 1.4 * len });
			partial(ctx, out, { freq: f * 1.004, t, gain: g * 0.5, decay: 1.4 * len });
			partial(ctx, out, { freq: f * 2.76, t, gain: g * 0.32, decay: 0.6 * len });
			partial(ctx, out, { freq: f * 5.4, t, gain: g * 0.15, decay: 0.3 * len });
			partial(ctx, out, { freq: f * 8.93, t, gain: g * 0.07, decay: 0.14 * len });
		},
	},
	kalimba: {
		label: 'Kalimba',
		blurb: 'A thumb piano: a soft metal tine with a little buzz.',
		shift: 0,
		level: 1,
		thud: 0.6,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 0.9 * len, bend: 1.012, bendTime: 0.03 });
			partial(ctx, out, { freq: f * 6.1, t, gain: g * 0.16, decay: 0.07 * len });
			partial(ctx, out, { freq: f * 2, t, gain: g * 0.08, decay: 0.3 * len });
			burst(ctx, out, { t, gain: g * 0.25, decay: 0.008, freq: 4000, type: 'highpass' });
		},
	},
	tongueDrum: {
		label: 'Tongue drum',
		blurb: 'A steel tongue drum: deep, calm and round.',
		shift: -12,
		level: 0.95,
		thud: 0.5,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 1.3 * len, attack: 0.004 });
			partial(ctx, out, { freq: f * 2, t, gain: g * 0.14, decay: 0.5 * len, attack: 0.004 });
			partial(ctx, out, { freq: f * 3, t, gain: g * 0.05, decay: 0.25 * len, attack: 0.004 });
			burst(ctx, out, { t, gain: g * 0.35, decay: 0.04, freq: 350, type: 'lowpass' });
		},
	},
	musicBox: {
		label: 'Music box',
		blurb: 'Tiny, bright and sweet, like a wind-up box.',
		shift: 12,
		level: 0.8,
		thud: 0.3,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 1 * len, attack: 0.001 });
			partial(ctx, out, { freq: f * 2, t, gain: g * 0.3, decay: 0.45 * len, attack: 0.001 });
			partial(ctx, out, { freq: f * 3, t, gain: g * 0.1, decay: 0.25 * len, attack: 0.001 });
			partial(ctx, out, { freq: f * 6.8, t, gain: g * 0.05, decay: 0.05 * len, attack: 0.001 });
		},
	},
	steelDrum: {
		label: 'Steel drum',
		blurb: 'Sunny and playful, with a gentle bend at the start.',
		shift: 0,
		level: 0.9,
		thud: 0.6,
		note(ctx, out, f, t, g, len) {
			const bend = { bend: 0.985, bendTime: 0.03, attack: 0.006 };
			partial(ctx, out, { freq: f, t, gain: g, decay: 0.8 * len, ...bend });
			partial(ctx, out, { freq: f * 2, t, gain: g * 0.55, decay: 0.6 * len, ...bend });
			partial(ctx, out, { freq: f * 3, t, gain: g * 0.18, decay: 0.35 * len, ...bend });
			partial(ctx, out, { freq: f * 4.07, t, gain: g * 0.12, decay: 0.22 * len, ...bend });
		},
	},
	vibraphone: {
		label: 'Vibraphone',
		blurb: 'Soft metal bars with a slow, dreamy wobble.',
		shift: 0,
		level: 0.9,
		thud: 0.5,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 1.6 * len, attack: 0.003, tremolo: { rate: 5.5, depth: 0.5 } });
			partial(ctx, out, { freq: f * 4, t, gain: g * 0.22, decay: 0.35 * len, attack: 0.003 });
			partial(ctx, out, { freq: f * 10, t, gain: g * 0.03, decay: 0.03, attack: 0.002 });
		},
	},
	feltPiano: {
		label: 'Felt piano',
		blurb: 'A piano with felt on the hammers: hushed and cozy.',
		shift: -5,
		level: 1.05,
		thud: 0.8,
		note(ctx, out, f, t, g, len) {
			const soft = { attack: 0.008, filter: 1500 };
			partial(ctx, out, { freq: f, t, gain: g, decay: 0.8 * len, type: 'triangle', ...soft });
			partial(ctx, out, { freq: f * 2, t, gain: g * 0.4, decay: 0.5 * len, ...soft });
			partial(ctx, out, { freq: f * 3, t, gain: g * 0.15, decay: 0.3 * len, ...soft });
			burst(ctx, out, { t, gain: g * 0.4, decay: 0.05, freq: 250, type: 'lowpass' });
		},
	},
	koto: {
		label: 'Koto',
		blurb: 'A bright plucked string with a crisp attack.',
		shift: 0,
		level: 1.2,
		thud: 0.6,
		note(ctx, out, f, t, g, len) {
			pluck(ctx, out, { freq: f, t, gain: g, decay: 0.7 * len, bright: 2, tone: 6000 });
			burst(ctx, out, { t, gain: g * 0.25, decay: 0.01, freq: 2500, type: 'highpass' });
		},
	},
	raindrop: {
		label: 'Raindrop',
		blurb: 'A quick falling plip, like rain on a window.',
		shift: 12,
		level: 1.1,
		thud: 0.4,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 0.09 * len, attack: 0.001, bend: 2.2, bendTime: 0.025 });
			partial(ctx, out, { freq: f * 1.5, t: t + 0.05, gain: g * 0.15, decay: 0.05 * len, attack: 0.001, bend: 2, bendTime: 0.02 });
		},
	},
	toyPiano: {
		label: 'Toy piano',
		blurb: 'Plinky metal rods: cute and a bit out of tune.',
		shift: 0,
		level: 0.9,
		thud: 0.5,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 0.55 * len, attack: 0.001 });
			partial(ctx, out, { freq: f * 4.2, t, gain: g * 0.35, decay: 0.12 * len, attack: 0.001 });
			partial(ctx, out, { freq: f * 9.8, t, gain: g * 0.12, decay: 0.04 * len, attack: 0.001 });
		},
	},
	ocarina: {
		label: 'Ocarina',
		blurb: 'A small clay flute: breathy and soft.',
		shift: 0,
		level: 1.1,
		thud: 0.5,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 0.4 * len, attack: 0.03, vibrato: { rate: 5, depth: 8 } });
			partial(ctx, out, { freq: f * 2, t, gain: g * 0.07, decay: 0.3 * len, attack: 0.03 });
			burst(ctx, out, { t, gain: g * 0.08, decay: 0.25 * len, freq: f, q: 3, attack: 0.02 });
		},
	},
	clayPot: {
		label: 'Clay pot',
		blurb: 'A deep hollow "bloop" from a clay drum.',
		shift: -12,
		level: 1.3,
		thud: 0.3,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 0.35 * len, attack: 0.006, bend: 0.5, bendTime: 0.1 });
			partial(ctx, out, { freq: f * 2.01, t, gain: g * 0.15, decay: 0.15 * len, attack: 0.006, bend: 0.5, bendTime: 0.1 });
			burst(ctx, out, { t, gain: g * 0.45, decay: 0.06, freq: 200, type: 'lowpass' });
		},
	},

	// ---- cartoon ----
	laser: {
		label: 'Space laser',
		blurb: 'Pew! A bright beam that zooms down in pitch.',
		group: 'cartoon',
		shift: 0,
		level: 0.55,
		thud: 0.4,
		note(ctx, out, f, t, g, len) {
			const zoom = { bend: 6, bendTime: 0.16 * len, attack: 0.002, decay: 0.2 * len };
			partial(ctx, out, { freq: f * 0.5, t, gain: g, type: 'square', filter: 3500, ...zoom });
			partial(ctx, out, { freq: f * 0.25, t, gain: g * 0.6, ...zoom });
		},
	},
	zap: {
		label: 'Zap',
		blurb: 'A buzzy electric zap with a crackle.',
		group: 'cartoon',
		shift: 0,
		level: 0.5,
		thud: 0.5,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, type: 'sawtooth', decay: 0.14 * len, bend: 2, bendTime: 0.1 * len, vibrato: { rate: 70, depth: 250 }, filter: 4000 });
			burst(ctx, out, { t, gain: g * 0.5, decay: 0.05 * len, freq: 3500, type: 'highpass' });
		},
	},
	whap: {
		label: 'Whap',
		blurb: 'A cartoon slap: a smack of air with a little bonk.',
		group: 'cartoon',
		shift: -5,
		level: 1.1,
		thud: 0.7,
		note(ctx, out, f, t, g, len) {
			burst(ctx, out, { t, gain: g * 1.2, decay: 0.06 * len, freq: f * 3, q: 1.2 });
			partial(ctx, out, { freq: f * 0.7, t, gain: g * 0.8, decay: 0.09 * len, attack: 0.001, bend: 1.7, bendTime: 0.03 });
		},
	},
	boing: {
		label: 'Boing',
		blurb: 'A springy wobble, like a jack-in-the-box.',
		group: 'cartoon',
		shift: -5,
		level: 0.9,
		thud: 0.5,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 0.45 * len, attack: 0.004, bend: 0.6, bendTime: 0.04, vibrato: { rate: 16, depth: 140 } });
			partial(ctx, out, { freq: f * 2, t, gain: g * 0.15, decay: 0.2 * len, attack: 0.004, bend: 0.6, bendTime: 0.04 });
		},
	},
	corkPop: {
		label: 'Cork pop',
		blurb: 'A quick hollow pop, like a cork from a bottle.',
		group: 'cartoon',
		shift: 0,
		level: 1.2,
		thud: 0.5,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f * 1.5, t, gain: g, decay: 0.05 * len, attack: 0.001, bend: 0.4, bendTime: 0.015 });
			burst(ctx, out, { t, gain: g * 0.4, decay: 0.02, freq: 2000, type: 'highpass' });
		},
	},
	squeak: {
		label: 'Squeak',
		blurb: 'A rubber toy squeak that rises and wiggles.',
		group: 'cartoon',
		shift: 7,
		level: 0.75,
		thud: 0.4,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, type: 'triangle', decay: 0.15 * len, attack: 0.012, bend: 0.75, bendTime: 0.08, vibrato: { rate: 13, depth: 45 } });
		},
	},
	slideWhistle: {
		label: 'Slide whistle',
		blurb: 'Wheee! A whistle that slides up to its note.',
		group: 'cartoon',
		shift: 0,
		level: 0.9,
		thud: 0.4,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, decay: 0.35 * len, attack: 0.03, bend: 0.5, bendTime: 0.22 * len, vibrato: { rate: 6, depth: 15 } });
			burst(ctx, out, { t, gain: g * 0.06, decay: 0.3 * len, freq: f, q: 4, attack: 0.03 });
		},
	},
	coin: {
		label: 'Coin blip',
		blurb: 'An 8-bit two-note blip, like grabbing a coin.',
		group: 'cartoon',
		shift: 0,
		level: 0.45,
		thud: 0.4,
		note(ctx, out, f, t, g, len) {
			partial(ctx, out, { freq: f, t, gain: g, type: 'square', decay: 0.05, attack: 0.001, filter: 5000 });
			partial(ctx, out, { freq: f * 1.5, t: t + 0.05, gain: g, type: 'square', decay: 0.22 * len, attack: 0.001, filter: 5000 });
		},
	},
};

export const BODY_NAMES = Object.keys(BODIES);

/** Plays one note of a body into `out`. freq is the game's note; the body moves it to its sweet spot. */
export function playBody(name, ctx, out, freq, t, gain, len = 1) {
	const body = BODIES[name] || BODIES.classic;
	body.note(ctx, out, freq * Math.pow(2, body.shift / 12), t, gain * body.level, len);
}
