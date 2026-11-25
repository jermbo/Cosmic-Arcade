// The archer, the foes and the bosses. All ink silhouettes; the act accent marks what matters
// (the archer's scarf, weak spots, armor sheen, elite eyes).

import { WORLD } from '../../rules/data/balance.ts';
import { BOSSES } from '../../rules/data/bosses.ts';
import { k } from '../../game/k.ts';
import type { ArcherView, BossView, CorpseView, FoeView } from '../types.ts';
import { col, dot, fan, mix, noise1, poly, stroke, v } from './draw.ts';
import { biped, curve, defaultPose, extraDot, extraLine, newFigure, render, rotate, type Figure, type Joints } from './figure.ts';
import { INK, PALETTES, PAPER } from './palette.ts';

type P = [number, number];
const pal = (act: number) => PALETTES[act] ?? PALETTES[0];

// ---------- The archer ----------

export function drawArcher(a: ArcherView) {
	const p = pal(a.act);
	const ink = col(INK);
	const accent = col(p.accent);
	const s = a.scale ?? 1;
	const f = newFigure();
	const recoil = Math.max(0, 1 - a.sinceShot * 6) * 3;
	const flinch = Math.max(0, 1 - a.sinceHurt * 4);
	const fall = a.dead ? Math.min(1, a.sinceDead * 1.6) : 0;
	const x = a.x - recoil - flinch * 4;
	const y = a.y;
	const breathe = Math.sin(a.time * 2.2) * 0.8;

	// Body: wide stance, facing right.
	const hip: P = [x - 1, y - 30 * s + breathe * 0.3 + fall * 14 * s];
	const neck: P = [x + 1 - flinch * 3, y - 54 * s + breathe + fall * 20 * s];
	const head: P = [x + 2 - flinch * 4, y - 63 * s + breathe + fall * 22 * s];
	const walk = a.walking ? a.time * 9 : 0;
	const stride = a.walking ? 0.5 : 0;
	const legFront = [hip, [x + 8 * s + Math.sin(walk) * 8 * stride, y - 15 * s + fall * 10 * s], [x + 12 * s + Math.sin(walk) * 12 * stride, y]] as P[];
	const legBack = [hip, [x - 7 * s - Math.sin(walk) * 8 * stride, y - 14 * s + fall * 12 * s], [x - 13 * s - Math.sin(walk) * 12 * stride, y]] as P[];
	if (fall > 0) legBack[2] = [x - 18 * s, y];

	// Scarf: two tails in the wind. Drawn first so the body sits on top.
	const glow = a.bonus ? 0.6 + 0.4 * Math.sin(a.time * 10) : 0;
	const tail = (len: number, off: number): P[] => {
		const pts: P[] = [[neck[0] - 1, neck[1] + 1]];
		for (let i = 1; i <= 6; i++) {
			const t = i / 6;
			const wave = Math.sin(a.time * 7 - i * 0.9 + off) * 4 * t + noise1(a.time * 2 + i, off) * 2 * t;
			pts.push([neck[0] - len * t - recoil, neck[1] + 2 + t * 6 + wave + off * 2]);
		}
		return pts;
	};
	if (glow > 0) {
		stroke(tail(30 * s, 0), 9 * s, accent, 0.25 * glow);
	}
	stroke(tail(30 * s, 0), 5 * s, accent);
	stroke(tail(22 * s, 1.7), 3.6 * s, accent);

	// Quiver on the back.
	const qx = neck[0] - 7 * s;
	const qy = neck[1] + 2 * s;
	stroke(
		[
			[qx, qy + 18 * s],
			[qx - 5 * s, qy - 2 * s],
		],
		6 * s,
		ink,
	);
	for (let i = 0; i < 3; i++) {
		stroke(
			[
				[qx - 5 * s + i * 2, qy - 2 * s],
				[qx - 9 * s + i * 3, qy - 10 * s],
			],
			1.4 * s,
			ink,
		);
		fan(
			[
				[qx - 9 * s + i * 3, qy - 10 * s],
				[qx - 12 * s + i * 3, qy - 15 * s],
				[qx - 7 * s + i * 3, qy - 13 * s],
			],
			accent,
		);
	}

	f.lines.push({ pts: legBack, w: 4.8 * s });
	f.lines.push({ pts: [neck, hip], w: 6 * s });
	f.lines.push({ pts: legFront, w: 4.8 * s });
	f.dots.push({ x: head[0], y: head[1], r: 9 * s });
	// A small topknot.
	f.dots.push({ x: head[0] - 6 * s, y: head[1] - 7 * s, r: 3.4 * s });

	// Bow arm and draw arm. The bow hand sits at the launch point.
	const ang = a.dead ? 0.9 + fall * 0.4 : a.angle;
	const shoulder: P = [neck[0] + 1, neck[1] + 4 * s];
	const dir: P = [Math.cos(ang), Math.sin(ang)];
	const perp: P = [-dir[1], dir[0]];
	const handBase: P = s === 1 && !a.dead ? [WORLD.bowX - recoil, WORLD.bowY + breathe] : [shoulder[0] + dir[0] * 13 * s, shoulder[1] + dir[1] * 13 * s];
	const hand: P = [handBase[0] + dir[0] * 3 * s, handBase[1] + dir[1] * 3 * s];
	const pull = a.dead ? 0 : a.pull;
	const drawBack = (5 + 20 * pull) * s;
	const nock: P = [hand[0] - dir[0] * drawBack, hand[1] - dir[1] * drawBack];
	const elbow: P = [nock[0] - dir[0] * 4 * s + perp[0] * -7 * s, nock[1] - dir[1] * 4 * s + perp[1] * -7 * s];
	f.lines.push({ pts: [shoulder, hand], w: 4.4 * s });
	f.lines.push({ pts: [shoulder, elbow, nock], w: 4.2 * s });

	// The bow: limbs bend back as you pull.
	const limbLen = 24 * s;
	const bend = (4 + pull * 9) * s;
	const tipA: P = [hand[0] + perp[0] * limbLen - dir[0] * bend, hand[1] + perp[1] * limbLen - dir[1] * bend];
	const tipB: P = [hand[0] - perp[0] * limbLen - dir[0] * bend, hand[1] - perp[1] * limbLen - dir[1] * bend];
	const belly: P = [hand[0] + dir[0] * 4 * s, hand[1] + dir[1] * 4 * s];
	f.lines.push({ pts: curve(tipA, [belly[0] + perp[0] * 14 * s, belly[1] + perp[1] * 14 * s], belly, 6), w: 3.4 * s });
	f.lines.push({ pts: curve(belly, [belly[0] - perp[0] * 14 * s, belly[1] - perp[1] * 14 * s], tipB, 6), w: 3.4 * s });
	// The string, which shivers after a shot.
	const shiver = Math.sin(a.sinceShot * 90) * Math.max(0, 1 - a.sinceShot * 5) * 3 * s;
	const stringMid: P = pull > 0.02 ? nock : [hand[0] - dir[0] * (5 * s + shiver), hand[1] - dir[1] * (5 * s + shiver)];
	extraLine(
		f,
		[tipA, stringMid, tipB],
		1.3 * s,
		ink,
	);
	// The nocked arrow, once the bow is ready.
	if (a.sinceShot > 0.2 && !a.dead && s === 1) {
		const tip: P = [nock[0] + dir[0] * 34, nock[1] + dir[1] * 34];
		f.extras.push({
			draw: (o) => {
				stroke([nock, tip], 2.2, ink, o);
				fan(
					[
						[tip[0] + dir[0] * 7, tip[1] + dir[1] * 7],
						[tip[0] + perp[0] * 3.4, tip[1] + perp[1] * 3.4],
						[tip[0] - perp[0] * 3.4, tip[1] - perp[1] * 3.4],
					],
					ink,
					o,
				);
				fan(
					[
						[nock[0] + dir[0] * 2, nock[1] + dir[1] * 2],
						[nock[0] - dir[0] * 6 + perp[0] * 4, nock[1] - dir[1] * 6 + perp[1] * 4],
						[nock[0] - dir[0] * 6 - perp[0] * 4, nock[1] - dir[1] * 6 - perp[1] * 4],
					],
					accent,
					o,
				);
				if (a.bonus) k.drawCircle({ pos: v(tip[0], tip[1]), radius: 6 + glow * 4, color: accent, opacity: 0.35 * glow * o });
			},
		});
	}
	if (fall > 0) {
		const fallen = rotate(f, x, y, -fall * 0.5);
		rim(fallen, a.act, 0.5);
		render(fallen, ink);
		return;
	}
	if (flinch > 0.05) render(f, col('#ffffff'), flinch * 0.5, 2, false);
	rim(f, a.act, s < 1 ? 0.7 : 0.85);
	render(f, ink);
}

// ---------- Foes ----------

/** Sunlight on the edges: a thin light outline so ink figures read on any background. */
function rim(f: Figure, act: number, opacity = 0.75, width = 1.5) {
	render(f, col(pal(act).sun), opacity, width, false);
}

/** The rim light, then the accent glow for elites, the frost glow for chilled foes. */
function glowPass(f: Figure, v2: { elite: boolean; chilled: boolean; burning: boolean; time: number; act: number }) {
	const p = pal(v2.act);
	rim(f, v2.act);
	if (v2.elite) render(f, col(p.accent), 0.55 + 0.2 * Math.sin(v2.time * 6), 2.4, false);
	if (v2.chilled) render(f, col('#bdefff'), 0.75, 1.6, false);
	if (v2.burning) render(f, col('#ffb347'), 0.4 + 0.25 * Math.sin(v2.time * 20), 1.8, false);
}

function sheen(f: Figure, pts: P[], act: number) {
	extraLine(f, pts, 1.6, mix(pal(act).far, '#ffffff', 0.45));
}

function eyes(f: Figure, j: Joints, act: number, elite: boolean, size = 1) {
	if (!elite) return;
	const c = col(pal(act).accent);
	extraDot(f, j.head[0] - j.headR * 0.45, j.head[1] - j.headR * 0.1, 1.6 * size, c, 0.6);
}

function helmetShape(f: Figure, j: Joints, act: number, horns: boolean) {
	const [hx, hy] = j.head;
	const r = j.headR;
	f.shapes.push([
		[hx - r * 1.25, hy + r * 0.1],
		[hx - r * 1.05, hy - r * 0.8],
		[hx - r * 0.3, hy - r * 1.3],
		[hx + r * 0.6, hy - r * 1.2],
		[hx + r * 1.2, hy - r * 0.5],
		[hx + r * 1.25, hy + r * 0.2],
	]);
	if (horns) {
		f.shapes.push([
			[hx - r * 0.7, hy - r * 1],
			[hx - r * 1.6, hy - r * 2.1],
			[hx - r * 0.2, hy - r * 1.3],
		]);
		f.shapes.push([
			[hx + r * 0.5, hy - r * 1.1],
			[hx + r * 1.4, hy - r * 2.2],
			[hx + r * 0.9, hy - r * 0.8],
		]);
	}
	sheen(
		f,
		[
			[hx - r * 0.8, hy - r * 0.7],
			[hx - r * 0.2, hy - r * 1.05],
		],
		act,
	);
}

export function drawFoe(fv: FoeView) {
	const ink = col(INK);
	const f = newFigure();
	const s = fv.size;
	const x = fv.x + fv.kick;
	const t = fv.time;

	if (fv.art === 'flyer') {
		drawFlyer(fv, x);
		return;
	}

	const pose = defaultPose(x, fv.y, s, -1);
	pose.phase = t * 7 * Math.max(0.2, fv.gait);
	pose.stride = fv.gait > 0 ? 1 : 0;
	const attacking = fv.state === 'attack';
	const chop = attacking ? Math.max(0, Math.sin(t * 5.5)) : 0;

	switch (fv.art) {
		case 'runner':
			pose.lean = 0.32;
			pose.phase = t * 12 * Math.max(0.2, fv.gait);
			pose.headR = 8.4;
			break;
		case 'brute':
			pose.bulk = 30;
			pose.limbW = 7;
			pose.torsoW = 10;
			pose.headR = 9.5;
			pose.phase = t * 4.5 * Math.max(0.2, fv.gait);
			break;
		case 'splitter':
			pose.bulk = 26;
			pose.torsoW = 9;
			pose.phase = t * 5 * Math.max(0.2, fv.gait);
			break;
		case 'splitling':
			pose.phase = t * 14 * Math.max(0.2, fv.gait);
			pose.lean = 0.2;
			break;
		case 'shield':
			pose.armFront = [1.3, 0.2];
			break;
		case 'thrower':
			if (fv.state === 'throw') pose.armFront = [Math.PI - 0.4 - fv.wind * 1.2, -0.6];
			break;
	}
	if (attacking && fv.art !== 'shield') pose.armFront = [0.6 + chop * 1.8, 0.3 - chop * 0.2];

	const j = biped(f, pose);

	// Weapons and gear.
	if (fv.art === 'walker' || fv.art === 'brute') {
		const [hx, hy] = j.handFront;
		const len = (fv.art === 'brute' ? 30 : 20) * s;
		const ang = attacking ? -0.4 - chop * 1.6 : 0.5;
		const end: P = [hx - Math.cos(ang) * len, hy - Math.sin(ang) * len];
		f.lines.push({ pts: [[hx, hy], end], w: (fv.art === 'brute' ? 5 : 3) * s });
		if (fv.art === 'brute') f.dots.push({ x: end[0], y: end[1], r: 6 * s });
	}
	if (fv.art === 'thrower') {
		const [hx, hy] = j.handFront;
		if (fv.state !== 'throw' || fv.wind > 0.05) f.dots.push({ x: hx, y: hy - 3 * s, r: 5 * s });
		// A sling bag at the hip.
		f.dots.push({ x: j.hip[0] + 6 * s, y: j.hip[1] + 4 * s, r: 5 * s });
	}
	if (fv.art === 'runner') {
		// A long ponytail flying back.
		const [hx, hy] = j.head;
		const wave = Math.sin(t * 16) * 3;
		f.lines.push({
			pts: [
				[hx + 6 * s, hy - 4 * s],
				[hx + 16 * s, hy - 2 * s + wave],
				[hx + 24 * s, hy + 2 * s - wave],
			],
			w: 3 * s,
		});
	}
	if (fv.art === 'splitter') {
		// A glowing seam shows it will split.
		const c = col(pal(fv.act).accent);
		const [nx, ny] = j.neck;
		const [px, py] = j.hip;
		extraLine(
			f,
			[
				[nx, ny + 2],
				[nx + 3, (ny + py) / 2 - 4],
				[px - 3, (ny + py) / 2 + 4],
				[px, py],
			],
			1.8 * s,
			c,
		);
	}
	if (fv.helmet) helmetShape(f, j, fv.act, fv.art === 'brute' || fv.elite);
	if (fv.plate) {
		const [nx, ny] = j.neck;
		const [px, py] = j.hip;
		const w = (fv.art === 'brute' ? 20 : 12) * s;
		f.shapes.push([
			[nx - w, ny + 2 * s],
			[nx + w, ny + 2 * s],
			[px + w * 0.7, py - 2 * s],
			[px - w * 0.7, py - 2 * s],
		]);
		sheen(
			f,
			[
				[nx - w * 0.7, ny + 6 * s],
				[px - w * 0.5, py - 6 * s],
			],
			fv.act,
		);
	}
	if (fv.shield) {
		// Tall shield matching its hit box.
		const sx = fv.x - 24 * s + fv.kick;
		const sy = fv.y - 82 * s;
		f.shapes.push([
			[sx, sy + 4 * s],
			[sx + 4.5 * s, sy],
			[sx + 9 * s, sy + 4 * s],
			[sx + 9 * s, fv.y - 2],
			[sx, fv.y - 2],
		]);
		sheen(
			f,
			[
				[sx + 1.5 * s, sy + 8 * s],
				[sx + 1.5 * s, fv.y - 10 * s],
			],
			fv.act,
		);
	}
	eyes(f, j, fv.act, fv.elite);
	glowPass(f, fv);
	render(f, fv.flash > 0 ? col(PAPER) : ink);
}

function drawFlyer(fv: FoeView, x: number) {
	const s = fv.size;
	const y = fv.y;
	const t = fv.time;
	const ink = col(INK);
	const f = newFigure();
	const flap = Math.sin(t * (fv.state === 'dive' ? 22 : 11));
	const tilt = fv.state === 'dive' ? -0.5 * fv.wind : 0;
	// Body and head, matching the hit box.
	f.shapes.push([
		[x - 12 * s, y - 6 * s],
		[x + 2 * s, y - 8 * s],
		[x + 14 * s, y - 2 * s],
		[x + 24 * s, y - 6 * s],
		[x + 22 * s, y + 2 * s],
		[x + 12 * s, y + 6 * s],
		[x - 8 * s, y + 6 * s],
	]);
	f.dots.push({ x: x - 14 * s, y: y - 4 * s, r: 7 * s });
	f.shapes.push([
		[x - 20 * s, y - 6 * s],
		[x - 30 * s, y - 1 * s],
		[x - 19 * s, y - 1 * s],
	]);
	// Wings.
	const wing = (side: number): P[] => [
		[x - 4 * s, y - 4 * s],
		[x - 2 * s + side * 2, y - 4 * s - 26 * s * flap * side - 6 * s],
		[x + 12 * s, y - 4 * s - 20 * s * flap * side - 2 * s],
		[x + 8 * s, y - 2 * s],
	];
	f.shapes.push(wing(1));
	// Dangling legs.
	f.lines.push({
		pts: [
			[x + 2 * s, y + 5 * s],
			[x + 4 * s, y + 13 * s],
		],
		w: 2 * s,
	});
	f.lines.push({
		pts: [
			[x + 8 * s, y + 5 * s],
			[x + 10 * s, y + 12 * s],
		],
		w: 2 * s,
	});
	if (fv.elite) extraDot(f, x - 17 * s, y - 6 * s, 1.6, col(pal(fv.act).accent), 0.6);
	let fig = f;
	if (tilt !== 0) fig = rotate(f, x, y, tilt);
	glowPass(fig, fv);
	render(fig, fv.flash > 0 ? col(PAPER) : ink);
	if (tilt === 0) poly(wing(-0.6), mix(INK, pal(fv.act).mid, 0.3));
}

// ---------- Corpses ----------

export function drawCorpse(c: CorpseView) {
	const ink = col(INK);
	const opacity = 1 - c.fade;
	if (opacity <= 0) return;
	const f = newFigure();
	if (c.shape === 'flyer') {
		f.shapes.push([
			[c.x - 12 * c.size, c.y - 6 * c.size],
			[c.x + 22 * c.size, c.y - 4 * c.size],
			[c.x + 12 * c.size, c.y + 6 * c.size],
			[c.x - 8 * c.size, c.y + 6 * c.size],
		]);
		if (!c.headless) f.dots.push({ x: c.x - 14 * c.size, y: c.y - 4 * c.size, r: 7 * c.size });
	} else {
		const pose = defaultPose(c.x, c.y, c.size, -1);
		if (c.art === 'brute') {
			pose.bulk = 30;
			pose.limbW = 7;
			pose.torsoW = 10;
		}
		if (c.art === 'splitter') pose.bulk = 26;
		pose.armFront = [2.6, 0.4];
		pose.armBack = [2.2, 0.6];
		biped(f, pose);
		if (c.headless) f.dots.pop();
	}
	const fallen = rotate(f, c.x, c.y, c.angle);
	rim(fallen, c.act, 0.5 * opacity);
	render(fallen, ink, opacity);
}

// ---------- Bosses ----------

export function drawBoss(b: BossView) {
	if (b.art === 'kitequeen') drawKiteQueen(b);
	else if (b.art === 'hollowking') drawHollowKing(b);
	else drawGatewarden(b);
}

function weakSpot(x: number, y: number, r: number, b: BossView, closed: boolean) {
	const p = pal(b.act);
	const pulse = 0.5 + 0.5 * Math.sin(b.time * (b.glow > 0 ? 14 : 4));
	if (closed) {
		dot(x, y, r + 2, col(INK));
		stroke(
			[
				[x - r, y],
				[x + r, y],
			],
			2,
			mix(p.far, '#ffffff', 0.4),
		);
		return;
	}
	const glow = 0.3 + b.glow * 0.7;
	k.drawCircle({ pos: v(x, y), radius: r * (2 + glow * 1.6 + pulse * 0.4), color: col(p.accent), opacity: 0.18 * glow });
	k.drawCircle({ pos: v(x, y), radius: r * (1.35 + pulse * 0.15), color: col(p.accent), opacity: 0.5 });
	dot(x, y, r, col(p.sun));
	dot(x, y, r * 0.55, col(p.accent));
}

function drawGatewarden(b: BossView) {
	const def = BOSSES.gatewarden;
	const ink = col(INK);
	const x = b.x + b.kick;
	const y = b.y;
	const t = b.time;
	const f = newFigure();
	const moving = b.phase === 'enter' || b.phase === 'return' || b.phase === 'charge';
	const ph = t * (b.phase === 'charge' ? 14 : 4);
	const step = moving ? Math.sin(ph) * 10 : 0;
	const lift = b.phase === 'windup' ? b.wind : 0;
	const lean = b.phase === 'charge' ? -10 : b.phase === 'stagger' ? 8 : lift * 6;
	// Legs like pillars.
	f.lines.push({
		pts: [
			[x - 12, y - 62],
			[x - 16 + step, y - 30],
			[x - 14 + step * 1.4, y],
		],
		w: 15,
	});
	f.lines.push({
		pts: [
			[x + 12, y - 62],
			[x + 14 - step, y - 30],
			[x + 16 - step * 1.4, y],
		],
		w: 15,
	});
	// Torso: broad shoulders.
	f.shapes.push([
		[x - 36 + lean, y - 152],
		[x + 38 + lean, y - 150],
		[x + 24, y - 60],
		[x - 24, y - 60],
	]);
	// Head with a spiked crown.
	const hx = x + def.head.x + lean;
	const hy = y + def.head.y;
	f.dots.push({ x: hx, y: hy, r: def.head.r });
	for (let i = 0; i < 5; i++) {
		const a = -Math.PI / 2 + (i - 2) * 0.42;
		f.shapes.push([
			[hx + Math.cos(a - 0.2) * 16, hy + Math.sin(a - 0.2) * 16],
			[hx + Math.cos(a) * (32 + (i === 2 ? 8 : 0)), hy + Math.sin(a) * (32 + (i === 2 ? 8 : 0))],
			[hx + Math.cos(a + 0.2) * 16, hy + Math.sin(a + 0.2) * 16],
		]);
	}
	// The maul: raised in the wind-up, swung in the charge.
	const shoulder: P = [x - 26 + lean, y - 140];
	const armA = b.phase === 'windup' ? -2.2 * lift - 0.2 : b.phase === 'charge' ? -0.2 : b.phase === 'volley' ? -2.6 : 0.5;
	const elbow: P = [shoulder[0] + Math.cos(Math.PI / 2 + armA) * 30, shoulder[1] + Math.sin(Math.PI / 2 + armA) * 30];
	const hand: P = [elbow[0] - 18, elbow[1] + (b.phase === 'windup' ? -12 : 16)];
	f.lines.push({ pts: [shoulder, elbow, hand], w: 12 });
	const head: P = [hand[0] - 26, hand[1] - 34 * (b.phase === 'windup' ? 1 : -0.3)];
	f.lines.push({ pts: [hand, head], w: 7 });
	f.shapes.push([
		[head[0] - 14, head[1] - 12],
		[head[0] + 10, head[1] - 12],
		[head[0] + 10, head[1] + 12],
		[head[0] - 14, head[1] + 12],
	]);
	// Back arm.
	f.lines.push({
		pts: [
			[x + 30 + lean, y - 140],
			[x + 40, y - 106],
			[x + 30, y - 78],
		],
		w: 11,
	});
	extraDot(f, hx - 8, hy - 2, 2.6, col(pal(b.act).accent), 0.8);
	if (b.enraged) extraDot(f, hx + 4, hy - 2, 2.6, col(pal(b.act).accent), 0.8);
	if (b.flash > 0) render(f, col(PAPER), 0.9);
	else {
		if (b.burning) render(f, col('#ffb347'), 0.35, 2, false);
		if (b.chilled) render(f, col('#bdefff'), 0.7, 1.6, false);
		rim(f, b.act, 0.85, 2);
		render(f, ink);
	}
	// The lantern in its chest.
	weakSpot(b.x + def.weak.x + lean * 0.5, y + def.weak.y, def.weak.r, b, b.guard);
	if (b.phase === 'stagger') stars(hx, hy - 30, t);
}

function drawKiteQueen(b: BossView) {
	const def = BOSSES.kitequeen;
	const ink = col(INK);
	const x = b.x + b.kick;
	const y = b.y;
	const t = b.time;
	const f = newFigure();
	const flap = Math.sin(t * (b.phase === 'charge' ? 9 : 4));
	const tilt = b.phase === 'charge' ? -0.35 : b.phase === 'stagger' ? 0.3 : b.phase === 'windup' ? -0.12 * b.wind : 0;
	// Tail ribbons.
	for (let r = 0; r < 3; r++) {
		const pts: P[] = [];
		for (let i = 0; i <= 10; i++) {
			const u = i / 10;
			pts.push([x + 40 + u * 150, y + 6 + r * 6 + Math.sin(t * 3 - u * 6 + r) * 14 * u + u * 30]);
		}
		f.lines.push({ pts, w: 3.4 - r * 0.8 });
		const end = pts[pts.length - 1];
		f.shapes.push([
			[end[0] - 5, end[1] - 6],
			[end[0] + 5, end[1]],
			[end[0] - 5, end[1] + 6],
		]);
	}
	// Kite wings: a great diamond that beats.
	const wy = flap * 26;
	f.shapes.push([
		[x - 30, y - 6],
		[x + 4, y - 72 - wy],
		[x + 70, y - 40 - wy * 0.6],
		[x + 40, y + 2],
	]);
	f.shapes.push([
		[x - 30, y + 2],
		[x + 40, y],
		[x + 64, y + 34 + wy * 0.5],
		[x + 2, y + 54 + wy * 0.3],
	]);
	// Body and long neck.
	f.shapes.push([
		[x - 44, y - 14],
		[x + 40, y - 18],
		[x + 46, y + 4],
		[x + 30, y + 22],
		[x - 30, y + 18],
	]);
	f.dots.push({ x: x + def.head.x, y: y + def.head.y, r: def.head.r });
	f.shapes.push([
		[x + def.head.x - 10, y + def.head.y - 4],
		[x + def.head.x - 48, y + def.head.y + 4],
		[x + def.head.x - 8, y + def.head.y + 8],
	]);
	// A crest of three feathers.
	for (let i = 0; i < 3; i++) {
		f.lines.push({
			pts: [
				[x + def.head.x + 4, y + def.head.y - 10],
				[x + def.head.x + 16 + i * 8, y + def.head.y - 34 + i * 6],
			],
			w: 3,
		});
	}
	extraDot(f, x + def.head.x - 6, y + def.head.y - 3, 2.4, col(pal(b.act).accent), 0.8);
	let fig = f;
	if (tilt !== 0) fig = rotate(f, x, y, tilt);
	if (b.flash > 0) render(fig, col(PAPER), 0.9);
	else {
		if (b.burning) render(fig, col('#ffb347'), 0.35, 2, false);
		if (b.chilled) render(fig, col('#bdefff'), 0.7, 1.6, false);
		rim(fig, b.act, 0.85, 2);
		render(fig, ink);
	}
	weakSpot(b.x + def.weak.x, y + def.weak.y, def.weak.r, b, b.guard);
	if (b.phase === 'stagger') stars(x + def.head.x, y + def.head.y - 26, t);
}

function drawHollowKing(b: BossView) {
	const def = BOSSES.hollowking;
	const ink = col(INK);
	const x = b.x + b.kick;
	const y = b.y;
	const t = b.time;
	const f = newFigure();
	const sway = Math.sin(t * 1.4) * 3;
	// Robe to the ground.
	f.shapes.push([
		[x - 16 + sway, y - 172],
		[x + 16 + sway, y - 172],
		[x + 34, y],
		[x - 38, y],
	]);
	// Tattered hem.
	for (let i = 0; i < 6; i++) {
		const hx = x - 34 + i * 12;
		f.shapes.push([
			[hx, y - 4],
			[hx + 6, y + 6 + (i % 2) * 4],
			[hx + 12, y - 4],
		]);
	}
	// Head, crown and the gem on top.
	const hx = x + def.head.x + sway;
	const hy = y + def.head.y;
	f.dots.push({ x: hx, y: hy, r: def.head.r });
	f.shapes.push([
		[hx - 18, hy - 12],
		[hx - 20, hy - 34],
		[hx - 8, hy - 22],
		[hx, hy - 42],
		[hx + 8, hy - 22],
		[hx + 20, hy - 34],
		[hx + 18, hy - 12],
	]);
	// The great bow, held out front. Drawn back to hurl arrows.
	const drawn = b.phase === 'windup' ? b.wind : b.phase === 'volley' ? 1 - ((t * 3) % 1) : 0;
	const bowX = x - 54 + sway;
	const bowY = y - 128;
	const tipA: P = [bowX + 12, bowY - 70];
	const tipB: P = [bowX + 12, bowY + 70];
	f.lines.push({ pts: curve(tipA, [bowX - 34, bowY], tipB, 12), w: 6 });
	const nock: P = [bowX + 14 + drawn * 34, bowY];
	extraLine(f, [tipA, nock, tipB], 1.6, ink);
	f.lines.push({
		pts: [
			[x - 8 + sway, y - 160],
			[x - 34 + sway, y - 140],
			[bowX - 22, bowY],
		],
		w: 7,
	});
	f.lines.push({
		pts: [
			[x + 8 + sway, y - 160],
			[x + 2 + sway, y - 130],
			nock,
		],
		w: 7,
	});
	// Guard: a cloak raised over the crown.
	if (b.guard) {
		f.shapes.push([
			[hx - 34, hy - 10],
			[hx - 20, hy - 60],
			[hx + 24, hy - 62],
			[hx + 36, hy - 6],
		]);
	}
	extraDot(f, hx - 7, hy - 2, 2.6, col(pal(b.act).accent), 0.8);
	extraDot(f, hx + 6, hy - 2, 2.6, col(pal(b.act).accent), 0.8);
	if (b.flash > 0) render(f, col(PAPER), 0.9);
	else {
		if (b.burning) render(f, col('#ffb347'), 0.35, 2, false);
		if (b.chilled) render(f, col('#bdefff'), 0.7, 1.6, false);
		rim(f, b.act, 0.85, 2);
		render(f, ink);
	}
	weakSpot(x + def.weak.x + sway, y + def.weak.y, def.weak.r, b, b.guard);
	if (b.phase === 'stagger') stars(hx, hy - 56, t);
}

/** Little dizzy stars over a staggered boss. */
function stars(x: number, y: number, t: number) {
	for (let i = 0; i < 3; i++) {
		const a = t * 5 + (i * Math.PI * 2) / 3;
		const sx = x + Math.cos(a) * 22;
		const sy = y + Math.sin(a) * 7;
		const r = 4.5;
		poly(
			[
				[sx, sy - r * 1.6],
				[sx + r * 0.5, sy - r * 0.5],
				[sx + r * 1.6, sy],
				[sx + r * 0.5, sy + r * 0.5],
				[sx, sy + r * 1.6],
				[sx - r * 0.5, sy + r * 0.5],
				[sx - r * 1.6, sy],
				[sx - r * 0.5, sy - r * 0.5],
			],
			col(PAPER),
		);
	}
}

