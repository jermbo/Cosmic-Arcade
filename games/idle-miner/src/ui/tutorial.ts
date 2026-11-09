// The tutorial: the coach bubble that points at the next step.

import { sfx } from '../audio.ts';
import { TILE_ORE } from '../core/tiles.ts';
import { cellX, cellY } from '../core/grid.ts';
import { tilesOf } from '../core/planet-map.ts';
import { fmt } from '../core/format.ts';
import { countOf } from '../core/machine-count.ts';
import { buildCost } from '../core/prices.ts';
import { panelOpen } from './modal.ts';
import { session } from '../session.ts';
import { $, ui } from './elements.ts';
import { updateCard } from './planet-card.ts';
import { pv, space } from '../views.ts';

export function coach(text: string | null, target?: HTMLElement | { x: number; y: number; h?: number } | null, anchor?: HTMLElement) {
	document.querySelectorAll('.is-coach').forEach((el) => el.classList.remove('is-coach'));
	if (!text) {
		ui.coach.hidden = true;
		return;
	}
	if (ui.coachText.textContent !== text) {
		ui.coachText.textContent = text;
		ui.coach.hidden = true;
	}
	ui.coach.hidden = false;
	let tx = session.W / 2;
	let ty = session.H / 2;
	let th = 0;
	if (target instanceof HTMLElement) {
		target.classList.add('is-coach');
		const r = (anchor ?? target).getBoundingClientRect();
		tx = r.left + r.width / 2;
		ty = r.top;
		th = r.height;
	} else if (target) {
		tx = target.x;
		ty = target.y;
		th = target.h ?? 0;
	}
	const bw = ui.coach.offsetWidth;
	const bh = ui.coach.offsetHeight;
	const left = Math.max(10, Math.min(session.W - bw - 10, tx - bw / 2));
	const below = ty + th / 2 < session.H * 0.5;
	const top = below ? ty + th + 14 : ty - bh - 14;
	ui.coach.style.left = `${left}px`;
	ui.coach.style.top = `${Math.max(10, Math.min(session.H - bh - 10, top))}px`;
}

export function updateTutorial() {
	pv.highlight = [];
	space.pointAt = -1;
	if (session.g.tutorial >= 99 || panelOpen()) {
		coach(null);
		return;
	}
	const p0 = session.g.planets[0];
	const drills = countOf(session.g, 0, 'drill');
	const step = session.g.tutorial;
	const advance = (n: number) => {
		session.g.tutorial = n;
	};
	if (step === 0) {
		if (session.g.stats.taps >= 8 && session.g.credits >= buildCost(session.g, 0, 'drill')) advance(1);
		else if (session.view === 'space') {
			space.pointAt = 0;
			const p = space.screenPos(0);
			coach(session.g.stats.taps === 0 ? 'Tap Cinder to mine ore. Each tap earns credits.' : `Keep tapping! A drill costs ${fmt(buildCost(session.g, 0, 'drill'))}.`, { x: p.x, y: p.y - p.r, h: p.r * 2 + 36 });
		} else coach(null);
		return;
	}
	if (step === 1) {
		if (session.view === 'planet' && pv.pi === 0) return advance(2);
		if (session.view === 'space') {
			if (space.selected !== 0) {
				space.selected = 0;
				updateCard();
			}
			const btn = document.getElementById('card-open');
			if (btn) coach('You can afford a drill. Open Cinder to build your first factory.', btn, ui.card);
		}
		return;
	}
	if (session.view !== 'planet' || pv.pi !== 0) {
		if (step <= 4 && drills === 0) return advance(1);
		if (step <= 4) {
			coach('Open Cinder to keep building.', null);
			return;
		}
	}
	if (step === 2) {
		if (drills > 0) return advance(4);
		if (pv.tool === 'drill') return advance(3);
		coach('Pick the Drill.', ui.toolbar.querySelector<HTMLElement>('[data-tool="drill"]'), ui.pvTop);
		return;
	}
	if (step === 3) {
		if (drills > 0) return advance(4);
		if (pv.tool !== 'drill') return advance(2);
		const tiles = tilesOf(0);
		const pad = p0.cells.findIndex((m) => m?.t === 'pad');
		const ores = [...tiles.keys()].filter((i) => tiles[i] === TILE_ORE && !p0.cells[i]);
		ores.sort((a, b) => dist(a, pad) - dist(b, pad));
		pv.highlight = ores.slice(0, 3);
		const c = pv.cellCenter(ores[0]);
		coach('Tap a glowing ore tile to place the drill.', { x: c.x, y: c.y - pv.ts * 0.5, h: pv.ts });
		return;
	}
	if (step === 4) {
		if (pv.tool && pv.tool !== 'belt' && countOf(session.g, 0, 'belt') === 0) {
			coach('Pick the Belt. Then drag from the drill to the launch pad.', ui.toolbar.querySelector<HTMLElement>('[data-tool="belt"]'), ui.pvTop);
			return;
		}
		const flowing = p0.pad.length > 0 || session.g.stats.flights > 0 || p0.ships.some((s) => s.cargo.length > 0 || s.ph !== 0);
		if (flowing) return advance(5);
		const drill = p0.cells.findIndex((m) => m?.t === 'drill');
		const pad = p0.cells.findIndex((m) => m?.t === 'pad');
		pv.highlight = [drill, pad];
		const c = pv.cellCenter(pad);
		const dc = pv.cellCenter(drill);
		const belts = countOf(session.g, 0, 'belt');
		coach(belts === 0 ? 'Now drag from the drill to the launch pad. Belts follow your finger.' : 'Connect the belts to the launch pad (the round pad). Arrows show the way items move.', { x: (c.x + dc.x) / 2, y: Math.min(c.y, dc.y) - pv.ts * 0.5, h: Math.abs(c.y - dc.y) + pv.ts });
		return;
	}
	if (step === 5) {
		if (session.view === 'space') return advance(6);
		if (session.g.stats.flights > 0) return advance(6);
		coach('Ore is on its way! Ships fly it home to sell. Go back to watch.', $('btn-back'));
		return;
	}
	if (step === 6) {
		if (session.g.stats.flights > 0 || session.g.goals.includes('ship')) {
			advance(7);
			tutorialEndAt = session.time + 7;
			return;
		}
		if (session.view === 'space') {
			{
				const h = space.screenHome();
				coach('Your ship is flying home. Each landing sells the cargo.', { x: h.x, y: h.y - h.r, h: h.r * 3 });
			}
		} else coach(null);
		return;
	}
	if (step === 7) {
		coach('Nice! Tap the NEXT bar at the top any time to see what to do.', { x: session.W / 2, y: session.H * 0.62, h: 0 });
		if (session.time > tutorialEndAt) advance(99);
	}
}

let tutorialEndAt = 0;

export function dist(a: number, b: number) {
	return Math.abs(cellX(a) - cellX(b)) + Math.abs(cellY(a) - cellY(b));
}

/** Adds the listeners. main.ts calls it once, at boot. */
export function initTutorial() {
	$('coach-skip').addEventListener('click', () => {
		session.g.tutorial = 99;
		coach(null);
		pv.highlight = [];
		space.pointAt = -1;
		sfx.click();
	});
}
