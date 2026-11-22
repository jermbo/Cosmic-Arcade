import * as THREE from 'three';

const W = 256;
const H = 128;

/**
 * Which parts of a planet are awake. A small lat/lon map, painted on the CPU where Pip walks
 * and read by the ground and decor shaders. Values only rise, so paths stay lit.
 */
export class LitMap {
	readonly texture: THREE.DataTexture;
	private data = new Uint8Array(W * H);
	private dirs = new Float32Array(W * H * 3);
	private dirty = false;
	private wave: { dir: THREE.Vector3; t: number; T: number } | null = null;
	/** 0..1 share of the planet that is awake. */
	lit = 0;

	constructor() {
		for (let y = 0; y < H; y++) {
			const lat = ((y + 0.5) / H - 0.5) * Math.PI;
			for (let x = 0; x < W; x++) {
				const lon = ((x + 0.5) / W - 0.5) * Math.PI * 2;
				const i = (y * W + x) * 3;
				this.dirs[i] = Math.cos(lat) * Math.sin(lon);
				this.dirs[i + 1] = Math.sin(lat);
				this.dirs[i + 2] = Math.cos(lat) * Math.cos(lon);
			}
		}
		this.texture = new THREE.DataTexture(this.data, W, H, THREE.RedFormat, THREE.UnsignedByteType);
		this.texture.wrapS = THREE.RepeatWrapping;
		this.texture.wrapT = THREE.ClampToEdgeWrapping;
		this.texture.magFilter = THREE.LinearFilter;
		this.texture.minFilter = THREE.LinearFilter;
		this.texture.generateMipmaps = false;
		this.texture.unpackAlignment = 1;
		this.texture.needsUpdate = true;
	}

	/** Raise the light in a soft disc around a local direction. `angle` in radians. */
	paint(dir: THREE.Vector3, angle: number, rate: number): void {
		const cosR = Math.cos(angle);
		const cosIn = Math.cos(angle * 0.82);
		const d = this.dirs;
		const data = this.data;
		const add = rate * 255;
		const dx = dir.x, dy = dir.y, dz = dir.z;
		// Only the rows that the disc can touch.
		const lat = Math.asin(Math.max(-1, Math.min(1, dy)));
		const y0 = Math.max(0, Math.floor(((lat - angle) / Math.PI + 0.5) * H) - 1);
		const y1 = Math.min(H - 1, Math.ceil(((lat + angle) / Math.PI + 0.5) * H) + 1);
		for (let y = y0; y <= y1; y++) {
			for (let x = 0; x < W; x++) {
				const k = y * W + x;
				const v = data[k];
				if (v === 255) continue;
				const i = k * 3;
				const c = d[i] * dx + d[i + 1] * dy + d[i + 2] * dz;
				if (c < cosR) continue;
				const target = c >= cosIn ? 255 : Math.round(255 * ((c - cosR) / (cosIn - cosR)));
				if (v >= target) continue;
				data[k] = Math.min(target, v + Math.max(1, Math.round(add)));
				this.dirty = true;
			}
		}
	}

	/** A wave of light that rolls over the whole planet from a direction. */
	startWave(dir: THREE.Vector3, seconds: number): void {
		this.wave = { dir: dir.clone().normalize(), t: 0, T: seconds };
	}

	get waving(): boolean {
		return this.wave !== null;
	}

	fill(): void {
		this.data.fill(255);
		this.dirty = true;
		this.lit = 1;
	}

	clear(): void {
		this.data.fill(0);
		this.wave = null;
		this.dirty = true;
		this.lit = 0;
	}

	update(dt: number): void {
		const w = this.wave;
		if (w) {
			w.t += dt;
			const k = Math.min(1, w.t / w.T);
			const e = 1 - Math.pow(1 - k, 2);
			this.paint(w.dir, 0.2 + e * Math.PI * 1.05, dt * 4);
			if (k >= 1) {
				this.wave = null;
				this.fill();
			}
		}
		if (this.dirty) {
			this.dirty = false;
			this.texture.needsUpdate = true;
			let sum = 0;
			for (let i = 0; i < this.data.length; i += 7) sum += this.data[i];
			this.lit = sum / (Math.ceil(this.data.length / 7) * 255);
		}
	}
}
