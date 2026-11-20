// Power-ups: how they are earned, and what each one does to the board.
//
// A turn earns one power-up when it makes a chain of REWARD_CHAIN steps or clears a linked
// group of REWARD_GROUP blocks. Which power-up comes from a shuffled deck, so the same one
// never shows up twice in a row. Earned power-ups wait in a bag until the player uses them.
// In Timed, they act by themselves at once (see the "auto" functions below).
//
// Prism: paints a tray piece one color.  Blast: clears a 3x3 area.  Remix: shuffles the blocks.

import { shuffleInPlace } from './random.js';
import { floodFill } from './board.js';
import { paintedPiece } from './pieces.js';
import { MIN_GROUP_SIZE } from './scoring.js';
import { MAX_COLORS } from './game-settings.js';

export const POWER_KINDS = ['prism', 'blast', 'remix'];
export const REWARD_CHAIN = 3;
export const REWARD_GROUP = 6;
export const BAG_SIZE = 3;

const BLAST_RADIUS = 1; // 1 cell around the center: a 3x3 area
const REMIX_TRIES = 25; // a Remix tries this many plans to find one that leaves no match

// ---- earning ----

/** True when a chain this long, or a group this big, earns a power-up. */
export function earnsReward(chainLength, biggestGroup = 0) {
	return chainLength >= REWARD_CHAIN || biggestGroup >= REWARD_GROUP;
}

/** The next power-up from the shuffled deck. A new deck never starts with the last one drawn. */
export function drawPower(game) {
	if (!game.deck.length) game.deck = newDeck(game);
	game.lastPower = game.deck.pop();
	return game.lastPower;
}

/** One card of each kind, shuffled. The card drawn first (the last in the list) is never the last one drawn. */
function newDeck(game) {
	const deck = POWER_KINDS.slice();
	do {
		shuffleInPlace(deck, game.rngMisc);
	} while (deck[deck.length - 1] === game.lastPower && deck.length > 1);
	return deck;
}

/**
 * Puts the reward for a finished turn in the bag. Returns { kind, lost } or null when nothing was earned.
 * A full bag loses the reward (kind is null) and the deck keeps its card.
 */
export function awardChain(game, chainLength, biggestGroup = 0) {
	if (!earnsReward(chainLength, biggestGroup)) return null;
	if (game.bag.length >= game.bagSize) return { kind: null, lost: true };
	const kind = drawPower(game);
	game.bag.push(kind);
	game.stats.earned++;
	return { kind, lost: false };
}

/** Takes one power-up of this kind out of the bag. Returns false when the bag has none. */
export function takeFromBag(game, kind) {
	const at = game.bag.indexOf(kind);
	if (at < 0) return false;
	game.bag.splice(at, 1);
	game.stats.used++;
	return true;
}

// ---- Prism ----

/** Paints every cell of a tray piece one color. */
export function usePrism(game, slot, color) {
	const piece = game.pieces[slot];
	if (!piece || !takeFromBag(game, 'prism')) return false;
	game.pieces[slot] = { ...paintedPiece(piece, color), id: game.nextId++ };
	return true;
}

// ---- Blast ----

/** The filled cells in the 3x3 square around (x, y). */
export function blastArea(game, x, y) {
	const cells = [];
	for (let by = y - BLAST_RADIUS; by <= y + BLAST_RADIUS; by++) {
		for (let bx = x - BLAST_RADIUS; bx <= x + BLAST_RADIUS; bx++) {
			const outside = bx < 0 || by < 0 || bx >= game.cols || by >= game.rows;
			if (outside) continue;
			if (game.get(bx, by)) cells.push(game.index(bx, by));
		}
	}
	return cells;
}

/** Arms a blast at (x, y). The next resolveStep clears it. */
export function useBlast(game, x, y) {
	const cells = blastArea(game, x, y);
	if (!cells.length || !takeFromBag(game, 'blast')) return false;
	game.pendingBlast = { x, y, cells };
	return true;
}

// ---- Remix ----

/**
 * Shuffles the blocks on the board. The same cells stay filled and every block keeps its color,
 * but the blocks swap places. It tries not to leave a match, but a few can remain on a crowded board.
 * Returns the moves [{ block, from, to }] (cell indexes), or null when nothing was used.
 */
export function useRemix(game) {
	const filled = filledCells(game);
	if (!filled.length || !takeFromBag(game, 'remix')) return null;
	return swapBlocks(game, filled, planRemixColors(game, filled));
}

function filledCells(game) {
	const filled = [];
	game.grid.forEach((block, index) => {
		if (block) filled.push(index);
	});
	return filled;
}

/** Plans a color for every filled cell, with the same count of each color. Tries to leave no match. */
function planRemixColors(game, filled) {
	const colorCounts = new Array(MAX_COLORS).fill(0);
	for (const index of filled) colorCounts[game.grid[index].color]++;

	let best = null;
	for (let attempt = 0; attempt < REMIX_TRIES; attempt++) {
		const plan = tryRemixPlan(game, filled, colorCounts);
		if (!best || plan.matches < best.matches) best = plan;
		if (best.matches === 0) break;
	}
	return best.colors;
}

/** One random plan. matches counts the cells that could not avoid joining a match. */
function tryRemixPlan(game, filled, colorCounts) {
	const colorsLeft = colorCounts.slice();
	const colors = new Array(game.grid.length).fill(null);
	let matches = 0;
	for (const index of filled) {
		const options = shuffleInPlace(colorsStillToPlace(colorsLeft), game.rngMisc);
		const makesNoMatch = (color) => floodFill(game, index, (other) => colors[other] === color).size < MIN_GROUP_SIZE;
		let color = options.find(makesNoMatch);
		if (color === undefined) {
			color = options[0];
			matches++;
		}
		colors[index] = color;
		colorsLeft[color]--;
	}
	return { colors, matches };
}

function colorsStillToPlace(colorsLeft) {
	return colorsLeft.flatMap((count, color) => (count > 0 ? [color] : []));
}

/** Hands each cell a block of the color planned for it, preferring one from another cell. Returns the moves. */
function swapBlocks(game, filled, plannedColors) {
	const blocksByColor = new Map();
	for (const index of filled) {
		const block = game.grid[index];
		if (!blocksByColor.has(block.color)) blocksByColor.set(block.color, []);
		blocksByColor.get(block.color).push({ block, from: index });
	}
	game.tick++;
	const newGrid = new Array(game.grid.length).fill(null);
	const moves = [];
	for (const to of filled) {
		const sameColor = blocksByColor.get(plannedColors[to]);
		const fromElsewhere = sameColor.filter((candidate) => candidate.from !== to);
		const options = fromElsewhere.length ? fromElsewhere : sameColor;
		const pick = options[Math.floor(game.rngMisc() * options.length)];
		sameColor.splice(sameColor.indexOf(pick), 1);
		newGrid[to] = pick.block;
		pick.block.stamp = game.tick;
		moves.push({ block: pick.block, from: pick.from, to });
	}
	game.grid = newGrid;
	return moves;
}

// ---- power-ups that act by themselves (Timed, the bot and the warm-up) ----

/** Blocks cleared if this piece drops at column x. The real game does not change. */
export function clearedBy(game, piece, x) {
	const trial = game.clone();
	trial.pieces = [piece];
	trial.place(0, x, piece);
	return trial.resolveAll().reduce((total, step) => total + step.cleared.length, 0);
}

/**
 * The color for an automatic Prism: paint each tray piece in it, and find the drop of one
 * painted piece that clears the most blocks. The color with the biggest clear wins.
 * On a tie, the lowest color (Ember, Amber, Moss, Tide, Dusk) wins.
 */
export function bestPrismColor(game) {
	let best = { color: 0, cleared: -1 };
	for (let color = 0; color < game.colors; color++) {
		const cleared = mostClearedWithColor(game, color);
		if (cleared > best.cleared) best = { color, cleared };
	}
	return best.color;
}

function mostClearedWithColor(game, color) {
	let most = 0;
	for (const piece of game.pieces) {
		if (!piece) continue;
		const painted = paintedPiece(piece, color);
		for (let x = 0; x <= game.cols - piece.w; x++) {
			if (game.fits(painted, x)) most = Math.max(most, clearedBy(game, painted, x));
		}
	}
	return most;
}

/** An automatic Prism paints every piece in the tray one color. Returns the color, or null. */
export function autoPrism(game) {
	if (!game.pieces.some(Boolean) || !game.bag.includes('prism')) return null;
	const color = bestPrismColor(game);
	takeFromBag(game, 'prism');
	game.pieces = game.pieces.map((piece) => (piece ? { ...paintedPiece(piece, color), id: game.nextId++ } : piece));
	return color;
}

/**
 * The center of the 3x3 area with the most blocks, for an automatic Blast.
 * On a tie, the area nearest the tray (the lowest row) wins. Null when the well is empty.
 */
export function bestBlastCell(game) {
	let best = null;
	for (let y = game.rows - 1; y >= 0; y--) {
		for (let x = 0; x < game.cols; x++) {
			const count = blastArea(game, x, y).length;
			if (count && (!best || count > best.count)) best = { x, y, count };
		}
	}
	return best && { x: best.x, y: best.y };
}

/** Uses a power-up from the bag at once, with no animation (the bot and the warm-up use this). */
export function autoUse(game, kind) {
	if (kind === 'prism') return autoPrism(game) !== null;
	if (kind === 'remix') return autoRemix(game);
	return autoBlast(game);
}

function autoRemix(game) {
	if (!useRemix(game)) return false;
	game.resolveAll();
	return true;
}

function autoBlast(game) {
	const cell = bestBlastCell(game);
	if (!cell || !useBlast(game, cell.x, cell.y)) return false;
	game.resolveAll();
	return true;
}
