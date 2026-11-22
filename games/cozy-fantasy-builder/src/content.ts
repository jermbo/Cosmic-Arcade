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
	| 'elder'
	| 'crossing'
	| 'shroomhouse'
	| 'stonehut'
	| 'nest'
	| 'stonebench'
	| 'swing'
	| 'picnic'
	| 'bakery'
	| 'teahouse'
	| 'well'
	| 'board'
	| 'towntree'
	| 'garden'
	| 'workshop'
	| 'library'
	| 'timberhouse'
	| 'towerhouse';

/** What an elf does when it visits a piece. */
export type Visit = 'rest' | 'sit' | 'gather' | 'shop' | 'sniff' | 'wish' | 'gaze' | 'feast' | 'read';

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
	/** The player draws it with a drag, cell after cell. */
	draw?: boolean;
	/** Elves live in it. */
	home?: boolean;
	/** For a home: how many elves live in it. */
	beds?: number;
	/** For a home: how many floors it has inside. */
	floors?: number;
	/** Elves work here at this job. */
	work?: JobId;
	/** It has a door. A path joins it on the side that it faces. */
	door?: boolean;
	/** The game builds it by itself. It is not in the toolbar. */
	hidden?: boolean;
	/** The pitch of its placing sound, as a step of the scale. */
	note: number;
}

export const PIECES: PieceDef[] = [
	{ id: 'path', name: 'Moss path', blurb: 'Drag to draw a path. Elves love to walk on it.', on: 'land', walk: true, draw: true, starter: true, note: 0 },
	{ id: 'cottage', name: 'Tree home', blurb: 'Two floors, two elves. Homes side by side link their branches.', on: 'land', turns: true, home: true, beds: 2, floors: 2, door: true, starter: true, note: 2 },
	{ id: 'shroomhouse', name: 'Mushroom house', blurb: 'A snug one-floor home for one elf, under a big cap.', on: 'land', turns: true, home: true, beds: 1, floors: 1, door: true, note: 3 },
	{ id: 'stonehut', name: 'Stone hut', blurb: 'A round one-floor home for one elf, with a moss roof.', on: 'land', turns: true, home: true, beds: 1, floors: 1, door: true, note: 1 },
	{ id: 'nest', name: 'Nest house', blurb: 'Two floors high up in a tree, for two elves.', on: 'land', turns: true, home: true, beds: 2, floors: 2, door: true, note: 5 },
	{ id: 'timberhouse', name: 'Timber house', blurb: 'Two floors of warm wood and a flower box, for two elves.', on: 'land', turns: true, home: true, beds: 2, floors: 2, door: true, note: 4 },
	{ id: 'towerhouse', name: 'Tower house', blurb: 'Three floors under a pointy roof, for three elves.', on: 'land', turns: true, home: true, beds: 3, floors: 3, door: true, note: 6 },
	{ id: 'tree', name: 'Sapling', blurb: 'Starts small and grows tall. Faster near water.', on: 'land', nature: true, starter: true, note: 4 },
	{ id: 'flower', name: 'Flower bed', blurb: 'A patch of wild blooms.', on: 'land', nature: true, starter: true, visit: 'sniff', note: 5 },
	{ id: 'pond', name: 'River pool', blurb: 'Drag to draw a river. A path crosses it on a little bridge.', on: 'land', water: true, draw: true, starter: true, visit: 'rest', note: 1 },
	{ id: 'lantern', name: 'Lantern vine', blurb: 'A warm light. Elves and moon moths gather here.', on: 'land', turns: true, starter: true, visit: 'gather', note: 6 },
	{ id: 'bench', name: 'Log seat', blurb: 'A seat with a view.', on: 'land', turns: true, visit: 'sit', note: 2 },
	{ id: 'stonebench', name: 'Stone bench', blurb: 'A cool stone seat with moss on it.', on: 'land', turns: true, visit: 'sit', note: 0 },
	{ id: 'swing', name: 'Swing', blurb: 'It sways in the sky wind. Elves love a ride.', on: 'land', turns: true, visit: 'sit', note: 4 },
	{ id: 'picnic', name: 'Picnic table', blurb: 'Elves bring treats here on festival nights.', on: 'land', turns: true, visit: 'feast', note: 5 },
	{ id: 'crystal', name: 'Crystal', blurb: 'A humming sky crystal. It likes company.', on: 'land', note: 7 },
	{ id: 'waterfall', name: 'Spring rock', blurb: 'Next to a pool on an island edge, it spills into the sky.', on: 'land', water: true, note: 1 },
	{ id: 'well', name: 'Wishing well', blurb: 'Cool water from deep in the rock. Grass grows lush around it.', on: 'land', water: true, visit: 'rest', note: 3 },
	{ id: 'mushroom', name: 'Mushroom ring', blurb: 'Critters meet here.', on: 'land', nature: true, note: 5 },
	{ id: 'windmill', name: 'Wind bloom', blurb: 'Its petals turn in the sky wind.', on: 'land', turns: true, note: 4 },
	{ id: 'bridge', name: 'Rope bridge', blurb: 'Build it in the air, out from an island edge.', on: 'air', walk: true, note: 3 },
	{ id: 'dock', name: 'Sky dock', blurb: 'A pier for a little leaf boat. A sky fisher works here.', on: 'edge', turns: true, walk: true, visit: 'gaze', work: 'fisher', note: 3 },
	{ id: 'market', name: 'Cap stall', blurb: 'Fresh sky fruit under a mushroom cap. A grocer works here.', on: 'land', turns: true, door: true, visit: 'shop', work: 'grocer', note: 6 },
	{ id: 'bakery', name: 'Bakery', blurb: 'Warm buns under a roof like a loaf of bread. Two bakers work here.', on: 'land', turns: true, door: true, visit: 'shop', work: 'baker', note: 7 },
	{ id: 'teahouse', name: 'Tea house', blurb: 'Petal tea and soft cushions. Two tea keepers work here.', on: 'land', turns: true, door: true, visit: 'shop', work: 'tea', note: 8 },
	{ id: 'garden', name: 'Garden plot', blurb: 'Rows of sky greens. Two gardeners work here.', on: 'land', turns: true, nature: true, visit: 'sniff', work: 'gardener', starter: true, note: 4 },
	{ id: 'workshop', name: 'Workshop', blurb: 'Saws, shavings and a warm stove. Two crafters work here.', on: 'land', turns: true, door: true, work: 'crafter', note: 2 },
	{ id: 'library', name: 'Library', blurb: 'Old books of the sky. Two scholars work here, and elves come to read.', on: 'land', turns: true, door: true, visit: 'read', work: 'scholar', note: 7 },
	{ id: 'board', name: 'Notice board', blurb: 'Elves stop here to read the news of the isles.', on: 'land', turns: true, visit: 'gaze', note: 2 },
	{ id: 'towntree', name: 'Town tree', blurb: 'The heart of a town. Elves hold a night festival around it.', on: 'land', lanterns: true, visit: 'gather', note: 8 },
	{ id: 'tower', name: 'Moon spire', blurb: 'Sends wish lanterns up at night.', on: 'land', lanterns: true, visit: 'wish', note: 8 },
	{ id: 'elder', name: 'Elder Tree', blurb: 'The oldest tree in the sky. Elves come here to wish.', on: 'land', fixed: true, lanterns: true, visit: 'wish', note: 8 },
	{ id: 'crossing', name: 'Little bridge', blurb: 'A path that crosses a river. Remove it to get the river back.', on: 'land', walk: true, water: true, hidden: true, note: 3 },
];

export const PIECE = Object.fromEntries(PIECES.map((p) => [p.id, p])) as Record<PieceId, PieceDef>;

/** The toolbar shows one button for each group. A flyout menu holds the pieces of the group. */
export interface GroupDef {
	id: string;
	name: string;
	pieces: PieceId[];
}

export const GROUPS: GroupDef[] = [
	{ id: 'ways', name: 'Paths', pieces: ['path', 'bridge', 'dock'] },
	{ id: 'homes', name: 'Homes', pieces: ['cottage', 'shroomhouse', 'stonehut', 'nest', 'timberhouse', 'towerhouse'] },
	{ id: 'nature', name: 'Nature', pieces: ['tree', 'flower', 'mushroom', 'windmill'] },
	{ id: 'water', name: 'Water', pieces: ['pond', 'waterfall', 'well'] },
	{ id: 'lights', name: 'Lights', pieces: ['lantern', 'crystal', 'tower'] },
	{ id: 'seats', name: 'Seats', pieces: ['bench', 'stonebench', 'swing', 'picnic'] },
	{ id: 'work', name: 'Work', pieces: ['garden', 'workshop', 'library'] },
	{ id: 'town', name: 'Town', pieces: ['market', 'bakery', 'towntree', 'teahouse', 'board'] },
];

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

export type GoalKind = 'place' | 'villagers' | 'jobs' | 'combos' | 'trees' | 'spill' | 'gifts' | 'festivals';

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
	{ id: 'home2', text: 'Grow 2 tree homes', kind: 'place', piece: 'cottage', n: 2, reward: { piece: 'shroomhouse' } },
	{ id: 'garden1', text: 'Dig a garden plot', kind: 'place', piece: 'garden', n: 1, reward: { piece: 'workshop' } },
	{ id: 'paths', text: 'Lay 8 moss paths', kind: 'place', piece: 'path', n: 8, reward: { piece: 'crystal' } },
	{ id: 'seat1', text: 'Set down a log seat', kind: 'place', piece: 'bench', n: 1, reward: { piece: 'stonebench' } },
	{ id: 'vill3', text: 'House 3 elves', kind: 'villagers', n: 3, reward: { piece: 'waterfall' } },
	{ id: 'jobs3', text: 'Give 3 elves a job', kind: 'jobs', n: 3, reward: { piece: 'timberhouse' } },
	{ id: 'river', text: 'Draw a river of 5 pools', kind: 'place', piece: 'pond', n: 5, reward: { piece: 'well' } },
	{ id: 'combo1', text: 'Discover a magic link', kind: 'combos', n: 1, reward: { piece: 'mushroom' } },
	{ id: 'craft', text: 'Build a workshop', kind: 'place', piece: 'workshop', n: 1, reward: { piece: 'library' } },
	{ id: 'vill6', text: 'House 6 elves', kind: 'villagers', n: 6, reward: { island: true } },
	{ id: 'cross', text: 'Cross a river with a path', kind: 'place', piece: 'crossing', n: 1, reward: { piece: 'swing' } },
	{ id: 'trees', text: 'Grow 4 tall trees', kind: 'trees', n: 4, reward: { piece: 'windmill' } },
	{ id: 'vill9', text: 'House 9 elves', kind: 'villagers', n: 9, reward: { piece: 'stonehut' } },
	{ id: 'jobs8', text: 'Give 8 elves a job', kind: 'jobs', n: 8, reward: { piece: 'towerhouse' } },
	{ id: 'gift1', text: 'Tap a lantern jelly for a gift', kind: 'gifts', n: 1, reward: { piece: 'bridge' } },
	{ id: 'lanterns', text: 'Hang 5 lantern vines', kind: 'place', piece: 'lantern', n: 5, reward: { piece: 'dock' } },
	{ id: 'vill12', text: 'House 12 elves', kind: 'villagers', n: 12, reward: { island: true } },
	{ id: 'spill', text: 'Make a spring rock spill off an edge', kind: 'spill', n: 1, reward: { piece: 'market' } },
	{ id: 'stall', text: 'Open a cap stall', kind: 'place', piece: 'market', n: 1, reward: { piece: 'bakery' } },
	{ id: 'bake', text: 'Open a bakery', kind: 'place', piece: 'bakery', n: 1, reward: { piece: 'towntree' } },
	{ id: 'heart', text: 'Plant a town tree', kind: 'place', piece: 'towntree', n: 1, reward: { piece: 'picnic' } },
	{ id: 'combo4', text: 'Discover 4 magic links', kind: 'combos', n: 4, reward: { piece: 'tower' } },
	{ id: 'fest1', text: 'Hold a night festival', kind: 'festivals', n: 1, reward: { piece: 'teahouse' } },
	{ id: 'vill16', text: 'House 16 elves', kind: 'villagers', n: 16, reward: { piece: 'nest' } },
	{ id: 'tea', text: 'Open a tea house', kind: 'place', piece: 'teahouse', n: 1, reward: { piece: 'board' } },
	{ id: 'vill20', text: 'House 20 elves', kind: 'villagers', n: 20, reward: { island: true } },
	{ id: 'gift8', text: 'Collect 8 jelly gifts', kind: 'gifts', n: 8, reward: { gift: 'Shooting stars at night' } },
	{ id: 'vill30', text: 'House 30 elves', kind: 'villagers', n: 30, reward: { gift: 'A golden sky whale' } },
];

export const VILLAGER_NAMES = ['Pip', 'Mallow', 'Fen', 'Juno', 'Tansy', 'Bram', 'Wren', 'Olli', 'Nim', 'Posy', 'Dabble', 'Suki', 'Thistle', 'Moss', 'Lumi', 'Quill', 'Aelin', 'Sorrel', 'Fael', 'Ivy', 'Rowan', 'Elowen', 'Briar', 'Lark', 'Yarrow', 'Sylvi', 'Alder', 'Nettle', 'Clove', 'Finch', 'Linden', 'Hazel', 'Ash', 'Dew', 'Fern', 'Tamsin'];

/* Jobs, traits and the day */

export type JobId = 'none' | 'tea' | 'baker' | 'grocer' | 'gardener' | 'crafter' | 'scholar' | 'fisher' | 'lamplighter';

export type TraitId = 'early' | 'owl' | 'social' | 'shy' | 'sweet' | 'green' | 'bookish' | 'dreamer' | 'handy';

export interface JobDef {
	id: JobId;
	name: string;
	/** What the elf does at work, for the villager card. */
	verb: string;
	/** Elves per workplace. */
	slots: number;
	/** Other pieces the elf walks round to during work. */
	tour?: PieceId[];
	/** Working hours, as times of the day 0..1. Two spans: before and after lunch. */
	shift: [number, number][];
	/** Elves with this trait like the job best. */
	trait?: TraitId;
	/** A job with no workplace: how many elves can have it, for each piece of the tour. */
	perTour?: number;
	color: number;
}

export const DAY = {
	/** Elves wake up, start work, eat, stop work and go to bed at these times. */
	wake: 0.03,
	work: 0.06,
	lunch: 0.26,
	back: 0.33,
	done: 0.52,
	bed: 0.72,
};

const WORK_HOURS: [number, number][] = [
	[DAY.work, DAY.lunch],
	[DAY.back, DAY.done],
];

export const JOBS: JobDef[] = [
	{ id: 'none', name: 'Free elf', verb: 'Wandering', slots: 0, shift: [], color: 0xb9b8c8 },
	{ id: 'gardener', name: 'Gardener', verb: 'Tending the garden', slots: 2, tour: ['flower', 'tree', 'mushroom'], shift: WORK_HOURS, trait: 'green', color: 0x5fae6e },
	{ id: 'baker', name: 'Baker', verb: 'Baking buns', slots: 2, shift: [[0.02, DAY.lunch], [DAY.back, 0.46]], trait: 'sweet', color: 0xd9a441 },
	{ id: 'tea', name: 'Tea keeper', verb: 'Brewing petal tea', slots: 2, shift: WORK_HOURS, trait: 'social', color: 0x4fb0a8 },
	{ id: 'grocer', name: 'Grocer', verb: 'Selling sky fruit', slots: 1, shift: WORK_HOURS, trait: 'social', color: 0xc8664a },
	{ id: 'crafter', name: 'Crafter', verb: 'Making things of wood', slots: 2, tour: ['bench', 'swing', 'bridge'], shift: WORK_HOURS, trait: 'handy', color: 0x9a7450 },
	{ id: 'scholar', name: 'Scholar', verb: 'Reading old books', slots: 2, tour: ['board', 'crystal'], shift: WORK_HOURS, trait: 'bookish', color: 0x8a6fc8 },
	{ id: 'fisher', name: 'Sky fisher', verb: 'Fishing for star fish', slots: 1, shift: [[0.0, DAY.lunch], [DAY.back, 0.45]], trait: 'dreamer', color: 0x5f8fd0 },
	{ id: 'lamplighter', name: 'Lamplighter', verb: 'Lighting the lamps', slots: 0, tour: ['lantern', 'tower', 'towntree'], perTour: 0.25, shift: [[0.54, DAY.bed]], trait: 'owl', color: 0xffc94d },
];

export const JOB = Object.fromEntries(JOBS.map((j) => [j.id, j])) as Record<JobId, JobDef>;

export interface TraitDef {
	id: TraitId;
	name: string;
	blurb: string;
}

export const TRAITS: TraitDef[] = [
	{ id: 'early', name: 'Early bird', blurb: 'Up before the sun, in bed early.' },
	{ id: 'owl', name: 'Night owl', blurb: 'Sleeps in and stays up late.' },
	{ id: 'social', name: 'Chatty', blurb: 'Loves busy places and company.' },
	{ id: 'shy', name: 'Shy', blurb: 'Likes quiet seats away from the crowd.' },
	{ id: 'sweet', name: 'Sweet tooth', blurb: 'Always finds a reason to visit the bakery.' },
	{ id: 'green', name: 'Green thumb', blurb: 'Happiest near plants and flowers.' },
	{ id: 'bookish', name: 'Bookish', blurb: 'Reads whenever there is time.' },
	{ id: 'dreamer', name: 'Dreamer', blurb: 'Gazes at the sky and makes wishes.' },
	{ id: 'handy', name: 'Handy', blurb: 'Likes to fix and build things.' },
];

export const TRAIT = Object.fromEntries(TRAITS.map((t) => [t.id, t])) as Record<TraitId, TraitDef>;

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
	/** The festival starts and ends at these times of the day, 0..1. */
	festStart: 0.66,
	festEnd: 0.9,
	/** Nights of rest between two festivals. */
	festRest: 1,
	/** Lights and guests come from this many cells around the town tree. */
	festReach: 7,
	undoDepth: 200,
};
