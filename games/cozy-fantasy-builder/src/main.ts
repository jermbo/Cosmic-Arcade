/** The shell: starts everything, runs the frame loop and joins input, state, view and UI. */

import * as THREE from 'three';
import './style.css';
import { applyVolume, pauseAudio, sfx, startAudio, updateAudio } from './audio.ts';
import { COMBOS, GOALS, ISLANDS, PIECE, PIECES } from './content.ts';
import type { PieceId } from './content.ts';
import { burst, fxBudget, particles, updateParticles } from './fx.ts';
import { actions, camera, cameraYaw, camTarget, initInput, input, resetCamera, updateInput } from './input.ts';
import { clearLife, initLife, lifeEvents, lifeReport, syncLife, updateLife } from './life.ts';
import { env, initSky, startRain, sun, updateSky } from './sky.ts';
import { buildLand, checkGoals, combosAt, erase, hooks, load, pieceAt, place, placeProblem, redo, rotateAt, S, saveNow, saveSoon, undo, wipeSave, loadSettings } from './state.ts';
import { adjustFocus, closePanel, comboBanner, goalToast, goBack, initUI, islandName, moveFocus, openPanel, popGoal, pressFocus, renderPieces, setHint, setTool, showGame, showTitle, slots, toast, ui, uiActions, updateHud } from './ui.ts';
import type { Tool } from './ui.ts';
import { DX, DZ, key, unkey } from './util.ts';
import { driftPollen, flashCursor, groundY, hideCursor, initView, islandSparkle, rebuildAll, refresh, renderIcons, showCursor, syncIslands, updateView } from './view.ts';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();

/** The way the next piece faces. */
let turn = 2;
/** The last cell the player built on, for the turn button on a touch screen. */
let lastPlaced: string | null = null;
let goalTimer = 0;
/** A debug tool: makes time run faster. */
let speed = 1;

function applyQuality(): void {
	const q = S.settings.quality;
	const cap = q === 'low' ? 1 : q === 'medium' ? 1.5 : 2;
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
	fxBudget.amount = q === 'low' ? 0.45 : q === 'medium' ? 0.75 : 1;
	sun.castShadow = q !== 'low';
	const size = q === 'high' ? 2048 : 1024;
	if (sun.shadow.mapSize.x !== size) {
		sun.shadow.mapSize.set(size, size);
		sun.shadow.map?.dispose();
		sun.shadow.map = null;
	}
	resize();
}

function resize(): void {
	const w = window.innerWidth;
	const h = window.innerHeight;
	renderer.setSize(w, h, false);
	camera.aspect = w / h;
	// A tall screen gets a wider lens, so the islands still fit.
	camera.fov = camera.aspect < 1 ? 44 : 34;
	camera.updateProjectionMatrix();
}

/* Building */

function tryPlace(x: number, z: number): void {
	const tool = ui.tool;
	if (tool === 'erase') {
		const p = pieceAt(x, z);
		if (!p) return;
		erase(x, z);
		sfx.erase();
		burst(x, groundY(x, z) + 0.2, z, [0xffffff, 0xf0e6ff], 8, 0.7);
		return;
	}
	if (!tool) {
		const p = pieceAt(x, z);
		setHint(p ? `<b>${PIECE[p.t].name}</b> ${PIECE[p.t].blurb}` : 'Pick a piece to build.');
		return;
	}
	const problem = placeProblem(tool, x, z);
	if (problem) {
		sfx.nope();
		toast(problem, '', 'soft');
		if (input.mode === 'touch') flashCursor(x, z, false);
		return;
	}
	place(tool, x, z, turn);
	lastPlaced = key(x, z);
	sfx.place(PIECE[tool].note);
	if (input.mode === 'touch') flashCursor(x, z, true);
}

function rotateNow(): void {
	// With a cursor: turn the piece under it. On touch: turn the piece that was just placed.
	const target = input.mode !== 'touch' && input.hasCell && pieceAt(input.cx, input.cz) ? key(input.cx, input.cz) : input.mode === 'touch' ? lastPlaced : null;
	if (target) {
		const [x, z] = unkey(target);
		if (rotateAt(x, z)) {
			turn = pieceAt(x, z)!.r;
			sfx.rotate();
			return;
		}
	}
	turn = (turn + 1) % 4;
	sfx.rotate();
	if (input.mode === 'touch' && ui.tool && ui.tool !== 'erase' && PIECE[ui.tool].turns) toast('The next piece will face a new way', '', 'soft');
}

function pickTool(tool: Tool): void {
	setTool(tool);
	sfx.click();
}

function cyclePiece(step: number): void {
	const list = slots();
	const i = ui.tool && ui.tool !== 'erase' ? list.indexOf(ui.tool) : step > 0 ? -1 : 0;
	pickTool(list[(i + step + list.length) % list.length]);
}

/** Finds new magic links around the cells that changed. */
function findCombos(cells: string[]): void {
	for (const k of cells) {
		const [x, z] = unkey(k);
		for (const c of combosAt(x, z)) {
			if (S.combos.has(c.id)) continue;
			S.combos.add(c.id);
			comboBanner(c);
			sfx.combo();
			burst(x, groundY(x, z) + 0.5, z, c.colors, 40, 1.5);
			for (let d = 0; d < 4; d++) burst(x + DX[d] * 0.5, groundY(x, z) + 0.4, z + DZ[d] * 0.5, c.colors, 8, 1);
			saveSoon();
		}
	}
}

function runGoals(): void {
	const done = checkGoals();
	if (!done.length) return;
	sfx.goal();
	for (const g of done) {
		goalToast(g);
		if ('piece' in g.reward) ui.fresh.add(g.reward.piece);
		if ('gift' in g.reward) env.shootingStars = true;
	}
	renderPieces();
	setTool(ui.tool);
	updateHud();
	popGoal();
}

hooks.changed.push((cells, placed) => {
	refresh(cells, placed);
	syncLife(placed);
	findCombos(cells);
	runGoals();
	updateHud();
});

hooks.islandAdded.push((index) => {
	// A bridge can stand where the new island comes up. The island takes its place.
	const gone: string[] = [];
	for (const [x, z] of S.islandCells[index]) {
		const k = key(x, z);
		if (S.pieces.delete(k)) gone.push(k);
	}
	S.undo = [];
	S.redo = [];
	syncIslands(true);
	if (gone.length) refresh(gone, null);
	islandSparkle(index);
	window.setTimeout(() => toast(`${islandName(index)} rises from the clouds`, 'A new sky island to build on', 'goal'), 900);
});

/* Wiring of input and UI */

actions.tap = tryPlace;
actions.place = () => input.hasCell && tryPlace(input.cx, input.cz);
actions.eraseAtCursor = () => {
	if (!input.hasCell || !pieceAt(input.cx, input.cz)) return;
	erase(input.cx, input.cz);
	sfx.erase();
};
actions.rotate = rotateNow;
actions.undo = () => (undo() ? sfx.undo() : sfx.nope());
actions.redo = () => (redo() ? sfx.undo() : sfx.nope());
actions.cyclePiece = cyclePiece;
actions.pickSlot = (i) => {
	const id = slots()[i];
	if (id) pickTool(ui.tool === id ? null : id);
};
actions.pause = () => openPanel('pause');
actions.book = () => openPanel('book');
actions.goals = () => openPanel('goals');
actions.menuMove = moveFocus;
actions.menuPress = pressFocus;
actions.menuBack = goBack;
actions.menuAdjust = adjustFocus;
actions.modeChanged = () => {
	if (input.mode === 'touch') hideCursor();
};

uiActions.pickTool = pickTool;
uiActions.undo = actions.undo;
uiActions.redo = actions.redo;
uiActions.rotate = rotateNow;
uiActions.click = () => sfx.click();
uiActions.settingsChanged = () => {
	applyVolume();
	applyQuality();
};
uiActions.panelChanged = () => {
	input.active = ui.screen === 'play' && !ui.panel;
	if (!input.active) hideCursor();
};
uiActions.tutorialDone = () => {
	S.tutorial = true;
	saveSoon();
};
uiActions.play = () => {
	startAudio();
	sfx.click();
	trapBack();
	showGame();
	resetCamera();
	if (!ui.tool) setTool(slots()[1] ?? null);
	if (!S.tutorial) openPanel('tutorial');
};
uiActions.toTitle = () => {
	saveNow();
	showTitle();
};
uiActions.newGame = () => {
	wipeSave();
	clearLife();
	rebuildAll();
	env.shootingStars = false;
	lastPlaced = null;
	ui.fresh.clear();
	setTool(null);
	closePanel();
	showTitle();
};

lifeEvents.movedIn = (name) => {
	toast(`${name} moved in!`, '', 'plain');
	sfx.moveIn();
	runGoals();
	updateHud();
};
lifeEvents.hello = () => sfx.hello();
lifeEvents.treeGrew = () => {
	sfx.grow();
	runGoals();
};

/** Keeps the back gesture of a phone inside the game. */
let trapped = false;
function trapBack(): void {
	if (trapped) return;
	trapped = true;
	history.pushState({ petalwisp: true }, '');
	window.addEventListener('popstate', () => {
		history.pushState({ petalwisp: true }, '');
		goBack();
	});
}

/* The frame loop */

let last = performance.now();

function frame(now: number): void {
	requestAnimationFrame(frame);
	const dt = Math.min(0.05, (now - last) / 1000) * speed;
	last = now;
	if (document.hidden) return;

	const title = ui.screen === 'title';
	updateInput(dt / speed, title);
	updateSky(dt, camera, camTarget, cameraYaw(), false);
	updateView(dt);
	updateLife(dt);
	driftPollen(dt, camTarget);
	updateParticles(dt, env.time, renderer.domElement.height / renderer.getPixelRatio(), camera.fov);
	updateAudio(dt, env.night, env.rain, env.time);

	// The cursor frame, for the mouse, the keys and the gamepad.
	if (input.active && input.mode !== 'touch' && input.hasCell) {
		const tool = ui.tool;
		if (tool === 'erase') showCursor(input.cx, input.cz, pieceAt(input.cx, input.cz) ? 'erase' : 'plain', null, 0);
		else if (tool) showCursor(input.cx, input.cz, placeProblem(tool, input.cx, input.cz) ? 'bad' : 'ok', tool, turn);
		else showCursor(input.cx, input.cz, 'plain', null, 0);
	} else if (input.mode !== 'touch' || !input.active) hideCursor();

	goalTimer -= dt;
	if (goalTimer <= 0) {
		goalTimer = 1;
		if (ui.screen === 'play') {
			runGoals();
			updateHud();
		}
	}

	renderer.render(scene, camera);
}

function start(): void {
	loadSettings();
	load();
	initSky(scene);
	initView(scene);
	initLife();
	scene.add(particles);
	env.shootingStars = GOALS.some((g) => 'gift' in g.reward && S.goals.has(g.id));

	ui.icons = renderIcons(renderer);
	initUI();
	initInput(canvas);
	rebuildAll();
	syncLife(null);
	applyQuality();
	resetCamera();
	showTitle();

	window.addEventListener('resize', resize);
	window.addEventListener('orientationchange', () => window.setTimeout(resize, 200));
	document.addEventListener('visibilitychange', () => {
		pauseAudio(document.hidden);
		if (document.hidden) saveNow();
		last = performance.now();
	});
	window.addEventListener('pagehide', saveNow);
	window.setInterval(() => ui.screen === 'play' && saveNow(), 20000);

	requestAnimationFrame(frame);

	// Tools for testing, with ?debug in the address.
	if (new URLSearchParams(location.search).has('debug')) {
		Object.assign(window, {
			petal: {
				S,
				input,
				place: (id: PieceId, x: number, z: number, r = 2) => place(id, x, z, r),
				erase,
				unlockAll: () => {
					for (const p of PIECES) S.unlocked.add(p.id);
					renderPieces();
				},
				islands: (n: number) => {
					while (S.islands < Math.min(n, ISLANDS.length)) {
						S.islands++;
						buildLand();
						for (const h of hooks.islandAdded) h(S.islands - 1);
					}
				},
				clock: (c: number) => (S.clock = c),
				speed: (n: number) => (speed = n),
				rain: startRain,
				life: lifeReport,
				combos: COMBOS,
				tap: tryPlace,
				tool: pickTool,
				env,
				camera,
				renderer,
				scene,
			},
		});
	}
}

start();
