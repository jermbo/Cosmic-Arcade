import * as THREE from 'three';
import type { EntityDef } from '../../core/types.ts';
import { shared, type PsxMaterial } from '../../render/psx.ts';
import { FACING, type World } from '../world.ts';

/** Turn for a wall-mounted thing whose front faces +z, so it faces out of its wall. */
export function wallYaw(def: EntityDef): number {
	return -FACING[def.facing ?? 'n'];
}

/** Copies the zone ambient at a point into the materials of a moving thing. */
export function syncAmbient(world: World, at: THREE.Vector3, materials: PsxMaterial[], boost = 1): void {
	const i = world.zoneIndexAt(at);
	const amb = shared.uZoneAmb.value[Math.max(0, i)];
	for (const m of materials) m.uniforms.uAmbDyn.value.set(amb.x * boost, amb.y * boost, amb.z * boost, 1);
}

/** Lights up a moving thing a little while the player looks at it. */
export function setHighlight(materials: PsxMaterial[], amount: number): void {
	for (const m of materials) m.uniforms.uAdd.value.setRGB(amount, amount * 0.95, amount * 0.8);
}

export const DEG = Math.PI / 180;
