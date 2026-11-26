// Kip's hats, one per sticker set. Each is drawn in a 64 x 40 box that sits on Kip's head.

const INK = '#141414';
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

export const HATS: Record<string, string> = {
	chef: `<path d="M18 38V27a9 9 0 0 1 4-17 11 11 0 0 1 20 0 9 9 0 0 1 4 17v11z" fill="#fff" ${S}/><path d="M18 31h28" ${S}/><path d="M28 20v6M36 18v8" ${S}/>`,
	sprout: `<path d="M32 39V22" ${S} fill="none"/><path d="M32 24c-2-9-10-13-18-11 1 8 9 13 18 11z" fill="#3bd68d" ${S}/><path d="M32 20c3-9 11-12 19-9-2 8-10 12-19 9z" fill="#7be8b0" ${S}/>`,
	beanie: `<path d="M12 38a20 20 0 0 1 40 0z" fill="#5cc8f2" ${S}/><rect x="10" y="32" width="44" height="7" rx="3" fill="#ffd23f" ${S}/><circle cx="32" cy="12" r="5" fill="#ff9a62" ${S}/><path d="M24 22v8M32 19v11M40 22v8" stroke="#2c8fb8" stroke-width="2.5" stroke-linecap="round"/>`,
	party: `<path d="M20 38L33 4l13 34z" fill="#b993ff" ${S}/><path d="M24 28l17-6M27 19l11-4" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/><circle cx="33" cy="5" r="4.5" fill="#ff6b9a" ${S}/>`,
	grad: `<path d="M32 12L6 21l26 9 26-9z" fill="${INK}" ${S}/><path d="M18 26v9c8 5 20 5 28 0v-9l-14 5z" fill="#3a3a3a" ${S}/><path d="M52 23v10" stroke="#ffd23f" stroke-width="3" stroke-linecap="round"/><circle cx="52" cy="35" r="3" fill="#ffd23f" ${S}/>`,
	tophat: `<rect x="20" y="4" width="24" height="30" rx="2" fill="#2b2b2b" ${S}/><rect x="20" y="24" width="24" height="7" fill="#ff6b9a" ${S}/><rect x="10" y="33" width="44" height="6" rx="3" fill="#2b2b2b" ${S}/>`,
	crown: `<path d="M12 38V14l10 10 10-16 10 16 10-10v24z" fill="#ffd23f" ${S}/><circle cx="22" cy="31" r="3" fill="#ff6b9a" ${S}/><circle cx="32" cy="31" r="3" fill="#5cc8f2" ${S}/><circle cx="42" cy="31" r="3" fill="#3bd68d" ${S}/>`,
	sleuth: `<path d="M10 38c0-16 10-26 22-26s22 10 22 26z" fill="#c69462" ${S}/><path d="M18 22l28 10M18 30l28-8" stroke="#8a5a2e" stroke-width="2.5" stroke-linecap="round"/><path d="M8 38h48" ${S}/><path d="M32 12V7" ${S}/>`,
};

export function hatSvg(hat: string): string {
	return `<svg viewBox="0 0 64 40" aria-hidden="true">${HATS[hat] ?? ''}</svg>`;
}
