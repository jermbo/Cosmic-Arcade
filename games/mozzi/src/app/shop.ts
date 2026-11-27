/**
 * The shop: every item, every price and every coin reward lives here as data.
 * Add an item: add it to CATALOG, then give it a look:
 *  - theme: a `[data-theme='id']` block of color tokens in style.css;
 *  - tiles: `[data-tiles='id']` rules in style.css;
 *  - sound: an entry in PACKS in audio.ts.
 */
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

export const CATALOG: Item[] = [
	{ id: 'linen', kind: 'theme', name: 'Linen', blurb: 'Warm cream, like morning in the workshop.', price: 0, tone: 'light' },
	{ id: 'dusk', kind: 'theme', name: 'Dusk', blurb: 'Soft plum, for late-night windows.', price: 0, tone: 'dark' },
	{ id: 'meadow', kind: 'theme', name: 'Meadow', blurb: 'Fresh mint and spring light.', price: 60, tone: 'light' },
	{ id: 'blossom', kind: 'theme', name: 'Blossom', blurb: 'Peach and petal pink.', price: 60, tone: 'light' },
	{ id: 'deepsea', kind: 'theme', name: 'Deep Sea', blurb: 'Calm navy with a teal glow.', price: 90, tone: 'dark' },
	{ id: 'ember', kind: 'theme', name: 'Ember', blurb: 'Charcoal and a warm hearth.', price: 90, tone: 'dark' },

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

export const DEFAULT_LOOKS: Looks = { theme: 'linen', tiles: 'clay', sound: 'bells' };
export const FREE_ITEMS = CATALOG.filter((i) => i.price === 0).map((i) => i.id);
