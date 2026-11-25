// The save: meta progress, settings and the run in progress.
// Bump SAVE_VERSION when the shape changes. Old saves are wiped, never migrated.

import { newMeta, type MetaState } from './meta.ts';
import type { RunState } from './run.ts';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'requiver.save';

export interface Settings {
	sfx: number;
	music: number;
	/** 0 off, 0.5 low, 1 full. */
	shake: number;
	hitStop: boolean;
	haptics: boolean;
	/** Show the aim arc while pulling. */
	arc: boolean;
}

export interface SaveData {
	v: number;
	meta: MetaState;
	settings: Settings;
	run: RunState | null;
}

export function defaultSettings(): Settings {
	return { sfx: 0.8, music: 0.5, shake: 1, hitStop: true, haptics: true, arc: true };
}

export function freshSave(): SaveData {
	return { v: SAVE_VERSION, meta: newMeta(), settings: defaultSettings(), run: null };
}

/** Anything with getItem and setItem: localStorage in the game, a Map in the sim. */
export interface Store {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export function loadSave(store: Store): SaveData {
	try {
		const raw = store.getItem(SAVE_KEY);
		if (!raw) return freshSave();
		const data = JSON.parse(raw) as SaveData;
		if (data?.v !== SAVE_VERSION) {
			store.removeItem(SAVE_KEY);
			return freshSave();
		}
		const fresh = freshSave();
		return { v: SAVE_VERSION, meta: { ...fresh.meta, ...data.meta }, settings: { ...fresh.settings, ...data.settings }, run: data.run ?? null };
	} catch {
		return freshSave();
	}
}

export function writeSave(store: Store, data: SaveData) {
	try {
		store.setItem(SAVE_KEY, JSON.stringify(data));
	} catch {
		// Storage full or blocked. The game still plays.
	}
}
