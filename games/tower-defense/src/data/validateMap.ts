import { ENEMIES, type EnemyId } from './enemies';
import type { Group, MapDef, Point } from './maps';
import { expand } from './pathGeometry';

export interface MapIssue {
	path: string;
	message: string;
}

const ENEMY_IDS = new Set<string>(Object.keys(ENEMIES));
const THEMES = new Set(['grass', 'snow']);

function isPoint(value: unknown): value is Point {
	return Array.isArray(value) && value.length === 2 && Number.isInteger(value[0]) && Number.isInteger(value[1]);
}

/** Turns partial or unknown JSON into a map, with defaults filled in. */
export function normalizeMap(raw: unknown): MapDef | null {
	if (!raw || typeof raw !== 'object') return null;
	const input = raw as Record<string, unknown>;
	const id = typeof input.id === 'string' ? input.id.trim() : '';
	if (!id) return null;
	return {
		id,
		name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Custom map',
		blurb: typeof input.blurb === 'string' ? input.blurb : '',
		theme: input.theme === 'snow' ? 'snow' : 'grass',
		w: typeof input.w === 'number' ? Math.round(input.w) : 12,
		h: typeof input.h === 'number' ? Math.round(input.h) : 8,
		paths: Array.isArray(input.paths) ? (input.paths as Point[][]) : [],
		rivers: Array.isArray(input.rivers) ? (input.rivers as Point[][]) : [],
		decorSeed: typeof input.decorSeed === 'number' ? input.decorSeed : 1,
		decorDensity: typeof input.decorDensity === 'number' ? input.decorDensity : 0.3,
		startGold: typeof input.startGold === 'number' ? input.startGold : 200,
		hpScale: typeof input.hpScale === 'number' ? input.hpScale : 1,
		hpGrowth: typeof input.hpGrowth === 'number' ? input.hpGrowth : 0.14,
		waves: Array.isArray(input.waves) ? (input.waves as unknown[]) : [[]],
	} as MapDef;
}

export function validateMap(raw: unknown): { map: MapDef | null; errors: MapIssue[]; warnings: MapIssue[] } {
	const errors: MapIssue[] = [];
	const warnings: MapIssue[] = [];
	const map = normalizeMap(raw);
	if (!map) return { map: null, errors: [{ path: '', message: 'Map data is missing or not an object.' }], warnings };

	if (!/^[a-z][a-z0-9-]{0,47}$/.test(map.id)) {
		errors.push({ path: 'id', message: 'Id must be lowercase letters, numbers, and dashes (2–48 chars).' });
	}
	if (map.w < 6 || map.w > 32) errors.push({ path: 'w', message: 'Width must be between 6 and 32.' });
	if (map.h < 6 || map.h > 32) errors.push({ path: 'h', message: 'Height must be between 6 and 32.' });
	if (!THEMES.has(map.theme)) errors.push({ path: 'theme', message: 'Theme must be grass or snow.' });

	const paths: Point[][] = [];
	for (let pi = 0; pi < map.paths.length; pi++) {
		const path = map.paths[pi];
		if (!Array.isArray(path) || path.length < 2) {
			errors.push({ path: `paths[${pi}]`, message: 'Each path needs at least two corners.' });
			continue;
		}
		const points: Point[] = [];
		for (let i = 0; i < path.length; i++) {
			const p = path[i];
			if (!isPoint(p)) {
				errors.push({ path: `paths[${pi}][${i}]`, message: 'Corners must be integer [column, row] pairs.' });
				break;
			}
			points.push(p);
			if (p[0] < -2 || p[0] > map.w + 1 || p[1] < -2 || p[1] > map.h + 1) {
				warnings.push({ path: `paths[${pi}][${i}]`, message: 'Corner is far outside the grid (spawns may still work).' });
			}
		}
		const expanded = expand(points);
		if (!expanded.length) {
			errors.push({ path: `paths[${pi}]`, message: 'Path corners must join in straight lines (no diagonals).' });
			continue;
		}
		for (const [c, r] of expanded) {
			if (c < 0 || r < 0 || c >= map.w || r >= map.h) {
				errors.push({ path: `paths[${pi}]`, message: 'Road leaves the grid. Widen the map or move corners.' });
				break;
			}
		}
		paths.push(points);
	}
	if (!paths.length) errors.push({ path: 'paths', message: 'Add at least one enemy road.' });

	for (let ri = 0; ri < map.rivers.length; ri++) {
		const river = map.rivers[ri];
		if (!Array.isArray(river) || river.length < 2) {
			errors.push({ path: `rivers[${ri}]`, message: 'Each river needs at least two points.' });
			continue;
		}
		for (let i = 0; i < river.length; i++) {
			if (!isPoint(river[i])) errors.push({ path: `rivers[${ri}][${i}]`, message: 'River points must be integer pairs.' });
		}
	}

	const waves: Group[][] = [];
	if (!map.waves.length) errors.push({ path: 'waves', message: 'Add at least one wave.' });
	for (let wi = 0; wi < map.waves.length; wi++) {
		const wave = map.waves[wi];
		if (!Array.isArray(wave) || !wave.length) {
			errors.push({ path: `waves[${wi}]`, message: 'Every wave needs at least one enemy group.' });
			continue;
		}
		const groups: Group[] = [];
		for (let gi = 0; gi < wave.length; gi++) {
			const g = wave[gi] as unknown as Record<string, unknown>;
			if (!g || typeof g !== 'object') {
				errors.push({ path: `waves[${wi}][${gi}]`, message: 'Group must be an object.' });
				continue;
			}
			const type = g.type as EnemyId;
			if (!ENEMY_IDS.has(type)) errors.push({ path: `waves[${wi}][${gi}].type`, message: `Unknown enemy type “${String(g.type)}”.` });
			const count = typeof g.count === 'number' ? g.count : 0;
			const gap = typeof g.gap === 'number' ? g.gap : 1;
			const delay = typeof g.delay === 'number' ? g.delay : 0;
			if (count < 1) errors.push({ path: `waves[${wi}][${gi}].count`, message: 'Count must be at least 1.' });
			if (gap < 0) errors.push({ path: `waves[${wi}][${gi}].gap`, message: 'Gap cannot be negative.' });
			if (count > 1 && gap <= 0) errors.push({ path: `waves[${wi}][${gi}].gap`, message: 'Gap must be positive when count is above 1.' });
			if (delay < 0) errors.push({ path: `waves[${wi}][${gi}].delay`, message: 'Delay cannot be negative.' });
			const pathIndex = g.path;
			if (pathIndex !== undefined && (typeof pathIndex !== 'number' || pathIndex < 0 || pathIndex >= paths.length)) {
				errors.push({ path: `waves[${wi}][${gi}].path`, message: 'Path index does not exist.' });
			}
			groups.push({
				type: type ?? 'scout',
				count,
				gap,
				delay,
				...(g.elite ? { elite: true } : {}),
				...(typeof pathIndex === 'number' ? { path: pathIndex } : {}),
			});
		}
		waves.push(groups);
	}

	if (map.startGold < 0) errors.push({ path: 'startGold', message: 'Starting gold cannot be negative.' });
	if (map.hpScale <= 0) errors.push({ path: 'hpScale', message: 'HP scale must be positive.' });
	if (map.hpGrowth < 0) errors.push({ path: 'hpGrowth', message: 'HP growth cannot be negative.' });

	const fixed: MapDef = { ...map, paths, rivers: map.rivers as Point[][], waves };
	return { map: errors.length ? null : fixed, errors, warnings };
}

export function validateMapList(maps: unknown): MapDef[] {
	if (!Array.isArray(maps)) throw new Error('Official map list must be a JSON array.');
	const out: MapDef[] = [];
	const seen = new Set<string>();
	for (let i = 0; i < maps.length; i++) {
		const { map, errors } = validateMap(maps[i]);
		if (!map) throw new Error(`Official map #${i + 1}: ${errors.map((e) => e.message).join(' ')}`);
		if (seen.has(map.id)) throw new Error(`Duplicate official map id “${map.id}”.`);
		seen.add(map.id);
		out.push(map);
	}
	return out;
}