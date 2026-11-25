// The fight. The rules run the simulation; this scene turns its events into feel:
// hit stop, shake, particles, sound, pop-ups, and the reward after.

import { art } from '../../art/index.ts';
import type { SkyView } from '../../art/types.ts';
import { BOSSES } from '../../rules/data/bosses.ts';
import { FX, WORLD } from '../../rules/data/balance.ts';
import { Battle, hitShapes, type BattleEvent, type Enemy } from '../../rules/combat.ts';
import { battleSetup, dusk, finishBattle } from '../../rules/run.ts';
import { banner, clearLayers, hurtFlash, onBack, panel, pop, button, h, topLayer } from '../../ui/dom.ts';
import { BattleHud, Coach } from '../../ui/hud.ts';
import { confirmPanel, howToPanel, settingsPanel } from '../../ui/panels.ts';
import { music, sfx, stopMusic } from '../audio.ts';
import { abandonRun, goMap, goTitle, resolvePending } from '../flow.ts';
import { Fx } from '../fx.ts';
import { AimInput } from '../input.ts';
import { k, sceneSetup, visibleWorld } from '../k.ts';
import { game, haptic, persist } from '../state.ts';

export function battleScene() {
	sceneSetup();
	const r = game.save.run;
	const meta = game.save.meta;
	const setup = r ? battleSetup(r, meta) : null;
	if (!r || !setup) {
		goMap();
		return;
	}
	const run = r;
	const act = run.act;
	const battle = new Battle(setup);
	const fx = new Fx(act);
	const input = new AimInput(battle);
	const coach = new Coach();
	let paused = false;
	let time = 0;
	let sinceShot = 9;
	let sinceHurt = 9;
	let helperShot = 9;
	let endT = 0;
	let ended = false;
	let lastStreak = 0;
	let wallKick = 0;
	const trails = new Map<number, { x: number; y: number }[]>();
	const sky: SkyView = { act, dusk: dusk(run), time: 0, view: visibleWorld(), dim: 0, seed: setup.seed % 997 };

	const pause = () => {
		if (paused || battle.outcome) return;
		paused = true;
		input.cancel();
		input.enabled = false;
		const layer = panel({
			title: 'Paused',
			narrow: true,
			body: h(
				'div',
				{ class: 'stack' },
				button('Resume', () => resume(), 'btn--accent'),
				button('Settings', () => settingsPanel(() => {})),
				button('How to play', () => howToPanel(() => {})),
				button('Abandon run', () => confirmPanel('Abandon this run?', 'It ends now and pays out what you earned so far.', 'Abandon', () => abandonRun())),
				button('Save and quit', () => goTitle()),
			),
			onBack: () => resume(),
		});
		const resume = () => {
			pop(layer);
			paused = false;
			setTimeout(() => (input.enabled = !battle.outcome), 80);
		};
	};
	onBack(pause);
	k.onHide(() => pause());
	k.onKeyPress(['escape', 'p'], () => (paused ? topLayer()?.back?.() : pause()));
	k.onGamepadButtonPress('start', () => (paused ? topLayer()?.back?.() : pause()));

	const hud = new BattleHud(run, setup.stats.slots, pause);
	k.onSceneLeave(() => {
		hud.remove();
		coach.hide();
	});
	music(act, true);
	document.documentElement.style.setProperty('--accent', art.palette(act).accent);

	// Boss intro.
	if (setup.kind === 'boss') {
		const b = BOSSES[setup.bossId ?? ''] ?? battle.boss?.boss;
		if (b) {
			setTimeout(() => banner(b.name, b.title, true, 2600), 300);
			setTimeout(() => sfx('roar'), 400);
		}
	} else if (setup.kind === 'elite') {
		setTimeout(() => banner('Elite', 'Tougher foes. Better loot.', true, 1600), 200);
	}

	// ---------- Tutorial ----------
	let tut = setup.tutorial ? 1 : 0;
	let tutT = 0;
	const touchText = '<b>Drag back</b> anywhere, aim the arc, <b>let go</b> to shoot.';
	const keysText = '<b>Arrows</b> aim. Hold <b>Space</b>, let go to shoot.';
	if (tut) coach.show(touchText, true);
	k.onKeyPress(() => {
		if (tut === 1) coach.show(keysText, false);
	});
	const tutStep = (n: number, html: string, hand = false) => {
		tut = n;
		tutT = 0;
		coach.show(html, hand);
	};
	input.onShot = () => {
		sinceShot = 0;
		if (tut === 1) tutStep(2, '<b>Head shot</b>: one hit. <b>Body shot</b>: two hits.');
	};

	// ---------- The world ----------
	k.add([
		k.z(0),
		{
			draw() {
				sky.view = visibleWorld();
				sky.view.x -= 40;
				sky.view.y -= 40;
				sky.view.w += 80;
				sky.view.h += 80;
				sky.time = time;
				sky.dim = fx.dim;
				art.sky(sky);
				art.land(sky);
				fx.drawGround();
				art.defenses({
					act,
					time,
					wall: battle.wall ? { hp: battle.wall.hp, max: battle.wall.max, kick: wallKick } : null,
					spikes: battle.stats.spikes > 0,
					helper: battle.stats.helper > 0 ? { x: WORLD.helperX, y: WORLD.helperY, angle: -0.5, sinceShot: helperShot } : null,
				});
				fx.drawCorpses();
				for (const e of battle.enemies) drawEnemy(e);
				art.archer({
					x: WORLD.archerX,
					y: WORLD.groundY - 12,
					angle: battle.drawing || input.resting ? (battle.drawing ? battle.angle : input.angle) : battle.angle,
					pull: battle.drawing ? battle.power : 0,
					sinceShot,
					sinceHurt,
					time,
					act,
					bonus: battle.bonus,
					dead: battle.outcome === 'lost',
					sinceDead: battle.outcome === 'lost' ? endT : 0,
				});
				for (const p of battle.projectiles) art.projectile({ kind: p.def.kind, x: p.x, y: p.y, angle: Math.atan2(p.vy, p.vx) + (p.def.kind === 'rock' || p.def.kind === 'boulder' ? p.age * 6 : 0), radius: p.def.radius, time, act });
				for (const a of battle.arrows) {
					art.arrow({
						x: a.x,
						y: a.y,
						angle: Math.atan2(a.vy, a.vx),
						kind: a.owner,
						trail: trails.get(a.uid) ?? [],
						fire: a.fire > 0,
						ice: a.ice > 0,
						explosive: a.explosive > 0,
						opacity: 1,
						act,
						length: 1,
					});
				}
				fx.drawPops();
				// Aim: the arc while pulling, a faint resting arc for keys and pad.
				if (!battle.outcome && game.save.settings.arc) {
					if (battle.drawing && battle.power > 0.02) {
						art.aim({ points: battle.arcPoints(), pull: battle.power, bonus: battle.bonus, act, ghost: false });
					} else if (input.resting) {
						art.aim({ points: battle.arcPoints(input.angle, input.pull), pull: input.pull, bonus: battle.bonus, act, ghost: true });
					}
				}
				if (input.origin && input.current) {
					const from = k.toWorld(input.origin);
					const to = k.toWorld(input.current);
					art.drag({ from, to, pull: battle.power, act });
				}
			},
		},
	]);

	function drawEnemy(e: Enemy) {
		const kick = fx.kicks.get(e.uid) ?? 0;
		if (e.boss && e.bs) {
			const bs = e.bs;
			const p = bs.pattern;
			const windTotal = p && 'windup' in p ? p.windup * (bs.enraged ? e.boss.enrage : 1) : 1;
			art.boss({
				art: e.boss.art,
				x: e.x,
				y: e.y,
				time: e.t,
				phase: bs.phase,
				wind: bs.phase === 'windup' ? 1 - Math.max(0, bs.t) / windTotal : 0,
				glow: bs.phase === 'windup' && p?.kind === 'charge' ? 1 : bs.phase === 'stagger' ? 0.6 : 0,
				guard: bs.phase === 'guard',
				enraged: bs.enraged,
				flash: e.flash,
				kick,
				burning: e.burnT > 0,
				chilled: e.slowT > 0,
				act,
				hpShare: e.hp / e.maxHp,
			});
		} else {
			const th = e.def.thrower;
			art.foe({
				art: e.def.art,
				x: e.x,
				y: e.y,
				size: e.size,
				time: e.t,
				gait: e.state === 'walk' || (e.state === 'hover' && e.x > e.stopX) ? e.speedMult * (e.slowT > 0 ? 1 - e.slowF : 1) : 0,
				state: e.state,
				wind: th && e.windT > 0 ? 1 - e.windT / th.windup : e.state === 'dive' && e.def.flying ? Math.min(1, e.diveT / e.def.flying.dive) : 0,
				helmet: e.helmet > 0,
				plate: e.plate > 0,
				shield: e.shield > 0,
				elite: e.elite,
				flash: e.flash,
				burning: e.burnT > 0,
				chilled: e.slowT > 0,
				kick,
				act,
			});
		}
		const stuck = fx.inFoe.get(e.uid);
		if (stuck) for (const s of stuck) art.arrow({ x: e.x + kick + s.dx, y: e.y + s.dy, angle: s.angle, kind: 'stuck', trail: [], fire: false, ice: false, explosive: false, opacity: 1, act, length: 0.7 });
		if (e.burnT > 0 && Math.random() < 0.25) {
			const sh = hitShapes(e);
			fx.burst('ember', sh.body.x + Math.random() * sh.body.w, sh.body.y + Math.random() * sh.body.h, -Math.PI / 2, 0.5);
		}
	}

	// ---------- Events to feel ----------
	const enemyById = (uid: number) => battle.enemies.find((e) => e.uid === uid);
	const angleOf = (vx: number, vy: number) => Math.atan2(vy, vx);

	function onEvent(ev: BattleEvent) {
		switch (ev.type) {
			case 'shoot':
				sfx('twang', { speed: 0.9 + ev.power * 0.25, volume: 0.6 + ev.power * 0.4 });
				sfx('whoosh', { volume: 0.3 + ev.power * 0.4, speed: 0.8 + ev.power * 0.5 });
				if (ev.power > 0.85) fx.shake(1.5);
				if (ev.bonus === 'crown') {
					sfx('zap');
					fx.shake(8);
					fx.stop(0.08);
					fx.dimTarget = 0.5;
					setTimeout(() => (fx.dimTarget = 0), 500);
					haptic(30);
				} else if (ev.bonus === 'volley') {
					sfx('bonus');
					haptic(20);
				}
				break;
			case 'hit': {
				const dir = angleOf(ev.vx, ev.vy);
				const e = enemyById(ev.uid);
				if (ev.uid === 0) {
					sfx('tink');
					fx.burst('spark', ev.x, ev.y, dir + Math.PI, 0.5);
					break;
				}
				if (ev.zone === 'head') {
					sfx('crack');
					fx.burst('head', ev.x, ev.y, dir);
					fx.burst('ink', ev.x, ev.y, dir, 0.8);
					fx.stop(FX.hitStopHead);
					fx.shake(3.5);
					if (ev.owner !== 'crown' || Math.random() < 0.4) fx.pop('HEADSHOT', ev.x, ev.y - 22, 22, art.palette(act).accent, 0.8, 40);
					haptic(14);
				} else if (ev.zone === 'body') {
					sfx('thunk', { volume: 0.9 });
					fx.burst('ink', ev.x, ev.y, dir, 0.7);
					fx.stop(FX.hitStopBody);
					fx.shake(1.2);
					if (e) fx.kick(e.uid, Math.min(9, Math.abs(ev.vx) * 0.008));
					if (e && ev.stuck) fx.stickInFoe(e.uid, ev.x - e.x, ev.y - e.y, dir);
				} else if (ev.zone === 'helmet' || ev.zone === 'plate') {
					sfx('clank');
					fx.burst('spark', ev.x, ev.y, dir + Math.PI);
					fx.stop(FX.hitStopBody);
					fx.shake(2);
					if (e) fx.kick(e.uid, 5);
					fx.part('arrow', ev.x, ev.y, -ev.vx * 0.15, -260);
				} else if (ev.zone === 'shield') {
					sfx('knock');
					fx.burst('spark', ev.x, ev.y, dir + Math.PI, 0.7);
					fx.part('arrow', ev.x, ev.y, -ev.vx * 0.12, -220);
					fx.pop('BLOCKED', ev.x, ev.y - 30, 15, '#fff3dc', 0.6, 26);
					if (e) fx.kick(e.uid, 3);
				} else if (ev.zone === 'weak') {
					sfx('crack', { speed: 0.8 });
					sfx('clank', { speed: 1.3, volume: 0.6 });
					fx.burst('head', ev.x, ev.y, dir, 1.2);
					fx.burst('spark', ev.x, ev.y, dir + Math.PI);
					fx.stop(FX.hitStopBoss);
					fx.shake(5);
					fx.pop(String(Math.round(ev.damage * 10) / 10), ev.x, ev.y - 26, 26, art.palette(act).accent, 0.8, 40);
					if (e) fx.kick(e.uid, 7);
					haptic(18);
				} else if (ev.zone === 'guard') {
					sfx('clank', { speed: 0.7 });
					fx.burst('spark', ev.x, ev.y, dir + Math.PI);
					fx.pop('GUARD', ev.x, ev.y - 26, 16, '#fff3dc', 0.6, 26);
					fx.part('arrow', ev.x, ev.y, -ev.vx * 0.12, -240);
				}
				if (e?.boss && (ev.zone === 'body' || ev.zone === 'head')) {
					fx.pop(String(Math.round(ev.damage * 10) / 10), ev.x, ev.y - 20, 17, '#fff3dc', 0.6, 30);
					if (ev.zone === 'body' && ev.stuck) fx.stickInFoe(e.uid, ev.x - e.x, ev.y - e.y, dir);
				}
				break;
			}
			case 'armorOff':
				sfx('clank', { speed: 0.75 });
				fx.part(ev.piece, ev.x, ev.y, ev.vx * 0.2, -300, ev.piece === 'helmet' ? 9 : 10);
				fx.burst('chip', ev.x, ev.y, angleOf(ev.vx, ev.vy));
				fx.pop(ev.piece === 'shield' ? 'SHIELD BROKEN' : 'ARMOR OFF', ev.x, ev.y - 24, 15, '#fff3dc', 0.7, 30);
				fx.shake(2.5);
				break;
			case 'kill': {
				const en = ev.enemy;
				if (!en.boss) {
					fx.corpse({ art: en.art, shape: en.shape, x: en.x, y: en.y, size: en.size, angle: 0, fade: 0, headless: ev.head, elite: en.elite, act }, ev.vx, ev.vy);
					if (ev.head) {
						const hy = en.shape === 'flyer' ? en.y - 4 * en.size : en.y - 63 * en.size;
						fx.part('head', en.x, hy, ev.vx * 0.35 + 40, -320 - Math.random() * 120, (en.shape === 'flyer' ? 7 : 9) * en.size);
					}
					const stuck = fx.inFoe.get(en.uid);
					if (stuck) for (const s of stuck) fx.part('arrow', en.x + s.dx, en.y + s.dy, 40 + Math.random() * 60, -200);
					fx.inFoe.delete(en.uid);
				}
				sfx('poof', { volume: 0.7 });
				if (ev.cause === 'fire') fx.burst('ember', en.x, en.y - 30, -Math.PI / 2, 3);
				fx.burst('ink', en.x, en.shape === 'flyer' ? en.y : en.y - 30 * en.size, angleOf(ev.vx, ev.vy), 0.6);
				fx.stop(FX.hitStopKill);
				if (ev.multi >= 2) {
					const words = ['', '', 'DOUBLE!', 'TRIPLE!', 'QUAD!'];
					fx.pop(words[ev.multi] ?? `x${ev.multi}!`, en.x, en.y - 90 * en.size, 28, art.palette(act).accent, 1, 50);
					sfx('note', { detune: 700 + ev.multi * 200 });
					fx.shake(3 + ev.multi);
				}
				break;
			}
			case 'stick':
				fx.stick(ev.x, ev.y, ev.angle, ev.owner);
				if (ev.owner !== 'rain' || Math.random() < 0.3) {
					fx.burst('dust', ev.x, ev.y, -Math.PI / 2, 0.5);
					sfx('thud', { volume: 0.5 });
				}
				break;
			case 'bounce':
				sfx('bounce');
				fx.burst('dust', ev.x, ev.y, -Math.PI / 2, 0.6);
				break;
			case 'explode':
				sfx('boom');
				fx.burst('blast', ev.x, ev.y, null, ev.r / 60);
				fx.burst('ink', ev.x, ev.y, -Math.PI / 2, 1);
				fx.shake(6);
				fx.stop(0.05);
				break;
			case 'miss':
				if (lastStreak >= 3) fx.pop('STREAK LOST', WORLD.archerX + 70, WORLD.groundY - 120, 15, '#fff3dc', 0.8, 20);
				lastStreak = 0;
				break;
			case 'combo':
				sfx('note', { detune: Math.round((ev.meter / 100) * 12) * 100, volume: 0.5 });
				if (ev.streak >= 5 && ev.streak % 5 === 0 && ev.streak !== lastStreak) fx.pop(`STREAK ${ev.streak}`, WORLD.archerX + 70, WORLD.groundY - 130, 20, art.palette(act).accent, 1, 30);
				lastStreak = ev.streak;
				break;
			case 'comboFull':
				sfx('fanfare');
				fx.slowmo(0.35, 0.3);
				fx.pop(ev.bonus === 'crown' ? 'CROWN SHOT!' : 'ARROW RAIN!', WORLD.archerX + 90, WORLD.groundY - 150, 26, art.palette(act).accent, 1.3, 30);
				haptic(25);
				if (tut && tut < 4) tutStep(4, '<b>Bonus ready!</b> Your next shot is special. Head-shot combos give the <b>Crown Shot</b>.');
				break;
			case 'rain':
				fx.dimTarget = 0.35;
				setTimeout(() => (fx.dimTarget = 0), 900);
				for (let i = 0; i < 6; i++) setTimeout(() => sfx('whistle', { speed: 0.8 + Math.random() * 0.5, volume: 0.5 }), 120 + i * 90);
				fx.shake(3);
				break;
			case 'projectileDown':
				sfx('tink');
				fx.burst('chip', ev.x, ev.y, null);
				fx.pop('SHOT DOWN', ev.x, ev.y - 16, 14, '#fff3dc', 0.6, 24);
				fx.stop(0.03);
				break;
			case 'projectileLand':
				fx.burst('dust', ev.x, ev.y, -Math.PI / 2, 0.8);
				sfx('thud', { volume: 0.6 });
				break;
			case 'throw':
				sfx('whoosh', { speed: 0.6, volume: 0.5 });
				break;
			case 'hurt':
				sfx('hurt');
				hurtFlash();
				fx.shake(7);
				fx.stop(0.06);
				fx.burst('hurt', ev.x, ev.y, -Math.PI * 0.75);
				fx.pop(`-${ev.damage}`, ev.x + 10, ev.y - 50, 24, '#ff5a5a', 0.9, 40);
				sinceHurt = 0;
				haptic(45);
				break;
			case 'block':
				sfx('block');
				fx.burst('spark', ev.x + 10, ev.y, Math.PI, 1);
				fx.pop('BLOCKED', ev.x + 10, ev.y - 50, 18, '#fff3dc', 0.8, 30);
				break;
			case 'wallHit':
				sfx('knock', { speed: 0.8 });
				wallKick = 3;
				fx.burst('chip', WORLD.wallX, WORLD.groundY - 40, null, 0.4);
				if (ev.broken) {
					sfx('clank', { speed: 0.6 });
					fx.burst('chip', WORLD.wallX, WORLD.groundY - 40, null, 2);
					fx.pop('WALL DOWN', WORLD.wallX, WORLD.groundY - 100, 18, '#fff3dc', 0.9, 30);
				}
				break;
			case 'split':
				sfx('split');
				fx.burst('ink', ev.x, ev.y, null, 0.4);
				break;
			case 'wave':
				if (ev.index > 0) banner(`Wave ${ev.index + 1}`, `of ${ev.total}`, false, 1200);
				sfx('horn', { volume: 0.6 });
				break;
			case 'helperShot':
				sfx('twang', { speed: 1.5, volume: 0.35 });
				helperShot = 0;
				break;
			case 'bossWindup': {
				const b = battle.boss;
				if (ev.kind === 'charge') {
					sfx('growl');
					if (b) {
						const w = hitShapes(b).weak!;
						fx.pop('HIT THE GLOW!', w.x, w.y - 40, 18, art.palette(act).accent, 1.2, 10);
					}
				} else if (ev.kind === 'guard') {
					sfx('clank', { speed: 0.5 });
				} else {
					sfx('growl', { speed: 1.3, volume: 0.6 });
				}
				break;
			}
			case 'bossStagger': {
				sfx('clank', { speed: 0.6 });
				sfx('roar', { speed: 1.4, volume: 0.6 });
				fx.shake(9);
				fx.stop(0.14);
				const b = battle.boss;
				if (b) fx.pop('STAGGERED!', b.x, hitShapes(b).head.y - 50, 26, art.palette(act).accent, 1.2, 20);
				haptic(30);
				break;
			}
			case 'bossAct':
				if (ev.kind === 'charge') {
					sfx('whoosh', { speed: 0.5 });
					fx.shake(4);
				} else if (ev.kind === 'summon') sfx('horn', { speed: 1.2, volume: 0.6 });
				break;
			case 'bossEnrage': {
				sfx('roar');
				fx.shake(6);
				const b = battle.boss;
				if (b) fx.pop('ENRAGED', b.x, hitShapes(b).head.y - 50, 22, '#ff5a5a', 1.2, 20);
				break;
			}
			case 'bossDown':
				sfx('roar', { speed: 0.8 });
				fx.slowmo(0.22, 1.4);
				fx.shake(14);
				fx.burst('blast', ev.x, ev.y - 80, null, 2.5);
				fx.burst('gold', ev.x, ev.y - 100, null, 1.5);
				break;
			case 'won':
				fx.slowmo(0.3, FX.finalSlowmo);
				setTimeout(() => {
					sfx('win');
					banner(setup!.kind === 'boss' ? 'Boss down' : 'Clear', '', false, 1500);
				}, 300);
				input.enabled = false;
				input.cancel();
				coach.hide();
				break;
			case 'lost':
				sfx('lose');
				stopMusic();
				fx.dimTarget = 0.6;
				fx.slowmo(0.3, 1.2);
				banner('Fallen', '', true, 2200);
				input.enabled = false;
				input.cancel();
				coach.hide();
				break;
		}
	}

	// ---------- The loop ----------
	k.onUpdate(() => {
		const dt = Math.min(k.dt(), 0.05);
		fx.update(dt);
		if (paused) return;
		time += dt;
		input.update(dt);
		if (fx.hitStop > 0) fx.hitStop -= dt;
		else battle.update(dt * fx.timeScale);
		sinceShot += dt;
		sinceHurt += dt;
		helperShot += dt;
		wallKick *= Math.max(0, 1 - dt * 12);
		for (const ev of battle.drain()) onEvent(ev);
		// Trails follow the arrows.
		const alive = new Set<number>();
		for (const a of battle.arrows) {
			alive.add(a.uid);
			const t = trails.get(a.uid) ?? [];
			t.push({ x: a.x, y: a.y });
			if (t.length > (a.owner === 'crown' ? 14 : 7)) t.shift();
			trails.set(a.uid, t);
		}
		for (const id of trails.keys()) if (!alive.has(id)) trails.delete(id);
		hud.update(battle);

		// Tutorial pacing.
		if (tut) {
			tutT += dt;
			if (tut === 2 && (battle.tally.kills > 0 || tutT > 9)) tutStep(3, '<b>Kill streaks</b> fill the combo meter. A <b>miss</b> resets the streak.');
			else if (tut === 3 && tutT > 6) tutStep(5, '<b>Flyers</b>: aim high. <b>Shields</b>: lob over. <b>Rocks</b>: shoot them down.');
			else if ((tut === 4 || tut === 5) && tutT > 6) {
				tut = 0;
				coach.hide();
			}
		}

		// The end of the fight.
		if (battle.outcome && !ended) {
			endT += dt;
			if (endT > (battle.outcome === 'won' ? 1.7 : 2.6)) {
				ended = true;
				finish();
			}
		}
	});

	function finish() {
		const outcome = battle.outcome!;
		finishBattle(run, meta, outcome, battle.hp, battle.tally);
		persist();
		coach.hide();
		if (run.result) {
			clearLayers();
			k.go('summary');
			return;
		}
		// The reward shows over the quiet battlefield.
		resolvePending();
	}
}
