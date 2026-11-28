/**
 * The shop: every item, every price and every coin reward lives here as data.
 * Add an item: add it to CATALOG, then give it a look:
 *  - theme: themes come from the cozy kit (games/cozy-kit/themes.js);
 *  - line: a case in LINE_LOOKS (src/ui/Board.tsx);
 *  - dot: a case in DOT_LOOKS (src/ui/Board.tsx);
 *  - sound: an entry in PACKS in audio.ts.
 */
import { FREE_THEMES, THEMES } from '@arcade/cozy-kit/themes.js';
import type { Level } from '../core/types.ts';

export type Kind = 'theme' | 'line' | 'dot' | 'sound';

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
	// Themes are the cozy kit's, shared with the other cozy games. Prices are Hueway's.
	...THEMES.map((t): Item => ({ id: t.id, kind: 'theme', name: t.name, blurb: t.blurb, price: FREE_THEMES.includes(t.id) ? 0 : (THEME_PRICE[t.id] ?? 60), tone: t.tone })),

	{ id: 'ribbon', kind: 'line', name: 'Ribbon', blurb: 'A soft, round ribbon with a sheen.', price: 0 },
	{ id: 'yarn', kind: 'line', name: 'Yarn', blurb: 'Twisted wool with little stitches.', price: 80 },
	{ id: 'brush', kind: 'line', name: 'Brush', blurb: 'A wet brush stroke that pools at the ends.', price: 100 },
	{ id: 'glass', kind: 'line', name: 'Glass', blurb: 'A clear tube with light inside.', price: 120 },

	{ id: 'pebble', kind: 'dot', name: 'Pebble', blurb: 'Smooth round stones.', price: 0 },
	{ id: 'button', kind: 'dot', name: 'Button', blurb: 'Sewing buttons with four holes.', price: 60 },
	{ id: 'gem', kind: 'dot', name: 'Gem', blurb: 'Cut gems that catch the light.', price: 100 },
	{ id: 'bloom', kind: 'dot', name: 'Bloom', blurb: 'Little five-petal flowers.', price: 120 },

	{ id: 'chimes', kind: 'sound', name: 'Chimes', blurb: 'Soft glass bells on every step.', price: 0 },
	{ id: 'kalimba', kind: 'sound', name: 'Kalimba', blurb: 'Warm wooden plucks.', price: 100 },
	{ id: 'felt', kind: 'sound', name: 'Felt Piano', blurb: 'Muted piano notes, close and quiet.', price: 100 },
];

export const itemById = (id: string) => CATALOG.find((i) => i.id === id);

/** What a finished puzzle earns. Tune here. */
export const EARN = {
	level: { easy: 8, medium: 12, hard: 16, expert: 22, master: 30 } as Record<Level, number>,
	noHints: 8,
	/** Every line drawn in one go: as many moves as colors. */
	perfect: 6,
	newBest: 5,
	daily: 5,
	/** Per day of the streak, up to streakMax. Daily puzzles only. */
	streakPerDay: 2,
	streakMax: 10,
};

/** What the Endless modes earn. Tune here. */
export const EARN_ENDLESS = {
	/** Clock run: per board solved in the run. */
	clockPerBoard: 2,
	/** Clock run: a run that beats your best. */
	clockBest: 10,
	/** Road trip: per stop reached. */
	roadPerStop: 3,
	/** Road trip: every this many stops on one trip… */
	roadMilestone: 10,
	/** …earns this much more. */
	roadMilestoneCoins: 10,
};

export interface Earning {
	label: string;
	coins: number;
}

export const LEVEL_NAME: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert', master: 'Master' };

export function earnings(o: { level: Level; hints: number; perfect: boolean; isBest: boolean; dailyToday: boolean; streak: number }): Earning[] {
	const out: Earning[] = [{ label: `${LEVEL_NAME[o.level]} puzzle`, coins: EARN.level[o.level] }];
	if (o.hints === 0) out.push({ label: 'No hints', coins: EARN.noHints });
	if (o.perfect) out.push({ label: 'Perfect lines', coins: EARN.perfect });
	if (o.isBest) out.push({ label: 'New best time', coins: EARN.newBest });
	if (o.dailyToday) {
		out.push({ label: 'Today’s puzzle', coins: EARN.daily });
		if (o.streak > 1) out.push({ label: `${o.streak}-day streak`, coins: Math.min(EARN.streakMax, o.streak * EARN.streakPerDay) });
	}
	return out;
}

export interface Looks {
	theme: string;
	line: string;
	dot: string;
	sound: string;
}

export const LOOK_KEY: Record<Kind, keyof Looks> = { theme: 'theme', line: 'line', dot: 'dot', sound: 'sound' };

export const DEFAULT_LOOKS: Looks = { theme: 'oat', line: 'ribbon', dot: 'pebble', sound: 'chimes' };
export const FREE_ITEMS = CATALOG.filter((i) => i.price === 0).map((i) => i.id);
