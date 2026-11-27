/**
 * Checks every theme's four colors (and its empty tile) stay clearly apart,
 * under normal vision and the three common kinds of color blindness.
 * Reads the tokens straight from src/style.css, so it guards later tweaks.
 *
 * Method: simulate each kind (Machado et al. 2009, full strength), convert to
 * CIELAB, and take the smallest distance (ΔE 1976) between any two of the five.
 * Also checks the dark number ink on each color has a contrast of at least 3.5:1.
 */
import { readFileSync } from 'node:fs';

const MIN_DELTA = 18;
const MIN_INK_CONTRAST = 3.5;

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const blocks = [...css.matchAll(/\[data-theme='(\w+)'\] \{([^}]+)\}/g)];

const M: Record<string, number[][]> = {
	normal: [
		[1, 0, 0],
		[0, 1, 0],
		[0, 0, 1],
	],
	protanopia: [
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998],
	],
	deuteranopia: [
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.01182, 0.04294, 0.968881],
	],
	tritanopia: [
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.3039],
	],
};

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255);
function lab(lin: number[]) {
	const [r, g, b] = lin.map((v) => Math.max(0, Math.min(1, v)));
	const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
	const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
	const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
	const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
	return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const sim = (hex: string, m: number[][]) => {
	const l = rgb(hex).map(toLin);
	return m.map((row) => row[0] * l[0] + row[1] * l[1] + row[2] * l[2]);
};
const lum = (hex: string) => {
	const [r, g, b] = rgb(hex).map(toLin);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

let fail = 0;
for (const [, theme, body] of blocks) {
	const token = (name: string) => body.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))?.[1];
	const colors = [0, 1, 2, 3].map((k) => token(`k${k}`)!);
	const surface = token('surface')!;
	const ink = token('kink')!;
	const all = [...colors, surface];
	const parts: string[] = [];
	for (const [kind, m] of Object.entries(M)) {
		const labs = all.map((c) => lab(sim(c, m)));
		let worst = Infinity;
		for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) worst = Math.min(worst, Math.hypot(...labs[i].map((v, k) => v - labs[j][k])));
		parts.push(`${kind} ${worst.toFixed(0)}`);
		if (worst < MIN_DELTA) {
			fail++;
			console.error(`FAIL ${theme}: colors too close for ${kind} (ΔE ${worst.toFixed(1)} < ${MIN_DELTA})`);
		}
	}
	const inkLow = Math.min(...colors.map((c) => contrast(c, ink)));
	if (inkLow < MIN_INK_CONTRAST) {
		fail++;
		console.error(`FAIL ${theme}: number ink contrast ${inkLow.toFixed(1)} < ${MIN_INK_CONTRAST}`);
	}
	console.log(`  ${theme.padEnd(8)} smallest ΔE: ${parts.join(' · ')} · ink contrast ≥ ${inkLow.toFixed(1)}`);
}
if (blocks.length < 6) {
	fail++;
	console.error(`FAIL: found ${blocks.length} themes in style.css, expected 6`);
}
if (fail) process.exit(1);
console.log('All theme colors stay apart.');
