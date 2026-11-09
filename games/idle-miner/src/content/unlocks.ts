// The features that open up as the player plays. Each new machine that a planet brings also unlocks, with that planet.

import type { Check } from './checks.ts';
import { PRESTIGE_PLANET } from './nova.ts';

export interface Unlock {
	id: string;
	title: string;
	text: string;
	/** It opens when any of these checks is met. */
	when: Check[];
}

export const UNLOCKS: Unlock[] = [
	{ id: 'smelter', title: 'New machine: Smelter', text: 'Melts ore into bars that sell for 4x.', when: [{ kind: 'build', machine: 'drill', count: 3 }, { kind: 'earned', credits: 150 }] },
	{ id: 'ships', title: 'Shipyard open', text: 'Buy more ships, faster engines and bigger holds.', when: [{ kind: 'flights', count: 1 }] },
	{ id: 'research', title: 'Research lab online', text: 'Upgrades that help every planet.', when: [{ kind: 'earned', credits: 250 }] },
	{ id: 'crew', title: 'Crew for hire', text: 'Hire a crew member to boost one planet. Tap Crew on a planet.', when: [{ kind: 'earned', credits: 800 }] },
	{ id: 'prestige', title: 'Nova Reset ready', text: 'Reset your run for stardust: a lasting boost to all sales.', when: [{ kind: 'planetOpen', planet: PRESTIGE_PLANET }] },
];

/** The features that stay open after a Nova Reset. */
export const KEPT_AFTER_NOVA = ['smelter', 'ships', 'research', 'prestige'];
