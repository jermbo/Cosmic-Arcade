import { sleepyTee } from './01-sleepy-tee.ts';
import { fourCorners } from './02-four-corners.ts';
import { tankerAlley } from './03-tanker-alley.ts';
import { marketCross } from './04-market-cross.ts';
import { theWhirl } from './05-the-whirl.ts';
import { gridlockGrand } from './06-gridlock-grand.ts';
import type { GoalDef, LevelDef } from './types.ts';

/** The junctions, in the order of play. To add one, make a file like the others and add it here. */
export const LEVELS: LevelDef[] = [sleepyTee, fourCorners, tankerAlley, marketCross, theWhirl, gridlockGrand];

export interface RunStats {
	money: number;
	bestChain: number;
	wrecks: number;
	bonus: { bus: number; tanker: number; barrel: number };
}

const BONUS_NAMES = { bus: ['bus', 'buses'], tanker: ['tanker', 'tankers'], barrel: ['barrel', 'barrels'] } as const;

export function goalText(goal: GoalDef): string {
	switch (goal.kind) {
		case 'money':
			return `Reach ${formatMoney(goal.target)}`;
		case 'chain':
			return `Chain ${goal.target} hits`;
		case 'wrecks':
			return `Wreck ${goal.target} vehicles`;
		case 'bonus':
			return goal.what === 'barrel'
				? `Blow up ${goal.target} ${BONUS_NAMES.barrel[goal.target === 1 ? 0 : 1]}`
				: `Wreck ${goal.target} ${BONUS_NAMES[goal.what][goal.target === 1 ? 0 : 1]}`;
	}
}

export function goalValue(goal: GoalDef, stats: RunStats): number {
	switch (goal.kind) {
		case 'money':
			return stats.money;
		case 'chain':
			return stats.bestChain;
		case 'wrecks':
			return stats.wrecks;
		case 'bonus':
			return stats.bonus[goal.what];
	}
}

export function goalDone(goal: GoalDef, stats: RunStats): boolean {
	return goalValue(goal, stats) >= goal.target;
}

export function formatMoney(value: number): string {
	return '$' + Math.round(value).toLocaleString('en-US');
}
