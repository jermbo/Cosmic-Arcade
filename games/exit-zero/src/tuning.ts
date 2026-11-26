// Numbers for the feel of the player. Tune after a play test.

export const MOVE = {
	walk: 2.7,
	sprint: 4.8,
	/** Speed in water is multiplied by this. */
	wade: 0.62,
	accel: 11,
	radius: 0.28,
	eye: 1.6,
	stepWalk: 0.8,
	stepSprint: 1.15,
	bob: 0.035,
	/** Radians per mouse pixel at sensitivity 1. */
	mouse: 0.0022,
	/** Radians per second for a full stick at sensitivity 1. */
	stick: 2.6,
	thirdDistance: 2.4,
	interactCos: 0.88,
};

/** How far a footstep carries, in meters. The creature hears inside this radius. */
export const NOISE: Record<'carpet' | 'concrete' | 'metal' | 'water', { walk: number; sprint: number }> = {
	carpet: { walk: 2.5, sprint: 11 },
	concrete: { walk: 3.2, sprint: 13 },
	metal: { walk: 4.2, sprint: 14 },
	water: { walk: 6.5, sprint: 15 },
};

/** A step louder than this shows as LOUD on the HUD. */
export const LOUD = 6;
