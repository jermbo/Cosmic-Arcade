// Idle Orbit: start-up, the main loop, input, HUD, planet card, toolbar, tutorial.

import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-700.css';
import './style.css';

import { initAudio, setVolumes, sfx, suspendAudio } from './audio.ts';
import { BUILD_ORDER, COLS, MACHINES, PLANETS, TILE_ORE, beltSpeed, levelSpeed, pylonBoost, shipCargo } from './core/data.ts';
import type { MachineType } from './core/data.ts';
import { fmt } from './core/format.ts';
import { GOALS, checkProgress, currentGoal } from './core/goals.ts';
import * as sim from './core/sim.ts';
import { clearSave, loadGame, newGame, saveGame, tilesOf } from './core/state.ts';
import type { Game } from './core/state.ts';
import { closePanel, isLocked, panelOpen, refreshPanel } from './ui/modal.ts';
import { initPanels, openAway, openConfirmNew, openNova, openPause, openResearch, openSettings, openShips } from './ui/panels.ts';
import { setupPwa } from './ui/pwa.ts';
import { machineIcon } from './view/draw.ts';
import { burst, clearFx, drawFx, popup, ring, setReducedMotion, stepFx } from './view/fx.ts';
import { PlanetView } from './view/planet.ts';
import type { Tool } from './view/planet.ts';
import { SpaceView } from './view/space.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('stage');
const ctx = canvas.getContext('2d')!;
const ui = {
	hud: $('hud'),
	credits: $('credits'),
	income: $('income'),
	dust: $('dust'),
	dustN: $('dust-n'),
	research: $('btn-research'),
	nova: $('btn-nova'),
	goal: $('goal'),
	goalTag: $('goal-tag'),
	goalText: $('goal-text'),
	goalFill: $('goal-fill'),
	pvTop: $('pv-top'),
	pvName: $('pv-name'),
	pvSub: $('pv-sub'),
	card: $('planet-card'),
	toolbar: $('toolbar'),
	inspect: $('inspect'),
	toasts: $('toasts'),
	coach: $('coach'),
	coachText: $('coach-text'),
	title: $('title'),
	play: $('btn-play'),
	newGame: $('btn-new'),
};

// ---------- state ----------

let g: Game = loadGame() ?? newGame();
let hadSave = !!loadGame();
let started = false;
let view: 'space' | 'planet' = 'space';
let W = 0;
let H = 0;
let dpr = 1;
let time = 0;
let shownCredits = g.credits;
let tapCombo = 0;
let lastTapAt = 0;
let uiTimer = 0;
let saveTimer = 0;
let progressTimer = 0;
let problemWhere: { planet: number; cell: number } | null = null;
let toolbarKey = '';
let flash = 0;
let devSpeed = 1;
/** A fake game that runs behind the title screen. */
let demo: Game | null = null;

const space = new SpaceView();
const pv = new PlanetView({
	sound: (n) => sfx[n](),
	toast: (t) => toast(t, 'warn'),
	select: (c) => select(c),
	changed: () => {
		updateInspect();
		updateToolbar();
	},
});

const isPaused = () => ['pause', 'how', 'settings', 'reset', 'new'].some((id) => panelOpen(id));

initPanels({
	game: () => g,
	sound: (n) => sfx[n](),
	toast,
	afterBuy: () => {
		updateHud();
		updateToolbar();
	},
	save: () => saveGame(g),
	resetAll: () => {
		clearSave();
		g = newGame();
		hadSave = false;
		started = false;
		afterLoad();
		showTitle();
	},
	loadGame: (loaded) => {
		g = loaded;
		afterLoad();
		saveGame(g);
	},
	prestige: doPrestige,
	toTitle,
	settingsChanged: applySettings,
});

// ---------- layout ----------

function resize() {
	dpr = Math.min(2, window.devicePixelRatio || 1);
	W = window.innerWidth;
	H = window.innerHeight;
	canvas.width = Math.round(W * dpr);
	canvas.height = Math.round(H * dpr);
	relayout();
}

function relayout() {
	const goalRect = ui.goal.hidden ? ui.hud.getBoundingClientRect() : ui.goal.getBoundingClientRect();
	if (view === 'space') {
		const top = Math.max(goalRect.bottom + 6, 70);
		space.layout(W, H, top, Math.min(150, H * 0.2));
	} else {
		const topRect = ui.pvTop.getBoundingClientRect();
		const bar = ui.toolbar.getBoundingClientRect();
		const bottom = H - (ui.toolbar.hidden ? H - 8 : bar.top) + 6;
		pv.layout(W, H, topRect.bottom + 4, bottom);
	}
}

// ---------- start / title ----------

function makeDemo(): Game {
	const d = newGame();
	d.planets.forEach((p, i) => {
		p.unlocked = true;
		p.up.ships = 1;
		p.ships.push({ ph: 1, t: 0.3 + i * 0.1, cargo: [], wait: 0 });
		p.ships[0].ph = 2;
		p.ships[0].t = (i * 0.37) % 1;
	});
	return d;
}

function showTitle() {
	ui.title.hidden = false;
	ui.play.textContent = hadSave ? 'Continue' : 'Play';
	ui.newGame.hidden = !hadSave;
	ui.hud.hidden = true;
	ui.goal.hidden = true;
	ui.card.hidden = true;
	ui.pvTop.hidden = true;
	ui.toolbar.hidden = true;
	ui.inspect.hidden = true;
	ui.coach.hidden = true;
	demo = makeDemo();
	space.showLabels = false;
	view = 'space';
	space.selected = -1;
	space.pointAt = -1;
	relayout();
}

function toTitle() {
	saveGame(g);
	started = false;
	hadSave = true;
	showTitle();
}

function startGame() {
	initAudio();
	applySettings();
	ui.title.hidden = true;
	ui.hud.hidden = false;
	ui.goal.hidden = false;
	demo = null;
	space.showLabels = true;
	started = true;
	clearFx();
	sim.resetIncome();
	sim.setEvents(true);
	toSpace();
	// time away since the last save
	const away = (Date.now() - g.savedAt) / 1000;
	if (hadSave && away > 30) runAway(away);
	saveGame(g);
	hadSave = true;
	updateHud();
	sfx.buy();
}

function runAway(seconds: number) {
	const r = sim.catchUp(g, seconds);
	sim.events.length = 0;
	shownCredits = g.credits;
	if (seconds > 60 && r.earned > 0) openAway(r, sim.offlineCapHours(g));
}

function afterLoad() {
	shownCredits = g.credits;
	space.rate.fill(0);
	pv.tool = null;
	pv.selected = null;
	toolbarKey = '';
	sim.resetIncome();
	clearFx();
	applySettings();
	if (started) toSpace();
}

ui.play.addEventListener('click', startGame);
ui.newGame.addEventListener('click', () =>
	openConfirmNew(() => {
		clearSave();
		g = newGame();
		hadSave = false;
		afterLoad();
		startGame();
	}),
);
$('btn-title-settings').addEventListener('click', () => {
	initAudio();
	openSettings(true);
});

function applySettings() {
	setVolumes(g.settings.sfx, g.settings.music);
	setReducedMotion(g.settings.reduceMotion);
	document.documentElement.classList.toggle('reduce-motion', g.settings.reduceMotion);
}

// ---------- views ----------

function toSpace() {
	view = 'space';
	ui.pvTop.hidden = true;
	ui.toolbar.hidden = true;
	ui.inspect.hidden = true;
	pv.tool = null;
	select(null);
	clearFx();
	updateCard();
	relayout();
}

function toPlanet(pi: number) {
	if (!g.planets[pi].unlocked) return;
	view = 'planet';
	space.selected = -1;
	ui.card.hidden = true;
	ui.pvTop.hidden = false;
	ui.toolbar.hidden = false;
	pv.open(pi);
	ui.pvName.textContent = PLANETS[pi].name;
	ui.pvName.style.color = PLANETS[pi].light;
	toolbarKey = '';
	updateToolbar();
	clearFx();
	relayout();
	sfx.click();
}

$('btn-back').addEventListener('click', () => {
	sfx.click();
	toSpace();
});
$('btn-ships').addEventListener('click', () => {
	sfx.click();
	openShips(pv.pi);
});
$('btn-research').addEventListener('click', () => {
	sfx.click();
	openResearch();
});
$('btn-nova').addEventListener('click', () => {
	sfx.click();
	openNova();
});
$('btn-menu').addEventListener('click', () => {
	sfx.click();
	openPause();
});
ui.goal.addEventListener('click', goToGoal);

function goToGoal() {
	sfx.click();
	if (problemWhere) {
		if (view !== 'planet' || pv.pi !== problemWhere.planet) toPlanet(problemWhere.planet);
		const m = g.planets[problemWhere.planet].cells[problemWhere.cell];
		if (m?.t === 'pad') openShips(problemWhere.planet);
		else select(problemWhere.cell);
		return;
	}
	const goal = currentGoal(g);
	if (!goal) return;
	const [kind, arg] = goal.where.split(':');
	const pi = Number(arg);
	if (kind === 'space') {
		if (view !== 'space') toSpace();
		const next = g.planets.findIndex((p) => !p.unlocked);
		if (goal.id.startsWith('tap') || goal.id === 'ship') space.selected = 0;
		else if (next > 0 && /^(glacia|verdance|solara|umbra|halcyon)$/.test(goal.id)) space.selected = next;
		updateCard();
	} else if (kind === 'planet') {
		if (g.planets[pi].unlocked) toPlanet(pi);
	} else if (kind === 'ships') {
		openShips(g.planets[pi].unlocked ? pi : 0);
	} else if (kind === 'research') {
		if (g.unlocks.includes('research')) openResearch();
	} else if (kind === 'prestige') openNova();
}

// ---------- input ----------

const pointers = new Map<number, { x: number; y: number }>();

canvas.addEventListener('pointerdown', (e) => {
	initAudio();
	if (!started) return;
	canvas.setPointerCapture?.(e.pointerId);
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	if (view === 'space') spaceTap(e.clientX, e.clientY);
	else pv.pointerDown(g, e.clientX, e.clientY, e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
	if (!started) return;
	if (view === 'planet') {
		pv.pointerMove(g, e.clientX, e.clientY, e.pointerId);
		// Touch has no hover, so no ghost after the finger lifts.
		if (e.pointerType !== 'mouse' && !pointers.has(e.pointerId)) pv.hover = null;
	}
	else canvas.style.cursor = space.hit(g, e.clientX, e.clientY) !== -1 ? 'pointer' : 'default';
});
const up = (e: PointerEvent) => {
	pointers.delete(e.pointerId);
	if (!started) return;
	if (view === 'planet') {
		pv.pointerUp(g, e.clientX, e.clientY, e.pointerId);
		if (e.pointerType !== 'mouse') pv.hover = null;
	}
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', (e) => {
	pointers.delete(e.pointerId);
	pv.pointerCancel();
});
canvas.addEventListener('pointerleave', () => (pv.hover = null));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function spaceTap(x: number, y: number) {
	const hit = space.hit(g, x, y);
	if (hit >= 0) {
		const p = g.planets[hit];
		if (p.unlocked) {
			const v = sim.tap(g, hit);
			const now = performance.now();
			tapCombo = now - lastTapAt < 500 ? tapCombo + 1 : 0;
			lastTapAt = now;
			space.tapPlanet(hit, v, PLANETS[hit].color);
			sfx.tap(tapCombo);
			buzz(8);
			bumpCredits();
		} else sfx.click();
		if (space.selected !== hit) {
			space.selected = hit;
			updateCard();
		}
	} else if (hit === -2) {
		toast(`Home station. Cargo sells here. Income: ${fmt(sim.incomeRate())}/s`);
	} else {
		space.selected = -1;
		updateCard();
	}
}

function buzz(ms: number) {
	if (g.settings.vibrate) navigator.vibrate?.(ms);
}

window.addEventListener('keydown', (e) => {
	if (!started) {
		if (e.key === 'Enter' && ui.title.hidden === false && !panelOpen()) startGame();
		return;
	}
	if (panelOpen()) {
		if (e.key === 'Escape' && !isLocked()) closePanel();
		return;
	}
	const target = e.target as HTMLElement;
	if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
	if (e.key === 'Escape') {
		if (view === 'planet') {
			if (pv.tool) setTool(null);
			else if (pv.selected !== null) select(null);
			else toSpace();
		} else openPause();
		return;
	}
	if (e.key === 'Tab') {
		e.preventDefault();
		if (view === 'planet') toSpace();
		else toPlanet(space.selected >= 0 && g.planets[space.selected].unlocked ? space.selected : 0);
		return;
	}
	if (view !== 'planet') {
		if (e.key === ' ' && space.selected >= 0 && g.planets[space.selected].unlocked) {
			e.preventDefault();
			const p = space.pos[space.selected];
			spaceTap(p.x, p.y);
		}
		return;
	}
	const n = Number(e.key);
	if (n >= 1 && n <= 9) {
		const tools = availableTools();
		const t = n === 9 ? 'remove' : tools[n - 1];
		if (t) setTool(pv.tool === t ? null : t);
	}
	if (e.key === 'r' || e.key === 'R') {
		if (pv.selected !== null) {
			sim.rotateAt(g, pv.pi, pv.selected % COLS, Math.floor(pv.selected / COLS));
			sfx.click();
		}
	}
	if ((e.key === 'Delete' || e.key === 'Backspace') && pv.selected !== null) inspectAct('remove');
	if (e.key === 'u' || e.key === 'U') inspectAct('upgrade');
});

// ---------- toolbar ----------

function availableTools(): MachineType[] {
	return BUILD_ORDER.filter((t) => sim.machineUnlocked(g, t));
}

const seenTools = new Set<string>(['drill', 'belt']);

function updateToolbar() {
	if (view !== 'planet') return;
	const tools = availableTools();
	const key = tools.join(',') + '|' + pv.pi;
	if (key !== toolbarKey) {
		toolbarKey = key;
		ui.toolbar.innerHTML = '';
		tools.forEach((t, i) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'tool';
			b.dataset.tool = t;
			b.title = `${MACHINES[t].name} (${i + 1})`;
			b.setAttribute('aria-label', MACHINES[t].name);
			b.append(machineIcon(t, 34));
			b.insertAdjacentHTML('beforeend', `<span class="tool__name">${MACHINES[t].short}</span><span class="tool__cost"></span>`);
			if (!seenTools.has(t) && g.stats.playTime > 5) b.classList.add('is-new');
			ui.toolbar.append(b);
		});
		const r = document.createElement('button');
		r.type = 'button';
		r.className = 'tool tool--remove';
		r.dataset.tool = 'remove';
		r.title = 'Remove (9)';
		r.innerHTML = `<span class="tool__x"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></svg></span><span class="tool__name">Remove</span><span class="tool__cost">refund</span>`;
		ui.toolbar.append(r);
		requestAnimationFrame(relayout);
	}
	for (const b of ui.toolbar.querySelectorAll<HTMLElement>('.tool')) {
		const t = b.dataset.tool as MachineType | 'remove';
		b.classList.toggle('is-active', pv.tool === t);
		b.setAttribute('aria-pressed', String(pv.tool === t));
		if (t === 'remove') continue;
		const cost = sim.buildCost(g, pv.pi, t);
		const el = b.querySelector('.tool__cost')!;
		const txt = fmt(cost);
		if (el.textContent !== txt) el.textContent = txt;
		b.classList.toggle('is-poor', g.credits < cost);
	}
}

ui.toolbar.addEventListener('click', (e) => {
	const b = (e.target as HTMLElement).closest<HTMLElement>('.tool');
	if (!b) return;
	const t = b.dataset.tool as Tool;
	b.classList.remove('is-new');
	if (t) seenTools.add(t);
	setTool(pv.tool === t ? null : t);
});

function setTool(t: Tool) {
	pv.tool = t;
	if (t) select(null);
	sfx.click();
	updateToolbar();
}

// ---------- inspect card ----------

function select(c: number | null) {
	pv.selected = c;
	if (c !== null) pv.tool = null;
	updateToolbar();
	updateInspect();
}

function updateInspect() {
	const c = pv.selected;
	const m = c !== null && view === 'planet' ? g.planets[pv.pi].cells[c] : null;
	if (!m || c === null) {
		ui.inspect.hidden = true;
		ui.toolbar.classList.remove('is-under');
		if (c !== null) pv.selected = null;
		return;
	}
	ui.toolbar.classList.add('is-under');
	const def = MACHINES[m.t];
	const p = g.planets[pv.pi];
	const boost = sim.boostAt(p, c);
	let stats = '';
	let desc = def.desc;
	if (m.t === 'drill') {
		const ore = tilesOf(pv.pi, g.blasted[pv.pi])[c] === TILE_ORE;
		stats = `<span>Digs <b>${((levelSpeed(m.lv) * boost) / def.time).toFixed(2)}</b>/s</span>`;
		if (!ore) desc = 'This drill is not on ore.';
	} else if (m.t === 'belt') {
		const sp = beltSpeed(g.research.belt, !!g.perks.belts);
		stats = `<span>Speed <b>${sp.toFixed(1)}</b> tiles/s</span><span>Carries up to <b>${(sp * 2).toFixed(1)}</b>/s</span>`;
		desc = 'Tap Turn, or drag a new line over it. Research Mag Belts for speed.';
	} else if (m.t === 'pad') {
		const cap = 40 + shipCargo(p.up.cargo) * 2;
		stats = `<span>Stock <b>${p.pad.length}</b>/${cap}</span><span>Ships <b>${p.ships.length}</b></span>`;
	} else if (m.t === 'pylon') {
		stats = `<span>Boost <b>+${Math.round(pylonBoost(m.lv) * 100)}%</b> to the 8 tiles around</span>`;
	} else {
		const jobs = (levelSpeed(m.lv) * boost) / def.time;
		stats = `<span>Makes <b>${(jobs * def.outCount).toFixed(2)}</b>/s</span><span>Holds <b>${m.inb.length}</b> in</span>`;
	}
	if (boost > 1 && m.t !== 'pylon') stats += `<span>Pylon <b>+${Math.round((boost - 1) * 100)}%</b></span>`;
	const canUp = m.t !== 'belt' && m.t !== 'pad';
	const maxed = m.lv >= def.maxLv;
	const upCost = canUp && !maxed ? sim.machineUpCost(pv.pi, m) : 0;
	const lvText = canUp ? `<small>Level ${m.lv}${maxed ? ' (max)' : ''}</small>` : '';
	const buttons =
		m.t === 'pad'
			? `<button class="btn btn--small" data-act="ships">Ships</button>`
			: `${canUp ? `<button class="btn btn--small" data-act="upgrade" ${!maxed && g.credits >= upCost ? '' : 'disabled'}>${maxed ? 'Max level' : `Upgrade ${fmt(upCost)}`}</button>` : ''}
				${m.t !== 'pylon' ? '<button class="btn btn--small btn--ghost" data-act="rotate">Turn</button>' : ''}
				<button class="btn btn--small btn--danger" data-act="remove">Remove</button>`;
	const html = `<div class="inspect__head"><b style="color:${def.color}">${def.name}</b>${lvText}<button class="inspect__close" data-act="close" aria-label="Close">×</button></div><p>${desc}</p><div class="inspect__stats">${stats}</div><div class="inspect__row">${buttons}</div>`;
	if (ui.inspect.dataset.html !== html) {
		ui.inspect.dataset.html = html;
		ui.inspect.innerHTML = html;
	}
	ui.inspect.hidden = false;
}

ui.inspect.addEventListener('click', (e) => {
	const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
	if (!b || b.disabled) return;
	inspectAct(b.dataset.act!);
});

function inspectAct(act: string) {
	const c = pv.selected;
	if (c === null) return;
	const x = c % COLS;
	const y = Math.floor(c / COLS);
	if (act === 'upgrade') {
		if (sim.upgradeMachine(g, pv.pi, x, y)) {
			sfx.upgrade();
			buzz(12);
			const s = pv.cellCenter(c);
			const m = g.planets[pv.pi].cells[c]!;
			burstUpgrade(s.x, s.y, MACHINES[m.t].color);
		} else sfx.error();
	} else if (act === 'rotate') {
		sim.rotateAt(g, pv.pi, x, y);
		sfx.click();
	} else if (act === 'remove') {
		const refund = sim.removeAt(g, pv.pi, x, y);
		if (refund > 0 || g.planets[pv.pi].cells[c] === null) {
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

// ---------- planet card (space view) ----------

function updateCard() {
	const i = space.selected;
	if (view !== 'space' || i < 0 || !started) {
		ui.card.hidden = true;
		return;
	}
	const def = PLANETS[i];
	const p = g.planets[i];
	let html: string;
	if (p.unlocked) {
		const drills = sim.countOf(g, i, 'drill');
		const rate = space.rate[i] / 12;
		const sub = rate > 0.05 ? `${fmt(rate)}/s` : drills ? 'Starting up' : 'No factory yet';
		const tip = drills === 0 ? 'Tap the planet to mine by hand. Open it to build drills.' : `${drills} drill${drills > 1 ? 's' : ''}, ${p.ships.length} ship${p.ships.length > 1 ? 's' : ''}. Each tap mines ${fmt(sim.tapValue(g, i))}.`;
		html = `<div class="card__head"><span class="card__dot" style="color:${def.color}"></span><span class="card__title">${def.name}</span><span class="card__sub">${def.ore}<br>${sub}</span></div>
			<p>${tip}</p>
			<div class="card__row"><button class="btn" data-act="open" id="card-open">Open factory</button>${g.unlocks.includes('ships') ? `<button class="btn btn--ghost" data-act="ships">Ships</button>` : ''}</div>`;
	} else {
		const can = g.credits >= def.unlock;
		const machine = def.newMachine ? MACHINES[def.newMachine].name : '';
		const pct = Math.min(100, (g.credits / def.unlock) * 100);
		const eta = sim.incomeRate() > 0 && !can ? ` · about ${etaText((def.unlock - g.credits) / sim.incomeRate())}` : '';
		html = `<div class="card__head"><span class="card__dot" style="color:${def.color}"></span><span class="card__title">${def.name}</span><span class="card__sub">New ore: ${def.ore}</span></div>
			<p>Ore here sells for <b>${def.value}x</b> Cinder ore.${machine ? ` Unlocks the <b>${machine}</b>.` : ''}</p>
			<div class="goal__bar" style="margin-bottom:10px"><i style="width:${pct}%"></i></div>
			<div class="card__row"><button class="btn ${can ? 'btn--gold' : ''}" data-act="unlock" ${can ? '' : 'disabled'}>Unlock ${fmt(def.unlock)}${can ? '' : eta}</button></div>`;
	}
	if (ui.card.dataset.html !== html) {
		ui.card.dataset.html = html;
		ui.card.innerHTML = html;
	}
	ui.card.hidden = false;
}

function etaText(s: number) {
	if (s < 60) return `${Math.ceil(s)}s`;
	if (s < 3600) return `${Math.ceil(s / 60)} min`;
	return `${(s / 3600).toFixed(1)} h`;
}

ui.card.addEventListener('click', (e) => {
	const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
	if (!b || b.disabled) return;
	const i = space.selected;
	if (b.dataset.act === 'open') toPlanet(i);
	if (b.dataset.act === 'ships') openShips(i);
	if (b.dataset.act === 'unlock') {
		if (sim.unlockPlanet(g, i)) {
			sfx.unlock();
			buzz(30);
			const p = space.pos[i];
			ring(p.x, p.y, PLANETS[i].color, p.r, 300, 1);
			ring(p.x, p.y, '#ffffff', p.r * 0.6, 200, 0.7);
			burst(p.x, p.y, PLANETS[i].color, 40, 300, { size: 4, life: 1 });
			flash = 0.6;
			toastUnlock(`${PLANETS[i].name} unlocked`, `New ore: ${PLANETS[i].ore}. Open it to build.`);
			checkProgress(g);
			saveGame(g);
			updateCard();
		} else sfx.error();
	}
});

// ---------- HUD and goal bar ----------

function bumpCredits() {
	ui.credits.classList.add('is-bump');
	setTimeout(() => ui.credits.classList.remove('is-bump'), 120);
}

function updateHud() {
	const txt = fmt(shownCredits);
	if (ui.credits.textContent !== txt) ui.credits.textContent = txt;
	const inc = `${fmt(sim.incomeRate())} / s`;
	if (ui.income.textContent !== inc) ui.income.textContent = inc;
	ui.dust.hidden = g.stardust <= 0;
	ui.dustN.textContent = String(g.stardust);
	ui.research.hidden = !g.unlocks.includes('research');
	ui.nova.hidden = !g.unlocks.includes('prestige');
	ui.nova.classList.toggle('is-ready', sim.canPrestige(g) && sim.prestigeGain(g) >= Math.max(1, g.stardust));
}

function updateGoal() {
	const goal = currentGoal(g);
	const prob = g.tutorial >= 99 ? sim.findProblem(g) : null;
	problemWhere = prob ? { planet: prob.planet, cell: prob.cell } : null;
	if (prob) {
		ui.goal.classList.add('is-warn');
		ui.goalTag.textContent = 'Fix';
		ui.goalText.textContent = prob.text;
		ui.goalFill.style.width = '0%';
		return;
	}
	ui.goal.classList.remove('is-warn');
	if (!goal) {
		ui.goalTag.textContent = 'Done';
		ui.goalText.textContent = g.beaconLit ? 'The beacon is lit. Go nova to grow faster.' : 'All goals done!';
		ui.goalFill.style.width = '100%';
		return;
	}
	const [have, want] = goal.progress(g);
	let text = goal.text;
	const planetIdx = PLANETS.findIndex((p) => goal.id === p.name.toLowerCase());
	if (planetIdx > 0) {
		const cost = PLANETS[planetIdx].unlock;
		text = `${goal.text} · ${fmt(Math.min(g.credits, cost))} / ${fmt(cost)}`;
		ui.goalFill.style.width = `${Math.min(100, (g.credits / cost) * 100)}%`;
	} else {
		if (want > 1) text += ` (${fmt(have)}/${fmt(want)})`;
		ui.goalFill.style.width = `${(have / want) * 100}%`;
	}
	ui.goalTag.textContent = `Next ${g.goals.length + 1}/${GOALS.length}`;
	if (ui.goalText.textContent !== text) ui.goalText.textContent = text;
}

// ---------- toasts ----------

function toast(text: string, kind = '') {
	const el = document.createElement('div');
	el.className = `toast ${kind ? 'toast--' + kind : ''}`;
	el.textContent = text;
	pushToast(el, 2.2);
}

function toastUnlock(title: string, text: string) {
	const el = document.createElement('div');
	el.className = 'toast toast--unlock';
	el.innerHTML = `<strong></strong><span></span>`;
	el.querySelector('strong')!.textContent = title;
	el.querySelector('span')!.textContent = text;
	pushToast(el, 3.6);
}

function pushToast(el: HTMLElement, life: number) {
	el.style.setProperty('--life', `${life}s`);
	ui.toasts.append(el);
	while (ui.toasts.children.length > 3) ui.toasts.firstElementChild!.remove();
	setTimeout(() => el.remove(), (life + 0.5) * 1000);
}

// ---------- tutorial ----------

function coach(text: string | null, target?: HTMLElement | { x: number; y: number; h?: number } | null, anchor?: HTMLElement) {
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
	let tx = W / 2;
	let ty = H / 2;
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
	const left = Math.max(10, Math.min(W - bw - 10, tx - bw / 2));
	const below = ty + th / 2 < H * 0.5;
	const top = below ? ty + th + 14 : ty - bh - 14;
	ui.coach.style.left = `${left}px`;
	ui.coach.style.top = `${Math.max(10, Math.min(H - bh - 10, top))}px`;
}

$('coach-skip').addEventListener('click', () => {
	g.tutorial = 99;
	coach(null);
	pv.highlight = [];
	space.pointAt = -1;
	sfx.click();
});

function updateTutorial() {
	pv.highlight = [];
	space.pointAt = -1;
	if (g.tutorial >= 99 || panelOpen()) {
		coach(null);
		return;
	}
	const p0 = g.planets[0];
	const drills = sim.countOf(g, 0, 'drill');
	const step = g.tutorial;
	const advance = (n: number) => {
		g.tutorial = n;
	};
	if (step === 0) {
		if (g.stats.taps >= 8 && g.credits >= sim.buildCost(g, 0, 'drill')) advance(1);
		else if (view === 'space') {
			space.pointAt = 0;
			const p = space.pos[0];
			coach(g.stats.taps === 0 ? 'Tap Cinder to mine ore. Each tap earns credits.' : `Keep tapping! A drill costs ${fmt(sim.buildCost(g, 0, 'drill'))}.`, { x: p.x, y: p.y - p.r, h: p.r * 2 + 36 });
		} else coach(null);
		return;
	}
	if (step === 1) {
		if (view === 'planet' && pv.pi === 0) return advance(2);
		if (view === 'space') {
			if (space.selected !== 0) {
				space.selected = 0;
				updateCard();
			}
			const btn = document.getElementById('card-open');
			if (btn) coach('You can afford a drill. Open Cinder to build your first factory.', btn, ui.card);
		}
		return;
	}
	if (view !== 'planet' || pv.pi !== 0) {
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
		if (pv.tool && pv.tool !== 'belt' && sim.countOf(g, 0, 'belt') === 0) {
			coach('Pick the Belt. Then drag from the drill to the launch pad.', ui.toolbar.querySelector<HTMLElement>('[data-tool="belt"]'), ui.pvTop);
			return;
		}
		const flowing = p0.pad.length > 0 || g.stats.flights > 0 || p0.ships.some((s) => s.cargo.length > 0 || s.ph !== 0);
		if (flowing) return advance(5);
		const drill = p0.cells.findIndex((m) => m?.t === 'drill');
		const pad = p0.cells.findIndex((m) => m?.t === 'pad');
		pv.highlight = [drill, pad];
		const c = pv.cellCenter(pad);
		const dc = pv.cellCenter(drill);
		const belts = sim.countOf(g, 0, 'belt');
		coach(belts === 0 ? 'Now drag from the drill to the launch pad. Belts follow your finger.' : 'Connect the belts to the launch pad (the round pad). Arrows show the way items move.', { x: (c.x + dc.x) / 2, y: Math.min(c.y, dc.y) - pv.ts * 0.5, h: Math.abs(c.y - dc.y) + pv.ts });
		return;
	}
	if (step === 5) {
		if (view === 'space') return advance(6);
		if (g.stats.flights > 0) return advance(6);
		coach('Ore is on its way! Ships fly it home to sell. Go back to watch.', $('btn-back'));
		return;
	}
	if (step === 6) {
		if (g.stats.flights > 0 || g.goals.includes('ship')) {
			advance(7);
			tutorialEndAt = time + 7;
			return;
		}
		if (view === 'space') {
			coach('Your ship is flying home. Each landing sells the cargo.', { x: space.home.x, y: space.home.y - space.home.r, h: space.home.r * 3 });
		} else coach(null);
		return;
	}
	if (step === 7) {
		coach('Nice! Tap the NEXT bar at the top any time to see what to do.', { x: W / 2, y: H * 0.62, h: 0 });
		if (time > tutorialEndAt) advance(99);
	}
}
let tutorialEndAt = 0;

function dist(a: number, b: number) {
	return Math.abs((a % COLS) - (b % COLS)) + Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS));
}

// ---------- prestige ----------

function doPrestige() {
	sfx.warp();
	flash = 1.4;
	setTimeout(() => {
		g = sim.prestige(g);
		afterLoad();
		saveGame(g);
		toastUnlock('Nova Reset', `You now have ✦ ${g.stardust} stardust. Spend it on perks in the Nova panel.`);
		updateHud();
	}, 700);
}

// ---------- events from the game ----------

function handleEvents() {
	for (const e of sim.events) {
		switch (e.type) {
			case 'sold':
				if (view === 'space') {
					space.onSold(e.planet, e.amount);
					sfx.land(e.amount > sim.incomeRate() * 5);
				} else {
					space.rate[e.planet] += e.amount;
					sfx.coin();
				}
				bumpCredits();
				break;
			case 'made':
				if (view === 'planet' && e.planet === pv.pi) pv.onMade(e.cell, e.t);
				break;
			case 'depart':
				if (view === 'space') space.onDepart(e.planet);
				else if (e.planet === pv.pi) {
					pv.onShip('up');
					sfx.depart();
				}
				break;
			case 'dock':
				if (view === 'planet' && e.planet === pv.pi) pv.onShip('down');
				break;
			case 'unlock':
				toastUnlock(e.title, e.text);
				sfx.unlock();
				toolbarKey = '';
				updateToolbar();
				updateHud();
				break;
			case 'goal': {
				const el = document.createElement('div');
				el.className = 'toast toast--goal';
				el.innerHTML = `<b>✓</b> <span></span> <b></b>`;
				el.querySelector('span')!.textContent = e.text;
				el.querySelectorAll('b')[1].textContent = `+${fmt(e.reward)}`;
				pushToast(el, 2.6);
				sfx.goal();
				ui.goal.classList.remove('is-done');
				void ui.goal.offsetWidth;
				ui.goal.classList.add('is-done');
				break;
			}
		}
	}
	sim.events.length = 0;
}

// ---------- main loop ----------

let last = performance.now();

function frame(now: number) {
	requestAnimationFrame(frame);
	let dt = (now - last) / 1000;
	last = now;
	if (dt > 3 && started && !isPaused()) {
		// The tab slept: run the time away like an offline return.
		runAway(dt);
		dt = 0;
	}
	dt = Math.min(dt, 0.1);
	time += dt;

	if (started && !isPaused()) {
		let left = dt * devSpeed;
		while (left > 1e-6) {
			const step = Math.min(left, 1 / 30);
			sim.tick(g, step);
			left -= step;
		}
		progressTimer += dt;
		if (progressTimer > 0.25) {
			progressTimer = 0;
			checkProgress(g);
		}
		handleEvents();
		saveTimer += dt;
		if (saveTimer > 10) {
			saveTimer = 0;
			saveGame(g);
		}
	} else if (demo) {
		for (const p of demo.planets) while (p.pad.length < 30) p.pad.push(0);
		sim.setEvents(false);
		sim.tick(demo, dt);
	}

	// credits count up smoothly, and drop at once when spent
	if (g.credits < shownCredits) shownCredits = g.credits;
	else shownCredits += (g.credits - shownCredits) * Math.min(1, dt * 12);
	if (Math.abs(g.credits - shownCredits) < 0.5) shownCredits = g.credits;

	uiTimer += dt;
	if (uiTimer > 0.2 && started) {
		uiTimer = 0;
		updateHud();
		updateGoal();
		updateCard();
		updateToolbar();
		updateInspect();
		updateTutorial();
		refreshPanel();
		const sub = `${PLANETS[pv.pi].ore} · ${fmt(space.rate[pv.pi] / 12)}/s`;
		if (ui.pvSub.textContent !== sub) ui.pvSub.textContent = sub;
	}

	render(dt);
}

function render(dt: number) {
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.fillStyle = '#070a14';
	ctx.fillRect(0, 0, W, H);
	stepFx(dt);
	const game = demo ?? g;
	if (view === 'space' || !started) {
		space.draw(ctx, game, time, dt);
	} else {
		space.draw(ctx, demo ?? g, time, 0);
		ctx.fillStyle = 'rgba(5,7,15,0.72)';
		ctx.fillRect(0, 0, W, H);
		pv.draw(ctx, g, time, dt);
		pv.drawLabels(ctx, g);
	}
	drawFx(ctx);
	if (flash > 0) {
		ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, flash * 0.6)})`;
		ctx.fillRect(0, 0, W, H);
		flash = Math.max(0, flash - dt * 1.6);
	}
}

// ---------- page life ----------

document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		if (started) saveGame(g);
		suspendAudio(true);
	} else {
		suspendAudio(false);
		last = performance.now();
		if (started && !isPaused()) {
			const away = (Date.now() - g.savedAt) / 1000;
			if (away > 3) runAway(away);
		}
	}
});
window.addEventListener('pagehide', () => started && saveGame(g));
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// ---------- boot ----------

setupPwa();
resize();
showTitle();
applySettings();
requestAnimationFrame(frame);

// For quick checks in the console: window.__game(), and in dev, window.__speed(n) to run faster.
(window as unknown as { __game: () => Game }).__game = () => g;
if (import.meta.env.DEV) Object.assign(window, { __speed: (n: number) => (devSpeed = n), __sim: sim, __open: (i: number) => toPlanet(i), __pv: pv });
