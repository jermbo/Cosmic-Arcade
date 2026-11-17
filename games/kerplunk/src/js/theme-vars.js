// Writes the design variables of a theme on the page. The game and the shape lab both use it.

/** Writes the design variables of a theme on the page. */
export function writeVariables(t) {
	const root = document.documentElement;
	const vars = {
		bg: t.bg,
		dot: t.dot,
		text: t.text,
		ink: t.ink,
		shadow: t.shadow,
		card: t.card,
		accent: t.accent,
		'on-accent': t.onAccent,
		accent2: t.accent2,
		'on-accent2': t.onAccent2,
		well: t.well,
		empty: t.empty,
		'block-ink': t.blockInk,
		bw: `${t.bw}px`,
		sh: `${t.sh}px`,
		r: `${t.r}px`,
		tilt: `${t.tilt}deg`,
		'font-display': `'${t.display}', 'Arial Black', sans-serif`,
	};
	t.blocks.forEach((c, i) => (vars[`c${i}`] = c));
	for (const [k, v] of Object.entries(vars)) root.style.setProperty(`--${k}`, v);
	root.toggleAttribute('data-dark', t.dark);
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) meta.content = t.bg;
}
