// Builds the kit page from page/template.html and the kit's real files: fonts (inlined),
// kit.css, components.css and the theme data. So the page always shows what the games get.
// Run: npm run page -w @arcade/cozy-kit, then open page/index.html in a browser.
// It also writes page/artifact.html: the same page without <html>/<head>, for publishing.
import { readFileSync, writeFileSync } from 'node:fs';
import { COLOR_NAMES, FREE_THEMES, ON_COLOR, PALETTES, THEMES } from '../themes.js';

const kit = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, kit), 'utf8');

const fonts = read('fonts.css').replace(/url\('\.\/fonts\/([^']+)'\)/g, (_, file) =>
	`url(data:font/woff2;base64,${readFileSync(new URL(`fonts/${file}`, kit)).toString('base64')})`);

// components.css styles the whole page (html, body). Here each band is its own page.
const components = read('components.css')
	.replace(/^html,\nbody \{/m, '.band {')
	.replace(/^body \{\n\tbackground: var\(--page-bg\);\n\toverscroll-behavior: none;\n\}\n/m, '');
if (/^(html|body)\b/m.test(components)) throw new Error('components.css changed: update the page rewrite in make-page.js');

const data = JSON.stringify({ THEMES, PALETTES, COLOR_NAMES, ON_COLOR, FREE_THEMES });
const page = read('page/template.html')
	.replace('/*FONTS*/', () => fonts)
	.replace('/*KIT_CSS*/', () => read('kit.css'))
	.replace('/*COMPONENTS_CSS*/', () => components)
	.replace('/*KIT_DATA*/', () => data);

writeFileSync(new URL('page/artifact.html', kit), page);
writeFileSync(
	new URL('page/index.html', kit),
	`<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${page}\n</body>\n</html>\n`,
);
console.log(`Wrote page/index.html (${Math.round(page.length / 1024)} KB): ${THEMES.length} themes × 2 styles.`);
