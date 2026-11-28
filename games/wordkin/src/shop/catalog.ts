// Everything the shop sells. Each item is bought once, then picked.
// The first item in each section is free and owned from the start (themes: the kit's free light and dark).
// Prices are drafts: tune them here.

import { FREE_THEMES, THEMES as KIT_THEMES } from '@arcade/cozy-kit/themes.js';

export type Category = 'theme' | 'tiles' | 'sound' | 'motion';

export interface ShopItem {
	id: string;
	name: string;
	price: number;
	blurb: string;
}

/** Theme prices. Tune here. The kit's FREE_THEMES (Oat and Plum) are always free. The themes themselves are the cozy kit's, shared with the other cozy games. */
const THEME_PRICE: Record<string, number> = { sage: 120, blossom: 120, sky: 150, tide: 200, hearth: 200 };

export const THEMES: ShopItem[] = KIT_THEMES.map((t) => ({ id: t.id, name: t.name, price: FREE_THEMES.includes(t.id) ? 0 : (THEME_PRICE[t.id] ?? 120), blurb: t.blurb }));

export const TILES: ShopItem[] = [
	{ id: 'classic', name: 'Classic', price: 0, blurb: 'Square-ish, hard shadow.' },
	{ id: 'pillow', name: 'Pillow', price: 100, blurb: 'Round and soft.' },
	{ id: 'sticker', name: 'Sticker', price: 120, blurb: 'Stuck on a bit crooked.' },
	{ id: 'stamp', name: 'Stamp', price: 150, blurb: 'A dashed inner edge.' },
	{ id: 'block', name: 'Block', price: 200, blurb: 'Chunky keys you can press.' },
];

export const SOUNDS: ShopItem[] = [
	{ id: 'paper', name: 'Paper', price: 0, blurb: 'Soft plucks and wood.' },
	{ id: 'musicbox', name: 'Music box', price: 100, blurb: 'Tiny bright bells.' },
	{ id: 'marimba', name: 'Marimba', price: 120, blurb: 'Round wooden bars.' },
	{ id: 'kalimba', name: 'Kalimba', price: 150, blurb: 'Thumb piano twang.' },
	{ id: 'glass', name: 'Glass', price: 200, blurb: 'Clear, ringing glass.' },
];

export const MOTIONS: ShopItem[] = [
	{ id: 'bouncy', name: 'Bouncy', price: 0, blurb: 'A little spring in every move.' },
	{ id: 'snappy', name: 'Snappy', price: 100, blurb: 'Quick and crisp.' },
	{ id: 'floaty', name: 'Floaty', price: 120, blurb: 'Slow and dreamy.' },
	{ id: 'jelly', name: 'Jelly', price: 180, blurb: 'Extra wobble.' },
];

export const SECTIONS: { id: Category; title: string; items: ShopItem[] }[] = [
	{ id: 'theme', title: 'Themes', items: THEMES },
	{ id: 'tiles', title: 'Tile styles', items: TILES },
	{ id: 'sound', title: 'Sounds', items: SOUNDS },
	{ id: 'motion', title: 'Motion', items: MOTIONS },
];

/** How each motion style moves: a speed factor and the spring curve. */
export const MOTION_FEEL: Record<string, { speed: number; spring: string; out: string }> = {
	bouncy: { speed: 1, spring: 'cubic-bezier(0.3, 1.5, 0.5, 1)', out: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
	snappy: { speed: 0.7, spring: 'cubic-bezier(0.2, 1.15, 0.4, 1)', out: 'cubic-bezier(0.15, 0.9, 0.2, 1)' },
	floaty: { speed: 1.4, spring: 'cubic-bezier(0.25, 1.25, 0.4, 1)', out: 'cubic-bezier(0.3, 0.6, 0.2, 1)' },
	jelly: { speed: 1.1, spring: 'cubic-bezier(0.3, 2, 0.45, 1)', out: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
};
