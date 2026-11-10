// The Nova Reset: stardust, and the crew slots it buys.

import type { PlanetId } from './planets.ts';

/** Stardust each 1 gives +25% to all sales. */
export const DUST_BONUS = 0.25;
/** The Nova Reset opens with this planet. */
export const PRESTIGE_PLANET: PlanetId = 'solara';

/** Crew slots: how many crew can work at once. The first is free; more cost stardust. */
export const SLOT_COSTS = [5, 10, 20, 40];
export const BASE_SLOTS = 1;

/** Credits a run starts with after a nova, per stardust held, so the rebuild gets going fast. */
export const NOVA_KIT = 250;

/** A run earns floor((earned / firstAt) ^ power) stardust. So the first stardust comes at firstAt credits. */
export const STARDUST = { firstAt: 2e6, power: 0.45 };
