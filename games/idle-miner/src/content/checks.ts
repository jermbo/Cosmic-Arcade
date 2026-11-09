// The conditions that content can ask for: when a goal is done, when a feature unlocks, when a research shows.

import type { MachineType } from './machines.ts';
import type { PlanetId } from './planets.ts';
import type { ResearchId } from './research.ts';
import type { ShipUpgrade } from './ships.ts';

export type Check =
	// Taps on planets, ships that flew home and sold, and Nova Resets: in all runs.
	| { kind: 'taps'; count: number }
	| { kind: 'flights'; count: number }
	| { kind: 'resets'; count: number }
	// Credits earned this run.
	| { kind: 'earned'; credits: number }
	// The best income this run, in credits per second.
	| { kind: 'income'; perSecond: number }
	// Machines of a type: on one planet, or on all of them.
	| { kind: 'build'; machine: MachineType; count: number; on?: PlanetId }
	// Planets that have at least one machine of a type.
	| { kind: 'buildOnPlanets'; machine: MachineType; planets: number }
	// The highest level of a machine type, or of any machine but the pad.
	| { kind: 'machineLevel'; machine: MachineType | 'any'; level: number }
	| { kind: 'research'; research: ResearchId; level: number }
	// Levels of ship upgrades on one route, added up.
	| { kind: 'shipUpgrades'; upgrades: ShipUpgrade[]; on: PlanetId; count: number }
	// Ships on the route that has the most.
	| { kind: 'shipsOnOneRoute'; count: number }
	| { kind: 'planetOpen'; planet: PlanetId }
	// A plot of land bought on any planet.
	| { kind: 'landBought' }
	| { kind: 'perksOwned'; count: number }
	| { kind: 'beaconLit' }
	// Cargo from a planet is on its way: on the pad, in a ship, or sold.
	| { kind: 'cargoMoving'; from: PlanetId }
	// A feature in the unlock list, such as 'smelter'.
	| { kind: 'unlocked'; id: string };
