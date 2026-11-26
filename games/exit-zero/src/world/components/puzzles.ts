import * as THREE from 'three';
import type { Action, Cond } from '../../core/types.ts';
import { Builder } from '../../render/builder.ts';
import { PICKUPS } from '../../render/models.ts';
import type { PsxMaterial } from '../../render/psx.ts';
import { signAspect, signTexture } from '../../render/textures.ts';
import { register } from '../registry.ts';
import type { Interaction, World } from '../world.ts';
import { setHighlight, syncAmbient, wallYaw } from './util.ts';

// Repair stations, breaker panels, keypads and trigger zones.

const UP = new THREE.Vector3(0, 1, 0);

/** Maps a point in the local space of a wall-mounted thing to world space. */
function wallSpace(world: World, def: Parameters<World['wallPoint']>[0]) {
	const origin = world.wallPoint(def, 0, 0);
	const yaw = wallYaw(def);
	return {
		origin,
		yaw,
		at: (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyAxisAngle(UP, yaw).add(origin),
	};
}

function lamp(world: World, at: THREE.Vector3, size = 0.05): PsxMaterial {
	const b = new Builder();
	b.box({ tex: null, color: [1, 1, 1], emissive: true }, size, size, size * 0.6, 0, 0, 0);
	const built = b.build();
	built.group.position.copy(at);
	world.root.add(built.group);
	return built.materials[0];
}

interface SwitchDef {
	id: string;
	label: string;
	flag: string;
	needsPower?: boolean;
	onOn?: Action[];
	onOff?: Action[];
}

register('breakers', (def, world) => {
	const { state, host } = world;
	const W = wallSpace(world, def);
	const switches = def.switches as SwitchDef[];
	const s = world.statics;
	s.zone = Math.max(0, world.zoneIndexAt(W.origin));
	s.push(W.origin.x, 0, W.origin.z, W.yaw);
	s.box({ tex: 'grain', color: [0.5, 0.53, 0.52] }, 1.2, 1.15, 0.14, 0, 1.05, 0.07);
	s.box({ tex: null, color: [0.12, 0.13, 0.13] }, 1.08, 0.5, 0.01, 0, 1.45, 0.145);
	const head = signTexture('MAIN PANEL', 'white');
	s.plate({ tex: head }, 0.09 * signAspect(head), 0.09, 0, 2.08, 0.145);
	const xs = switches.map((_, i) => (i - (switches.length - 1) / 2) * 0.26);
	switches.forEach((sw, i) => {
		const tex = signTexture(host.t(sw.label), 'white');
		s.plate({ tex }, 0.05 * signAspect(tex), 0.05, xs[i], 1.34, 0.152);
	});
	// conduit up to the ceiling
	const zone = world.grid.zoneAt(W.origin.x, W.origin.z);
	s.box({ tex: 'grain', color: [0.4, 0.42, 0.42] }, 0.1, (zone?.height ?? 3) - 2.2, 0.1, 0, 2.2, 0.06);
	s.pop();

	const mainLamp = lamp(world, W.at(-0.48, 1.98, 0.16), 0.06);
	const levers = switches.map((sw, i) => {
		const b = new Builder();
		b.box({ tex: 'grain', color: [0.15, 0.15, 0.15] }, 0.07, 0.04, 0.05, 0, -0.02, 0.0);
		b.box({ tex: 'grain', color: [0.9, 0.88, 0.8] }, 0.05, 0.16, 0.05, 0, 0, 0.0);
		const built = b.build({ dynamic: true });
		const pivot = new THREE.Group();
		pivot.position.copy(W.at(xs[i], 1.55, 0.17));
		pivot.rotation.y = W.yaw;
		pivot.add(built.group);
		world.root.add(pivot);
		return { sw, group: built.group, materials: built.materials, lamp: lamp(world, W.at(xs[i], 1.78, 0.16)), pos: W.at(xs[i], 1.55, 0.2), tilt: 0, hovered: false };
	});

	const powered = () => state.check(def.power as Cond | undefined);

	const flip = (l: (typeof levers)[number]) => {
		const on = !state.flag(l.sw.flag);
		host.sound('breaker', l.pos);
		world.noise(l.pos, 6);
		if (on && l.sw.needsPower && !powered()) {
			host.say(def.deadText as string);
			l.tilt = 0.6;
			return;
		}
		state.setFlag(l.sw.flag, on);
		host.run(on ? l.sw.onOn : l.sw.onOff);
	};

	return {
		def,
		update(dt, t) {
			const p = powered();
			mainLamp.uniforms.uTint.value.setRGB(p ? 0.25 : 1, p ? 1 : 0.12, 0.15);
			for (const l of levers) {
				const on = state.flag(l.sw.flag);
				const target = on ? 1 : -1;
				l.tilt += (target - l.tilt) * Math.min(1, dt * 14);
				l.group.rotation.x = -l.tilt * 0.55;
				const live = on && (!l.sw.needsPower || p);
				const k = live ? 1 : on ? (Math.sin(t * 6) > 0 ? 0.7 : 0.2) : 0.25;
				l.lamp.uniforms.uTint.value.setRGB(live ? 0.25 * k : k, live ? k : 0.1 * k, 0.12 * k);
				syncAmbient(world, l.pos, l.materials, 1.3);
				setHighlight(l.materials, l.hovered ? 0.25 : 0);
				l.hovered = false;
			}
		},
		interactions(): Interaction[] {
			return levers.map((l) => {
				const on = state.flag(l.sw.flag);
				return {
					pos: l.pos,
					label: `${host.t(on ? 'prompt.flip.off' : 'prompt.flip.on')} ${host.t(l.sw.label)}`,
					range: 1.9,
					use: () => flip(l),
					onHover: () => (l.hovered = true),
				};
			});
		},
	};
});

interface StepDef {
	needs?: string;
	consume?: boolean;
	hold?: number;
	prompt: string;
	done?: string;
	sound?: string;
}

register('repair', (def, world) => {
	const { state, host } = world;
	const W = wallSpace(world, def);
	const steps = def.steps as StepDef[];
	const varKey = `rep.${def.id}`;
	const step = () => state.vars[varKey] ?? 0;
	const fixed = () => state.flag(def.doneFlag as string);

	const s = world.statics;
	s.zone = Math.max(0, world.zoneIndexAt(W.origin));
	s.push(W.origin.x, 0, W.origin.z, W.yaw);
	s.box({ tex: 'grain', color: [0.62, 0.6, 0.5] }, 0.72, 0.92, 0.26, 0, 0.85, 0.13);
	s.box({ tex: null, color: [0.06, 0.06, 0.06] }, 0.6, 0.78, 0.01, 0, 0.92, 0.262);
	s.box({ tex: 'grain', color: [0.72, 0.5, 0.2] }, 0.18, 0.05, 0.02, 0, 1.3, 0.27);
	s.box({ tex: 'grain', color: [0.72, 0.5, 0.2] }, 0.18, 0.05, 0.02, 0, 1.12, 0.27);
	const zone = world.grid.zoneAt(W.origin.x, W.origin.z);
	s.box({ tex: 'grain', color: [0.4, 0.42, 0.42] }, 0.12, (zone?.height ?? 3) - 1.77, 0.12, 0, 1.77, 0.07);
	s.pop();

	// the cover, hinged on its left
	const cb = new Builder();
	cb.box({ tex: 'grain', color: [0.66, 0.64, 0.54] }, 0.7, 0.9, 0.03, 0.35, 0, 0);
	cb.box({ tex: 'hazard' }, 0.5, 0.08, 0.01, 0.35, 0.7, 0.018);
	for (const [bx, by] of [[0.06, 0.06], [0.64, 0.06], [0.06, 0.84], [0.64, 0.84]]) cb.box({ tex: 'grain', color: [0.8, 0.8, 0.8] }, 0.03, 0.03, 0.02, bx, by, 0.02);
	const cover = cb.build({ dynamic: true });
	const hinge = new THREE.Group();
	hinge.position.copy(W.at(-0.36, 0.86, 0.275));
	hinge.rotation.y = W.yaw;
	hinge.add(cover.group);
	world.root.add(hinge);

	// the fuse, shown once it is in
	const fb = new Builder();
	PICKUPS.fuse(fb);
	const fuse = fb.build({ dynamic: true });
	fuse.group.position.copy(W.at(0.04, 1.21, 0.275));
	fuse.group.rotation.y = W.yaw;
	world.root.add(fuse.group);

	const status = lamp(world, W.at(0.28, 1.84, 0.2), 0.06);
	const front = W.at(0, 1.2, 0.45);
	let coverAngle = 0;
	let sparkIn = 2;
	let hovered = false;

	const advance = () => {
		const i = step();
		const st = steps[i];
		if (!st) return;
		if (st.needs && !state.has(st.needs)) {
			host.say(`${host.t('repair.need')} (${host.itemName(st.needs)})`);
			host.sound('locked', front);
			return;
		}
		if (st.consume && st.needs) state.take(st.needs);
		state.vars[varKey] = i + 1;
		if (st.sound) host.sound(st.sound, front);
		world.noise(front, 3);
		if (st.done) host.say(st.done);
		if (i + 1 >= steps.length) {
			state.setFlag(def.doneFlag as string);
			world.particles.sparks.emit({ at: front, count: 24, speed: 2.2, up: 2, color: [1, 0.85, 0.4], size: 0.04, life: 0.7, grav: 9 });
			host.run(def.onDone as Action[] | undefined);
		}
	};

	return {
		def,
		update(dt, t) {
			const i = step();
			const open = i >= 1 && i < steps.length;
			coverAngle += ((open ? 1 : 0) - coverAngle) * Math.min(1, dt * 5);
			cover.group.rotation.y = -coverAngle * 1.9;
			fuse.group.visible = i >= 2;
			syncAmbient(world, front, cover.materials, 1.2);
			syncAmbient(world, front, fuse.materials, 1.2);
			setHighlight(cover.materials, hovered ? 0.12 : 0);
			hovered = false;
			const ok = fixed();
			const k = ok ? 1 : Math.sin(t * 5) > 0.3 ? 1 : 0.15;
			status.uniforms.uTint.value.setRGB(ok ? 0.25 : k, ok ? 1 : 0.1 * k, 0.12 * k);
			// a broken box spits sparks now and then
			if (!ok) {
				sparkIn -= dt;
				if (sparkIn <= 0) {
					sparkIn = 1.5 + Math.random() * 3;
					world.particles.sparks.emit({ at: W.at(0.1, 1.5, 0.3), count: 10, speed: 1.6, up: 1.5, color: [1, 0.9, 0.5], size: 0.035, life: 0.5, grav: 9 });
					world.lighting.disturb(front, 4, 0.6);
					host.sound('spark', front);
				}
			}
		},
		interactions(): Interaction[] {
			if (fixed()) return [];
			const st = steps[step()];
			if (!st) return [];
			const missing = !!st.needs && !state.has(st.needs);
			return [{
				pos: front,
				label: `${host.t(def.name as string)}: ${host.t(st.prompt)}`,
				detail: st.needs ? `${host.t('prompt.needs')}: ${host.itemName(st.needs)}` : undefined,
				disabled: missing,
				hold: missing ? undefined : st.hold,
				range: 2.0,
				use: advance,
				onHover: () => (hovered = true),
			}];
		},
	};
});

register('keypad', (def, world) => {
	const { state, host } = world;
	const W = wallSpace(world, def);
	const flag = `solved.${def.id}`;
	const s = world.statics;
	s.zone = Math.max(0, world.zoneIndexAt(W.origin));
	s.push(W.origin.x, 0, W.origin.z, W.yaw);
	const col: [number, number, number] = [0.5, 0.58, 0.55];
	s.box({ tex: 'grain', color: col }, 0.66, 1.95, 0.04, 0, 0, 0.02);
	s.box({ tex: 'grain', color: col }, 0.04, 1.95, 0.5, -0.31, 0, 0.25);
	s.box({ tex: 'grain', color: col }, 0.04, 1.95, 0.5, 0.31, 0, 0.25);
	s.box({ tex: 'grain', color: col }, 0.66, 0.04, 0.5, 0, 1.93, 0.25);
	s.box({ tex: 'grain', color: col }, 0.66, 0.06, 0.5, 0, 0, 0.25);
	s.box({ tex: 'grain', color: [0.4, 0.46, 0.44] }, 0.58, 0.03, 0.46, 0, 0.95, 0.25);
	if (def.sign) {
		const tex = signTexture(host.t(def.sign as string), 'white');
		s.plate({ tex }, 0.08 * signAspect(tex), 0.08, 0, 2.1, 0.03);
	}
	s.pop();
	world.addBox(W.at(0, 0, 0.25).x, W.at(0, 0, 0.25).z, 0.66, 0.5, def.facing === 'e' || def.facing === 'w' ? 90 : 0);

	const db = new Builder();
	db.box({ tex: 'grain', color: [0.55, 0.64, 0.6] }, 0.6, 1.86, 0.03, 0.3, 0.04, 0);
	for (let k = 0; k < 5; k++) db.box({ tex: null, color: [0.1, 0.12, 0.12] }, 0.3, 0.012, 0.01, 0.3, 1.55 + k * 0.05, 0.016);
	db.box({ tex: 'grain', color: [0.2, 0.2, 0.22] }, 0.12, 0.17, 0.03, 0.47, 1.1, 0.02);
	db.box({ tex: null, color: [0.3, 1, 0.5], emissive: true }, 0.08, 0.025, 0.01, 0.47, 1.23, 0.036);
	const door = db.build({ dynamic: true });
	const hinge = new THREE.Group();
	hinge.position.copy(W.at(-0.3, 0, 0.5));
	hinge.rotation.y = W.yaw;
	hinge.add(door.group);
	world.root.add(hinge);
	const pos = W.at(0.17, 1.18, 0.52);
	let angle = 0;
	let hovered = false;

	return {
		def,
		sync() {
			angle = state.flag(flag) ? 1 : 0;
		},
		update(dt) {
			angle += ((state.flag(flag) ? 1 : 0) - angle) * Math.min(1, dt * 3);
			door.group.rotation.y = -angle * 1.8;
			syncAmbient(world, pos, door.materials, 1.2);
			setHighlight(door.materials, hovered ? 0.12 : 0);
			hovered = false;
		},
		interactions(): Interaction[] {
			if (state.flag(flag)) return [];
			return [{
				pos,
				label: host.t('prompt.keypad'),
				detail: def.sign ? host.t(def.sign as string) : undefined,
				range: 2.0,
				onHover: () => (hovered = true),
				use() {
					host.openKeypad(def.code as string, () => {
						state.setFlag(flag);
						host.sound('lockerOpen', pos);
						host.run(def.onSolve as Action[] | undefined);
					});
				},
			}];
		},
	};
});

register('trigger', (def, world) => {
	const { state, host, player } = world;
	const size = (def.size as [number, number]) ?? [1, 1];
	const c = world.cell;
	const x0 = (def.at[0] - size[0] / 2) * c;
	const x1 = (def.at[0] + size[0] / 2) * c;
	const z0 = (def.at[1] - size[1] / 2) * c;
	const z1 = (def.at[1] + size[1] / 2) * c;
	const flag = `trig.${def.id}`;
	const once = def.once !== false;
	let inside = false;
	return {
		def,
		update() {
			const p = player.pos;
			const now = p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1;
			if (now && !inside && player.alive && !(once && state.flag(flag)) && state.check(def.when as Cond | undefined)) {
				if (once) state.setFlag(flag);
				host.run(def.actions as Action[]);
			}
			inside = now;
		},
	};
});
