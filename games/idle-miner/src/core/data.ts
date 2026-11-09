// All the fixed game numbers: planets, machines, prices, research, perks.

export const COLS = 12;
export const ROWS = 8;
export const CELLS = COLS * ROWS;

/** 0 right, 1 down, 2 left, 3 up */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];
export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;

export const TILE_GROUND = 0;
export const TILE_ORE = 1;
export const TILE_ROCK = 2;

// Item kinds are numbers: planet * 10 + form. Forms 5..9 are crates of forms 0..4.
export const FORM_ORE = 0;
export const FORM_DUST = 1;
export const FORM_BAR = 2;
export const FORM_GEM = 3;
export const FORM_CORE = 4;
export const FORM_NAMES = ['ore', 'dust', 'bar', 'gem', 'core'];
export const FORM_VALUE = [1, 0.6, 4, 14, 60];
export const CRATE_SIZE = 5;
export const CRATE_BONUS = 1.25;

export const kindOf = (planet: number, form: number) => planet * 10 + form;
export const planetOfKind = (k: number) => Math.floor(k / 10);
export const formOfKind = (k: number) => k % 10;
export const isCrate = (k: number) => k % 10 >= 5;

export interface PlanetDef {
	name: string;
	ore: string;
	color: string;
	light: string;
	dark: string;
	/** Price scale: item values and machine prices on this planet. */
	value: number;
	unlock: number;
	/** One-way flight time in seconds at ship speed level 0. */
	travel: number;
	newMachine: MachineType | null;
	pad: [number, number];
	seed: number;
	rings: boolean;
}

export const PLANETS: PlanetDef[] = [
	{ name: 'Cinder', ore: 'Rustite', color: '#ff7a45', light: '#ffc29e', dark: '#7a2a12', value: 1, unlock: 0, travel: 5, newMachine: null, pad: [10, 3], seed: 11, rings: false },
	{ name: 'Glacia', ore: 'Cryon', color: '#4fd8ff', light: '#b8f1ff', dark: '#11507a', value: 8, unlock: 3000, travel: 6, newMachine: 'crusher', pad: [10, 4], seed: 23, rings: true },
	{ name: 'Verdance', ore: 'Verdite', color: '#5dff8f', light: '#c2ffd4', dark: '#126b3a', value: 64, unlock: 25e3, travel: 7, newMachine: 'polisher', pad: [1, 3], seed: 37, rings: false },
	{ name: 'Solara', ore: 'Sunstone', color: '#ffd23f', light: '#fff0b0', dark: '#7a5a0a', value: 512, unlock: 600e3, travel: 8, newMachine: 'pylon', pad: [10, 6], seed: 41, rings: true },
	{ name: 'Umbra', ore: 'Voidglass', color: '#b47cff', light: '#e2ccff', dark: '#45227a', value: 4096, unlock: 12e6, travel: 9, newMachine: 'compactor', pad: [6, 0], seed: 53, rings: false },
	{ name: 'Halcyon', ore: 'Helionite', color: '#ff5fae', light: '#ffc2e2', dark: '#7a1450', value: 32768, unlock: 600e6, travel: 10, newMachine: 'forge', pad: [10, 1], seed: 67, rings: true },
];

export type MachineType = 'pad' | 'drill' | 'belt' | 'smelter' | 'crusher' | 'polisher' | 'pylon' | 'compactor' | 'forge';

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
}

export const MACHINES: Record<MachineType, MachineDef> = {
	pad: { name: 'Launch Pad', short: 'Pad', desc: 'Ships load cargo here and fly it home.', cost: 0, growth: 1, time: 0, inputs: [], need: 0, outForm: 0, outCount: 0, maxLv: 1, color: '#9fb4ff' },
	drill: { name: 'Drill', short: 'Drill', desc: 'Digs ore. Place it on an ore tile.', cost: 10, growth: 1.22, time: 2, inputs: [], need: 0, outForm: FORM_ORE, outCount: 1, maxLv: 12, color: '#ffb347' },
	belt: { name: 'Belt', short: 'Belt', desc: 'Moves items. Drag to lay a line.', cost: 1, growth: 1, time: 0, inputs: [], need: 0, outForm: 0, outCount: 0, maxLv: 1, color: '#7f8cff' },
	smelter: { name: 'Smelter', short: 'Smelter', desc: 'Melts ore or dust into bars. Bars sell for 4x.', cost: 60, growth: 1.3, time: 1, inputs: [FORM_ORE, FORM_DUST], need: 1, outForm: FORM_BAR, outCount: 1, maxLv: 12, color: '#ff6a3d' },
	crusher: { name: 'Crusher', short: 'Crusher', desc: 'Breaks 1 ore into 2 dust. Smelt dust for twice the bars.', cost: 150, growth: 1.35, time: 1, inputs: [FORM_ORE], need: 1, outForm: FORM_DUST, outCount: 2, maxLv: 12, color: '#6fe3ff' },
	polisher: { name: 'Polisher', short: 'Polisher', desc: 'Cuts a bar into a gem. Gems sell for 3.5x a bar.', cost: 800, growth: 1.35, time: 1, inputs: [FORM_BAR], need: 1, outForm: FORM_GEM, outCount: 1, maxLv: 12, color: '#5dff8f' },
	pylon: { name: 'Overdrive Pylon', short: 'Pylon', desc: 'Machines next to it work 50% faster.', cost: 5000, growth: 1.6, time: 0, inputs: [], need: 0, outForm: 0, outCount: 0, maxLv: 8, color: '#ffd23f' },
	compactor: { name: 'Compactor', short: 'Compactor', desc: 'Packs 5 items into 1 crate. Ships carry crates as 1 item, worth 25% more.', cost: 20e3, growth: 1.4, time: 1, inputs: [0, 1, 2, 3, 4], need: 5, outForm: 0, outCount: 1, maxLv: 12, color: '#b47cff' },
	forge: { name: 'Fusion Forge', short: 'Forge', desc: 'Fuses 3 gems into a star core worth 60x ore.', cost: 100e3, growth: 1.45, time: 1.5, inputs: [FORM_GEM], need: 3, outForm: FORM_CORE, outCount: 1, maxLv: 12, color: '#ff5fae' },
};

export const BUILD_ORDER: MachineType[] = ['drill', 'belt', 'smelter', 'crusher', 'polisher', 'pylon', 'compactor', 'forge'];

/** Speed factor of a machine at a level. */
export const levelSpeed = (lv: number) => 1 + 0.5 * (lv - 1);
export const upgradeCost = (t: MachineType, lv: number, planetValue: number) => MACHINES[t].cost * planetValue * Math.pow(1.55, lv - 1);
export const pylonBoost = (lv: number) => 0.5 + 0.15 * (lv - 1);

export const BUF_IN = 6;
export const BUF_OUT = 4;
export const BELT_SPACING = 0.5;

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
export const shipCargo = (lv: number) => 8 + 5 * lv;
export const shipSpeed = (lv: number) => 1 + 0.25 * lv;

export type ResearchId = 'belt' | 'tap' | 'market' | 'offline' | 'blast' | 'beacon';
export const RESEARCH: Record<ResearchId, UpgradeDef> = {
	belt: { name: 'Mag Belts', desc: 'All belts move 30% faster.', cost: 120, growth: 4, max: 10 },
	tap: { name: 'Power Gloves', desc: 'Each tap mines 2x more.', cost: 80, growth: 6, max: 12 },
	market: { name: 'Trade Deals', desc: 'All cargo sells for 20% more.', cost: 2000, growth: 4.5, max: 20 },
	offline: { name: 'Night Shift', desc: 'Work 1 more hour while you are away.', cost: 25e3, growth: 12, max: 6 },
	blast: { name: 'Blast Charges', desc: 'Clear rocks: tap one with the Remove tool. Cleared rocks stay gone, even after a nova.', cost: 1000, growth: 1, max: 1 },
	beacon: { name: 'Star Beacon', desc: 'Light a beacon at the edge of the system. The final project.', cost: 25e9, growth: 1, max: 1 },
};
export const beltSpeed = (lv: number, fastPerk: boolean) => (1.5 + 0.4 * lv) * (fastPerk ? 1.5 : 1);
export const tapPower = (lv: number) => Math.pow(2, lv);
/** Clearing a rock costs this times the planet's ore value, and grows with each rock cleared there. */
export const BLAST_COST = 40;
export const BLAST_GROWTH = 2.5;

export type PerkId = 'hands' | 'hull' | 'start' | 'blueprint' | 'nap' | 'belts';
export interface PerkDef {
	name: string;
	desc: string;
	cost: number;
}
export const PERKS: Record<PerkId, PerkDef> = {
	hands: { name: 'Quick Hands', desc: 'Taps mine 5x more.', cost: 1 },
	start: { name: 'Head Start', desc: 'Start each run with 1,000 credits.', cost: 2 },
	belts: { name: 'Slick Belts', desc: 'Belts move 50% faster.', cost: 3 },
	hull: { name: 'Spare Hull', desc: 'Every route starts with 1 extra ship.', cost: 4 },
	nap: { name: 'Long Nap', desc: 'Work 4 more hours while away.', cost: 5 },
	blueprint: { name: 'Blueprint Memory', desc: 'Keep the Cinder factory when you reset.', cost: 8 },
};

/** Stardust each 1 gives +25% to all sales. */
export const DUST_BONUS = 0.25;
export const PRESTIGE_PLANET = 3;
export const stardustFor = (runEarned: number) => Math.floor(Math.pow(runEarned / 2e6, 0.45));

export const BASE_OFFLINE_HOURS = 2;

// ---------- crew ----------
// A shared pool of managers. Each one works on one planet at a time and boosts one thing there.
// Hired crew and their levels stay through a Nova Reset.

export type CrewRole = 'drill' | 'machine' | 'ship' | 'sell';

export type CrewId = 'pip' | 'bex' | 'tull' | 'fenn' | 'marlo' | 'ione' | 'sora' | 'juno';
export interface CrewDef {
	name: string;
	title: string;
	role: CrewRole;
	/** Boost per level, as a fraction. Ship crew also add a third of this to cargo. */
	per: number;
	/** Credits to hire. Training costs more each level. */
	cost: number;
	color: string;
}
export const CREW: Record<CrewId, CrewDef> = {
	pip: { name: 'Pip', title: 'Drill Hand', role: 'drill', per: 0.2, cost: 500, color: '#ffb347' },
	bex: { name: 'Bex', title: 'Foreman', role: 'machine', per: 0.15, cost: 2000, color: '#6fe3ff' },
	tull: { name: 'Tull', title: 'Dock Hand', role: 'ship', per: 0.15, cost: 5000, color: '#9fb4ff' },
	fenn: { name: 'Fenn', title: 'Trader', role: 'sell', per: 0.08, cost: 50e3, color: '#ffd23f' },
	marlo: { name: 'Marlo', title: 'Deep Prospector', role: 'drill', per: 0.4, cost: 2e6, color: '#ff7a45' },
	ione: { name: 'Ione', title: 'Chief Engineer', role: 'machine', per: 0.3, cost: 20e6, color: '#5dff8f' },
	sora: { name: 'Sora', title: 'Flight Boss', role: 'ship', per: 0.3, cost: 200e6, color: '#b47cff' },
	juno: { name: 'Juno', title: 'Star Broker', role: 'sell', per: 0.15, cost: 2e9, color: '#ff5fae' },
};
export const CREW_ORDER = Object.keys(CREW) as CrewId[];
export const CREW_MAX = 10;
export const CREW_GROWTH = 2.2;
/** Cost to hire (lv 0) or to train from lv to lv + 1. */
export const crewCostAt = (id: CrewId, lv: number) => CREW[id].cost * Math.pow(CREW_GROWTH, lv);

/** Crew slots: how many crew can work at once. The first is free; more cost stardust. */
export const SLOT_COSTS = [5, 10, 20, 40];
export const BASE_SLOTS = 1;

/** What crew on a planet do, added up. 1 means no change. */
export interface CrewBoost {
	drill: number;
	machine: number;
	shipSpeed: number;
	cargo: number;
	sell: number;
}
export const NO_BOOST: Readonly<CrewBoost> = { drill: 1, machine: 1, shipSpeed: 1, cargo: 1, sell: 1 };

/** Adds one crew member at a level to a boost. */
export function addCrew(b: CrewBoost, id: CrewId, lv: number) {
	const { role, per } = CREW[id];
	const n = per * lv;
	if (role === 'drill') b.drill += n;
	else if (role === 'machine') b.machine += n;
	else if (role === 'sell') b.sell += n;
	else {
		b.shipSpeed += n;
		b.cargo += n / 3;
	}
}

/** One line on what a crew member does at a level. */
export function crewText(id: CrewId, lv: number): string {
	const { role, per } = CREW[id];
	const pct = (n: number) => `+${Math.round(n * 100)}%`;
	const n = per * lv;
	switch (role) {
		case 'drill':
			return `Drills dig ${pct(n)} faster.`;
		case 'machine':
			return `Other machines work ${pct(n)} faster.`;
		case 'ship':
			return `Ships fly ${pct(n)} faster and carry ${pct(n / 3)} more.`;
		case 'sell':
			return `Cargo sells for ${pct(n)} more.`;
	}
}
