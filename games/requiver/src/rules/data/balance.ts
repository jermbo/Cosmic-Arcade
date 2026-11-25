// Every global balance number lives here. Tune freely after a playtest.
// World units: the battle field is 960 x 540, y grows down, the ground is a flat line.

export const WORLD = {
	width: 960,
	height: 540,
	groundY: 470,
	/** Where the archer stands. */
	archerX: 92,
	/** Where arrows leave the bow. */
	bowX: 104,
	bowY: 418,
	/** The point enemies and projectiles aim at (the archer's chest). */
	targetY: 430,
	/** Where new enemies appear (off the right edge). */
	spawnX: 1010,
	/** Walkers stop and hit the archer here. */
	meleeX: 132,
	/** Defenses. */
	wallX: 178,
	wallHeight: 74,
	spikesFrom: 205,
	spikesTo: 300,
	helperX: 46,
	helperY: 432,
};

export const PHYSICS = {
	gravity: 980,
	/** Arrow speed at zero pull and at full pull. */
	minSpeed: 360,
	maxSpeed: 1080,
	/** Seconds before a flying arrow is removed. */
	arrowLife: 5,
	/** Fixed step of the simulation. */
	step: 1 / 120,
};

export const BOW = {
	/** Seconds to reach full pull. */
	drawTime: 0.42,
	/** Seconds after a shot before the next pull can start to count. */
	cooldown: 0.3,
	/** Drag length in world units that gives full pull. */
	pullLength: 160,
	/** Shorter drags than this cancel the shot. */
	deadZone: 16,
	/** Spread in degrees between arrows when one shot fires many. */
	multiSpread: 4,
	/** The preview arc shows this many seconds of flight. */
	aimArc: 0.2,
	/** Each point of the preview arc is this many seconds apart. */
	aimArcDot: 0.024,
};

export const PLAYER = {
	maxHp: 60,
	startGold: 30,
	slots: 3,
	maxSlots: 7,
};

export const DAMAGE = {
	/** A body hit deals this much. Most foes have 2 hp. */
	body: 1,
	/** A head hit kills any normal foe. Bosses take this many times body damage on the head instead. */
	bossHeadMult: 2,
};

/** Hit boxes are a little bigger than the drawings, so fair shots on a phone land. */
export const HITBOX = {
	headPad: 3,
	bodyPad: 2,
	projectilePad: 6,
};

export const COMBO = {
	max: 100,
	/** Meter gained by each kill. */
	killGain: 6,
	/** Extra meter for each kill already in the streak. */
	streakGain: 1.2,
	streakCap: 10,
	/** Extra meter for each kill after the first with one shot. */
	multiKillBonus: 12,
	/** Head shot kills fill this much faster. */
	headshotMult: 1.3,
	/** When this share of the meter came from head shots, the bonus is a Crown Shot. */
	crownShare: 0.6,
};

export const BONUS = {
	volley: {
		name: 'Arrow Rain',
		arrows: 12,
		spread: 150,
		/** Height above the ground where rain arrows start. */
		height: 560,
		speed: 900,
		damage: 1,
	},
	crown: {
		name: 'Crown Shot',
		speed: 1500,
		/** Every hit counts as a head shot. On a boss it deals this much. */
		bossDamage: 8,
	},
};

export const FX = {
	/** Hit stop in seconds. The rules do not use these; the game does. */
	hitStopBody: 0.03,
	hitStopHead: 0.075,
	hitStopKill: 0.05,
	hitStopBoss: 0.12,
	/** Slow motion on the last kill of a fight. */
	finalSlowmo: 0.9,
};

export const WAVES = {
	/** A wave starts when at most this many foes are left, or after `maxGap` seconds. */
	nextWhenLeft: 2,
	maxGap: 15,
	gapAfterClear: 1.4,
	/** Seconds between spawns inside a wave. */
	spawnGap: [0.6, 1.6] as [number, number],
	/** Waves per fight, by spot kind. */
	count: { fight: [2, 3], elite: [3, 3], boss: [1, 1] } as Record<string, [number, number]>,
	/** Budget grows with the row of the spot on the map. */
	rowGrowth: 0.07,
	/** Each later wave in a fight gets this much more budget. */
	waveGrowth: 0.22,
	eliteBudget: 1.35,
	/** Chance that a foe in an elite fight is an elite. */
	eliteChance: 0.22,
	/** In the very first fight of a new player, the first wave waits for the first shot. */
	tutorialHold: true,
};

export const ELITE = {
	hpMult: 1.7,
	extraHelmet: 1,
	sizeMult: 1.15,
	damageMult: 1.3,
	speedMult: 1.05,
};

export const ECONOMY = {
	goldFight: [14, 22] as [number, number],
	goldElite: [32, 44] as [number, number],
	goldBoss: [70, 90] as [number, number],
	goldTreasure: [30, 50] as [number, number],
	/** Gold for skipping a boost reward. */
	skipGold: 12,
	/** Boost choices after a fight. */
	rewardChoices: 3,
	/** Chance of each rarity in a normal reward, then in an elite or treasure reward. */
	rarityOdds: {
		fight: { common: 70, uncommon: 26, rare: 4 },
		elite: { common: 30, uncommon: 50, rare: 20 },
		treasure: { common: 10, uncommon: 50, rare: 40 },
		boss: { common: 0, uncommon: 40, rare: 60 },
		shop: { common: 55, uncommon: 35, rare: 10 },
		event: { common: 60, uncommon: 32, rare: 8 },
	} as Record<string, Record<'common' | 'uncommon' | 'rare', number>>,
	/** Chance that a treasure, elite or boss reward also offers an extra slot. */
	slotOfferChance: { treasure: 0.35, elite: 0.15, boss: 1 } as Record<string, number>,
};

export const SHOP = {
	boostCount: 3,
	price: { common: 45, uncommon: 70, rare: 110 } as Record<string, number>,
	priceJitter: 0.12,
	heal: { amount: 20, price: 30 },
	upgradePrice: 60,
	slotPrice: 150,
	slotChance: 0.4,
};

export const REST = {
	/** Share of max hp a rest heals. */
	healShare: 0.32,
};

export const META = {
	currency: 'Feathers',
	payout: {
		perSpot: 0.6,
		perKill: 0.05,
		perHeadshot: 0.03,
		perElite: 2,
		perBoss: 6,
		win: 15,
	},
};

export const SCORE = {
	perKill: 10,
	perHeadshot: 6,
	perSpot: 40,
	perElite: 120,
	perBoss: 600,
	perAct: 300,
	win: 2000,
	perHpLeft: 10,
	perMaxCombo: 4,
};
