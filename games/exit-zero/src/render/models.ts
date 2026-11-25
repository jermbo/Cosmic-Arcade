import type { Builder, Look } from './builder.ts';
import { signTexture } from './textures.ts';

// Low-poly props, drawn at the local origin facing -z (north). Callers place them with Builder.push.

export interface ModelOpts {
	/** Ceiling height of the room. */
	height: number;
	[key: string]: unknown;
}

export interface Model {
	draw(b: Builder, o: ModelOpts): void;
	/** Footprint for collisions, [width, depth] in meters. */
	size?: [number, number];
}

type RGB = [number, number, number];
const flat = (color: RGB): Look => ({ tex: 'grain', color });
const BEIGE: RGB = [0.82, 0.78, 0.66];
const GREY: RGB = [0.55, 0.56, 0.56];
const DARK: RGB = [0.22, 0.22, 0.24];
const FABRIC: RGB = [0.42, 0.5, 0.62];

function chair(b: Builder) {
	b.box({ tex: 'fabric', color: FABRIC }, 0.46, 0.08, 0.46, 0, 0.42, 0);
	b.box({ tex: 'fabric', color: FABRIC }, 0.44, 0.48, 0.07, 0, 0.55, 0.22);
	b.cyl(flat(DARK), 0.03, 0.4, 5, 0, 0.03, 0);
	b.box(flat(DARK), 0.56, 0.04, 0.06, 0, 0.0, 0);
	b.box(flat(DARK), 0.06, 0.04, 0.56, 0, 0.0, 0);
}

function shelfUnit(b: Builder, w: number, h: number, d: number, color: RGB, boxes: boolean) {
	for (const [x, z] of [[-w / 2 + 0.03, -d / 2 + 0.03], [w / 2 - 0.03, -d / 2 + 0.03], [-w / 2 + 0.03, d / 2 - 0.03], [w / 2 - 0.03, d / 2 - 0.03]]) {
		b.box(flat(color), 0.05, h, 0.05, x, 0, z);
	}
	for (let i = 0; i < 4; i++) {
		const y = 0.12 + i * ((h - 0.2) / 3);
		b.box(flat(color), w, 0.03, d, 0, y, 0);
		if (boxes && i < 3) {
			b.box({ tex: 'cardboard' }, 0.34, 0.26, 0.3, -w / 4, y + 0.03, 0.02, 0.1 * i);
			if (i !== 1) b.box({ tex: 'cardboard', color: [0.85, 0.85, 0.85] }, 0.26, 0.2, 0.28, w / 4, y + 0.03, 0);
		}
	}
}

export const MODELS: Record<string, Model> = {
	desk: {
		size: [1.4, 0.7],
		draw(b) {
			b.box({ tex: 'wood', color: [0.9, 0.85, 0.75] }, 1.4, 0.04, 0.7, 0, 0.72, 0);
			b.box(flat(GREY), 0.04, 0.72, 0.66, -0.66, 0, 0);
			b.box(flat(GREY), 0.04, 0.72, 0.66, 0.66, 0, 0);
			b.box(flat(GREY), 1.3, 0.45, 0.03, 0, 0.27, 0.3);
			b.box(flat(BEIGE), 0.4, 0.5, 0.6, 0.42, 0.22, 0);
			// a dead CRT monitor and a keyboard
			b.box(flat([0.78, 0.76, 0.68]), 0.4, 0.34, 0.36, -0.25, 0.76, 0.1);
			b.box({ tex: null, color: [0.08, 0.1, 0.09] }, 0.32, 0.25, 0.01, -0.25, 0.8, -0.085);
			b.box(flat([0.78, 0.76, 0.68]), 0.42, 0.03, 0.14, -0.2, 0.76, -0.2);
		},
	},
	deskSign: {
		draw(b) {
			b.box(flat(DARK), 0.26, 0.02, 0.06, 0, 0, 0);
			b.push(0, 0.05, 0, 0, -0.3);
			b.plate({ tex: signTexture('DESK 4', 'white') }, 0.26, 0.07, 0, 0, -0.01);
			b.pop();
		},
	},
	chair: { draw: chair },
	chairTipped: {
		draw(b) {
			b.push(0, 0.28, 0, 0, 0, Math.PI / 2);
			chair(b);
			b.pop();
		},
	},
	cooler: {
		size: [0.4, 0.4],
		draw(b) {
			b.box(flat([0.9, 0.88, 0.82]), 0.34, 0.92, 0.34, 0, 0, 0);
			b.box(flat([0.2, 0.3, 0.5]), 0.06, 0.06, 0.02, -0.07, 0.72, -0.18);
			b.box(flat([0.6, 0.2, 0.2]), 0.06, 0.06, 0.02, 0.07, 0.72, -0.18);
			b.cyl({ tex: 'grain', color: [0.5, 0.72, 0.95] }, 0.15, 0.46, 8, 0, 0.92, 0);
			b.cyl({ tex: 'grain', color: [0.5, 0.72, 0.95] }, 0.06, 0.08, 6, 0, 1.38, 0);
		},
	},
	cabinet: {
		size: [0.5, 0.62],
		draw(b) {
			b.box(flat([0.66, 0.64, 0.56]), 0.5, 1.32, 0.62, 0, 0, 0);
			for (let i = 0; i < 4; i++) {
				b.box(flat([0.5, 0.48, 0.42]), 0.44, 0.02, 0.01, 0, 0.32 * i + 0.3, -0.315);
				b.box(flat([0.85, 0.85, 0.8]), 0.12, 0.03, 0.03, 0, 0.32 * i + 0.2, -0.32);
			}
		},
	},
	shelf: {
		size: [1.0, 0.45],
		draw(b) {
			shelfUnit(b, 1.0, 1.8, 0.45, [0.5, 0.55, 0.56], true);
		},
	},
	lockers: {
		size: [1.2, 0.5],
		draw(b) {
			for (let i = 0; i < 3; i++) {
				const x = -0.4 + i * 0.4;
				b.box(flat([0.42, 0.52, 0.48]), 0.38, 1.9, 0.5, x, 0, 0);
				for (let k = 0; k < 4; k++) b.box({ tex: null, color: [0.1, 0.12, 0.12] }, 0.2, 0.015, 0.01, x, 1.55 + k * 0.05, -0.255);
				b.box(flat([0.8, 0.8, 0.75]), 0.03, 0.12, 0.03, x + 0.12, 1.0, -0.26);
			}
		},
	},
	workbench: {
		size: [1.8, 0.7],
		draw(b) {
			b.box({ tex: 'wood', color: [0.6, 0.5, 0.4] }, 1.8, 0.06, 0.7, 0, 0.84, 0);
			for (const x of [-0.85, 0.85]) for (const z of [-0.3, 0.3]) b.box(flat(DARK), 0.06, 0.84, 0.06, x, 0, z);
			b.box(flat(DARK), 1.7, 0.03, 0.6, 0, 0.25, 0);
			b.box({ tex: 'cardboard', color: [0.8, 0.7, 0.6] }, 1.7, 0.9, 0.03, 0, 1.0, 0.34);
			// hooks and outlines of tools on the pegboard
			for (let i = 0; i < 6; i++) b.box({ tex: null, color: [0.15, 0.12, 0.1] }, 0.03, 0.18 + (i % 3) * 0.08, 0.01, -0.7 + i * 0.28, 1.4, 0.32);
			b.box(flat([0.85, 0.75, 0.2]), 0.18, 0.12, 0.12, -0.6, 0.9, 0.1);
		},
	},
	partition: {
		size: [1.6, 0.1],
		draw(b) {
			b.box({ tex: 'fabric', color: [0.55, 0.6, 0.66] }, 1.6, 1.4, 0.07, 0, 0, 0);
			b.box(flat(GREY), 1.64, 0.04, 0.09, 0, 1.4, 0);
		},
	},
	plant: {
		draw(b) {
			b.cyl(flat([0.55, 0.35, 0.22]), 0.16, 0.32, 6, 0, 0, 0);
			for (let i = 0; i < 7; i++) {
				const a = (i / 7) * Math.PI * 2;
				b.push(Math.cos(a) * 0.05, 0.3, Math.sin(a) * 0.05, a, 0.5 + (i % 3) * 0.15);
				b.box(flat([0.32, 0.5, 0.26]), 0.08, 0.6 + (i % 2) * 0.2, 0.015, 0, 0, 0);
				b.pop();
			}
		},
	},
	boxes: {
		size: [0.7, 0.6],
		draw(b) {
			b.box({ tex: 'cardboard' }, 0.6, 0.45, 0.5, 0, 0, 0);
			b.box({ tex: 'cardboard', color: [0.9, 0.9, 0.9] }, 0.5, 0.4, 0.45, 0.03, 0.45, 0, 0.3);
			b.box({ tex: 'cardboard' }, 0.35, 0.3, 0.3, -0.05, 0.85, 0, -0.2);
		},
	},
	barrel: {
		size: [0.62, 0.62],
		draw(b) {
			b.cyl(flat([0.24, 0.38, 0.58]), 0.3, 0.92, 8, 0, 0, 0);
			for (const y of [0.2, 0.7]) b.cyl(flat([0.18, 0.28, 0.42]), 0.31, 0.04, 8, 0, y, 0, 0, 0, false);
		},
	},
	barrelTipped: {
		draw(b) {
			b.cyl(flat([0.58, 0.32, 0.18]), 0.3, 0.92, 8, -0.46, 0.3, 0, 0, -Math.PI / 2);
		},
	},
	bucket: {
		draw(b) {
			b.cyl(flat([0.85, 0.7, 0.15]), 0.2, 0.32, 6, 0, 0, 0);
			b.box(flat(DARK), 0.04, 1.2, 0.04, 0.08, 0.2, 0.05, 0);
			b.box(flat([0.75, 0.72, 0.65]), 0.22, 0.12, 0.08, 0.08, 0.2, 0.05);
		},
	},
	mop: {
		draw(b) {
			b.push(0, 0.05, 0, 0, 0, Math.PI / 2 - 0.08);
			b.box(flat([0.2, 0.17, 0.14]), 0.03, 1.3, 0.03, 0, 0, 0);
			b.pop();
			b.box(flat([0.18, 0.16, 0.14]), 0.32, 0.08, 0.24, 0.05, 0, 0);
		},
	},
	wetFloor: {
		draw(b) {
			const t = signTexture('CAUTION', 'yellow');
			b.push(0, 0, -0.1, 0, -0.3);
			b.plate({ tex: t, doubleSide: true }, 0.34, 0.62, 0, 0.32, 0);
			b.pop();
			b.push(0, 0, 0.1, Math.PI, -0.3);
			b.plate({ tex: t, doubleSide: true }, 0.34, 0.62, 0, 0.32, 0);
			b.pop();
		},
	},
	pump: {
		size: [1.0, 0.8],
		draw(b) {
			b.box(flat([0.3, 0.5, 0.36]), 1.0, 0.7, 0.8, 0, 0, 0);
			b.cyl(flat([0.25, 0.42, 0.3]), 0.28, 0.7, 8, 0, 0.7, 0);
			b.box({ tex: 'hazard' }, 1.02, 0.08, 0.82, 0, 0.62, 0);
			b.cyl(flat(GREY), 0.12, 1.6, 6, 0.3, 1.0, 0.0);
		},
	},
	valve: {
		draw(b) {
			for (let i = 0; i < 8; i++) {
				const a = (i / 8) * Math.PI * 2;
				b.box(flat([0.75, 0.18, 0.14]), 0.12, 0.04, 0.04, Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0, 0);
			}
			b.box(flat([0.75, 0.18, 0.14]), 0.36, 0.03, 0.03, 0, 0, 0);
			b.box(flat([0.75, 0.18, 0.14]), 0.03, 0.03, 0.36, 0, 0, 0);
		},
	},
	ceilingHole: {
		draw(b, o) {
			const h = o.height;
			b.push(0, h - 0.005, 0, 0, Math.PI / 2);
			b.plate({ tex: null, color: [0, 0, 0], emissive: true }, 1.25, 1.1, 0, 0, 0);
			b.pop();
			// hanging tile pieces and a dangling wire
			for (const [x, z, a] of [[-0.55, 0.1, 0.6], [0.5, -0.4, -0.8], [0.1, 0.55, 1.1]] as const) {
				b.push(x, h - 0.02, z, a, 0.9);
				b.box({ tex: 'ceilingTile' }, 0.3, 0.02, 0.22, 0, -0.22, 0);
				b.pop();
			}
			b.box(flat(DARK), 0.015, 0.7, 0.015, 0.2, h - 0.7, -0.1);
		},
	},
	debris: {
		draw(b) {
			b.box({ tex: 'ceilingTile' }, 0.34, 0.02, 0.28, 0, 0, 0, 0.3);
			b.box({ tex: 'ceilingTile' }, 0.22, 0.02, 0.18, 0.26, 0, 0.15, 1.2);
			b.box({ tex: 'ceilingTile' }, 0.12, 0.02, 0.1, -0.2, 0, 0.22, 2.0);
		},
	},
	pipeRun: {
		draw() {
			// drawn by the decor component, which knows both ends
		},
	},
	steam: { draw() {} },
};

// --- pickups: small, readable things the player picks up ---

export const PICKUPS: Record<string, (b: Builder) => void> = {
	key(b) {
		const brass: Look = { tex: 'grain', color: [1.0, 0.82, 0.32] };
		b.cyl(brass, 0.04, 0.012, 8, 0, 0, 0);
		b.box(brass, 0.016, 0.012, 0.12, 0, 0, 0.1);
		b.box(brass, 0.014, 0.012, 0.025, 0.014, 0, 0.13);
		b.box(brass, 0.014, 0.012, 0.025, 0.014, 0, 0.1);
		b.box({ tex: 'paper' }, 0.06, 0.004, 0.09, -0.07, 0, -0.04, 0.4);
	},
	wrench(b) {
		const red: Look = { tex: 'grain', color: [0.9, 0.2, 0.15] };
		const steel: Look = { tex: 'grain', color: [0.78, 0.8, 0.82] };
		b.box(red, 0.05, 0.03, 0.34, 0, 0, 0.05);
		b.box(steel, 0.06, 0.04, 0.12, 0, 0, -0.18);
		b.box(steel, 0.11, 0.04, 0.03, 0.02, 0, -0.25);
		b.box(steel, 0.03, 0.04, 0.06, 0.06, 0, -0.22);
	},
	fuse(b) {
		b.cyl({ tex: 'grain', color: [0.78, 0.92, 0.9] }, 0.025, 0.1, 8, 0, 0, 0, 0, Math.PI / 2);
		b.cyl({ tex: 'grain', color: [0.95, 0.55, 0.25] }, 0.03, 0.025, 8, 0.0, 0, 0, 0, Math.PI / 2);
		b.cyl({ tex: 'grain', color: [0.95, 0.55, 0.25] }, 0.03, 0.025, 8, -0.075, 0, 0, 0, Math.PI / 2);
	},
	note(b) {
		b.box({ tex: 'paper' }, 0.2, 0.004, 0.26, 0, 0, 0);
	},
	memo(b) {
		b.box({ tex: 'paper', color: [1, 1, 0.95] }, 0.22, 0.004, 0.28, 0, 0, 0);
	},
	sticky(b) {
		b.box({ tex: 'sticky' }, 0.08, 0.003, 0.08, 0, 0, 0);
	},
	map(b) {
		b.box({ tex: 'paper', color: [0.9, 0.92, 1.0] }, 0.26, 0.006, 0.2, 0, 0, 0);
		b.box({ tex: null, color: [0.3, 0.3, 0.7] }, 0.12, 0.008, 0.01, -0.02, 0, 0.03);
		b.box({ tex: null, color: [0.3, 0.3, 0.7] }, 0.01, 0.008, 0.1, 0.04, 0, -0.02);
	},
};
