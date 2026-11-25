// The act map: spots from left to right, the boss on the horizon, the sun going down as you go.

import { art } from '../../art/index.ts';
import type { MapNodeView, SkyView } from '../../art/types.ts';
import { ACTS } from '../../rules/data/acts.ts';
import { SPOTS } from '../../rules/data/spots.ts';
import { nodeById, type MapNode } from '../../rules/map.ts';
import { choices, dusk, runStats } from '../../rules/run.ts';
import { button, clearLayers, h, hasPanel, icon, onBack, panel, pop, root } from '../../ui/dom.ts';
import { slotsRow } from '../../ui/hud.ts';
import { buildPanel, confirmPanel, howToPanel, settingsPanel } from '../../ui/panels.ts';
import { music, sfx } from '../audio.ts';
import { abandonRun, goTitle, pickSpot, resolvePending } from '../flow.ts';
import { k, sceneSetup, visibleWorld } from '../k.ts';
import { game } from '../state.ts';

const LEFT = 120;
const RIGHT = 830;
const TOP = 156;
const BOTTOM = 404;

export function mapScene() {
	sceneSetup();
	const run = game.save.run;
	if (!run) {
		goTitle();
		return;
	}
	const meta = game.save.meta;
	const map = run.map;
	const act = run.act;
	let time = 0;
	let hover = -1;
	let focus = 0;
	let walking: { from: { x: number; y: number }; to: { x: number; y: number }; t: number; id: number } | null = null;
	const sky: SkyView = { act, dusk: dusk(run), time: 0, view: visibleWorld(), dim: 0, seed: run.seed % 997 };
	music(act, false);
	document.documentElement.style.setProperty('--accent', art.palette(act).accent);

	const pos = (n: MapNode) => {
		if (n.type === 'boss') return { x: RIGHT + 10, y: (TOP + BOTTOM) / 2 + 20 };
		return { x: LEFT + (n.row / (map.rows - 1)) * (RIGHT - LEFT), y: TOP + n.y * (BOTTOM - TOP) };
	};
	const startPos = { x: 44, y: (TOP + BOTTOM) / 2 };
	const open = () => choices(run);

	// ---------- Top bar ----------
	const stats = runStats(run, meta);
	const menu = () => {
		const layer = panel({
			title: 'Menu',
			narrow: true,
			body: h(
				'div',
				{ class: 'stack' },
				button('Resume', () => pop(layer), 'btn--accent'),
				button('Settings', () => settingsPanel(() => {})),
				button('How to play', () => howToPanel(() => {})),
				button('Abandon run', () => confirmPanel('Abandon this run?', 'It ends now and pays out what you earned so far.', 'Abandon', () => abandonRun())),
				button('Save and quit', () => goTitle()),
			),
			onBack: () => pop(layer),
		});
	};
	const bar = h(
		'div',
		{ class: 'mapbar' },
		h('div', { class: 'chip' }, icon('hp', 15), `${run.hp} / ${stats.maxHp}`),
		h('div', { class: 'chip' }, icon('coin', 15), String(run.gold)),
		h('button', { class: 'btn btn--small', type: 'button', 'aria-label': 'Your boosts', onclick: () => buildPanel(run) }, slotsRow(run, stats.slots)),
		h('span', { class: 'spacer' }),
		h('div', { class: 'act-name' }, `${act + 1}. ${ACTS[act].name}`),
		button(icon('pause', 20), menu, 'btn--icon', { 'aria-label': 'Menu' }),
	);
	root.append(bar);
	const hint = h('div', { class: 'map-hint chip' }, 'Pick your next spot');
	root.append(hint);
	k.onSceneLeave(() => {
		bar.remove();
		hint.remove();
	});
	onBack(menu);

	// ---------- Draw ----------
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
				const choicesNow = walking ? [] : open().map((n) => n.id);
				const nodes: MapNodeView[] = map.nodes.map((n) => {
					const p = pos(n);
					const current = run.at === n.id;
					const state: MapNodeView['state'] = current
						? 'current'
						: run.visited.includes(n.id)
							? 'visited'
							: choicesNow.includes(n.id)
								? 'open'
								: run.at !== null && n.row <= nodeById(map, run.at).row
									? 'past'
									: 'locked';
					return { id: n.id, x: p.x, y: p.y, icon: SPOTS[n.type]?.icon ?? 'fight', state, boss: n.type === 'boss', hover: hover === n.id || (focusNode()?.id === n.id && keyMode) };
				});
				const edges = map.nodes.flatMap((n) =>
					n.next.map((id) => {
						const m = nodeById(map, id);
						const walked = run.visited.includes(n.id) && run.visited.includes(id);
						const isOpen = run.at === n.id && !walking;
						return { from: pos(n), to: pos(m), state: (walked ? 'walked' : isOpen ? 'open' : 'locked') as 'walked' | 'open' | 'locked' };
					}),
				);
				// The camp you set out from, with lines to the first row.
				for (const n of map.nodes.filter((x) => x.row === 0)) edges.push({ from: startPos, to: pos(n), state: run.at === null ? 'open' : run.visited[0] === n.id ? 'walked' : 'locked' });
				nodes.unshift({ id: -1, x: startPos.x, y: startPos.y, icon: 'start', state: run.at === null ? 'current' : 'visited', boss: false, hover: false });
				art.map({ act, dusk: sky.dusk, time, nodes, edges, boss: ACTS[act].boss });
				// The archer stands at the current spot, or walks to the next.
				let at = run.at === null ? startPos : pos(nodeById(map, run.at));
				if (walking) {
					const t = Math.min(1, walking.t);
					const e = t * t * (3 - 2 * t);
					at = { x: walking.from.x + (walking.to.x - walking.from.x) * e, y: walking.from.y + (walking.to.y - walking.from.y) * e };
				}
				art.archer({ x: at.x, y: at.y - 18, angle: -0.3, pull: 0, sinceShot: 9, sinceHurt: 9, time, act, bonus: null, dead: false, sinceDead: 0, walking: !!walking, scale: 0.62 });
			},
		},
	]);

	// ---------- Input ----------
	let keyMode = false;
	const focusNode = () => open()[focus % Math.max(1, open().length)];
	const choose = (n: MapNode | undefined) => {
		if (!n || walking || hasPanel()) return;
		sfx('step');
		const from = run.at === null ? startPos : pos(nodeById(map, run.at));
		walking = { from, to: pos(n), t: 0, id: n.id };
		hint.remove();
	};
	const nodeAt = (screen: { x: number; y: number }) => {
		const w = k.toWorld(k.vec2(screen.x, screen.y));
		let best: MapNode | undefined;
		let bestD = 38;
		for (const n of open()) {
			const p = pos(n);
			const d = Math.hypot(p.x - w.x, p.y - w.y);
			if (d < bestD) {
				bestD = d;
				best = n;
			}
		}
		return best;
	};
	k.onMouseRelease(() => {
		if (hasPanel()) return;
		keyMode = false;
		choose(nodeAt(k.mousePos()));
	});
	k.onMouseMove(() => {
		hover = nodeAt(k.mousePos())?.id ?? -1;
		k.setCursor(hover >= 0 ? 'pointer' : 'default');
	});
	const step = (d: number) => {
		if (hasPanel()) return;
		keyMode = true;
		const list = open();
		if (!list.length) return;
		focus = (focus + d + list.length) % list.length;
		sfx('click', { volume: 0.4 });
	};
	k.onKeyPress(['up', 'left', 'w', 'a'], () => step(-1));
	k.onKeyPress(['down', 'right', 's', 'd'], () => step(1));
	k.onKeyPress(['enter', 'space'], () => keyMode && choose(focusNode()));
	k.onGamepadButtonPress(['dpad-up', 'dpad-left'], () => step(-1));
	k.onGamepadButtonPress(['dpad-down', 'dpad-right'], () => step(1));
	k.onGamepadButtonPress('south', () => {
		if (!keyMode) step(0);
		else choose(focusNode());
	});
	k.onKeyPress('escape', () => (hasPanel() ? null : menu()));
	k.onGamepadButtonPress('start', () => (hasPanel() ? null : menu()));

	k.onUpdate(() => {
		const dt = Math.min(k.dt(), 0.05);
		time += dt;
		if (walking) {
			walking.t += dt * 1.8;
			if (walking.t >= 1) {
				const id = walking.id;
				walking = null;
				pickSpot(id);
			}
		}
	});

	// Something may already wait here (a reward after a reload, a shop, an event follow-up).
	clearLayers();
	setTimeout(() => {
		if (k.getSceneName() === 'map') resolvePending();
	}, 250);
}
