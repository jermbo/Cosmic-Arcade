// Copies the latin woff2 file of DM Mono (Kerplunk's label font) from Fontsource to src/fonts/.
// The other fonts come with the cozy kit (src/kit/fonts/, see copy-kit.js).
// The files in src/fonts/ are part of the game, so the game shows its type offline.
// Run: npm run fonts
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const FONTS = [['dm-mono', 500]];

const out = new URL('../src/fonts/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [family, weight] of FONTS) {
	const dir = dirname(require.resolve(`@fontsource/${family}/package.json`));
	const name = `${family}-latin-${weight}-normal.woff2`;
	copyFileSync(join(dir, 'files', name), new URL(name, out));
	console.log(`copied ${name}`);
}
