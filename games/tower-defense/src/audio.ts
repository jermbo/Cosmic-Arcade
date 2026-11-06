// All sound and music is made here with Web Audio. No audio files.

export type SfxName =
	| 'click'
	| 'hover'
	| 'place'
	| 'upgrade'
	| 'sell'
	| 'deny'
	| 'ballista'
	| 'cannon'
	| 'catapult'
	| 'crystal'
	| 'hit'
	| 'boom'
	| 'thud'
	| 'pop'
	| 'bigPop'
	| 'leak'
	| 'wave'
	| 'waveClear'
	| 'swarm'
	| 'win'
	| 'lose'
	| 'star';

const MIN_GAP: Partial<Record<SfxName, number>> = { hit: 0.04, pop: 0.03, boom: 0.05, ballista: 0.05, cannon: 0.06, crystal: 0.1, thud: 0.06, hover: 0.05 };

type Mood = 'menu' | 'battle';

// A minor, F major, C major, G major.
const CHORDS = [
	[57, 60, 64],
	[53, 57, 60],
	[48, 52, 55],
	[55, 59, 62],
];

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
	private ctx: AudioContext | null = null;
	private master!: GainNode;
	private sfxBus!: GainNode;
	private musicBus!: GainNode;
	private noiseBuffer!: AudioBuffer;
	private last = new Map<SfxName, number>();
	private sfxVolume = 0.8;
	private musicVolume = 0.5;
	private mood: Mood | null = null;
	private wantedMood: Mood | null = null;
	private step = 0;
	private nextTime = 0;
	private timer = 0;

	/** Browsers allow sound only after a click or key press. */
	unlock(): void {
		if (this.ctx) {
			if (this.ctx.state === 'suspended') void this.ctx.resume();
			return;
		}
		const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!Ctx) return;
		this.ctx = new Ctx();
		this.master = this.ctx.createGain();
		this.master.gain.value = 0.9;
		const comp = this.ctx.createDynamicsCompressor();
		comp.threshold.value = -14;
		comp.ratio.value = 4;
		this.master.connect(comp).connect(this.ctx.destination);
		this.sfxBus = this.ctx.createGain();
		this.musicBus = this.ctx.createGain();
		this.sfxBus.connect(this.master);
		this.musicBus.connect(this.master);
		this.setVolumes(this.musicVolume, this.sfxVolume);
		const length = this.ctx.sampleRate;
		this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
		const data = this.noiseBuffer.getChannelData(0);
		for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
		if (this.wantedMood) this.music(this.wantedMood);
	}

	setVolumes(music: number, sfx: number): void {
		this.musicVolume = music;
		this.sfxVolume = sfx;
		if (!this.ctx) return;
		this.musicBus.gain.setTargetAtTime(music * 0.35, this.ctx.currentTime, 0.05);
		this.sfxBus.gain.setTargetAtTime(sfx * 0.7, this.ctx.currentTime, 0.05);
	}

	private tone(freq: number, dur: number, type: OscillatorType, gain: number, { to = 0, delay = 0, attack = 0.005, bus = this.sfxBus } = {}): void {
		const ctx = this.ctx!;
		const t = ctx.currentTime + delay;
		const osc = ctx.createOscillator();
		const amp = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
		amp.gain.setValueAtTime(0.0001, t);
		amp.gain.exponentialRampToValueAtTime(gain, t + attack);
		amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		osc.connect(amp).connect(bus);
		osc.start(t);
		osc.stop(t + dur + 0.05);
	}

	private noise(dur: number, gain: number, freq: number, { type = 'lowpass' as BiquadFilterType, to = 0, delay = 0, q = 1, bus = this.sfxBus } = {}): void {
		const ctx = this.ctx!;
		const t = ctx.currentTime + delay;
		const src = ctx.createBufferSource();
		src.buffer = this.noiseBuffer;
		const filter = ctx.createBiquadFilter();
		filter.type = type;
		filter.Q.value = q;
		filter.frequency.setValueAtTime(freq, t);
		if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur);
		const amp = ctx.createGain();
		amp.gain.setValueAtTime(gain, t);
		amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		src.connect(filter).connect(amp).connect(bus);
		src.start(t, Math.random() * 0.5);
		src.stop(t + dur + 0.05);
	}

	play(name: SfxName): void {
		if (!this.ctx || this.ctx.state !== 'running') return;
		const now = this.ctx.currentTime;
		const gap = MIN_GAP[name] ?? 0.02;
		if (now - (this.last.get(name) ?? -1) < gap) return;
		this.last.set(name, now);
		const pitch = 0.94 + Math.random() * 0.12;

		switch (name) {
			case 'click':
				this.tone(880, 0.06, 'triangle', 0.25, { to: 1200 });
				break;
			case 'hover':
				this.tone(1400, 0.03, 'sine', 0.08);
				break;
			case 'place':
				this.noise(0.12, 0.6, 600, { to: 150 });
				this.tone(140, 0.15, 'sine', 0.6, { to: 70 });
				this.tone(660, 0.12, 'triangle', 0.2, { delay: 0.08 });
				this.tone(990, 0.16, 'triangle', 0.18, { delay: 0.14 });
				break;
			case 'upgrade':
				[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.22, { delay: i * 0.06 }));
				this.noise(0.3, 0.15, 3000, { type: 'highpass', delay: 0.2 });
				break;
			case 'sell':
				[988, 784, 659].forEach((f, i) => this.tone(f, 0.12, 'square', 0.08, { delay: i * 0.05 }));
				break;
			case 'deny':
				this.tone(180, 0.14, 'square', 0.15, { to: 120 });
				break;
			case 'ballista':
				this.noise(0.09, 0.35, 2500 * pitch, { type: 'bandpass', to: 700, q: 2 });
				this.tone(320 * pitch, 0.07, 'triangle', 0.2, { to: 140 });
				break;
			case 'cannon':
				this.tone(110 * pitch, 0.22, 'sine', 0.7, { to: 40 });
				this.noise(0.18, 0.45, 1200, { to: 200 });
				break;
			case 'catapult':
				this.noise(0.3, 0.25, 400, { type: 'bandpass', to: 1500, q: 1.5 });
				this.tone(90, 0.12, 'square', 0.12, { to: 60 });
				break;
			case 'crystal':
				this.tone(1318 * pitch, 0.5, 'sine', 0.12);
				this.tone(1975 * pitch, 0.4, 'sine', 0.06, { delay: 0.03 });
				this.tone(659 * pitch, 0.3, 'triangle', 0.08);
				break;
			case 'hit':
				this.noise(0.05, 0.25, 3500 * pitch, { type: 'bandpass', q: 3 });
				break;
			case 'boom':
				this.tone(90 * pitch, 0.35, 'sine', 0.6, { to: 35 });
				this.noise(0.35, 0.5, 1800, { to: 120 });
				break;
			case 'thud':
				this.tone(70 * pitch, 0.3, 'sine', 0.8, { to: 30 });
				this.noise(0.25, 0.5, 700, { to: 90 });
				break;
			case 'pop':
				this.tone(700 * pitch, 0.16, 'square', 0.12, { to: 160 });
				this.noise(0.12, 0.25, 2500, { to: 400 });
				break;
			case 'bigPop':
				this.tone(400, 0.5, 'sawtooth', 0.18, { to: 60 });
				this.tone(55, 0.6, 'sine', 0.8, { to: 25 });
				this.noise(0.6, 0.6, 2500, { to: 80 });
				break;
			case 'leak':
				this.tone(220, 0.25, 'sawtooth', 0.25, { to: 110 });
				this.tone(207, 0.25, 'square', 0.15, { to: 104, delay: 0.12 });
				break;
			case 'wave':
				this.tone(392, 0.22, 'sawtooth', 0.12);
				this.tone(523, 0.4, 'sawtooth', 0.12, { delay: 0.18 });
				this.tone(196, 0.6, 'triangle', 0.25);
				break;
			case 'waveClear':
				[659, 784, 988].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.18, { delay: i * 0.08 }));
				break;
			case 'swarm':
				[784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.16, { delay: i * 0.045 }));
				this.noise(0.6, 0.2, 5000, { type: 'highpass' });
				break;
			case 'star':
				this.tone(1047, 0.35, 'triangle', 0.25);
				this.tone(1568, 0.35, 'sine', 0.15, { delay: 0.04 });
				break;
			case 'win':
				[523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.22, { delay: [0, 0.12, 0.24, 0.36, 0.6, 0.72][i] }));
				break;
			case 'lose':
				[392, 370, 349, 262].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.12, { delay: i * 0.25 }));
				break;
		}
	}

	/** Starts, changes or stops (null) the background music. */
	music(mood: Mood | null): void {
		this.wantedMood = mood;
		if (!this.ctx) return;
		if (mood === this.mood) return;
		this.mood = mood;
		clearInterval(this.timer);
		if (!mood) return;
		this.step = 0;
		this.nextTime = this.ctx.currentTime + 0.1;
		this.timer = window.setInterval(() => this.schedule(), 25);
	}

	private schedule(): void {
		const ctx = this.ctx!;
		const battle = this.mood === 'battle';
		const sixteenth = 60 / (battle ? 104 : 84) / 4;
		const bus = this.musicBus;
		while (this.nextTime < ctx.currentTime + 0.15) {
			const delay = this.nextTime - ctx.currentTime;
			const step = this.step % 16;
			const chord = CHORDS[Math.floor(this.step / 16) % 4];
			if (step === 0) {
				for (const n of chord) this.tone(midi(n), sixteenth * 16, 'triangle', 0.07, { delay, attack: 0.4, bus });
			}
			if (step === 0 || step === 8 || (battle && step === 10)) {
				this.tone(midi(chord[0] - 24), sixteenth * 3, 'sine', 0.35, { delay, bus });
			}
			if (step % 2 === 0 && (battle || step % 4 === 0)) {
				const notes = [chord[0], chord[1], chord[2], chord[1] + 12];
				this.tone(midi(notes[(step / 2) % 4] + 12), sixteenth * 1.5, 'triangle', battle ? 0.05 : 0.04, { delay, bus });
			}
			if (battle) {
				if (step % 4 === 0) this.tone(120, 0.12, 'sine', 0.5, { to: 45, delay, bus });
				if (step % 4 === 2) this.noise(0.04, 0.12, 7000, { type: 'highpass', delay, bus });
				if (step === 4 || step === 12) this.noise(0.12, 0.18, 1800, { type: 'bandpass', delay, bus });
			}
			this.nextTime += sixteenth;
			this.step += 1;
		}
	}
}

export const sound = new Sound();
