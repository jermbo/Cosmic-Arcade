import type { StateData } from './core/state.ts';

// Browser storage for settings and the checkpoint save. Old versions are dropped, not migrated.

const SAVE_KEY = 'exit-zero.save.v1';
const SETTINGS_KEY = 'exit-zero.settings.v1';
const CLEAR_KEY = 'exit-zero.cleared.v1';

export interface Settings {
	master: number;
	music: number;
	sfx: number;
	sensitivity: number;
	invertY: boolean;
	fov: number;
	view: 'first' | 'third';
	lines: 240 | 360 | 480;
	crt: boolean;
	wobble: boolean;
	bob: boolean;
	/** Tutorial cards already shown. Kept across new games. */
	tips: string[];
}

export const DEFAULT_SETTINGS: Settings = {
	master: 0.8,
	music: 0.6,
	sfx: 0.8,
	sensitivity: 1,
	invertY: false,
	fov: 75,
	view: 'first',
	lines: 240,
	crt: true,
	wobble: true,
	bob: true,
	tips: [],
};

export interface SaveData {
	v: 1;
	level: string;
	checkpoint: string;
	state: StateData;
	/** Seconds played. */
	time: number;
}

function read<T>(key: string): T | null {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

function write(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// private mode or full storage: the game still runs, it just won't remember
	}
}

export function loadSettings(): Settings {
	return { ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(SETTINGS_KEY) ?? {}) };
}

export function saveSettings(s: Settings): void {
	write(SETTINGS_KEY, s);
}

export function loadSave(): SaveData | null {
	const s = read<SaveData>(SAVE_KEY);
	return s && s.v === 1 ? s : null;
}

export function writeSave(s: SaveData): void {
	write(SAVE_KEY, s);
}

export function clearSave(): void {
	try {
		localStorage.removeItem(SAVE_KEY);
	} catch {
		// nothing to do
	}
}

export function markCleared(time: number): void {
	const best = read<{ time: number; count: number }>(CLEAR_KEY);
	write(CLEAR_KEY, { time: best ? Math.min(best.time, time) : time, count: (best?.count ?? 0) + 1 });
}

export function cleared(): { time: number; count: number } | null {
	return read(CLEAR_KEY);
}
