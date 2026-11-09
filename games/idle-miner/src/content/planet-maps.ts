// How the planet maps are made: how much ore and rock each plot of land gets.
// A change here moves ore and rock on every planet. Bump MAP_VERSION in core/planet-map.ts with it,
// so that old saves get their machines paid back.

/** A count drawn at random: from min to min + spread - 1. */
export interface RandomCount {
	min: number;
	spread: number;
}

/** How much ore and rock a kind of plot gets. */
export interface PlotKind {
	ore: RandomCount;
	rocks: RandomCount;
}

export const PLANET_MAP = {
	/** The plot the player starts on. */
	start: { ore: { min: 4, spread: 6 }, rocks: { min: 1, spread: 2 } } as PlotKind,

	/** Rich land has more ore, and more again for each ring out from the start. */
	rich: { ore: { min: 7, spread: 4 }, rocks: { min: 1, spread: 3 } } as PlotKind,
	richOrePerRing: 2,
	/** The chance that a plot is rich: base, plus perRing for each ring out. One plot next to the start is always rich. */
	richChance: { base: 0.15, perRing: 0.12 },

	/** Land that is mostly rock. Its chance comes after the chance of rich land. */
	rocky: { ore: { min: 0, spread: 3 }, rocks: { min: 6, spread: 5 } } as PlotKind,
	rockyChance: 0.3,

	/** Every other plot. */
	plain: { ore: { min: 2, spread: 4 }, rocks: { min: 2, spread: 3 } } as PlotKind,

	/** Later planets have more rock: one more per plot for each this many planets before them. */
	extraRockEveryPlanets: 2,

	/** Ore comes in patches of this many tiles. */
	patchSize: { min: 2, spread: 3 } as RandomCount,
	/** No ore this close to the pad, in steps. */
	oreDistanceFromPad: 3,
	/** Tiles around the pad that stay plain ground. */
	padClearance: 1,

	/** Tries to place the ore and the rocks of a plot before it stops. */
	oreTries: 200,
	rockTries: 120,

	/** Mixed into the seed of each planet. */
	seedFactor: 7919,
};
