import * as THREE from 'three';
import type { Stage } from '../stage';

const MAX_PARTICLES = 900;

interface Particle {
	life: number;
	maxLife: number;
	size: number;
	gravity: number;
	drag: number;
	/** Smoke grows and then shrinks; shards only shrink. */
	puff: boolean;
	pos: THREE.Vector3;
	vel: THREE.Vector3;
	rot: THREE.Euler;
	spin: THREE.Vector3;
}

interface Fade {
	mesh: THREE.Mesh;
	life: number;
	maxLife: number;
	from: number;
	to: number;
	opacity: number;
}

interface FloatText {
	el: HTMLElement;
	pos: THREE.Vector3;
	life: number;
	maxLife: number;
}

/** Particles, rings, flashes and floating numbers. All made in code. */
export class Effects {
	private readonly stage: Stage;
	private readonly layer: HTMLElement;
	private readonly mesh: THREE.InstancedMesh;
	private readonly particles: (Particle | null)[] = new Array(MAX_PARTICLES).fill(null);
	private next = 0;
	private readonly fades: Fade[] = [];
	private readonly texts: FloatText[] = [];
	private readonly dummy = new THREE.Object3D();
	private readonly ringGeometry = new THREE.RingGeometry(0.85, 1, 48);
	private readonly sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
	readonly group = new THREE.Group();

	constructor(stage: Stage, layer: HTMLElement) {
		this.stage = stage;
		this.layer = layer;
		this.mesh = new THREE.InstancedMesh(
			new THREE.BoxGeometry(1, 1, 1),
			new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }),
			MAX_PARTICLES,
		);
		this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		this.mesh.frustumCulled = false;
		const color = new THREE.Color();
		this.dummy.scale.setScalar(0);
		this.dummy.updateMatrix();
		for (let i = 0; i < MAX_PARTICLES; i++) {
			this.mesh.setMatrixAt(i, this.dummy.matrix);
			this.mesh.setColorAt(i, color.set(0xffffff));
		}
		this.group.add(this.mesh);
	}

	burst(
		at: THREE.Vector3,
		color: number,
		count: number,
		{ speed = 3, size = 0.08, up = 2, gravity = -9, life = 0.7, drag = 1, puff = false } = {},
	): void {
		const tint = new THREE.Color(color);
		for (let n = 0; n < count; n++) {
			const i = this.next;
			this.next = (this.next + 1) % MAX_PARTICLES;
			const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize();
			const lifetime = life * (0.6 + Math.random() * 0.6);
			this.particles[i] = {
				life: lifetime,
				maxLife: lifetime,
				size: size * (0.6 + Math.random() * 0.8),
				gravity,
				drag,
				puff,
				pos: at.clone(),
				vel: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.8)).add(new THREE.Vector3(0, up * Math.random(), 0)),
				rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
				spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14),
			};
			const shade = tint.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
			this.mesh.setColorAt(i, shade);
		}
		if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
	}

	smoke(at: THREE.Vector3, count = 6, color = 0xd8d4e8): void {
		this.burst(at, color, count, { speed: 0.8, size: 0.22, up: 0.9, gravity: 0.6, life: 0.9, drag: 3, puff: true });
	}

	ring(at: THREE.Vector3, color: number, radius: number, duration = 0.45, opacity = 0.8): void {
		const mesh = new THREE.Mesh(
			this.ringGeometry,
			new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
		);
		mesh.rotation.x = -Math.PI / 2;
		mesh.position.copy(at);
		mesh.position.y += 0.03;
		this.group.add(mesh);
		this.fades.push({ mesh, life: duration, maxLife: duration, from: 0.1, to: radius, opacity });
	}

	flash(at: THREE.Vector3, color: number, size: number, duration = 0.18): void {
		const mesh = new THREE.Mesh(
			this.sphereGeometry,
			new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
		);
		mesh.position.copy(at);
		this.group.add(mesh);
		this.fades.push({ mesh, life: duration, maxLife: duration, from: size * 0.4, to: size, opacity: 0.9 });
	}

	text(at: THREE.Vector3, text: string, kind = 'gold'): void {
		const el = document.createElement('div');
		el.className = `float-text ${kind}`;
		el.textContent = text;
		this.layer.appendChild(el);
		this.texts.push({ el, pos: at.clone(), life: 0.9, maxLife: 0.9 });
	}

	update(dt: number): void {
		const d = this.dummy;
		for (let i = 0; i < MAX_PARTICLES; i++) {
			const p = this.particles[i];
			if (!p) continue;
			p.life -= dt;
			if (p.life <= 0) {
				this.particles[i] = null;
				d.scale.setScalar(0);
				d.updateMatrix();
				this.mesh.setMatrixAt(i, d.matrix);
				continue;
			}
			p.vel.y += p.gravity * dt;
			p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
			p.pos.addScaledVector(p.vel, dt);
			if (p.pos.y < 0.21 && p.gravity < 0) {
				p.pos.y = 0.21;
				p.vel.y *= -0.35;
				p.vel.x *= 0.6;
				p.vel.z *= 0.6;
			}
			p.rot.x += p.spin.x * dt;
			p.rot.y += p.spin.y * dt;
			p.rot.z += p.spin.z * dt;
			const t = 1 - p.life / p.maxLife;
			const scale = p.puff ? p.size * Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.1)) : p.size * (1 - t * t);
			d.position.copy(p.pos);
			d.rotation.copy(p.rot);
			d.scale.setScalar(Math.max(0.0001, scale));
			d.updateMatrix();
			this.mesh.setMatrixAt(i, d.matrix);
		}
		this.mesh.instanceMatrix.needsUpdate = true;

		for (let i = this.fades.length - 1; i >= 0; i--) {
			const f = this.fades[i];
			f.life -= dt;
			const t = 1 - Math.max(0, f.life) / f.maxLife;
			const ease = 1 - (1 - t) * (1 - t);
			f.mesh.scale.setScalar(f.from + (f.to - f.from) * ease);
			(f.mesh.material as THREE.MeshBasicMaterial).opacity = f.opacity * (1 - t);
			if (f.life <= 0) {
				this.group.remove(f.mesh);
				(f.mesh.material as THREE.Material).dispose();
				this.fades.splice(i, 1);
			}
		}

		const screen = new THREE.Vector2();
		for (let i = this.texts.length - 1; i >= 0; i--) {
			const text = this.texts[i];
			text.life -= dt;
			if (text.life <= 0) {
				text.el.remove();
				this.texts.splice(i, 1);
				continue;
			}
			const t = 1 - text.life / text.maxLife;
			const pos = text.pos.clone();
			pos.y += t * 0.8;
			this.stage.toScreen(pos, screen);
			text.el.style.transform = `translate(${screen.x}px, ${screen.y}px) translate(-50%, -50%) scale(${t < 0.15 ? 0.6 + t * 2.6 : 1})`;
			text.el.style.opacity = String(t > 0.6 ? (1 - t) / 0.4 : 1);
		}
	}

	clear(): void {
		this.particles.fill(null);
		this.dummy.scale.setScalar(0);
		this.dummy.updateMatrix();
		for (let i = 0; i < MAX_PARTICLES; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
		this.mesh.instanceMatrix.needsUpdate = true;
		for (const f of this.fades) this.group.remove(f.mesh);
		this.fades.length = 0;
		for (const text of this.texts) text.el.remove();
		this.texts.length = 0;
	}
}
