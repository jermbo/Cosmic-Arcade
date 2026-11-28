/**
 * The shop: every item, every price and every coin reward lives here as data.
 * Add an item: add it to CATALOG, then give it a look:
 *  - theme: themes come from the cozy kit (games/cozy-kit/themes.js);
 *  - tiles: `[data-tiles='id']` rules in style.css;
 *  - sound: an entry in PACKS in audio.ts.
 */
import { FREE_THEMES, THEMES } from '@arcade/cozy-kit/themes.js';
import type { Level } from '../core/types.ts';

export type Kind = 'theme' | 'tiles' | 'sound';

export interface Item {
	id: string;
	kind: Kind;
	name: string;
	blurb: string;
	price: number;
	/** Themes only: light or dark. */
	tone?: 'light' | 'dark';
}

/** Theme prices. Tune here. The kit's FREE_THEMES (Oat and Plum) are always free. */
const THEME_PRICE: Record<string, number> = { sage: 60, blossom: 60, sky: 60, tide: 90, hearth: 90 };

export const CATALOG: Item[] = [
	// Themes are the cozy kit's, shared with the other cozy games. Prices are Mozzi's.
	...THEMES.map((t): Item => ({ id: t.id, kind: 'theme', name: t.name, blurb: t.blurb, price: FREE_THEMES.includes(t.id) ? 0 : (THEME_PRICE[t.id] ?? 60), tone: t.tone })),

	{ id: 'clay', kind: 'tiles', name: 'Clay', blurb: 'Soft, puffy tiles that press down.', price: 0 },
	{ id: 'paper', kind: 'tiles', name: 'Paper', blurb: 'Flat cut paper with a crisp edge.', price: 80 },
	{ id: 'glass', kind: 'tiles', name: 'Glass', blurb: 'Clear panes with a bright sheen.', price: 120 },
	{ id: 'gem', kind: 'tiles', name: 'Gem', blurb: 'Cut facets that catch the light.', price: 150 },

	{ id: 'bells', kind: 'sound', name: 'Glass Bells', blurb: 'Soft bells and a slow music box.', price: 0 },
	{ id: 'kalimba', kind: 'sound', name: 'Kalimba', blurb: 'Warm wooden plucks and a gentle groove.', price: 100 },
	{ id: 'felt', kind: 'sound', name: 'Felt Piano', blurb: 'Muted piano notes, close and quiet.', price: 100 },
];

export const itemById = (id: string) => CATALOG.find((i) => i.id === id);

/** What a finished window earns. Tune here. */
export const EARN = {
	level: { easy: 10, medium: 15, hard: 20, expert: 30 } as Record<Level, number>,
	noHints: 10,
	newBest: 5,
	daily: 5,
	/** Per day of the streak, up to streakMax. Daily windows only. */
	streakPerDay: 2,
	streakMax: 10,
};

export interface Earning {
	label: string;
	coins: number;
}

export function earnings(o: { level: Level; hints: number; isBest: boolean; dailyToday: boolean; streak: number }): Earning[] {
	const out: Earning[] = [{ label: `${o.level[0].toUpperCase()}${o.level.slice(1)} window`, coins: EARN.level[o.level] }];
	if (o.hints === 0) out.push({ label: 'No hints', coins: EARN.noHints });
	if (o.isBest) out.push({ label: 'New best time', coins: EARN.newBest });
	if (o.dailyToday) {
		out.push({ label: 'Today’s window', coins: EARN.daily });
		if (o.streak > 1) out.push({ label: `${o.streak}-day streak`, coins: Math.min(EARN.streakMax, o.streak * EARN.streakPerDay) });
	}
	return out;
}

export interface Looks {
	theme: string;
	tiles: string;
	sound: string;
}

export const DEFAULT_LOOKS: Looks = { theme: 'oat', tiles: 'clay', sound: 'bells' };
export const FREE_ITEMS = CATALOG.filter((i) => i.price === 0).map((i) => i.id);
