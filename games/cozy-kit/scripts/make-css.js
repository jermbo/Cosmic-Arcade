// Writes kit.css from themes.js: one block of color tokens per theme, one block
// of shape tokens per style. Run: npm run css -w @arcade/cozy-kit
import { writeFileSync } from 'node:fs';
import { ON_COLOR, PALETTES, STYLES, THEMES, DEFAULT_STYLE } from '../themes.js';

const kebab = (s) => s.replace(/[A-Z0-9]+/g, (m) => `-${m.toLowerCase()}`);
const out = [];
out.push(`/*
 * The cozy kit: shared tokens for the arcade's cozy puzzle games.
 * MADE BY scripts/make-css.js FROM themes.js. Do not edit by hand.
 *
 * Put data-theme, data-tone and data-style on <html> (applyLooks in themes.js does it).
 * A box with its own data-theme (a shop preview) shows that theme inside the page.
 *
 * Shape tokens: --bw (outline width), --outline (outline color: stroke in Bold,
 * clear in Soft), --shade (shadow color), --sx (1 in Bold, 0 in Soft: multiply
 * a shadow's x offset by it, so a hard diagonal shadow drops straight down in
 * Soft), --shadow / --shadow-sm / --shadow-lg / --shadow-press, --press (the
 * pressed move), --r-lg / --r / --r-sm, --font-display / --font-ui,
 * --display-weight, --display-spacing, --page-bg.
 */
`);

// ---- themes
THEMES.forEach((t, i) => {
	const lines = [];
	for (const [k, v] of Object.entries(t)) {
		if (['id', 'name', 'tone', 'blurb'].includes(k)) continue;
		lines.push(`\t--${kebab(k)}: ${v};`);
	}
	PALETTES[t.tone].forEach((c, k) => lines.push(`\t--c${k}: ${c};`));
	lines.push(`\t--on-color: ${ON_COLOR[t.tone]};`);
	lines.push(`\t--shine: ${t.tone === 'light' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.12)'};`);
	lines.push(`\tcolor-scheme: ${t.tone};`);
	const sel = i === 0 ? `:root,\n[data-theme='${t.id}']` : `[data-theme='${t.id}']`;
	out.push(`${sel} {\n${lines.join('\n')}\n}\n`);
});

// ---- styles. Repeated on any [data-theme] box, so var(--ink) and friends follow a preview's theme.
for (const s of Object.values(STYLES)) {
	const r = s.radius;
	const common = [
		`--bw: ${s.outline}px;`,
		`--r-lg: ${r.big}px;`,
		`--r: ${r.normal}px;`,
		`--r-sm: ${r.small}px;`,
		`--lift: ${s.lift}px;`,
		`--font-display: '${s.displayFont}', 'Arial Black', system-ui, sans-serif;`,
		`--font-ui: '${s.uiFont}', system-ui, -apple-system, 'Segoe UI', sans-serif;`,
		`--display-weight: ${s.displayWeight};`,
		`--display-spacing: ${s.hard ? '0' : '-0.02em'};`,
	];
	const shape = s.hard
		? [
				'--outline: var(--stroke);',
				'--sx: 1;',
				'--shade: var(--stroke);',
				'--shadow: var(--lift) var(--lift) 0 var(--stroke);',
				'--shadow-sm: 2px 2px 0 var(--stroke);',
				'--shadow-lg: 5px 5px 0 var(--stroke);',
				'--shadow-press: 1px 1px 0 var(--stroke);',
				'--press: translate(calc(var(--lift) - 1px), calc(var(--lift) - 1px));',
				'--page-bg: radial-gradient(var(--dot) 1.4px, transparent 1.6px) 0 0 / 22px 22px, var(--bg);',
			]
		: [
				'--outline: transparent;',
				'--sx: 0;',
				'--shade: var(--edge);',
				'--shadow: 0 var(--lift) 0 var(--edge);',
				'--shadow-sm: 0 2px 0 var(--edge);',
				'--shadow-lg: 0 5px 0 var(--edge), 0 14px 30px -14px var(--drop);',
				'--shadow-press: 0 1px 0 var(--edge);',
				'--press: translateY(calc(var(--lift) - 1px));',
				'--page-bg: radial-gradient(120% 60% at 50% -10%, var(--glow), transparent 70%) fixed, var(--bg);',
			];
	const sel = s.id === DEFAULT_STYLE ? `:root,\n[data-style='${s.id}'],\n[data-style='${s.id}'] [data-theme]` : `[data-style='${s.id}'],\n[data-style='${s.id}'] [data-theme]`;
	out.push(`${sel} {\n${[...common, ...shape].map((l) => `\t${l}`).join('\n')}\n}\n`);
}

out.push(`/* A font with no bold (Archivo Black) must not be made fake-bold. */
:root {
	font-synthesis: none;
}

/* Helpers every game can use. */
.ck-display {
	font-family: var(--font-display);
	font-weight: var(--display-weight);
	letter-spacing: var(--display-spacing);
}
`);

writeFileSync(new URL('../kit.css', import.meta.url), out.join('\n'));
console.log(`Wrote kit.css: ${THEMES.length} themes, ${Object.keys(STYLES).length} styles.`);
