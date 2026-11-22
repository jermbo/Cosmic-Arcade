import { CONFIG } from './config.ts';
import type { SavedReplay } from './sim/replay.ts';

/** What the game keeps between visits, in the storage of the browser. */

export interface LevelSave {
	best: number;
	bestChain: number;
	/** One flag for each goal of the junction, true when it was reached once. */
	goals: boolean[];
	replay?: SavedReplay;
}

export interface SaveData {
	tutorialDone: boolean;
	settings: { master: number; sfx: number; music: number; shake: number };
	levels: Record<string, LevelSave>;
}

const KEY = 'crash-report/save-v1';

function fresh(): SaveData {
	return {
		tutorialDone: false,
		settings: { master: CONFIG.audio.master, sfx: CONFIG.audio.sfx, music: CONFIG.audio.music, shake: 1 },
		levels: {},
	};
}

export function loadSave(): SaveData {
	const base = fresh();
	try {
		const text = localStorage.getItem(KEY);
		if (!text) return base;
		const data = JSON.parse(text) as Partial<SaveData>;
		return {
			tutorialDone: data.tutorialDone === true,
			settings: { ...base.settings, ...data.settings },
			levels: data.levels ?? {},
		};
	} catch {
		return base;
	}
}

export function storeSave(data: SaveData): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(data));
	} catch {
		// Storage can be full or blocked. The game still runs, it only forgets.
	}
}

export function clearSave(): SaveData {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// Nothing to do.
	}
	return fresh();
}

export function levelSave(data: SaveData, id: string, goalCount: number): LevelSave {
	let level = data.levels[id];
	if (!level) {
		level = { best: 0, bestChain: 0, goals: [] };
		data.levels[id] = level;
	}
	while (level.goals.length < goalCount) level.goals.push(false);
	return level;
}
