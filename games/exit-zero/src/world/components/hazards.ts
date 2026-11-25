import * as THREE from 'three';
import type { Cond } from '../../core/types.ts';
import { Builder } from '../../render/builder.ts';
import type { DynamicLight } from '../../render/lights.ts';
import { register } from '../registry.ts';
import type { Facing } from '../../core/types.ts';
import { FACING } from '../world.ts';
import { syncAmbient } from './util.ts';

// The two dangers of the slice. Both sleep until the player wakes them.

/** Tuning for the creature. Change these after a play test. */
export const FIXTURE = {
	walkSpeed: 1.7,
	huntSpeed: 3.1,
	chaseSpeed: 3.6,
	sightRange: 8,
	sightCos: Math.cos((65 * Math.PI) / 180),
	feelRange: 2.2,
	catchRange: 0.9,
	alertTime: 1.1,
	searchTime: 5,
	loseTime: 3,
	/** A wall in the way halves how far a noise carries. */
	wallDamp: 0.5,
};

type Mode = 'dormant' | 'alert' | 'hunt' | 'chase' | 'search' | 'return' | 'patrol';

register('creature', (def, world) => {
	const { grid, state, host, player } = world;
	const post = world.pos(def.at);
	const postYaw = FACING[(def.facing as Facing) ?? 'n'];
	const patrol = ((def.patrol as [number, number][]) ?? []).map((p) => world.pos(p));
	const roamFlag = def.roamFlag as string | undefined;

	// --- the body: tall, pale and thin, with a ceiling light for a head ---
	const skin = { tex: 'skin', color: [0.86, 0.84, 0.78] as [number, number, number] };
	const dark = { tex: 'grain', color: [0.3, 0.3, 0.32] as [number, number, number] };
	const mk = (draw: (b: Builder) => void) => {
		const b = new Builder();
		draw(b);
		return b.build({ dynamic: true });
	};
	const torso = mk((b) => {
		b.box(skin, 0.42, 0.9, 0.22, 0, 0, 0);
		b.box(skin, 0.5, 0.12, 0.26, 0, 0.82, 0);
		b.box(dark, 0.44, 0.08, 0.24, 0, -0.04, 0);
	});
	const neck = mk((b) => b.box(skin, 0.08, 0.36, 0.08, 0, 0, 0));
	const headParts = mk((b) => {
		b.box({ tex: 'grain', color: [0.75, 0.76, 0.74] }, 0.66, 0.1, 0.38, 0, 0, 0);
	});
	const lensB = new Builder();
	lensB.box({ tex: 'lightPanel', color: [1, 1, 1], emissive: true }, 0.58, 0.02, 0.3, 0, -0.015, 0);
	const lens = lensB.build();
	const limb = (len: number, w: number) => mk((b) => {
		b.box(skin, w, len, w, 0, -len, 0);
		b.box(skin, w * 1.4, 0.06, w * 1.8, 0, -len - 0.03, w * 0.3);
	});
	const legL = limb(1.15, 0.1);
	const legR = limb(1.15, 0.1);
	const armL = limb(1.25, 0.075);
	const armR = limb(1.25, 0.075);

	const body = new THREE.Group();
	const hip = new THREE.Group();
	hip.position.y = 1.15;
	body.add(hip);
	torso.group.position.y = 0;
	hip.add(torso.group);
	const shoulder = new THREE.Group();
	shoulder.position.set(0, 0.86, 0.02);
	torso.group.add(shoulder);
	const neckJoint = new THREE.Group();
	neckJoint.position.set(0, 0.9, -0.02);
	torso.group.add(neckJoint);
	neckJoint.add(neck.group);
	const headJoint = new THREE.Group();
	headJoint.position.set(0, 0.36, -0.06);
	neckJoint.add(headJoint);
	headJoint.add(headParts.group);
	headJoint.add(lens.group);
	legL.group.position.set(-0.12, 0, 0);
	legR.group.position.set(0.12, 0, 0);
	hip.add(legL.group, legR.group);
	armL.group.position.set(-0.3, 0, 0);
	armR.group.position.set(0.3, 0, 0);
	shoulder.add(armL.group, armR.group);
	world.root.add(body);
	const allMats = [torso, neck, headParts, legL, legR, armL, armR].flatMap((p) => p.materials);
	const lensMat = lens.materials[0];

	const headLight: DynamicLight = { pos: new THREE.Vector3(), color: new THREE.Color(0.85, 0.95, 1.0), range: 6.5, intensity: 0.5 };
	world.lighting.dynamic.push(headLight);

	// --- the mind ---
	const pos = post.clone();
	let yaw = postYaw;
	let mode: Mode = 'dormant';
	let timer = 0;
	let target = post.clone();
	let path: [number, number][] = [];
	let pathGoal = '';
	let patrolIndex = 0;
	let walkPhase = 0;
	let seen = 0;
	let headTwitch = 0;
	let headTurn = 0;
	let alertedBefore = false;

	const reset = () => {
		const roam = roamFlag && state.flag(roamFlag);
		pos.copy(roam && patrol.length ? patrol[0] : post);
		yaw = postYaw;
		mode = roam ? 'patrol' : 'dormant';
		patrolIndex = 0;
		path = [];
		pathGoal = '';
		timer = 0;
		seen = 0;
	};
	reset();

	const goTo = (p: THREE.Vector3) => {
		target.copy(p);
	};

	const wake = (at: THREE.Vector3) => {
		goTo(at);
		if (mode === 'dormant' || mode === 'patrol' || mode === 'return') {
			mode = 'alert';
			timer = FIXTURE.alertTime;
			host.sound(alertedBefore ? 'alert' : 'sting', pos);
			alertedBefore = true;
		} else if (mode === 'search') {
			mode = 'hunt';
		}
	};

	world.listeners.push({
		hear(at, radius) {
			if (!player.alive) return;
			const d = at.distanceTo(pos);
			const r = grid.lineClear(at.x, at.z, pos.x, pos.z) ? radius : radius * FIXTURE.wallDamp;
			if (d > r) return;
			wake(at);
		},
		// an alarm reaches it wherever it is
		alarm(at) {
			if (!player.alive) return;
			goTo(at);
			mode = 'alert';
			timer = FIXTURE.alertTime;
			host.sound('sting', pos);
			alertedBefore = true;
		},
	});
	world.threat = {
		pos,
		get mode() {
			return mode;
		},
	};

	const step = (dt: number, speed: number): boolean => {
		const from = grid.cellOf(pos.x, pos.z);
		const to = grid.cellOf(target.x, target.z);
		const key = `${to[0]},${to[1]}`;
		if (key !== pathGoal || path.length === 0) {
			path = grid.path(from, to);
			pathGoal = key;
		}
		// walk to the next cell center, or straight to the target in its cell
		while (path.length && path[0][0] === from[0] && path[0][1] === from[1]) path.shift();
		let wx: number;
		let wz: number;
		if (path.length === 0) {
			// in the target cell, or as close as it can get to it
			const there = from[0] === to[0] && from[1] === to[1];
			[wx, wz] = there ? [target.x, target.z] : grid.center(...from);
		} else {
			[wx, wz] = grid.center(path[0][0], path[0][1]);
			// cut the corner when the next two cells line up
			if (path.length > 1 && grid.lineClear(pos.x, pos.z, ...grid.center(path[1][0], path[1][1]))) {
				[wx, wz] = grid.center(path[1][0], path[1][1]);
			}
		}
		const dx = wx - pos.x;
		const dz = wz - pos.z;
		const d = Math.hypot(dx, dz);
		if (d < 0.05) return path.length === 0;
		const want = Math.atan2(dx, -dz);
		let dy = want - yaw;
		while (dy > Math.PI) dy -= Math.PI * 2;
		while (dy < -Math.PI) dy += Math.PI * 2;
		yaw += dy * Math.min(1, dt * 6);
		const s = Math.min(d, speed * dt);
		pos.x += (dx / d) * s;
		pos.z += (dz / d) * s;
		walkPhase += s * 2.4;
		if (Math.random() < dt * 1.5) host.sound('creatureStep', pos);
		return false;
	};

	const sees = (): boolean => {
		const to = player.pos.clone().sub(pos);
		to.y = 0;
		const d = to.length();
		if (d > FIXTURE.sightRange) return false;
		if (!grid.lineClear(pos.x, pos.z, player.pos.x, player.pos.z)) return false;
		if (d < FIXTURE.feelRange) return true;
		const fx = Math.sin(yaw);
		const fz = -Math.cos(yaw);
		return (to.x * fx + to.z * fz) / d > FIXTURE.sightCos;
	};

	return {
		def,
		sync: reset,
		update(dt, t) {
			const awake = mode !== 'dormant';
			if (player.alive) {
				switch (mode) {
					case 'dormant':
						// asleep, but the head follows a player who stands close
						break;
					case 'alert':
						timer -= dt;
						if (timer <= 0) mode = 'hunt';
						break;
					case 'hunt':
						if (sees()) mode = 'chase';
						else if (step(dt, FIXTURE.huntSpeed)) {
							mode = 'search';
							timer = FIXTURE.searchTime;
						}
						break;
					case 'chase':
						goTo(player.pos);
						if (sees()) seen = FIXTURE.loseTime;
						else seen -= dt;
						if (seen <= 0) {
							mode = 'search';
							timer = FIXTURE.searchTime;
						} else step(dt, FIXTURE.chaseSpeed);
						break;
					case 'search':
						timer -= dt;
						yaw += Math.sin(t * 1.3) * dt * 1.4;
						if (sees()) mode = 'chase';
						else if (timer <= 0) {
							const roam = roamFlag && state.flag(roamFlag);
							mode = roam ? 'patrol' : 'return';
							goTo(roam && patrol.length ? patrol[patrolIndex] : post);
						}
						break;
					case 'return':
						if (sees()) mode = 'chase';
						else if (step(dt, FIXTURE.walkSpeed)) {
							mode = 'dormant';
							yaw = postYaw;
						}
						break;
					case 'patrol':
						if (sees()) {
							mode = 'alert';
							timer = 0.6;
							goTo(player.pos);
							host.sound('alert', pos);
							break;
						}
						if (!patrol.length) break;
						goTo(patrol[patrolIndex]);
						if (step(dt, FIXTURE.walkSpeed)) patrolIndex = (patrolIndex + 1) % patrol.length;
						break;
				}
				const d = pos.distanceTo(player.pos.clone().setY(0));
				if ((mode === 'chase' || mode === 'hunt') && d < FIXTURE.catchRange) {
					host.die('creature');
				}
			}

			// --- the look ---
			body.position.copy(pos);
			body.rotation.y = -yaw;
			const moving = mode === 'hunt' || mode === 'chase' || mode === 'return' || mode === 'patrol';
			const swing = moving ? Math.sin(walkPhase) * 0.45 : 0;
			legL.group.rotation.x = swing;
			legR.group.rotation.x = -swing;
			armL.group.rotation.x = -swing * 0.5 + 0.05;
			armR.group.rotation.x = swing * 0.5 + 0.05;
			torso.group.rotation.x = moving ? -0.12 : -0.05;
			hip.position.y = 1.15 + (moving ? Math.abs(Math.cos(walkPhase)) * 0.04 : 0);
			// the idle telegraph: a slow sway and a twitch of the head
			headTwitch -= dt;
			if (headTwitch <= 0) {
				headTwitch = 2 + Math.random() * 4;
				headTurn = (Math.random() - 0.5) * 1.2;
			}
			let lookTurn = headTurn * (awake ? 0.3 : 1);
			if (!awake) {
				const toP = player.pos.clone().sub(pos);
				if (toP.length() < 7) {
					const rel = Math.atan2(toP.x, -toP.z) - yaw;
					lookTurn = Math.atan2(Math.sin(rel), Math.cos(rel)) * 0.4;
				}
			}
			headJoint.rotation.y += (-lookTurn - headJoint.rotation.y) * Math.min(1, dt * (awake ? 8 : 2));
			headJoint.rotation.z = Math.sin(t * 0.7) * 0.08 + (mode === 'alert' ? Math.sin(t * 40) * 0.12 : 0);
			body.rotation.z = awake ? 0 : Math.sin(t * 0.4) * 0.02;

			// head light: dim and sick while asleep, harsh while hunting
			const hunting = mode === 'hunt' || mode === 'chase' || mode === 'alert';
			const flick = Math.sin(t * 13) * Math.sin(t * 3.1) > 0.7 ? 0.3 : 1;
			const intensity = hunting ? 1.5 : mode === 'dormant' ? 0.75 * flick : 0.9 * flick;
			headLight.intensity += (intensity - headLight.intensity) * Math.min(1, dt * 6);
			headLight.color.setRGB(hunting ? 0.9 : 1.0, hunting ? 0.95 : 0.92, hunting ? 1.0 : 0.75);
			headJoint.getWorldPosition(headLight.pos);
			headLight.pos.y -= 0.25;
			const g = 0.35 + headLight.intensity * 0.5;
			lensMat.uniforms.uTint.value.setRGB(g * headLight.color.r, g * headLight.color.g, g * headLight.color.b);
			syncAmbient(world, pos.clone().setY(1.2), allMats, 1.6);
			if (awake) world.lighting.disturb(pos.clone().setY(2.5), 5, 0.7);
			host.loop('creature', player.alive, headLight.pos, hunting ? 1 : mode === 'dormant' ? 0.35 : 0.6);
		},
	};
});

register('hazardWater', (def, world) => {
	const { state, host, player, grid } = world;
	const ch = def.char as string;
	const level = world.level.zones[ch]?.water ?? 0.4;
	const cells: [number, number][] = [];
	for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (grid.char(x, y) === ch) cells.push([x, y]);
	let zap = 0;
	let wasLive = false;
	let deadly = 0;
	const center = world.pos(def.at, level);

	// a frayed cable hangs into the water
	const s = world.statics;
	s.zone = Math.max(0, world.zoneIndexAt(center));
	const cable = world.pos((def.cable as [number, number]) ?? def.at, 0);
	const h = world.level.zones[ch]?.height ?? 3;
	s.box({ tex: null, color: [0.12, 0.12, 0.12] }, 0.04, h, 0.04, cable.x, 0, cable.z);
	s.box({ tex: 'grain', color: [0.8, 0.5, 0.25] }, 0.08, 0.1, 0.08, cable.x, level - 0.05, cable.z);
	const cableTip = cable.clone().setY(level + 0.02);

	return {
		def,
		update(dt, t) {
			const live = state.check(def.live as Cond);
			const mat = world.waterMaterial(ch);
			if (live !== wasLive) {
				wasLive = live;
				world.lighting.disturb(center, 18, 1);
			}
			host.loop('crackle', live, cableTip);
			if (!live) {
				mat?.uniforms.uAdd.value.setRGB(0, 0, 0);
				deadly = 0;
				return;
			}
			const pulse = Math.sin(t * 23) * Math.sin(t * 7.3) > 0.4 ? 0.16 : 0.03;
			mat?.uniforms.uAdd.value.setRGB(pulse * 0.4, pulse * 0.7, pulse);
			zap -= dt;
			if (zap <= 0) {
				zap = 0.05 + Math.random() * 0.12;
				world.particles.sparks.emit({ at: cableTip, count: 4, speed: 1.4, up: 1.2, color: [0.7, 0.85, 1], size: 0.04, life: 0.4, grav: 8 });
				// arcs skitter over the water near the player
				const near = cells.filter(([x, y]) => Math.hypot((x + 0.5) * grid.cell - player.pos.x, (y + 0.5) * grid.cell - player.pos.z) < 9);
				const pick = near[(Math.random() * near.length) | 0];
				if (pick) {
					const at = new THREE.Vector3((pick[0] + Math.random()) * grid.cell, level + 0.02, (pick[1] + Math.random()) * grid.cell);
					world.particles.sparks.emit({ at, count: 3, speed: 0.8, up: 0.6, color: [0.6, 0.8, 1], size: 0.03, life: 0.25, grav: 4 });
				}
			}
			if (player.alive && player.inWater) {
				deadly += dt;
				if (deadly > 0.12) host.die('water');
			} else deadly = 0;
		},
	};
});
