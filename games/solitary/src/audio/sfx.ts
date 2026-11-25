import { settings } from '../store/settings.ts';

// Cozy card sounds. Real card recordings (Kenney Casino Audio, CC0), made warm with a soft
// low-pass and a small room. Chimes are a kalimba-like tone made here, on a pentatonic scale.
// If a browser cannot decode the recordings, soft made-up sounds stand in.

const SAMPLES = {
	place: ['card-place-1', 'card-place-2', 'card-place-3', 'card-place-4'],
	slide: ['card-slide-1', 'card-slide-2', 'card-slide-3', 'card-slide-5', 'card-slide-7'],
	shove: ['card-shove-1', 'card-shove-2', 'card-shove-3'],
	fan: ['card-fan-1', 'card-fan-2'],
	shuffle: ['card-shuffle'],
	takeOut: ['cards-pack-take-out-1'],
} as const;

type Group = keyof typeof SAMPLES;

let ctx: AudioContext | null = null;
let master: GainNode;
let cardBus: GainNode;
let chimeBus: GainNode;
let reverbSend: GainNode;
let noise: AudioBuffer;
const buffers = new Map<string, AudioBuffer>();
let loading: Promise<void> | null = null;

function makeRoom(c: AudioContext): AudioBuffer {
	// A short, dark room: decaying noise, softened as it fades.
	const len = Math.floor(c.sampleRate * 1.4);
	const ir = c.createBuffer(2, len, c.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const d = ir.getChannelData(ch);
		let lp = 0;
		for (let i = 0; i < len; i++) {
			const t = i / len;
			lp += (Math.random() * 2 - 1 - lp) * (0.5 - t * 0.42);
			d[i] = lp * Math.pow(1 - t, 3);
		}
	}
	return ir;
}

function audio(): AudioContext | null {
	if (!settings.sound) return null;
	if (!ctx) {
		try {
			ctx = new AudioContext();
		} catch {
			return null;
		}
		const c = ctx;
		master = c.createGain();
		master.gain.value = 0.8;
		const comp = c.createDynamicsCompressor();
		comp.threshold.value = -18;
		comp.ratio.value = 3;
		master.connect(comp).connect(c.destination);

		// Cards: take the edge off the highs, add a touch of body.
		cardBus = c.createGain();
		const warm = c.createBiquadFilter();
		warm.type = 'lowpass';
		warm.frequency.value = 5200;
		warm.Q.value = 0.5;
		const body = c.createBiquadFilter();
		body.type = 'lowshelf';
		body.frequency.value = 260;
		body.gain.value = 3;
		cardBus.connect(warm).connect(body).connect(master);

		chimeBus = c.createGain();
		const soft = c.createBiquadFilter();
		soft.type = 'lowpass';
		soft.frequency.value = 3200;
		chimeBus.connect(soft).connect(master);

		const room = c.createConvolver();
		room.buffer = makeRoom(c);
		reverbSend = c.createGain();
		reverbSend.gain.value = 0.32;
		const roomOut = c.createGain();
		roomOut.gain.value = 0.5;
		reverbSend.connect(room).connect(roomOut).connect(master);
		body.connect(reverbSend);
		soft.connect(reverbSend);

		noise = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
		const data = noise.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		void load(c);
	}
	if (ctx.state === 'suspended') void ctx.resume();
	return ctx;
}

function load(c: AudioContext): Promise<void> {
	loading ??= Promise.all(
		Object.values(SAMPLES)
			.flat()
			.map(async (name) => {
				try {
					const res = await fetch(`./sfx/${name}.ogg`);
					buffers.set(name, await c.decodeAudioData(await res.arrayBuffer()));
				} catch {
					/* no decoder for this format: the made-up sound plays instead */
				}
			}),
	).then(() => {});
	return loading;
}

/** Call from the first tap or key press: browsers only start audio after a gesture. */
export function unlockAudio() {
	audio();
}

const last = new Map<Group, number>();

/** Play one take from a group, with a little change in pitch and level each time. */
function sample(group: Group, gain: number, rate = 1, at = 0, spread = 0.05): boolean {
	const c = ctx!;
	const names = SAMPLES[group];
	const pick = names[Math.floor(Math.random() * names.length)];
	const buf = buffers.get(pick);
	if (!buf) return false;
	const t = c.currentTime + at;
	// Many cards at once (auto-moves, deals) should not stack into a roar.
	if (at === 0 && t - (last.get(group) ?? 0) < 0.035) return true;
	last.set(group, t);
	const src = c.createBufferSource();
	src.buffer = buf;
	src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * spread);
	const g = c.createGain();
	g.gain.value = gain * (0.85 + Math.random() * 0.15);
	src.connect(g).connect(cardBus);
	src.start(t);
	return true;
}

/** Soft filtered noise, for when no recording is loaded. */
function brush(at: number, length: number, freq: number, gain: number) {
	const c = ctx!;
	const src = c.createBufferSource();
	src.buffer = noise;
	const f = c.createBiquadFilter();
	f.type = 'bandpass';
	f.frequency.value = freq;
	f.Q.value = 0.7;
	const env = c.createGain();
	const t = c.currentTime + at;
	env.gain.setValueAtTime(0, t);
	env.gain.linearRampToValueAtTime(gain, t + 0.012);
	env.gain.exponentialRampToValueAtTime(0.0001, t + length);
	src.connect(f).connect(env).connect(cardBus);
	src.start(t, Math.random() * 0.3, length + 0.02);
}

/** A kalimba-like note: a round tone with a bright, quick overtone. */
function chime(freq: number, at: number, gain: number, length = 1.4) {
	const c = ctx!;
	const t = c.currentTime + at;
	const parts: [number, number, number][] = [
		[1, 1, length],
		[2.01, 0.18, length * 0.4],
		[5.4, 0.07, 0.12],
	];
	for (const [mult, g, len] of parts) {
		const osc = c.createOscillator();
		osc.type = 'sine';
		osc.frequency.value = freq * mult;
		const env = c.createGain();
		env.gain.setValueAtTime(0, t);
		env.gain.linearRampToValueAtTime(gain * g, t + 0.006);
		env.gain.exponentialRampToValueAtTime(0.0001, t + len);
		osc.connect(env).connect(chimeBus);
		osc.start(t);
		osc.stop(t + len + 0.05);
	}
}

// C major pentatonic from C4: warm, never sour.
const PENTA = [0, 2, 4, 7, 9];
const note = (step: number) => 261.63 * Math.pow(2, (PENTA[step % 5] + 12 * Math.floor(step / 5)) / 12);

export const sfx = {
	/** Lift a card. */
	pick() {
		if (!audio()) return;
		if (!sample('slide', 0.22, 1.18)) brush(0, 0.06, 2400, 0.1);
	},
	/** Card set down on the felt. */
	place() {
		if (!audio()) return;
		if (!sample('place', 0.55, 0.94)) brush(0, 0.09, 1200, 0.25);
	},
	/** A card turns face up. */
	flip() {
		if (!audio()) return;
		if (!sample('slide', 0.16, 1.45, 0.05, 0.08)) brush(0.05, 0.07, 3000, 0.08);
	},
	/** Draw from the stock. */
	draw() {
		if (!audio()) return;
		if (!sample('slide', 0.32, 1.0)) brush(0, 0.1, 1800, 0.14);
	},
	/** Turn the waste back over. */
	redeal() {
		if (!audio()) return;
		if (!sample('fan', 0.32, 0.9)) brush(0, 0.3, 1600, 0.12);
	},
	/** Spider: a new row. */
	dealRow() {
		if (!audio()) return;
		if (!sample('fan', 0.4, 1.0)) brush(0, 0.35, 1800, 0.12);
	},
	/** A whole new game. */
	newDeal() {
		if (!audio()) return;
		if (!sample('shuffle', 0.42, 1.0, 0, 0.02)) brush(0, 0.5, 1500, 0.12);
		sample('fan', 0.3, 0.95, 0.55);
	},
	/** A card lands on a foundation. The note climbs with its rank. */
	home(rank = 1) {
		if (!audio()) return;
		if (!sample('shove', 0.38, 1.0)) brush(0, 0.08, 1500, 0.2);
		chime(note(Math.min(14, rank + 1)), 0.03, 0.07, 1.1);
	},
	undo() {
		if (!audio()) return;
		if (!sample('slide', 0.26, 0.82)) brush(0, 0.1, 1200, 0.12);
	},
	/** A soft, low "no". */
	nope() {
		if (!audio()) return;
		if (!sample('place', 0.22, 0.62, 0, 0.02)) brush(0, 0.1, 500, 0.2);
	},
	hint() {
		if (!audio()) return;
		chime(note(7), 0, 0.05, 0.8);
		chime(note(9), 0.09, 0.045, 0.9);
	},
	win() {
		if (!audio()) return;
		[5, 7, 8, 9, 10, 12].forEach((s, i) => chime(note(s), i * 0.12, 0.09, 1.8));
		chime(note(0) / 2, 0, 0.06, 2.6);
		chime(note(2) / 2, 0.36, 0.05, 2.4);
	},
};
