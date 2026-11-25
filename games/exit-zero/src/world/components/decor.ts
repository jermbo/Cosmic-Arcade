import * as THREE from 'three';
import type { Cond } from '../../core/types.ts';
import { MODELS } from '../../render/models.ts';
import { signAspect, signTexture, type SignColor } from '../../render/textures.ts';
import { register } from '../registry.ts';
import { DEG, wallYaw } from './util.ts';

// Things that only look like something: props, pipes, signs and extra lights.

register('decor', (def, world) => {
	const model = MODELS[def.model as string];
	const y = (def.y as number) ?? 0;
	const p = world.pos(def.at, y);
	const rot = (def.rot as number) ?? 0;
	const b = world.statics;
	b.zone = Math.max(0, world.zoneIndexAt(p));
	const height = world.grid.zoneAt(p.x, p.z)?.height ?? 2.6;

	if (def.model === 'pipeRun') {
		const r = (def.radius as number) ?? 0.15;
		const color = (def.color as [number, number, number]) ?? [0.5, 0.5, 0.5];
		const look = { tex: 'grain', color };
		if (def.vertical) {
			const top = (def.top as number) ?? height;
			b.cyl(look, r, top - y, 6, p.x, y, p.z);
		} else {
			const q = world.pos(def.to as [number, number], y);
			const dx = q.x - p.x;
			const dz = q.z - p.z;
			const len = Math.hypot(dx, dz);
			b.push(p.x, y, p.z, Math.atan2(-dz, dx));
			b.cyl(look, r, len, 6, len, 0, 0, 0, Math.PI / 2, false);
			// brackets up to the ceiling
			for (let t = 1; t < len; t += 2.5) b.box({ tex: null, color: [0.18, 0.18, 0.18] }, 0.05, height - y, 0.05, t, 0, 0);
			b.pop();
		}
		return { def };
	}

	if (!model) {
		console.warn(`No model "${def.model}"`);
		return { def };
	}
	b.push(p.x, p.y, p.z, -rot * DEG);
	model.draw(b, { height });
	b.pop();
	if (def.solid && model.size) world.addBox(p.x, p.z, model.size[0], model.size[1], rot);

	if (def.model === 'steam') {
		let next = 0;
		const at = p.clone().setY(0.2);
		return {
			def,
			update(dt) {
				next -= dt;
				if (next > 0) return;
				next = 0.08;
				world.particles.mist.emit({ at, count: 1, speed: 0.15, up: 0.9, color: [0.6, 0.66, 0.64], size: 0.12, life: 2.4, drag: 0.5 });
			},
		};
	}
	return { def };
});

register('sign', (def, world) => {
	const tex = signTexture(world.host.t(def.text as string), (def.color as SignColor) ?? 'white');
	const glow = def.color === 'green' || def.color === 'red';
	const h = (def.size as number) ?? 0.24;
	const p = world.wallPoint(def, (def.y as number) ?? 2.0, 0.03);
	const b = world.statics;
	b.zone = Math.max(0, world.zoneIndexAt(p));
	b.plate({ tex, emissive: glow }, h * signAspect(tex), h, p.x, p.y, p.z, wallYaw(def));
	return { def };
});

register('light', (def, world) => {
	const p = world.pos(def.at, (def.y as number) ?? 2.4);
	const color = (def.color as [number, number, number]) ?? [1, 0.9, 0.7];
	world.lighting.lights.push({
		pos: p,
		color: new THREE.Color(...color),
		range: (def.range as number) ?? 6,
		cond: def.cond as Cond | undefined,
		flicker: (def.flicker as number) ?? 0,
		phase: Math.random() * 100,
		dead: false,
		on: 1,
		disturb: 0,
		panel: -1,
		panelMesh: null,
		zoneChar: world.grid.char(...world.grid.cellOf(p.x, p.z)),
	});
	// a bare bulb on a cord
	const b = world.statics;
	b.zone = Math.max(0, world.zoneIndexAt(p));
	const ceiling = world.grid.zoneAt(p.x, p.z)?.height ?? 2.6;
	b.box({ tex: null, color: [0.1, 0.1, 0.1] }, 0.015, ceiling - p.y, 0.015, p.x, p.y, p.z);
	b.box({ tex: null, color: [1, 0.92, 0.7], emissive: true }, 0.08, 0.1, 0.08, p.x, p.y - 0.1, p.z);
	return { def };
});
