// Color contrast check for every theme: run with `npm test` (part of it).
// The colors come from the cozy kit (games/cozy-kit/themes.js); Wordkin's own names
// come from its token block in style.css. Each text/background pair is checked
// against WCAG AA: 4.5:1 for normal text, 3:1 for large text and for edges of controls.
import { readFileSync } from 'node:fs';
import { ON_COLOR, PALETTES, THEMES } from '@arcade/cozy-kit/themes.js';

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

function block(selector: string): Record<string, string> {
	const at = css.indexOf(`${selector} {`);
	if (at < 0) return {};
	const body = css.slice(at, css.indexOf('}', at));
	const out: Record<string, string> = {};
	for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
	return out;
}

const wordkin = block(':root,\n[data-theme]');
const darkExtra = block("[data-tone='dark'],\n[data-tone='dark'] [data-theme]");
const kebab = (k: string) => `--${k.replace(/[A-Z0-9]+/g, (m) => `-${m.toLowerCase()}`)}`;

function kitTokens(id: string): Record<string, string> {
	const t = THEMES.find((x) => x.id === id)!;
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(t)) if (typeof v === 'string' && v.startsWith('#')) out[kebab(k)] = v;
	PALETTES[t.tone].forEach((c, i) => (out[`--c${i}`] = c));
	out['--on-color'] = ON_COLOR[t.tone];
	return { ...out, ...wordkin, ...(t.tone === 'dark' ? darkExtra : {}) };
}

const themes = THEMES.map((t) => t.id);

const hex = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
/** color-mix(in srgb, A P%, B), for the tokens that use it. */
function mix(v: string, tokens: Record<string, string>, depth: number): string {
	const m = v.match(/^color-mix\(in srgb, (.+?) (\d+)%, (.+)\)$/)!;
	const a = hex(resolveValue(tokens, m[1], depth + 1));
	const b = hex(resolveValue(tokens, m[3], depth + 1));
	const p = Number(m[2]) / 100;
	return '#' + a.map((x, i) => Math.round(x * p + b[i] * (1 - p)).toString(16).padStart(2, '0')).join('');
}

function resolveValue(tokens: Record<string, string>, v: string, depth: number): string {
	const ref = v.match(/^var\((--[\w-]+)\)$/);
	if (ref && depth < 8) return resolve(tokens, ref[1], depth + 1);
	if (v.startsWith('color-mix(')) return mix(v, tokens, depth);
	return v;
}

function resolve(tokens: Record<string, string>, name: string, depth = 0): string {
	const v = tokens[name];
	if (!v) throw new Error(`no token ${name}`);
	return resolveValue(tokens, v, depth);
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
	['--l1', '--locked-bg', 4.5, 'letters on locked tiles'],
	['--on-color', '--l1', 3, 'text on group color 1 (bold)'],
	['--on-color', '--l2', 3, 'text on group color 2 (bold)'],
	['--on-color', '--l3', 3, 'text on group color 3 (bold)'],
	['--on-color', '--l4', 3, 'text on group color 4 (bold)'],
	['--on-color', '--hit', 3, 'letter in the right spot (large)'],
	['--on-color', '--near', 3, 'letter in the word (large)'],
	['--miss-text', '--miss', 4.5, 'letter not in the word'],
	['--accent-ink', '--go', 4.5, 'main buttons'],
	['--on-color', '--pink', 4.5, 'badges, Kip'],
	['--focus', '--paper', 3, 'focus ring on the page'],
	['--focus', '--focus-halo', 3, 'focus ring against its halo (on cards)'],
];

let failed = 0;
for (const theme of themes) {
	const tokens = kitTokens(theme);
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
