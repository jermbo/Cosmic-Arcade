// The goals: the "what next" list, in the order the goal bar shows them. Any goal can finish early.

import type { Check } from './checks.ts';
import type { PlanetId } from './planets.ts';

/** Where a tap on the goal bar takes the player. */
export type GoalPlace =
	| 'space'
	| 'research'
	| 'prestige'
	// The space map, with this planet selected.
	| { space: PlanetId }
	| { planet: PlanetId }
	// The ships panel of this planet.
	| { ships: PlanetId };

export interface Goal {
	id: string;
	text: string;
	where: GoalPlace;
	check: Check;
	/** The goal bar shows only done or not done, with no count. */
	yesNo?: true;
}

export const GOALS: Goal[] = [
	{ id: 'tap', text: 'Tap Cinder to mine ore', where: { space: 'cinder' }, check: { kind: 'taps', count: 8 } },
	{ id: 'drill', text: 'Open Cinder and build a drill on ore', where: { planet: 'cinder' }, check: { kind: 'build', machine: 'drill', count: 1 } },
	{ id: 'belt', text: 'Drag belts from the drill to the launch pad', where: { planet: 'cinder' }, check: { kind: 'cargoMoving', from: 'cinder' } },
	{ id: 'ship', text: 'Wait for the ship to sell your ore at home', where: { space: 'cinder' }, check: { kind: 'flights', count: 1 } },
	{ id: 'drills3', text: 'Build 3 drills on Cinder', where: { planet: 'cinder' }, check: { kind: 'build', machine: 'drill', count: 3, on: 'cinder' } },
	{ id: 'smelter', text: 'Put a smelter on the belt. Bars sell for 4x', where: { planet: 'cinder' }, check: { kind: 'build', machine: 'smelter', count: 1 } },
	{ id: 'ship2', text: 'Buy a second ship for Cinder', where: { ships: 'cinder' }, check: { kind: 'shipUpgrades', upgrades: ['ships'], on: 'cinder', count: 1 } },
	{ id: 'upgrade', text: 'Tap a drill and upgrade it', where: { planet: 'cinder' }, check: { kind: 'machineLevel', machine: 'drill', level: 2 }, yesNo: true },
	{ id: 'research', text: 'Research Power Gloves to tap harder', where: 'research', check: { kind: 'research', research: 'tap', level: 1 } },
	{ id: 'drills6', text: 'Build 6 drills on Cinder', where: { planet: 'cinder' }, check: { kind: 'build', machine: 'drill', count: 6, on: 'cinder' } },
	{ id: 'cargo', text: 'Upgrade Cinder cargo or engines 3 times', where: { ships: 'cinder' }, check: { kind: 'shipUpgrades', upgrades: ['cargo', 'speed'], on: 'cinder', count: 3 } },
	{ id: 'smelt3', text: 'Upgrade a smelter to level 3', where: { planet: 'cinder' }, check: { kind: 'machineLevel', machine: 'smelter', level: 3 } },
	{ id: 'belts', text: 'Research Mag Belts to speed up belts', where: 'research', check: { kind: 'research', research: 'belt', level: 1 } },
	{ id: 'drills8', text: 'Build 8 drills on Cinder', where: { planet: 'cinder' }, check: { kind: 'build', machine: 'drill', count: 8, on: 'cinder' } },
	{ id: 'market', text: 'Research Trade Deals to sell for more', where: 'research', check: { kind: 'research', research: 'market', level: 1 } },
	{ id: 'glacia', text: 'Unlock Glacia', where: { space: 'glacia' }, check: { kind: 'planetOpen', planet: 'glacia' } },
	{ id: 'glacia2', text: 'Build 2 drills on Glacia', where: { planet: 'glacia' }, check: { kind: 'build', machine: 'drill', count: 2, on: 'glacia' } },
	{ id: 'crusher', text: 'Put a crusher before a smelter', where: { planet: 'glacia' }, check: { kind: 'build', machine: 'crusher', count: 1 } },
	{ id: 'glaciaShip', text: 'Buy a second ship for Glacia', where: { ships: 'glacia' }, check: { kind: 'shipUpgrades', upgrades: ['ships'], on: 'glacia', count: 1 } },
	{ id: 'glacia6', text: 'Build 6 drills on Glacia', where: { planet: 'glacia' }, check: { kind: 'build', machine: 'drill', count: 6, on: 'glacia' } },
	{ id: 'crusher2', text: 'Add a crusher on Cinder too', where: { planet: 'cinder' }, check: { kind: 'build', machine: 'crusher', count: 1, on: 'cinder' } },
	{ id: 'level5', text: 'Upgrade any machine to level 5', where: { planet: 'glacia' }, check: { kind: 'machineLevel', machine: 'any', level: 5 } },
	{ id: 'belts3', text: 'Get Mag Belts to level 3', where: 'research', check: { kind: 'research', research: 'belt', level: 3 } },
	{ id: 'inc40', text: 'Reach 40 credits per second', where: 'space', check: { kind: 'income', perSecond: 40 } },
	{ id: 'survey', text: 'Buy a plot of land next to your base', where: { planet: 'cinder' }, check: { kind: 'landBought' } },
	{ id: 'market2', text: 'Get Trade Deals to level 2', where: 'research', check: { kind: 'research', research: 'market', level: 2 } },
	{ id: 'inc100', text: 'Reach 100 credits per second', where: 'space', check: { kind: 'income', perSecond: 100 } },
	{ id: 'verdance', text: 'Unlock Verdance', where: { space: 'verdance' }, check: { kind: 'planetOpen', planet: 'verdance' } },
	{ id: 'polisher', text: 'Put a polisher after a smelter. Gems sell high', where: { planet: 'verdance' }, check: { kind: 'build', machine: 'polisher', count: 1 } },
	{ id: 'verd5', text: 'Build 5 drills on Verdance', where: { planet: 'verdance' }, check: { kind: 'build', machine: 'drill', count: 5, on: 'verdance' } },
	{ id: 'polish2', text: 'Have polishers on 2 planets', where: { planet: 'glacia' }, check: { kind: 'buildOnPlanets', machine: 'polisher', planets: 2 } },
	{ id: 'ships3', text: 'Have 3 ships on one route', where: { ships: 'verdance' }, check: { kind: 'shipsOnOneRoute', count: 3 } },
	{ id: 'drills25', text: 'Have 25 drills across your planets', where: 'space', check: { kind: 'build', machine: 'drill', count: 25 } },
	{ id: 'level8', text: 'Upgrade any machine to level 8', where: { planet: 'verdance' }, check: { kind: 'machineLevel', machine: 'any', level: 8 } },
	{ id: 'inc500', text: 'Reach 500 credits per second', where: 'space', check: { kind: 'income', perSecond: 500 } },
	{ id: 'verd10', text: 'Build 10 drills on Verdance', where: { planet: 'verdance' }, check: { kind: 'build', machine: 'drill', count: 10, on: 'verdance' } },
	{ id: 'inc1k', text: 'Reach 1K credits per second', where: 'space', check: { kind: 'income', perSecond: 1000 } },
	{ id: 'tap3', text: 'Get Power Gloves to level 3', where: 'research', check: { kind: 'research', research: 'tap', level: 3 } },
	{ id: 'inc2k', text: 'Reach 2K credits per second', where: 'space', check: { kind: 'income', perSecond: 2000 } },
	{ id: 'solara', text: 'Unlock Solara', where: { space: 'solara' }, check: { kind: 'planetOpen', planet: 'solara' } },
	{ id: 'pylon', text: 'Build an overdrive pylon next to machines', where: { planet: 'solara' }, check: { kind: 'build', machine: 'pylon', count: 1 } },
	{ id: 'solara5', text: 'Build 5 drills on Solara', where: { planet: 'solara' }, check: { kind: 'build', machine: 'drill', count: 5, on: 'solara' } },
	{ id: 'market5', text: 'Get Trade Deals to level 5', where: 'research', check: { kind: 'research', research: 'market', level: 5 } },
	{ id: 'inc5k', text: 'Reach 5K credits per second', where: 'space', check: { kind: 'income', perSecond: 5000 } },
	{ id: 'pylon3', text: 'Have 3 overdrive pylons', where: { planet: 'solara' }, check: { kind: 'build', machine: 'pylon', count: 3 } },
	{ id: 'inc10k', text: 'Reach 10K credits per second', where: 'space', check: { kind: 'income', perSecond: 10000 } },
	{ id: 'level10', text: 'Upgrade any machine to level 10', where: { planet: 'verdance' }, check: { kind: 'machineLevel', machine: 'any', level: 10 } },
	{ id: 'inc25k', text: 'Reach 25K credits per second', where: 'space', check: { kind: 'income', perSecond: 25000 } },
	{ id: 'umbra', text: 'Unlock Umbra', where: { space: 'umbra' }, check: { kind: 'planetOpen', planet: 'umbra' } },
	{ id: 'compactor', text: 'Build a compactor right before a pad', where: { planet: 'umbra' }, check: { kind: 'build', machine: 'compactor', count: 1 } },
	{ id: 'prestige', text: 'Do a Nova Reset for stardust', where: 'prestige', check: { kind: 'resets', count: 1 } },
	{ id: 'perk', text: 'Spend stardust on a perk', where: 'prestige', check: { kind: 'perksOwned', count: 1 } },
	{ id: 'inc250k', text: 'Reach 250K credits per second', where: 'space', check: { kind: 'income', perSecond: 250000 } },
	{ id: 'umbra8', text: 'Build 8 drills on Umbra', where: { planet: 'umbra' }, check: { kind: 'build', machine: 'drill', count: 8, on: 'umbra' } },
	{ id: 'inc1m', text: 'Reach 1M credits per second', where: 'space', check: { kind: 'income', perSecond: 1000000 } },
	{ id: 'halcyon', text: 'Unlock Halcyon', where: { space: 'halcyon' }, check: { kind: 'planetOpen', planet: 'halcyon' } },
	{ id: 'forge', text: 'Build a fusion forge after polishers', where: { planet: 'halcyon' }, check: { kind: 'build', machine: 'forge', count: 1 } },
	{ id: 'inc10m', text: 'Reach 10M credits per second', where: 'space', check: { kind: 'income', perSecond: 10000000 } },
	{ id: 'forge3', text: 'Have 3 fusion forges', where: { planet: 'halcyon' }, check: { kind: 'build', machine: 'forge', count: 3 } },
	{ id: 'inc100m', text: 'Reach 100M credits per second', where: 'space', check: { kind: 'income', perSecond: 100000000 } },
	{ id: 'beacon', text: 'Light the Star Beacon in Research', where: 'research', check: { kind: 'beaconLit' } },
];
