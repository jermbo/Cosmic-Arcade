import * as THREE from 'three';

let tex: THREE.Texture | null = null;

/** A soft round glow texture made in code. */
export function glowTexture(): THREE.Texture {
	if (tex) return tex;
	const c = document.createElement('canvas');
	c.width = c.height = 64;
	const g = c.getContext('2d')!;
	const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	grad.addColorStop(0, 'rgba(255,255,255,1)');
	grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
	grad.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = grad;
	g.fillRect(0, 0, 64, 64);
	tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}

export function glowSprite(color: THREE.ColorRepresentation, size: number, opacity = 1): THREE.Sprite {
	const m = new THREE.SpriteMaterial({
		map: glowTexture(),
		color,
		transparent: true,
		opacity,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
	});
	const s = new THREE.Sprite(m);
	s.scale.setScalar(size);
	return s;
}

/** A vertical beam: an open cylinder that fades toward the top. */
export function beamMaterial(color: THREE.ColorRepresentation, flip = false): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uTime: { value: 0 }, uFlip: { value: flip ? 1 : 0 } },
		vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
		fragmentShader: /* glsl */ `
			varying vec2 vUv; uniform vec3 uColor; uniform float uAlpha; uniform float uTime; uniform float uFlip;
			void main(){
				float y = mix(vUv.y, 1.0 - vUv.y, uFlip);
				float a = pow(1.0 - y, 1.6) * (0.75 + 0.25 * sin(y * 30.0 - uTime * 6.0));
				float edge = 1.0 - abs(vUv.x * 2.0 - 1.0);
				gl_FragColor = vec4(uColor, a * uAlpha * (0.5 + 0.5 * edge));
			}`,
		transparent: true,
		depthWrite: false,
		side: THREE.DoubleSide,
		blending: THREE.AdditiveBlending,
	});
}
