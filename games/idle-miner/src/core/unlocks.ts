// Every unlock: the list in the content, and one for each new machine that a planet brings.

import { MACHINES } from '../content/machines.ts';
import { PLANETS } from '../content/planets.ts';
import { UNLOCKS } from '../content/unlocks.ts';
import type { Unlock } from '../content/unlocks.ts';

export const ALL_UNLOCKS: Unlock[] = [
	...UNLOCKS,
	...PLANETS.flatMap((p, i): Unlock[] => {
		if (!p.newMachine) return [];
		const def = MACHINES[p.newMachine];
		return [{ id: `m-${i}`, title: `New machine: ${def.name}`, text: def.desc, when: [{ kind: 'planetOpen', planet: p.id }] }];
	}),
];
