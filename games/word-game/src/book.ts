// The Kin Book: every bank group you solve yourself becomes a sticker.
// A full set of stickers gives Kip a hat.
import setsData from './data/sets.json' with { type: 'json' };
import { GROUP_BY_ID } from './core/bank.ts';
import { todayKey } from './core/rng.ts';
import { persist, save } from './save.ts';

export interface StickerSet {
	id: string;
	name: string;
	hat: string;
	hatName: string;
	groups: string[];
}

export const SETS: StickerSet[] = setsData as StickerSet[];
export const SET_OF_GROUP = new Map<string, StickerSet>();
for (const s of SETS) for (const g of s.groups) SET_OF_GROUP.set(g, s);

export const TOTAL_STICKERS = SETS.reduce((n, s) => n + s.groups.length, 0);

/** New stickers since the game began. The app reads it for the results card. */
export let newThisGame = 0;
export function resetGameStickers(): void {
	newThisGame = 0;
}

export function have(groupId: string): boolean {
	return !!save.book[groupId];
}

export function setProgress(set: StickerSet): number {
	return set.groups.filter(have).length;
}

export function setDone(set: StickerSet): boolean {
	return setProgress(set) === set.groups.length;
}

export function stickerCount(): number {
	return SETS.reduce((n, s) => n + setProgress(s), 0);
}

export interface Collected {
	isNew: boolean;
	theme: string;
	/** The set this sticker just finished, if any. */
	finished: StickerSet | null;
}

/** Adds a solve of a bank group. Hand-made groups are not in the book. */
export function collect(groupId: string): Collected | null {
	const group = GROUP_BY_ID.get(groupId);
	if (!group) return null;
	const entry = save.book[groupId];
	const isNew = !entry;
	if (entry) entry.n++;
	else save.book[groupId] = { n: 1, first: todayKey() };
	let finished: StickerSet | null = null;
	if (isNew) {
		newThisGame++;
		const set = SET_OF_GROUP.get(groupId);
		if (set && setDone(set)) {
			finished = set;
			save.hat ??= set.id;
		}
	}
	persist();
	return { isNew, theme: group.theme, finished };
}

export function wornHat(): StickerSet | null {
	const set = SETS.find((s) => s.id === save.hat);
	return set && setDone(set) ? set : null;
}
