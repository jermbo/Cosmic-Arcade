// Bows to start a run with. `locked` bows come from the upgrade tree.

import type { StatMod } from '../stats.ts';

export interface BowDef {
	id: string;
	name: string;
	blurb: string;
	art: string;
	mod: StatMod;
	locked?: boolean;
}

export const BOWS: Record<string, BowDef> = {
	ash: {
		id: 'ash',
		name: 'Ash Bow',
		blurb: 'Plain and true. No strengths, no faults.',
		art: 'ash',
		mod: {},
	},
	short: {
		id: 'short',
		name: 'Hornet Shortbow',
		blurb: 'Pulls fast, shoots often. Arrows fly slower.',
		art: 'short',
		mod: { mult: { drawTime: 0.7, cooldown: 0.75, speedMult: 0.92 } },
		locked: true,
	},
	long: {
		id: 'long',
		name: 'Heron Longbow',
		blurb: 'Slow pull, heavy hits, a longer aim arc.',
		art: 'long',
		mod: { mult: { drawTime: 1.3, speedMult: 1.08 }, add: { damage: 0.5, aimArc: 0.06 } },
		locked: true,
	},
	twin: {
		id: 'twin',
		name: 'Twin Spine',
		blurb: 'Two arrows every shot. Each one hits softer.',
		art: 'twin',
		mod: { add: { arrows: 1 }, mult: { damage: 0.75, drawTime: 1.1 } },
		locked: true,
	},
};
