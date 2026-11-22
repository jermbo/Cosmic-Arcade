import * as THREE from 'three';
import type { Kind } from './planets';

export type PuzzleId = 'blossom-path' | 'mite-trio';

export interface PlanetDef {
	id: string;
	kind: Kind;
	/** Shown on banners and the map once visited. */
	name: string;
	subtitle: string;
	hint: string;
	/** Stardust on this world needed to charge the pad. */
	padQuota: number;
	/** Stars in the pouch needed before you may fly here. */
	arrivalStars: number;
	/** How awake the previous world must be (0–1) before this hop is allowed. */
	minPrevLit: number;
	lighthouse: boolean;
	puzzleId?: PuzzleId;
	/** Short story line when you first land. */
	storyLine?: string;
}

/** Ordered worlds — append entries here to grow the galaxy. */
export const GALAXY: PlanetDef[] = [
	{
		id: 'clover',
		kind: 'garden',
		name: 'Clover',
		subtitle: 'The sleeping garden',
		hint: 'Bounce the pink blossoms. The green light shows which bloom is next.',
		padQuota: 6,
		arrivalStars: 0,
		minPrevLit: 0,
		lighthouse: false,
		puzzleId: 'blossom-path',
		storyLine: 'Pip woke under clover leaves. The lantern whispered: bounce the pink path awake.',
	},
	{
		id: 'rime',
		kind: 'ice',
		name: 'Rime',
		subtitle: 'The frozen music box',
		hint: 'The ground is slippery. Pop three frost mites for the pad to listen.',
		padQuota: 7,
		arrivalStars: 6,
		minPrevLit: 0,
		lighthouse: false,
		puzzleId: 'mite-trio',
		storyLine: 'Ice sang in circles. Three mites must pop before the pad hums again.',
	},
	{
		id: 'cinder',
		kind: 'lava',
		name: 'Cinder',
		subtitle: 'The cold forge',
		hint: 'Vents glow before they erupt. Keep off the lava.',
		padQuota: 8,
		arrivalStars: 14,
		minPrevLit: 0,
		lighthouse: false,
		storyLine: 'Ash flowers opened where Pip walked. The forge slept, waiting for stars.',
	},
	{
		id: 'meadow',
		kind: 'garden',
		name: 'Meadow',
		subtitle: 'Wind in the tall grass',
		hint: 'Blossoms send you high. Wake the hills.',
		padQuota: 8,
		arrivalStars: 22,
		minPrevLit: 0.12,
		lighthouse: false,
		storyLine: 'A second garden, farther out. The hills still remember starlight.',
	},
	{
		id: 'glint',
		kind: 'ice',
		name: 'Glint',
		subtitle: 'The mirror floe',
		hint: 'Slide with care. Mites guard shiny dust.',
		padQuota: 9,
		arrivalStars: 32,
		minPrevLit: 0.18,
		lighthouse: false,
		storyLine: 'Ice mirrored the sky. Each step was a quiet bell.',
	},
	{
		id: 'ember',
		kind: 'lava',
		name: 'Ember',
		subtitle: 'Slow-burn dunes',
		hint: 'Geysers warn before they blow.',
		padQuota: 9,
		arrivalStars: 44,
		minPrevLit: 0.22,
		lighthouse: false,
		storyLine: 'Warm stone under hoof. The dunes held embers like sleeping fireflies.',
	},
	{
		id: 'hollow',
		kind: 'garden',
		name: 'Hollow',
		subtitle: 'Mushroom ring world',
		hint: 'Higher quota — explore the whole ring.',
		padQuota: 10,
		arrivalStars: 58,
		minPrevLit: 0.28,
		lighthouse: false,
		storyLine: 'Mushroom rings circled the pole. Something vast slept beyond.',
	},
	{
		id: 'beacon',
		kind: 'lava',
		name: 'Beacon',
		subtitle: 'The lighthouse at the rim',
		hint: 'Light the rune. Wake every world you touched.',
		padQuota: 10,
		arrivalStars: 74,
		minPrevLit: 0.35,
		lighthouse: true,
		storyLine: 'At the galaxy edge, one tower. Light it, and the map remembers you.',
	},
];

const STEP = [
	new THREE.Vector3(0.25, 0.3, -1).normalize(),
	new THREE.Vector3(0.45, 0.12, -1).normalize(),
];

/** World centers along a gentle chain — one segment per hop. */
export function galaxyCenters(): THREE.Vector3[] {
	const out = [new THREE.Vector3(0, 0, 0)];
	for (let i = 1; i < GALAXY.length; i++) {
		const dir = STEP[i % STEP.length];
		const dist = 78 + (i % 3) * 6;
		out.push(out[i - 1].clone().addScaledVector(dir, dist));
	}
	return out;
}

export function defForIndex(i: number): PlanetDef {
	return GALAXY[i] ?? GALAXY[GALAXY.length - 1];
}