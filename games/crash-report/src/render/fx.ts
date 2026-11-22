import * as THREE from 'three';
import { CONFIG } from '../config.ts';

/**
 * Particles and blasts. All of it is for the eye only: nothing here changes the run.
 * Each kind of particle is one instanced mesh, so the cost stays low.
 */

type Kind = 'debris' | 'spark' | 'smoke' | 'fire';

interface Particle {
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	life: number;
	span: number;
	size: number;
	rx: number;
	ry: number;
	spin: number;
	r: number;
	g: number;
	b: number;
}

interface Pool {
	kind: Kind;
	mesh: THREE.InstancedMesh;
	items: Particle[];
	max: number;
}

interface Flash {
	ball: THREE.Mesh;
	ring: THREE.Mesh;
	age: number;
	radius: number;
	live: boolean;
}

const dummy = new THREE.Object3D();
const colour = new THREE.Color();
const FIRE_STOPS = [new THREE.Color(0xfff7c2), new THREE.Color(0xffc031), new THREE.Color(0xff6a1a), new THREE.Color(0x5a2a22), new THREE.Color(0x2a2424)];

export class Fx {
	private pools: Record<Kind, Pool>;
	private flashes: Flash[] = [];
	private lamps: { light: THREE.PointLight; age: number }[] = [];

	constructor(scene: THREE.Scene) {
		this.pools = {
			debris: this.makePool(scene, 'debris', new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ flatShading: true }), 420),
			spark: this.makePool(scene, 'spark', new THREE.BoxGeometry(0.07, 0.07, 1), new THREE.MeshBasicMaterial(), 360),
			smoke: this.makePool(scene, 'smoke', new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), 320),
			fire: this.makePool(scene, 'fire', new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial(), 260),
		};
		this.pools.debris.mesh.castShadow = true;

		const ballGeometry = new THREE.IcosahedronGeometry(1, 1);
		const ringGeometry = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
		for (let i = 0; i < 8; i++) {
			const ball = new THREE.Mesh(ballGeometry, new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, depthWrite: false }));
			const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
			ball.visible = false;
			ring.visible = false;
			scene.add(ball, ring);
			this.flashes.push({ ball, ring, age: 0, radius: 1, live: false });
		}
		for (let i = 0; i < 2; i++) {
			const light = new THREE.PointLight(0xffa040, 0, 70, 1.6);
			scene.add(light);
			this.lamps.push({ light, age: 9 });
		}
	}

	clear(): void {
		for (const pool of Object.values(this.pools)) {
			pool.items.length = 0;
			pool.mesh.count = 0;
		}
		for (const flash of this.flashes) {
			flash.live = false;
			flash.ball.visible = false;
			flash.ring.visible = false;
		}
		for (const lamp of this.lamps) lamp.light.intensity = 0;
	}

	debris(x: number, y: number, z: number, count: number, speed: number, hex: number): void {
		colour.setHex(hex);
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const out = speed * (0.3 + Math.random() * 0.9);
			this.add('debris', {
				x: x + (Math.random() - 0.5),
				y: y + Math.random() * 0.8,
				z: z + (Math.random() - 0.5),
				vx: Math.cos(angle) * out,
				vy: speed * (0.4 + Math.random() * 0.9),
				vz: Math.sin(angle) * out,
				life: 0,
				span: 1.6 + Math.random() * 1.8,
				size: 0.12 + Math.random() * 0.3,
				rx: Math.random() * 6,
				ry: Math.random() * 6,
				spin: (Math.random() - 0.5) * 16,
				r: colour.r * (0.7 + Math.random() * 0.3),
				g: colour.g * (0.7 + Math.random() * 0.3),
				b: colour.b * (0.7 + Math.random() * 0.3),
			});
		}
	}

	sparks(x: number, y: number, z: number, count: number, speed: number): void {
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const out = speed * (0.3 + Math.random());
			const heat = Math.random();
			this.add('spark', {
				x,
				y: y + Math.random() * 0.3,
				z,
				vx: Math.cos(angle) * out,
				vy: speed * (0.15 + Math.random() * 0.9),
				vz: Math.sin(angle) * out,
				life: 0,
				span: 0.25 + Math.random() * 0.5,
				size: 0.5 + Math.random() * 0.9,
				rx: 0,
				ry: 0,
				spin: 0,
				r: 1,
				g: 0.62 + heat * 0.36,
				b: 0.2 + heat * 0.5,
			});
		}
	}

	smoke(x: number, y: number, z: number, count: number, size: number, shade: number): void {
		for (let i = 0; i < count; i++) {
			const tone = shade * (0.8 + Math.random() * 0.4);
			this.add('smoke', {
				x: x + (Math.random() - 0.5) * size,
				y: y + Math.random() * size * 0.5,
				z: z + (Math.random() - 0.5) * size,
				vx: (Math.random() - 0.5) * 1.6,
				vy: 1.4 + Math.random() * 2.2,
				vz: (Math.random() - 0.5) * 1.6,
				life: 0,
				span: 1.4 + Math.random() * 1.5,
				size: size * (0.6 + Math.random() * 0.7),
				rx: Math.random() * 6,
				ry: Math.random() * 6,
				spin: (Math.random() - 0.5) * 1.5,
				r: tone,
				g: tone,
				b: tone * 1.04,
			});
		}
	}

	fire(x: number, y: number, z: number, count: number, size: number, speed: number): void {
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const tilt = Math.random() * Math.PI * 0.5;
			const out = speed * (0.35 + Math.random() * 0.75);
			this.add('fire', {
				x,
				y,
				z,
				vx: Math.cos(angle) * Math.cos(tilt) * out,
				vy: Math.sin(tilt) * out * 0.9 + 1.5,
				vz: Math.sin(angle) * Math.cos(tilt) * out,
				life: 0,
				span: 0.55 + Math.random() * 0.75,
				size: size * (0.55 + Math.random() * 0.8),
				rx: Math.random() * 6,
				ry: Math.random() * 6,
				spin: (Math.random() - 0.5) * 3,
				r: 1,
				g: 1,
				b: 1,
			});
		}
	}

	/** A blast: a hard white ball that pops and shrinks, a ring on the ground, fire, smoke and bits. */
	blast(x: number, y: number, z: number, radius: number): void {
		const flash = this.flashes.find((f) => !f.live) ?? this.flashes[0];
		flash.live = true;
		flash.age = 0;
		flash.radius = radius;
		flash.ball.position.set(x, Math.max(y, 0.8), z);
		flash.ring.position.set(x, 0.15, z);
		flash.ball.visible = true;
		flash.ring.visible = true;

		const scale = radius / 12;
		this.fire(x, y + 0.5, z, Math.round(26 * scale) + 8, 2.3 * scale + 0.7, 13 * scale + 5);
		this.smoke(x, y + 1, z, Math.round(10 * scale) + 4, 2.4 * scale + 0.8, 0.22);
		this.debris(x, y + 0.5, z, Math.round(22 * scale) + 6, 13 * scale + 5, 0x3a3a40);
		this.sparks(x, y + 0.5, z, Math.round(34 * scale) + 10, 20 * scale + 8);

		const lamp = this.lamps.reduce((a, b) => (a.age > b.age ? a : b));
		lamp.age = 0;
		lamp.light.position.set(x, y + 4, z);
		lamp.light.distance = radius * 4;
	}

	update(dt: number): void {
		this.updatePool(this.pools.debris, dt);
		this.updatePool(this.pools.spark, dt);
		this.updatePool(this.pools.smoke, dt);
		this.updatePool(this.pools.fire, dt);

		for (const flash of this.flashes) {
			if (!flash.live) continue;
			flash.age += dt;
			const t = flash.age;
			// The ball jumps to full size in a few frames and then falls in on itself.
			const pop = t < 0.07 ? t / 0.07 : Math.max(0, 1 - (t - 0.07) / 0.3);
			const ballSize = flash.radius * 0.42 * (t < 0.07 ? easeOut(pop) : pop * pop + 0.0001);
			flash.ball.scale.setScalar(Math.max(0.001, ballSize));
			(flash.ball.material as THREE.MeshBasicMaterial).color.copy(FIRE_STOPS[0]).lerp(FIRE_STOPS[2], Math.min(1, t / 0.3));
			const ringT = Math.min(1, t / 0.55);
			flash.ring.scale.setScalar(Math.max(0.001, flash.radius * 1.15 * easeOut(ringT)));
			(flash.ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - ringT);
			if (t > 0.6) {
				flash.live = false;
				flash.ball.visible = false;
				flash.ring.visible = false;
			}
		}
		for (const lamp of this.lamps) {
			lamp.age += dt;
			lamp.light.intensity = lamp.age < 0.5 ? 900 * Math.pow(1 - lamp.age / 0.5, 2) : 0;
		}
	}

	private makePool(scene: THREE.Scene, kind: Kind, geometry: THREE.BufferGeometry, material: THREE.Material, max: number): Pool {
		const mesh = new THREE.InstancedMesh(geometry, material, max);
		mesh.count = 0;
		mesh.frustumCulled = false;
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		mesh.setColorAt(0, colour.setHex(0xffffff));
		scene.add(mesh);
		return { kind, mesh, items: [], max };
	}

	private add(kind: Kind, particle: Particle): void {
		const pool = this.pools[kind];
		if (pool.items.length >= pool.max) pool.items.shift();
		pool.items.push(particle);
	}

	private updatePool(pool: Pool, dt: number): void {
		const items = pool.items;
		const gravity = CONFIG.physics.gravity;
		let write = 0;
		for (let i = 0; i < items.length; i++) {
			const p = items[i];
			p.life += dt;
			if (p.life >= p.span) continue;
			items[write++] = p;
			const t = p.life / p.span;
			let size = p.size;

			if (pool.kind === 'debris') {
				p.vy += gravity * dt;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				p.z += p.vz * dt;
				if (p.y < p.size / 2) {
					p.y = p.size / 2;
					p.vy = -p.vy * 0.35;
					p.vx *= 0.6;
					p.vz *= 0.6;
					p.spin *= 0.5;
				}
				p.rx += p.spin * dt;
				p.ry += p.spin * 0.7 * dt;
				if (t > 0.8) size *= (1 - t) / 0.2;
				dummy.rotation.set(p.rx, p.ry, 0);
				colour.setRGB(p.r, p.g, p.b);
			} else if (pool.kind === 'spark') {
				p.vy += gravity * 0.7 * dt;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				p.z += p.vz * dt;
				if (p.y < 0.05) {
					p.y = 0.05;
					p.vy = -p.vy * 0.4;
				}
				dummy.position.set(p.x, p.y, p.z);
				dummy.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
				dummy.scale.set(1, 1, size * (1 - t));
				dummy.updateMatrix();
				pool.mesh.setMatrixAt(write - 1, dummy.matrix);
				pool.mesh.setColorAt(write - 1, colour.setRGB(p.r, p.g * (1 - t * 0.5), p.b * (1 - t)));
				continue;
			} else {
				const drag = Math.exp(-(pool.kind === 'fire' ? 3.2 : 0.9) * dt);
				p.vx *= drag;
				p.vz *= drag;
				p.vy = pool.kind === 'fire' ? p.vy * drag + 2.2 * dt : p.vy;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				p.z += p.vz * dt;
				p.rx += p.spin * dt;
				// A puff grows fast, holds, and then shrinks to nothing.
				size *= t < 0.2 ? easeOut(t / 0.2) : t > 0.55 ? Math.max(0, 1 - (t - 0.55) / 0.45) : 1;
				dummy.rotation.set(p.rx, p.ry, p.rx * 0.5);
				if (pool.kind === 'fire') {
					const f = t * (FIRE_STOPS.length - 1);
					const index = Math.min(FIRE_STOPS.length - 2, Math.floor(f));
					colour.copy(FIRE_STOPS[index]).lerp(FIRE_STOPS[index + 1], f - index);
				} else {
					colour.setRGB(p.r, p.g, p.b);
				}
			}
			dummy.position.set(p.x, p.y, p.z);
			dummy.scale.setScalar(Math.max(0.001, size));
			dummy.updateMatrix();
			pool.mesh.setMatrixAt(write - 1, dummy.matrix);
			pool.mesh.setColorAt(write - 1, colour);
		}
		items.length = write;
		pool.mesh.count = write;
		pool.mesh.instanceMatrix.needsUpdate = true;
		if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
	}
}

function easeOut(t: number): number {
	return 1 - (1 - t) * (1 - t) * (1 - t);
}
