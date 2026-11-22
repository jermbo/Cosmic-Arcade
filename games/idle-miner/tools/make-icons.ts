// Draws the app icons from one SVG. Run: node tools/make-icons.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

/** The art, in a 512 box. `scale` shrinks it for maskable icons. */
function art(scale: number) {
	const t = `translate(256 256) scale(${scale}) translate(-256 -256)`;
	return `
	<g transform="${t}">
		<path d="M118 150 A200 120 -18 0 1 430 120" fill="none" stroke="#5ef2ff" stroke-opacity="0.5" stroke-width="7" stroke-dasharray="14 14" stroke-linecap="round"/>
		<circle cx="236" cy="290" r="170" fill="url(#halo)"/>
		<ellipse cx="236" cy="290" rx="205" ry="54" transform="rotate(-18 236 290)" fill="none" stroke="#ffc29e" stroke-opacity="0.35" stroke-width="14"/>
		<circle cx="236" cy="290" r="128" fill="url(#ball)"/>
		<ellipse cx="200" cy="250" rx="52" ry="14" fill="#7a2a12" opacity="0.35" transform="rotate(-8 200 250)"/>
		<ellipse cx="270" cy="330" rx="70" ry="12" fill="#ffc29e" opacity="0.18" transform="rotate(-8 270 330)"/>
		<circle cx="290" cy="240" r="20" fill="#7a2a12" opacity="0.35"/>
		<g transform="rotate(-18 236 290)">
			<clipPath id="front"><rect x="-100" y="290" width="700" height="300"/></clipPath>
			<ellipse cx="236" cy="290" rx="205" ry="54" fill="none" stroke="#ffe2c8" stroke-width="14" clip-path="url(#front)"/>
		</g>
		<g transform="translate(410 128) rotate(28)">
			<circle r="38" fill="#5ef2ff" opacity="0.25"/>
			<path d="M34 0 L-22 -20 L-12 0 L-22 20 Z" fill="#e8f1ff"/>
			<path d="M14 0 L-8 -7 L-8 7 Z" fill="#ff7a45"/>
			<path d="M-24 -8 L-46 0 L-24 8 Z" fill="#5ef2ff"/>
		</g>
	</g>`;
}

function svg(maskable: boolean) {
	const bg = maskable ? `<rect width="512" height="512" fill="url(#bg)"/>` : `<rect x="8" y="8" width="496" height="496" rx="112" fill="url(#bg)"/><rect x="8" y="8" width="496" height="496" rx="112" fill="none" stroke="#5ef2ff" stroke-opacity="0.35" stroke-width="6"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<defs>
		<radialGradient id="bg" cx="0.35" cy="0.25" r="0.9"><stop offset="0" stop-color="#2a2466"/><stop offset="0.55" stop-color="#10153a"/><stop offset="1" stop-color="#070a14"/></radialGradient>
		<radialGradient id="ball" cx="0.32" cy="0.28" r="0.85"><stop offset="0" stop-color="#ffd9bd"/><stop offset="0.45" stop-color="#ff7a45"/><stop offset="1" stop-color="#5a1a08"/></radialGradient>
		<radialGradient id="halo"><stop offset="0.6" stop-color="#ff7a45" stop-opacity="0.45"/><stop offset="1" stop-color="#ff7a45" stop-opacity="0"/></radialGradient>
	</defs>
	${bg}
	<g fill="#ffffff" opacity="0.8"><circle cx="90" cy="90" r="3"/><circle cx="420" cy="420" r="2.5"/><circle cx="440" cy="300" r="2"/><circle cx="70" cy="420" r="2"/><circle cx="150" cy="60" r="1.6"/></g>
	${art(maskable ? 0.78 : 0.92)}
</svg>`;
}

const plain = svg(false);
const mask = svg(true);
writeFileSync(new URL('favicon.svg', out), plain);
const jobs: [string, string, number][] = [
	['icon-32.png', plain, 32],
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
