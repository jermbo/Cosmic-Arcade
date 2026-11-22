const KEY = 'planet-hop.v1';

export interface Settings {
	master: number;
	music: number;
	sfx: number;
	sensitivity: number;
	invertY: boolean;
	cameraAssist: boolean;
	reduceMotion: boolean;
	quality: 'high' | 'low';
}

export interface SaveData {
	version: 1;
	settings: Settings;
	tutorialDone: boolean;
	bestTime: number | null;
	bestDust: number;
	clears: number;
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
	};
}

export function loadSave(touch: boolean): SaveData {
	const fresh: SaveData = {
		version: 1,
		settings: defaultSettings(touch),
		tutorialDone: false,
		bestTime: null,
		bestDust: 0,
		clears: 0,
	};
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return fresh;
		const data = JSON.parse(raw) as Partial<SaveData>;
		if (data.version !== 1) return fresh;
		return { ...fresh, ...data, settings: { ...fresh.settings, ...data.settings } };
	} catch {
		return fresh;
	}
}

export function writeSave(data: SaveData): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(data));
	} catch {
		// Private mode or full storage: the game still plays.
	}
}
