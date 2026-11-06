import type { MapId } from './data/maps';

const KEY = 'crystal-siege';
const VERSION = 1;

export interface Settings {
	music: number;
	sfx: number;
	shake: boolean;
}

export interface SaveData {
	version: number;
	stars: Partial<Record<MapId, number>>;
	best: Partial<Record<MapId, number>>;
	unlocked: number;
	tutorialDone: boolean;
	settings: Settings;
}

function fresh(): SaveData {
	return {
		version: VERSION,
		stars: {},
		best: {},
		unlocked: 1,
		tutorialDone: false,
		settings: { music: 0.5, sfx: 0.8, shake: true },
	};
}

function read(): SaveData {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return fresh();
		const data = JSON.parse(raw) as SaveData;
		// A save from another version starts over. Later versions can convert old saves here.
		if (data.version !== VERSION) return fresh();
		return { ...fresh(), ...data, settings: { ...fresh().settings, ...data.settings } };
	} catch {
		return fresh();
	}
}

export const save: SaveData = read();

export function persist(): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(save));
	} catch {
		// Private windows can block storage. The game still plays.
	}
}

export function resetProgress(): void {
	const settings = save.settings;
	Object.assign(save, fresh(), { settings });
	persist();
}

/** Records a finished map. Returns true when the score is a new best. */
export function recordResult(map: MapId, index: number, stars: number, score: number): boolean {
	save.stars[map] = Math.max(save.stars[map] ?? 0, stars);
	const best = score > (save.best[map] ?? 0);
	if (best) save.best[map] = score;
	if (stars > 0) save.unlocked = Math.max(save.unlocked, index + 2);
	persist();
	return best;
}
