import type { EnemyId } from './enemies';
import { validateMapList } from './validateMap';

export type MapId = string;
export type Point = [number, number];

export interface Group {
	type: EnemyId;
	count: number;
	/** Seconds between two enemies of the group. */
	gap: number;
	/** Seconds after the wave starts. */
	delay: number;
	elite?: boolean;
	/** Index of the path. Without it, the group takes turns over all paths. */
	path?: number;
}

export interface MapDef {
	id: MapId;
	name: string;
	blurb: string;
	theme: 'grass' | 'snow';
	w: number;
	h: number;
	/** Each path is a list of corner cells [column, row]: the spawn first, the crystal last. */
	paths: Point[][];
	/** Rivers may start and end outside the grid. */
	rivers: Point[][];
	decorSeed: number;
	decorDensity: number;
	startGold: number;
	/** Health of every enemy, bosses too. */
	hpScale: number;
	/** How fast health grows with each wave. */
	hpGrowth: number;
	waves: Group[][];
}

/** Official campaign maps, loaded from public/maps/official.json. */
export let MAPS: MapDef[] = [];

export async function loadOfficialMaps(): Promise<void> {
	const response = await fetch('./maps/official.json');
	if (!response.ok) throw new Error(`Could not load official maps (${response.status}).`);
	MAPS = validateMapList(await response.json());
}

export function mapById(id: MapId): MapDef {
	return MAPS.find((map) => map.id === id) ?? MAPS[0];
}

/** Numbers that tune the difficulty of every map. */
export const BALANCE = {
	hpCurve: 0.022,
	clearBonus: 10,
	clearPerWave: 1,
};

/** Health grows with each wave. Bosses do not grow; each map sets their size. */
export function waveHpScale(map: MapDef, wave: number): number {
	const w = wave - 1;
	return (1 + map.hpGrowth * w + BALANCE.hpCurve * w * w) * map.hpScale;
}