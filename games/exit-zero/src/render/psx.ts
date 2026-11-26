import * as THREE from 'three';

// The PS1 look: per-vertex lighting, snapped vertices, affine texture mapping and per-vertex fog.
// One shader for the whole game. The flashlight is per pixel, so its circle stays round.

export const MAX_LIGHTS = 16;
export const MAX_ZONES = 32;

const v4 = () => Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4());
const v3 = (n: number) => Array.from({ length: n }, () => new THREE.Vector3());

/** Uniforms shared by every PSX material. Change their values; never replace the objects. */
export const shared = {
	uLightPos: { value: v4() },
	uLightCol: { value: v3(MAX_LIGHTS) },
	uZoneAmb: { value: v3(MAX_ZONES) },
	uFogColor: { value: new THREE.Color(0.1, 0.09, 0.05) },
	uFogNear: { value: 5 },
	uFogFar: { value: 24 },
	uSnap: { value: new THREE.Vector2(320, 240) },
	uAffine: { value: 1 },
	uTime: { value: 0 },
	uFlashPos: { value: new THREE.Vector3() },
	uFlashDir: { value: new THREE.Vector3(0, 0, -1) },
	uFlashOn: { value: 0 },
};

const vertex = /* glsl */ `
#define MAXL ${MAX_LIGHTS}
#define MAXZ ${MAX_ZONES}
uniform vec4 uLightPos[MAXL];
uniform vec3 uLightCol[MAXL];
uniform vec3 uZoneAmb[MAXZ];
uniform vec4 uAmbDyn;
uniform vec2 uSnap;
uniform float uAffine;
uniform float uEmissive;
uniform vec3 uTint;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
uniform vec2 uScroll;
uniform float uWave;
attribute float aZone;
varying vec3 vLight;
varying vec3 vBase;
varying vec3 vUvw;
varying float vFog;
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
	vec4 lp = vec4(position, 1.0);
	vec3 n = normal;
	#ifdef USE_INSTANCING
	lp = instanceMatrix * lp;
	n = mat3(instanceMatrix) * n;
	#endif
	vec4 wp = modelMatrix * lp;
	if (uWave > 0.0) {
		wp.y += (sin(wp.x * 1.7 + uTime * 1.3) + cos(wp.z * 1.3 + uTime * 0.9)) * 0.015 * uWave;
	}
	vec3 wn = normalize(mat3(modelMatrix) * n);
	vec3 base = uTint;
	#ifdef USE_COLOR
	base *= color;
	#endif
	#ifdef USE_INSTANCING_COLOR
	base *= instanceColor;
	#endif
	vBase = base;
	if (uEmissive > 0.5) {
		vLight = base;
	} else {
		vec3 amb = uAmbDyn.w > 0.5 ? uAmbDyn.rgb : uZoneAmb[int(aZone + 0.5)];
		vec3 L = amb;
		for (int i = 0; i < MAXL; i++) {
			vec4 p = uLightPos[i];
			if (p.w <= 0.0) continue;
			vec3 d = p.xyz - wp.xyz;
			float dist = length(d);
			float att = clamp(1.0 - dist / p.w, 0.0, 1.0);
			att *= att;
			float ndl = max(dot(wn, d / max(dist, 0.001)), 0.0) * 0.7 + 0.3;
			L += uLightCol[i] * att * ndl;
		}
		vLight = base * L;
	}
	vWorld = wp.xyz;
	vNormal = wn;
	vec4 view = viewMatrix * wp;
	vFog = smoothstep(uFogNear, uFogFar, length(view.xyz));
	vec4 clip = projectionMatrix * view;
	if (uSnap.x > 0.0 && clip.w > 0.0) {
		vec2 s = uSnap * 0.5;
		clip.xy = floor(clip.xy / clip.w * s + 0.5) / s * clip.w;
	}
	gl_Position = clip;
	float w = mix(1.0, max(clip.w, 0.05), uAffine);
	vUvw = vec3((uv + uScroll * uTime) * w, w);
}
`;

const fragment = /* glsl */ `
uniform sampler2D map;
uniform float uHasMap;
uniform float uEmissive;
uniform vec3 uFogColor;
uniform float uAlpha;
uniform float uAlphaTest;
uniform vec3 uAdd;
uniform vec3 uFlashPos;
uniform vec3 uFlashDir;
uniform float uFlashOn;
uniform float uTime;
uniform vec2 uScroll2;
varying vec3 vLight;
varying vec3 vBase;
varying vec3 vUvw;
varying float vFog;
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
	vec2 uv = vUvw.xy / vUvw.z;
	vec4 tex = uHasMap > 0.5 ? texture2D(map, uv) : vec4(1.0);
	if (uScroll2.x != 0.0 || uScroll2.y != 0.0) tex = (tex + texture2D(map, uv * 0.7 + uScroll2 * uTime)) * 0.5;
	if (tex.a < uAlphaTest) discard;
	vec3 light = vLight;
	if (uFlashOn > 0.0 && uEmissive < 0.5) {
		vec3 d = vWorld - uFlashPos;
		float dist = length(d);
		vec3 dn = d / max(dist, 0.001);
		float cone = smoothstep(0.84, 0.95, dot(dn, uFlashDir));
		float att = clamp(1.0 - dist / 17.0, 0.0, 1.0);
		float ndl = max(dot(normalize(vNormal), -dn), 0.0) * 0.75 + 0.25;
		float f = cone * att * att * ndl * 1.7 * uFlashOn;
		f = floor(f * 7.0 + 0.5) / 7.0;
		light += vBase * f * vec3(1.0, 0.95, 0.82);
	}
	vec3 col = tex.rgb * light + uAdd;
	float fog = uEmissive > 0.5 ? vFog * 0.55 : vFog;
	col = mix(col, uFogColor, fog);
	gl_FragColor = vec4(col, tex.a * uAlpha);
}
`;

export interface PsxOptions {
	map?: THREE.Texture | null;
	tint?: [number, number, number];
	emissive?: boolean;
	transparent?: boolean;
	alpha?: number;
	alphaTest?: number;
	side?: THREE.Side;
	/** Uses its own ambient light instead of the zone table. For things that move. */
	dynamic?: boolean;
	scroll?: [number, number];
	scroll2?: [number, number];
	wave?: number;
	depthWrite?: boolean;
	vertexColors?: boolean;
}

export type PsxMaterial = THREE.ShaderMaterial & {
	uniforms: Record<string, THREE.IUniform> & {
		uAmbDyn: { value: THREE.Vector4 };
		uAdd: { value: THREE.Color };
		uTint: { value: THREE.Color };
		uAlpha: { value: number };
	};
};

export function psx(o: PsxOptions = {}): PsxMaterial {
	const tint = o.tint ?? [1, 1, 1];
	const m = new THREE.ShaderMaterial({
		uniforms: {
			...shared,
			map: { value: o.map ?? null },
			uHasMap: { value: o.map ? 1 : 0 },
			uEmissive: { value: o.emissive ? 1 : 0 },
			uTint: { value: new THREE.Color(tint[0], tint[1], tint[2]) },
			uAlpha: { value: o.alpha ?? 1 },
			uAlphaTest: { value: o.alphaTest ?? 0 },
			uAdd: { value: new THREE.Color(0, 0, 0) },
			uAmbDyn: { value: new THREE.Vector4(0.2, 0.2, 0.2, o.dynamic ? 1 : 0) },
			uScroll: { value: new THREE.Vector2(...(o.scroll ?? [0, 0])) },
			uScroll2: { value: new THREE.Vector2(...(o.scroll2 ?? [0, 0])) },
			uWave: { value: o.wave ?? 0 },
		},
		vertexShader: vertex,
		fragmentShader: fragment,
		vertexColors: o.vertexColors ?? true,
		transparent: o.transparent ?? false,
		side: o.side ?? THREE.FrontSide,
		depthWrite: o.depthWrite ?? !o.transparent,
	});
	return m as PsxMaterial;
}
