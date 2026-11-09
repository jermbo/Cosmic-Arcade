// The research: upgrades that help every planet. The research panel shows them in this order.

import type { Check } from './checks.ts';
import type { Effect } from './effects.ts';

export interface ResearchDef {
	name: string;
	desc: string;
	cost: number;
	growth: number;
	max: number;
	effects: Effect[];
	/** The panel shows it only when any of these checks is met. Without it, it always shows. */
	shownWhen?: Check[];
	/** The word the panel shows when a one-level research is done. Without it, "Done". */
	doneLabel?: string;
}

export type ResearchId = 'belt' | 'tap' | 'market' | 'offline' | 'blast' | 'bridges' | 'beacon';
export const RESEARCH: Record<ResearchId, ResearchDef> = {
	tap: { name: 'Power Gloves', desc: 'Each tap mines 2x more.', cost: 80, growth: 6, max: 12, effects: [{ stat: 'tapPower', times: 2 }, { stat: 'tapFloor', add: 0.25 }] },
	belt: { name: 'Mag Belts', desc: 'All belts move 30% faster.', cost: 120, growth: 4, max: 10, effects: [{ stat: 'beltSpeed', add: 0.4 }] },
	blast: { name: 'Blast Charges', desc: 'Clear rocks: tap one with the Remove tool. Cleared rocks stay gone, even after a nova.', cost: 1000, growth: 1, max: 1, effects: [{ power: 'blastRocks' }] },
	bridges: { name: 'Belt Bridges', desc: 'Drag a belt line straight across a belt to make a crossing. Unlocks the Bridge: drag from one end to the other to hop items over up to 3 tiles.', cost: 5000, growth: 1, max: 1, effects: [{ power: 'beltCrossings' }] },
	market: { name: 'Trade Deals', desc: 'All cargo sells for 20% more.', cost: 2000, growth: 4.5, max: 20, effects: [{ stat: 'sales', add: 0.2 }] },
	offline: { name: 'Night Shift', desc: 'Work 1 more hour while you are away.', cost: 25e3, growth: 12, max: 6, effects: [{ stat: 'awayHours', add: 1 }] },
	beacon: {
		name: 'Star Beacon',
		desc: 'Light a beacon at the edge of the system. The final project.',
		cost: 25e9,
		growth: 1,
		max: 1,
		effects: [{ power: 'lightBeacon' }],
		shownWhen: [{ kind: 'planetOpen', planet: 'halcyon' }, { kind: 'beaconLit' }],
		doneLabel: 'Lit',
	},
};
