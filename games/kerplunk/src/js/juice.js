// The "juice" of a move: the sounds, shakes, stickers and buzzes that go with what the engine did.
// The game and the Feel Lab both use it, so the lab shows exactly what the game shows.

import { audio } from './audio.js';
import { tuning } from './tuning.js';

const M = tuning.motion;

/**
 * @param {{ view: import('./view.js').View, vibrate?: (pattern: number|number[]) => void,
 *   onScore?: () => void, banner?: (text: string, ms: number) => void }} hooks
 */
export function makeJuice({ view, vibrate = () => {}, onScore = () => {}, banner = () => {} }) {
	/** Plays the sound, particles and score pop for one chain step. */
	function step(s) {
		view.holdFalls = true;
		killClearedBlocks(s);
		popStepScore(s);
		playStepSound(s);
		if (s.blast) showBlast(s.blast);
		if (s.allClear) showAllClear();
	}

	/** The blocks hop and fall, one after the other from the first block of each group. A blast goes from the middle outward. */
	function killClearedBlocks(s) {
		const g = view.game;
		const delay = new Map();
		for (const grp of s.groups) [...grp.cells].forEach((idx, order) => delay.set(idx, order * M.clearStagger));
		if (s.blast) {
			for (const idx of s.blast.cells) {
				const d = Math.max(Math.abs(g.columnOf(idx) - s.blast.x), Math.abs(g.rowOf(idx) - s.blast.y)) * 0.05 + 0.06;
				delay.set(idx, Math.min(delay.get(idx) ?? Infinity, d));
			}
		}
		view.killBlocks(s.cleared.map((c) => ({ ...c, delay: delay.get(c.idx) ?? 0 })));
	}

	/** The points pop up where the blocks were, with the chain, group and Plunks bonus under them. */
	function popStepScore(s) {
		let sx = 0;
		let sy = 0;
		for (const c of s.cleared) {
			sx += c.x;
			sy += c.y;
		}
		const n = Math.max(1, s.cleared.length);
		const center = view.cellCenter(sx / n, sy / n);
		const parts = [];
		if (s.chain > 1) parts.push(`Chain ×${s.chain}`);
		if (s.mult > 1) parts.push(`Group ×${s.mult}`);
		if (s.glints > 0) parts.push(`+${s.glints} ${s.glints === 1 ? 'Plunk' : 'Plunks'}`);
		view.fx.pop({ x: center.x, y: center.y, text: `+${s.points.toLocaleString()}`, sub: parts.join(' · '), big: s.chain > 2 || s.mult > 1 });
		onScore();
	}

	function playStepSound(s) {
		const biggest = Math.max(3, ...s.groups.map((grp) => grp.cells.size));
		audio.clear(s.chain, biggest);
		if (s.chain >= 3 || s.cleared.length >= 7) {
			view.fx.shake(M.chainShake + s.chain);
			vibrate(15);
		}
	}

	function showBlast(blast) {
		const { cell } = view;
		const c = view.cellCenter(blast.x, blast.y);
		view.fx.ring({ x: c.x, y: c.y, radius: cell * 2, width: 8, time: 0.4 });
		view.fx.shake(M.blastShake);
		audio.flare();
		vibrate([20, 30, 20]);
	}

	function showAllClear() {
		banner('All clear!', 1400);
		view.fx.screenFlash(0.4, '#ffffff');
		audio.allClear();
	}

	/** A dropped piece lands: a thud, a buzz and a tiny shake of the well. */
	function land(count) {
		audio.land(count);
		vibrate(6);
		view.fx.shake(M.landShake);
	}

	/** Sound and buzz for each moment of the Remix show. */
	function remix(event, value, sound) {
		if (event === 'charge') {
			if (!value) return; // a style with no wind-up
			if (sound === 'rattle') audio.remixRattle(value);
			else audio.remixCharge();
			vibrate([20, 40, 30, 40, 40, 40, 60]);
		} else if (event === 'boom') {
			audio.remixBoom();
			vibrate([60, 30, 80]);
			banner('REMIX!', 1100);
		} else if (event === 'rattle') {
			audio.remixRattle(value);
			vibrate([30, 30, 30, 30, 30, 30, 30]);
		} else if (event === 'tick') {
			audio.remixTick(Math.floor(value / 2));
		}
	}

	view.onLand = land;
	view.onRemix = remix;
	return { step, land, remix };
}
