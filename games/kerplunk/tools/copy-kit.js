// Copies the cozy kit (games/cozy-kit) into src/kit/: the shared themes and the fonts.
// Kerplunk is plain files with no bundler, so it keeps its own copy. Run: npm run kit
// (build.js runs it first, so a build always has the kit's latest themes).
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const kit = new URL('../../cozy-kit/', import.meta.url);
const out = new URL('../src/kit/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const file of ['themes.js', 'fonts.css']) cpSync(new URL(file, kit), new URL(file, out));
cpSync(new URL('fonts/', kit), new URL('fonts/', out), { recursive: true });
console.log('Copied the cozy kit to src/kit/.');
