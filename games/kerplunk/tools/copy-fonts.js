// Copies the latin woff2 files of the four fonts from the Fontsource packages to src/fonts/.
// The files in src/fonts/ are part of the game, so the game shows its type offline.
// Run: npm run fonts
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const FONTS = [
	['archivo-black', 400],
	['dm-mono', 500],
	['space-grotesk', 500],
	['space-grotesk', 700],
	['bricolage-grotesque', 800],
];

const out = new URL('../src/fonts/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [family, weight] of FONTS) {
	const dir = dirname(require.resolve(`@fontsource/${family}/package.json`));
	const name = `${family}-latin-${weight}-normal.woff2`;
	copyFileSync(join(dir, 'files', name), new URL(name, out));
	console.log(`copied ${name}`);
}
