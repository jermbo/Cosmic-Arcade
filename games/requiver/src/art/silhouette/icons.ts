// Icons as SVG, drawn in a 24 x 24 box with currentColor. The DOM uses them inline; the map loads them as sprites.

const stroke = (w = 2.4) => `stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
const S = stroke();
const F = 'fill="currentColor"';

export const ICONS: Record<string, string> = {
	// Map spots.
	fight: `<path ${S} d="M5 19 18.5 5.5M19 19 5.5 5.5M4 15v4h4M20 15v4h-4"/><path ${F} d="M20.5 3.5 13.8 5l5.2 5.2zM3.5 3.5 10.2 5 5 10.2z"/>`,
	elite: `<path ${F} fill-rule="evenodd" d="M12 6c-4.3 0-7 2.8-7 6.4 0 2.2 1 3.7 2.5 4.6V20h9v-3c1.5-.9 2.5-2.4 2.5-4.6C19 8.8 16.3 6 12 6zM9 11.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zm6 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"/><path ${F} d="M6.2 9.2C3.6 7.6 2.6 4.8 3.4 2.4c1 2 2.8 3.2 4.8 3.8zM17.8 9.2c2.6-1.6 3.6-4.4 2.8-6.8-1 2-2.8 3.2-4.8 3.8z"/>`,
	shop: `<path ${F} fill-rule="evenodd" d="M8.5 3h7l-1.8 3.4h-3.4zM7.4 7.8h9.2c2.2 2 3.6 5 3.6 8 0 3.4-2.6 5.2-8.2 5.2s-8.2-1.8-8.2-5.2c0-3 1.4-6 3.6-8zM12 11.2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>`,
	rest: `<path ${F} d="M12 2.5c1.2 3.2 4.6 4.6 4.6 8.6a4.6 4.6 0 0 1-9.2 0c0-2.3 1.2-3.6 2.3-4.6.1 2.1 1 3.2 2.1 3.4-.4-2.8-.8-5.2.2-7.4z"/><path ${S} d="M4 20.5 20 16.5M4 16.5l16 4"/>`,
	event: `<path ${stroke(3)} d="M8.6 8.6a3.6 3.6 0 1 1 5.4 3.1c-1.1.7-2 1.5-2 3v.8"/><circle ${F} cx="12" cy="19.6" r="1.9"/>`,
	treasure: `<path ${F} fill-rule="evenodd" d="M3.5 11h17v9h-17zM10.5 12.5v4h3v-4z"/><path ${F} d="M3.5 10c0-3.3 2.6-5.5 8.5-5.5s8.5 2.2 8.5 5.5z"/>`,
	boss: `<path ${F} d="M3 18.5 2 7l5 4.2 5-7.2 5 7.2 5-4.2-1 11.5zM3 20h18v2.2H3z"/>`,
	start: `<circle ${F} cx="12" cy="12" r="5"/>`,

	// Boosts.
	split: `<path ${S} d="M3 19l7-6M10 13l9-8M10 13l10-1M10 13l8 6"/><path ${F} d="m21 3-4.6 1.6 3 3zM22 12l-4.4-2.2v4.4zM20.6 20.8l-2.6-4.2-2.6 3z"/>`,
	fire: `<path ${F} d="M12 1.8c2.2 4.2 6.8 6.4 6.8 11.6a6.8 6.8 0 0 1-13.6 0c0-3.2 1.8-5.4 3.4-6.6 0 2.4 1 4 2.6 4.4-.8-3.8-.6-6.8.8-9.4z"/>`,
	ice: `<path ${S} d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 3.5l3 2.4 3-2.4M9 20.5l3-2.4 3 2.4"/>`,
	pierce: `<circle ${S} cx="12" cy="12" r="5"/><path ${S} d="M2 12h17"/><path ${F} d="M23 12l-5.4-3v6z"/>`,
	bounce: `<path ${S} d="M2.5 9c2.5 0 3.2 11 5.8 11s3.4-8 5.8-8 2.8 5 4.4 5"/><path ${F} d="m22.5 18.5-5.4.6 2.6 3.6z"/><path ${S} d="M1.5 21.5h21"/>`,
	homing: `<circle ${S} cx="18" cy="6" r="3.4"/><circle ${F} cx="18" cy="6" r="1.2"/><path ${S} d="M3 21c0-8 4-13 11.4-13.4"/><path ${F} d="M16.4 7.4 11.6 4.4l.6 6z"/>`,
	explosive: `<path ${F} d="M12 1.5l2.2 5.4 5.8-2.2-2.4 5.6 5.4 2.2-5.6 2 2.4 5.8-5.8-2.4L12 22.5l-2-5.6-5.8 2.4 2.4-5.8-5.6-2 5.4-2.2-2.4-5.6 5.8 2.2z"/>`,
	quickdraw: `<path ${S} d="M13 3c5 3 5 15 0 18M13 3v18"/><path ${S} d="M2 8h7M4 12h7M2 16h7"/>`,
	power: `<path ${S} d="M9 3c6 3 6 15 0 18M9 3v18"/><path ${F} d="M18 2l-4 9h3.4L15 22l6.4-12.6H18L20.6 2z"/>`,
	multishot: `<path ${S} d="M3 6h13M3 12h13M3 18h13"/><path ${F} d="M21.5 6 16 3v6zM21.5 12 16 9v6zM21.5 18 16 15v6z"/>`,
	heart: `<path ${F} d="M12 21.2C6 16.6 2.4 13.4 2.4 8.8 2.4 5.6 4.8 3.4 7.6 3.4c1.9 0 3.4 1 4.4 2.6 1-1.6 2.5-2.6 4.4-2.6 2.8 0 5.2 2.2 5.2 5.4 0 4.6-3.6 7.8-9.6 12.4z"/>`,
	ward: `<path ${F} fill-rule="evenodd" d="M12 1.8 21 5v6.2c0 5.4-3.6 9.4-9 11-5.4-1.6-9-5.6-9-11V5zm0 4.2-5 1.8v4c0 3 1.8 5.4 5 6.6z"/>`,
	thorns: `<path ${F} d="M12 1.5l1.6 4.6 4.2-2.4-1.2 4.8 4.8.6-3.8 3 3.8 3-4.8.6 1.2 4.8-4.2-2.4L12 22.5l-1.6-4.4-4.2 2.4 1.2-4.8-4.8-.6 3.8-3-3.8-3 4.8-.6-1.2-4.8 4.2 2.4z"/>`,
	mend: `<path ${F} d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>`,
	wall: `<path ${F} d="M3 22V8l2-3 2 3v14zM8.5 22V6l2-3 2 3v16zM14 22V7l2-3 2 3v15zM19.2 22V9l1.8-2.6L22.6 9v13z"/><path ${stroke(1.6)} d="M2 12h21M2 18h21"/>`,
	spikes: `<path ${F} d="M1.5 21 5 12l3.5 9zM8.2 21l3.8-11 3.8 11zM15.5 21 19 12l3.5 9z"/>`,
	helper: `<circle ${F} cx="8" cy="5" r="3"/><path ${S} d="M8 8.5v7M8 15.5l-3 6M8 15.5l3 6M8 11l6 0"/><path ${S} d="M15 4c4 3 4 12 0 15M15 4v15"/>`,

	// Interface.
	coin: `<circle ${F} cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#0d0a10" stroke-opacity="0.35" stroke-width="2"/>`,
	feather: `<path ${F} d="M20.5 3.5C12.6 3.8 6.4 9 5.6 16.2l-2.8 2.8 1.4 1.4 2.8-2.8c7.2-.8 12.4-7 13.5-14.1zM9 15l6.6-6.6"/>`,
	hp: `<path ${F} d="M12 21.2C6 16.6 2.4 13.4 2.4 8.8 2.4 5.6 4.8 3.4 7.6 3.4c1.9 0 3.4 1 4.4 2.6 1-1.6 2.5-2.6 4.4-2.6 2.8 0 5.2 2.2 5.2 5.4 0 4.6-3.6 7.8-9.6 12.4z"/>`,
	pause: `<path ${F} d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/>`,
	play: `<path ${F} d="M7 4l13 8-13 8z"/>`,
	gear: `<path ${F} fill-rule="evenodd" d="M10.3 1.8h3.4l.6 2.9 2 .9 2.5-1.6 2.4 2.4-1.6 2.5.9 2 2.9.6v3.4l-2.9.6-.9 2 1.6 2.5-2.4 2.4-2.5-1.6-2 .9-.6 2.9h-3.4l-.6-2.9-2-.9-2.5 1.6-2.4-2.4 1.6-2.5-.9-2-2.9-.6v-3.4l2.9-.6.9-2-1.6-2.5 2.4-2.4 2.5 1.6 2-.9zM12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z"/>`,
	close: `<path ${stroke(3.2)} d="M5 5l14 14M19 5 5 19"/>`,
	back: `<path ${stroke(3)} d="M15 4 7 12l8 8"/>`,
	quiver: `<path ${F} d="M7 9.5 15.5 21l3.5-2.6L10.5 7z"/><path ${S} d="M8 8 4 2.5M10 7 8 1.5M12 6.2 12.2 1"/>`,
	tree: `<path ${F} d="M12 2 4 12h4l-5 7h18l-5-7h4z"/><path ${F} d="M10.5 19h3v3.5h-3z"/>`,
	skull: `<path ${F} fill-rule="evenodd" d="M12 3c-4.6 0-8 3-8 7.2 0 2.4 1.2 4.2 3 5.2V20h10v-4.6c1.8-1 3-2.8 3-5.2C20 6 16.6 3 12 3zM8.8 9.4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6.4 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>`,
	crown: `<path ${F} d="M3 18.5 2 7l5 4.2 5-7.2 5 7.2 5-4.2-1 11.5zM3 20h18v2.2H3z"/>`,
	bow: `<path ${S} d="M7 2.5c8 3.6 8 15.4 0 19M7 2.5v19"/><path ${S} d="M3 12h16"/><path ${F} d="M22 12l-5-2.8v5.6z"/>`,
	target: `<circle ${S} cx="12" cy="12" r="9"/><circle ${S} cx="12" cy="12" r="4.6"/><circle ${F} cx="12" cy="12" r="1.6"/>`,
};

export function iconSvg(name: string, size = 24, color = 'currentColor'): string {
	const body = (ICONS[name] ?? ICONS.target).replaceAll('currentColor', color);
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" style="color:${color}">${body}</svg>`;
}

/** A data URL for KAPLAY's loadSprite. */
export function iconUrl(name: string, size: number, color: string): string {
	return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(name, size, color));
}
