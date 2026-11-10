// What a level gives: machine speed, pylon boost, ship cargo and speed. Also the belt speed that research and perks give.

import { BELT_SPEED, MACHINE_LEVEL, PYLON_BOOST } from '../content/machines.ts';
import { SHIP, SHIP_STEP } from '../content/ships.ts';
import { statAdd, statTimes } from './effects.ts';
import type { Owned } from './effects.ts';

/** Speed factor of a machine at a level. */
export const levelSpeed = (lv: number) => 1 + MACHINE_LEVEL.speed * (lv - 1);

export const pylonBoost = (lv: number) => PYLON_BOOST.base + PYLON_BOOST.perLevel * (lv - 1);

export const shipCargo = (lv: number) => SHIP.cargo + SHIP_STEP.cargo * lv;
export const shipSpeed = (lv: number) => 1 + SHIP_STEP.speed * lv;

/** Tiles a belt moves an item each second. */
export const beltSpeed = (owned: Owned) => (BELT_SPEED + statAdd(owned, 'beltSpeed')) * statTimes(owned, 'beltSpeed');
