import { validateMap } from './validateMap';
import type { MapDef } from './maps';

const KEY = 'crystal-siege-custom-maps';

export function loadCustomMaps(): MapDef[] {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const list = JSON.parse(raw) as unknown;
		if (!Array.isArray(list)) return [];
		const maps: MapDef[] = [];
		for (const entry of list) {
			const { map } = validateMap(entry);
			if (map) maps.push(map);
		}
		return maps;
	} catch {
		return [];
	}
}

export function saveCustomMaps(maps: MapDef[]): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(maps));
	} catch {
		// Storage may be blocked.
	}
}

export function addCustomMap(map: MapDef): MapDef[] {
	const maps = loadCustomMaps().filter((m) => m.id !== map.id);
	maps.push(map);
	saveCustomMaps(maps);
	return maps;
}

export function removeCustomMap(id: string): MapDef[] {
	const maps = loadCustomMaps().filter((m) => m.id !== id);
	saveCustomMaps(maps);
	return maps;
}