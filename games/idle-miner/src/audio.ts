// All sound is made here with Web Audio. No sound files.

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let noise: AudioBuffer;
let sfxVol = 0.8;
let musicVol = 0.5;
const lastPlayed = new Map<string, number>();

// A minor pentatonic over two octaves, in Hz. Taps and pops pick from it, so they always fit the music.
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];

export function initAudio() {
	if (ctx) {
		if (ctx.state === 'suspended') ctx.resume();
		return;
	}
	try {
		ctx = new AudioContext();
	} catch {
		return;
	}
	master = ctx.createGain();
	master.gain.value = 0.9;
	const comp = ctx.createDynamicsCompressor();
	comp.threshold.value = -14;
	comp.ratio.value = 4;
	master.connect(comp).connect(ctx.destination);
	sfxBus = ctx.createGain();
	musicBus = ctx.createGain();
	sfxBus.gain.value = sfxVol;
	musicBus.gain.value = musicVol * 0.5;
	sfxBus.connect(master);
	musicBus.connect(master);
	noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
	const data = noise.getChannelData(0);
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
	startMusic();
}

export function setVolumes(sfx: number, music: number) {
	sfxVol = sfx;
	musicVol = music;
	if (!ctx) return;
	sfxBus.gain.setTargetAtTime(sfx, ctx.currentTime, 0.05);
	musicBus.gain.setTargetAtTime(music * 0.5, ctx.currentTime, 0.3);
}

export function suspendAudio(off: boolean) {
	if (!ctx) return;
	if (off) ctx.suspend();
	else ctx.resume();
}

function tone(freq: number, opts: { type?: OscillatorType; start?: number; dur?: number; vol?: number; attack?: number; slide?: number; bus?: GainNode; filter?: number } = {}) {
	if (!ctx) return;
	const t = ctx.currentTime + (opts.start || 0);
	const dur = opts.dur ?? 0.15;
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = opts.type || 'sine';
	osc.frequency.setValueAtTime(freq, t);
	if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
	const vol = opts.vol ?? 0.2;
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack ?? 0.005));
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	let node: AudioNode = osc;
	if (opts.filter) {
		const f = ctx.createBiquadFilter();
		f.type = 'lowpass';
		f.frequency.value = opts.filter;
		osc.connect(f);
		node = f;
	}
	node.connect(g).connect(opts.bus || sfxBus);
	osc.start(t);
	osc.stop(t + dur + 0.05);
}

function hiss(opts: { start?: number; dur?: number; vol?: number; from?: number; to?: number; q?: number } = {}) {
	if (!ctx) return;
	const t = ctx.currentTime + (opts.start || 0);
	const dur = opts.dur ?? 0.3;
	const src = ctx.createBufferSource();
	src.buffer = noise;
	const f = ctx.createBiquadFilter();
	f.type = 'bandpass';
	f.Q.value = opts.q ?? 1.5;
	f.frequency.setValueAtTime(opts.from ?? 800, t);
	f.frequency.exponentialRampToValueAtTime(opts.to ?? 3000, t + dur);
	const g = ctx.createGain();
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.15, t + dur * 0.3);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	src.connect(f).connect(g).connect(sfxBus);
	src.start(t);
	src.stop(t + dur + 0.05);
}

/** Skips a sound that played less than `gap` seconds ago. */
function throttle(name: string, gap: number) {
	if (!ctx) return false;
	const now = ctx.currentTime;
	if (now - (lastPlayed.get(name) || -1) < gap) return false;
	lastPlayed.set(name, now);
	return true;
}

const pick = (lo: number, hi: number) => SCALE[lo + Math.floor(Math.random() * (hi - lo + 1))];

export const sfx = {
	tap(combo: number) {
		if (!throttle('tap', 0.03)) return;
		const f = SCALE[Math.min(SCALE.length - 1, 3 + (combo % 6))];
		tone(f * 2, { type: 'triangle', dur: 0.12, vol: 0.16 });
		tone(f, { type: 'sine', dur: 0.08, vol: 0.12, slide: 0.5 });
		hiss({ dur: 0.08, vol: 0.05, from: 2000, to: 600 });
	},
	click() {
		if (!throttle('click', 0.04)) return;
		tone(1400, { type: 'square', dur: 0.03, vol: 0.04, filter: 3000 });
	},
	place() {
		if (!throttle('place', 0.04)) return;
		tone(160, { type: 'sine', dur: 0.14, vol: 0.3, slide: 0.6 });
		tone(pick(4, 7), { type: 'triangle', dur: 0.1, vol: 0.08, start: 0.02 });
		hiss({ dur: 0.1, vol: 0.06, from: 600, to: 200 });
	},
	belt() {
		if (!throttle('belt', 0.05)) return;
		tone(pick(5, 9), { type: 'triangle', dur: 0.05, vol: 0.06 });
	},
	remove() {
		tone(300, { type: 'sawtooth', dur: 0.15, vol: 0.06, slide: 0.4, filter: 1200 });
		hiss({ dur: 0.15, vol: 0.06, from: 3000, to: 400 });
	},
	blast() {
		tone(95, { type: 'sine', dur: 0.4, vol: 0.35, slide: 0.35 });
		hiss({ dur: 0.5, vol: 0.16, from: 2400, to: 140, q: 0.7 });
		tone(pick(2, 4), { type: 'triangle', dur: 0.16, vol: 0.06, start: 0.09 });
	},
	upgrade() {
		[0, 2, 4, 7].forEach((n, i) => tone(SCALE[Math.min(10, n + 2)] * 1, { type: 'triangle', start: i * 0.05, dur: 0.18, vol: 0.12 }));
		hiss({ dur: 0.25, vol: 0.05, from: 1000, to: 6000, start: 0.05 });
	},
	buy() {
		tone(SCALE[5], { type: 'triangle', dur: 0.1, vol: 0.12 });
		tone(SCALE[8], { type: 'triangle', dur: 0.18, vol: 0.12, start: 0.06 });
	},
	error() {
		if (!throttle('error', 0.15)) return;
		tone(140, { type: 'square', dur: 0.12, vol: 0.06, filter: 600 });
		tone(110, { type: 'square', dur: 0.14, vol: 0.06, filter: 600, start: 0.07 });
	},
	land(big: boolean) {
		if (!throttle('land', 0.12)) return;
		hiss({ dur: 0.35, vol: 0.08, from: 3000, to: 300 });
		const base = big ? 0 : 2;
		tone(SCALE[base + 5], { type: 'sine', dur: 0.5, vol: 0.1, start: 0.08 });
		tone(SCALE[base + 7], { type: 'sine', dur: 0.6, vol: 0.08, start: 0.13 });
		tone(SCALE[base + 9 > 10 ? 10 : base + 9], { type: 'triangle', dur: 0.5, vol: 0.05, start: 0.18 });
	},
	coin() {
		if (!throttle('coin', 0.06)) return;
		tone(pick(6, 10) * 2, { type: 'sine', dur: 0.08, vol: 0.05 });
	},
	depart() {
		if (!throttle('depart', 0.3)) return;
		hiss({ dur: 0.6, vol: 0.05, from: 300, to: 1800, q: 3 });
	},
	goal() {
		tone(SCALE[5], { type: 'triangle', dur: 0.2, vol: 0.12 });
		tone(SCALE[7], { type: 'triangle', dur: 0.2, vol: 0.12, start: 0.09 });
		tone(SCALE[10], { type: 'triangle', dur: 0.4, vol: 0.12, start: 0.18 });
	},
	unlock() {
		[0, 4, 7, 10].forEach((n, i) => {
			tone(SCALE[n], { type: 'sawtooth', dur: 1.2, vol: 0.05, start: i * 0.08, attack: 0.08, filter: 1800 });
			tone(SCALE[n] * 2, { type: 'sine', dur: 0.9, vol: 0.06, start: 0.3 + i * 0.07 });
		});
		hiss({ dur: 1.2, vol: 0.06, from: 400, to: 8000 });
	},
	warp() {
		tone(80, { type: 'sawtooth', dur: 2.2, vol: 0.12, slide: 8, filter: 2400, attack: 0.3 });
		hiss({ dur: 2.2, vol: 0.12, from: 200, to: 9000, q: 0.8 });
		[0, 3, 5, 7, 10].forEach((n, i) => tone(SCALE[n] * 2, { type: 'sine', dur: 1.5, vol: 0.06, start: 1 + i * 0.1 }));
	},
};

// ---------- music: slow pads and sparse bells ----------

const CHORDS = [
	[110, 164.81, 220, 261.63],
	[87.31, 130.81, 174.61, 220],
	[98, 146.83, 196, 246.94],
	[82.41, 123.47, 164.81, 207.65],
];
let musicTimer = 0;

function startMusic() {
	if (!ctx) return;
	let chord = 0;
	const playChord = () => {
		if (!ctx) return;
		if (ctx.state === 'running' && musicVol > 0) {
			const t = ctx.currentTime;
			for (const f of CHORDS[chord % CHORDS.length]) {
				for (const det of [-4, 4]) {
					const osc = ctx.createOscillator();
					const g = ctx.createGain();
					const lp = ctx.createBiquadFilter();
					osc.type = 'triangle';
					osc.frequency.value = f;
					osc.detune.value = det;
					lp.type = 'lowpass';
					lp.frequency.setValueAtTime(400, t);
					lp.frequency.linearRampToValueAtTime(900, t + 4);
					lp.frequency.linearRampToValueAtTime(400, t + 9);
					g.gain.setValueAtTime(0.0001, t);
					g.gain.linearRampToValueAtTime(0.035, t + 3);
					g.gain.linearRampToValueAtTime(0.0001, t + 9.5);
					osc.connect(lp).connect(g).connect(musicBus);
					osc.start(t);
					osc.stop(t + 10);
				}
			}
			// a few bell notes over the chord
			const bells = 2 + Math.floor(Math.random() * 3);
			for (let i = 0; i < bells; i++) {
				const f = CHORDS[chord % CHORDS.length][1 + Math.floor(Math.random() * 3)] * (Math.random() < 0.5 ? 4 : 2);
				tone(f, { type: 'sine', start: 1 + Math.random() * 6, dur: 2.5, vol: 0.025, attack: 0.01, bus: musicBus });
			}
			chord++;
		}
		musicTimer = window.setTimeout(playChord, 8000);
	};
	clearTimeout(musicTimer);
	playChord();
}
