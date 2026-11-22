import * as THREE from 'three';
import { rng } from '../util';

/** Stars and a soft nebula that stay around the camera, so they look endlessly far. */
export class Sky {
	readonly group = new THREE.Group();
	private nebula: THREE.ShaderMaterial;
	private stars: THREE.ShaderMaterial;

	constructor() {
		const r = rng(42);
		const count = 2600;
		const pos = new Float32Array(count * 3);
		const col = new Float32Array(count * 3);
		const size = new Float32Array(count);
		const phase = new Float32Array(count);
		const tints = [new THREE.Color('#ffffff'), new THREE.Color('#ffe9b8'), new THREE.Color('#b8d4ff'), new THREE.Color('#ffc2e0')];
		const v = new THREE.Vector3();
		for (let i = 0; i < count; i++) {
			v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
			if (v.lengthSq() > 1 || v.lengthSq() < 0.01) {
				i--;
				continue;
			}
			// A faint band of extra stars, like a galaxy arm.
			if (i < 900) v.y *= 0.18;
			v.normalize().multiplyScalar(900);
			pos.set([v.x, v.y, v.z], i * 3);
			const c = tints[Math.floor(r() * tints.length)];
			col.set([c.r, c.g, c.b], i * 3);
			size[i] = r() < 0.04 ? 3.4 + r() * 2 : 1 + r() * 1.6;
			phase[i] = r() * 6.28;
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
		g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
		g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
		this.stars = new THREE.ShaderMaterial({
			uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uBright: { value: 1 } },
			vertexShader: /* glsl */ `
				attribute vec3 aColor; attribute float aSize; attribute float aPhase;
				varying vec3 vColor; varying float vTw;
				uniform float uTime; uniform float uPixel;
				void main() {
					vColor = aColor;
					vTw = 0.65 + 0.35 * sin(uTime * (0.6 + fract(aPhase) * 1.6) + aPhase * 7.0);
					gl_PointSize = aSize * uPixel;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}`,
			fragmentShader: /* glsl */ `
				varying vec3 vColor; varying float vTw; uniform float uBright;
				void main() {
					vec2 p = gl_PointCoord * 2.0 - 1.0;
					float d = dot(p, p);
					if (d > 1.0) discard;
					gl_FragColor = vec4(vColor * vTw * uBright, pow(1.0 - d, 1.5));
				}`,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		});
		const pts = new THREE.Points(g, this.stars);
		pts.frustumCulled = false;
		pts.renderOrder = -1;

		this.nebula = new THREE.ShaderMaterial({
			side: THREE.BackSide,
			depthWrite: false,
			uniforms: {
				uA: { value: new THREE.Color('#130f33') },
				uB: { value: new THREE.Color('#3a1f5c') },
				uC: { value: new THREE.Color('#0f3550') },
			},
			vertexShader: /* glsl */ `
				varying vec3 vDir;
				void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
			fragmentShader: /* glsl */ `
				varying vec3 vDir; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
				float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
				float noise(vec3 p) {
					vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
					return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
						mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
				}
				float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.1; a *= 0.5; } return s; }
				void main() {
					vec3 d = normalize(vDir);
					float n = fbm(d * 2.2 + 3.0);
					float m = fbm(d * 3.5 - 7.0);
					float band = exp(-pow(d.y * 4.0, 2.0));
					vec3 col = uA;
					col = mix(col, uB, smoothstep(0.45, 0.8, n) * 0.75);
					col = mix(col, uC, smoothstep(0.5, 0.85, m) * 0.6);
					col += uB * band * 0.25;
					gl_FragColor = vec4(col, 1.0);
				}`,
		});
		const neb = new THREE.Mesh(new THREE.SphereGeometry(950, 32, 16), this.nebula);
		neb.frustumCulled = false;
		neb.renderOrder = -2;
		this.group.add(neb, pts, this.giant());
	}

	/** A big ringed planet far away, for scale and a sense of place. */
	private giant(): THREE.Group {
		const g = new THREE.Group();
		const sunDir = new THREE.Vector3(0.6, 0.5, 0.4).normalize();
		const body = new THREE.Mesh(
			new THREE.SphereGeometry(70, 48, 32),
			new THREE.ShaderMaterial({
				uniforms: { uSun: { value: sunDir } },
				vertexShader: /* glsl */ `
					varying vec3 vN; varying vec3 vP;
					void main() { vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `
					varying vec3 vN; varying vec3 vP; uniform vec3 uSun;
					void main() {
						float y = vP.y / 70.0;
						float w = sin(y * 15.0 + sin(vP.x * 0.05) * 1.4) * 0.5 + 0.5;
						vec3 a = vec3(0.30, 0.16, 0.38); vec3 b = vec3(0.62, 0.36, 0.55); vec3 c = vec3(0.95, 0.66, 0.55);
						vec3 col = mix(a, b, step(0.5, w));
						col = mix(col, c, step(0.86, w) * 0.8);
						float d = dot(normalize(vN), uSun);
						float l = 0.16 + 0.84 * smoothstep(-0.05, 0.08, d);
						gl_FragColor = vec4(col * l * 0.55, 1.0);
					}`,
			}),
		);
		const ring = new THREE.Mesh(
			new THREE.RingGeometry(95, 150, 96, 1),
			new THREE.ShaderMaterial({
				vertexShader: /* glsl */ `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `
					varying vec3 vP;
					void main() {
						float r = (length(vP.xy) - 95.0) / 55.0;
						float band = 0.55 + 0.45 * sin(r * 40.0) * sin(r * 13.0 + 1.0);
						float edge = smoothstep(0.0, 0.08, r) * smoothstep(1.0, 0.85, r);
						gl_FragColor = vec4(vec3(0.85, 0.62, 0.62) * 0.5, band * edge * 0.55);
					}`,
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
			}),
		);
		ring.rotation.x = Math.PI / 2 - 0.35;
		ring.rotation.y = 0.25;
		g.add(body, ring);
		g.position.set(-420, 260, -520);
		g.renderOrder = -1;
		body.renderOrder = -1.5;
		ring.renderOrder = -1;
		return g;
	}

	setPixelRatio(pr: number): void {
		this.stars.uniforms.uPixel.value = pr;
	}

	/** Slowly blend the nebula colors toward a planet's mood. */
	tint(a: THREE.Color, b: THREE.Color, c: THREE.Color, k: number): void {
		const u = this.nebula.uniforms;
		(u.uA.value as THREE.Color).lerp(a, k);
		(u.uB.value as THREE.Color).lerp(b, k);
		(u.uC.value as THREE.Color).lerp(c, k);
	}

	setBrightness(v: number): void {
		this.stars.uniforms.uBright.value = v;
	}

	update(cameraPos: THREE.Vector3, time: number): void {
		this.group.position.copy(cameraPos);
		this.stars.uniforms.uTime.value = time;
	}
}
