import type { SaveData } from './save';
import { GALAXY } from './world/galaxy';

export function ensureLitArray(save: SaveData): number[] {
	while (save.litByPlanet.length < GALAXY.length) save.litByPlanet.push(0);
	return save.litByPlanet;
}

export function planetLit(save: SaveData, index: number, live = 0): number {
	const saved = save.litByPlanet[index] ?? 0;
	return Math.max(saved, live);
}

export function recordPlanetLit(save: SaveData, index: number, lit: number): void {
	const arr = ensureLitArray(save);
	arr[index] = Math.max(arr[index] ?? 0, lit);
}

export function galaxyDiscoveredPercent(save: SaveData): number {
	const arr = ensureLitArray(save);
	let sum = 0;
	for (let i = 0; i < GALAXY.length; i++) sum += arr[i] ?? 0;
	return sum / GALAXY.length;
}

export interface DepartCheck {
	ok: boolean;
	reason?: string;
}

/** Can Pip leave planet `fromIdx` for the next world? */
export function canDepart(fromIdx: number, save: SaveData, prevLitLive: number, puzzleOk: boolean): DepartCheck {
	const next = GALAXY[fromIdx + 1];
	if (!next) return { ok: false, reason: 'No next world from here.' };
	if (save.wallet < next.arrivalStars) {
		const need = next.arrivalStars - save.wallet;
		return { ok: false, reason: `Your pouch needs ${need} more star${need === 1 ? '' : 's'} (${save.wallet} / ${next.arrivalStars}).` };
	}
	const prevLit = planetLit(save, fromIdx, prevLitLive);
	if (prevLit < next.minPrevLit) {
		const need = Math.ceil(next.minPrevLit * 100);
		const have = Math.floor(prevLit * 100);
		return { ok: false, reason: `Wake more of this world (${have}% / ${need}% explored).` };
	}
	const cur = GALAXY[fromIdx];
	if (cur.puzzleId && !puzzleOk) return { ok: false, reason: 'Finish this planet puzzle first.' };
	return { ok: true };
}