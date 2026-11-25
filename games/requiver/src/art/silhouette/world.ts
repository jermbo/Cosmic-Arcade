// The sky, the sun going down, far hills, and the black land in front.

import { WORLD } from '../../rules/data/balance.ts';
import { k } from '../../game/k.ts';
import type { SkyView } from '../types.ts';
import { col, dot, fan, hash, hex, mix, noise1, ridge, stroke, v } from './draw.ts';
import { INK, PALETTES } from './palette.ts';

const HORIZON = 446;

export function skyColors(act: number, dusk: number) {
	const p = PALETTES[act] ?? PALETTES[0];
	return p.early.map((c, i) => mix(c, p.late[i], dusk));
}

export function sunPos(dusk: number) {
	return { x: 650, y: 210 + dusk * 236, r: 58 + dusk * 8 };
}

export function drawSky(sv: SkyView) {
	const p = PALETTES[sv.act] ?? PALETTES[0];
	const c = skyColors(sv.act, sv.dusk);
	const { x, y, w, h } = sv.view;
	const left = x - 2;
	const width = w + 4;
	const bands = [y - 2, 150, 320, HORIZON];
	if (bands[0] > bands[1]) bands[0] = bands[1] - 1;
	for (let i = 0; i < 3; i++) {
		k.drawRect({ pos: v(left, bands[i]), width, height: bands[i + 1] - bands[i] + 1, gradient: [c[i], c[i + 1]] });
	}
	k.drawRect({ pos: v(left, HORIZON), width, height: y + h - HORIZON + 2, color: c[3] });

	// Stars come out as the sun goes down.
	const stars = Math.max(0, (sv.dusk - 0.45) * 1.8);
	if (stars > 0) {
		for (let i = 0; i < 70; i++) {
			const sx = left + hash(i * 3.1) * width;
			const sy = y + hash(i * 7.7) * 260;
			const tw = 0.6 + 0.4 * Math.sin(sv.time * (1 + hash(i) * 2) + i);
			dot(sx, sy, 0.7 + hash(i * 1.3) * 1.2, col('#fff6e6'), stars * tw * (1 - (sy - y) / 300));
		}
	}

	// The sun and its glow.
	const sun = sunPos(sv.dusk);
	for (const [r, o] of [
		[sun.r * 3.4, 0.07],
		[sun.r * 2.3, 0.1],
		[sun.r * 1.5, 0.16],
	] as const) {
		k.drawCircle({ pos: v(sun.x, sun.y), radius: r, color: col(p.sun), opacity: o });
	}
	k.drawCircle({ pos: v(sun.x, sun.y), radius: sun.r, color: col(p.sun) });

	// Long clouds lit from below.
	for (let i = 0; i < 7; i++) {
		const cy = 70 + hash(i * 5.3 + sv.act) * 260;
		const cw = 140 + hash(i * 2.1) * 260;
		const speed = 3 + hash(i * 9.1) * 5;
		const span = width + cw + 200;
		const cx = left - cw - 100 + ((hash(i * 4.4) * span + sv.time * speed) % span);
		const ch = 7 + hash(i * 6.6) * 9;
		const shade = mix(INK, c[1], 0.55 + hash(i) * 0.3);
		k.drawRect({ pos: v(cx, cy), width: cw, height: ch, radius: ch / 2, color: shade, opacity: 0.55 });
		k.drawRect({ pos: v(cx + cw * 0.12, cy + ch - 2.5), width: cw * 0.7, height: 2.5, radius: 1.2, color: col(p.sun), opacity: 0.35 + (1 - sv.dusk) * 0.25 });
	}

	// A few far birds.
	for (let i = 0; i < 4; i++) {
		const span = width + 200;
		const bx = left - 100 + ((hash(i * 13.3 + sv.seed) * span + sv.time * (14 + i * 3)) % span);
		const by = 120 + hash(i * 3.9 + sv.seed) * 140 + Math.sin(sv.time * 0.7 + i) * 6;
		const flap = Math.sin(sv.time * 6 + i * 2) * 3;
		stroke(
			[
				[bx - 6, by - flap],
				[bx, by + 1],
				[bx + 6, by - flap],
			],
			1.6,
			col(INK),
			0.55,
		);
	}

	drawHills(sv, hex(c[3]));
	if (sv.dim > 0) k.drawRect({ pos: v(left, y - 2), width, height: h + 4, color: col(INK), opacity: sv.dim * 0.55 });
}

function drawHills(sv: SkyView, horizon: string) {
	const p = PALETTES[sv.act] ?? PALETTES[0];
	const { x, w } = sv.view;
	const from = x - 40;
	const to = x + w + 40;
	const far: [number, number][] = [];
	const mid: [number, number][] = [];
	for (let px = from; px <= to; px += 8) {
		const n = px / 140;
		let fy: number;
		let my: number;
		if (sv.act === 2) {
			// Sharp peaks.
			fy = 330 + Math.abs(noise1(n * 0.9, 3)) * -90 + noise1(n * 3, 5) * 10 + 60;
			my = 456 - Math.abs(noise1(n * 1.6 + 4, 7)) * 14 + noise1(n * 5, 2) * 3;
		} else if (sv.act === 1) {
			// Flat marsh with a far tree line.
			fy = 414 + noise1(n * 0.8, 3) * 10 - Math.max(0, noise1(n * 6, 9)) * 14;
			my = 456 + noise1(n * 1.3, 6) * 4 - Math.max(0, noise1(n * 9, 4)) * 6;
		} else {
			// Rolling fields.
			fy = 400 + noise1(n * 0.7, 3) * 22;
			my = 454 + noise1(n * 1.1 + 2, 6) * 6;
		}
		far.push([px, fy]);
		mid.push([px, my]);
	}
	// Hazy and light, so ink figures stand out against them.
	ridge(far, HORIZON + 40, mix(p.far, horizon, 0.62), 1, mix(p.far, horizon, 0.4));
	ridge(mid, WORLD.groundY + 10, mix(p.mid, horizon, 0.3), 1, col(p.mid));
	// Marsh water catches the sky.
	if (sv.act === 1) {
		for (let i = 0; i < 6; i++) {
			const wx = from + hash(i * 2.7) * (to - from);
			k.drawRect({ pos: v(wx, 452 + hash(i) * 10), width: 40 + hash(i * 3) * 80, height: 2, color: col(p.sun), opacity: 0.3 });
		}
	}
}

/** The ink foreground: ground line with grass, props, and the archer's rock. */
export function drawLand(sv: SkyView) {
	const { x, y, w, h } = sv.view;
	const ink = col(INK);
	const from = x - 20;
	const to = x + w + 20;
	const top: [number, number][] = [];
	for (let px = from; px <= to; px += 5) {
		const tuft = Math.max(0, noise1(px / 9, 11)) * 5 + Math.max(0, noise1(px / 31, 4)) * 3;
		top.push([px, WORLD.groundY - tuft]);
	}
	ridge(top, y + h + 4, ink);
	// The archer's rock.
	fan(
		[
			[18, WORLD.groundY + 2],
			[34, WORLD.groundY - 12],
			[70, WORLD.groundY - 16],
			[124, WORLD.groundY - 10],
			[146, WORLD.groundY + 2],
		],
		ink,
	);
	// Props, seeded per fight. Kept away from the lane in front of the archer.
	for (let i = 0; i < 14; i++) {
		const px = from + hash(i * 17.3 + sv.seed) * (to - from);
		// In the lane only low props, so nothing looks like a foe.
		const lane = px > 150 && px < 940;
		if (lane && hash(i * 2.2 + sv.seed) < 0.5) continue;
		prop(sv.act, px, i + sv.seed, sv.time, lane);
	}
}

function prop(act: number, px: number, seed: number, time: number, low: boolean) {
	const ink = col(INK);
	const g = WORLD.groundY;
	const r = low ? hash(seed * 1.7) * 0.5 : hash(seed * 1.7);
	const sway = Math.sin(time * 1.3 + seed) * 1.5;
	if (act === 0) {
		if (r < 0.5) {
			// Wheat.
			for (let j = 0; j < 5; j++) {
				const sx = px + j * 3 - 6;
				const hh = 16 + hash(seed + j) * 12;
				stroke(
					[
						[sx, g],
						[sx + sway, g - hh],
					],
					1.4,
					ink,
				);
				k.drawEllipse({ pos: v(sx + sway, g - hh - 3), radiusX: 1.8, radiusY: 4.5, color: ink });
			}
		} else if (r < 0.8) {
			// Fence post.
			stroke(
				[
					[px, g],
					[px + 1, g - 26],
				],
				4,
				ink,
			);
			stroke(
				[
					[px - 14, g - 18],
					[px + 16, g - 15],
				],
				2.4,
				ink,
			);
		} else {
			// Dead tree.
			stroke(
				[
					[px, g],
					[px - 3, g - 50],
					[px + 6, g - 76],
				],
				6,
				ink,
			);
			stroke(
				[
					[px - 2, g - 44],
					[px - 22, g - 64],
				],
				3,
				ink,
			);
			stroke(
				[
					[px + 3, g - 62],
					[px + 22, g - 74],
				],
				2.4,
				ink,
			);
		}
	} else if (act === 1) {
		// Reeds and cattails.
		for (let j = 0; j < 4; j++) {
			const sx = px + j * 4 - 6;
			const hh = (low ? 12 : 22) + hash(seed + j) * (low ? 8 : 20);
			const bend = sway + (j - 1.5) * 2;
			stroke(
				[
					[sx, g],
					[sx + bend * 0.5, g - hh * 0.6],
					[sx + bend, g - hh],
				],
				1.6,
				ink,
			);
			if (j % 2 === 0) k.drawEllipse({ pos: v(sx + bend * 0.75, g - hh * 0.78), radiusX: 2.4, radiusY: 6, color: ink });
		}
	} else {
		if (r < 0.55 && !low) {
			// Pine.
			const hh = 50 + hash(seed) * 40;
			for (let j = 0; j < 4; j++) {
				const ty = g - hh * (0.25 + j * 0.22);
				const tw = (4 - j) * 7;
				fan(
					[
						[px - tw, ty + 12],
						[px, ty - 14],
						[px + tw, ty + 12],
					],
					ink,
				);
			}
			stroke(
				[
					[px, g],
					[px, g - hh * 0.3],
				],
				4,
				ink,
			);
		} else {
			// Rock.
			fan(
				[
					[px - 18, g + 1],
					[px - 10, g - 14],
					[px + 4, g - 20],
					[px + 16, g - 8],
					[px + 20, g + 1],
				],
				ink,
			);
		}
	}
}
