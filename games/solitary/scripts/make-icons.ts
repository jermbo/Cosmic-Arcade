// Draws the app icons from one SVG. Run: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

const INK = '#14110f';
const PAPER = '#fbf6ea';
const RED = '#c8263a';
const BACK = '#8e1f2d';

const HEART = 'M50 90C22 68 5 51 5 31 5 16 16 6 29 6c9 0 17 5 21 13 4-8 12-13 21-13 13 0 24 10 24 25 0 20-17 37-45 59z';

/** Two cards, the back one tilted. Drawn in a 512 box; `scale` shrinks it for maskable icons. */
function art(scale: number) {
	const t = `translate(256 256) scale(${scale}) translate(-262 -262)`;
	return `
	<g transform="${t}">
		<g transform="rotate(-12 256 262)">
			<rect x="118" y="78" width="236" height="320" fill="#0b2618" transform="translate(18 18)"/>
			<rect x="118" y="78" width="236" height="320" fill="${BACK}" stroke="${INK}" stroke-width="14"/>
			<rect x="142" y="102" width="188" height="272" fill="none" stroke="${PAPER}" stroke-opacity="0.5" stroke-width="6"/>
		</g>
		<rect x="176" y="118" width="236" height="320" fill="#0b2618" transform="translate(20 20)"/>
		<rect x="176" y="118" width="236" height="320" fill="${PAPER}" stroke="${INK}" stroke-width="14"/>
		<rect x="192" y="134" width="204" height="288" fill="none" stroke="${INK}" stroke-width="4"/>
		<path d="${HEART}" fill="${RED}" stroke="${INK}" stroke-width="6" transform="translate(224 210) scale(1.4)"/>
		<path d="${HEART}" fill="${RED}" transform="translate(206 150) scale(0.32)"/>
		<path d="${HEART}" fill="${RED}" transform="translate(350 374) scale(0.32) rotate(180 50 50)"/>
	</g>`;
}

function svg(maskable: boolean) {
	const bg = maskable
		? `<rect width="512" height="512" fill="url(#felt)"/>`
		: `<rect x="8" y="8" width="496" height="496" rx="104" fill="url(#felt)" stroke="${INK}" stroke-width="10"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<defs>
		<radialGradient id="felt" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="#22744d"/><stop offset="1" stop-color="#134129"/></radialGradient>
		<pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="2" fill="#ffffff" fill-opacity="0.06"/></pattern>
	</defs>
	${bg}
	<rect x="${maskable ? 0 : 16}" y="${maskable ? 0 : 16}" width="${maskable ? 512 : 480}" height="${maskable ? 512 : 480}" rx="${maskable ? 0 : 96}" fill="url(#dots)"/>
	${art(maskable ? 0.74 : 0.9)}
</svg>`;
}

const plain = svg(false);
const mask = svg(true);
writeFileSync(new URL('icon.svg', out), plain);
const jobs: [string, string, number][] = [
	['icon-192.png', plain, 192],
	['icon-512.png', plain, 512],
	['maskable-192.png', mask, 192],
	['maskable-512.png', mask, 512],
	['apple-touch-icon.png', mask, 180],
];
for (const [name, src, size] of jobs) {
	await sharp(Buffer.from(src)).resize(size, size).png().toFile(fileURLToPath(new URL(name, out)));
}
console.log('icons written');
