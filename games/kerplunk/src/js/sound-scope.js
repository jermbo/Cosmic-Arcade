// A live picture of the sound: the wave on top, and the spectrum (low notes left, high right) below.
// It reads the analyser of audio.js. The Sound Path and the Feel Lab use it.

import { audio } from './audio.js';

const LOW_HZ = 40;
const HIGH_HZ = 12000;
const BANDS = 48;

/** Draws into `canvas` every frame. Colors come from the page's CSS variables. */
export function startScope(canvas) {
	const ctx = canvas.getContext('2d');
	const css = getComputedStyle(document.documentElement);
	const color = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
	let wave = null;
	let freq = null;
	const peaks = new Float32Array(BANDS);

	function size() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const r = canvas.getBoundingClientRect();
		canvas.width = Math.max(1, Math.round(r.width * dpr));
		canvas.height = Math.max(1, Math.round(r.height * dpr));
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		return r;
	}
	let rect = size();
	new ResizeObserver(() => (rect = size())).observe(canvas);

	function frame() {
		const { width: w, height: h } = rect;
		ctx.clearRect(0, 0, w, h);
		const ink = color('--ink', '#111111');
		const blocks = [0, 1, 2, 3, 4].map((i) => color(`--c${i}`, '#888888'));
		const waveH = h * 0.5;
		const an = audio.analyser;
		if (an && (!wave || wave.length !== an.fftSize)) {
			wave = new Float32Array(an.fftSize);
			freq = new Float32Array(an.frequencyBinCount);
		}
		if (an) {
			an.getFloatTimeDomainData(wave);
			an.getFloatFrequencyData(freq);
		}

		// The wave: a thick ink line. Quiet sound is drawn a little bigger, so a soft note still shows.
		ctx.strokeStyle = ink;
		ctx.lineWidth = 2.5;
		ctx.lineJoin = 'round';
		ctx.beginPath();
		const mid = waveH / 2;
		let loud = 0;
		if (wave) for (let i = 0; i < wave.length; i++) loud = Math.max(loud, Math.abs(wave[i]));
		const zoom = loud > 0.0005 ? Math.min(6, 0.9 / loud) : 1;
		const n = wave ? 512 : 2;
		for (let i = 0; i < n; i++) {
			const v = wave ? wave[i] * zoom : 0;
			const x = (i / (n - 1)) * w;
			const y = mid - v * mid * 0.9;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();

		// The divider.
		ctx.fillStyle = ink;
		ctx.fillRect(0, waveH, w, 2);

		// The spectrum: bars from low to high, in the block colors. A small cap stays at each peak for a moment.
		const gap = 2;
		const bw = (w - gap * (BANDS - 1)) / BANDS;
		const top = waveH + 8;
		const room = h - top - 2;
		for (let b = 0; b < BANDS; b++) {
			let level = 0;
			if (freq && an) {
				const lo = LOW_HZ * Math.pow(HIGH_HZ / LOW_HZ, b / BANDS);
				const hi = LOW_HZ * Math.pow(HIGH_HZ / LOW_HZ, (b + 1) / BANDS);
				const hz = an.context.sampleRate / an.fftSize;
				let db = -140;
				for (let i = Math.floor(lo / hz); i <= Math.ceil(hi / hz) && i < freq.length; i++) db = Math.max(db, freq[i]);
				level = Math.max(0, Math.min(1, (db + 100) / 75));
			}
			peaks[b] = Math.max(level, peaks[b] - 0.012);
			const x = b * (bw + gap);
			const bh = level * room;
			ctx.fillStyle = blocks[Math.floor((b / BANDS) * 5)];
			if (bh > 0.5) {
				ctx.fillRect(x, top + room - bh, bw, bh);
				ctx.strokeStyle = ink;
				ctx.lineWidth = 1.5;
				ctx.strokeRect(x + 0.75, top + room - bh + 0.75, bw - 1.5, bh - 1.5);
			}
			if (peaks[b] > 0.02) {
				ctx.fillStyle = ink;
				ctx.fillRect(x, top + room - peaks[b] * room - 2, bw, 2);
			}
		}
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
}

/**
 * A still picture of one sound: plays it in an offline context and returns the loudness over time
 * as `points` values from 0 to 1, and `hz`: the average pitch of all its parts (higher is brighter).
 */
export async function soundShape(play, { seconds = 1.2, points = 120 } = {}) {
	const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
	if (!OAC) return null;
	const rate = 22050;
	const ctx = new OAC(1, Math.round(rate * seconds), rate);
	play(ctx, ctx.destination);
	return shapeOf(await ctx.startRendering(), points);
}

/** The loudness over time (`points` values from 0 to 1) and the average pitch `hz` of a rendered sound. */
export function shapeOf(buf, points = 120) {
	if (!buf) return null;
	const rate = buf.sampleRate;
	const data = buf.getChannelData(0);
	const step = Math.floor(data.length / points);
	const out = [];
	let max = 0;
	for (let p = 0; p < points; p++) {
		let peak = 0;
		for (let i = p * step; i < (p + 1) * step; i++) peak = Math.max(peak, Math.abs(data[i]));
		out.push(peak);
		max = Math.max(max, peak);
	}
	// The average pitch: how fast the wave changes, against how big it is.
	let power = 0;
	let change = 0;
	for (let i = 1; i < data.length; i++) {
		power += data[i] * data[i];
		const d = data[i] - data[i - 1];
		change += d * d;
	}
	const hz = power ? (Math.sqrt(change / power) * rate) / (2 * Math.PI) : 0;
	return { levels: out.map((v) => (max ? v / max : 0)), hz };
}

/** Draws a still shape: a filled mirror of the loudness, with an ink outline. */
export function drawShape(canvas, shape, fill) {
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const w = canvas.clientWidth || 200;
	const h = canvas.clientHeight || 48;
	canvas.width = Math.round(w * dpr);
	canvas.height = Math.round(h * dpr);
	const ctx = canvas.getContext('2d');
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#111111';
	const mid = h / 2;
	const n = shape.levels.length;
	ctx.beginPath();
	shape.levels.forEach((v, i) => ctx.lineTo((i / (n - 1)) * w, mid - v * (mid - 3)));
	for (let i = n - 1; i >= 0; i--) ctx.lineTo((i / (n - 1)) * w, mid + shape.levels[i] * (mid - 3));
	ctx.closePath();
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.strokeStyle = ink;
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.fillRect(0, mid - 1, w, 2);
}
