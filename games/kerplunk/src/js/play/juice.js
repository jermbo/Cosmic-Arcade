// The "juice" of a move: the sounds, shakes, stickers and buzzes that go with what the engine did.
// ("Juice" is a game-design word for the feedback that makes a game feel alive.)
// The game and the Feel Lab both use it, so the lab shows exactly what the game shows.

import { audio } from '../audio/sound-player.js';
import { tuning } from '../feel/tuning.js';

const motion = tuning.motion;
const BLAST_DELAY_PER_RING = 0.05; // seconds: a blast clears from the middle outward
const BLAST_FIRST_DELAY = 0.06;
const BIG_CLEAR_BLOCKS = 7; // a clear this big shakes like a chain of 3

/**
 * Makes the juice for a view.
 * @param {{ view: import('../view/view.js').View, vibrate?: (pattern: number|number[]) => void,
 *   onScore?: () => void, banner?: (text: string, ms: number) => void }} hooks
 */
export function makeJuice({ view, vibrate = () => {}, onScore = () => {}, banner = () => {} }) {
	/** The sound, particles and score sticker of one chain step (a result of game.resolveStep). */
	function step(result) {
		view.holdFalls = true;
		breakClearedBlocks(result);
		showStepScore(result);
		playStepSound(result);
		if (result.blast) showBlast(result.blast);
		if (result.allClear) showAllClear();
	}

	/** The blocks hop and fall, one after the other from the first block of each group. A blast goes from the middle outward. */
	function breakClearedBlocks(result) {
		const delays = new Map();
		for (const group of result.groups) {
			[...group.cells].forEach((index, order) => delays.set(index, order * motion.clearStagger));
		}
		if (result.blast) addBlastDelays(delays, result.blast);
		view.killBlocks(result.cleared.map((cell) => ({ ...cell, delay: delays.get(cell.idx) ?? 0 })));
	}

	function addBlastDelays(delays, blast) {
		const { game } = view;
		for (const index of blast.cells) {
			const ringsFromMiddle = Math.max(Math.abs(game.columnOf(index) - blast.x), Math.abs(game.rowOf(index) - blast.y));
			const delay = ringsFromMiddle * BLAST_DELAY_PER_RING + BLAST_FIRST_DELAY;
			delays.set(index, Math.min(delays.get(index) ?? Infinity, delay));
		}
	}

	/** The points pop up where the blocks were, with the chain, group and Plunks bonus under them. */
	function showStepScore(result) {
		const center = view.cellCenter(...averageCell(result.cleared));
		const notes = [];
		if (result.chain > 1) notes.push(`Chain ×${result.chain}`);
		if (result.mult > 1) notes.push(`Group ×${result.mult}`);
		if (result.glints > 0) notes.push(`+${result.glints} ${result.glints === 1 ? 'Plunk' : 'Plunks'}`);
		const big = result.chain > 2 || result.mult > 1;
		view.effects.sticker({ x: center.x, y: center.y, text: `+${result.points.toLocaleString()}`, sub: notes.join(' · '), big });
		onScore();
	}

	function playStepSound(result) {
		const biggestGroup = Math.max(3, ...result.groups.map((group) => group.cells.size));
		audio.clear(result.chain, biggestGroup);
		if (result.chain >= 3 || result.cleared.length >= BIG_CLEAR_BLOCKS) {
			view.effects.shake(motion.chainShake + result.chain);
			vibrate(15);
		}
	}

	function showBlast(blast) {
		const center = view.cellCenter(blast.x, blast.y);
		view.effects.ring({ x: center.x, y: center.y, radius: view.cell * 2, width: 8, time: 0.4 });
		view.effects.shake(motion.blastShake);
		audio.blast();
		vibrate([20, 30, 20]);
	}

	function showAllClear() {
		banner('All clear!', 1400);
		view.effects.screenFlash(0.4, '#ffffff');
		audio.allClear();
	}

	/** A dropped piece lands: a thud, a buzz and a tiny shake of the well. */
	function land(blockCount) {
		audio.land(blockCount);
		vibrate(6);
		view.effects.shake(motion.landShake);
	}

	/** Sound and buzz for each moment of the Remix show. */
	function remix(event, value, sound) {
		if (event === 'charge') remixCharge(value, sound);
		else if (event === 'boom') remixBoom();
		else if (event === 'rattle') remixRattle(value);
		else if (event === 'tick') audio.remixTick(Math.floor(value / 2));
	}

	function remixCharge(seconds, sound) {
		if (!seconds) return; // a style with no wind-up
		if (sound === 'rattle') audio.remixRattle(seconds);
		else audio.remixCharge();
		vibrate([20, 40, 30, 40, 40, 40, 60]);
	}

	function remixBoom() {
		audio.remixBoom();
		vibrate([60, 30, 80]);
		banner('REMIX!', 1100);
	}

	function remixRattle(seconds) {
		audio.remixRattle(seconds);
		vibrate([30, 30, 30, 30, 30, 30, 30]);
	}

	view.onLand = land;
	view.onRemix = remix;
	return { step, land, remix };
}

/** The middle of some cells, as [x, y] in cells. */
function averageCell(cells) {
	let sumX = 0;
	let sumY = 0;
	for (const cell of cells) {
		sumX += cell.x;
		sumY += cell.y;
	}
	const count = Math.max(1, cells.length);
	return [sumX / count, sumY / count];
}
