// The machines a player can build.

import type { Check } from './checks.ts';
import { FORM_BAR, FORM_CORE, FORM_DUST, FORM_GEM, FORM_ORE } from './items.ts';

export type MachineType = 'pad' | 'drill' | 'belt' | 'cross' | 'bridge' | 'smelter' | 'crusher' | 'polisher' | 'pylon' | 'compactor' | 'forge';

export interface MachineDef {
	name: string;
	short: string;
	desc: string;
	cost: number;
	growth: number;
	/** Seconds per job at level 1. */
	time: number;
	/** Forms it takes in. */
	inputs: number[];
	need: number;
	outForm: number;
	outCount: number;
	maxLv: number;
	color: string;
	/** Items it can hold while they wait for a job. Without it, BUF_IN. */
	holds?: number;
	/**
	 * When the player can build it: from the start, or when any of the checks is met.
	 * Without it, the machine comes with the planet that names it in newMachine, and can be built there and on each planet after it.
	 */
	unlock?: 'start' | Check[];
}

export const MACHINES: Record<MachineType, MachineDef> = {
	pad: { name: 'Launch Pad', short: 'Pad', desc: 'Ships load cargo here and fly it home.', cost: 0, growth: 1, time: 0, inputs: [], need: 0, outForm: 0, outCount: 0, maxLv: 1, color: '#9fb4ff' },
	drill: { name: 'Drill', short: 'Drill', desc: 'Digs ore. Place it on an ore tile.', cost: 10, growth: 1.22, time: 2, inputs: [], need: 0, outForm: FORM_ORE, outCount: 1, maxLv: 12, color: '#ffb347', unlock: 'start' },
	belt: { name: 'Belt', short: 'Belt', desc: 'Moves items. Drag to lay a line.', cost: 1, growth: 1, time: 0, inputs: [], need: 0, outForm: 0, outCount: 0, maxLv: 1, color: '#7f8cff', unlock: 'start' },
	cross: { name: 'Crossing', short: 'Crossing', desc: 'Two belt lines pass through each other here. Drag a belt line straight across a belt to make one.', cost: 20, growth: 1, time: 0, inputs: [], need: 0, outForm: 0, outCount: 0, maxLv: 1, color: '#7f8cff', unlock: [{ kind: 'research', research: 'bridges', level: 1 }] },
	bridge: { name: 'Bridge', short: 'Bridge', desc: 'Items hop from this end to the other, over rocks, belts or machines.', cost: 150, growth: 1, time: 0, inputs: [], need: 0, outForm: 0, outCount: 0, maxLv: 1, color: '#9fb4ff', unlock: [{ kind: 'research', research: 'bridges', level: 1 }] },
	smelter: { name: 'Smelter', short: 'Smelter', desc: 'Melts ore or dust into bars. Bars sell for 4x.', cost: 60, growth: 1.3, time: 1, inputs: [FORM_ORE, FORM_DUST], need: 1, outForm: FORM_BAR, outCount: 1, maxLv: 12, color: '#ff6a3d', unlock: [{ kind: 'unlocked', id: 'smelter' }] },
	crusher: { name: 'Crusher', short: 'Crusher', desc: 'Breaks 1 ore into 2 dust. Smelt dust for twice the bars.', cost: 150, growth: 1.35, time: 1, inputs: [FORM_ORE], need: 1, outForm: FORM_DUST, outCount: 2, maxLv: 12, color: '#6fe3ff' },
	polisher: { name: 'Polisher', short: 'Polisher', desc: 'Cuts a bar into a gem. Gems sell for 3.5x a bar.', cost: 800, growth: 1.35, time: 1, inputs: [FORM_BAR], need: 1, outForm: FORM_GEM, outCount: 1, maxLv: 12, color: '#5dff8f' },
	pylon: { name: 'Overdrive Pylon', short: 'Pylon', desc: 'Machines next to it work 50% faster.', cost: 5000, growth: 1.6, time: 0, inputs: [], need: 0, outForm: 0, outCount: 0, maxLv: 8, color: '#ffd23f' },
	compactor: { name: 'Compactor', short: 'Compactor', desc: 'Packs 5 items into 1 crate. Ships carry crates as 1 item, worth 25% more.', cost: 20e3, growth: 1.4, time: 1, inputs: [0, 1, 2, 3, 4], need: 5, outForm: 0, outCount: 1, maxLv: 12, color: '#b47cff', holds: 10 },
	forge: { name: 'Fusion Forge', short: 'Forge', desc: 'Fuses 3 gems into a star core worth 60x ore.', cost: 100e3, growth: 1.45, time: 1.5, inputs: [FORM_GEM], need: 3, outForm: FORM_CORE, outCount: 1, maxLv: 12, color: '#ff5fae' },
};

export const BUILD_ORDER: MachineType[] = ['drill', 'belt', 'bridge', 'smelter', 'crusher', 'polisher', 'pylon', 'compactor', 'forge'];

export const BUF_IN = 6;
export const BUF_OUT = 4;
export const BELT_SPACING = 0.5;
/** Most tiles from one bridge end to the other (so up to 3 tiles in between). */
export const BRIDGE_SPAN = 4;

/** What a machine level gives, and what it costs. */
export const MACHINE_LEVEL = {
	/** Each level past 1 adds this to the speed of a machine. */
	speed: 0.5,
	/** Each upgrade costs this many times the one before. */
	costGrowth: 1.55,
	/** The part of the upgrade money that comes back when a machine is removed. */
	refund: 0.5,
};

/** The boost a pylon gives to the 8 tiles around it. */
export const PYLON_BOOST = { base: 0.5, perLevel: 0.15 };

/** Tiles a belt moves an item each second, before research and perks. */
export const BELT_SPEED = 1.5;
