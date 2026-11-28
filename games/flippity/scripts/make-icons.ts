// Draws the app icons (a clay tray with two pebbles, one mid-flip) from one SVG. Run: npm run icons -w flippity
// Uses sharp, which the repo already has through Astro.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

// The Oat theme's colors, and the tray tone from style.css.
const BG = '#f6efe3';
const TRAY = '#c9bfb3';
const DIP = '#aea499';

function pebble(cx: number, cy: number, r: number, dark: boolean, squash = 1) {
	const a = dark ? '#3d434b' : '#fbf6ec';
	const b = dark ? '#262a30' : '#e6dccb';
	const id = dark ? 'pd' : 'pl';
	return `<defs><radialGradient id="${id}" cx="0.6" cy="0.65" r="0.75"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs>
		<ellipse cx="${cx + 4}" cy="${cy + r * 0.85}" rx="${r * 0.95 * squash}" ry="${r * 0.32}" fill="#000" fill-opacity="0.16"/>
		<ellipse cx="${cx}" cy="${cy}" rx="${r * squash}" ry="${r}" fill="url(#${id})"/>
		<ellipse cx="${cx - r * 0.34 * squash}" cy="${cy - r * 0.42}" rx="${r * 0.22 * squash}" ry="${r * 0.14}" fill="#fff" fill-opacity="${dark ? 0.35 : 0.9}"/>`;
}

function art(scale: number) {
	return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
		<rect x="56" y="96" width="400" height="320" rx="80" fill="${TRAY}"/>
		<rect x="56" y="96" width="400" height="320" rx="80" fill="none" stroke="#000" stroke-opacity="0.08" stroke-width="8"/>
		<circle cx="170" cy="256" r="92" fill="${DIP}"/>
		<circle cx="342" cy="256" r="92" fill="${DIP}"/>
		${pebble(170, 250, 80, true)}
		${pebble(342, 238, 80, false, 0.45)}
		<path d="M 300 132 Q 342 112 384 132" fill="none" stroke="#3d434b" stroke-width="12" stroke-linecap="round" stroke-opacity="0.5"/>
	</g>`;
}

function svg(maskable: boolean) {
	const bg = maskable ? `<rect width="512" height="512" fill="${BG}"/>` : `<rect x="8" y="8" width="496" height="496" rx="112" fill="${BG}"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}${art(maskable ? 0.74 : 0.94)}</svg>`;
}

const plain = svg(false);
const mask = svg(true);
writeFileSync(new URL('icon.svg', out), plain);
writeFileSync(new URL('../favicon.svg', out), plain);
const jobs: [string, string, number][] = [
	['icon-192.png', plain, 192],
	['icon-512.png', plain, 512],
	['maskable-192.png', mask, 192],
	['maskable-512.png', mask, 512],
	['apple-touch-icon.png', mask, 180],
];
for (const [name, src, size] of jobs) {
	writeFileSync(new URL(name, out), await sharp(Buffer.from(src)).resize(size, size).png().toBuffer());
}
console.log(`Wrote ${jobs.length + 2} icons.`);
