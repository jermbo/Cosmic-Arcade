/**
 * All sound is made in code with the Web Audio API: no sound files.
 * The context starts at the first key, click or touch, as browsers ask.
 */

export type MusicMode = 'off' | 'menu' | 'run';

const BASS_LINE = [45, 45, 41, 43, 45, 45, 48, 43];
const ARP = [0, 7, 12, 7, 3, 7, 12, 15, 0, 7, 10, 7, 3, 7, 10, 12];
const STEP = 60 / 118 / 4;

function midi(note: number): number {
	return 440 * Math.pow(2, (note - 69) / 12);
}

export class Sound {
	private ctx: AudioContext | undefined;
	private master!: GainNode;
	private sfx!: GainNode;
	private sfxFilter!: BiquadFilterNode;
	private music!: GainNode;
	private musicFilter!: BiquadFilterNode;
	private noise!: AudioBuffer;
	private engineOsc: OscillatorNode | undefined;
	private engineGain: GainNode | undefined;
	private volumes = { master: 0.8, sfx: 0.9, music: 0.5 };
	private mode: MusicMode = 'off';
	private nextStep = 0;
	private stepIndex = 0;
	private lastImpact = 0;

	/** Call from a key, click or touch handler. */
	unlock(): void {
		if (this.ctx) {
			if (this.ctx.state === 'suspended') void this.ctx.resume();
			return;
		}
		const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!Ctor) return;
		const ctx = new Ctor();
		this.ctx = ctx;
		const squash = ctx.createDynamicsCompressor();
		squash.threshold.value = -14;
		squash.ratio.value = 6;
		squash.connect(ctx.destination);
		this.master = ctx.createGain();
		this.master.connect(squash);
		this.sfxFilter = ctx.createBiquadFilter();
		this.sfxFilter.type = 'lowpass';
		this.sfxFilter.frequency.value = 18000;
		this.sfxFilter.connect(this.master);
		this.sfx = ctx.createGain();
		this.sfx.connect(this.sfxFilter);
		this.musicFilter = ctx.createBiquadFilter();
		this.musicFilter.type = 'lowpass';
		this.musicFilter.frequency.value = 18000;
		this.musicFilter.connect(this.master);
		this.music = ctx.createGain();
		this.music.connect(this.musicFilter);

		this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
		const data = this.noise.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

		this.applyVolumes();
		this.nextStep = ctx.currentTime + 0.1;
		window.setInterval(() => this.schedule(), 40);
	}

	setVolumes(master: number, sfx: number, music: number): void {
		this.volumes = { master, sfx, music };
		this.applyVolumes();
	}

	setMusic(mode: MusicMode): void {
		this.mode = mode;
	}

	/** Makes the world sound dull and deep in slow motion. `scale` is the time scale, from 0 to 1. */
	setSlow(scale: number): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		this.sfxFilter.frequency.setTargetAtTime(scale > 0.9 ? 18000 : 500 + scale * 2600, now, 0.06);
		this.musicFilter.frequency.setTargetAtTime(scale > 0.9 ? 18000 : 700, now, 0.08);
	}

	/** Mutes or brings back all sound, for the pause and a hidden tab. */
	setPaused(paused: boolean): void {
		if (!this.ctx) return;
		if (paused) void this.ctx.suspend();
		else void this.ctx.resume();
	}

	engine(on: boolean, speed: number): void {
		const ctx = this.ctx;
		if (!ctx) return;
		if (on && !this.engineOsc) {
			const osc = ctx.createOscillator();
			osc.type = 'sawtooth';
			const filter = ctx.createBiquadFilter();
			filter.type = 'lowpass';
			filter.frequency.value = 520;
			const gain = ctx.createGain();
			gain.gain.value = 0;
			osc.connect(filter).connect(gain).connect(this.sfx);
			osc.start();
			this.engineOsc = osc;
			this.engineGain = gain;
		}
		if (!this.engineOsc || !this.engineGain) return;
		const now = ctx.currentTime;
		this.engineOsc.frequency.setTargetAtTime(48 + speed * 150, now, 0.08);
		this.engineGain.gain.setTargetAtTime(on ? 0.1 + speed * 0.12 : 0, now, 0.06);
		if (!on && this.engineGain.gain.value < 0.002) {
			this.engineOsc.stop();
			this.engineOsc.disconnect();
			this.engineOsc = undefined;
			this.engineGain = undefined;
		}
	}

	/** A crash sound. `power` is from 0 to 1. */
	impact(power: number): void {
		const ctx = this.ctx;
		if (!ctx || ctx.currentTime - this.lastImpact < 0.04) return;
		this.lastImpact = ctx.currentTime;
		const now = ctx.currentTime;
		const p = Math.max(0.15, Math.min(1, power));
		this.burst(now, 0.16 + p * 0.3, 500 + p * 2600, 0.5 * p + 0.15, 'lowpass');
		this.tone(now, 'sine', 110 + Math.random() * 30, 42, 0.18 + p * 0.12, 0.7 * p + 0.15);
		this.tone(now, 'square', 190 + Math.random() * 120, 80, 0.09, 0.14 * p);
		this.tone(now + 0.01, 'square', 310 + Math.random() * 200, 140, 0.07, 0.1 * p);
		if (p > 0.55) {
			for (let i = 0; i < 5; i++) {
				this.tone(now + 0.03 + Math.random() * 0.22, 'sine', 2400 + Math.random() * 3200, 2000, 0.05, 0.05);
			}
		}
	}

	blast(size: number): void {
		const ctx = this.ctx;
		if (!ctx) return;
		const now = ctx.currentTime;
		const s = Math.max(0.4, Math.min(1.3, size));
		const source = ctx.createBufferSource();
		source.buffer = this.noise;
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(2600, now);
		filter.frequency.exponentialRampToValueAtTime(90, now + 0.9 * s);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(1.1 * s, now);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3 * s);
		source.connect(filter).connect(gain).connect(this.sfx);
		source.start(now, Math.random());
		source.stop(now + 1.4 * s);
		this.tone(now, 'sine', 95, 26, 0.75 * s, 1.0 * s);
		this.tone(now, 'triangle', 190, 40, 0.25, 0.5 * s);
		this.burst(now, 0.05, 6000, 0.6, 'highpass');
	}

	cash(multiplier: number): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		const base = 660 * Math.pow(2, Math.min(12, multiplier - 1) / 12);
		this.tone(now, 'triangle', base, base, 0.09, 0.16);
		this.tone(now + 0.06, 'triangle', base * 1.5, base * 1.5, 0.14, 0.16);
	}

	chainBreak(): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		this.tone(now, 'triangle', 440, 220, 0.25, 0.14);
	}

	launch(): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		this.tone(now, 'sawtooth', 70, 300, 0.5, 0.2);
		this.burst(now, 0.5, 1800, 0.25, 'bandpass');
	}

	slowDown(): void {
		if (!this.ctx) return;
		this.tone(this.ctx.currentTime, 'sine', 520, 110, 0.5, 0.2);
	}

	tick(): void {
		if (!this.ctx) return;
		this.tone(this.ctx.currentTime, 'square', 880, 880, 0.04, 0.06);
	}

	ui(kind: 'move' | 'select' | 'back'): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		if (kind === 'move') this.tone(now, 'triangle', 520, 520, 0.04, 0.08);
		else if (kind === 'select') {
			this.tone(now, 'triangle', 660, 660, 0.06, 0.12);
			this.tone(now + 0.05, 'triangle', 990, 990, 0.09, 0.12);
		} else this.tone(now, 'triangle', 440, 300, 0.1, 0.1);
	}

	/** A short rising tune for a goal or a new best score. */
	fanfare(steps: number): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		const notes = [69, 72, 76, 81, 84];
		for (let i = 0; i < Math.min(notes.length, steps + 2); i++) {
			this.tone(now + i * 0.09, 'triangle', midi(notes[i]), midi(notes[i]), 0.22, 0.14);
		}
	}

	private applyVolumes(): void {
		if (!this.ctx) return;
		this.master.gain.value = this.volumes.master;
		this.sfx.gain.value = this.volumes.sfx;
		this.music.gain.value = this.volumes.music * 0.7;
	}

	private tone(at: number, type: OscillatorType, from: number, to: number, length: number, volume: number, out: AudioNode = this.sfx): void {
		const ctx = this.ctx;
		if (!ctx) return;
		const osc = ctx.createOscillator();
		osc.type = type;
		osc.frequency.setValueAtTime(from, at);
		if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + length);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.0001, at);
		gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), at + 0.006);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
		osc.connect(gain).connect(out);
		osc.start(at);
		osc.stop(at + length + 0.03);
	}

	private burst(at: number, length: number, cutoff: number, volume: number, type: BiquadFilterType, out: AudioNode = this.sfx): void {
		const ctx = this.ctx;
		if (!ctx) return;
		const source = ctx.createBufferSource();
		source.buffer = this.noise;
		const filter = ctx.createBiquadFilter();
		filter.type = type;
		filter.frequency.value = cutoff;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(volume, at);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
		source.connect(filter).connect(gain).connect(out);
		source.start(at, Math.random() * 1.5);
		source.stop(at + length + 0.03);
	}

	/** Lines up the notes of the music a short time ahead. */
	private schedule(): void {
		const ctx = this.ctx;
		if (!ctx || ctx.state !== 'running') return;
		if (this.nextStep < ctx.currentTime) this.nextStep = ctx.currentTime + 0.05;
		while (this.nextStep < ctx.currentTime + 0.18) {
			if (this.mode !== 'off') this.playStep(this.stepIndex, this.nextStep);
			this.stepIndex = (this.stepIndex + 1) % 128;
			this.nextStep += STEP;
		}
	}

	private playStep(step: number, at: number): void {
		const run = this.mode === 'run';
		const bar = Math.floor(step / 16) % BASS_LINE.length;
		const beat = step % 16;
		const root = BASS_LINE[bar];

		if (beat % 4 === 0 || (run && (beat === 6 || beat === 11))) {
			this.tone(at, 'triangle', midi(root - 12), midi(root - 12), STEP * 3, 0.5, this.music);
			this.tone(at, 'sawtooth', midi(root), midi(root), STEP * 1.6, 0.07, this.music);
		}
		if (run || beat % 2 === 0) {
			const note = root + 12 + ARP[(beat + (bar % 2) * 4) % ARP.length];
			this.tone(at, 'square', midi(note), midi(note), STEP * (run ? 0.9 : 1.8), run ? 0.045 : 0.03, this.music);
		}
		if (beat === 0 && !run) {
			for (const third of [0, 3, 7]) this.tone(at, 'sine', midi(root + 12 + third), midi(root + 12 + third), STEP * 15, 0.06, this.music);
		}
		if (run) {
			if (beat % 4 === 0) this.tone(at, 'sine', 150, 42, 0.16, 0.8, this.music);
			if (beat % 4 === 2) this.burst(at, 0.04, 7000, 0.12, 'highpass', this.music);
			if (beat === 4 || beat === 12) this.burst(at, 0.12, 1800, 0.3, 'bandpass', this.music);
		}
	}
}
