// Draws the app icons as PNG files with no outside tools. Run: node tools/make-icons.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'icons');
mkdirSync(out, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const TILES = [
	{ light: '#ffc0c8', base: '#ff5d73', dark: '#9e1f3c', col: 0, row: 0, lift: 0 },
	{ light: '#ffeab0', base: '#ffbe45', dark: '#b06a12', col: 1, row: 0, lift: 0.07 },
	{ light: '#bfe6ff', base: '#45b0ff', dark: '#18589e', col: 0, row: 1, lift: 0 },
	{ light: '#e6d6ff', base: '#b285ff', dark: '#5a2ab0', col: 1, row: 1, lift: 0 },
].map((t) => ({ ...t, light: hex(t.light), base: hex(t.base), dark: hex(t.dark) }));

const LEAD = hex('#130f26');
const GOLD = hex('#f2c879');
const STAR = hex('#fff6dc');

function inRoundRect(x, y, x0, y0, w, h, r) {
	if (x < x0 || y < y0 || x > x0 + w || y > y0 + h) return false;
	const cx = Math.min(Math.max(x, x0 + r), x0 + w - r);
	const cy = Math.min(Math.max(y, y0 + r), y0 + h - r);
	return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Returns [r, g, b, a] for one point of the icon. u and v run from 0 to 1. */
function sample(u, v, { maskable }) {
	const rounded = !maskable;
	if (rounded && !inRoundRect(u, v, 0, 0, 1, 1, 0.22)) return null;
	let color = mix(hex('#2c2160'), hex('#0d0a1f'), v);
	const glow = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.15) / 0.6);
	color = mix(color, hex('#5a3fb0'), glow * 0.45);

	if (rounded && inRoundRect(u, v, 0.035, 0.035, 0.93, 0.93, 0.19) && !inRoundRect(u, v, 0.05, 0.05, 0.9, 0.9, 0.175)) {
		color = mix(color, GOLD, 0.75);
	}

	// Content is scaled down for maskable icons so it stays in the safe zone.
	const k = maskable ? 0.74 : 1;
	const x = (u - 0.5) / k + 0.5;
	const y = (v - 0.5) / k + 0.5;

	const size = 0.28;
	const gap = 0.035;
	const left = 0.5 - size - gap / 2;
	const top = 0.56 - size - gap / 2;
	for (const t of TILES) {
		const tx = left + t.col * (size + gap);
		const ty = top + t.row * (size + gap) - t.lift;
		if (!inRoundRect(x, y, tx, ty, size, size, 0.065)) continue;
		color = LEAD;
		const i = 0.032;
		if (inRoundRect(x, y, tx + i, ty + i, size - i * 2, size - i * 2, 0.045)) {
			const d = ((x - tx) + (y - ty)) / (size * 2);
			color = d < 0.38 ? mix(t.light, t.base, d / 0.38) : mix(t.base, t.dark, (d - 0.38) / 0.62);
			const gx = (x - (tx + size * 0.34)) / (size * 0.2);
			const gy = (y - (ty + size * 0.28)) / (size * 0.09);
			const rx = gx * Math.cos(0.6) - gy * Math.sin(0.6) * 0.45;
			const ry = gx * Math.sin(0.6) * 0.45 + gy * Math.cos(0.6);
			if (rx * rx + ry * ry < 1) color = mix(color, [255, 255, 255], 0.28);
			// Lead line across the bottom-right corner.
			const c = (x - tx) + (y - ty);
			if (Math.abs(c - size * 1.56) < 0.007) color = LEAD;
		}
	}

	// A four-point sparkle with a soft glow.
	const sx = Math.abs(x - 0.79);
	const sy = Math.abs(y - 0.2);
	const halo = Math.max(0, 1 - Math.hypot(sx, sy) / 0.16);
	color = mix(color, STAR, halo * halo * 0.5);
	if (Math.sqrt(sx) + Math.sqrt(sy) <= Math.sqrt(0.13)) color = STAR;
	return [...color, 255];
}

function render(px, opts) {
	const data = Buffer.alloc(px * px * 4);
	const n = px <= 64 ? 6 : 4;
	for (let py = 0; py < px; py++) {
		for (let qx = 0; qx < px; qx++) {
			let r = 0, g = 0, b = 0, a = 0;
			for (let sy = 0; sy < n; sy++) {
				for (let sx = 0; sx < n; sx++) {
					const c = sample((qx + (sx + 0.5) / n) / px, (py + (sy + 0.5) / n) / px, opts);
					if (!c) continue;
					r += c[0];
					g += c[1];
					b += c[2];
					a += 1;
				}
			}
			const o = (py * px + qx) * 4;
			if (a) {
				data[o] = Math.round(r / a);
				data[o + 1] = Math.round(g / a);
				data[o + 2] = Math.round(b / a);
			}
			data[o + 3] = Math.round((a / (n * n)) * 255);
		}
	}
	return png(px, px, data);
}

const CRC = new Uint32Array(256).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function crc32(buf) {
	let c = 0xffffffff;
	for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(body.length);
	const tb = Buffer.concat([Buffer.from(type), body]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(tb));
	return Buffer.concat([len, tb, crc]);
}

function png(w, h, rgba) {
	const head = Buffer.alloc(13);
	head.writeUInt32BE(w, 0);
	head.writeUInt32BE(h, 4);
	head[8] = 8;
	head[9] = 6;
	const rows = Buffer.alloc((w * 4 + 1) * h);
	for (let y = 0; y < h; y++) rgba.copy(rows, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', head),
		chunk('IDAT', deflateSync(rows, { level: 9 })),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

const files = [
	['icon-32.png', 32, { maskable: false }],
	['icon-192.png', 192, { maskable: false }],
	['icon-512.png', 512, { maskable: false }],
	['maskable-192.png', 192, { maskable: true }],
	['maskable-512.png', 512, { maskable: true }],
	['apple-touch-icon.png', 180, { maskable: true }],
];
for (const [name, px, opts] of files) {
	writeFileSync(join(out, name), render(px, opts));
	console.log('wrote', name);
}
