// The parts an instrument body is built from, made with the Web Audio API:
// a tone, a burst of noise, and a plucked string. Each one plays into `out` at `time`.
// They work in a live AudioContext and in an OfflineAudioContext (for pictures of a sound).

const SILENT = 0.0001; // Web Audio cannot ramp to 0, so fades end here
const STOP_AFTER = 0.05; // seconds a part keeps running after its fade, so nothing clicks

// ---- noise ----

const noiseBuffers = new WeakMap();

/** One second of white noise, made once for each audio context. */
function noiseBuffer(ctx) {
	if (noiseBuffers.has(ctx)) return noiseBuffers.get(ctx);
	const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
	const samples = buffer.getChannelData(0);
	for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
	noiseBuffers.set(ctx, buffer);
	return buffer;
}

/** A gain that rises in `attack` seconds to `peak`, then fades out over `decay` seconds. */
function envelope(ctx, time, peak, attack, decay) {
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(SILENT, time);
	gain.gain.exponentialRampToValueAtTime(Math.max(SILENT * 2, peak), time + attack);
	gain.gain.exponentialRampToValueAtTime(SILENT, time + attack + decay);
	return gain;
}

function lowpass(ctx, frequency) {
	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = frequency;
	return filter;
}

/** A slow wave that moves `param` up and down: the wobble of a vibrato or a tremolo. */
function wobble(ctx, param, { rate, amount, time, length }) {
	const wave = ctx.createOscillator();
	wave.frequency.value = rate;
	const depth = ctx.createGain();
	depth.gain.value = amount;
	wave.connect(depth);
	depth.connect(param);
	wave.start(time);
	wave.stop(time + length);
}

// ---- the parts ----

/**
 * One tone.
 * bend: the pitch starts at freq × bend and glides to freq in bendTime seconds.
 * vibrato: { rate, depth } wobbles the pitch (depth in cents).
 * tremolo: { rate, depth } wobbles the volume (depth from 0 to 1).
 * filter: a low-pass filter at this many Hz, for a softer tone.
 */
export function partial(ctx, out, { freq, time, gain, decay, attack = 0.002, type = 'sine', bend = 1, bendTime = 0.02, vibrato, tremolo, filter }) {
	const length = attack + decay + STOP_AFTER;
	const oscillator = ctx.createOscillator();
	oscillator.type = type;
	oscillator.frequency.setValueAtTime(freq * bend, time);
	if (bend !== 1) oscillator.frequency.exponentialRampToValueAtTime(freq, time + bendTime);

	const fade = envelope(ctx, time, gain, attack, decay);
	if (filter) {
		const soften = lowpass(ctx, filter);
		oscillator.connect(soften);
		soften.connect(fade);
	} else {
		oscillator.connect(fade);
	}

	let last = fade;
	if (tremolo) {
		const volume = ctx.createGain();
		volume.gain.value = 1 - tremolo.depth / 2;
		fade.connect(volume);
		wobble(ctx, volume.gain, { rate: tremolo.rate, amount: tremolo.depth / 2, time, length });
		last = volume;
	}
	if (vibrato) {
		const centsToRatio = Math.pow(2, vibrato.depth / 1200) - 1;
		wobble(ctx, oscillator.frequency, { rate: vibrato.rate, amount: freq * centsToRatio, time, length });
	}
	last.connect(out);
	oscillator.start(time);
	oscillator.stop(time + length);
}

/** A short burst of filtered noise: a knock, a breath, a click. */
export function burst(ctx, out, { time, gain, decay, freq = 1000, q = 1, type = 'bandpass', attack = 0.001 }) {
	const source = ctx.createBufferSource();
	source.buffer = noiseBuffer(ctx);
	const filter = ctx.createBiquadFilter();
	filter.type = type;
	filter.frequency.value = freq;
	filter.Q.value = q;
	const fade = envelope(ctx, time, gain, attack, decay);
	source.connect(filter);
	filter.connect(fade);
	fade.connect(out);
	source.start(time, Math.random() * 0.5);
	source.stop(time + attack + decay + STOP_AFTER);
}

// ---- a plucked string ----
// The "Karplus-Strong" method: a burst of noise loops through a short delay and softens each time
// round, like a string that rings and fades.

const PLUCK_TAIL = 0.1; // seconds of silence after the string, so it never cuts off
const strings = new WeakMap();

/** The sound of one plucked string, made once and kept for each audio context. */
function stringBuffer(ctx, freq, decay, bright) {
	if (!strings.has(ctx)) strings.set(ctx, new Map());
	const cache = strings.get(ctx);
	const key = `${Math.round(freq * 10)}:${decay.toFixed(2)}:${bright}`;
	if (cache.has(key)) return cache.get(key);

	const sampleRate = ctx.sampleRate;
	const loopLength = Math.max(2, Math.round(sampleRate / freq)); // one trip round the string
	const totalLength = Math.ceil(sampleRate * (decay + PLUCK_TAIL));
	const buffer = ctx.createBuffer(1, totalLength, sampleRate);
	const samples = buffer.getChannelData(0);
	samples.set(softNoise(loopLength, bright).subarray(0, Math.min(loopLength, totalLength)));

	const lossPerTrip = Math.pow(0.001, 1 / (decay * freq));
	for (let i = loopLength; i < totalLength; i++) {
		samples[i] = lossPerTrip * 0.5 * (samples[i - loopLength] + samples[i - loopLength + 1]);
	}
	cache.set(key, buffer);
	return buffer;
}

/** Noise for the start of a pluck. Each pass of averaging takes off some of the top, for a softer pluck. */
function softNoise(length, bright) {
	const noise = new Float32Array(length);
	for (let i = 0; i < length; i++) noise[i] = Math.random() * 2 - 1;
	for (let pass = 0; pass < 3 - bright; pass++) {
		for (let i = 1; i < length; i++) noise[i] = (noise[i] + noise[i - 1]) / 2;
	}
	return noise;
}

/** A plucked string. bright is 0, 1 or 2 (softer to brighter); tone is a low-pass filter in Hz. */
export function pluck(ctx, out, { freq, time, gain, decay, bright = 1, tone = 4000 }) {
	const source = ctx.createBufferSource();
	source.buffer = stringBuffer(ctx, freq, decay, bright);
	const soften = lowpass(ctx, tone);
	const volume = ctx.createGain();
	volume.gain.value = gain * 1.6;
	source.connect(soften);
	soften.connect(volume);
	volume.connect(out);
	source.start(time);
	source.stop(time + decay + PLUCK_TAIL);
}
