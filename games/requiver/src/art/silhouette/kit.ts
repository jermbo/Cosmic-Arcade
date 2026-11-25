// The silhouette ArtKit: ink figures on sunset skies. Everything the game draws goes through here.

import { WORLD } from '../../rules/data/balance.ts';
import { BOSSES } from '../../rules/data/bosses.ts';
import { k } from '../../game/k.ts';
import type { ArrowView, ArtKit, AimView, DefenseView, DragView, MapView, ParticleStyle, PieceView, ProjectileView } from '../types.ts';
import { drawArcher, drawBoss, drawCorpse, drawFoe } from './actors.ts';
import { col, dot, fan, hex, mix, stroke, v } from './draw.ts';
import { iconSvg, iconUrl, ICONS } from './icons.ts';
import { INK, PALETTES, PAPER } from './palette.ts';
import { drawLand, drawSky } from './world.ts';

type P = [number, number];
const pal = (act: number) => PALETTES[act] ?? PALETTES[0];

function drawArrow(a: ArrowView) {
	const p = pal(a.act);
	const ink = col(INK);
	const accent = col(p.accent);
	const dx = Math.cos(a.angle);
	const dy = Math.sin(a.angle);
	const len = 34 * a.length;
	const tip: P = [a.x, a.y];
	const tail: P = [a.x - dx * len, a.y - dy * len];
	const o = a.opacity;

	// Trail.
	if (a.trail.length > 1) {
		const crown = a.kind === 'crown';
		for (let i = 1; i < a.trail.length; i++) {
			const t = i / a.trail.length;
			const seg: P[] = [
				[a.trail[i - 1].x, a.trail[i - 1].y],
				[a.trail[i].x, a.trail[i].y],
			];
			stroke(seg, crown ? 8 * t : 2.2 * t, crown ? accent : col(PAPER), (crown ? 0.8 : 0.45) * t * o);
		}
	}
	if (a.kind === 'crown') {
		k.drawCircle({ pos: v(a.x, a.y), radius: 14, color: accent, opacity: 0.35 * o });
	}
	stroke([tail, tip], a.kind === 'crown' ? 3.4 : 2.3, ink, o);
	const px = -dy;
	const py = dx;
	fan(
		[
			[tip[0] + dx * 8, tip[1] + dy * 8],
			[tip[0] + px * 3.6, tip[1] + py * 3.6],
			[tip[0] - px * 3.6, tip[1] - py * 3.6],
		],
		ink,
		o,
	);
	if (a.length > 0.6) {
		const fl = a.kind === 'helper' ? col(PAPER) : accent;
		fan(
			[
				[tail[0] + dx * 9, tail[1] + dy * 9],
				[tail[0] - dx * 1 + px * 4.4, tail[1] - dy * 1 + py * 4.4],
				[tail[0] + dx * 2, tail[1] + dy * 2],
			],
			fl,
			o,
		);
		fan(
			[
				[tail[0] + dx * 9, tail[1] + dy * 9],
				[tail[0] - dx * 1 - px * 4.4, tail[1] - dy * 1 - py * 4.4],
				[tail[0] + dx * 2, tail[1] + dy * 2],
			],
			fl,
			o,
		);
	}
	if (a.kind === 'stuck') return;
	if (a.fire) {
		const flick = 0.7 + 0.3 * Math.sin(a.x * 0.3);
		dot(tip[0], tip[1], 5 * flick, col('#ffb347'), 0.8 * o);
		dot(tip[0], tip[1], 2.6, col('#fff0bd'), o);
	}
	if (a.ice) dot(tip[0] - dx * 3, tip[1] - dy * 3, 3.4, col('#bdefff'), o);
	if (a.explosive) dot(tip[0] - dx * 5, tip[1] - dy * 5, 4, ink, o);
}

function drawProjectile(pv: ProjectileView) {
	const p = pal(pv.act);
	const ink = col(INK);
	// A soft warning halo, so threats read against busy skies.
	k.drawCircle({ pos: v(pv.x, pv.y), radius: pv.radius * 2.2, color: col(p.accent), opacity: 0.22 + 0.1 * Math.sin(pv.time * 12) });
	if (pv.kind === 'rock' || pv.kind === 'boulder') {
		const r = pv.radius;
		const pts: P[] = [];
		for (let i = 0; i < 7; i++) {
			const a = pv.angle + (i / 7) * Math.PI * 2;
			const rr = r * (0.8 + ((i * 37) % 5) * 0.08);
			pts.push([pv.x + Math.cos(a) * rr, pv.y + Math.sin(a) * rr]);
		}
		fan(pts, ink);
		if (pv.kind === 'boulder') {
			stroke(
				[
					[pv.x - r * 0.4, pv.y - r * 0.2],
					[pv.x + r * 0.3, pv.y + r * 0.3],
				],
				2,
				mix(p.far, '#ffffff', 0.3),
			);
		}
		return;
	}
	const dx = Math.cos(pv.angle);
	const dy = Math.sin(pv.angle);
	if (pv.kind === 'feather') {
		const len = 18;
		const pts: P[] = [
			[pv.x + dx * len * 0.5, pv.y + dy * len * 0.5],
			[pv.x - dy * 5, pv.y + dx * 5],
			[pv.x - dx * len * 0.5, pv.y - dy * len * 0.5],
			[pv.x + dy * 5, pv.y - dx * 5],
		];
		fan(pts, ink);
		stroke([pts[0], pts[2]], 1.2, mix(p.far, '#ffffff', 0.4));
		return;
	}
	// Spear or enemy arrow.
	const len = pv.kind === 'spear' ? 46 : 30;
	stroke(
		[
			[pv.x - dx * len, pv.y - dy * len],
			[pv.x, pv.y],
		],
		2.6,
		ink,
	);
	fan(
		[
			[pv.x + dx * 9, pv.y + dy * 9],
			[pv.x - dy * 4, pv.y + dx * 4],
			[pv.x + dy * 4, pv.y - dx * 4],
		],
		ink,
	);
}

function drawPiece(pv: PieceView) {
	const ink = col(INK);
	const sheenC = mix(pal(pv.act).far, '#ffffff', 0.45);
	k.pushTransform();
	k.pushTranslate(pv.x, pv.y);
	k.pushRotate((pv.angle * 180) / Math.PI);
	const r = pv.r;
	if (pv.kind === 'head') dot(0, 0, r, ink, pv.opacity);
	else if (pv.kind === 'helmet') {
		fan(
			[
				[-r * 1.2, r * 0.3],
				[-r, -r * 0.7],
				[0, -r * 1.2],
				[r, -r * 0.7],
				[r * 1.2, r * 0.3],
			],
			ink,
			pv.opacity,
		);
		stroke(
			[
				[-r * 0.7, -r * 0.6],
				[-r * 0.1, -r * 0.95],
			],
			1.6,
			sheenC,
			pv.opacity,
		);
	} else if (pv.kind === 'plate') {
		fan(
			[
				[-r, -r * 1.2],
				[r, -r * 1.2],
				[r * 0.7, r * 1.2],
				[-r * 0.7, r * 1.2],
			],
			ink,
			pv.opacity,
		);
		stroke(
			[
				[-r * 0.6, -r * 0.8],
				[-r * 0.4, r * 0.6],
			],
			1.6,
			sheenC,
			pv.opacity,
		);
	} else {
		fan(
			[
				[-r * 0.3, -r * 3],
				[r * 0.3, -r * 3],
				[r * 0.3, r * 3],
				[-r * 0.3, r * 3],
			],
			ink,
			pv.opacity,
		);
	}
	k.popTransform();
}

function drawDrag(d: DragView) {
	const p = pal(d.act);
	const ink = col(INK);
	stroke(
		[
			[d.from.x, d.from.y],
			[d.to.x, d.to.y],
		],
		3,
		ink,
		0.45,
	);
	k.drawCircle({ pos: v(d.from.x, d.from.y), radius: 13, fill: false, outline: { width: 3, color: ink }, opacity: 0.6 });
	dot(d.to.x, d.to.y, 9 + d.pull * 5, col(p.accent), 0.85);
	k.drawCircle({ pos: v(d.to.x, d.to.y), radius: 9 + d.pull * 5, fill: false, outline: { width: 3, color: ink }, opacity: 0.9 });
}

function drawAim(a: AimView) {
	const p = pal(a.act);
	const n = a.points.length;
	if (!n) return;
	const accent = col(p.accent);
	const fill = a.bonus ? accent : col(PAPER);
	for (let i = 0; i < n; i++) {
		const t = 1 - i / Math.max(1, n);
		const r = 2.2 + 2.6 * t;
		const o = (a.ghost ? 0.35 : 1) * (0.35 + 0.65 * t);
		dot(a.points[i].x, a.points[i].y, r + 1.8, col(INK), o);
		dot(a.points[i].x, a.points[i].y, r, fill, o);
	}
	// A crown shot flies straight: show a ruled line.
	if (a.bonus === 'crown' && n > 1) {
		const last = a.points[n - 1];
		stroke(
			[
				[a.points[0].x, a.points[0].y],
				[last.x + (last.x - a.points[0].x) * 3, last.y + (last.y - a.points[0].y) * 3],
			],
			1.4,
			accent,
			0.5,
		);
	}
}

function drawDefenses(d: DefenseView) {
	const p = pal(d.act);
	const ink = col(INK);
	const g = WORLD.groundY;
	if (d.spikes) {
		for (let x = WORLD.spikesFrom; x < WORLD.spikesTo; x += 12) {
			const h = 7 + ((x * 13) % 4);
			fan(
				[
					[x - 5, g + 1],
					[x, g - h],
					[x + 5, g + 1],
				],
				ink,
			);
			stroke(
				[
					[x - 1, g - h + 2],
					[x, g - h],
				],
				1,
				col(p.accent),
				0.7,
			);
		}
	}
	if (d.wall) {
		const share = Math.max(0, d.wall.hp / d.wall.max);
		const x0 = WORLD.wallX - 14 + d.wall.kick;
		if (share <= 0) {
			// Broken stumps.
			for (let i = 0; i < 5; i++) {
				fan(
					[
						[x0 + i * 7, g],
						[x0 + i * 7, g - 10 - (i % 2) * 6],
						[x0 + i * 7 + 6, g - 6],
						[x0 + i * 7 + 6, g],
					],
					ink,
				);
			}
		} else {
			for (let i = 0; i < 5; i++) {
				const h = (WORLD.wallHeight - (i % 2) * 8) * (0.45 + 0.55 * share);
				const x = x0 + i * 7;
				fan(
					[
						[x, g],
						[x, g - h + 6],
						[x + 3, g - h],
						[x + 6, g - h + 6],
						[x + 6, g],
					],
					ink,
				);
			}
			stroke(
				[
					[x0 - 3, g - 22],
					[x0 + 38, g - 24],
				],
				2.4,
				ink,
			);
			stroke(
				[
					[x0 - 3, g - 48 * (0.45 + 0.55 * share)],
					[x0 + 38, g - 50 * (0.45 + 0.55 * share)],
				],
				2.4,
				ink,
			);
		}
	}
	if (d.helper) {
		drawArcher({
			x: d.helper.x,
			y: d.helper.y + 38,
			angle: d.helper.angle,
			pull: Math.max(0, 1 - d.helper.sinceShot * 2),
			sinceShot: d.helper.sinceShot,
			sinceHurt: 9,
			time: d.time + 1.3,
			act: d.act,
			bonus: null,
			dead: false,
			sinceDead: 0,
			scale: 0.72,
		});
	}
}

function drawMap(m: MapView) {
	const p = pal(m.act);
	const ink = col(INK);
	const accent = col(p.accent);
	const paper = col(PAPER);

	// The boss looms on the right horizon.
	const bossArt = BOSSES[m.boss]?.art ?? 'gatewarden';
	k.pushTransform();
	k.pushTranslate(905, 446);
	k.pushScale(0.42);
	drawBoss({ art: bossArt, x: 0, y: bossArt === 'kitequeen' ? -300 : 0, time: m.time, phase: 'idle', wind: 0, glow: 0, guard: false, enraged: false, flash: 0, kick: 0, burning: false, chilled: false, act: m.act, hpShare: 1 });
	k.popTransform();

	for (const e of m.edges) {
		const dx = e.to.x - e.from.x;
		const dy = e.to.y - e.from.y;
		const len = Math.hypot(dx, dy);
		const steps = Math.floor(len / 11);
		const walked = e.state === 'walked';
		const open = e.state === 'open';
		for (let i = 1; i < steps; i++) {
			const t = i / steps;
			const x = e.from.x + dx * t;
			const y = e.from.y + dy * t;
			if (walked) dot(x, y, 3.2, accent);
			else dot(x, y, open ? 2.8 : 2.2, ink, open ? 0.95 : 0.45);
		}
	}
	for (const n of m.nodes) {
		const r = n.boss ? 30 : 21;
		const pulse = n.state === 'open' ? 1 + 0.08 * Math.sin(m.time * 5 + n.id) : 1;
		const rr = r * pulse * (n.hover ? 1.12 : 1);
		const faded = n.state === 'locked' || n.state === 'past';
		const o = faded ? 0.5 : 1;
		// Hard offset shadow, then the disc.
		dot(n.x + 4, n.y + 4, rr, ink, o);
		if (n.state === 'open') dot(n.x, n.y, rr + 5, accent, 0.9);
		dot(n.x, n.y, rr, n.state === 'visited' || n.state === 'current' ? mix(PAPER, p.accent, 0.35) : paper, o);
		k.drawCircle({ pos: v(n.x, n.y), radius: rr, fill: false, outline: { width: 3, color: ink }, opacity: o });
		const size = rr * 1.25;
		k.drawSprite({ sprite: `icon:${n.icon}`, pos: v(n.x, n.y), width: size, height: size, anchor: 'center', opacity: o });
	}
}

/** Particle looks. The game's effects ask for a kind; the art picks the look. */
function particle(kind: string, act: number): ParticleStyle | null {
	const p = pal(act);
	const styles: Record<string, ParticleStyle> = {
		ink: { frame: 0, colors: [INK, INK], opacities: [1, 0], scales: [0.5, 0.15], speed: [120, 380], life: [0.3, 0.6], gravity: 900, damping: 1, spin: 0, count: 14, spread: 50 },
		spark: { frame: 2, colors: [p.sun, p.accent], opacities: [1, 0], scales: [0.6, 0.2], speed: [200, 520], life: [0.12, 0.3], gravity: 200, damping: 3, spin: 0, count: 10, spread: 70 },
		head: { frame: 0, colors: [p.accent, INK], opacities: [1, 0], scales: [0.55, 0.12], speed: [160, 460], life: [0.3, 0.6], gravity: 700, damping: 1, spin: 0, count: 22, spread: 70 },
		dust: { frame: 1, colors: [hex(mix(p.mid, '#ffffff', 0.2)), p.mid], opacities: [0.6, 0], scales: [0.4, 1], speed: [20, 90], life: [0.4, 0.8], gravity: -30, damping: 2, spin: 0, count: 6, spread: 80 },
		blast: { frame: 1, colors: [p.sun, p.accent, INK], opacities: [1, 0.8, 0], scales: [1.2, 2.4], speed: [60, 260], life: [0.3, 0.6], gravity: -60, damping: 3, spin: 0, count: 18, spread: 180 },
		ember: { frame: 0, colors: ['#ffd27a', '#ff6a1f'], opacities: [1, 0], scales: [0.3, 0.05], speed: [30, 90], life: [0.4, 0.8], gravity: -160, damping: 1, spin: 0, count: 3, spread: 60 },
		frost: { frame: 3, colors: ['#ffffff', '#bdefff'], opacities: [1, 0], scales: [0.4, 0.1], speed: [60, 200], life: [0.3, 0.5], gravity: 300, damping: 2, spin: 400, count: 8, spread: 120 },
		chip: { frame: 3, colors: [hex(mix(p.far, '#ffffff', 0.4)), INK], opacities: [1, 0], scales: [0.5, 0.3], speed: [150, 360], life: [0.3, 0.6], gravity: 900, damping: 1, spin: 720, count: 8, spread: 80 },
		gold: { frame: 2, colors: ['#fff0bd', p.accent], opacities: [1, 0], scales: [0.8, 0.2], speed: [160, 420], life: [0.25, 0.5], gravity: 100, damping: 2, spin: 0, count: 24, spread: 180 },
		hurt: { frame: 0, colors: ['#ff3b3b', INK], opacities: [1, 0], scales: [0.5, 0.1], speed: [100, 300], life: [0.3, 0.5], gravity: 800, damping: 1, spin: 0, count: 12, spread: 80 },
		feather: { frame: 2, colors: [INK, INK], opacities: [1, 0], scales: [0.7, 0.5], speed: [40, 140], life: [0.6, 1.1], gravity: 120, damping: 2, spin: 360, count: 6, spread: 140 },
		dissolve: { frame: 0, colors: [INK, hex(mix(INK, p.mid, 0.5))], opacities: [0.9, 0], scales: [0.35, 0.1], speed: [10, 60], life: [0.4, 0.9], gravity: -80, damping: 1, spin: 0, count: 10, spread: 180 },
	};
	return styles[kind] ?? null;
}

/** A small sheet of particle shapes: dot, soft dot, streak, shard. */
function particleSheet(): HTMLCanvasElement {
	const c = document.createElement('canvas');
	c.width = 128;
	c.height = 32;
	const g = c.getContext('2d')!;
	g.fillStyle = '#fff';
	g.beginPath();
	g.arc(16, 16, 13, 0, Math.PI * 2);
	g.fill();
	const soft = g.createRadialGradient(48, 16, 0, 48, 16, 15);
	soft.addColorStop(0, 'rgba(255,255,255,1)');
	soft.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = soft;
	g.fillRect(32, 0, 32, 32);
	g.fillStyle = '#fff';
	g.beginPath();
	g.ellipse(80, 16, 14, 3, 0, 0, Math.PI * 2);
	g.fill();
	g.beginPath();
	g.moveTo(100, 26);
	g.lineTo(112, 4);
	g.lineTo(124, 24);
	g.closePath();
	g.fill();
	return c;
}

export const silhouetteKit: ArtKit = {
	palette: pal,
	sky: drawSky,
	land: drawLand,
	archer: drawArcher,
	foe: drawFoe,
	boss: drawBoss,
	corpse: drawCorpse,
	arrow: drawArrow,
	projectile: drawProjectile,
	piece: drawPiece,
	drag: drawDrag,
	defenses: drawDefenses,
	aim: drawAim,
	map: drawMap,
	particle,
	text(t, x, y, size, color, opacity, angle = 0) {
		k.drawText({ text: t, pos: v(x, y), size, font: 'display', color: col(color), opacity, anchor: 'center', angle });
	},
	load() {
		for (const name of Object.keys(ICONS)) k.loadSprite(`icon:${name}`, iconUrl(name, 96, INK));
		k.loadSprite('fx', particleSheet(), { sliceX: 4 });
	},
	iconSvg: (name) => iconSvg(name),
};

