/** All sound is made in code: calm music, wind, birds, falling water and the small sounds of building. */

import { S } from './state.ts';

let ctx: AudioContext | null = null;
let musicBus: GainNode;
let soundBus: GainNode;
let echo: ConvolverNode;
let windGain: GainNode;
let fallsGain: GainNode;
let nextBeat = 0;
let beat = 0;
let birdTimer = 3;
let cricketTimer = 1;

/** Notes of a soft scale: C major pentatonic, as steps above C4. */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const CHORDS = [
	[5, 9, 12, 16],
	[0, 4, 7, 14],
	[9, 12, 16, 19],
	[7, 11, 14, 16],
	[5, 9, 12, 14],
	[0, 4, 7, 12],
	[2, 5, 9, 12],
	[7, 11, 14, 19],
];
const BEAT = 0.72;

const hz = (step: number): number => 261.63 * Math.pow(2, step / 12);

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
	const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
	const data = buf.getChannelData(0);
	let last = 0;
	for (let i = 0; i < data.length; i++) {
		// Soft noise: each sample leans on the one before.
		last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
		data[i] = last;
	}
	return buf;
}

/** Starts the sound. A browser only allows this after a tap or a key. */
export function startAudio(): void {
	if (ctx) {
		void ctx.resume();
		return;
	}
	const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
	if (!AC) return;
	ctx = new AC();
	const master = ctx.createGain();
	master.gain.value = 0.9;
	const limiter = ctx.createDynamicsCompressor();
	master.connect(limiter).connect(ctx.destination);
	musicBus = ctx.createGain();
	soundBus = ctx.createGain();
	musicBus.connect(master);
	soundBus.connect(master);

	// A soft room echo, made from fading noise.
	echo = ctx.createConvolver();
	const len = ctx.sampleRate * 2.6;
	const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const d = impulse.getChannelData(ch);
		for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
	}
	echo.buffer = impulse;
	const echoGain = ctx.createGain();
	echoGain.gain.value = 0.45;
	echo.connect(echoGain).connect(master);

	const noise = noiseBuffer(ctx, 3);
	const wind = ctx.createBufferSource();
	wind.buffer = noise;
	wind.loop = true;
	const windFilter = ctx.createBiquadFilter();
	windFilter.type = 'bandpass';
	windFilter.frequency.value = 420;
	windFilter.Q.value = 0.4;
	windGain = ctx.createGain();
	windGain.gain.value = 0.05;
	wind.connect(windFilter).connect(windGain).connect(soundBus);
	wind.start();

	// The waterfalls: a soft hush that is always there.
	const falls = ctx.createBufferSource();
	falls.buffer = noise;
	falls.loop = true;
	falls.playbackRate.value = 1.3;
	const fallsFilter = ctx.createBiquadFilter();
	fallsFilter.type = 'bandpass';
	fallsFilter.frequency.value = 1300;
	fallsFilter.Q.value = 0.5;
	fallsGain = ctx.createGain();
	fallsGain.gain.value = 0.018;
	falls.connect(fallsFilter).connect(fallsGain).connect(soundBus);
	falls.start();

	nextBeat = ctx.currentTime + 0.3;
	applyVolume();
}

export function applyVolume(): void {
	if (!ctx) return;
	musicBus.gain.setTargetAtTime(S.settings.music * 0.5, ctx.currentTime, 0.05);
	soundBus.gain.setTargetAtTime(S.settings.sound * 0.9, ctx.currentTime, 0.05);
}

export function pauseAudio(paused: boolean): void {
	if (!ctx) return;
	if (paused) void ctx.suspend();
	else void ctx.resume();
}

interface Tone {
	freq: number;
	at?: number;
	len: number;
	gain: number;
	type?: OscillatorType;
	attack?: number;
	/** The pitch slides to this by the end. */
	slideTo?: number;
	wet?: number;
	bus?: GainNode;
}

function tone(t: Tone): void {
	if (!ctx) return;
	const at = t.at ?? ctx.currentTime;
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = t.type ?? 'sine';
	osc.frequency.setValueAtTime(t.freq, at);
	if (t.slideTo) osc.frequency.exponentialRampToValueAtTime(t.slideTo, at + t.len);
	g.gain.setValueAtTime(0.0001, at);
	g.gain.linearRampToValueAtTime(t.gain, at + (t.attack ?? 0.008));
	g.gain.exponentialRampToValueAtTime(0.0001, at + t.len);
	osc.connect(g);
	g.connect(t.bus ?? soundBus);
	if (t.wet) {
		const send = ctx.createGain();
		send.gain.value = t.wet;
		g.connect(send).connect(echo);
	}
	osc.start(at);
	osc.stop(at + t.len + 0.05);
}

/** A soft bell, like a thumb piano. */
function bell(step: number, at: number, gain: number, bus: GainNode = musicBus, len = 1.5): void {
	tone({ freq: hz(step), at, len, gain, wet: 0.5, bus });
	tone({ freq: hz(step) * 3, at, len: len * 0.25, gain: gain * 0.18, bus });
}

/** Called each frame. It writes the next notes of the music a little ahead of time. */
export function updateAudio(dt: number, night: number, time: number): void {
	if (!ctx || ctx.state !== 'running') return;
	const now = ctx.currentTime;
	windGain.gain.setTargetAtTime(0.035 + (Math.sin(time * 0.21) * 0.5 + 0.5) * 0.05, now, 0.4);
	fallsGain.gain.setTargetAtTime(0.016 + (Math.sin(time * 0.13) * 0.5 + 0.5) * 0.008, now, 0.5);

	if (nextBeat < now - 1) nextBeat = now + 0.1;
	while (nextBeat < now + 0.25) {
		const chord = CHORDS[Math.floor(beat / 8) % CHORDS.length];
		const inBar = beat % 8;
		const calm = 1 - night * 0.4;
		if (inBar === 0) {
			// A long soft pad and a low root note.
			for (const step of chord.slice(0, 3)) tone({ freq: hz(step - 12), at: nextBeat, len: BEAT * 8.5, gain: 0.05, type: 'triangle', attack: 1.8, wet: 0.4, bus: musicBus });
			tone({ freq: hz(chord[0] - 24), at: nextBeat, len: BEAT * 7, gain: 0.11, attack: 0.4, bus: musicBus });
		}
		if (Math.random() < (inBar % 2 === 0 ? 0.8 : 0.3) * calm) bell(chord[Math.floor(Math.random() * chord.length)] + (Math.random() < 0.3 ? 12 : 0), nextBeat, 0.075);
		if (inBar % 4 === 2 && Math.random() < 0.5 * calm) bell(SCALE[5 + Math.floor(Math.random() * 6)], nextBeat + BEAT / 2, 0.05);
		nextBeat += BEAT;
		beat++;
	}

	// Birds by day, crickets at night.
	birdTimer -= dt;
	if (birdTimer <= 0) {
		birdTimer = 2.5 + Math.random() * 7;
		if (night < 0.4) {
			const base = 2300 + Math.random() * 1500;
			const n = 2 + Math.floor(Math.random() * 4);
			for (let i = 0; i < n; i++) tone({ freq: base * (1 + Math.random() * 0.2), slideTo: base * (0.8 + Math.random() * 0.5), at: now + i * (0.09 + Math.random() * 0.05), len: 0.08, gain: 0.02 + Math.random() * 0.015, wet: 0.5 });
		}
	}
	cricketTimer -= dt;
	if (cricketTimer <= 0) {
		cricketTimer = 0.9 + Math.random() * 1.6;
		if (night > 0.7) for (let i = 0; i < 3; i++) tone({ freq: 4300, at: now + i * 0.07, len: 0.04, gain: 0.006 });
	}
}

/* The small sounds */

export const sfx = {
	place(note: number): void {
		tone({ freq: 620, slideTo: 280, len: 0.13, gain: 0.16 });
		if (ctx) bell(SCALE[note % SCALE.length] + 12, ctx.currentTime + 0.03, 0.11, soundBus, 0.9);
	},
	erase(): void {
		tone({ freq: 300, slideTo: 150, len: 0.16, gain: 0.12, type: 'triangle' });
	},
	rotate(): void {
		tone({ freq: 700, slideTo: 900, len: 0.06, gain: 0.07, type: 'triangle' });
	},
	click(): void {
		tone({ freq: 880, len: 0.05, gain: 0.05, type: 'triangle' });
	},
	nope(): void {
		tone({ freq: 220, slideTo: 180, len: 0.14, gain: 0.09, type: 'triangle' });
	},
	undo(): void {
		tone({ freq: 520, slideTo: 380, len: 0.09, gain: 0.08 });
	},
	hello(): void {
		if (!ctx) return;
		tone({ freq: 900, slideTo: 1250, len: 0.09, gain: 0.05 });
		tone({ freq: 1150, slideTo: 1500, at: ctx.currentTime + 0.11, len: 0.1, gain: 0.05 });
	},
	grow(): void {
		tone({ freq: 500, slideTo: 800, len: 0.25, gain: 0.05, wet: 0.5 });
	},
	moveIn(): void {
		if (!ctx) return;
		[7, 12, 16].forEach((s, i) => bell(s, ctx!.currentTime + i * 0.09, 0.09, soundBus, 1));
	},
	combo(): void {
		if (!ctx) return;
		[0, 4, 7, 12, 16, 19, 24].forEach((s, i) => bell(s + 12, ctx!.currentTime + i * 0.075, 0.1, soundBus, 1.8));
	},
	/** The sky whale: two long low notes that slide. */
	whale(): void {
		if (!ctx) return;
		const now = ctx.currentTime;
		tone({ freq: 150, slideTo: 235, at: now, len: 2.4, gain: 0.11, attack: 0.5, wet: 0.8 });
		tone({ freq: 300, slideTo: 468, at: now, len: 2.4, gain: 0.03, attack: 0.6, wet: 0.8 });
		tone({ freq: 240, slideTo: 130, at: now + 2.2, len: 3, gain: 0.1, attack: 0.6, wet: 0.8 });
		tone({ freq: 480, slideTo: 262, at: now + 2.2, len: 3, gain: 0.025, attack: 0.7, wet: 0.8 });
	},
	gift(): void {
		if (!ctx) return;
		[12, 16, 19, 24, 28].forEach((s, i) => bell(s + 12, ctx!.currentTime + i * 0.06, 0.08, soundBus, 1.6));
	},
	sneeze(): void {
		if (!ctx) return;
		tone({ freq: 520, slideTo: 900, len: 0.16, gain: 0.05, type: 'triangle' });
		tone({ freq: 1500, slideTo: 500, at: ctx.currentTime + 0.17, len: 0.12, gain: 0.07, type: 'triangle' });
	},
	poke(): void {
		tone({ freq: 660, slideTo: 990, len: 0.12, gain: 0.05, wet: 0.4 });
	},
	island(): void {
		if (!ctx) return;
		[0, 4, 7, 12, 16, 19, 24, 28].forEach((s, i) => bell(s, ctx!.currentTime + i * 0.14, 0.11, soundBus, 2.6));
	},
	goal(): void {
		if (!ctx) return;
		[0, 7, 12, 16].forEach((s, i) => bell(s, ctx!.currentTime + i * 0.05, 0.11, soundBus, 2));
		bell(24, ctx.currentTime + 0.4, 0.1, soundBus, 2.2);
	},
};
