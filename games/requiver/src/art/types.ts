// The contract between the game and its art. The game only ever calls an ArtKit.
// To swap in hand-drawn art, write a new ArtKit (sprites instead of shapes) and export it from art/index.ts.
// Views are plain data: positions in world units (960 x 540, y down), times in seconds.

export interface ActPalette {
	/** Sky from top to horizon, at the start of the evening and at its end. */
	early: string[];
	late: string[];
	accent: string;
	/** Text and lines drawn on top of the accent. */
	onAccent: string;
	sun: string;
	/** Far and middle hills, before the black foreground. */
	far: string;
	mid: string;
	ink: string;
	paper: string;
}

export interface SkyView {
	act: number;
	/** 0 at the start of the act, 1 at the boss: the sun sets. */
	dusk: number;
	time: number;
	/** The world rectangle on screen, to cover it all. */
	view: { x: number; y: number; w: number; h: number };
	/** Darken for drama (bonus shot, death). 0 to 1. */
	dim: number;
	/** Seed for props, so each fight has its own land. */
	seed: number;
}

export interface ArcherView {
	x: number;
	y: number;
	/** Aim angle in radians, screen space (negative is up). */
	angle: number;
	/** Pull 0 to 1. */
	pull: number;
	/** Seconds since the last shot, for the string snap and recoil. */
	sinceShot: number;
	/** Seconds since the last hurt. */
	sinceHurt: number;
	time: number;
	act: number;
	/** The scarf glows while a bonus shot is ready. */
	bonus: 'volley' | 'crown' | null;
	dead: boolean;
	/** Seconds since death. */
	sinceDead: number;
	/** Map walk: legs move. */
	walking?: boolean;
	scale?: number;
}

export interface FoeView {
	art: string;
	x: number;
	y: number;
	size: number;
	time: number;
	/** Walk speed factor for the gait; 0 stands. */
	gait: number;
	state: string;
	/** Thrower wind-up 0 to 1. Flyer dive 0 to 1. */
	wind: number;
	helmet: boolean;
	plate: boolean;
	shield: boolean;
	elite: boolean;
	flash: number;
	burning: boolean;
	chilled: boolean;
	/** Visual knock-back in world units. */
	kick: number;
	act: number;
}

export interface BossView {
	art: string;
	x: number;
	y: number;
	time: number;
	phase: string;
	/** 0 to 1 through the current wind-up. */
	wind: number;
	/** The weak spot glows during wind-ups. */
	glow: number;
	guard: boolean;
	enraged: boolean;
	flash: number;
	kick: number;
	burning: boolean;
	chilled: boolean;
	act: number;
	hpShare: number;
}

export interface CorpseView {
	art: string;
	shape: string;
	x: number;
	y: number;
	size: number;
	/** Rotation in radians. */
	angle: number;
	/** 0 just died, 1 gone. */
	fade: number;
	headless: boolean;
	elite: boolean;
	act: number;
}

export interface ArrowView {
	x: number;
	y: number;
	angle: number;
	kind: 'player' | 'helper' | 'rain' | 'crown' | 'stuck';
	/** Recent positions, newest last, for the trail. */
	trail: { x: number; y: number }[];
	fire: boolean;
	ice: boolean;
	explosive: boolean;
	opacity: number;
	act: number;
	/** Length scale (stuck arrows are partly buried). */
	length: number;
}

export interface ProjectileView {
	kind: string;
	x: number;
	y: number;
	angle: number;
	radius: number;
	time: number;
	act: number;
}

/** A loose piece flying off: a head, a helmet, a plate, a shield. */
export interface PieceView {
	kind: 'head' | 'helmet' | 'plate' | 'shield';
	x: number;
	y: number;
	angle: number;
	r: number;
	opacity: number;
	act: number;
}

/** The drag line on screen while pulling by touch or mouse (world units). */
export interface DragView {
	from: { x: number; y: number };
	to: { x: number; y: number };
	pull: number;
	act: number;
}

export interface AimView {
	points: { x: number; y: number }[];
	pull: number;
	bonus: 'volley' | 'crown' | null;
	act: number;
	/** Faint when only showing the resting aim (keyboard, gamepad). */
	ghost: boolean;
}

export interface DefenseView {
	act: number;
	time: number;
	wall: { hp: number; max: number; kick: number } | null;
	spikes: boolean;
	helper: { x: number; y: number; angle: number; sinceShot: number } | null;
}

export interface MapNodeView {
	id: number;
	x: number;
	y: number;
	icon: string;
	state: 'visited' | 'current' | 'open' | 'locked' | 'past';
	boss: boolean;
	hover: boolean;
}

export interface MapView {
	act: number;
	dusk: number;
	time: number;
	nodes: MapNodeView[];
	edges: { from: { x: number; y: number }; to: { x: number; y: number }; state: 'walked' | 'open' | 'locked' }[];
	boss: string;
}

/** How a burst of particles looks. Colors and sizes blend over each particle's life. */
export interface ParticleStyle {
	/** Frame of the particle sheet: 0 dot, 1 soft dot, 2 streak, 3 shard. */
	frame: number;
	colors: string[];
	opacities: number[];
	scales: number[];
	speed: [number, number];
	life: [number, number];
	gravity: number;
	damping: number;
	spin: number;
	count: number;
	/** Spread in degrees around the burst direction. */
	spread: number;
}

export interface ArtKit {
	palette(act: number): ActPalette;
	/** Sky, sun, clouds and far hills. Covers the whole screen. */
	sky(v: SkyView): void;
	/** The black foreground land with its props. */
	land(v: SkyView): void;
	archer(v: ArcherView): void;
	foe(v: FoeView): void;
	boss(v: BossView): void;
	corpse(v: CorpseView): void;
	arrow(v: ArrowView): void;
	projectile(v: ProjectileView): void;
	piece(v: PieceView): void;
	drag(v: DragView): void;
	defenses(v: DefenseView): void;
	aim(v: AimView): void;
	map(v: MapView): void;
	/** Canvas text, such as damage numbers and call-outs. */
	text(t: string, x: number, y: number, size: number, color: string, opacity: number, angle?: number): void;
	/** The look of a particle burst kind ("ink", "spark", "dust"...), or null to skip it. */
	particle(kind: string, act: number): ParticleStyle | null;
	/** Loads sprites the kit needs: icons and the particle sheet named "fx". */
	load(): void;
	/** SVG markup for an icon, for the DOM. */
	iconSvg(name: string): string;
}
