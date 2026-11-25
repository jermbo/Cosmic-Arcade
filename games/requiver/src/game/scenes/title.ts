// The title: an archer on a rock at sundown, loosing arrows at the sky. Menus in the DOM.

import { art } from '../../art/index.ts';
import type { SkyView } from '../../art/types.ts';
import { META, PHYSICS, WORLD } from '../../rules/data/balance.ts';
import { button, clearLayers, h, icon, onBack, root } from '../../ui/dom.ts';
import { confirmPanel, howToPanel, settingsPanel, upgradesPanel } from '../../ui/panels.ts';
import { music, sfx } from '../audio.ts';
import { continueRun, startNewRun } from '../flow.ts';
import { k, sceneSetup, visibleWorld } from '../k.ts';
import { game } from '../state.ts';
import { canInstall, isStandalone, promptInstall } from '../pwa.ts';

let refreshInstallMenu: (() => void) | null = null;

/** Rebuilds the title menu when the browser offers install (or after install). */
export function refreshInstallMenuIfOpen() {
	refreshInstallMenu?.();
}

interface DemoArrow {
	x: number;
	y: number;
	vx: number;
	vy: number;
	trail: { x: number; y: number }[];
	stuck: boolean;
	age: number;
}

export function titleScene() {
	sceneSetup();
	clearLayers();
	const meta = game.save.meta;
	const run = game.save.run;
	const act = run ? run.act : 0;
	let time = 0;
	let shotT = 1.6;
	let sinceShot = 9;
	let angle = -0.55;
	const arrows: DemoArrow[] = [];
	const sky: SkyView = { act, dusk: 0.22, time: 0, view: visibleWorld(), dim: 0, seed: 7 };
	music(act, false);
	document.documentElement.style.setProperty('--accent', art.palette(act).accent);

	// ---------- Menu ----------
	const menu = h('nav', { class: 'menu', 'aria-label': 'Main menu' });
	const fill = () => {
		menu.replaceChildren();
		if (game.save.run && !game.save.run.result) menu.append(button(h('span', { class: 'row', style: 'gap:8px;align-items:center' }, icon('play', 18), 'Continue'), () => continueRun(), 'btn--accent'));
		menu.append(
			button(
				h('span', { class: 'row', style: 'gap:8px;align-items:center' }, icon('bow', 18), 'New run'),
				() => {
					const go = () => startNewRun(() => {});
					if (game.save.run && !game.save.run.result) {
						confirmPanel('Start over?', 'Your run in progress will be lost.', 'New run', go);
					} else go();
				},
				game.save.run ? '' : 'btn--accent',
			),
			button(h('span', { class: 'row', style: 'gap:8px;align-items:center' }, icon('feather', 18), `Upgrades · ${meta.feathers}`), () => upgradesPanel(fill)),
			button(h('span', { class: 'row', style: 'gap:8px;align-items:center' }, icon('target', 18), 'How to play'), () => howToPanel(() => {})),
			button(h('span', { class: 'row', style: 'gap:8px;align-items:center' }, icon('gear', 18), 'Settings'), () => settingsPanel(fill)),
		);
		if (canInstall()) menu.append(button('Install app', () => promptInstall().then(fill), 'btn--small'));
		if (!isStandalone()) menu.append(h('a', { class: 'btn btn--small btn--ink', href: '../', style: 'text-decoration:none' }, icon('back', 16), 'Back to arcade'));
		const best = meta.best;
		menu.append(h('div', { class: 'menu__best' }, best ? `Best ${best.score.toLocaleString('en')} · act ${best.act}${best.won ? ' · won' : ''} · ${meta.runs} runs` : `${META.currency} buy upgrades between runs.`));
	};
	fill();
	const screen = h(
		'div',
		{ class: 'title' },
		h('div', { class: 'logo' }, h('h1', { class: 'logo__word' }, 'Re', h('span', {}, 'Q'), 'uiver'), h('div', { class: 'logo__tag' }, 'Hold the line until the sun goes down')),
		menu,
	);
	root.append(screen);
	refreshInstallMenu = fill;
	k.onSceneLeave(() => {
		refreshInstallMenu = null;
		screen.remove();
	});
	onBack(() => {});

	// ---------- The scene ----------
	k.add([
		{
			draw() {
				sky.view = visibleWorld();
				sky.view.x -= 30;
				sky.view.y -= 30;
				sky.view.w += 60;
				sky.view.h += 60;
				sky.time = time;
				art.sky(sky);
				art.land(sky);
				for (const a of arrows) {
					art.arrow({ x: a.x, y: a.y, angle: Math.atan2(a.vy, a.vx), kind: a.stuck ? 'stuck' : 'player', trail: a.trail, fire: false, ice: false, explosive: false, opacity: a.stuck ? Math.max(0, 1 - (a.age - 4) / 2) : 1, act, length: a.stuck ? 0.72 : 1 });
				}
				const pull = shotT < 0.7 ? Math.min(1, (0.7 - shotT) / 0.5) : 0;
				art.archer({ x: WORLD.archerX, y: WORLD.groundY - 12, angle, pull, sinceShot, sinceHurt: 9, time, act, bonus: null, dead: false, sinceDead: 0 });
			},
		},
	]);

	k.onUpdate(() => {
		const dt = Math.min(k.dt(), 0.05);
		time += dt;
		sinceShot += dt;
		shotT -= dt;
		angle += (-0.62 + Math.sin(time * 0.4) * 0.12 - angle) * Math.min(1, dt * 2);
		if (shotT <= 0) {
			shotT = 2.6 + Math.random() * 1.2;
			sinceShot = 0;
			const v = PHYSICS.maxSpeed * (0.78 + Math.random() * 0.15);
			arrows.push({ x: WORLD.bowX, y: WORLD.bowY, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, trail: [], stuck: false, age: 0 });
			sfx('twang', { volume: 0.25 });
		}
		for (const a of arrows) {
			a.age += dt;
			if (a.stuck) continue;
			a.vy += PHYSICS.gravity * dt;
			a.x += a.vx * dt;
			a.y += a.vy * dt;
			a.trail.push({ x: a.x, y: a.y });
			if (a.trail.length > 7) a.trail.shift();
			if (a.y >= WORLD.groundY) {
				a.y = WORLD.groundY;
				a.stuck = true;
				a.age = 0;
				a.trail = [];
			}
		}
		for (let i = arrows.length - 1; i >= 0; i--) if ((arrows[i].stuck && arrows[i].age > 6) || arrows[i].x > 1500) arrows.splice(i, 1);
	});
}
