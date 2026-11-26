// Shapes of the data files. Gameplay code reads these; story text lives in src/data/story.json.

/** A condition on the game state. `true` is always met. */
export type Cond =
	| true
	| { item: string }
	| { flag: string }
	| { not: Cond }
	| { all: Cond[] }
	| { any: Cond[] };

/** One step that changes the game state or the world. Run by core/actions.ts. */
export type Action =
	| { do: 'setFlag'; flag: string; value?: boolean }
	| { do: 'give'; item: string }
	| { do: 'take'; item: string }
	| { do: 'say'; text: string }
	| { do: 'note'; note: string }
	| { do: 'sound'; sound: string }
	| { do: 'checkpoint'; id: string }
	| { do: 'noise'; radius: number }
	| { do: 'alarm' }
	| { do: 'tutorial'; id: string }
	| { do: 'ending' }
	| { do: 'if'; cond: Cond; then: Action[]; else?: Action[] };

export type Facing = 'n' | 'e' | 's' | 'w';

/** A thing placed in a level. `type` picks the component in world/components. */
export interface EntityDef {
	id: string;
	type: string;
	/** Position in cells. [3.5, 19.5] is the center of cell x 3, row 19. */
	at: [number, number];
	facing?: Facing;
	[key: string]: unknown;
}

export interface ZoneLights {
	/** A light on cells where (x + 2y) % every == 0. */
	every: number;
	color: [number, number, number];
	range: number;
	/** The lights are on while this holds. */
	cond?: Cond;
	/** Share of lights that flicker, 0..1. */
	flicker?: number;
	/** Cells with a dead fixture. */
	dead?: [number, number][];
}

export interface ZoneDef {
	/** Area id, for banners and music. Many map chars can share one area. */
	area: string;
	floor: string;
	wall: string;
	ceiling: string;
	height: number;
	ambient: [number, number, number];
	step: 'carpet' | 'concrete' | 'metal' | 'water';
	lights?: ZoneLights;
	/** Water surface height above the floor. */
	water?: number;
	/** Fog color while the player stands in this zone. */
	fog?: [number, number, number];
	/** The ambient hum level, 0..1. */
	hum: number;
	/** Solid cells drawn as a wall with a window. */
	window?: boolean;
	/** The cell is solid. */
	solid?: boolean;
}

export interface Spot {
	at: [number, number];
	/** Radians. 0 looks north (-z), PI/2 looks east (+x). */
	yaw: number;
}

export interface LevelDef {
	id: string;
	/** Text key of the level name. */
	name: string;
	/** The level that follows. Not built yet when the id is missing from the registry. */
	next?: string;
	cell: number;
	fog: { color: [number, number, number]; near: number; far: number };
	map: string[];
	zones: Record<string, ZoneDef>;
	start: string;
	checkpoints: Record<string, Spot>;
	initialFlags: string[];
	startItems: string[];
	entities: EntityDef[];
}

export interface ItemDef {
	name: string;
	desc: string;
	icon: string;
}

export interface NoteDef {
	title: string;
	/** Paragraphs. */
	body: string[];
	/** The look of the paper. */
	style?: 'paper' | 'sticky' | 'memo' | 'map';
}

export interface AreaDef {
	name: string;
	blurb: string;
	music: 'halls' | 'maint' | 'exit' | 'none';
}

export interface TutorialDef {
	keys: string;
	pad: string;
	text: string;
}

export interface StoryDef {
	intro: string[];
	ending: string[];
	teaser: { title: string; body: string };
	areas: Record<string, AreaDef>;
	tutorial: Record<string, TutorialDef>;
	text: Record<string, string>;
	death: Record<string, string>;
}
