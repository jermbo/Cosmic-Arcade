// All sound, made with Web Audio nodes. Each voice is rendered once in an
// OfflineAudioContext, then played through a soft room reverb. Notes come from
// a C major pentatonic scale, so any run of them sounds musical.
import { save } from './save.ts';

let ctx: AudioContext | null = null;
let master: GainNode;
let wet: GainNode;
const buffers = new Map<string, AudioBuffer>();

const PENTA = [0, 2, 4, 7, 9];
const NOTES = 15;
/** Frequency of pentatonic step n, from C4. */
const noteHz = (n: number) => 261.63 * 2 ** ((Math.floor(n / 5) * 12 + PENTA[((n % 5) + 5) % 5]) / 12);

type Voice = (c: OfflineAudioContext, out: AudioNode) => void;

async function render(name: string, seconds: number, voice: Voice): Promise<void> {
	if (!ctx) return;
	const off = new OfflineAudioContext(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
	voice(off, off.destination);
	buffers.set(name, await off.startRendering());
}

function noise(c: BaseAudioContext, seconds: number): AudioBufferSourceNode {
	const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
	const src = c.createBufferSource();
	src.buffer = buf;
	return src;
}

function env(c: BaseAudioContext, out: AudioNode, peak: number, attack: number, decay: number): GainNode {
	const g = c.createGain();
	g.gain.setValueAtTime(0, 0);
	g.gain.linearRampToValueAtTime(peak, attack);
	g.gain.exponentialRampToValueAtTime(0.0001, attack + decay);
	g.connect(out);
	return g;
}

/** A soft plucked string: triangle plus octave, through a closing low-pass. */
const pluck = (hz: number): Voice => (c, out) => {
	const lp = c.createBiquadFilter();
	lp.type = 'lowpass';
	lp.Q.value = 0.7;
	lp.frequency.setValueAtTime(3200, 0);
	lp.frequency.exponentialRampToValueAtTime(700, 0.5);
	lp.connect(env(c, out, 0.5, 0.004, 0.9));
	const a = c.createOscillator();
	a.type = 'triangle';
	a.frequency.value = hz;
	a.connect(lp);
	const b = c.createOscillator();
	b.frequency.value = hz * 2;
	const bg = c.createGain();
	bg.gain.value = 0.2;
	b.connect(bg).connect(lp);
	a.start(0);
	b.start(0);
};

/** A wooden mallet: sine body plus a quick bright partial. */
const mallet = (hz: number): Voice => (c, out) => {
	const body = c.createOscillator();
	body.frequency.value = hz;
	body.connect(env(c, out, 0.45, 0.003, 0.45));
	const tick = c.createOscillator();
	tick.frequency.value = hz * 4;
	tick.connect(env(c, out, 0.12, 0.002, 0.06));
	body.start(0);
	tick.start(0);
};

const tap: Voice = (c, out) => {
	const o = c.createOscillator();
	o.frequency.setValueAtTime(1300, 0);
	o.frequency.exponentialRampToValueAtTime(700, 0.04);
	o.connect(env(c, out, 0.18, 0.002, 0.05));
	const n = noise(c, 0.05);
	const bp = c.createBiquadFilter();
	bp.type = 'bandpass';
	bp.frequency.value = 3500;
	bp.Q.value = 1.5;
	n.connect(bp).connect(env(c, out, 0.08, 0.001, 0.02));
	o.start(0);
	n.start(0);
};

const pop: Voice = (c, out) => {
	const o = c.createOscillator();
	o.frequency.setValueAtTime(320, 0);
	o.frequency.exponentialRampToValueAtTime(980, 0.07);
	o.connect(env(c, out, 0.35, 0.003, 0.1));
	o.start(0);
};

const thud: Voice = (c, out) => {
	const o = c.createOscillator();
	o.frequency.setValueAtTime(150, 0);
	o.frequency.exponentialRampToValueAtTime(65, 0.25);
	o.connect(env(c, out, 0.55, 0.004, 0.3));
	const n = noise(c, 0.2);
	const lp = c.createBiquadFilter();
	lp.type = 'lowpass';
	lp.frequency.value = 500;
	n.connect(lp).connect(env(c, out, 0.25, 0.002, 0.12));
	o.start(0);
	n.start(0);
};

const whoosh: Voice = (c, out) => {
	const n = noise(c, 0.45);
	const bp = c.createBiquadFilter();
	bp.type = 'bandpass';
	bp.Q.value = 2;
	bp.frequency.setValueAtTime(400, 0);
	bp.frequency.exponentialRampToValueAtTime(2400, 0.18);
	bp.frequency.exponentialRampToValueAtTime(600, 0.4);
	const g = c.createGain();
	g.gain.setValueAtTime(0, 0);
	g.gain.linearRampToValueAtTime(0.22, 0.12);
	g.gain.linearRampToValueAtTime(0, 0.42);
	n.connect(bp).connect(g).connect(out);
	n.start(0);
};

function makeReverb(c: AudioContext): ConvolverNode {
	const seconds = 1.6;
	const buf = c.createBuffer(2, Math.ceil(c.sampleRate * seconds), c.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const d = buf.getChannelData(ch);
		for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
	}
	const conv = c.createConvolver();
	conv.buffer = buf;
	return conv;
}

/** Call on the first tap or key press: browsers only start audio after one. */
export function unlockAudio(): void {
	if (ctx) {
		if (ctx.state === 'suspended') void ctx.resume();
		return;
	}
	try {
		ctx = new AudioContext();
	} catch {
		return;
	}
	const comp = ctx.createDynamicsCompressor();
	comp.threshold.value = -18;
	comp.ratio.value = 3;
	comp.connect(ctx.destination);
	master = ctx.createGain();
	master.gain.value = 0.55;
	master.connect(comp);
	const lp = ctx.createBiquadFilter();
	lp.type = 'lowpass';
	lp.frequency.value = 3000;
	wet = ctx.createGain();
	wet.gain.value = 0.22;
	wet.connect(makeReverb(ctx)).connect(lp).connect(comp);

	void (async () => {
		await Promise.all([render('tap', 0.08, tap), render('pop', 0.15, pop), render('thud', 0.4, thud), render('whoosh', 0.45, whoosh)]);
		for (let n = 0; n < NOTES; n++) {
			await render(`mallet${n}`, 0.5, mallet(noteHz(n)));
			await render(`pluck${n}`, 1, pluck(noteHz(n)));
		}
	})();
}

function play(name: string, delay = 0, gain = 1, rate = 1): void {
	if (!ctx || !save.settings.sound) return;
	const buf = buffers.get(name);
	if (!buf) return;
	const src = ctx.createBufferSource();
	src.buffer = buf;
	src.playbackRate.value = rate;
	const g = ctx.createGain();
	g.gain.value = gain;
	src.connect(g);
	g.connect(master);
	g.connect(wet);
	src.start(ctx.currentTime + delay);
}

const clampNote = (n: number) => Math.max(0, Math.min(NOTES - 1, Math.round(n)));
const note = (kind: 'pluck' | 'mallet', n: number, delay = 0, gain = 1) => play(`${kind}${clampNote(n)}`, delay, gain);

export const sfx = {
	key: () => play('tap', 0, 0.8, 0.9 + Math.random() * 0.2),
	erase: () => play('tap', 0, 0.6, 0.7),
	ui: () => play('pop', 0, 0.5),
	select: (count: number) => note('mallet', 4 + count, 0, 0.7),
	deselect: () => note('mallet', 3, 0, 0.5),
	flip: (i: number, mark: 'hit' | 'near' | 'miss') => note('mallet', (mark === 'hit' ? 9 : mark === 'near' ? 7 : 4) + (i % 2), 0, 0.6),
	hop: (i: number) => note('mallet', 6 + i, 0, 0.4),
	solve: (combo: number) => [0, 1, 2, 3].forEach((i) => note('pluck', 5 + i + Math.min(combo, 4), i * 0.07, 0.8)),
	wrong: () => {
		play('thud', 0, 0.8);
		note('mallet', 3, 0.05, 0.5);
		note('mallet', 1, 0.17, 0.5);
	},
	oneAway: () => {
		note('mallet', 7, 0, 0.6);
		note('mallet', 6, 0.12, 0.6);
	},
	invalid: () => play('thud', 0, 0.4, 1.4),
	shuffle: () => play('whoosh', 0, 0.8),
	unlock: () => {
		play('pop', 0, 0.6);
		note('pluck', 10, 0.06, 0.7);
		note('pluck', 12, 0.14, 0.7);
	},
	letter: () => note('pluck', 11, 0, 0.6),
	heart: () => play('thud', 0, 0.5, 1.2),
	win: () => [5, 7, 9, 10, 12, 14].forEach((n, i) => note('pluck', n, i * 0.09, 0.8)),
	lose: () => [6, 5, 3, 2].forEach((n, i) => note('mallet', n, i * 0.16, 0.55)),
	star: (i: number) => {
		note('pluck', 9 + i * 2, 0, 0.8);
		play('pop', 0, 0.4);
	},
	tick: (i: number) => note('mallet', 8 + (i % 5), 0, 0.25),
};

export function buzz(ms: number | number[]): void {
	if (save.settings.haptics) navigator.vibrate?.(ms);
}
