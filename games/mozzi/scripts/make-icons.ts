// Draws the app icons (Mozzi on a soft tile) from one SVG. Run: npm run icons -w mozzi
// Uses sharp, which the repo already has through Astro.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

// The Linen theme's colors (see style.css).
const BG = '#f2ede6';
const INK = '#2a2430';
const K = ['#fd5f5b', '#aeceff', '#eac35a', '#5dc286'];

/** Mozzi in a 512 box: four clay tiles and a face. `scale` shrinks it for maskable icons. */
function mozzi(scale: number) {
	const tile = (x: number, y: number, c: string) =>
		`<rect x="${x}" y="${y + 16}" width="150" height="150" rx="38" fill="#000" fill-opacity="0.12"/>
		<rect x="${x}" y="${y}" width="150" height="150" rx="38" fill="${c}"/>
		<rect x="${x}" y="${y}" width="150" height="150" rx="38" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="6"/>`;
	return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
		${tile(98, 90, K[0])}${tile(264, 90, K[1])}${tile(98, 256, K[2])}${tile(264, 256, K[3])}
		<ellipse cx="200" cy="232" rx="40" ry="46" fill="#fff"/>
		<ellipse cx="312" cy="232" rx="40" ry="46" fill="#fff"/>
		<circle cx="208" cy="240" r="22" fill="${INK}"/>
		<circle cx="320" cy="240" r="22" fill="${INK}"/>
		<circle cx="216" cy="230" r="8" fill="#fff"/>
		<circle cx="328" cy="230" r="8" fill="#fff"/>
		<ellipse cx="160" cy="300" rx="20" ry="12" fill="#ff8ca0" fill-opacity="0.6"/>
		<ellipse cx="352" cy="300" rx="20" ry="12" fill="#ff8ca0" fill-opacity="0.6"/>
		<path d="M226 306q30 30 60 0" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round"/>
	</g>`;
}

function svg(maskable: boolean) {
	const bg = maskable ? `<rect width="512" height="512" fill="${BG}"/>` : `<rect x="8" y="8" width="496" height="496" rx="112" fill="${BG}"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}${mozzi(maskable ? 0.74 : 0.95)}</svg>`;
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
