// The stage of the Feel Lab: it plays one moment of the game again and again (a scene).
// It uses the real view, engine and juice of the game, so what you see is what the game does.

import { Game } from '../../rules/game.js';
import { MIN_GROUP_SIZE } from '../../rules/scoring.js';
import { randomSeed } from '../../rules/random.js';
import { View } from '../../view/view.js';
import { audio } from '../../audio/sound-player.js';
import { makeJuice } from '../../play/juice.js';
import { tuning } from '../../feel/tuning.js';
import { $, toast } from '../lab-page.js';

const START_BELOW_WELL = 0.4; // where a dropped piece starts, as in the game
const PAUSE_BEFORE = 0.45; // seconds of stillness before the moment plays
const PAUSE_AFTER = 0.9; // and after, before a loop plays it again
const BOARD_SEARCH_MS = 1500; // how long to look for a board that makes the scene

export const canvas = $('stage');
export const view = new View(canvas);
const juice = makeJuice({ view, banner: showBanner });

export const stage = {
	scene: 'clear',
	loop: true,
	speed: 1,
	run: 0, // each play gets a number; an older play stops when a new one starts
	busy: false,
	clock: 0, // seconds of stage time (slower at ½× and ¼×)
	boards: {}, // a board found for each scene, so a loop plays the same moment
};

// ---- time ----

const waiters = [];
const waitFor = (test) => new Promise((resolve) => waiters.push({ test, resolve }));
const waitTime = (seconds) => {
	const until = stage.clock + seconds;
	return waitFor(() => stage.clock >= until);
};

let lastFrameTime = performance.now();

/** The loop of the stage. At ½× and ¼× the view gets less time each frame. The sound plays at normal speed. */
export function frame(now) {
	const dt = Math.min(0.05, (now - lastFrameTime) / 1000) * stage.speed;
	lastFrameTime = now;
	stage.clock += dt;
	view.update(dt);
	for (let i = waiters.length - 1; i >= 0; i--) {
		if (waiters[i].test()) waiters.splice(i, 1)[0].resolve();
	}
	view.draw();
	requestAnimationFrame(frame);
}

let bannerTimer = 0;
function showBanner(text, ms) {
	const banner = $('banner');
	banner.textContent = text;
	banner.hidden = false;
	banner.style.animation = 'none';
	void banner.offsetWidth; // restarts the animation
	banner.style.animation = '';
	clearTimeout(bannerTimer);
	bannerTimer = setTimeout(() => (banner.hidden = true), ms / stage.speed);
}

// ---- boards ----

/** Fills the well to about `fill` (0 to 1) with blocks that make no match. */
function fillWell(game, fill) {
	const heights = Array.from({ length: game.cols }, () => 0);
	const target = Math.round(game.cols * game.rows * fill);
	const colorAt = (index) => (game.grid[index] ? game.grid[index].color : null);
	for (let count = 0; count < target; count++) {
		const openColumns = heights.map((height, x) => (height < game.rows - 2 ? x : -1)).filter((x) => x >= 0);
		if (!openColumns.length) break;
		const x = openColumns[Math.floor(Math.random() * openColumns.length)];
		const y = heights[x]++;
		const colors = [...Array(game.colors).keys()].sort(() => Math.random() - 0.5);
		const color = colors.find((option) => game.linkedSize(colorAt, { x, y }, option) < MIN_GROUP_SIZE) ?? colors[0];
		game.grid[game.index(x, y)] = game.makeBlock(color);
	}
}

// What each drop scene needs from the chain it makes.
const SCENE_TESTS = {
	drop: (steps) => steps.length === 0,
	clear: (steps) => steps.length === 1 && steps[0].biggest <= 4,
	chain: (steps) => steps.length >= 3,
	big: (steps) => steps.length >= 1 && steps[0].biggest >= 6,
};

/** Looks for a board and a drop that make the scene: no clear, one clear, a chain or a big group. */
function findBoard(scene) {
	const wanted = SCENE_TESTS[scene];
	const started = performance.now();
	let fallback = null;
	while (performance.now() - started < BOARD_SEARCH_MS) {
		const game = new Game({ seed: randomSeed() });
		fillWell(game, 0.3 + Math.random() * 0.3);
		const pieces = [game.pieces[0], game.pieces[1], game.makePiece(), game.makePiece(), game.makePiece()];
		for (const piece of pieces) {
			for (let x = 0; x <= game.cols - piece.w; x++) {
				if (!game.fits(piece, x)) continue;
				const trial = game.clone();
				trial.place(0, x, piece);
				const steps = trial.resolveAll();
				const other = game.pieces[1] === piece ? game.pieces[0] : game.pieces[1];
				const board = { colors: game.grid.map((block) => (block ? block.color : null)), piece, other, x };
				if (wanted(steps)) return board;
				if (scene === 'chain' && steps.length === 2) fallback = board;
			}
		}
	}
	return fallback;
}

/** A game with the colors of a board: blocks sit in their cells, still, ready for the moment. */
function gameFrom(colors, pieces = []) {
	const game = new Game({ seed: 1 });
	game.grid = colors.map((color) => (color === null ? null : game.makeBlock(color)));
	if (pieces.length) game.pieces = pieces.map((piece) => ({ ...piece, cells: piece.cells.map((cell) => ({ ...cell })) }));
	view.setGame(game);
	game.grid.forEach((block, index) => {
		if (!block) return;
		const visual = view.blockVisuals.get(block.id);
		visual.y = game.rowOf(index);
		visual.delay = 0;
	});
	return game;
}

function randomColors(fill) {
	const game = new Game({ seed: randomSeed() });
	fillWell(game, fill);
	return game.grid.map((block) => (block ? block.color : null));
}

/** Forgets the board of the scene in use, so the next play finds a new one. */
export function newBoard() {
	delete stage.boards[stage.scene];
}

// ---- scenes ----

/** Runs every chain step until the well is still, like the game does. */
async function resolveChain(game, run) {
	for (let chain = 1; ; chain++) {
		const step = game.resolveStep(chain);
		if (!step || run !== stage.run) return;
		juice.step(step);
		await waitFor(() => view.dying.length === 0);
		view.holdFalls = false;
		await waitFor(() => view.settled);
	}
}

async function playDrop(run) {
	const { scene } = stage;
	if (!stage.boards[scene]) stage.boards[scene] = findBoard(scene);
	const board = stage.boards[scene];
	if (!board) return toast('Could not find a board for this scene. Try New board.');
	const game = gameFrom(board.colors, [board.piece, board.other]);
	await waitTime(PAUSE_BEFORE);
	if (run !== stage.run) return;
	const placed = game.placeRigid(0, board.x, game.pieces[0]);
	view.dropIn(placed, board.x, game.rows + START_BELOW_WELL);
	await waitFor(() => view.settled);
	if (game.settle().length) await waitFor(() => view.settled);
	if (run !== stage.run) return;
	await resolveChain(game, run);
}

async function playPower(run, kind) {
	if (!stage.boards[kind]) stage.boards[kind] = randomColors(0.6);
	const game = gameFrom(stage.boards[kind]);
	game.bag.push(kind);
	await waitTime(PAUSE_BEFORE);
	if (run !== stage.run) return;
	if (kind === 'blast') {
		const cell = game.bestBlastCell();
		if (cell && game.useBlast(cell.x, cell.y)) await resolveChain(game, run);
		return;
	}
	const moves = game.useRemix();
	if (!moves) return;
	view.startRemix(moves, tuning.motion.remixStyle);
	await waitFor(() => !view.remix);
	if (run === stage.run) await resolveChain(game, run);
}

async function playEarned(run) {
	if (!stage.boards.earned) stage.boards.earned = randomColors(0.35);
	gameFrom(stage.boards.earned);
	await waitTime(PAUSE_BEFORE);
	if (run !== stage.run) return;
	const { bar } = view;
	view.effects.sticker({ x: bar.x + bar.w / 2, y: bar.y - view.cell * 0.4, text: 'Blast!', sub: 'earned', big: true });
	audio.powerUpEarned();
	view.game.bag.push('blast');
	await waitTime(tuning.motion.stickerTime * 1.36);
}

function playScene(run) {
	if (stage.scene === 'blast' || stage.scene === 'remix') return playPower(run, stage.scene);
	if (stage.scene === 'earned') return playEarned(run);
	return playDrop(run);
}

/** Plays the scene, and again and again while Loop is on. A new play stops the one before it. */
export async function play() {
	audio.unlock();
	const run = ++stage.run;
	stage.busy = true;
	view.effects.clear();
	view.holdFalls = false;
	try {
		do {
			await playScene(run);
			if (run !== stage.run) return;
			await waitTime(PAUSE_AFTER);
		} while (stage.loop && run === stage.run);
	} finally {
		if (run === stage.run) stage.busy = false;
	}
}

/** After a knob changes: play the moment again, unless a loop will show it soon anyway. */
export function replaySoon() {
	if (!stage.busy) play();
}
