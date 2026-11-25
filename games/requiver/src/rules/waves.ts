// Builds the waves of one fight from the act's foe pool and a budget.

import { ACTS } from './data/acts.ts';
import { WAVES } from './data/balance.ts';
import { ENEMIES } from './data/enemies.ts';
import type { Rng } from './rng.ts';

export type FightKind = 'fight' | 'elite' | 'boss';

export interface SpawnSpec {
	foe: string;
	elite: boolean;
	/** Seconds after the previous spawn of the wave. */
	delay: number;
}

export function buildWaves(rng: Rng, act: number, row: number, kind: FightKind, tutorial: boolean): SpawnSpec[][] {
	const def = ACTS[act];
	if (kind === 'boss') return [[]];
	const [minWaves, maxWaves] = WAVES.count[kind];
	const count = rng.int(minWaves, maxWaves);
	const pool = Object.entries(def.foes).filter(([id]) => ENEMIES[id] && ENEMIES[id].cost > 0);
	const waves: SpawnSpec[][] = [];
	for (let w = 0; w < count; w++) {
		let budget = def.budget * (1 + row * WAVES.rowGrowth) * (1 + w * WAVES.waveGrowth);
		if (kind === 'elite') budget *= WAVES.eliteBudget;
		const wave: SpawnSpec[] = [];
		if (tutorial && w === 0) {
			for (let i = 0; i < 3; i++) wave.push({ foe: 'walker', elite: false, delay: i === 0 ? 0.5 : 3.2 });
			waves.push(wave);
			continue;
		}
		// Elite fights open each wave with one elite.
		if (kind === 'elite') {
			const big = rng.weighted(pool, ([id, weight]) => (ENEMIES[id].cost >= 2 ? weight : 0)) ?? pool[0];
			wave.push({ foe: big[0], elite: true, delay: 0.6 });
			budget -= ENEMIES[big[0]].cost * 2;
		}
		let guard = 0;
		while (budget > 0.5 && guard++ < 60) {
			const pick = rng.weighted(pool, ([id, weight]) => (ENEMIES[id].cost <= budget + 0.4 ? weight : 0));
			if (!pick) break;
			const id = pick[0];
			const elite = kind === 'elite' && rng.chance(WAVES.eliteChance);
			budget -= ENEMIES[id].cost * (elite ? 2 : 1);
			const [lo, hi] = WAVES.spawnGap;
			// Sometimes foes come in a tight pair.
			const delay = wave.length === 0 ? 0.8 : rng.chance(0.25) ? 0.35 : rng.range(lo, hi);
			wave.push({ foe: id, elite, delay });
		}
		waves.push(wave);
	}
	return waves;
}
