import { GALAXY } from './world/galaxy';

const KEY = 'planet-hop.v2';
const LEGACY = 'planet-hop.v1';

export interface Settings {
	master: number;
	music: number;
	sfx: number;
	sensitivity: number;
	invertY: boolean;
	cameraAssist: boolean;
	reduceMotion: boolean;
	quality: 'high' | 'low';
	/** Drag on the game view (HUD stays clickable) vs captured pointer (FPS style). */
	lookMode: 'drag' | 'capture';
}

export interface SaveData {
	version: 2;
	settings: Settings;
	tutorialDone: boolean;
	bestTime: number | null;
	bestDust: number;
	clears: number;
	/** Total stars kept in the pouch across runs. */
	wallet: number;
	/** Highest planet index reached at least once. */
	furthestPlanet: number;
	/** Best awake fraction per planet (0–1). */
	litByPlanet: number[];
}

export function defaultSettings(touch: boolean): Settings {
	return {
		master: 0.8,
		music: 0.6,
		sfx: 0.8,
		sensitivity: 1,
		invertY: false,
		cameraAssist: true,
		reduceMotion: false,
		quality: touch ? 'low' : 'high',
		lookMode: 'drag',
	};
}

function freshSave(touch: boolean): SaveData {
	return {
		version: 2,
		settings: defaultSettings(touch),
		tutorialDone: false,
		bestTime: null,
		bestDust: 0,
		clears: 0,
		wallet: 0,
		furthestPlanet: 0,
		litByPlanet: new Array(GALAXY.length).fill(0),
	};
}

function migrateV1(raw: string, touch: boolean): SaveData {
	const base = freshSave(touch);
	try {
		const data = JSON.parse(raw) as Partial<SaveData> & { version?: number };
		return {
			...base,
			settings: { ...base.settings, ...data.settings },
			tutorialDone: !!data.tutorialDone,
			bestTime: data.bestTime ?? null,
			bestDust: data.bestDust ?? 0,
			clears: data.clears ?? 0,
		};
	} catch {
		return base;
	}
}

export function loadSave(touch: boolean): SaveData {
	const fresh = freshSave(touch);
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const data = JSON.parse(raw) as Partial<SaveData>;
			if (data.version === 2) {
				return {
					...fresh,
					...data,
					settings: { ...fresh.settings, ...data.settings },
					litByPlanet: [...(data.litByPlanet ?? fresh.litByPlanet)],
				};
			}
		}
		const old = localStorage.getItem(LEGACY);
		if (old) return migrateV1(old, touch);
	} catch {
		// Private mode or full storage: the game still plays.
	}
	return fresh;
}

export function writeSave(data: SaveData): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(data));
	} catch {
		// Private mode or full storage: the game still plays.
	}
}