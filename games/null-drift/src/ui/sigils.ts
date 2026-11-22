/** Line-art marks for each daemon. They draw with currentColor. */
const SIGILS: Record<string, string> = {
	eye: `
		<circle cx="32" cy="32" r="20"/>
		<circle cx="32" cy="32" r="8"/>
		<circle cx="32" cy="32" r="2.5" fill="currentColor"/>
		<path d="M32 4v8M32 52v8M4 32h8M52 32h8"/>`,
	legs: `
		<ellipse cx="32" cy="34" rx="12" ry="9"/>
		<circle cx="27" cy="31" r="1.8" fill="currentColor"/>
		<circle cx="37" cy="31" r="1.8" fill="currentColor"/>
		<path d="M21 30 10 22 6 26M20 35H6M21 39 10 47 6 44M43 30 54 22 58 26M44 35H58M43 39 54 47 58 44"/>`,
	jaw: `
		<path d="M10 22h44l-6 10H16z"/>
		<path d="M16 22l4 8 4-8 4 8 4-8 4 8 4-8 4 8 4-8"/>
		<path d="M10 44h44l-6-8H16z"/>
		<path d="M16 44l4-7 4 7 4-7 4 7 4-7 4 7 4-7 4 7"/>`,
	glitch: `
		<rect x="14" y="14" width="30" height="12"/>
		<rect x="22" y="26" width="30" height="10"/>
		<rect x="10" y="36" width="26" height="14"/>
		<path d="M44 42h10M4 20h6M40 54h8"/>
		<text x="32" y="47" font-size="13" text-anchor="middle" fill="currentColor" stroke="none" font-family="monospace">??</text>`,
	hunter: `
		<path d="M32 6 58 54H6z"/>
		<circle cx="32" cy="38" r="9"/>
		<path d="M32 24v6M32 46v6M18 38h6M40 38h6"/>
		<circle cx="32" cy="38" r="2" fill="currentColor"/>`,
	warden: `
		<path d="M32 4 56 18v28L32 60 8 46V18z"/>
		<path d="M32 12 48 21v22L32 52 16 43V21z"/>
		<path d="M20 32c4-6 8-8 12-8s8 2 12 8c-4 6-8 8-12 8s-8-2-12-8z"/>
		<circle cx="32" cy="32" r="3.5" fill="currentColor"/>
		<path d="M4 32h4M56 32h4"/>`,
};

export function sigil(key: string): string {
	return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">${SIGILS[key] ?? SIGILS.glitch}</svg>`;
}
