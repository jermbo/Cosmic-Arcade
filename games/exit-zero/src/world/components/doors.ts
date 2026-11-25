import * as THREE from 'three';
import type { Action, Cond } from '../../core/types.ts';
import { Builder } from '../../render/builder.ts';
import { signAspect, signTexture, type SignColor } from '../../render/textures.ts';
import { register } from '../registry.ts';
import type { Interaction, World } from '../world.ts';
import { setHighlight, syncAmbient, wallYaw } from './util.ts';

// Doors and gates: locks that open the way to new areas.

const FRAME = { tex: 'grain', color: [0.32, 0.34, 0.36] as [number, number, number] };

function cellKey(at: [number, number]) {
	return `${Math.floor(at[0])},${Math.floor(at[1])}`;
}

/** Draws the wall around a doorway that sits in the middle of a cell. Local: passage runs along z. */
function doorway(b: Builder, wallTex: string, cell: number, doorW: number, doorH: number, ceiling: number) {
	const side = (cell - doorW) / 2;
	const t = 0.3;
	b.box({ tex: wallTex, uvScale: 0.5 }, side, ceiling, t, -cell / 2 + side / 2, 0, 0);
	b.box({ tex: wallTex, uvScale: 0.5 }, side, ceiling, t, cell / 2 - side / 2, 0, 0);
	b.box({ tex: wallTex, uvScale: 0.5 }, doorW, ceiling - doorH, t, 0, doorH, 0);
	// frame
	b.box(FRAME, 0.08, doorH, t + 0.04, -doorW / 2, 0, 0);
	b.box(FRAME, 0.08, doorH, t + 0.04, doorW / 2, 0, 0);
	b.box(FRAME, doorW + 0.16, 0.08, t + 0.04, 0, doorH, 0);
}

function placeLocal(world: World, at: [number, number], axis: string) {
	const p = world.pos(at);
	const [cx, cz] = world.grid.cellOf(p.x, p.z);
	const [x, z] = world.grid.center(cx, cz);
	const yaw = axis === 'x' ? Math.PI / 2 : 0;
	return { x, z, yaw };
}

/** Blocks the frame sides of a doorway for the player. */
function frameColliders(world: World, x: number, z: number, axis: string, doorW: number) {
	const c = world.cell;
	const side = (c - doorW) / 2;
	const t = 0.3;
	if (axis === 'x') {
		world.addBox(x, z - c / 2 + side / 2, t, side);
		world.addBox(x, z + c / 2 - side / 2, t, side);
	} else {
		world.addBox(x - c / 2 + side / 2, z, side, t);
		world.addBox(x + c / 2 - side / 2, z, side, t);
	}
}

register('door', (def, world) => {
	const { state, host, grid } = world;
	const axis = (def.axis as string) ?? 'x';
	const { x, z, yaw } = placeLocal(world, def.at, axis);
	const zone = grid.zoneAt(x, z)!;
	const doorW = 1.1;
	const doorH = 2.15;
	const flag = `open.${def.id}`;

	const s = world.statics;
	s.zone = Math.max(0, world.zoneIndexAt(new THREE.Vector3(x, 0, z)));
	s.push(x, 0, z, yaw);
	doorway(s, zone.wall, world.cell, doorW, doorH, zone.height);
	if (def.sign) {
		const tex = signTexture(host.t(def.sign as string), 'white');
		for (const side of [-1, 1]) s.plate({ tex }, 0.2 * signAspect(tex), 0.2, 0, doorH + 0.25, side * 0.17, side > 0 ? 0 : Math.PI);
	}
	s.pop();
	frameColliders(world, x, z, axis, doorW);

	// the panel turns on a hinge at its left edge
	const b = new Builder();
	b.box({ tex: 'door' }, doorW - 0.04, doorH - 0.02, 0.06, doorW / 2 - 0.02, 0, 0);
	b.box({ tex: 'grain', color: [0.85, 0.75, 0.4] }, 0.04, 0.04, 0.16, doorW - 0.16, 1.0, 0);
	const { group, materials } = b.build({ dynamic: true });
	const hinge = new THREE.Group();
	hinge.add(group);
	hinge.position.set(x, 0, z);
	hinge.rotation.y = yaw;
	group.position.x = -doorW / 2;
	world.root.add(hinge);

	let angle = 0;
	let hovered = false;
	const isOpen = () => state.flag(flag);
	const block = () => (isOpen() ? grid.blocked.delete(cellKey(def.at)) : grid.blocked.add(cellKey(def.at)));
	world.colliders.push(
		axis === 'x'
			? { x0: x - 0.1, x1: x + 0.1, z0: z - doorW / 2, z1: z + doorW / 2, active: () => !isOpen() }
			: { x0: x - doorW / 2, x1: x + doorW / 2, z0: z - 0.1, z1: z + 0.1, active: () => !isOpen() },
	);

	const open = () => {
		state.setFlag(flag);
		block();
		host.sound('doorOpen', hinge.position);
		host.run(def.onOpen as Action[] | undefined);
	};

	return {
		def,
		sync() {
			block();
			angle = isOpen() ? 1 : 0;
		},
		update(dt) {
			const target = isOpen() ? 1 : 0;
			angle += (target - angle) * Math.min(1, dt * 3);
			group.rotation.y = -angle * 1.7;
			syncAmbient(world, hinge.position, materials, 1.1);
			setHighlight(materials, hovered ? 0.1 : 0);
			hovered = false;
		},
		interactions(): Interaction[] {
			if (isOpen()) return [];
			const ok = state.check(def.requires as Cond | undefined);
			const need = (def.requires as { item?: string })?.item;
			return [{
				pos: new THREE.Vector3(x, 1.1, z),
				label: ok ? host.t('prompt.open') : host.t('prompt.locked'),
				detail: !ok && need ? `${host.t('prompt.needs')}: ${host.itemName(need)}` : undefined,
				disabled: !ok,
				range: 2.6,
				onHover: () => (hovered = true),
				use() {
					if (ok) open();
					else {
						host.say(def.lockedText as string);
						host.sound('locked', hinge.position);
					}
				},
			}];
		},
	};
});

register('gate', (def, world) => {
	const { state, host, grid } = world;
	const axis = (def.axis as string) ?? 'z';
	const { x, z, yaw } = placeLocal(world, def.at, axis);
	const zone = grid.zoneAt(x, z)!;
	const c = world.cell;
	const gateH = Math.min(2.3, zone.height - 0.3);

	const s = world.statics;
	s.zone = Math.max(0, world.zoneIndexAt(new THREE.Vector3(x, 0, z)));
	s.push(x, 0, z, yaw);
	s.box(FRAME, 0.12, zone.height, 0.2, -c / 2 + 0.06, 0, 0);
	s.box(FRAME, 0.12, zone.height, 0.2, c / 2 - 0.06, 0, 0);
	s.box({ tex: 'hazard' }, c, 0.3, 0.32, 0, zone.height - 0.3, 0);
	if (def.sign) {
		const tex = signTexture(host.t(def.sign as string), 'yellow');
		s.plate({ tex }, 0.22 * signAspect(tex), 0.22, 0, zone.height - 0.55, 0.12, 0);
	}
	// the dead motor box at the side
	s.box({ tex: 'grain', color: [0.4, 0.42, 0.4] }, 0.3, 0.4, 0.14, c / 2 - 0.35, 1.2, 0.17);
	s.pop();

	const b = new Builder();
	b.plate({ tex: 'chainlink', alphaTest: 0.5, doubleSide: true, color: [0.85, 0.88, 0.88] }, c - 0.24, gateH, 0, gateH / 2, 0);
	b.box(FRAME, c - 0.24, 0.06, 0.06, 0, 0, 0);
	b.box(FRAME, c - 0.24, 0.06, 0.06, 0, gateH - 0.06, 0);
	const { group, materials } = b.build({ dynamic: true });
	group.position.set(x, 0, z);
	group.rotation.y = yaw;
	world.root.add(group);

	// a lamp on the motor box: red without power, green when the gate runs
	const lampB = new Builder();
	lampB.box({ tex: null, color: [1, 1, 1], emissive: true }, 0.06, 0.06, 0.04, 0, 0, 0);
	const lamp = lampB.build();
	const lampMat = lamp.materials[0];
	const lampLocal = new THREE.Vector3(c / 2 - 0.35, 1.48, 0.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
	lamp.group.position.set(x + lampLocal.x, lampLocal.y, z + lampLocal.z);
	world.root.add(lamp.group);

	let lift = 0;
	let wasOpen = false;
	let first = true;
	const isOpen = () => state.check(def.open as Cond);
	const block = () => (isOpen() ? grid.blocked.delete(cellKey(def.at)) : grid.blocked.add(cellKey(def.at)));
	world.colliders.push(
		axis === 'x'
			? { x0: x - 0.12, x1: x + 0.12, z0: z - c / 2, z1: z + c / 2, active: () => lift < 0.8 }
			: { x0: x - c / 2, x1: x + c / 2, z0: z - 0.12, z1: z + 0.12, active: () => lift < 0.8 },
	);

	return {
		def,
		sync() {
			wasOpen = isOpen();
			lift = wasOpen ? 1 : 0;
			block();
			first = false;
		},
		update(dt, t) {
			const open = isOpen();
			if (open !== wasOpen && !first) {
				block();
				if (open) {
					host.say(def.openText as string);
					host.sound('gate', group.position);
				}
			}
			wasOpen = open;
			first = false;
			lift += ((open ? 1 : 0) - lift) * Math.min(1, dt * (open ? 0.35 : 2));
			group.position.y = lift * (gateH - 0.1);
			syncAmbient(world, group.position, materials, 1.2);
			const green = open || state.flag('box.fixed');
			const blink = green ? 1 : Math.sin(t * 4) > 0 ? 1 : 0.25;
			lampMat.uniforms.uTint.value.setRGB(green ? 0.3 * blink : blink, green ? blink : 0.15 * blink, 0.2 * blink);
		},
		interactions(): Interaction[] {
			if (isOpen()) return [];
			return [{
				pos: new THREE.Vector3(x, 1.2, z),
				label: host.t('prompt.gate'),
				detail: host.t('sign.gate'),
				disabled: true,
				range: 2.6,
				use() {
					host.say(def.lockedText as string);
					host.sound('locked', group.position);
				},
			}];
		},
	};
});

/** A fire door set in a wall. Front faces +z. Returns the swinging part. */
function wallDoor(world: World, def: { at: [number, number]; facing?: 'n' | 'e' | 's' | 'w' }, color: [number, number, number], signText: string, signColor: SignColor, behind: 'brick' | 'light' = 'brick') {
	const p = world.wallPoint(def as never, 0, 0);
	const yaw = wallYaw(def as never);
	const s = world.statics;
	s.zone = Math.max(0, world.zoneIndexAt(p));
	s.push(p.x, 0, p.z, yaw);
	if (behind === 'brick') s.box({ tex: 'brick' }, 1.04, 2.12, 0.02, 0, 0, 0.01);
	else s.box({ tex: null, color: [0.85, 1, 0.9], emissive: true }, 1.04, 2.12, 0.02, 0, 0, 0.01);
	s.box(FRAME, 0.08, 2.2, 0.08, -0.56, 0, 0.04);
	s.box(FRAME, 0.08, 2.2, 0.08, 0.56, 0, 0.04);
	s.box(FRAME, 1.2, 0.08, 0.08, 0, 2.16, 0.04);
	const tex = signTexture(signText, signColor);
	s.plate({ tex, emissive: true }, 0.26 * signAspect(tex), 0.26, 0, 2.45, 0.05);
	s.pop();

	const b = new Builder();
	b.box({ tex: 'door', color }, 1.04, 2.12, 0.05, 0.52, 0, 0);
	b.box({ tex: 'grain', color: [0.8, 0.8, 0.75] }, 0.86, 0.05, 0.06, 0.5, 1.0, 0.04);
	const built = b.build({ dynamic: true });
	const hinge = new THREE.Group();
	hinge.position.copy(p);
	hinge.rotation.y = yaw;
	built.group.position.set(-0.52, 0, 0.04);
	hinge.add(built.group);
	world.root.add(hinge);
	return { hinge, door: built.group, materials: built.materials, front: p.clone() };
}

register('fakeExit', (def, world) => {
	const { state, host } = world;
	const d = wallDoor(world, def as never, [0.7, 0.68, 0.66], host.t(def.sign as string), 'red');
	const flag = `open.${def.id}`;
	let angle = 0;
	let hovered = false;
	const pos = d.front.clone().setY(1.1);
	return {
		def,
		sync() {
			angle = state.flag(flag) ? 1 : 0;
		},
		update(dt) {
			const target = state.flag(flag) ? 1 : 0;
			angle += (target - angle) * Math.min(1, dt * 2.5);
			d.door.rotation.y = -angle * 1.4;
			syncAmbient(world, pos, d.materials, 1.1);
			setHighlight(d.materials, hovered ? 0.1 : 0);
			hovered = false;
		},
		interactions(): Interaction[] {
			if (state.flag(flag)) return [];
			return [{
				pos,
				label: `${host.t('prompt.open')} ${host.t(def.sign as string)}`,
				range: 2.4,
				onHover: () => (hovered = true),
				use() {
					state.setFlag(flag);
					host.sound('doorOpen', pos);
					host.say(def.text as string);
				},
			}];
		},
	};
});

register('exit', (def, world) => {
	const { host } = world;
	const d = wallDoor(world, def as never, [0.45, 0.85, 0.55], host.t(def.sign as string), 'green', 'light');
	// a warm green light spills from the sign
	const lp = d.front.clone().setY(2.3);
	const dir = new THREE.Vector3(0, 0, 0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), wallYaw(def));
	lp.add(dir);
	world.lighting.dynamic.push({ pos: lp, color: new THREE.Color(0.35, 1.0, 0.5), range: 6, intensity: 1 });
	const pos = d.front.clone().setY(1.1);
	let opening = -1;
	return {
		def,
		update(dt) {
			syncAmbient(world, pos, d.materials, 1.4);
			if (opening >= 0) {
				opening = Math.min(1, opening + dt * 0.8);
				d.door.rotation.y = -opening * 1.3;
			}
		},
		sync() {
			opening = -1;
			d.door.rotation.y = 0;
		},
		interactions(): Interaction[] {
			if (opening >= 0) return [];
			return [{
				pos,
				label: `${host.t('prompt.exit')} ${host.t(def.sign as string)}`,
				range: 2.4,
				use() {
					opening = 0;
					host.sound('doorOpen', pos);
					host.ending();
				},
			}];
		},
	};
});
