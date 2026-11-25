import * as THREE from 'three';
import type { Grid } from '../core/grid.ts';
import type { GameState } from '../core/state.ts';
import type { Action, EntityDef, Facing, LevelDef } from '../core/types.ts';
import type { Builder } from '../render/builder.ts';
import type { Lighting } from '../render/lights.ts';
import type { Particles } from '../render/particles.ts';
import type { PsxMaterial } from '../render/psx.ts';

/** Something the player can use. The prompt shows its label. */
export interface Interaction {
	pos: THREE.Vector3;
	label: string;
	/** A second line, like "Needs: Pipe Wrench". */
	detail?: string;
	/** Seconds to hold the button. */
	hold?: number;
	/** Shown, but greyed out. Using it still runs `use`, which explains why. */
	disabled?: boolean;
	range?: number;
	use(): void;
	/** Called each frame while the player looks at it. */
	onHover?(): void;
}

/** An axis-aligned box on the floor plan that blocks the player. */
export interface Box {
	x0: number;
	z0: number;
	x1: number;
	z1: number;
	/** Blocks only while this returns true. */
	active?: () => boolean;
}

/** One placed entity, made by a factory in the registry. */
export interface Component {
	def: EntityDef;
	update?(dt: number, t: number): void;
	interactions?(): Interaction[];
	/** Re-applies the look from the state, after a load or a retry. */
	sync?(): void;
}

/** What the world asks of the game around it: text, sound, UI and flow. */
export interface Host {
	t(key: string): string;
	say(key: string): void;
	sound(id: string, at?: THREE.Vector3): void;
	/** Starts or stops a looping sound, like the crackle of live water. */
	loop(id: string, on: boolean, at?: THREE.Vector3, level?: number): void;
	run(actions: Action[] | undefined): void;
	readNote(id: string): void;
	openKeypad(code: string, onSolve: () => void): void;
	die(cause: string): void;
	ending(): void;
	itemName(id: string): string;
}

export interface PlayerView {
	pos: THREE.Vector3;
	eye: THREE.Vector3;
	inWater: boolean;
	alive: boolean;
}

export interface Listener {
	hear(at: THREE.Vector3, radius: number): void;
	alarm?(at: THREE.Vector3): void;
}

/** What the game reads of the creature: for music, the HUD and the death camera. */
export interface Threat {
	pos: THREE.Vector3;
	readonly mode: string;
}

export const FACING: Record<Facing, number> = { n: 0, e: Math.PI / 2, s: Math.PI, w: -Math.PI / 2 };

/** The direction a facing points to, on the floor plan. */
export function facingDir(f: Facing): [number, number] {
	return f === 'n' ? [0, -1] : f === 's' ? [0, 1] : f === 'e' ? [1, 0] : [-1, 0];
}

export class World {
	readonly components: Component[] = [];
	readonly colliders: Box[] = [];
	readonly listeners: Listener[] = [];
	readonly root = new THREE.Group();
	readonly level: LevelDef;
	readonly grid: Grid;
	readonly state: GameState;
	readonly host: Host;
	readonly lighting: Lighting;
	readonly statics: Builder;
	readonly particles: { sparks: Particles; mist: Particles };
	readonly player: PlayerView;
	readonly waterMaterials = new Map<string, PsxMaterial>();
	threat: Threat | null = null;
	time = 0;

	constructor(o: { level: LevelDef; grid: Grid; state: GameState; host: Host; lighting: Lighting; statics: Builder; particles: { sparks: Particles; mist: Particles }; player: PlayerView }) {
		this.level = o.level;
		this.grid = o.grid;
		this.state = o.state;
		this.host = o.host;
		this.lighting = o.lighting;
		this.statics = o.statics;
		this.particles = o.particles;
		this.player = o.player;
	}

	get cell(): number {
		return this.grid.cell;
	}

	/** World position of an entity spot (in cells). */
	pos(at: [number, number], y = 0): THREE.Vector3 {
		return new THREE.Vector3(at[0] * this.cell, y, at[1] * this.cell);
	}

	/** The point on the wall that a wall-mounted entity hangs on. */
	wallPoint(def: EntityDef, y: number, out = 0.02): THREE.Vector3 {
		const f = def.facing ?? 'n';
		const [dx, dz] = facingDir(f);
		const cx = Math.floor(def.at[0]);
		const cz = Math.floor(def.at[1]);
		const p = this.pos(def.at, y);
		const c = this.cell;
		if (dx) p.x = (cx + (dx > 0 ? 1 : 0)) * c - dx * out;
		if (dz) p.z = (cz + (dz > 0 ? 1 : 0)) * c - dz * out;
		return p;
	}

	zoneIndexAt(p: THREE.Vector3): number {
		const ch = this.grid.char(...this.grid.cellOf(p.x, p.z));
		return Object.keys(this.level.zones).indexOf(ch);
	}

	/** Adds a blocking box of size w x d centered on a point, turned by a multiple of 90 degrees. */
	addBox(cx: number, cz: number, w: number, d: number, rotDeg = 0, active?: () => boolean): Box {
		const turned = Math.round(rotDeg / 90) % 2 !== 0;
		const hw = (turned ? d : w) / 2;
		const hd = (turned ? w : d) / 2;
		const box = { x0: cx - hw, z0: cz - hd, x1: cx + hw, z1: cz + hd, active };
		this.colliders.push(box);
		return box;
	}

	noise(at: THREE.Vector3, radius: number): void {
		for (const l of this.listeners) l.hear(at, radius);
	}

	alarm(at: THREE.Vector3): void {
		for (const l of this.listeners) l.alarm?.(at);
	}

	waterMaterial(ch: string): PsxMaterial | undefined {
		return this.waterMaterials.get(ch);
	}

	find(id: string): Component | undefined {
		return this.components.find((c) => c.def.id === id);
	}
}
