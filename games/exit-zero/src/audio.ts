import type * as THREE from 'three';

// All sound is made here with Web Audio nodes: oscillators, filtered noise, envelopes and a reverb.
// Kept soft: low gains, filters on every source, notes from pentatonic and seventh chords.

type Track = 'title' | 'halls' | 'maint' | 'exit' | 'none';
type StepKind = 'carpet' | 'concrete' | 'metal' | 'water';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface TrackDef {
	bpm: number;
	/** Chords as MIDI notes, one per bar. */
	chords: number[][];
	style: 'pad' | 'muzak' | 'drone';
	/** Notes for the bell melody. */
	bells: number[];
	bellChance: number;
	gain: number;
	cutoff: number;
}

const TRACKS: Record<Exclude<Track, 'none'>, TrackDef> = {
	title: {
		bpm: 66,
		chords: [[45, 52, 55, 59, 60], [41, 48, 52, 57], [43, 50, 55, 59], [40, 47, 52, 55]],
		style: 'pad',
		bells: [69, 72, 74, 76, 79, 81],
		bellChance: 0.35,
		gain: 0.5,
		cutoff: 1100,
	},
	halls: {
		bpm: 88,
		chords: [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 49, 52, 55]],
		style: 'muzak',
		bells: [66, 69, 71, 73, 76],
		bellChance: 0.25,
		gain: 0.55,
		cutoff: 650,
	},
	maint: {
		bpm: 60,
		chords: [[33, 40, 45], [33, 40, 45], [29, 36, 41], [31, 38, 43]],
		style: 'drone',
		bells: [81, 84, 86, 88],
		bellChance: 0.12,
		gain: 0.6,
		cutoff: 420,
	},
	exit: {
		bpm: 60,
		chords: [[48, 55, 59, 62, 64], [53, 57, 60, 64], [48, 55, 59, 62, 64], [55, 59, 62, 66]],
		style: 'pad',
		bells: [72, 74, 76, 79, 81, 84],
		bellChance: 0.4,
		gain: 0.45,
		cutoff: 1500,
	},
};

interface Loop {
	out: GainNode;
	panner: PannerNode | null;
	stop: () => void;
	level: number;
}

export class Audio {
	ctx: AudioContext | null = null;
	private master!: GainNode;
	private musicBus!: GainNode;
	private musicVerb!: GainNode;
	private sfxBus!: GainNode;
	private ambBus!: GainNode;
	private reverb!: ConvolverNode;
	private reverbIn!: GainNode;
	private noise!: AudioBuffer;
	private humGain!: GainNode;
	private buzzGain!: GainNode;
	private loops = new Map<string, Loop>();
	private track: Track = 'none';
	/** Asked for before the audio could start. */
	private pending: { track: Track; hum: number; drips: number; knocks: boolean } = { track: 'none', hum: 0, drips: 1, knocks: false };
	private trackGain: GainNode | null = null;
	private nextBar = 0;
	private bar = 0;
	private dripIn = 2;
	private knockIn = 8;
	private dripRate = 1;
	private knocks = false;
	volumes = { master: 0.8, music: 0.6, sfx: 0.8 };

	/** Call from a user gesture. */
	start(): void {
		if (this.ctx) {
			void this.ctx.resume();
			return;
		}
		const ctx = new AudioContext();
		this.ctx = ctx;
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -14;
		comp.ratio.value = 3;
		this.master = ctx.createGain();
		this.master.connect(comp).connect(ctx.destination);
		this.musicBus = ctx.createGain();
		this.sfxBus = ctx.createGain();
		this.ambBus = ctx.createGain();
		this.musicBus.connect(this.master);
		this.sfxBus.connect(this.master);
		this.ambBus.connect(this.master);

		// white noise, shared by every noisy sound
		this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
		const d = this.noise.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

		// a long, dark room reverb
		const len = ctx.sampleRate * 2.8;
		const ir = ctx.createBuffer(2, len, ctx.sampleRate);
		for (let c = 0; c < 2; c++) {
			const ch = ir.getChannelData(c);
			for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
		}
		this.reverb = ctx.createConvolver();
		this.reverb.buffer = ir;
		this.reverbIn = ctx.createGain();
		const tone = ctx.createBiquadFilter();
		tone.type = 'lowpass';
		tone.frequency.value = 2600;
		const wet = ctx.createGain();
		wet.gain.value = 0.5;
		this.reverbIn.connect(tone).connect(this.reverb).connect(wet).connect(this.master);
		this.musicVerb = ctx.createGain();
		this.musicVerb.gain.value = 0.5;
		this.musicBus.connect(this.musicVerb).connect(this.reverbIn);

		this.startHum();
		this.applyVolumes();
		this.setAmbience(this.pending.hum, this.pending.drips, this.pending.knocks);
		this.setMusic(this.pending.track);
	}

	applyVolumes(): void {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
		this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.5, t, 0.05);
		this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
		this.ambBus.gain.setTargetAtTime(this.volumes.sfx * 0.9, t, 0.05);
	}

	/** Fades everything to silence, or back. */
	silence(on: boolean, time = 1.5): void {
		if (!this.ctx) return;
		this.master.gain.setTargetAtTime(on ? 0 : this.volumes.master, this.ctx.currentTime, time / 3);
	}

	setListener(pos: THREE.Vector3, fwd: THREE.Vector3): void {
		if (!this.ctx) return;
		const l = this.ctx.listener;
		const t = this.ctx.currentTime;
		if (l.positionX) {
			l.positionX.setTargetAtTime(pos.x, t, 0.02);
			l.positionY.setTargetAtTime(pos.y, t, 0.02);
			l.positionZ.setTargetAtTime(pos.z, t, 0.02);
			l.forwardX.setTargetAtTime(fwd.x, t, 0.02);
			l.forwardY.setTargetAtTime(fwd.y, t, 0.02);
			l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
			l.upX.value = 0;
			l.upY.value = 1;
			l.upZ.value = 0;
		} else {
			l.setPosition(pos.x, pos.y, pos.z);
			l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
		}
	}

	/** The level of the fluorescent hum and how often water drips. */
	setAmbience(hum: number, drips: number, knocks: boolean): void {
		this.pending.hum = hum;
		this.pending.drips = drips;
		this.pending.knocks = knocks;
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.humGain.gain.setTargetAtTime(hum * 0.05, t, 0.6);
		this.buzzGain.gain.setTargetAtTime(hum * 0.006, t, 0.6);
		this.dripRate = drips;
		this.knocks = knocks;
	}

	// --- building blocks ---

	private out(at?: THREE.Vector3, bus: AudioNode = this.sfxBus): { node: AudioNode; panner: PannerNode | null } {
		if (!at) return { node: bus, panner: null };
		const p = this.ctx!.createPanner();
		p.panningModel = 'equalpower';
		p.distanceModel = 'inverse';
		p.refDistance = 2;
		p.rolloffFactor = 1.3;
		p.maxDistance = 60;
		p.positionX.value = at.x;
		p.positionY.value = at.y;
		p.positionZ.value = at.z;
		p.connect(bus);
		return { node: p, panner: p };
	}

	private env(g: GainNode, t: number, attack: number, peak: number, decay: number): void {
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
		g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
	}

	private tone(o: {
		freq: number; type?: OscillatorType; t?: number; attack?: number; decay: number; peak: number;
		to?: AudioNode; glide?: number; cutoff?: number; verb?: number; detune?: number;
	}): void {
		const ctx = this.ctx!;
		const t = o.t ?? ctx.currentTime;
		const osc = ctx.createOscillator();
		osc.type = o.type ?? 'sine';
		osc.frequency.setValueAtTime(o.freq, t);
		if (o.detune) osc.detune.value = o.detune;
		if (o.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq * o.glide), t + (o.attack ?? 0.005) + o.decay);
		const g = ctx.createGain();
		this.env(g, t, o.attack ?? 0.005, o.peak, o.decay);
		let src: AudioNode = osc;
		if (o.cutoff) {
			const f = ctx.createBiquadFilter();
			f.type = 'lowpass';
			f.frequency.value = o.cutoff;
			osc.connect(f);
			src = f;
		}
		src.connect(g).connect(o.to ?? this.sfxBus);
		if (o.verb) {
			const s = ctx.createGain();
			s.gain.value = o.verb;
			g.connect(s).connect(this.reverbIn);
		}
		osc.start(t);
		osc.stop(t + (o.attack ?? 0.005) + o.decay + 0.05);
	}

	private hiss(o: {
		t?: number; attack?: number; decay: number; peak: number; type?: BiquadFilterType; freq: number; q?: number;
		to?: AudioNode; freqTo?: number; verb?: number; rate?: number;
	}): void {
		const ctx = this.ctx!;
		const t = o.t ?? ctx.currentTime;
		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		src.playbackRate.value = o.rate ?? 1;
		const f = ctx.createBiquadFilter();
		f.type = o.type ?? 'bandpass';
		f.frequency.setValueAtTime(o.freq, t);
		if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + (o.attack ?? 0.005) + o.decay);
		f.Q.value = o.q ?? 1;
		const g = ctx.createGain();
		this.env(g, t, o.attack ?? 0.005, o.peak, o.decay);
		src.connect(f).connect(g).connect(o.to ?? this.sfxBus);
		if (o.verb) {
			const s = ctx.createGain();
			s.gain.value = o.verb;
			g.connect(s).connect(this.reverbIn);
		}
		src.start(t, Math.random() * 1.5);
		src.stop(t + (o.attack ?? 0.005) + o.decay + 0.05);
	}

	private startHum(): void {
		const ctx = this.ctx!;
		this.humGain = ctx.createGain();
		this.humGain.gain.value = 0;
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = 320;
		lp.Q.value = 2;
		const saw = ctx.createOscillator();
		saw.type = 'sawtooth';
		saw.frequency.value = 120;
		const sine = ctx.createOscillator();
		sine.frequency.value = 60;
		const sineG = ctx.createGain();
		sineG.gain.value = 0.8;
		saw.connect(lp);
		sine.connect(sineG).connect(lp);
		// a slow wobble, like a tired ballast
		const lfo = ctx.createOscillator();
		lfo.frequency.value = 0.23;
		const lfoG = ctx.createGain();
		lfoG.gain.value = 60;
		lfo.connect(lfoG).connect(lp.frequency);
		lp.connect(this.humGain).connect(this.ambBus);
		this.buzzGain = ctx.createGain();
		this.buzzGain.gain.value = 0;
		const n = ctx.createBufferSource();
		n.buffer = this.noise;
		n.loop = true;
		const bp = ctx.createBiquadFilter();
		bp.type = 'bandpass';
		bp.frequency.value = 7200;
		bp.Q.value = 3;
		n.connect(bp).connect(this.buzzGain).connect(this.ambBus);
		for (const o of [saw, sine, lfo]) o.start();
		n.start();
	}

	// --- one-shot sounds ---

	play(id: string, at?: THREE.Vector3): void {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		const { node } = this.out(at);
		switch (id) {
			case 'pickup':
				this.tone({ freq: midi(76), decay: 0.7, peak: 0.12, verb: 0.4 });
				this.tone({ freq: midi(88), type: 'triangle', decay: 0.4, peak: 0.03 });
				this.tone({ freq: midi(83), t: t + 0.09, decay: 0.9, peak: 0.1, verb: 0.5 });
				break;
			case 'paper':
				this.hiss({ decay: 0.12, peak: 0.08, freq: 2600, q: 0.8, attack: 0.02 });
				this.hiss({ t: t + 0.14, decay: 0.1, peak: 0.06, freq: 3400, q: 0.8, attack: 0.02 });
				break;
			case 'doorOpen':
				this.tone({ freq: 95, type: 'sawtooth', attack: 0.1, decay: 0.7, peak: 0.05, glide: 0.75, cutoff: 500, to: node, verb: 0.3 });
				this.hiss({ t: t + 0.6, decay: 0.25, peak: 0.12, type: 'lowpass', freq: 240, to: node, verb: 0.4 });
				break;
			case 'locked':
				for (let i = 0; i < 3; i++) this.hiss({ t: t + i * 0.07, decay: 0.05, peak: 0.12, freq: 1500, q: 3, to: node });
				this.tone({ freq: 70, t, decay: 0.2, peak: 0.12, to: node });
				break;
			case 'unlock':
				this.hiss({ decay: 0.03, peak: 0.15, type: 'highpass', freq: 3000 });
				this.tone({ freq: 1760, t: t + 0.05, decay: 0.25, peak: 0.05, verb: 0.3 });
				this.tone({ freq: 2637, t: t + 0.05, decay: 0.15, peak: 0.02 });
				break;
			case 'breaker':
				this.hiss({ decay: 0.05, peak: 0.35, freq: 1200, q: 1.2, to: node, verb: 0.5 });
				this.tone({ freq: 85, decay: 0.18, peak: 0.25, glide: 0.6, to: node });
				break;
			case 'ratchet':
				for (let i = 0; i < 9; i++) this.hiss({ t: t + i * 0.13, decay: 0.03, peak: 0.12, type: 'highpass', freq: 2500, to: node });
				break;
			case 'click':
				this.hiss({ decay: 0.03, peak: 0.2, freq: 2000, q: 2, to: node });
				this.tone({ freq: 400, decay: 0.06, peak: 0.08, to: node });
				break;
			case 'powerUp': {
				this.tone({ freq: 55, type: 'sawtooth', attack: 1.2, decay: 1.6, peak: 0.12, glide: 2, cutoff: 900, verb: 0.4 });
				[45, 52, 57, 64].forEach((n, i) => this.tone({ freq: midi(n), t: t + 1 + i * 0.12, attack: 0.3, decay: 2.5, peak: 0.05, verb: 0.6 }));
				break;
			}
			case 'zap':
				this.hiss({ decay: 0.6, peak: 0.25, type: 'highpass', freq: 1800, verb: 0.3 });
				this.tone({ freq: 120, type: 'square', decay: 0.6, peak: 0.05, cutoff: 600 });
				break;
			case 'spark':
				this.hiss({ decay: 0.12, peak: 0.06, type: 'highpass', freq: 3500, to: node });
				break;
			case 'gate':
				this.tone({ freq: 140, type: 'sawtooth', attack: 0.5, decay: 3.5, peak: 0.06, glide: 1.5, cutoff: 800, to: node, verb: 0.4 });
				for (let i = 0; i < 18; i++) this.hiss({ t: t + 0.4 + i * 0.18, decay: 0.08, peak: 0.05, freq: 900, q: 4, to: node });
				break;
			case 'alarm':
				for (let i = 0; i < 6; i++) {
					this.tone({ freq: i % 2 ? 349 : 440, type: 'square', t: t + i * 0.55, attack: 0.04, decay: 0.48, peak: 0.07, cutoff: 1300, verb: 0.6 });
				}
				break;
			case 'sting':
				[110, 116.5, 164.8, 233].forEach((f, i) => this.tone({ freq: f, type: 'sawtooth', attack: 0.25, decay: 1.8, peak: 0.07 - i * 0.01, cutoff: 1400, verb: 0.7 }));
				this.tone({ freq: 1760, attack: 0.1, decay: 1.2, peak: 0.03, glide: 0.94, verb: 0.8 });
				break;
			case 'alert':
				[110, 116.5].forEach((f) => this.tone({ freq: f, type: 'sawtooth', attack: 0.1, decay: 0.8, peak: 0.06, cutoff: 1000, verb: 0.6 }));
				break;
			case 'creatureStep':
				this.tone({ freq: 60, decay: 0.15, peak: 0.25, glide: 0.7, to: node });
				this.hiss({ decay: 0.04, peak: 0.08, type: 'lowpass', freq: 400, to: node });
				break;
			case 'death':
				this.tone({ freq: 110, attack: 0.02, decay: 2.4, peak: 0.25, glide: 0.35, verb: 0.6 });
				this.hiss({ attack: 0.05, decay: 1.8, peak: 0.18, type: 'lowpass', freq: 3000, freqTo: 120, verb: 0.5 });
				[57, 58, 63].forEach((n) => this.tone({ freq: midi(n), type: 'triangle', attack: 0.02, decay: 2, peak: 0.04, verb: 0.8 }));
				break;
			case 'shock':
				this.hiss({ decay: 0.8, peak: 0.3, type: 'highpass', freq: 1200 });
				this.tone({ freq: 120, type: 'square', decay: 0.8, peak: 0.1, cutoff: 900 });
				break;
			case 'keyBeep':
				this.tone({ freq: 1046, decay: 0.06, peak: 0.06 });
				break;
			case 'keyErr':
				this.tone({ freq: 220, type: 'square', decay: 0.12, peak: 0.05, cutoff: 800 });
				this.tone({ freq: 196, type: 'square', t: t + 0.15, decay: 0.18, peak: 0.05, cutoff: 800 });
				break;
			case 'keyOk':
				[84, 88, 91].forEach((n, i) => this.tone({ freq: midi(n), t: t + i * 0.08, decay: 0.3, peak: 0.05, verb: 0.3 }));
				break;
			case 'lockerOpen':
				this.hiss({ decay: 0.04, peak: 0.2, freq: 1800, q: 2, to: node });
				this.tone({ freq: 180, type: 'triangle', attack: 0.05, decay: 0.5, peak: 0.06, glide: 0.8, to: node, verb: 0.3 });
				break;
			case 'flashlight':
				this.hiss({ decay: 0.02, peak: 0.12, freq: 3000, q: 3 });
				break;
			case 'ui':
				this.tone({ freq: 880, decay: 0.04, peak: 0.03 });
				break;
			case 'uiOk':
				this.tone({ freq: 660, decay: 0.12, peak: 0.04, glide: 1.5 });
				break;
			case 'save':
				[76, 83].forEach((n, i) => this.tone({ freq: midi(n), t: t + i * 0.1, decay: 0.5, peak: 0.04, verb: 0.4 }));
				break;
			case 'ending':
				[48, 55, 59, 62, 64, 71].forEach((n, i) => this.tone({ freq: midi(n), t: t + i * 0.25, attack: 0.6, decay: 5, peak: 0.05, verb: 0.8 }));
				break;
		}
	}

	step(kind: StepKind, loud: boolean): void {
		if (!this.ctx) return;
		const v = loud ? 1.6 : 1;
		const pitch = 0.85 + Math.random() * 0.3;
		switch (kind) {
			case 'carpet':
				this.hiss({ decay: 0.09, peak: 0.06 * v, type: 'lowpass', freq: 420 * pitch, attack: 0.01 });
				break;
			case 'concrete':
				this.hiss({ decay: 0.07, peak: 0.07 * v, freq: 900 * pitch, q: 1.2, verb: 0.25 });
				this.tone({ freq: 110 * pitch, decay: 0.06, peak: 0.05 * v });
				break;
			case 'metal':
				this.hiss({ decay: 0.06, peak: 0.06 * v, freq: 2200 * pitch, q: 3, verb: 0.3 });
				this.tone({ freq: 340 * pitch, type: 'triangle', decay: 0.18, peak: 0.02 * v, verb: 0.3 });
				break;
			case 'water':
				this.hiss({ attack: 0.02, decay: 0.22, peak: 0.08 * v, freq: 1400 * pitch, freqTo: 380, q: 1.5, verb: 0.3 });
				this.hiss({ t: this.ctx.currentTime + 0.05, decay: 0.16, peak: 0.04 * v, freq: 2600 * pitch, q: 2 });
				break;
		}
	}

	// --- loops: live water and the creature ---

	loop(id: string, on: boolean, at?: THREE.Vector3, level = 1): void {
		if (!this.ctx) return;
		let l = this.loops.get(id);
		if (!on) {
			if (l) {
				l.stop();
				this.loops.delete(id);
			}
			return;
		}
		if (!l) {
			const made = this.makeLoop(id, at);
			if (!made) return;
			l = made;
			this.loops.set(id, l);
		}
		if (at && l.panner) {
			const t = this.ctx.currentTime;
			l.panner.positionX.setTargetAtTime(at.x, t, 0.05);
			l.panner.positionY.setTargetAtTime(at.y, t, 0.05);
			l.panner.positionZ.setTargetAtTime(at.z, t, 0.05);
		}
		if (Math.abs(level - l.level) > 0.01) {
			l.level = level;
			l.out.gain.setTargetAtTime(level, this.ctx.currentTime, 0.3);
		}
	}

	stopLoops(): void {
		for (const l of this.loops.values()) l.stop();
		this.loops.clear();
	}

	private makeLoop(id: string, at?: THREE.Vector3): Loop | null {
		const ctx = this.ctx!;
		const { node, panner } = this.out(at);
		const out = ctx.createGain();
		out.gain.value = 0;
		out.gain.setTargetAtTime(1, ctx.currentTime, 0.2);
		out.connect(node);
		const nodes: AudioScheduledSourceNode[] = [];
		if (id === 'crackle') {
			const n = ctx.createBufferSource();
			n.buffer = this.noise;
			n.loop = true;
			const hp = ctx.createBiquadFilter();
			hp.type = 'highpass';
			hp.frequency.value = 2000;
			const am = ctx.createGain();
			am.gain.value = 0;
			const lfo = ctx.createOscillator();
			lfo.type = 'square';
			lfo.frequency.value = 17;
			const lfo2 = ctx.createOscillator();
			lfo2.frequency.value = 3.3;
			const lg = ctx.createGain();
			lg.gain.value = 0.1;
			lfo.connect(lg).connect(am.gain);
			const lg2 = ctx.createGain();
			lg2.gain.value = 0.08;
			lfo2.connect(lg2).connect(am.gain);
			n.connect(hp).connect(am).connect(out);
			const buzz = ctx.createOscillator();
			buzz.type = 'sawtooth';
			buzz.frequency.value = 120;
			const bl = ctx.createBiquadFilter();
			bl.type = 'lowpass';
			bl.frequency.value = 500;
			const bg = ctx.createGain();
			bg.gain.value = 0.06;
			buzz.connect(bl).connect(bg).connect(out);
			nodes.push(n, lfo, lfo2, buzz);
		} else if (id === 'creature') {
			const lp = ctx.createBiquadFilter();
			lp.type = 'lowpass';
			lp.frequency.value = 700;
			const g = ctx.createGain();
			g.gain.value = 0.05;
			for (const [f, det] of [[55, -6], [82.4, 5], [120, 0]] as const) {
				const o = ctx.createOscillator();
				o.type = f === 120 ? 'sawtooth' : 'triangle';
				o.frequency.value = f;
				o.detune.value = det;
				o.connect(lp);
				nodes.push(o);
			}
			const trem = ctx.createOscillator();
			trem.frequency.value = 0.7;
			const tg = ctx.createGain();
			tg.gain.value = 0.02;
			trem.connect(tg).connect(g.gain);
			nodes.push(trem);
			lp.connect(g).connect(out);
		} else return null;
		for (const n of nodes) n.start();
		return {
			out,
			panner,
			level: 1,
			stop: () => {
				const t = ctx.currentTime;
				out.gain.setTargetAtTime(0, t, 0.1);
				for (const n of nodes) n.stop(t + 0.5);
			},
		};
	}

	// --- music ---

	setMusic(track: Track): void {
		this.pending.track = track;
		if (!this.ctx || track === this.track) return;
		this.track = track;
		const t = this.ctx.currentTime;
		if (this.trackGain) {
			const old = this.trackGain;
			old.gain.setTargetAtTime(0, t, 0.8);
			setTimeout(() => old.disconnect(), 4000);
		}
		this.trackGain = null;
		if (track === 'none') return;
		const g = this.ctx.createGain();
		g.gain.value = 0;
		g.gain.setTargetAtTime(TRACKS[track].gain, t + 0.5, 1.2);
		g.connect(this.musicBus);
		this.musicVerb.gain.setTargetAtTime(TRACKS[track].style === 'muzak' ? 1.1 : 0.6, t, 0.5);
		this.trackGain = g;
		this.nextBar = t + 0.6;
		this.bar = 0;
	}

	update(dt: number): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		// drips and pipe knocks
		this.dripIn -= dt * this.dripRate;
		if (this.dripIn <= 0) {
			this.dripIn = 1.5 + Math.random() * 4;
			const pan = this.ctx.createStereoPanner();
			pan.pan.value = Math.random() * 1.6 - 0.8;
			pan.connect(this.ambBus);
			const notes = [81, 84, 86, 88, 91];
			const f = midi(notes[(Math.random() * notes.length) | 0]);
			this.tone({ freq: f, decay: 0.22, peak: 0.035, glide: 0.62, to: pan, verb: 0.9 });
		}
		if (this.knocks) {
			this.knockIn -= dt;
			if (this.knockIn <= 0) {
				this.knockIn = 7 + Math.random() * 12;
				const count = 1 + ((Math.random() * 3) | 0);
				for (let i = 0; i < count; i++) this.tone({ freq: 52 + Math.random() * 10, t: now + i * 0.22, decay: 0.3, peak: 0.12, glide: 0.8, to: this.ambBus, verb: 0.8 });
			}
		}
		if (!this.trackGain || this.track === 'none') return;
		const def = TRACKS[this.track];
		const barLen = (60 / def.bpm) * 4;
		while (this.nextBar < now + 0.3) {
			this.scheduleBar(def, this.nextBar, barLen, this.trackGain);
			this.nextBar += barLen;
			this.bar++;
		}
	}

	private scheduleBar(def: TrackDef, t: number, len: number, to: GainNode): void {
		const ctx = this.ctx!;
		const chord = def.chords[this.bar % def.chords.length];
		const beat = len / 4;
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = def.cutoff;
		lp.connect(to);
		setTimeout(() => lp.disconnect(), (t - ctx.currentTime + len * 2 + 4) * 1000);

		if (def.style === 'pad' || def.style === 'drone') {
			for (const n of chord) {
				for (const det of [-7, 7]) {
					this.tone({ freq: midi(n), type: def.style === 'drone' ? 'triangle' : 'sawtooth', t, attack: len * 0.45, decay: len * 0.9, peak: def.style === 'drone' ? 0.05 : 0.018, to: lp, detune: det });
				}
			}
		}
		if (def.style === 'drone') {
			this.tone({ freq: midi(chord[0] - 12), t, attack: len * 0.5, decay: len, peak: 0.06, to: lp });
		}
		if (def.style === 'muzak') {
			// electric piano comping and a walking bass, heard through a wall
			for (const at of [0, 1.5, 2.5]) {
				for (const n of chord) {
					this.tone({ freq: midi(n + 12), t: t + at * beat, decay: beat * 1.4, peak: 0.022, to: lp });
					this.tone({ freq: midi(n + 24), t: t + at * beat, decay: beat * 0.5, peak: 0.006, to: lp });
				}
			}
			const root = chord[0] - 12;
			[0, 7, 12, 7].forEach((iv, i) => this.tone({ freq: midi(root + iv), type: 'triangle', t: t + i * beat, decay: beat * 0.9, peak: 0.06, to: lp }));
			// a brushed shaker, very soft
			for (let i = 0; i < 8; i++) this.hiss({ t: t + i * beat * 0.5, decay: 0.05, peak: i % 2 ? 0.006 : 0.012, type: 'highpass', freq: 6000, to: lp });
		}
		// a few bell notes on top
		for (let i = 0; i < 4; i++) {
			if (Math.random() > def.bellChance) continue;
			const n = def.bells[(Math.random() * def.bells.length) | 0];
			const bt = t + i * beat + (Math.random() < 0.3 ? beat / 2 : 0);
			const bellTo = def.style === 'muzak' ? lp : to;
			this.tone({ freq: midi(n), t: bt, decay: 1.6, peak: 0.025, to: bellTo });
			this.tone({ freq: midi(n) * 2.76, t: bt, decay: 0.4, peak: 0.004, to: bellTo });
		}
	}
}
