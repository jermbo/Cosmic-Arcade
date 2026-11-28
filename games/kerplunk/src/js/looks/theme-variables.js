// Writes the design values of a theme on the page as CSS variables. The game and the labs use it.

/** Writes the CSS variables of a theme on the page, and the browser's theme color. */
export function writeVariables(theme) {
	const root = document.documentElement;
	for (const [name, value] of Object.entries(cssVariables(theme))) root.style.setProperty(`--${name}`, value);
	root.toggleAttribute('data-dark', theme.dark);
	const themeColor = document.querySelector('meta[name="theme-color"]');
	if (themeColor) themeColor.content = theme.bg;
}

/** The CSS variable names (without "--") and their values. The CSS files use these names. */
function cssVariables(theme) {
	const variables = {
		bg: theme.bg,
		dot: theme.dot,
		text: theme.text,
		ink: theme.ink,
		shadow: theme.shadow,
		card: theme.card,
		accent: theme.accent,
		'on-accent': theme.onAccent,
		accent2: theme.accent2,
		'on-accent2': theme.onAccent2,
		well: theme.well,
		empty: theme.empty,
		'block-ink': theme.blockInk,
		bw: `${theme.outlineWidth}px`,
		sh: `${theme.shadowOffset}px`,
		// The sideways part of a shadow: as deep as it drops in Bold, none in Soft.
		shx: `${theme.shadowSideways ? theme.shadowOffset : 0}px`,
		r: `${theme.cornerRadius}px`,
		tilt: `${theme.tilt}deg`,
		'font-display': `'${theme.displayFont}', 'Arial Black', sans-serif`,
		'display-weight': theme.displayFont === 'Archivo Black' ? '400' : '800',
		'font-ui': `'${theme.uiFont}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
	};
	theme.blocks.forEach((color, index) => (variables[`c${index}`] = color));
	return variables;
}
