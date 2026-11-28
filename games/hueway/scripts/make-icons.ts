// Draws the app icons (Tint over a little ribbon) from one SVG. Run: npm run icons -w hueway
// Uses sharp, which the repo already has through Astro.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

// The Oat theme's colors (see style.css).
const BG = '#f4eee4';
const BOARD = '#e9e0d2';
const EYE = '#2f2731';
const RED = '#e5534b';
const BLUE = '#3f86e0';
const TINT = '#f2a65c';

/** Tint and a ribbon in a 512 box. `scale` shrinks it for maskable icons. */
function art(scale: number) {
	const ribbon = 'M 112 392 C 180 330 230 440 300 392 C 350 358 380 360 400 392';
	return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
		<rect x="64" y="300" width="384" height="160" rx="56" fill="${BOARD}"/>
		<path d="${ribbon}" fill="none" stroke="#000" stroke-opacity="0.1" stroke-width="40" stroke-linecap="round" transform="translate(0 8)"/>
		<path d="${ribbon}" fill="none" stroke="url(#hue)" stroke-width="40" stroke-linecap="round"/>
		<path d="${ribbon}" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="11" stroke-linecap="round" transform="translate(-4 -6)"/>
		<circle cx="112" cy="392" r="38" fill="${RED}"/>
		<circle cx="400" cy="392" r="38" fill="${BLUE}"/>
		<ellipse cx="102" cy="378" rx="12" ry="8" fill="#fff" fill-opacity="0.55"/>
		<ellipse cx="390" cy="378" rx="12" ry="8" fill="#fff" fill-opacity="0.55"/>
		<g transform="translate(256 210) scale(4.4) translate(-32 -40)">
			<ellipse cx="32" cy="68" rx="17" ry="3.2" fill="#000" fill-opacity="0.12"/>
			<path d="M32 4 C 40 16 54 28 54 44 C 54 57 44 66 32 66 C 20 66 10 57 10 44 C 10 28 24 16 32 4 Z" fill="${TINT}"/>
			<path d="M32 4 C 40 16 54 28 54 44 C 54 57 44 66 32 66 C 20 66 10 57 10 44 C 10 28 24 16 32 4 Z" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="1.6"/>
			<ellipse cx="22" cy="34" rx="4.5" ry="7" fill="#fff" fill-opacity="0.5" transform="rotate(24 22 34)"/>
			<ellipse cx="18" cy="52" rx="4.2" ry="2.6" fill="#ff7d9c" fill-opacity="0.4"/>
			<ellipse cx="46" cy="52" rx="4.2" ry="2.6" fill="#ff7d9c" fill-opacity="0.4"/>
			<ellipse cx="25" cy="45" rx="3.8" ry="4.6" fill="${EYE}"/>
			<ellipse cx="39" cy="45" rx="3.8" ry="4.6" fill="${EYE}"/>
			<circle cx="26.3" cy="43.4" r="1.3" fill="#fff"/>
			<circle cx="40.3" cy="43.4" r="1.3" fill="#fff"/>
			<path d="M27 54 Q 32 60 37 54" fill="none" stroke="${EYE}" stroke-width="2.4" stroke-linecap="round"/>
		</g>
	</g>`;
}

function svg(maskable: boolean) {
	const defs = `<defs><linearGradient id="hue" x1="0" x2="1"><stop offset="0" stop-color="${RED}"/><stop offset="0.35" stop-color="#f08532"/><stop offset="0.55" stop-color="#eeb92a"/><stop offset="0.75" stop-color="#3aa865"/><stop offset="1" stop-color="${BLUE}"/></linearGradient></defs>`;
	const bg = maskable ? `<rect width="512" height="512" fill="${BG}"/>` : `<rect x="8" y="8" width="496" height="496" rx="112" fill="${BG}"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}${bg}${art(maskable ? 0.72 : 0.94)}</svg>`;
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
