// The perks that stardust buys.

import type { Effect } from './effects.ts';

export type PerkId = 'hands' | 'hull' | 'start' | 'blueprint' | 'nap' | 'belts';
export interface PerkDef {
	name: string;
	desc: string;
	cost: number;
	effects: Effect[];
}
export const PERKS: Record<PerkId, PerkDef> = {
	hands: { name: 'Quick Hands', desc: 'Taps mine 5x more.', cost: 1, effects: [{ stat: 'tapPower', times: 5 }] },
	start: { name: 'Head Start', desc: 'Start each run with 1,000 credits.', cost: 2, effects: [{ stat: 'startCredits', add: 1000 }, { startUnlocks: ['smelter', 'ships', 'research'] }] },
	belts: { name: 'Slick Belts', desc: 'Belts move 50% faster.', cost: 3, effects: [{ stat: 'beltSpeed', times: 1.5 }] },
	hull: { name: 'Spare Hull', desc: 'Every route starts with 1 extra ship.', cost: 4, effects: [{ stat: 'extraShips', add: 1 }] },
	nap: { name: 'Long Nap', desc: 'Work 4 more hours while away.', cost: 5, effects: [{ stat: 'awayHours', add: 4 }] },
	blueprint: { name: 'Blueprint Memory', desc: 'Keep the Cinder factory when you reset.', cost: 8, effects: [{ power: 'keepFactory' }] },
};
