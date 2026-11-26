// Draws the app icons (Kip on a paper tile) from one SVG. Run: npm run icons
// Uses sharp, which the repo already has through Astro.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

const INK = '#141414';

/** Kip in a 512 box. `scale` shrinks it for maskable icons. */
function kip(scale: number) {
	return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
		<rect x="118" y="118" width="300" height="300" rx="64" fill="${INK}"/>
		<rect x="96" y="96" width="300" height="300" rx="64" fill="#ff6b9a" stroke="${INK}" stroke-width="18"/>
		<ellipse cx="196" cy="220" rx="34" ry="42" fill="#fff" stroke="${INK}" stroke-width="16"/>
		<ellipse cx="298" cy="220" rx="34" ry="42" fill="#fff" stroke="${INK}" stroke-width="16"/>
		<circle cx="202" cy="228" r="18" fill="${INK}"/>
		<circle cx="304" cy="228" r="18" fill="${INK}"/>
		<ellipse cx="150" cy="292" rx="22" ry="14" fill="#ffb3c8"/>
		<ellipse cx="344" cy="292" rx="22" ry="14" fill="#ffb3c8"/>
		<path d="M206 300q41 34 82 0" fill="none" stroke="${INK}" stroke-width="18" stroke-linecap="round"/>
	</g>`;
}

function svg(maskable: boolean) {
	const bg = maskable
		? `<rect width="512" height="512" fill="#ffd23f"/>`
		: `<rect x="8" y="8" width="496" height="496" rx="104" fill="#ffd23f" stroke="${INK}" stroke-width="12"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<defs><pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r="3" fill="${INK}" fill-opacity="0.08"/></pattern></defs>
	${bg}
	<rect x="${maskable ? 0 : 14}" y="${maskable ? 0 : 14}" width="${maskable ? 512 : 484}" height="${maskable ? 512 : 484}" rx="${maskable ? 0 : 98}" fill="url(#dots)"/>
	${kip(maskable ? 0.78 : 0.95)}
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
	writeFileSync(new URL(name, out), await sharp(Buffer.from(src)).resize(size, size).png().toBuffer());
}
console.log(`Wrote ${jobs.length + 1} icons.`);
