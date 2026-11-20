// Pictures of sound, for the Sound Path and the Feel Lab:
// a live scope (the wave on top, and the spectrum from low notes on the left to high on the right),
// and still shapes of one sound played into a buffer.

import { audio } from './sound-player.js';

const LOW_HZ = 40;
const HIGH_HZ = 12000;
const BANDS = 48;
const BAR_GAP = 2;
const WAVE_POINTS = 512;
const PEAK_FALL = 0.012; // how fast the peak caps fall, each frame

/** Draws the live scope into `canvas` every frame. Colors come from the page's CSS variables. */
export function startScope(canvas) {
	const ctx = canvas.getContext('2d');
	const css = getComputedStyle(document.documentElement);
	const color = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
	const peaks = new Float32Array(BANDS);
	let wave = null;
	let spectrum = null;

	let rect = fitCanvas(canvas, ctx);
	new ResizeObserver(() => (rect = fitCanvas(canvas, ctx))).observe(canvas);

	function frame() {
		const { width, height } = rect;
		ctx.clearRect(0, 0, width, height);
		const ink = color('--ink', '#111111');
		const blockColors = [0, 1, 2, 3, 4].map((i) => color(`--c${i}`, '#888888'));
		const waveHeight = height * 0.5;
		const analyser = audio.analyser;
		if (analyser && (!wave || wave.length !== analyser.fftSize)) {
			wave = new Float32Array(analyser.fftSize);
			spectrum = new Float32Array(analyser.frequencyBinCount);
		}
		if (analyser) {
			analyser.getFloatTimeDomainData(wave);
			analyser.getFloatFrequencyData(spectrum);
		}
		drawWave(ctx, wave, { width, height: waveHeight, ink });
		ctx.fillStyle = ink;
		ctx.fillRect(0, waveHeight, width, 2);
		drawSpectrum(ctx, analyser, spectrum, peaks, { width, top: waveHeight + 8, bottom: height - 2, ink, blockColors });
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
}

/** Sizes the canvas for a sharp picture on this screen. Returns its size in CSS pixels. */
function fitCanvas(canvas, ctx) {
	const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
	const rect = canvas.getBoundingClientRect();
	canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
	canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
	ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	return rect;
}

/** The wave: a thick ink line. Quiet sound is drawn a little bigger, so a soft note still shows. */
function drawWave(ctx, wave, { width, height, ink }) {
	ctx.strokeStyle = ink;
	ctx.lineWidth = 2.5;
	ctx.lineJoin = 'round';
	ctx.beginPath();
	const middle = height / 2;
	let loudest = 0;
	if (wave) for (const sample of wave) loudest = Math.max(loudest, Math.abs(sample));
	const zoom = loudest > 0.0005 ? Math.min(6, 0.9 / loudest) : 1;
	const points = wave ? WAVE_POINTS : 2;
	for (let i = 0; i < points; i++) {
		const value = wave ? wave[i] * zoom : 0;
		const x = (i / (points - 1)) * width;
		const y = middle - value * middle * 0.9;
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.stroke();
}

/** The spectrum: bars from low to high, in the block colors. A small cap stays at each peak for a moment. */
function drawSpectrum(ctx, analyser, spectrum, peaks, { width, top, bottom, ink, blockColors }) {
	const barWidth = (width - BAR_GAP * (BANDS - 1)) / BANDS;
	const room = bottom - top;
	for (let band = 0; band < BANDS; band++) {
		const level = spectrum && analyser ? bandLevel(analyser, spectrum, band) : 0;
		peaks[band] = Math.max(level, peaks[band] - PEAK_FALL);
		const x = band * (barWidth + BAR_GAP);
		const barHeight = level * room;
		ctx.fillStyle = blockColors[Math.floor((band / BANDS) * 5)];
		if (barHeight > 0.5) {
			ctx.fillRect(x, top + room - barHeight, barWidth, barHeight);
			ctx.strokeStyle = ink;
			ctx.lineWidth = 1.5;
			ctx.strokeRect(x + 0.75, top + room - barHeight + 0.75, barWidth - 1.5, barHeight - 1.5);
		}
		if (peaks[band] > 0.02) {
			ctx.fillStyle = ink;
			ctx.fillRect(x, top + room - peaks[band] * room - 2, barWidth, 2);
		}
	}
}

/** How loud one band is, from 0 to 1. The bands are spread evenly over the octaves, like piano keys. */
function bandLevel(analyser, spectrum, band) {
	const lowHz = LOW_HZ * Math.pow(HIGH_HZ / LOW_HZ, band / BANDS);
	const highHz = LOW_HZ * Math.pow(HIGH_HZ / LOW_HZ, (band + 1) / BANDS);
	const hzPerBin = analyser.context.sampleRate / analyser.fftSize;
	let loudestDb = -140;
	for (let bin = Math.floor(lowHz / hzPerBin); bin <= Math.ceil(highHz / hzPerBin) && bin < spectrum.length; bin++) {
		loudestDb = Math.max(loudestDb, spectrum[bin]);
	}
	return Math.max(0, Math.min(1, (loudestDb + 100) / 75));
}

/**
 * A still picture of one sound: plays it in an offline context and returns its shape (see shapeOf).
 * play(ctx, out) plays the sound into `out`.
 */
export async function soundShape(play, { seconds = 1.2, points = 120 } = {}) {
	const OfflineContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
	if (!OfflineContextClass) return null;
	const sampleRate = 22050;
	const ctx = new OfflineContextClass(1, Math.round(sampleRate * seconds), sampleRate);
	play(ctx, ctx.destination);
	return shapeOf(await ctx.startRendering(), points);
}

/** The loudness over time (`levels`: `points` values from 0 to 1) and the average pitch `hz` of a rendered sound. */
export function shapeOf(buffer, points = 120) {
	if (!buffer) return null;
	const samples = buffer.getChannelData(0);
	const step = Math.floor(samples.length / points);
	const levels = [];
	let loudest = 0;
	for (let point = 0; point < points; point++) {
		let peak = 0;
		for (let i = point * step; i < (point + 1) * step; i++) peak = Math.max(peak, Math.abs(samples[i]));
		levels.push(peak);
		loudest = Math.max(loudest, peak);
	}
	return { levels: levels.map((level) => (loudest ? level / loudest : 0)), hz: averagePitch(samples, buffer.sampleRate) };
}

/** The average pitch: how fast the wave changes, against how big it is. Higher is brighter. */
function averagePitch(samples, sampleRate) {
	let power = 0;
	let change = 0;
	for (let i = 1; i < samples.length; i++) {
		power += samples[i] * samples[i];
		const difference = samples[i] - samples[i - 1];
		change += difference * difference;
	}
	return power ? (Math.sqrt(change / power) * sampleRate) / (2 * Math.PI) : 0;
}

/** Draws a still shape: a filled mirror of the loudness, with an ink outline. */
export function drawShape(canvas, shape, fill) {
	const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
	const width = canvas.clientWidth || 200;
	const height = canvas.clientHeight || 48;
	canvas.width = Math.round(width * pixelRatio);
	canvas.height = Math.round(height * pixelRatio);
	const ctx = canvas.getContext('2d');
	ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#111111';
	const middle = height / 2;
	const count = shape.levels.length;
	const xAt = (i) => (i / (count - 1)) * width;
	ctx.beginPath();
	shape.levels.forEach((level, i) => ctx.lineTo(xAt(i), middle - level * (middle - 3)));
	for (let i = count - 1; i >= 0; i--) ctx.lineTo(xAt(i), middle + shape.levels[i] * (middle - 3));
	ctx.closePath();
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.strokeStyle = ink;
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.fillRect(0, middle - 1, width, 2);
}
