// Draws the app icons and favicon from one SVG. Run: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

const INK = '#0d0a10';
const ACCENT = '#ff5a1f';

/** An archer drawing a bow on a rock, against a setting sun. Drawn in a 512 box. */
function art(scale: number) {
	return `
	<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
		<circle cx="300" cy="300" r="150" fill="#fff0bd"/>
		<path d="M0 392 C120 372 200 400 300 384 S440 360 512 380 V512 H0z" fill="#5e1838"/>
		<path d="M0 430 H512 V512 H0z" fill="${INK}"/>
		<path d="M120 432 L150 408 L250 404 L300 432z" fill="${INK}"/>
		<g stroke="${INK}" stroke-linecap="round" stroke-linejoin="round" fill="none">
			<path d="M190 300 C176 316 150 318 120 312" stroke="${ACCENT}" stroke-width="16"/>
			<path d="M196 300 L194 352" stroke-width="20"/>
			<path d="M194 352 L222 380 L232 418 M194 352 L170 384 L160 418" stroke-width="16"/>
			<path d="M200 316 L258 300" stroke-width="14"/>
			<path d="M200 316 L214 300 L232 304" stroke-width="13"/>
			<path d="M262 236 C292 268 292 334 262 366" stroke-width="12"/>
			<path d="M262 236 L232 304 L262 366" stroke-width="4"/>
			<path d="M232 304 L330 280" stroke-width="7"/>
		</g>
		<circle cx="200" cy="270" r="26" fill="${INK}"/>
		<path d="M346 276 L326 268 L330 290z" fill="${INK}"/>
	</g>`;
}

function svg(maskable: boolean) {
	const bg = maskable
		? `<rect width="512" height="512" fill="url(#sky)"/>`
		: `<rect x="10" y="10" width="492" height="492" rx="100" fill="url(#sky)" stroke="${INK}" stroke-width="14"/>`;
	const clip = maskable ? '' : `<clipPath id="c"><rect x="10" y="10" width="492" height="492" rx="100"/></clipPath>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<defs>
		<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#3a1747"/><stop offset="0.45" stop-color="#a8304f"/><stop offset="0.75" stop-color="#ef7a45"/><stop offset="1" stop-color="#ffcf73"/>
		</linearGradient>
		${clip}
	</defs>
	${bg}
	<g ${maskable ? '' : 'clip-path="url(#c)"'}>${art(maskable ? 0.8 : 1)}</g>
	${maskable ? '' : `<rect x="10" y="10" width="492" height="492" rx="100" fill="none" stroke="${INK}" stroke-width="14"/>`}
</svg>`;
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
	await sharp(Buffer.from(src)).resize(size, size).png().toFile(fileURLToPath(new URL(name, out)));
}
console.log('icons written');
