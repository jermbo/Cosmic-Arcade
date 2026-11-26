import * as THREE from 'three';
import type { GameState } from '../core/state.ts';
import type { LevelDef } from '../core/types.ts';
import type { LightSource } from './levelMesh.ts';
import { MAX_LIGHTS, MAX_ZONES, shared } from './psx.ts';

/** A light that moves, like the head of the creature. */
export interface DynamicLight {
	pos: THREE.Vector3;
	color: THREE.Color;
	range: number;
	intensity: number;
}

const tmpColor = new THREE.Color();

/** Fluorescent flicker: mostly steady, with short drops and stutters. */
function flicker(t: number, phase: number): number {
	const a = Math.sin(t * 1.7 + phase) * Math.sin(t * 0.63 + phase * 2.1);
	if (a > 0.86) return Math.sin(t * 60 + phase) > 0 ? 0.15 : 0.9;
	if (a > 0.8) return 0.6;
	return 1;
}

export class Lighting {
	readonly dynamic: DynamicLight[] = [];
	private picked: { d: number; pos: THREE.Vector3; col: THREE.Color; range: number }[] = [];
	private level: LevelDef;
	readonly lights: LightSource[];
	private zoneIndex: Record<string, number>;

	constructor(level: LevelDef, lights: LightSource[], zoneIndex: Record<string, number>) {
		this.level = level;
		this.lights = lights;
		this.zoneIndex = zoneIndex;
	}

	/** Sets every light to its state at once, with no fade. For loads. */
	snap(state: GameState): void {
		for (const l of this.lights) l.on = !l.dead && state.check(l.cond) ? 1 : 0;
	}

	update(dt: number, t: number, state: GameState, eye: THREE.Vector3): void {
		// zone ambient drops when the lights of the zone are off
		for (const [ch, z] of Object.entries(this.level.zones)) {
			const i = this.zoneIndex[ch];
			if (i >= MAX_ZONES) continue;
			const lit = !z.lights?.cond || state.check(z.lights.cond);
			const k = lit ? 1 : 0.22;
			shared.uZoneAmb.value[i].set(z.ambient[0] * k, z.ambient[1] * k, z.ambient[2] * k);
		}

		this.picked.length = 0;
		const ease = Math.min(1, dt * 2.5);
		for (const l of this.lights) {
			const target = !l.dead && state.check(l.cond) ? 1 : 0;
			// a fluorescent tube stutters when it starts
			if (target > l.on && l.on < 0.95) l.on = Math.min(1, l.on + ease * (Math.sin(t * 40 + l.phase) > 0.2 ? 1 : -0.5));
			else l.on += (target - l.on) * ease * 2;
			l.on = Math.max(0, Math.min(1, l.on));
			let k = l.on;
			if (l.flicker) k *= flicker(t, l.phase);
			if (l.disturb > 0) {
				k *= 1 - l.disturb * (Math.sin(t * 37 + l.phase * 3) > 0.1 ? 0.85 : 0.1);
				l.disturb = Math.max(0, l.disturb - dt * 2);
			}
			if (l.panelMesh && l.panel >= 0) {
				const glow = 0.1 + k * 0.95;
				tmpColor.setRGB(glow * (0.6 + l.color.r * 0.4), glow * (0.6 + l.color.g * 0.4), glow * (0.6 + l.color.b * 0.4));
				l.panelMesh.setColorAt(l.panel, tmpColor);
			}
			if (k < 0.02) continue;
			const d = l.pos.distanceTo(eye);
			if (d > l.range + 26) continue;
			this.picked.push({ d, pos: l.pos, col: l.color.clone().multiplyScalar(k), range: l.range });
		}
		for (const l of this.lights) if (l.panelMesh?.instanceColor) l.panelMesh.instanceColor.needsUpdate = true;
		for (const dl of this.dynamic) {
			if (dl.intensity <= 0.01) continue;
			this.picked.push({ d: dl.pos.distanceTo(eye) - 6, pos: dl.pos, col: dl.color.clone().multiplyScalar(dl.intensity), range: dl.range });
		}
		this.picked.sort((a, b) => a.d - b.d);
		const pos = shared.uLightPos.value;
		const col = shared.uLightCol.value;
		for (let i = 0; i < MAX_LIGHTS; i++) {
			const p = this.picked[i];
			if (p) {
				// fade lights near the end of the list, so a light never pops in
				const fade = i > MAX_LIGHTS - 4 ? (MAX_LIGHTS - i) / 4 : 1;
				pos[i].set(p.pos.x, p.pos.y, p.pos.z, p.range);
				col[i].set(p.col.r * fade, p.col.g * fade, p.col.b * fade);
			} else {
				pos[i].set(0, 0, 0, 0);
			}
		}
	}

	/** Makes the lights near a point stutter. */
	disturb(at: THREE.Vector3, radius: number, amount: number): void {
		for (const l of this.lights) {
			const d = l.pos.distanceTo(at);
			if (d < radius) l.disturb = Math.max(l.disturb, amount * (1 - d / radius));
		}
	}
}
