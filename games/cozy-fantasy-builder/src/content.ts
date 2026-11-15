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
	| 'tower';

/** What a villager does when it visits a piece. */
export type Visit = 'rest' | 'sit' | 'gather' | 'shop' | 'sniff' | 'wish' | 'gaze';

export interface PieceDef {
	id: PieceId;
	name: string;
	blurb: string;
	/** Where the piece can stand: on land, on an island edge, or in the air next to land. */
	on: 'land' | 'edge' | 'air';
	/** The player can turn it. */
	turns?: boolean;
	/** Villagers can walk over it. */
	walk?: boolean;
	/** It waters the grass around it. */
	water?: boolean;
	/** It counts as nature: critters come to it. */
	nature?: boolean;
	/** It is in the toolbar from the start. */
	starter?: boolean;
	/** Villagers come to it and do this. */
	visit?: Visit;
	/** It sends floating lanterns up at night. */
	lanterns?: boolean;
	/** The pitch of its placing sound, as a step of the scale. */
	note: number;
}

export const PIECES: PieceDef[] = [
	{ id: 'path', name: 'Path', blurb: 'Stone steps. Villagers love to walk on them.', on: 'land', walk: true, starter: true, note: 0 },
	{ id: 'cottage', name: 'Cottage', blurb: 'A home for one villager. Cottages side by side share a roof.', on: 'land', turns: true, starter: true, note: 2 },
	{ id: 'tree', name: 'Sapling', blurb: 'Starts small and grows into a tree. Faster near water.', on: 'land', nature: true, starter: true, note: 4 },
	{ id: 'flower', name: 'Flower bed', blurb: 'A patch of soft blooms.', on: 'land', nature: true, starter: true, visit: 'sniff', note: 5 },
	{ id: 'pond', name: 'Pond', blurb: 'Ponds side by side join. Grass grows lush near water.', on: 'land', water: true, starter: true, visit: 'rest', note: 1 },
	{ id: 'lantern', name: 'Lantern', blurb: 'A warm light. Villagers gather here at dusk.', on: 'land', starter: true, visit: 'gather', note: 6 },
	{ id: 'bridge', name: 'Bridge', blurb: 'Build it in the air, out from an island edge.', on: 'air', walk: true, note: 3 },
	{ id: 'crystal', name: 'Crystal', blurb: 'A humming sky crystal. It likes company.', on: 'land', note: 7 },
	{ id: 'bench', name: 'Bench', blurb: 'A seat with a view.', on: 'land', turns: true, visit: 'sit', note: 2 },
	{ id: 'waterfall', name: 'Waterfall rock', blurb: 'Next to a pond on an island edge, it spills into the sky.', on: 'land', water: true, note: 1 },
	{ id: 'windmill', name: 'Windmill', blurb: 'Turns in the sky wind.', on: 'land', turns: true, note: 4 },
	{ id: 'mushroom', name: 'Mushroom ring', blurb: 'Critters meet here.', on: 'land', nature: true, note: 5 },
	{ id: 'dock', name: 'Sky dock', blurb: 'A pier for a little balloon boat. Needs an island edge.', on: 'edge', turns: true, walk: true, visit: 'gaze', note: 3 },
	{ id: 'market', name: 'Market stall', blurb: 'Fresh sky fruit, every day.', on: 'land', turns: true, visit: 'shop', note: 6 },
	{ id: 'tower', name: 'Wishing tower', blurb: 'Sends wish lanterns up at night.', on: 'land', lanterns: true, visit: 'wish', note: 8 },
];

export const PIECE = Object.fromEntries(PIECES.map((p) => [p.id, p])) as Record<PieceId, PieceDef>;

export interface IslandDef {
	name: string;
	cx: number;
	cz: number;
	/** Radius in cells. */
	r: number;
	seed: number;
}

/** The first island is the main one. The rest unlock in this order. */
export const ISLANDS: IslandDef[] = [
	{ name: 'Homestead', cx: 0, cz: 0, r: 4.7, seed: 3 },
	{ name: 'Dewdrop Isle', cx: 10, cz: -2, r: 2.4, seed: 11 },
	{ name: 'Clover Isle', cx: -9, cz: 5, r: 2.5, seed: 23 },
	{ name: 'Hush Isle', cx: 2, cz: 10, r: 2.3, seed: 37 },
	{ name: 'Starrest Isle', cx: -3, cz: -10, r: 2.7, seed: 51 },
];

/** Islands the player has at the start. */
export const START_ISLANDS = 2;

/** The farthest cell from the centre where a bridge can go. */
export const WORLD_RADIUS = 15;

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
	{ id: 'petal', name: 'Petal Breeze', a: 'windmill', b: 'flower', host: 'b', text: 'The sails lift petals and send them dancing.', hint: 'Sky wind meets soft blooms.', colors: [0xffc1d9, 0xfff0f5, 0xffe08a], motion: 'swirl' },
	{ id: 'nook', name: 'Story Nook', a: 'lantern', b: 'bench', host: 'b', text: 'A cosy place for tales after dark.', hint: 'A seat needs a light to read by.', colors: [0xffd58a, 0xffeec4], motion: 'rise' },
	{ id: 'fairy', name: 'Fairy Circle', a: 'crystal', b: 'mushroom', host: 'b', text: 'Tiny lights wake up and dance in the ring.', hint: 'Critters whisper about a shiny stone in their ring.', colors: [0xd4b3ff, 0xa8fff0, 0xffb8ec], motion: 'orbit' },
	{ id: 'rainbow', name: 'Rainbow Falls', a: 'crystal', b: 'waterfall', host: 'b', text: 'Light splits in the spray. A small rainbow stays.', hint: 'Falling water can split the light.', colors: [0xff9aa2, 0xffe08a, 0x9be7a5, 0x9fd0ff, 0xc9a8ff], motion: 'rise' },
];

export type GoalKind = 'place' | 'villagers' | 'links' | 'combos' | 'trees' | 'spill';

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

export const GOALS: GoalDef[] = [
	{ id: 'home1', text: 'Place a cottage', kind: 'place', piece: 'cottage', n: 1, reward: { piece: 'bridge' } },
	{ id: 'paths', text: 'Lay 6 paths', kind: 'place', piece: 'path', n: 6, reward: { piece: 'bench' } },
	{ id: 'vill2', text: 'Home 2 villagers', kind: 'villagers', n: 2, reward: { piece: 'crystal' } },
	{ id: 'link1', text: 'Link a sky island with a bridge', kind: 'links', n: 1, reward: { island: true } },
	{ id: 'combo1', text: 'Discover a magic link', kind: 'combos', n: 1, reward: { piece: 'waterfall' } },
	{ id: 'vill5', text: 'Home 5 villagers', kind: 'villagers', n: 5, reward: { piece: 'windmill' } },
	{ id: 'trees', text: 'Grow 3 tall trees', kind: 'trees', n: 3, reward: { piece: 'mushroom' } },
	{ id: 'combo3', text: 'Discover 3 magic links', kind: 'combos', n: 3, reward: { island: true } },
	{ id: 'link2', text: 'Link 2 sky islands', kind: 'links', n: 2, reward: { piece: 'dock' } },
	{ id: 'spill', text: 'Make a waterfall spill off an edge', kind: 'spill', n: 1, reward: { island: true } },
	{ id: 'vill8', text: 'Home 8 villagers', kind: 'villagers', n: 8, reward: { piece: 'market' } },
	{ id: 'combo5', text: 'Discover 5 magic links', kind: 'combos', n: 5, reward: { piece: 'tower' } },
	{ id: 'link4', text: 'Link all 4 sky islands', kind: 'links', n: 4, reward: { gift: 'Shooting stars at night' } },
];

export const VILLAGER_NAMES = ['Pip', 'Mallow', 'Fen', 'Juno', 'Tansy', 'Bram', 'Wren', 'Olli', 'Nim', 'Posy', 'Dabble', 'Suki', 'Thistle', 'Moss', 'Lumi', 'Quill'];

/** Balance numbers. Times are in seconds. */
export const TUNE = {
	/** One full day and night. */
	dayLength: 260,
	/** A sapling becomes a tall tree in about this time, with no water near. */
	treeGrowTime: 110,
	/** How long a new cottage waits for its villager. */
	moveInDelay: 3.5,
	/** Cells around water that turn lush. */
	waterReach: 2,
	/** Rain comes after a pause in this range. */
	rainGap: [150, 280] as const,
	rainLength: [26, 40] as const,
	rainbowLength: 45,
	maxCritters: 6,
	undoDepth: 200,
};
