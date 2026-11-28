// Checks every theme of the kit:
// - the first five palette colors and the empty cell stay clearly apart, under
//   normal vision and the three common kinds of color blindness (ΔE ≥ MIN_DELTA);
// - dark ink reads on every palette color (≥ 3.5:1, for numbers and letters on tiles);
// - text reads: ink on the page and on cards (≥ 7:1), quiet text on cards (≥ 4.5:1),
//   button text on the accent (≥ 4.5:1), bad and good text on cards (≥ 4.5:1).
// Method (from Mozzi): simulate each kind (Machado et al. 2009, full strength), convert to CIELAB.
// Run: npm test -w @arcade/cozy-kit
import { ON_COLOR, PALETTES, THEMES } from '../themes.js';

const MIN_DELTA = 18;
const SAFE_COLORS = 5;

const M = {
	normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
	protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
	deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
	tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255);
function lab(lin) {
	const [r, g, b] = lin.map((v) => Math.max(0, Math.min(1, v)));
	const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
	const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
	const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
	const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
	return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const sim = (hex, m) => {
	const l = rgb(hex).map(toLin);
	return m.map((row) => row[0] * l[0] + row[1] * l[1] + row[2] * l[2]);
};
const lum = (hex) => {
	const [r, g, b] = rgb(hex).map(toLin);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

let fail = 0;
const need = (theme, what, value, min) => {
	if (value < min) {
		fail++;
		console.error(`FAIL ${theme}: ${what} ${value.toFixed(2)} < ${min}`);
	}
};

for (const t of THEMES) {
	const pal = PALETTES[t.tone];
	const all = [...pal.slice(0, SAFE_COLORS), t.well];
	const parts = [];
	for (const [kind, m] of Object.entries(M)) {
		const labs = all.map((c) => lab(sim(c, m)));
		let worst = Infinity;
		for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) worst = Math.min(worst, Math.hypot(...labs[i].map((v, k) => v - labs[j][k])));
		parts.push(`${kind.slice(0, 5)} ${worst.toFixed(0)}`);
		need(t.id, `colors too close for ${kind}, ΔE`, worst, MIN_DELTA);
	}
	const onLow = Math.min(...pal.map((c) => contrast(c, ON_COLOR[t.tone])));
	need(t.id, 'ink on palette colors', onLow, 3.5);
	need(t.id, 'ink on page', contrast(t.ink, t.bg), 7);
	need(t.id, 'ink on cards', contrast(t.ink, t.surface), 7);
	need(t.id, 'quiet text on cards', contrast(t.muted, t.surface), 4.5);
	need(t.id, 'quiet text on page', contrast(t.muted, t.bg), 4.5);
	need(t.id, 'button text on accent', contrast(t.accentInk, t.accent), 4.5);
	need(t.id, 'bad text on cards', contrast(t.bad, t.surface), 4.5);
	need(t.id, 'good text on cards', contrast(t.good, t.surface), 4.5);
	need(t.id, 'bad text on page', contrast(t.bad, t.bg), 4.5);
	need(t.id, 'good text on page', contrast(t.good, t.bg), 4.5);
	// Bold outlines and shadows: darker than the page and the cards (never a white outline),
	// and clear around the accent button and the palette tiles.
	if (lum(t.stroke) >= Math.min(lum(t.bg), lum(t.surface))) need(t.id, 'stroke darker than page and cards', 0, 1);
	// On light themes the stroke is the ink, already checked as text.
	if (t.tone === 'dark') need(t.id, 'stroke around the accent', contrast(t.stroke, t.accent), 3);
	need(t.id, 'stroke around palette colors', Math.min(...pal.map((c) => contrast(c, t.stroke))), 3);
	console.log(`  ${t.id.padEnd(8)} ΔE ${parts.join(' · ')} · ink on colors ≥ ${onLow.toFixed(1)}`);
}
if (fail) {
	console.error(`${fail} failures.`);
	process.exit(1);
}
console.log('All themes pass.');
