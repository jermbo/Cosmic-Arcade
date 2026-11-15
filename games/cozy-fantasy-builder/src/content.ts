/** The content of the game as data: pieces, islands, combos and goals. */

export const GAME_NAME = 'Petalwisp Isles';

export type PieceId =
	| 'path'
	| 'cottage'
	| 'tree'
	| 'flower'
	| 'pond'
	| 'lantern'
	| 'bridge'
	| 'crystal'
	| 'bench'
	| 'waterfall'
	| 'windmill'
	| 'mushroom'
	| 'dock'
	| 'market'
	| 'tower'
	| 'elder';

/** What an elf does when it visits a piece. */
export type Visit = 'rest' | 'sit' | 'gather' | 'shop' | 'sniff' | 'wish' | 'gaze';

export interface PieceDef {
	id: PieceId;
	name: string;
	blurb: string;
	/** Where the piece can stand: on land, on an island edge, or in the air next to land. */
	on: 'land' | 'edge' | 'air';
	/** The player can turn it. */
	turns?: boolean;
	/** Elves can walk over it. */
	walk?: boolean;
	/** It waters the grass around it. */
	water?: boolean;
	/** It counts as nature: critters come to it. */
	nature?: boolean;
	/** It is in the toolbar from the start. */
	starter?: boolean;
	/** Elves come to it and do this. */
	visit?: Visit;
	/** It sends floating lanterns up at night. */
	lanterns?: boolean;
	/** It is part of an island. The player cannot build or remove it. */
	fixed?: boolean;
	/** The pitch of its placing sound, as a step of the scale. */
	note: number;
}

export const PIECES: PieceDef[] = [
	{ id: 'path', name: 'Moss path', blurb: 'Drag to draw a path. Elves love to walk on it.', on: 'land', walk: true, starter: true, note: 0 },
	{ id: 'cottage', name: 'Tree home', blurb: 'A home for one elf. Homes side by side link their branches.', on: 'land', turns: true, starter: true, note: 2 },
	{ id: 'tree', name: 'Sapling', blurb: 'Starts small and grows tall. Faster near water.', on: 'land', nature: true, starter: true, note: 4 },
	{ id: 'flower', name: 'Flower bed', blurb: 'A patch of wild blooms.', on: 'land', nature: true, starter: true, visit: 'sniff', note: 5 },
	{ id: 'pond', name: 'Spring pool', blurb: 'Pools side by side join. Grass grows lush near water.', on: 'land', water: true, starter: true, visit: 'rest', note: 1 },
	{ id: 'lantern', name: 'Lantern vine', blurb: 'A warm light. Elves and moon moths gather here.', on: 'land', starter: true, visit: 'gather', note: 6 },
	{ id: 'bench', name: 'Log seat', blurb: 'A seat with a view.', on: 'land', turns: true, visit: 'sit', note: 2 },
	{ id: 'crystal', name: 'Crystal', blurb: 'A humming sky crystal. It likes company.', on: 'land', note: 7 },
	{ id: 'waterfall', name: 'Spring rock', blurb: 'Next to a pool on an island edge, it spills into the sky.', on: 'land', water: true, note: 1 },
	{ id: 'mushroom', name: 'Mushroom ring', blurb: 'Critters meet here.', on: 'land', nature: true, note: 5 },
	{ id: 'windmill', name: 'Wind bloom', blurb: 'Its petals turn in the sky wind.', on: 'land', turns: true, note: 4 },
	{ id: 'bridge', name: 'Rope bridge', blurb: 'Build it in the air, out from an island edge.', on: 'air', walk: true, note: 3 },
	{ id: 'dock', name: 'Sky dock', blurb: 'A pier for a little leaf boat. Needs an island edge.', on: 'edge', turns: true, walk: true, visit: 'gaze', note: 3 },
	{ id: 'market', name: 'Cap stall', blurb: 'Fresh sky fruit under a mushroom cap.', on: 'land', turns: true, visit: 'shop', note: 6 },
	{ id: 'tower', name: 'Moon spire', blurb: 'Sends wish lanterns up at night.', on: 'land', lanterns: true, visit: 'wish', note: 8 },
	{ id: 'elder', name: 'Elder Tree', blurb: 'The oldest tree in the sky. Elves come here to wish.', on: 'land', fixed: true, lanterns: true, visit: 'wish', note: 8 },
];

export const PIECE = Object.fromEntries(PIECES.map((p) => [p.id, p])) as Record<PieceId, PieceDef>;

export interface IslandDef {
	name: string;
	blurb: string;
	cx: number;
	cz: number;
	/** Radius in cells. */
	r: number;
	seed: number;
	/** The island that its bridge grows from. */
	from: number;
	/** Grass colours: dry and lush. */
	dry: number;
	lush: number;
	/** Rock colours: near the top and deep down. */
	rock: number;
	deep: number;
	/** How many waterfalls pour off its edge. */
	falls: number;
	/** How many crystals grow in its rock. */
	gems: number;
	gemColors: number[];
	/** Fixed pieces that stand on it, as offsets from its centre. */
	fixed?: { t: PieceId; dx: number; dz: number }[];
}

/** The first island is the home. The rest unlock in this order. */
export const ISLANDS: IslandDef[] = [
	{ name: 'Home Grove', blurb: 'Where the first elves settled.', cx: 0, cz: 0, r: 7.6, seed: 3, from: 0, dry: 0x9cc76a, lush: 0x3fa36b, rock: 0x8d7f9e, deep: 0x4c4468, falls: 3, gems: 6, gemColors: [0xc7a8ff, 0x9fe0ff, 0xffb3e6] },
	{ name: 'Crystal Hollow', blurb: 'Its rock sings with crystals.', cx: 17, cz: -5, r: 4.3, seed: 11, from: 0, dry: 0x9fc48a, lush: 0x4aa88c, rock: 0x8478b0, deep: 0x413a78, falls: 1, gems: 22, gemColors: [0xb48cff, 0x7fd8ff, 0xe89cff, 0x9fffe6] },
	{ name: 'Moon Garden', blurb: 'Silver grass that glows at night.', cx: -16, cz: 8, r: 4.6, seed: 23, from: 0, dry: 0xa9cdb0, lush: 0x5fb4a6, rock: 0x7f8fb0, deep: 0x3b4670, falls: 2, gems: 8, gemColors: [0xcfe4ff, 0xa8c8ff, 0xf0f4ff] },
	{ name: 'Elder Tree', blurb: 'Home of the oldest tree in the sky.', cx: -4, cz: -20, r: 5.4, seed: 51, from: 0, dry: 0x8fc060, lush: 0x2f9a58, rock: 0x8a7a6e, deep: 0x4a3f4c, falls: 2, gems: 5, gemColors: [0xffe08a, 0xb9ffb0, 0xffc9a3], fixed: [{ t: 'elder', dx: 0, dz: 0 }] },
];

/** Islands the player has at the start. */
export const START_ISLANDS = 1;

/** The farthest cell from the centre where a bridge can go. */
export const WORLD_RADIUS = 30;

export interface ComboDef {
	id: string;
	name: string;
	a: PieceId;
	b: PieceId;
	/** Shown in the book when found. */
	text: string;
	/** Shown in the book before it is found. */
	hint: string;
	/** Which piece of the pair carries the effect. */
	host: 'a' | 'b';
	/** Colours of its sparkles. */
	colors: number[];
	/** How its sparkles move. */
	motion: 'rise' | 'orbit' | 'swirl';
}

export const COMBOS: ComboDef[] = [
	{ id: 'spring', name: 'Glowing Spring', a: 'crystal', b: 'pond', host: 'b', text: 'The crystal hums and the pond begins to glow.', hint: 'Something shiny likes still water.', colors: [0x9ff3ee, 0xd6fffb], motion: 'rise' },
	{ id: 'firefly', name: 'Firefly Tree', a: 'lantern', b: 'tree', host: 'b', text: 'Fireflies follow the light and nest in the leaves.', hint: 'A light next to something that grows.', colors: [0xfff3a0, 0xe9ff9a], motion: 'orbit' },
	{ id: 'petal', name: 'Petal Breeze', a: 'windmill', b: 'flower', host: 'b', text: 'The sails lift petals and send them dancing.', hint: 'A wind bloom next to soft blooms.', colors: [0xffc1d9, 0xfff0f5, 0xffe08a], motion: 'swirl' },
	{ id: 'nook', name: 'Story Nook', a: 'lantern', b: 'bench', host: 'b', text: 'A cosy place for tales after dark.', hint: 'A seat needs a light to read by.', colors: [0xffd58a, 0xffeec4], motion: 'rise' },
	{ id: 'fairy', name: 'Fairy Circle', a: 'crystal', b: 'mushroom', host: 'b', text: 'Tiny lights wake up and dance in the ring.', hint: 'Critters whisper about a shiny stone in their ring.', colors: [0xd4b3ff, 0xa8fff0, 0xffb8ec], motion: 'orbit' },
	{ id: 'rainbow', name: 'Rainbow Falls', a: 'crystal', b: 'waterfall', host: 'b', text: 'Light splits in the spray. A small rainbow stays.', hint: 'Falling water can split the light.', colors: [0xff9aa2, 0xffe08a, 0x9be7a5, 0x9fd0ff, 0xc9a8ff], motion: 'rise' },
];

export type GoalKind = 'place' | 'villagers' | 'combos' | 'trees' | 'spill' | 'gifts';

export interface GoalDef {
	id: string;
	text: string;
	kind: GoalKind;
	/** For `place`: which piece to count. */
	piece?: PieceId;
	n: number;
	/** What the goal unlocks: a piece, or the next sky island. */
	reward: { piece: PieceId } | { island: true } | { gift: string };
}

/** The milestones, in the order that the tracker shows them. */
export const GOALS: GoalDef[] = [
	{ id: 'home1', text: 'Grow a tree home', kind: 'place', piece: 'cottage', n: 1, reward: { piece: 'bench' } },
	{ id: 'paths', text: 'Lay 8 moss paths', kind: 'place', piece: 'path', n: 8, reward: { piece: 'crystal' } },
	{ id: 'vill3', text: 'House 3 elves', kind: 'villagers', n: 3, reward: { piece: 'waterfall' } },
	{ id: 'combo1', text: 'Discover a magic link', kind: 'combos', n: 1, reward: { piece: 'mushroom' } },
	{ id: 'vill6', text: 'House 6 elves', kind: 'villagers', n: 6, reward: { island: true } },
	{ id: 'trees', text: 'Grow 4 tall trees', kind: 'trees', n: 4, reward: { piece: 'windmill' } },
	{ id: 'gift1', text: 'Tap a lantern jelly for a gift', kind: 'gifts', n: 1, reward: { piece: 'bridge' } },
	{ id: 'lanterns', text: 'Hang 5 lantern vines', kind: 'place', piece: 'lantern', n: 5, reward: { piece: 'dock' } },
	{ id: 'vill12', text: 'House 12 elves', kind: 'villagers', n: 12, reward: { island: true } },
	{ id: 'spill', text: 'Make a spring rock spill off an edge', kind: 'spill', n: 1, reward: { piece: 'market' } },
	{ id: 'combo4', text: 'Discover 4 magic links', kind: 'combos', n: 4, reward: { piece: 'tower' } },
	{ id: 'vill20', text: 'House 20 elves', kind: 'villagers', n: 20, reward: { island: true } },
	{ id: 'gift8', text: 'Collect 8 jelly gifts', kind: 'gifts', n: 8, reward: { gift: 'Shooting stars at night' } },
	{ id: 'vill30', text: 'House 30 elves', kind: 'villagers', n: 30, reward: { gift: 'A golden sky whale' } },
];

export const VILLAGER_NAMES = ['Pip', 'Mallow', 'Fen', 'Juno', 'Tansy', 'Bram', 'Wren', 'Olli', 'Nim', 'Posy', 'Dabble', 'Suki', 'Thistle', 'Moss', 'Lumi', 'Quill', 'Aelin', 'Sorrel', 'Fael', 'Ivy', 'Rowan', 'Elowen', 'Briar', 'Lark', 'Yarrow', 'Sylvi', 'Alder', 'Nettle', 'Clove', 'Finch', 'Linden', 'Hazel', 'Ash', 'Dew', 'Fern', 'Tamsin'];

/** Balance numbers. Times are in seconds. */
export const TUNE = {
	/** One full day and night. */
	dayLength: 260,
	/** A sapling becomes a tall tree in about this time, with no water near. */
	treeGrowTime: 110,
	/** How long a new tree home waits for its elf. */
	moveInDelay: 3.5,
	/** Cells around water that turn lush. */
	waterReach: 2,
	/** A jelly gift helps the land this many cells around. */
	giftReach: 2,
	/** Time away from the game that counts, at most. */
	awayCap: 3600,
	maxCritters: 6,
	undoDepth: 200,
};
