import * as THREE from 'three';
import { shared } from './psx.ts';

// Renders the scene at a low resolution, then scales it up with dithering and a light CRT pass.

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uCrt;
uniform float uTime;
uniform float uFade;
uniform vec3 uFadeColor;
uniform float uNoise;
varying vec2 vUv;

float bayer(vec2 p) {
	int x = int(mod(p.x, 4.0));
	int y = int(mod(p.y, 4.0));
	int i = x + y * 4;
	float m[16];
	m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
	m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
	for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0;
	return 0.0;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
	vec2 uv = vUv;
	if (uCrt > 0.5) {
		vec2 c = uv - 0.5;
		uv = 0.5 + c * (1.0 + dot(c, c) * 0.06);
	}
	vec3 col = texture2D(tScene, uv).rgb;
	vec2 px = floor(uv * uRes);
	col += (bayer(px) - 0.5) / 24.0;
	col = floor(col * 31.0 + 0.5) / 31.0;
	if (uNoise > 0.0) col += (hash(px + fract(uTime) * 91.0) - 0.5) * uNoise;
	if (uCrt > 0.5) {
		col *= 0.9 + 0.1 * sin(fract(uv.y * uRes.y) * 3.14159);
		vec2 c = uv - 0.5;
		col *= 1.0 - dot(c, c) * 0.55;
		if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
	}
	col = mix(col, uFadeColor, uFade);
	gl_FragColor = vec4(col, 1.0);
}
`;

export class Post {
	readonly renderer: THREE.WebGLRenderer;
	private target: THREE.WebGLRenderTarget;
	private quad: THREE.Mesh;
	private scene = new THREE.Scene();
	private cam = new THREE.Camera();
	private mat: THREE.ShaderMaterial;
	lines = 240;
	crt = true;
	fade = 0;
	fadeColor = new THREE.Color(0, 0, 0);
	noise = 0;

	constructor(canvas: HTMLCanvasElement) {
		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
		this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.target = new THREE.WebGLRenderTarget(320, 240, {
			magFilter: THREE.NearestFilter,
			minFilter: THREE.NearestFilter,
			depthBuffer: true,
		});
		this.mat = new THREE.ShaderMaterial({
			uniforms: {
				tScene: { value: this.target.texture },
				uRes: { value: new THREE.Vector2(320, 240) },
				uCrt: { value: 1 },
				uTime: { value: 0 },
				uFade: { value: 0 },
				uFadeColor: { value: this.fadeColor },
				uNoise: { value: 0 },
			},
			vertexShader: vertex,
			fragmentShader: fragment,
			depthTest: false,
			depthWrite: false,
		});
		this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
		this.quad.frustumCulled = false;
		this.scene.add(this.quad);
	}

	/** Matches the canvas to the window and the low-res target to the line count. */
	resize(camera: THREE.PerspectiveCamera): void {
		const w = window.innerWidth;
		const h = window.innerHeight;
		this.renderer.setSize(w, h, false);
		const aspect = w / h;
		const lines = this.lines;
		const tw = Math.max(1, Math.round(lines * aspect));
		this.target.setSize(tw, lines);
		(this.mat.uniforms.uRes.value as THREE.Vector2).set(tw, lines);
		shared.uSnap.value.set(tw, lines);
		camera.aspect = aspect;
		camera.updateProjectionMatrix();
	}

	render(scene: THREE.Scene, camera: THREE.Camera, time: number): void {
		const u = this.mat.uniforms;
		u.uCrt.value = this.crt ? 1 : 0;
		u.uTime.value = time;
		u.uFade.value = this.fade;
		u.uNoise.value = this.noise;
		this.renderer.setRenderTarget(this.target);
		this.renderer.render(scene, camera);
		this.renderer.setRenderTarget(null);
		this.renderer.render(this.scene, this.cam);
	}
}
