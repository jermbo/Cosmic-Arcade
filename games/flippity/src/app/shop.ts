/**
 * The shop and the Pips: every item, every price and every reward lives here as data.
 * Add an item: add it to CATALOG, then give it a look:
 *  - theme: themes come from the cozy kit (games/cozy-kit/themes.js);
 *  - stone: a `.stones-<id>` block in style.css;
 *  - sound: an entry in PACKS in audio.ts.
 */
import { FREE_THEMES, THEMES } from '@arcade/cozy-kit/themes.js';
import type { BotId } from '../core/bot.ts';

export type Kind = 'theme' | 'stone' | 'sound';

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
	// Themes are the cozy kit's, shared with the other cozy games. Prices are Flippity's.
	...THEMES.map((t): Item => ({ id: t.id, kind: 'theme', name: t.name, blurb: t.blurb, price: FREE_THEMES.includes(t.id) ? 0 : (THEME_PRICE[t.id] ?? 60), tone: t.tone })),

	{ id: 'river', kind: 'stone', name: 'River stone', blurb: 'Smooth stones with soft speckles.', price: 0 },
	{ id: 'glass', kind: 'stone', name: 'Sea glass', blurb: 'Frosted glass, worn soft by the waves.', price: 80 },
	{ id: 'marble', kind: 'stone', name: 'Marble', blurb: 'Glass marbles with a ribbon of color inside.', price: 110 },
	{ id: 'gem', kind: 'stone', name: 'Gem', blurb: 'Cut rose quartz and amethyst.', price: 140 },

	{ id: 'plip', kind: 'sound', name: 'Plip', blurb: 'Drops of water, round and bright.', price: 0 },
	{ id: 'clack', kind: 'sound', name: 'Clack', blurb: 'Two river stones tapped together.', price: 60 },
	{ id: 'chime', kind: 'sound', name: 'Chime', blurb: 'Soft glass bells.', price: 80 },
	{ id: 'knock', kind: 'sound', name: 'Knock', blurb: 'Warm wooden blocks.', price: 80 },
];

export const itemById = (id: string) => CATALOG.find((i) => i.id === id);

/** What a game earns, against a bot only. Tune here. */
export const EARN = {
	/** A move that flips this many or more. The first match wins. */
	bigFlip: [
		{ min: 8, pips: 3, label: 'Huge flips' },
		{ min: 5, pips: 1, label: 'Big flips' },
	],
	/** A move that flips this many lines at once. The first match wins. */
	lines: [
		{ min: 3, pips: 3, label: 'Triple lines' },
		{ min: 2, pips: 2, label: 'Double lines' },
	],
	corner: { pips: 1, label: 'Corners' },
	win: { sleepy: 5, steady: 10, sharp: 20 } as Record<BotId, number>,
	draw: { sleepy: 2, steady: 4, sharp: 8 } as Record<BotId, number>,
	/** Extra for a win on a big board. */
	bigBoard: { 10: 5 } as Record<number, number>,
	/** A win that leaves the bot no pebbles. */
	wipeout: 10,
};

/** One free hint and one free undo per game; then they cost Pips. Tune here. */
export const HELP = { freeHints: 1, freeUndos: 1, hintPrice: 5, undoPrice: 3 };

export interface Earning {
	label: string;
	pips: number;
}

/** The Pips one move earns: big flips, many lines, corners. */
export function moveEarnings(flipped: number, lines: number, corner: boolean): Earning[] {
	const out: Earning[] = [];
	const big = EARN.bigFlip.find((b) => flipped >= b.min);
	if (big) out.push({ label: big.label, pips: big.pips });
	const ln = EARN.lines.find((l) => lines >= l.min);
	if (ln) out.push({ label: ln.label, pips: ln.pips });
	if (corner) out.push({ label: EARN.corner.label, pips: EARN.corner.pips });
	return out;
}

/** Adds up earnings with the same label: "Big flips ×3". */
export function groupEarnings(list: Earning[]): (Earning & { times: number })[] {
	const map = new Map<string, Earning & { times: number }>();
	for (const e of list) {
		const g = map.get(e.label);
		if (g) {
			g.pips += e.pips;
			g.times++;
		} else map.set(e.label, { ...e, times: 1 });
	}
	return [...map.values()];
}

export interface Looks {
	theme: string;
	stone: string;
	sound: string;
}

export const LOOK_KEY: Record<Kind, keyof Looks> = { theme: 'theme', stone: 'stone', sound: 'sound' };

export const DEFAULT_LOOKS: Looks = { theme: 'oat', stone: 'river', sound: 'plip' };
export const FREE_ITEMS = CATALOG.filter((i) => i.price === 0).map((i) => i.id);
