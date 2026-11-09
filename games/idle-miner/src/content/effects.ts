// What a research or a perk does. A research gives its effect once for each level. A perk gives it once, when owned.

/** Numbers that research and perks change. The rules start each one from its base. */
export type Stat =
	// Tiles a belt moves an item each second.
	| 'beltSpeed'
	// How much a tap mines.
	| 'tapPower'
	// The least a tap is worth: TAP_INCOME_SHARE of a second of income, times 1 plus this.
	| 'tapFloor'
	// How much more cargo sells for, before stardust.
	| 'sales'
	// Hours away that count, on top of BASE_OFFLINE_HOURS.
	| 'awayHours'
	// Credits at the start of each run.
	| 'startCredits'
	// Ships that each route starts with, on top of the first.
	| 'extraShips';

/** Things that research and perks turn on. */
export type Power =
	// Tap a rock with the Remove tool to clear it.
	| 'blastRocks'
	// Drag a belt line straight across a belt to make a crossing.
	| 'beltCrossings'
	// The final project: the game shows its ending.
	| 'lightBeacon'
	// The Cinder factory stays after a Nova Reset.
	| 'keepFactory';

export type Effect =
	// Adds this much to a stat.
	| { stat: Stat; add: number }
	// Multiplies a stat by this much.
	| { stat: Stat; times: number }
	| { power: Power }
	// Opens these features at the start of each run.
	| { startUnlocks: string[] };
