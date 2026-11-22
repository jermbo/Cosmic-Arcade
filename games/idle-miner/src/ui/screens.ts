// Which screen shows: the title, the space map, or a planet. Also fits the views to the free room on the screen.

import { initAudio, setVolumes, sfx } from '../audio.ts';
import { PLANETS } from '../content/planets.ts';
import { boughtPlots, viewBounds } from '../core/grid.ts';
import { events, setEvents } from '../core/events.ts';
import { resetIncome } from '../core/income.ts';
import { catchUp, offlineCapHours } from '../core/tick.ts';
import { clearSave, saveGame } from '../core/save.ts';
import { newGame } from '../core/state.ts';
import type { Game } from '../core/game.ts';
import { openAway } from './panels/away.ts';
import { openConfirmNew } from './panels/confirm-new.ts';
import { openCrew } from './panels/crew.ts';
import { openNova } from './panels/nova.ts';
import { openPause } from './panels/pause.ts';
import { openResearch } from './panels/research.ts';
import { openSettings } from './panels/settings.ts';
import { openShips } from './panels/ships.ts';
import { clearFx, setReducedMotion } from '../view/fx.ts';
import { session } from '../session.ts';
import { $, canvas, ui } from './elements.ts';
import { updateHud } from './hud.ts';
import { select } from './inspect.ts';
import { updateCard } from './planet-card.ts';
import { markToolbarStale, updateToolbar } from './toolbar.ts';
import { pv, space } from '../views.ts';

/** A new game that keeps the player's sound and motion settings. */
export function freshGame(): Game {
	const fresh = newGame();
	fresh.settings = { ...session.g.settings };
	return fresh;
}

export function resize() {
	session.dpr = Math.min(2, window.devicePixelRatio || 1);
	session.W = window.innerWidth;
	session.H = window.innerHeight;
	canvas.width = Math.round(session.W * session.dpr);
	canvas.height = Math.round(session.H * session.dpr);
	relayout();
}

/** Landscape phones: the dock is a left rail and the toolbar a right rail (see style.css). */
const railQuery = window.matchMedia('(orientation: landscape) and (max-height: 540px)');

/** Finds the free play area around the UI panels and fits the view to it. */
export function relayout() {
	const rail = railQuery.matches;
	const dock = ui.dock.getBoundingClientRect();
	const docked = !ui.hud.hidden;
	let top: number;
	let left = 0;
	let right = 0;
	let bottom: number;
	if (rail) {
		top = 8;
		left = docked ? dock.right + 4 : 0;
	} else {
		top = Math.max(dock.bottom + (session.view === 'space' ? 6 : 4), session.view === 'space' ? 70 : 0);
	}
	if (session.view === 'space') {
		bottom = Math.min(150, session.H * 0.2);
		space.layout(session.W, session.H, top, bottom, left, right);
	} else {
		const bar = ui.toolbar.getBoundingClientRect();
		if (ui.toolbar.hidden) bottom = 8;
		else if (rail) {
			bottom = 8;
			right = session.W - bar.left + 4;
		} else bottom = session.H - bar.top + 6;
		const pl = session.g.planets[pv.pi];
		pv.layout(session.W, session.H, top, bottom, viewBounds(pl), left, right);
	}
	const root = document.documentElement.style;
	root.setProperty('--play-t', `${top}px`);
	root.setProperty('--play-l', `${left}px`);
	root.setProperty('--play-r', `${right}px`);
}

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

export function showTitle() {
	ui.title.hidden = false;
	ui.play.textContent = session.hadSave ? 'Continue' : 'Play';
	ui.newGame.hidden = !session.hadSave;
	ui.hud.hidden = true;
	ui.goal.hidden = true;
	ui.card.hidden = true;
	ui.pvTop.hidden = true;
	ui.toolbar.hidden = true;
	ui.inspect.hidden = true;
	ui.coach.hidden = true;
	session.demo = makeDemo();
	space.showLabels = false;
	session.view = 'space';
	space.selected = -1;
	space.pointAt = -1;
	relayout();
}

export function toTitle() {
	saveGame(session.g);
	session.started = false;
	session.hadSave = true;
	showTitle();
}

export function startGame() {
	initAudio();
	applySettings();
	ui.title.hidden = true;
	ui.hud.hidden = false;
	ui.goal.hidden = false;
	session.demo = null;
	space.showLabels = true;
	session.started = true;
	clearFx();
	resetIncome();
	setEvents(true);
	toSpace();
	// time away since the last save
	const away = (Date.now() - session.g.savedAt) / 1000;
	if (session.hadSave && away > 30) runAway(away);
	saveGame(session.g);
	session.hadSave = true;
	updateHud();
	sfx.buy();
}

export function runAway(seconds: number) {
	const r = catchUp(session.g, seconds);
	events.length = 0;
	session.shownCredits = session.g.credits;
	saveGame(session.g);
	if (seconds > 60 && r.earned > 0) openAway(r, offlineCapHours(session.g));
}

export function afterLoad() {
	session.shownCredits = session.g.credits;
	space.rate.fill(0);
	pv.tool = null;
	pv.selected = null;
	markToolbarStale();
	resetIncome();
	clearFx();
	applySettings();
	if (session.started) toSpace();
}

export function applySettings() {
	setVolumes(session.g.settings.sfx, session.g.settings.music);
	setReducedMotion(session.g.settings.reduceMotion);
	document.documentElement.classList.toggle('reduce-motion', session.g.settings.reduceMotion);
}

export function updatePlanetHeader() {
	const pi = pv.pi;
	const p = session.g.planets[pi];
	ui.pvSub.textContent = `${boughtPlots(p) + 1} plot${boughtPlots(p) ? 's' : ''} · tap a dashed plot to buy land · drag off-land or two fingers to pan`;
	ui.survey.hidden = true;
}

export function toSpace() {
	session.view = 'space';
	ui.pvTop.hidden = true;
	ui.toolbar.hidden = true;
	ui.inspect.hidden = true;
	pv.tool = null;
	select(null);
	clearFx();
	updateCard();
	relayout();
}

export function toPlanet(pi: number) {
	if (!session.g.planets[pi].unlocked) return;
	session.view = 'planet';
	space.selected = -1;
	ui.card.hidden = true;
	ui.pvTop.hidden = false;
	ui.toolbar.hidden = false;
	pv.open(pi);
	ui.pvName.textContent = PLANETS[pi].name;
	ui.pvName.style.color = PLANETS[pi].light;
	updatePlanetHeader();
	markToolbarStale();
	updateToolbar();
	clearFx();
	relayout();
	sfx.click();
}

/** Adds the listeners. main.ts calls it once, at boot. */
export function initScreens() {
	railQuery.addEventListener('change', resize);

	ui.play.addEventListener('click', startGame);

	ui.newGame.addEventListener('click', () =>
		openConfirmNew(() => {
			clearSave();
			session.g = freshGame();
			session.hadSave = false;
			afterLoad();
			startGame();
		}),
	);

	$('btn-title-settings').addEventListener('click', () => {
		initAudio();
		openSettings(true);
	});

	$('btn-back').addEventListener('click', () => {
		sfx.click();
		toSpace();
	});

	$('btn-ships').addEventListener('click', () => {
		sfx.click();
		openShips(pv.pi);
	});

	ui.crew.addEventListener('click', () => {
		sfx.click();
		openCrew(pv.pi);
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
}
