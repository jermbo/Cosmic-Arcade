// The upgrades of a cargo route.

export interface UpgradeDef {
	name: string;
	desc: string;
	cost: number;
	growth: number;
	max: number;
}

export type ShipUpgrade = 'ships' | 'speed' | 'cargo';
export const SHIP_UPS: Record<ShipUpgrade, UpgradeDef> = {
	ships: { name: 'Extra Ship', desc: 'One more ship on this route.', cost: 40, growth: 2.4, max: 7 },
	speed: { name: 'Engines', desc: 'Ships fly 25% faster.', cost: 25, growth: 1.9, max: 12 },
	cargo: { name: 'Cargo Hold', desc: 'Each ship carries 5 more.', cost: 20, growth: 1.8, max: 15 },
};

/** A ship with no upgrades, and how it loads at the pad. */
export const SHIP = {
	/** Items one ship carries. */
	cargo: 8,
	/** Seconds a ship with some cargo waits for more before it leaves. */
	wait: 2.5,
	/** Items a docked ship takes from the pad each second. */
	loadPerSecond: 40,
};

/** What one level of an upgrade adds: items each ship carries, and ship speed. */
export const SHIP_STEP = { cargo: 5, speed: 0.25 };

/** The pad holds this many items, plus this many full ship loads. */
export const PAD = { items: 40, shipLoads: 2 };
