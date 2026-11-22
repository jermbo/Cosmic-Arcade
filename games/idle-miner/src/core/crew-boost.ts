// What the crew on a planet add up to.

import { CREW } from '../content/crew.ts';
import type { CrewId } from '../content/crew.ts';

/** What crew on a planet do, added up. 1 means no change. */
export interface CrewBoost {
	drill: number;
	machine: number;
	shipSpeed: number;
	cargo: number;
	sell: number;
}
export const NO_BOOST: Readonly<CrewBoost> = { drill: 1, machine: 1, shipSpeed: 1, cargo: 1, sell: 1 };

/** Adds one crew member at a level to a boost. */
export function addCrew(b: CrewBoost, id: CrewId, lv: number) {
	const { role, per } = CREW[id];
	const n = per * lv;
	if (role === 'drill') b.drill += n;
	else if (role === 'machine') b.machine += n;
	else if (role === 'sell') b.sell += n;
	else {
		b.shipSpeed += n;
		b.cargo += n / 3;
	}
}
