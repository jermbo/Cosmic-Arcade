// Copies the Latin font files the kit uses from the @fontsource packages
// (already installed in the repo) into fonts/. Run: npm run fonts -w @arcade/cozy-kit
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const FILES = [
	['@fontsource/bricolage-grotesque', 'bricolage-grotesque-latin-500-normal.woff2'],
	['@fontsource/bricolage-grotesque', 'bricolage-grotesque-latin-700-normal.woff2'],
	['@fontsource/bricolage-grotesque', 'bricolage-grotesque-latin-800-normal.woff2'],
	['@fontsource/archivo-black', 'archivo-black-latin-400-normal.woff2'],
	['@fontsource/space-grotesk', 'space-grotesk-latin-500-normal.woff2'],
	['@fontsource/space-grotesk', 'space-grotesk-latin-700-normal.woff2'],
];
const out = new URL('../fonts/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [pkg, file] of FILES) {
	const dir = dirname(require.resolve(`${pkg}/package.json`));
	copyFileSync(join(dir, 'files', file), new URL(file, out));
}
console.log(`Copied ${FILES.length} font files.`);
