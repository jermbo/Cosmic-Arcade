// Idle Orbit: start-up, the main loop, the events from the game, errors and page life.

import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-700.css';
import './style.css';

import { sfx, suspendAudio } from './audio.ts';
import { PLANETS } from './content/planets.ts';
import { fmt } from './core/format.ts';
import { checkProgress } from './core/progress.ts';
import { events, setEvents } from './core/events.ts';
import { incomeRate } from './core/income.ts';
import { prestige } from './core/nova.ts';
import { tick } from './core/tick.ts';
import { logError } from './core/error-log.ts';
import { clearSave, saveGame } from './core/save.ts';
import { panelOpen, refreshPanel } from './ui/modal.ts';
import { openCrash } from './ui/panels/crash.ts';
import { initPanels } from './ui/panels/host.ts';
import { setupPwa } from './ui/pwa.ts';
import { drawFx, stepFx } from './view/fx.ts';
import { session } from './session.ts';
import { canvas, ui } from './ui/elements.ts';
import { bumpCredits, initHud, updateGoal, updateHud } from './ui/hud.ts';
import { initInput } from './ui/input.ts';
import { initInspect, updateInspect } from './ui/inspect.ts';
import { initPlanetCard, updateCard } from './ui/planet-card.ts';
import { afterLoad, applySettings, freshGame, initScreens, resize, runAway, showTitle, toPlanet, toTitle } from './ui/screens.ts';
import { pushToast, toast, toastUnlock } from './ui/toasts.ts';
import { initToolbar, markToolbarStale, updateToolbar } from './ui/toolbar.ts';
import { initTutorial, updateTutorial } from './ui/tutorial.ts';
import { pv, space } from './views.ts';

const ctx = canvas.getContext('2d')!;

// ---------- state ----------

let uiTimer = 0;
let saveTimer = 0;
let progressTimer = 0;
let devSpeed = 1;
/** Set after an uncaught error: the sim and saving stop, so a broken state never overwrites the save. */
let crashed = false;

const isPaused = () => ['pause', 'how', 'settings', 'reset', 'new'].some((id) => panelOpen(id));

initPanels({
	game: () => session.g,
	sound: (n) => sfx[n](),
	toast,
	afterBuy: () => {
		updateHud();
		updateToolbar();
	},
	save: () => saveGame(session.g),
	resetAll: () => {
		clearSave();
		session.g = freshGame();
		session.hadSave = false;
		session.started = false;
		afterLoad();
		showTitle();
	},
	loadGame: (loaded) => {
		session.g = loaded;
		afterLoad();
		saveGame(session.g);
	},
	prestige: doPrestige,
	toTitle,
	settingsChanged: applySettings,
});

// ---------- prestige ----------

function doPrestige() {
	sfx.warp();
	session.flash = 1.4;
	setTimeout(() => {
		session.g = prestige(session.g);
		afterLoad();
		saveGame(session.g);
		toastUnlock('Nova Reset', `You now have ✦ ${session.g.stardust} stardust. Spend it on perks in the Nova panel.`);
		updateHud();
	}, 700);
}

// ---------- events from the game ----------

function handleEvents() {
	for (const e of events) {
		switch (e.type) {
			case 'sold':
				if (session.view === 'space') {
					space.onSold(e.planet, e.amount);
					sfx.land(e.amount > incomeRate() * 5);
				} else {
					space.rate[e.planet] += e.amount;
					sfx.coin();
				}
				bumpCredits();
				break;
			case 'made':
				if (session.view === 'planet' && e.planet === pv.pi) pv.onMade(e.cell, e.t);
				break;
			case 'depart':
				if (session.view === 'space') space.onDepart(e.planet);
				else if (e.planet === pv.pi) {
					pv.onShip('up');
					sfx.depart();
				}
				break;
			case 'dock':
				if (session.view === 'planet' && e.planet === pv.pi) pv.onShip('down');
				break;
			case 'unlock':
				toastUnlock(e.title, e.text);
				sfx.unlock();
				markToolbarStale();
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
	events.length = 0;
}

// ---------- main loop ----------

let last = performance.now();

function frame(now: number) {
	requestAnimationFrame(frame);
	let dt = (now - last) / 1000;
	last = now;
	if (dt > 3 && session.started && !crashed && !isPaused()) {
		// The tab slept: run the time away like an offline return.
		runAway(dt);
		dt = 0;
	}
	dt = Math.min(dt, 0.1);
	session.time += dt;

	if (crashed) {
		// Nothing runs; the last state is still drawn under the crash panel.
	} else if (session.started && !isPaused()) {
		let left = dt * devSpeed;
		while (left > 1e-6) {
			const step = Math.min(left, 1 / 30);
			tick(session.g, step);
			left -= step;
		}
		progressTimer += dt;
		if (progressTimer > 0.25) {
			progressTimer = 0;
			checkProgress(session.g);
		}
		handleEvents();
		saveTimer += dt;
		if (saveTimer > 10) {
			saveTimer = 0;
			saveGame(session.g);
		}
	} else if (session.demo) {
		for (const p of session.demo.planets) while (p.pad.length < 30) p.pad.push(0);
		setEvents(false);
		tick(session.demo, dt);
	}

	// credits count up smoothly, and drop at once when spent
	if (session.g.credits < session.shownCredits) session.shownCredits = session.g.credits;
	else session.shownCredits += (session.g.credits - session.shownCredits) * Math.min(1, dt * 12);
	if (Math.abs(session.g.credits - session.shownCredits) < 0.5) session.shownCredits = session.g.credits;

	uiTimer += dt;
	if (uiTimer > 0.2 && session.started && !crashed) {
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
	ctx.setTransform(session.dpr, 0, 0, session.dpr, 0, 0);
	ctx.fillStyle = '#070a14';
	ctx.fillRect(0, 0, session.W, session.H);
	stepFx(dt);
	const game = session.demo ?? session.g;
	if (session.view === 'space' || !session.started) {
		space.draw(ctx, game, session.time, dt);
	} else {
		space.draw(ctx, session.demo ?? session.g, session.time, 0);
		ctx.fillStyle = 'rgba(5,7,15,0.72)';
		ctx.fillRect(0, 0, session.W, session.H);
		pv.draw(ctx, session.g, session.time, dt);
		pv.drawLabels(ctx, session.g);
	}
	drawFx(ctx);
	if (session.flash > 0) {
		ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, session.flash * 0.6)})`;
		ctx.fillRect(0, 0, session.W, session.H);
		session.flash = Math.max(0, session.flash - dt * 1.6);
	}
}

// ---------- errors ----------

function crash(text: string) {
	if (crashed) return;
	crashed = true;
	const errors = logError(text);
	try {
		openCrash(errors.slice(-3));
	} catch {
		// The panel itself failed; the sim is stopped either way.
	}
}

window.addEventListener('error', (e) => {
	// Errors with no error object come from other scripts (extensions) or the browser, like ResizeObserver notes.
	if (!(e.error instanceof Error)) return;
	crash(e.error.stack || String(e.error));
});
window.addEventListener('unhandledrejection', (e) => {
	// A failed promise (audio, clipboard, storage) does not touch the game state, so just log it.
	const r = e.reason;
	logError(`unhandled rejection: ${r instanceof Error ? r.stack || r.message : String(r)}`);
});

// ---------- page life ----------

document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		if (session.started && !crashed) saveGame(session.g);
		suspendAudio(true);
	} else {
		suspendAudio(false);
		last = performance.now();
		// Time away counts even if a menu was open when the player left.
		if (session.started && !crashed) {
			const away = (Date.now() - session.g.savedAt) / 1000;
			if (away > 3) runAway(away);
		}
	}
});
window.addEventListener('pagehide', () => session.started && !crashed && saveGame(session.g));
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// ---------- boot ----------

initScreens();
initHud();
initInput();
initToolbar();
initInspect();
initPlanetCard();
initTutorial();
setupPwa();
resize();
showTitle();
applySettings();
requestAnimationFrame(frame);

// Dev only, for quick checks in the console: window.__game(), window.__speed(n) to run faster.
if (import.meta.env.DEV) Object.assign(window, { __game: () => session.g, __speed: (n: number) => (devSpeed = n), __open: (i: number) => toPlanet(i), __pv: pv });
