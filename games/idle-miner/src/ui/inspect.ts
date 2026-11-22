// The inspect card: what a selected machine does, why it is stuck, and its buttons.

import { sfx } from '../audio.ts';
import { MACHINES } from '../content/machines.ts';
import { beltSpeed, levelSpeed, pylonBoost } from '../core/levels.ts';
import { TILE_ORE } from '../core/tiles.ts';
import { cellX, cellY } from '../core/grid.ts';
import { tilesOf } from '../core/planet-map.ts';
import { fmt } from '../core/format.ts';
import { fixAt, fixDir } from '../core/blocks.ts';
import type { Block } from '../core/blocks.ts';
import { removeAt, rotateAt, upgradeMachine } from '../core/build.ts';
import { crewOf } from '../core/crew.ts';
import { boostAt, bridgeSpan } from '../core/layout.ts';
import { machineUpCost } from '../core/prices.ts';
import { padCap } from '../core/ships.ts';
import { openShips } from './panels/ships.ts';
import { burst, popup, ring } from '../view/fx.ts';
import { session } from '../session.ts';
import { ui } from './elements.ts';
import { updateToolbar } from './toolbar.ts';
import { buzz } from './vibrate.ts';
import { pv } from '../views.ts';

/** cell the inspect panel's Show button jumps to */
let inspectGoto = -1;

export function select(c: number | null) {
	pv.selected = c;
	if (c !== null) pv.tool = null;
	updateToolbar();
	updateInspect();
}

export function updateInspect() {
	const c = pv.selected;
	const m = c !== null && session.view === 'planet' ? session.g.planets[pv.pi].cells[c] : null;
	if (!m || c === null) {
		ui.inspect.hidden = true;
		ui.toolbar.classList.remove('is-under');
		if (c !== null) pv.selected = null;
		return;
	}
	ui.toolbar.classList.add('is-under');
	const def = MACHINES[m.t];
	const p = session.g.planets[pv.pi];
	const boost = boostAt(p, c, pv.pi);
	const crew = crewOf(p);
	const crewMult = m.t === 'drill' ? crew.drill : crew.machine;
	let stats = '';
	let desc = def.desc;
	if (m.t === 'drill') {
		const ore = tilesOf(pv.pi, session.g.blasted[pv.pi])[c] === TILE_ORE;
		stats = `<span>Digs <b>${((levelSpeed(m.lv) * boost * crewMult) / def.time).toFixed(2)}</b>/s</span>`;
		if (!ore) desc = 'This drill is not on ore.';
	} else if (m.t === 'belt') {
		const sp = beltSpeed(session.g);
		stats = `<span>Speed <b>${sp.toFixed(1)}</b> tiles/s</span><span>Carries up to <b>${(sp * 2).toFixed(1)}</b>/s</span>`;
		desc = 'Tap Turn, or drag a new line over it. Research Mag Belts for speed.';
	} else if (m.t === 'bridge') {
		const span = m.link !== undefined ? bridgeSpan(c, m.link) : 0;
		desc = m.end ? 'Items land here from the other end, then go on.' : 'Items go in here and hop to the other end.';
		const over = Math.max(0, span - 1);
		stats = `<span>Hops over <b>${over}</b> tile${over === 1 ? '' : 's'}</span>`;
	} else if (m.t === 'cross') {
		stats = '';
	} else if (m.t === 'pad') {
		const cap = padCap(p);
		stats = `<span>Stock <b>${p.pad.length}</b>/${cap}</span><span>Ships <b>${p.ships.length}</b></span>`;
	} else if (m.t === 'pylon') {
		stats = `<span>Boost <b>+${Math.round(pylonBoost(m.lv) * 100)}%</b> to the 8 tiles around</span>`;
	} else {
		const jobs = (levelSpeed(m.lv) * boost * crewMult) / def.time;
		stats = `<span>Makes <b>${(jobs * def.outCount).toFixed(2)}</b>/s</span><span>Holds <b>${m.inb.length}</b> in</span>`;
	}
	if (boost > 1 && m.t !== 'pylon') stats += `<span>Pylon <b>+${Math.round((boost - 1) * 100)}%</b></span>`;
	if (crewMult > 1 && def.time > 0) stats += `<span>Crew <b>+${Math.round((crewMult - 1) * 100)}%</b></span>`;
	// Blocked lines: say why, and offer a way out.
	const blocks = pv.blocks;
	const dead = blocks.find((b): b is Extract<Block, { kind: 'dead' }> => b.kind === 'dead' && b.cell === c);
	const slowHere = blocks.some((b) => b.kind === 'slow' && b.cell === c);
	const held = blocks.find((b) => b.from === c && b.cell !== c);
	let warn = '';
	let fixBtn = '';
	inspectGoto = -1;
	if (dead) {
		if (fixDir(session.g, pv.pi, c) !== null) {
			warn = `Blocked: it ${dead.why}.`;
			fixBtn = '<button class="btn btn--small btn--fix" data-act="fix">Fix</button>';
		} else warn = `Blocked: it ${dead.why}, and no side is open. Lay a belt next to it.`;
	} else if (slowHere && m.t === 'pad') {
		if (p.pad.length >= padCap(p)) warn = 'Pad is full. Buy ships or cargo space.';
	} else if (slowHere) warn = 'Backed up: items come in faster than it works. Upgrade it or build another.';
	else if (held) {
		const what = session.g.planets[pv.pi].cells[held.cell]!;
		warn = held.kind === 'dead' ? 'Blocked: the line ends in a dead end.' : `Waiting: the ${MACHINES[what.t].short.toLowerCase()} down the line can't keep up.`;
		inspectGoto = held.cell;
		fixBtn = '<button class="btn btn--small btn--fix" data-act="goto">Show</button>';
	}
	const canUp = def.maxLv > 1;
	const maxed = m.lv >= def.maxLv;
	const upCost = canUp && !maxed ? machineUpCost(pv.pi, m) : 0;
	const lvText = canUp ? `<small>Level ${m.lv}${maxed ? ' (max)' : ''}</small>` : '';
	const buttons =
		m.t === 'pad'
			? `${fixBtn}<button class="btn btn--small" data-act="ships">Ships</button>`
			: `${fixBtn}${canUp ? `<button class="btn btn--small" data-act="upgrade" ${!maxed && session.g.credits >= upCost ? '' : 'disabled'}>${maxed ? 'Max level' : `Upgrade ${fmt(upCost)}`}</button>` : ''}
				${m.t !== 'pylon' && m.t !== 'cross' && m.t !== 'bridge' ? '<button class="btn btn--small btn--ghost" data-act="rotate">Turn</button>' : ''}
				<button class="btn btn--small btn--danger" data-act="remove">Remove</button>`;
	const html = `<div class="inspect__head"><b style="color:${def.color}">${def.name}</b>${lvText}<button class="inspect__close" data-act="close" aria-label="Close">×</button></div><p>${desc}</p>${warn ? `<p class="inspect__warn${dead || held?.kind === 'dead' ? '' : ' is-slow'}">${warn}</p>` : ''}<div class="inspect__stats">${stats}</div><div class="inspect__row">${buttons}</div>`;
	if (ui.inspect.dataset.html !== html) {
		ui.inspect.dataset.html = html;
		ui.inspect.innerHTML = html;
	}
	ui.inspect.hidden = false;
}

export function inspectAct(act: string) {
	const c = pv.selected;
	if (c === null) return;
	const x = cellX(c);
	const y = cellY(c);
	if (act === 'upgrade') {
		if (upgradeMachine(session.g, pv.pi, x, y)) {
			sfx.upgrade();
			buzz(12);
			const s = pv.cellCenter(c);
			const m = session.g.planets[pv.pi].cells[c]!;
			burstUpgrade(s.x, s.y, MACHINES[m.t].color);
		} else sfx.error();
	} else if (act === 'rotate') {
		rotateAt(session.g, pv.pi, x, y);
		sfx.click();
	} else if (act === 'fix') {
		if (fixAt(session.g, pv.pi, c)) {
			sfx.place();
			const s = pv.cellCenter(c);
			popupAt(s.x, s.y, 'Fixed', '#9dffb0');
		} else sfx.error();
	} else if (act === 'goto') {
		if (inspectGoto >= 0) {
			sfx.click();
			select(inspectGoto);
		}
		return;
	} else if (act === 'remove') {
		const refund = removeAt(session.g, pv.pi, x, y);
		if (refund > 0 || session.g.planets[pv.pi].cells[c] === null) {
			sfx.remove();
			const s = pv.cellCenter(c);
			popupAt(s.x, s.y, '+' + fmt(refund), '#9dffb0');
			select(null);
		}
	} else if (act === 'ships') openShips(pv.pi);
	else if (act === 'close') select(null);
	updateInspect();
	updateToolbar();
}

function burstUpgrade(x: number, y: number, color: string) {
	ring(x, y, color, 8, 140, 0.5);
	burst(x, y, color, 18, 220, { size: 3, life: 0.6 });
	burst(x, y, '#ffffff', 6, 120, { size: 2, life: 0.4 });
	popup(x, y - 26, 'LEVEL UP', '#ffffff', 14);
}

function popupAt(x: number, y: number, text: string, color: string) {
	popup(x, y, text, color, 13);
}

/** Adds the listeners. main.ts calls it once, at boot. */
export function initInspect() {
	ui.inspect.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
		if (!b || b.disabled) return;
		inspectAct(b.dataset.act!);
	});
}
