import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The look of the game: soft toon light, a cool shadow tone, a warm lantern pool,
 * a rim of atmosphere light and ink outlines that match the UI's thick borders.
 * All materials share these uniforms, so one update per frame moves every light.
 */
export const light = {
	uSunDir: { value: new THREE.Vector3(0, 1, 0) },
	uSun: { value: new THREE.Color('#fff2dc') },
	uShade: { value: new THREE.Color('#6f6cb8') },
	uLantern: { value: new THREE.Vector3(0, -9999, 0) },
	uLanternColor: { value: new THREE.Color('#ffb257') },
	uLanternR: { value: 6.5 },
	uTime: { value: 0 },
};

export const INK = '#1d1733';

const lightGlsl = /* glsl */ `
	uniform vec3 uSunDir; uniform vec3 uSun; uniform vec3 uShade;
	uniform vec3 uLantern; uniform vec3 uLanternColor; uniform float uLanternR; uniform float uTime;
	float uLanternK = 1.0;
	vec3 toonLight(vec3 albedo, vec3 N, vec3 V, vec3 wpos, vec3 rim, float rimK) {
		float ndl = dot(N, uSunDir);
		float b = smoothstep(-0.04, 0.04, ndl) * 0.72 + smoothstep(0.5, 0.56, ndl) * 0.28;
		vec3 l = mix(uShade, uSun, b);
		float lf = 1.0 - clamp(distance(wpos, uLantern) / uLanternR, 0.0, 1.0);
		l += uLanternColor * lf * lf * 1.25 * uLanternK;
		float r = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
		return albedo * l + rim * r * rimK;
	}
`;

const dirUvGlsl = /* glsl */ `
	vec2 dirUV(vec3 d) {
		d = normalize(d);
		return vec2(atan(d.x, d.z) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5);
	}
	vec3 nightOf(vec3 c) {
		float l = dot(c, vec3(0.3, 0.59, 0.11));
		return mix(vec3(l), c, 0.22) * vec3(0.42, 0.5, 0.95) * 0.85;
	}
`;

const noiseGlsl = /* glsl */ `
	float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
	float vnoise(vec3 p) {
		vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
		return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
			mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
	}
	float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s / 0.875; }
`;

const outro = /* glsl */ `
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
`;

// ---------- Ground ----------

export interface GroundLook {
	kind: 0 | 1 | 2; // garden, ice, lava
	pal: string[]; // 4 day colors
	accent: string;
	rim: string;
}

export function groundMaterial(lit: THREE.Texture, look: GroundLook): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		defines: { KIND: look.kind },
		uniforms: {
			...light,
			uLit: { value: lit },
			uPal: { value: look.pal.map((c) => new THREE.Color(c)) },
			uAccent: { value: new THREE.Color(look.accent) },
			uRim: { value: new THREE.Color(look.rim) },
			uFront: { value: new THREE.Color('#ffd36b') },
			uWave: { value: 0 },
		},
		vertexShader: /* glsl */ `
			varying vec3 vLocal; varying vec3 vWorld; varying vec3 vN;
			void main() {
				vLocal = position;
				vec4 wp = modelMatrix * vec4(position, 1.0);
				vWorld = wp.xyz;
				vN = normalize(mat3(modelMatrix) * normal);
				gl_Position = projectionMatrix * viewMatrix * wp;
			}`,
		fragmentShader: /* glsl */ `
			varying vec3 vLocal; varying vec3 vWorld; varying vec3 vN;
			uniform sampler2D uLit; uniform vec3 uPal[4]; uniform vec3 uAccent; uniform vec3 uRim; uniform vec3 uFront;
			${lightGlsl}
			${dirUvGlsl}
			${noiseGlsl}
			void main() {
				vec3 p = vLocal;
				float lit = texture2D(uLit, dirUV(p)).r;
				float n = fbm(p * 0.3);
				float m = vnoise(p * 1.4 + 3.0);
				vec3 c = uPal[0];
				c = mix(c, uPal[1], step(0.46, n));
				c = mix(c, uPal[2], step(0.6, n));
				c = mix(c, uPal[3], step(0.72, m) * 0.6);
				vec3 glow = vec3(0.0);
				#if KIND == 0
					float path = abs(vnoise(p * 0.16 + 9.0) - 0.5);
					c = mix(c, uAccent, 1.0 - smoothstep(0.022, 0.03, path));
				#elif KIND == 1
					float crack = abs(vnoise(p * 0.55 - 4.0) - 0.5);
					c = mix(c, uAccent, (1.0 - smoothstep(0.012, 0.022, crack)) * 0.8);
					float tw = step(0.992, hash3(floor(p * 7.0))) * (0.5 + 0.5 * sin(uTime * 3.0 + hash3(floor(p * 7.0) + 1.0) * 40.0));
					glow += vec3(0.8, 0.95, 1.0) * tw * lit * 0.45;
				#else
					float ridge = 1.0 - abs(vnoise(p * 0.42 + 2.0) * 2.0 - 1.0);
					float vein = smoothstep(0.935, 0.97, ridge);
					float pulse = 0.8 + 0.2 * sin(uTime * 1.7 + p.x * 0.3);
					glow += uAccent * vein * (0.07 + lit * 0.9) * pulse;
					c = mix(c, c * 0.6, vein);
				#endif
				vec3 albedo = mix(nightOf(c), c, lit);
				vec3 N = normalize(vN);
				vec3 V = normalize(cameraPosition - vWorld);
				#if KIND == 1
					float rimK = 0.45 + 0.22 * lit;
				#else
					float rimK = 0.45 + 0.35 * lit;
				#endif
				vec3 col = toonLight(albedo, N, V, vWorld, uRim, rimK);
				col += glow;
				#if KIND == 1
					col *= mix(1.0, 0.88, lit);
				#endif
				col += uFront * pow(lit * (1.0 - lit) * 4.0, 2.0) * 0.12;
				gl_FragColor = vec4(col, 1.0);
				${outro}
			}`,
	});
}

/** A thin ink ring around the planet's silhouette. */
export function planetInkMaterial(): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		uniforms: { uInk: { value: new THREE.Color(INK) } },
		vertexShader: /* glsl */ `
			void main() {
				vec4 wp = modelMatrix * vec4(position, 1.0);
				vec3 n = normalize(mat3(modelMatrix) * normal);
				wp.xyz += n * 0.0045 * distance(wp.xyz, cameraPosition);
				gl_Position = projectionMatrix * viewMatrix * wp;
			}`,
		fragmentShader: /* glsl */ `uniform vec3 uInk; void main() { gl_FragColor = vec4(uInk, 1.0); ${outro} }`,
		side: THREE.BackSide,
	});
}

// ---------- Decor (merged, wakes with the lit map) ----------

const decorVertex = (outline: boolean) => /* glsl */ `
	attribute vec3 aCol; attribute vec3 aBase; attribute float aGrow; attribute float aGlow;
	uniform sampler2D uLit; uniform float uInkW; uniform float uTime;
	varying vec3 vCol; varying float vLit; varying float vGlow; varying vec3 vN; varying vec3 vWorld;
	${dirUvGlsl}
	void main() {
		float lit = texture2D(uLit, dirUV(aBase)).r;
		float s = mix(1.0 - aGrow * 0.72, 1.0, lit) + sin(lit * 3.1415927) * 0.22 * aGrow;
		vec3 p = aBase + (position - aBase) * s;
		// A gentle sway for plants, more when awake.
		float sway = aGrow * (0.25 + 0.75 * lit) * 0.04 * sin(uTime * 1.6 + aBase.x * 2.1 + aBase.z * 1.3);
		p += (position - aBase).y * vec3(sway, 0.0, sway * 0.6) * step(0.01, aGrow);
		vec4 wp = modelMatrix * vec4(p, 1.0);
		vec3 n = normalize(mat3(modelMatrix) * normal);
		${outline ? 'wp.xyz += n * uInkW * distance(wp.xyz, cameraPosition) * clamp(s, 0.3, 1.0);' : ''}
		vCol = aCol; vLit = lit; vGlow = aGlow; vN = n; vWorld = wp.xyz;
		gl_Position = projectionMatrix * viewMatrix * wp;
	}`;

export function decorMaterial(lit: THREE.Texture, rim: string): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		uniforms: { ...light, uLit: { value: lit }, uInkW: { value: 0 }, uRim: { value: new THREE.Color(rim) } },
		vertexShader: decorVertex(false),
		fragmentShader: /* glsl */ `
			varying vec3 vCol; varying float vLit; varying float vGlow; varying vec3 vN; varying vec3 vWorld;
			uniform vec3 uRim;
			${lightGlsl}
			vec3 nightOf(vec3 c) {
				float l = dot(c, vec3(0.3, 0.59, 0.11));
				return mix(vec3(l), c, 0.22) * vec3(0.42, 0.5, 0.95) * 0.85;
			}
			void main() {
				vec3 albedo = mix(nightOf(vCol), vCol, vLit);
				vec3 N = normalize(vN);
				vec3 V = normalize(cameraPosition - vWorld);
				vec3 col = toonLight(albedo, N, V, vWorld, uRim, 0.35);
				col += vCol * vGlow * (0.06 + vLit * 0.55);
				gl_FragColor = vec4(col, 1.0);
				${outro}
			}`,
	});
}

export function decorInkMaterial(lit: THREE.Texture, width = 0.0042): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		uniforms: { uLit: { value: lit }, uInkW: { value: width }, uTime: light.uTime, uInk: { value: new THREE.Color(INK) } },
		vertexShader: decorVertex(true),
		fragmentShader: /* glsl */ `uniform vec3 uInk; void main() { gl_FragColor = vec4(uInk, 1.0); ${outro} }`,
		side: THREE.BackSide,
	});
}

// ---------- Props and characters ----------

export interface ToonOpts {
	emissive?: number;
	rim?: string;
	rimK?: number;
	opacity?: number;
	/** How much Pip's lantern lights this. Pip's own parts use a little, or they wash out. */
	lantern?: number;
}

export function toon(color: THREE.ColorRepresentation, o: ToonOpts = {}): THREE.ShaderMaterial {
	const m = new THREE.ShaderMaterial({
		uniforms: {
			...light,
			uColor: { value: new THREE.Color(color) },
			uEmissive: { value: o.emissive ?? 0 },
			uRim: { value: new THREE.Color(o.rim ?? '#bfd4ff') },
			uRimK: { value: o.rimK ?? 0.35 },
			uOpacity: { value: o.opacity ?? 1 },
			uLK: { value: o.lantern ?? 1 },
		},
		vertexShader: /* glsl */ `
			varying vec3 vN; varying vec3 vWorld;
			void main() {
				vec4 wp = modelMatrix * vec4(position, 1.0);
				vWorld = wp.xyz;
				vN = normalize(mat3(modelMatrix) * normal);
				gl_Position = projectionMatrix * viewMatrix * wp;
			}`,
		fragmentShader: /* glsl */ `
			varying vec3 vN; varying vec3 vWorld;
			uniform vec3 uColor; uniform float uEmissive; uniform vec3 uRim; uniform float uRimK; uniform float uOpacity; uniform float uLK;
			${lightGlsl}
			void main() {
				uLanternK = uLK;
				vec3 N = normalize(vN);
				if (!gl_FrontFacing) N = -N;
				vec3 V = normalize(cameraPosition - vWorld);
				vec3 col = toonLight(uColor, N, V, vWorld, uRim, uRimK) + uColor * uEmissive;
				gl_FragColor = vec4(col, uOpacity);
				${outro}
			}`,
		transparent: (o.opacity ?? 1) < 1,
		depthWrite: (o.opacity ?? 1) >= 1,
	});
	return m;
}

/** Set a toon material's color, keeping its shared light uniforms. */
export function setToonColor(m: THREE.Material, c: THREE.ColorRepresentation, emissive?: number): void {
	const u = (m as THREE.ShaderMaterial).uniforms;
	(u.uColor.value as THREE.Color).set(c);
	if (emissive !== undefined) u.uEmissive.value = emissive;
}

const inkGeoCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const inkMats = new Map<number, THREE.ShaderMaterial>();

/** Geometry with smooth normals, so the outline hull has no gaps at hard edges. */
export function smoothCopy(geo: THREE.BufferGeometry): THREE.BufferGeometry {
	const hit = inkGeoCache.get(geo);
	if (hit) return hit;
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', geo.attributes.position.clone());
	if (geo.index) g.setIndex(geo.index.clone());
	const merged = mergeVertices(g, 1e-3);
	merged.computeVertexNormals();
	inkGeoCache.set(geo, merged);
	return merged;
}

export function inkMaterial(width = 0.0042): THREE.ShaderMaterial {
	const hit = inkMats.get(width);
	if (hit) return hit;
	const m = new THREE.ShaderMaterial({
		uniforms: { uInk: { value: new THREE.Color(INK) }, uW: { value: width } },
		vertexShader: /* glsl */ `
			uniform float uW;
			void main() {
				vec4 wp = modelMatrix * vec4(position, 1.0);
				vec3 n = normalize(mat3(modelMatrix) * normal);
				wp.xyz += n * uW * distance(wp.xyz, cameraPosition);
				gl_Position = projectionMatrix * viewMatrix * wp;
			}`,
		fragmentShader: /* glsl */ `uniform vec3 uInk; void main() { gl_FragColor = vec4(uInk, 1.0); ${outro} }`,
		side: THREE.BackSide,
	});
	inkMats.set(width, m);
	return m;
}

/** Give a mesh an ink outline (a slightly bigger back-face copy). */
export function ink<T extends THREE.Mesh>(mesh: T, width?: number): T {
	const hull = new THREE.Mesh(smoothCopy(mesh.geometry), inkMaterial(width));
	hull.name = 'ink';
	hull.renderOrder = mesh.renderOrder;
	mesh.add(hull);
	return mesh;
}

/** Build a toon mesh with an outline in one call. */
export function inked(geo: THREE.BufferGeometry, mat: THREE.Material, width?: number): THREE.Mesh {
	return ink(new THREE.Mesh(geo, mat), width);
}
