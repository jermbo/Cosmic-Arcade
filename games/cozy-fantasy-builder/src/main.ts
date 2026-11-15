/** The shell: starts everything, runs the frame loop and joins input, state, view and UI. */

import * as THREE from 'three';
import './style.css';
import { applyVolume, pauseAudio, sfx, startAudio, updateAudio } from './audio.ts';
import { COMBOS, ISLANDS, PIECE, PIECES, TUNE } from './content.ts';
import type { PieceId } from './content.ts';
import { burst, fxBudget, particles, updateParticles } from './fx.ts';
import { creatureEvents, initCreatures, resetCreatures, setGoldWhale, syncCreatures, tapCreature, updateCreatures } from './creatures.ts';
import { actions, camera, cameraYaw, camTarget, flyTo, initInput, input, resetCamera, updateInput } from './input.ts';
import { clearLife, initLife, lifeEvents, lifeReport, syncLife, updateLife } from './life.ts';
import { road, roadCancel, roadCommit, roadDrop, roadStart, roadTo } from './road.ts';
import { env, initSky, sun, updateSky } from './sky.ts';
import { checkGoals, combosAt, erase, hooks, isLand, load, loadSettings, pieceAt, place, placeProblem, redo, rotateAt, S, saveNow, saveSoon, undo, unlockIsland, wipeSave } from './state.ts';
import { adjustFocus, closePanel, comboBanner, goalOfIsland, goalToast, goBack, initUI, islandName, moveFocus, openPanel, popGoal, pressFocus, renderPieces, setHint, setTool, showGame, showRoadBar, showTitle, slots, toast, ui, uiActions, updateHud } from './ui.ts';
import type { Tool } from './ui.ts';
import { DX, DZ, key, unkey } from './util.ts';
import { blessLand, driftPollen, flashCursor, groundY, growIn, hideCursor, initView, islandSparkle, rebuildAll, rebuildPiece, refresh, renderIcons, showCursor, syncIslands, updateView } from './view.ts';

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

/** The island under a tap, with some room around it. Locked islands count too. */
function islandNear(x: number, z: number): number {
	return ISLANDS.findIndex((d) => Math.hypot(x - d.cx, z - d.cz) < d.r * 1.25);
}

function lookAtIsland(index: number): void {
	const d = ISLANDS[index];
	flyTo(d.cx, d.cz, Math.max(20, d.r * (camera.aspect < 1 ? 6 : 4.2)));
	if (index >= S.islands) {
		const g = goalOfIsland(index);
		toast(`${d.name} still sleeps`, g ? `Goal: ${g.text}` : '', 'plain');
	}
}

function tryPlace(x: number, z: number): void {
	if (road.pending) return;
	const tool = ui.tool;
	// A tap on a far island flies the camera there.
	const isle = islandNear(x, z);
	if (isle >= 0 && !isLand(x, z) && isle >= S.islands) {
		lookAtIsland(isle);
		return;
	}
	if (isle >= 0 && !tool && Math.hypot(camTarget.x - ISLANDS[isle].cx, camTarget.z - ISLANDS[isle].cz) > ISLANDS[isle].r + 6) {
		lookAtIsland(isle);
		return;
	}
	if (tool === 'erase') {
		const p = pieceAt(x, z);
		if (!p) return;
		if (PIECE[p.t].fixed) {
			sfx.nope();
			toast(`The ${PIECE[p.t].name} stays`, '', 'soft');
			return;
		}
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

function endRoad(build: boolean): void {
	if (!road.pending && !road.active) return;
	if (build) {
		const n = roadCommit();
		if (n) sfx.place(PIECE.path.note);
	} else {
		roadCancel();
		sfx.click();
	}
	showRoadBar(0);
}

function pickTool(tool: Tool): void {
	endRoad(false);
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
	}
	applyGifts();
	renderPieces();
	setTool(ui.tool);
	updateHud();
	popGoal();
}

/** The late rewards: shooting stars and the golden whale. */
function applyGifts(): void {
	env.shootingStars = S.goals.has('gift8');
	setGoldWhale(S.goals.has('vill30'));
}

/** A jelly gift: the land below turns lush, and saplings there shoot up. */
function giveGift(x: number, z: number): void {
	S.gifts++;
	sfx.gift();
	const n = TUNE.giftReach;
	let trees = 0;
	for (let dx = -n; dx <= n; dx++) for (let dz = -n; dz <= n; dz++) {
		const k = key(x + dx, z + dz);
		const p = S.pieces.get(k);
		if (p?.t !== 'tree' || (p.g ?? 1) >= 1) continue;
		p.g = Math.min(1, (p.g ?? 0) + 0.6);
		rebuildPiece(k, true);
		trees++;
	}
	const land = blessLand(x, z, n);
	toast('A jelly gift!', trees ? 'Saplings shoot up' : land ? 'The grass grows lush here' : 'Sparkles fall into the clouds', 'goal');
	saveSoon();
	runGoals();
	updateHud();
}

hooks.changed.push((cells, placed) => {
	refresh(cells, placed);
	syncLife(placed);
	syncCreatures();
	findCombos(cells);
	runGoals();
	updateHud();
});

hooks.islandAdded.push((index, cells) => {
	endRoad(false);
	syncIslands(true);
	refresh(cells, null);
	// The bridge grows out cell by cell while the island rises.
	growIn(cells.filter((k) => S.pieces.get(k)?.t === 'bridge'), 0.14, 1.2);
	syncLife(null);
	syncCreatures();
	islandSparkle(index);
	sfx.island();
	const d = ISLANDS[index];
	const from = ISLANDS[d.from];
	flyTo((d.cx + from.cx) / 2, (d.cz + from.cz) / 2, camera.aspect < 1 ? 62 : 44);
	window.setTimeout(() => toast(`${islandName(index)} wakes up`, 'A bridge grows out to it', 'goal'), 900);
});

/* Wiring of input and UI */

actions.tap = tryPlace;
actions.tapRay = (ray) => !road.pending && tapCreature(ray);
actions.roadStart = (x, z) => {
	if (ui.tool !== 'path') return false;
	roadStart(x, z);
	showRoadBar(0);
	hideCursor();
	return true;
};
actions.roadMove = (x, z) => {
	roadTo(x, z);
	setHint(road.fresh ? `<b>Moss path</b> ${road.fresh} new ${road.fresh === 1 ? 'stone' : 'stones'}. Let go to check it.` : '<b>Moss path</b> Drag to where the path should end.');
};
actions.roadEnd = (keep) => {
	setTool(ui.tool);
	if (!keep) roadCancel();
	else if (roadDrop()) {
		showRoadBar(road.fresh);
		sfx.click();
	}
};
actions.place = () => {
	if (road.pending) endRoad(true);
	else if (input.hasCell) tryPlace(input.cx, input.cz);
};
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
actions.pause = () => (road.pending ? endRoad(false) : openPanel('pause'));
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
uiActions.roadYes = () => endRoad(true);
uiActions.roadNo = () => endRoad(false);
uiActions.flyToIsland = lookAtIsland;
uiActions.undo = actions.undo;
uiActions.redo = actions.redo;
uiActions.rotate = rotateNow;
uiActions.click = () => sfx.click();
uiActions.settingsChanged = () => {
	applyVolume();
	applyQuality();
};
uiActions.panelChanged = () => {
	if (ui.panel || ui.screen !== 'play') endRoad(false);
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
	else if (S.away) openPanel('away');
};
uiActions.toTitle = () => {
	saveNow();
	showTitle();
};
uiActions.newGame = () => {
	wipeSave();
	clearLife();
	rebuildAll();
	resetCreatures();
	applyGifts();
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
		if (road.pending) endRoad(false);
		else goBack();
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
	updateCreatures(dt, camTarget);
	driftPollen(dt, camTarget);
	updateParticles(dt, env.time, renderer.domElement.height / renderer.getPixelRatio(), camera.fov);
	updateAudio(dt, env.night, env.time);

	// The cursor frame, for the mouse, the keys and the gamepad.
	if (input.active && input.mode !== 'touch' && input.hasCell && !road.active && !road.pending) {
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
	try {
		// The save of the first version does not fit the new islands.
		localStorage.removeItem('petalwisp-isles.save');
	} catch {
		/* Storage is blocked. Nothing to clean up. */
	}

	ui.icons = renderIcons(renderer);
	initUI();
	initInput(canvas);
	rebuildAll();
	syncLife(null);
	initCreatures();
	syncCreatures();
	applyGifts();
	creatureEvents.gift = giveGift;
	creatureEvents.whaleSong = () => sfx.whale();
	creatureEvents.sneeze = () => sfx.sneeze();
	creatureEvents.poke = (what) => {
		sfx.poke();
		if (what === 'jelly') toast('This jelly has no gift yet', 'A jelly that twinkles has one', 'soft');
	};
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
					while (S.islands < Math.min(n, ISLANDS.length)) unlockIsland();
				},
				gift: giveGift,
				fly: flyTo,
				road: { road, roadStart, roadTo, roadDrop, end: endRoad },
				clock: (c: number) => (S.clock = c),
				speed: (n: number) => (speed = n),
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
