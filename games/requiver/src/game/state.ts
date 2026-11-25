// The live save: meta progress, settings and the run in progress. Written to localStorage.

import { loadSave, writeSave, type SaveData, type Store } from '../rules/save.ts';
import { setVolumes } from './audio.ts';

const memory = new Map<string, string>();
const store: Store = {
	getItem: (key) => {
		try {
			return localStorage.getItem(key);
		} catch {
			return memory.get(key) ?? null;
		}
	},
	setItem: (key, value) => {
		try {
			localStorage.setItem(key, value);
		} catch {
			memory.set(key, value);
		}
	},
	removeItem: (key) => {
		try {
			localStorage.removeItem(key);
		} catch {
			memory.delete(key);
		}
	},
};

export const game: { save: SaveData } = { save: loadSave(store) };

export const persist = () => writeSave(store, game.save);

export function applySettings() {
	const s = game.save.settings;
	setVolumes(s.sfx, s.music);
}

/** Wipes everything and starts fresh. */
export function eraseSave() {
	store.removeItem('requiver.save');
	game.save = loadSave(store);
	persist();
	applySettings();
}

export function haptic(ms: number) {
	if (!game.save.settings.haptics) return;
	try {
		navigator.vibrate?.(ms);
	} catch {
		// Not supported.
	}
}
