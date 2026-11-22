import { rng } from './util';

export type Theme = 'title' | 'garden' | 'ice' | 'lava' | 'flight' | 'end' | 'none';
export type Surface = 'grass' | 'ice' | 'rock';

interface ThemeDef {
	bpm: number;
	root: number; // midi note
	chords: number[][]; // semitones from root, one per bar
	arp: number; // chance of an arp note on each 8th
	arpOct: number; // octaves above the root
	bass: 'none' | 'bar' | 'half' | 'eighth';
	padCutoff: number;
	bell: 'soft' | 'glass' | 'warm';
}

const THEMES: Record<Exclude<Theme, 'none'>, ThemeDef> = {
	title: { bpm: 64, root: 57, chords: [[0, 7, 11, 16], [-3, 4, 7, 12], [-7, 0, 4, 9], [-5, 2, 7, 11]], arp: 0.28, arpOct: 1, bass: 'bar', padCutoff: 900, bell: 'soft' },
	garden: { bpm: 92, root: 60, chords: [[0, 4, 7, 14], [-3, 4, 9, 12], [-7, 5, 9, 12], [-5, 7, 11, 14]], arp: 0.55, arpOct: 1, bass: 'half', padCutoff: 1200, bell: 'warm' },
	ice: { bpm: 74, root: 62, chords: [[0, 3, 7, 14], [-4, 3, 7, 10], [-7, 5, 9, 12], [-2, 5, 10, 14]], arp: 0.42, arpOct: 2, bass: 'bar', padCutoff: 1600, bell: 'glass' },
	lava: { bpm: 100, root: 52, chords: [[0, 7, 12, 15], [-4, 8, 12, 15], [-2, 10, 14, 17], [-5, 7, 11, 14]], arp: 0.35, arpOct: 1, bass: 'eighth', padCutoff: 700, bell: 'soft' },
	flight: { bpm: 80, root: 64, chords: [[0, 7, 11, 14, 19]], arp: 0.7, arpOct: 2, bass: 'none', padCutoff: 2200, bell: 'glass' },
	end: { bpm: 70, root: 60, chords: [[0, 4, 7, 11, 16], [-3, 4, 9, 12], [-7, 4, 9, 12, 16], [-5, 2, 7, 11, 14]], arp: 0.6, arpOct: 1, bass: 'bar', padCutoff: 1800, bell: 'warm' },
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** All sound is made in code with Web Audio: no files. */
export class GameAudio {
	private ctx: AudioContext | null = null;
	private master!: GainNode;
	private music!: GainNode;
	private sfx!: GainNode;
	private reverb!: ConvolverNode;
	private reverbSend!: GainNode;
	private noise!: AudioBuffer;
	private theme: Theme = 'none';
	private themeGain: GainNode | null = null;
	private nextBarTime = 0;
	private bar = 0;
	private random = rng(7);
	private volumes = { master: 0.8, music: 0.6, sfx: 0.8 };
	private stepFlip = false;

	/** Must run inside a user gesture the first time. */
	unlock(): void {
		if (this.ctx) {
			if (this.ctx.state === 'suspended') void this.ctx.resume();
			return;
		}
		const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!AC) return;
		const ctx = new AC();
		this.ctx = ctx;
		this.master = ctx.createGain();
		this.master.connect(ctx.destination);
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -14;
		comp.ratio.value = 4;
		comp.connect(this.master);
		this.music = ctx.createGain();
		this.sfx = ctx.createGain();
		this.music.connect(comp);
		this.sfx.connect(comp);
		this.reverb = ctx.createConvolver();
		this.reverb.buffer = this.makeImpulse(2.8);
		this.reverbSend = ctx.createGain();
		this.reverbSend.gain.value = 0.9;
		this.reverbSend.connect(this.reverb);
		this.reverb.connect(comp);
		this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
		const d = this.noise.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		this.applyVolumes();
		window.setInterval(() => this.schedule(), 60);
		const want = this.theme;
		this.theme = 'none';
		this.setTheme(want);
	}

	setVolumes(master: number, music: number, sfx: number): void {
		this.volumes = { master, music, sfx };
		this.applyVolumes();
	}

	/** Quiet everything while the tab is hidden or the game is paused. */
	duck(on: boolean): void {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.music.gain.setTargetAtTime(on ? this.volumes.music * 0.35 : this.volumes.music * 0.5, t, 0.2);
	}

	suspend(on: boolean): void {
		if (!this.ctx) return;
		if (on) void this.ctx.suspend();
		else void this.ctx.resume();
	}

	private applyVolumes(): void {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
		this.music.gain.setTargetAtTime(this.volumes.music * 0.5, t, 0.05);
		this.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
	}

	private makeImpulse(seconds: number): AudioBuffer {
		const ctx = this.ctx!;
		const len = Math.floor(ctx.sampleRate * seconds);
		const buf = ctx.createBuffer(2, len, ctx.sampleRate);
		for (let c = 0; c < 2; c++) {
			const ch = buf.getChannelData(c);
			for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
		}
		return buf;
	}

	// ---------- Music ----------

	setTheme(theme: Theme): void {
		if (theme === this.theme) return;
		this.theme = theme;
		const ctx = this.ctx;
		if (!ctx) return;
		const t = ctx.currentTime;
		if (this.themeGain) {
			const old = this.themeGain;
			old.gain.cancelScheduledValues(t);
			old.gain.setValueAtTime(old.gain.value, t);
			old.gain.linearRampToValueAtTime(0, t + 1.5);
			setTimeout(() => old.disconnect(), 4000);
		}
		this.themeGain = null;
		if (theme === 'none') return;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(1, t + 2);
		g.connect(this.music);
		this.themeGain = g;
		this.bar = 0;
		this.nextBarTime = t + 0.1;
	}

	private schedule(): void {
		const ctx = this.ctx;
		if (!ctx || !this.themeGain || this.theme === 'none') return;
		const def = THEMES[this.theme];
		const barLen = (60 / def.bpm) * 4;
		while (this.nextBarTime < ctx.currentTime + 0.4) {
			this.playBar(def, this.nextBarTime, barLen, this.themeGain);
			this.nextBarTime += barLen;
			this.bar++;
		}
	}

	private playBar(def: ThemeDef, t: number, len: number, out: GainNode): void {
		const ctx = this.ctx!;
		const chord = def.chords[this.bar % def.chords.length];
		// Pad
		for (const n of chord) this.padNote(midi(def.root + n - 12), t, len, def.padCutoff, out);
		// Bass
		const beat = len / 4;
		const bassNote = midi(def.root + chord[0] - 24);
		if (def.bass === 'bar') this.bassNote(bassNote, t, len * 0.9, out);
		if (def.bass === 'half') {
			this.bassNote(bassNote, t, beat * 1.8, out);
			this.bassNote(bassNote, t + beat * 2, beat * 1.8, out);
		}
		if (def.bass === 'eighth') for (let i = 0; i < 8; i++) this.bassNote(bassNote * (i % 4 === 3 ? 1.5 : 1), t + i * beat * 0.5, beat * 0.4, out, 0.13);
		// Arp: a pattern from the chord, a little random
		const pool = chord.map((n) => n + 12 * def.arpOct);
		for (let i = 0; i < 8; i++) {
			if (this.random() > def.arp) continue;
			const n = pool[Math.floor(this.random() * pool.length)] + (this.random() < 0.2 ? 12 : 0);
			this.bell(midi(def.root + n), t + i * beat * 0.5, def.bell, out, 0.09);
		}
		void ctx;
	}

	private padNote(f: number, t: number, len: number, cutoff: number, out: AudioNode): void {
		const ctx = this.ctx!;
		const g = ctx.createGain();
		const filt = ctx.createBiquadFilter();
		filt.type = 'lowpass';
		filt.frequency.value = cutoff;
		filt.Q.value = 0.4;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(0.045, t + len * 0.35);
		g.gain.linearRampToValueAtTime(0.03, t + len * 0.8);
		g.gain.linearRampToValueAtTime(0, t + len + 0.6);
		filt.connect(g);
		g.connect(out);
		const send = ctx.createGain();
		send.gain.value = 0.5;
		g.connect(send);
		send.connect(this.reverbSend);
		for (const det of [-7, 7]) {
			const o = ctx.createOscillator();
			o.type = 'sawtooth';
			o.frequency.value = f;
			o.detune.value = det;
			o.connect(filt);
			o.start(t);
			o.stop(t + len + 0.7);
		}
	}

	private bassNote(f: number, t: number, len: number, out: AudioNode, vol = 0.16): void {
		const ctx = this.ctx!;
		const o = ctx.createOscillator();
		o.type = 'triangle';
		o.frequency.value = f;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(vol, t + 0.02);
		g.gain.exponentialRampToValueAtTime(0.001, t + len);
		o.connect(g);
		g.connect(out);
		o.start(t);
		o.stop(t + len + 0.05);
	}

	private bell(f: number, t: number, kind: ThemeDef['bell'], out: AudioNode, vol: number): void {
		const ctx = this.ctx!;
		const g = ctx.createGain();
		const dur = kind === 'glass' ? 1.8 : kind === 'warm' ? 0.9 : 1.2;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(vol, t + 0.008);
		g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
		g.connect(out);
		const send = ctx.createGain();
		send.gain.value = kind === 'glass' ? 1.2 : 0.6;
		g.connect(send);
		send.connect(this.reverbSend);
		const o = ctx.createOscillator();
		o.type = kind === 'warm' ? 'triangle' : 'sine';
		o.frequency.value = f;
		o.connect(g);
		o.start(t);
		o.stop(t + dur + 0.05);
		if (kind === 'glass') {
			const o2 = ctx.createOscillator();
			const g2 = ctx.createGain();
			o2.frequency.value = f * 2.76;
			g2.gain.setValueAtTime(vol * 0.35, t);
			g2.gain.exponentialRampToValueAtTime(0.0005, t + dur * 0.4);
			o2.connect(g2);
			g2.connect(g);
			o2.start(t);
			o2.stop(t + dur);
		}
	}

	// ---------- Effects ----------

	private now(): number {
		return this.ctx ? this.ctx.currentTime : 0;
	}

	private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, opts: { delay?: number; reverb?: number; attack?: number } = {}): void {
		const ctx = this.ctx;
		if (!ctx) return;
		const t = this.now() + (opts.delay ?? 0);
		const o = ctx.createOscillator();
		o.type = type;
		o.frequency.setValueAtTime(f0, t);
		o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(vol, t + (opts.attack ?? 0.006));
		g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
		o.connect(g);
		g.connect(this.sfx);
		if (opts.reverb) {
			const s = ctx.createGain();
			s.gain.value = opts.reverb;
			g.connect(s);
			s.connect(this.reverbSend);
		}
		o.start(t);
		o.stop(t + dur + 0.05);
	}

	private noiseBurst(type: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, opts: { delay?: number; attack?: number; q?: number; reverb?: number } = {}): void {
		const ctx = this.ctx;
		if (!ctx) return;
		const t = this.now() + (opts.delay ?? 0);
		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		src.playbackRate.value = 0.8 + Math.random() * 0.4;
		const filt = ctx.createBiquadFilter();
		filt.type = type;
		filt.Q.value = opts.q ?? 0.8;
		filt.frequency.setValueAtTime(f0, t);
		filt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
		const g = ctx.createGain();
		const a = opts.attack ?? 0.005;
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(vol, t + a);
		g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
		src.connect(filt);
		filt.connect(g);
		g.connect(this.sfx);
		if (opts.reverb) {
			const s = ctx.createGain();
			s.gain.value = opts.reverb;
			g.connect(s);
			s.connect(this.reverbSend);
		}
		src.start(t, Math.random() * 1.5);
		src.stop(t + dur + 0.05);
	}

	jump(): void {
		this.tone('sine', 320, 640, 0.16, 0.22);
		this.noiseBurst('highpass', 1800, 3000, 0.08, 0.05);
	}

	land(force: number, surface: Surface): void {
		const v = Math.min(1, force / 14);
		if (v < 0.15) return;
		this.noiseBurst('lowpass', surface === 'ice' ? 1400 : 600, 120, 0.16, 0.25 * v);
		this.tone('sine', 140, 60, 0.12, 0.18 * v);
	}

	step(surface: Surface): void {
		this.stepFlip = !this.stepFlip;
		const f = surface === 'grass' ? 2600 : surface === 'ice' ? 5200 : 1100;
		this.noiseBurst('bandpass', f * (this.stepFlip ? 1 : 1.15), f * 0.7, 0.05, 0.06, { q: 2 });
	}

	collect(combo: number): void {
		const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
		const n = 76 + scale[Math.min(combo, scale.length - 1)];
		this.tone('triangle', midi(n), midi(n), 0.35, 0.18, { reverb: 0.6 });
		this.tone('sine', midi(n + 12), midi(n + 12), 0.5, 0.08, { delay: 0.06, reverb: 0.8 });
	}

	padReady(): void {
		[0, 4, 7, 12].forEach((n, i) => this.tone('triangle', midi(72 + n), midi(72 + n), 0.6, 0.15, { delay: i * 0.09, reverb: 0.8 }));
	}

	denied(): void {
		this.tone('square', 220, 200, 0.12, 0.05);
		this.tone('square', 180, 170, 0.16, 0.05, { delay: 0.1 });
	}

	charge(): void {
		this.tone('sine', 200, 500, 0.7, 0.12, { attack: 0.3 });
	}

	launch(): void {
		this.noiseBurst('bandpass', 300, 3200, 1.6, 0.35, { attack: 0.25, q: 1.2, reverb: 0.5 });
		this.tone('sine', 180, 900, 1.4, 0.15, { attack: 0.2, reverb: 0.5 });
	}

	arrive(): void {
		this.noiseBurst('bandpass', 2600, 300, 1.2, 0.25, { attack: 0.1, q: 1, reverb: 0.4 });
		[0, 7, 12].forEach((n, i) => this.tone('triangle', midi(67 + n), midi(67 + n), 0.8, 0.1, { delay: 0.5 + i * 0.12, reverb: 1 }));
	}

	hurt(): void {
		this.tone('square', 420, 140, 0.3, 0.09);
		this.noiseBurst('lowpass', 900, 200, 0.2, 0.2);
	}

	stomp(): void {
		this.tone('sine', 900, 180, 0.18, 0.25);
		this.noiseBurst('highpass', 3000, 5000, 0.15, 0.12);
		this.tone('triangle', midi(84), midi(84), 0.4, 0.1, { delay: 0.08, reverb: 0.8 });
	}

	bounce(): void {
		const ctx = this.ctx;
		if (!ctx) return;
		const t = this.now();
		const o = ctx.createOscillator();
		o.type = 'sine';
		o.frequency.setValueAtTime(180, t);
		o.frequency.exponentialRampToValueAtTime(760, t + 0.35);
		const lfo = ctx.createOscillator();
		lfo.frequency.value = 18;
		const lg = ctx.createGain();
		lg.gain.value = 40;
		lfo.connect(lg);
		lg.connect(o.frequency);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.25, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
		o.connect(g);
		g.connect(this.sfx);
		o.start(t);
		lfo.start(t);
		o.stop(t + 0.5);
		lfo.stop(t + 0.5);
	}

	rumble(vol: number): void {
		if (vol < 0.02) return;
		this.noiseBurst('lowpass', 160, 90, 1.1, 0.35 * vol, { attack: 0.4 });
	}

	erupt(vol: number): void {
		if (vol < 0.02) return;
		this.noiseBurst('bandpass', 700, 1400, 1.4, 0.3 * vol, { attack: 0.05, q: 0.6 });
		this.tone('sine', 90, 50, 0.6, 0.3 * vol);
	}

	respawn(): void {
		[12, 7, 4, 0].forEach((n, i) => this.tone('sine', midi(60 + n), midi(60 + n), 0.4, 0.1, { delay: i * 0.08, reverb: 0.7 }));
	}

	uiMove(): void {
		this.tone('sine', 900, 900, 0.05, 0.05);
	}

	uiClick(): void {
		this.tone('triangle', 660, 990, 0.09, 0.1);
	}

	/** A shimmer that rolls with the wave of light over a planet. */
	bloom(): void {
		[0, 7, 12, 16, 19, 24, 28].forEach((n, i) => this.tone('sine', midi(67 + n), midi(67 + n), 1.6, 0.06, { delay: 0.25 + i * 0.11, attack: 0.03, reverb: 1.1 }));
		this.noiseBurst('bandpass', 2000, 9000, 2.2, 0.08, { attack: 0.6, q: 0.7, reverb: 1 });
	}

	lighthouse(): void {
		[0, 4, 7, 11, 14, 19, 24].forEach((n, i) => this.tone('triangle', midi(60 + n), midi(60 + n), 2.8, 0.09, { delay: i * 0.14, attack: 0.05, reverb: 1.2 }));
		this.noiseBurst('bandpass', 400, 6000, 2.4, 0.2, { attack: 0.8, q: 0.5, reverb: 1 });
	}
}
