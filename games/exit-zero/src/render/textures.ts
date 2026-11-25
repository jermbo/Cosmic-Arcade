import * as THREE from 'three';

// Every texture is painted in code at a low size and drawn with nearest filtering.

type Painter = (g: CanvasRenderingContext2D, w: number, h: number, r: () => number) => void;

interface TexSpec {
	w: number;
	h: number;
	paint: Painter;
	/** World meters of one repeat, for level surfaces. */
	size?: [number, number];
	alpha?: boolean;
}

function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const rgb = (r: number, g: number, b: number, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

/** Fills each pixel with the base color plus noise. */
function noise(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, base: [number, number, number], amount: number, mono = true) {
	const img = g.getImageData(0, 0, w, h);
	for (let i = 0; i < w * h; i++) {
		const n = (r() - 0.5) * amount;
		img.data[i * 4] = base[0] + n + (mono ? 0 : (r() - 0.5) * amount * 0.5);
		img.data[i * 4 + 1] = base[1] + n;
		img.data[i * 4 + 2] = base[2] + n * 0.8;
		img.data[i * 4 + 3] = 255;
	}
	g.putImageData(img, 0, 0);
}

function blot(g: CanvasRenderingContext2D, x: number, y: number, rad: number, color: string) {
	const grad = g.createRadialGradient(x, y, 0, x, y, rad);
	grad.addColorStop(0, color);
	grad.addColorStop(1, 'rgba(0,0,0,0)');
	g.fillStyle = grad;
	g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}

/** Draws a blot on all four tile edges, so stains wrap without a seam. */
function blotWrap(g: CanvasRenderingContext2D, w: number, h: number, x: number, y: number, rad: number, color: string) {
	for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) blot(g, x + ox, y + oy, rad, color);
}

function drips(g: CanvasRenderingContext2D, w: number, r: () => number, count: number, color: string, maxLen: number) {
	g.fillStyle = color;
	for (let i = 0; i < count; i++) {
		const x = (r() * w) | 0;
		const len = 4 + r() * maxLen;
		g.fillRect(x, 0, 1, len);
		if (r() > 0.5) g.fillRect(x + 1, 0, 1, len * 0.6);
	}
}

function wallpaper(stained: boolean): Painter {
	return (g, w, h, r) => {
		noise(g, w, h, r, stained ? [178, 160, 96] : [214, 196, 118], 10);
		for (let x = 0; x < w; x += 8) {
			g.fillStyle = rgb(150, 132, 70, stained ? 0.5 : 0.42);
			g.fillRect(x, 0, 1, h);
			g.fillStyle = rgb(240, 226, 150, 0.35);
			g.fillRect(x + 4, 0, 1, h);
		}
		// small diamonds between the stripes
		g.fillStyle = rgb(160, 140, 80, 0.45);
		for (let y = 6; y < h - 10; y += 12) for (let x = 2; x < w; x += 8) {
			const oy = (x / 8) % 2 ? 6 : 0;
			g.fillRect(x, y + oy, 1, 1);
			g.fillRect(x + 1, y + oy - 1, 1, 3);
			g.fillRect(x + 2, y + oy, 1, 1);
		}
		// grime toward the top and the floor
		const grad = g.createLinearGradient(0, 0, 0, h);
		grad.addColorStop(0, rgb(70, 55, 20, stained ? 0.45 : 0.25));
		grad.addColorStop(0.25, rgb(0, 0, 0, 0));
		grad.addColorStop(0.85, rgb(0, 0, 0, 0));
		grad.addColorStop(1, rgb(60, 45, 20, 0.4));
		g.fillStyle = grad;
		g.fillRect(0, 0, w, h);
		const stains = stained ? 6 : 2;
		for (let i = 0; i < stains; i++) blot(g, r() * w, r() * h * 0.6, 6 + r() * 12, rgb(120, 90, 40, 0.35));
		drips(g, w, r, stained ? 7 : 3, rgb(130, 100, 50, 0.35), stained ? 40 : 18);
		// baseboard
		const bh = Math.round(h * 0.06);
		g.fillStyle = rgb(78, 64, 36);
		g.fillRect(0, h - bh, w, bh);
		g.fillStyle = rgb(120, 100, 60);
		g.fillRect(0, h - bh, w, 1);
		if (stained) {
			g.fillStyle = rgb(110, 96, 70, 0.9);
			g.fillRect((r() * w * 0.6) | 0, (h * 0.4) | 0, 9, 14);
		}
	};
}

function carpet(base: [number, number, number], stains: number): Painter {
	return (g, w, h, r) => {
		noise(g, w, h, r, base, 26, false);
		g.fillStyle = rgb(base[0] * 0.8, base[1] * 0.8, base[2] * 0.75, 0.5);
		for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) g.fillRect(x, y, 2, 2);
		for (let i = 0; i < stains; i++) blotWrap(g, w, h, r() * w, r() * h, 5 + r() * 10, rgb(60, 48, 20, 0.35));
	};
}

const ceilingTile: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [206, 199, 174], 14);
	g.fillStyle = rgb(160, 156, 140, 0.6);
	for (let i = 0; i < 90; i++) g.fillRect((r() * w) | 0, (r() * h) | 0, 1, 1);
	blot(g, 44, 18, 12, rgb(190, 150, 60, 0.45));
	g.fillStyle = rgb(120, 118, 108);
	for (let i = 0; i < w; i += 32) {
		g.fillRect(i, 0, 2, h);
		g.fillRect(0, i, w, 2);
	}
};

function concrete(base: [number, number, number]): Painter {
	return (g, w, h, r) => {
		noise(g, w, h, r, base, 22);
		for (let i = 0; i < 5; i++) blotWrap(g, w, h, r() * w, r() * h, 6 + r() * 14, rgb(0, 0, 0, 0.18));
		g.strokeStyle = rgb(30, 30, 30, 0.5);
		g.lineWidth = 1;
		for (let i = 0; i < 2; i++) {
			g.beginPath();
			let x = r() * w;
			let y = r() * h;
			g.moveTo(x, y);
			for (let k = 0; k < 6; k++) {
				x += (r() - 0.5) * 14;
				y += r() * 8;
				g.lineTo(x, y);
			}
			g.stroke();
		}
	};
}

const cinder: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [150, 160, 144], 14);
	const rows = 4;
	const bh = h / rows;
	g.fillStyle = rgb(96, 104, 92);
	for (let row = 0; row < rows; row++) {
		const y = row * bh;
		g.fillRect(0, y, w, 1);
		const off = row % 2 ? w / 4 : 0;
		for (let x = off; x < w + w / 2; x += w / 2) g.fillRect(x % w, y, 1, bh);
	}
	// a painted band at waist height and a dark scuffed bottom
	g.fillStyle = rgb(70, 92, 96, 0.55);
	g.fillRect(0, h - bh * 1.1, w, 3);
	drips(g, w, r, 4, rgb(80, 70, 50, 0.3), 30);
};

const grating: Painter = (g, w, h, r) => {
	g.fillStyle = rgb(14, 14, 14);
	g.fillRect(0, 0, w, h);
	for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
		const s = 60 + r() * 20;
		g.fillStyle = rgb(s, s + 6, s + 8);
		g.fillRect(x, y, 8, 2);
		g.fillRect(x, y, 2, 8);
		g.fillStyle = rgb(s + 30, s + 36, s + 38);
		g.fillRect(x, y, 8, 1);
	}
	g.fillStyle = rgb(110, 70, 40, 0.35);
	for (let i = 0; i < 30; i++) g.fillRect((r() * w) | 0, (r() * h) | 0, 2, 1);
};

const metalPanel: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [92, 108, 106], 12);
	g.fillStyle = rgb(50, 60, 60);
	g.fillRect(0, 0, w, 2);
	g.fillRect(0, 0, 2, h);
	g.fillStyle = rgb(140, 156, 150);
	g.fillRect(2, 2, w - 2, 1);
	g.fillStyle = rgb(170, 180, 170);
	for (const [x, y] of [[5, 5], [w - 5, 5], [5, h - 5], [w - 5, h - 5], [w / 2, 5], [w / 2, h - 5]]) g.fillRect(x, y, 2, 2);
	drips(g, w, r, 5, rgb(120, 70, 40, 0.45), 40);
};

function tiles(base: [number, number, number], n: number, broken: number): Painter {
	return (g, w, h, r) => {
		noise(g, w, h, r, base, 10);
		const s = w / n;
		for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
			const k = (r() - 0.5) * 18;
			g.fillStyle = rgb(base[0] + k, base[1] + k, base[2] + k, 0.6);
			g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
			g.fillStyle = rgb(255, 255, 255, 0.18);
			g.fillRect(x * s + 1, y * s + 1, s - 2, 1);
			if (r() < broken) {
				g.fillStyle = rgb(40, 44, 40);
				g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
			}
		}
		g.fillStyle = rgb(base[0] * 0.45, base[1] * 0.45, base[2] * 0.45);
		for (let i = 0; i < n; i++) {
			g.fillRect(i * s, 0, 1, h);
			g.fillRect(0, i * s, w, 1);
		}
		drips(g, w, r, 3, rgb(90, 80, 50, 0.3), 30);
	};
}

const lightPanel: Painter = (g, w, h) => {
	g.fillStyle = rgb(250, 250, 240);
	g.fillRect(0, 0, w, h);
	g.fillStyle = rgb(215, 220, 205);
	for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1, h);
	for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
	g.fillStyle = rgb(150, 150, 140);
	g.fillRect(0, 0, w, 2);
	g.fillRect(0, h - 2, w, 2);
	g.fillRect(0, 0, 2, h);
	g.fillRect(w - 2, 0, 2, h);
};

const door: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [104, 118, 126], 10);
	g.fillStyle = rgb(70, 80, 88);
	g.fillRect(0, 0, w, 2);
	g.fillRect(0, 0, 2, h);
	g.fillRect(w - 2, 0, 2, h);
	g.fillStyle = rgb(84, 96, 104);
	g.fillRect(8, 10, w - 16, h * 0.36);
	g.fillRect(8, h * 0.56, w - 16, h * 0.36);
	g.fillStyle = rgb(130, 144, 150);
	g.fillRect(8, 10, w - 16, 1);
	g.fillRect(8, h * 0.56, w - 16, 1);
	// push bar and kick plate
	g.fillStyle = rgb(190, 190, 180);
	g.fillRect(4, h * 0.5, w - 8, 3);
	g.fillStyle = rgb(60, 66, 70);
	g.fillRect(0, h - 10, w, 10);
	for (let i = 0; i < 5; i++) blot(g, r() * w, h * (0.6 + r() * 0.4), 4 + r() * 6, rgb(40, 40, 30, 0.35));
};

const brick: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [80, 76, 70], 10);
	const bw = 16;
	const bh = 8;
	for (let y = 0; y < h; y += bh) for (let x = (y / bh) % 2 ? -bw / 2 : 0; x < w; x += bw) {
		const k = r() * 30;
		g.fillStyle = rgb(130 + k, 58 + k * 0.4, 44 + k * 0.3);
		g.fillRect(x + 1, y + 1, bw - 1, bh - 1);
	}
};

const chainlink: Painter = (g, w, h) => {
	g.clearRect(0, 0, w, h);
	g.fillStyle = rgb(190, 196, 196);
	for (let i = -h; i < w + h; i += 8) {
		for (let y = 0; y < h; y++) {
			g.fillRect(i + y, y, 1, 1);
			g.fillRect(i - y + h, y, 1, 1);
		}
	}
};

const grain: Painter = (g, w, h, r) => noise(g, w, h, r, [222, 222, 222], 34);

const wood: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [182, 156, 108], 10);
	g.fillStyle = rgb(140, 112, 70, 0.5);
	for (let y = 0; y < h; y += 3 + ((r() * 3) | 0)) g.fillRect(0, y, w, 1);
};

const fabric: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [210, 210, 214], 40);
	g.fillStyle = rgb(170, 170, 180, 0.5);
	for (let y = 0; y < h; y += 2) g.fillRect(0, y, w, 1);
};

const paper: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [236, 230, 210], 8);
	g.fillStyle = rgb(150, 170, 210, 0.8);
	for (let y = 6; y < h; y += 4) g.fillRect(0, y, w, 1);
	g.fillStyle = rgb(30, 30, 60);
	for (let y = 7; y < h - 2; y += 4) {
		let x = 3;
		while (x < w - 4) {
			const len = 2 + ((r() * 5) | 0);
			g.fillRect(x, y - 1, len, 1);
			x += len + 1 + ((r() * 2) | 0);
		}
	}
	g.fillStyle = rgb(200, 60, 50);
	g.fillRect(3, 0, 1, h);
};

const sticky: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [250, 226, 80], 10);
	g.fillStyle = rgb(40, 40, 60);
	for (let y = 6; y < h - 3; y += 5) {
		let x = 3;
		while (x < w - 5) {
			const len = 2 + ((r() * 4) | 0);
			g.fillRect(x, y, len, 1);
			x += len + 2;
		}
	}
};

const water: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [34, 60, 58], 12);
	for (let i = 0; i < 4; i++) blotWrap(g, w, h, r() * w, r() * h, 10 + r() * 12, rgb(70, 60, 30, 0.25));
	g.strokeStyle = rgb(110, 160, 150, 0.22);
	for (let i = 0; i < 12; i++) {
		g.beginPath();
		const x = r() * w;
		const y = r() * h;
		g.ellipse(x, y, 4 + r() * 8, 2 + r() * 4, r() * 3, 0, Math.PI * 2);
		g.stroke();
	}
};

const hazard: Painter = (g, w, h) => {
	g.fillStyle = rgb(230, 190, 40);
	g.fillRect(0, 0, w, h);
	g.fillStyle = rgb(20, 20, 20);
	for (let i = -h; i < w; i += 8) {
		for (let y = 0; y < h; y++) g.fillRect(i + y, y, 4, 1);
	}
};

const cardboard: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [170, 130, 84], 14);
	g.fillStyle = rgb(200, 180, 130, 0.8);
	g.fillRect(0, h / 2 - 2, w, 4);
	g.fillStyle = rgb(60, 40, 20, 0.6);
	g.fillRect(w * 0.6, h * 0.65, 8, 2);
};

const skin: Painter = (g, w, h, r) => {
	noise(g, w, h, r, [232, 228, 216], 18);
	g.fillStyle = rgb(170, 160, 150, 0.35);
	for (let i = 0; i < 10; i++) g.fillRect((r() * w) | 0, 0, 1, h);
};

const SPECS: Record<string, TexSpec> = {
	carpet: { w: 64, h: 64, paint: carpet([150, 132, 70], 3), size: [2, 2] },
	carpetDark: { w: 64, h: 64, paint: carpet([96, 88, 70], 6), size: [2, 2] },
	wallpaper: { w: 64, h: 96, paint: wallpaper(false), size: [2, 2.6] },
	wallpaperStained: { w: 64, h: 96, paint: wallpaper(true), size: [2, 2.6] },
	ceilingTile: { w: 64, h: 64, paint: ceilingTile, size: [2, 2] },
	concrete: { w: 64, h: 64, paint: concrete([116, 114, 108]), size: [2, 2] },
	concreteCeil: { w: 64, h: 64, paint: concrete([80, 80, 78]), size: [2, 2] },
	cinder: { w: 64, h: 64, paint: cinder, size: [2, 1.6] },
	grating: { w: 64, h: 64, paint: grating, size: [2, 2] },
	metalPanel: { w: 64, h: 64, paint: metalPanel, size: [2, 2.25] },
	tileGreen: { w: 64, h: 64, paint: tiles([104, 156, 136], 8, 0.03), size: [2, 2] },
	tileWhite: { w: 64, h: 64, paint: tiles([206, 214, 204], 4, 0.02), size: [2, 2] },
	lightPanel: { w: 32, h: 16, paint: lightPanel },
	door: { w: 32, h: 64, paint: door },
	brick: { w: 64, h: 64, paint: brick },
	chainlink: { w: 32, h: 32, paint: chainlink, alpha: true },
	grain: { w: 32, h: 32, paint: grain },
	wood: { w: 32, h: 32, paint: wood },
	fabric: { w: 32, h: 32, paint: fabric },
	paper: { w: 32, h: 40, paint: paper },
	sticky: { w: 24, h: 24, paint: sticky },
	water: { w: 64, h: 64, paint: water },
	hazard: { w: 32, h: 16, paint: hazard },
	cardboard: { w: 32, h: 32, paint: cardboard },
	skin: { w: 32, h: 32, paint: skin },
};

const cache = new Map<string, THREE.Texture>();

function finish(canvas: HTMLCanvasElement): THREE.CanvasTexture {
	const t = new THREE.CanvasTexture(canvas);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.magFilter = THREE.NearestFilter;
	t.minFilter = THREE.NearestMipmapNearestFilter;
	t.colorSpace = THREE.NoColorSpace;
	t.generateMipmaps = true;
	return t;
}

export function texture(id: string): THREE.Texture {
	const hit = cache.get(id);
	if (hit) return hit;
	const spec = SPECS[id];
	if (!spec) throw new Error(`No texture "${id}"`);
	const c = document.createElement('canvas');
	c.width = spec.w;
	c.height = spec.h;
	const g = c.getContext('2d', { willReadFrequently: true })!;
	let seed = 0;
	for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
	spec.paint(g, spec.w, spec.h, rng(seed));
	const t = finish(c);
	cache.set(id, t);
	return t;
}

/** World size of one repeat of a level texture, in meters. */
export function textureSize(id: string): [number, number] {
	return SPECS[id]?.size ?? [2, 2];
}

export type SignColor = 'green' | 'red' | 'white' | 'yellow';

const SIGN_COLORS: Record<SignColor, { bg: string; fg: string; edge: string }> = {
	green: { bg: '#0b2a14', fg: '#5dff9a', edge: '#1f6a36' },
	red: { bg: '#2a0b0b', fg: '#ff5a4a', edge: '#6a1f1f' },
	white: { bg: '#e8e6dc', fg: '#22221e', edge: '#8a887e' },
	yellow: { bg: '#e8c432', fg: '#1a1a12', edge: '#1a1a12' },
};

/** A small sign plate with text, painted at a low size. */
export function signTexture(text: string, color: SignColor): THREE.Texture {
	const key = `sign:${color}:${text}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const c = document.createElement('canvas');
	const h = 16;
	const w = Math.max(32, Math.ceil((text.length * 7 + 10) / 8) * 8);
	c.width = w;
	c.height = h;
	const g = c.getContext('2d')!;
	const col = SIGN_COLORS[color];
	g.fillStyle = col.bg;
	g.fillRect(0, 0, w, h);
	g.fillStyle = col.edge;
	g.fillRect(0, 0, w, 1);
	g.fillRect(0, h - 1, w, 1);
	g.fillRect(0, 0, 1, h);
	g.fillRect(w - 1, 0, 1, h);
	if (color === 'yellow') {
		g.fillStyle = '#1a1a12';
		g.fillRect(2, 2, 3, h - 4);
		g.fillRect(w - 5, 2, 3, h - 4);
	}
	g.fillStyle = col.fg;
	g.font = 'bold 11px monospace';
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillText(text, w / 2, h / 2 + 1);
	const t = finish(c);
	t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
	t.generateMipmaps = false;
	t.minFilter = THREE.NearestFilter;
	cache.set(key, t);
	return t;
}

/** Width over height of a sign texture. */
export function signAspect(t: THREE.Texture): number {
	const img = t.image as HTMLCanvasElement;
	return img.width / img.height;
}
