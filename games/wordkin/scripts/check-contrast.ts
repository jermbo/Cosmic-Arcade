// Color contrast check for every theme: run with `npm test` (part of it).
// Reads the color tokens from style.css (:root and each [data-theme] block),
// then checks each text/background pair against WCAG AA:
// 4.5:1 for normal text, 3:1 for large text and for edges of controls.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

function block(selector: string): Record<string, string> {
	const at = css.indexOf(`${selector} {`);
	if (at < 0) return {};
	const body = css.slice(at, css.indexOf('}', at));
	const out: Record<string, string> = {};
	for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
	return out;
}

const root = block(':root');
const themes = ['paper', ...[...css.matchAll(/\[data-theme='([\w-]+)'\] \{/g)].map((m) => m[1])].filter((v, i, a) => a.indexOf(v) === i);

function resolve(tokens: Record<string, string>, name: string, depth = 0): string {
	const v = tokens[name];
	if (!v) throw new Error(`no token ${name}`);
	const ref = v.match(/^var\((--[\w-]+)\)$/);
	return ref && depth < 8 ? resolve(tokens, ref[1], depth + 1) : v;
}

function lum(hex: string): number {
	const h = hex.replace('#', '');
	const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a: string, b: string): number {
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
}

/** [text or edge token, background token, minimum, where it shows]. */
const PAIRS: [string, string, number, string][] = [
	['--page-text', '--paper', 4.5, 'header, hints, clock on the page'],
	['--page-muted', '--paper', 4.5, 'small labels on the page'],
	['--alert-page', '--paper', 4.5, 'warnings on the page (clock, score drop)'],
	['--good-page', '--paper', 4.5, 'good news on the page (+time)'],
	['--ink', '--card', 4.5, 'text on cards'],
	['--muted', '--card', 4.5, 'small text on cards'],
	['--alert', '--card', 4.5, 'warnings on cards'],
	['--good', '--card', 4.5, 'good news on cards'],
	['--gold-text', '--card', 3, 'set-done star (large)'],
	['--ghost', '--card', 3, 'known letters in guess cells (large)'],
	['--cell-line', '--card', 3, 'edges of empty cells'],
	['--on-ink', '--ink', 4.5, 'selected tiles, toasts, chain card'],
	['--l1', '--ink', 4.5, 'letters on locked tiles'],
	['--ink', '--l1', 4.5, 'text on group color 1'],
	['--ink', '--l2', 4.5, 'text on group color 2'],
	['--ink', '--l3', 4.5, 'text on group color 3'],
	['--ink', '--l4', 4.5, 'text on group color 4'],
	['--ink', '--hit', 4.5, 'letter in the right spot'],
	['--ink', '--near', 4.5, 'letter in the word'],
	['--miss-text', '--miss', 4.5, 'letter not in the word'],
	['--ink', '--go', 4.5, 'main buttons'],
	['--ink', '--pink', 4.5, 'badges, Kip'],
	['--focus', '--paper', 3, 'focus ring on the page'],
	['--focus', '--focus-halo', 3, 'focus ring against its halo (on cards)'],
];

let failed = 0;
for (const theme of themes) {
	const tokens = { ...root, ...(theme === 'paper' ? {} : block(`[data-theme='${theme}']`)) };
	for (const [fg, bg, min, where] of PAIRS) {
		const r = ratio(resolve(tokens, fg), resolve(tokens, bg));
		if (r < min) {
			failed++;
			console.error(`${theme}: ${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${min}:1 (${where})`);
		}
	}
}
if (failed) {
	console.error(`${failed} contrast problems.`);
	process.exit(1);
}
console.log(`Contrast OK: ${themes.length} themes × ${PAIRS.length} pairs.`);
