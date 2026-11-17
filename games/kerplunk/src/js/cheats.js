// Cheats and test hooks for play-testing.

import { POWER_KINDS } from './engine.js';
import { REMIX_STYLES, REMIX_STYLE_NAMES } from './remix-styles.js';
import { POWER_NAMES } from './view.js';
import { GOLD } from './sprites.js';
import { store } from './storage.js';
import { state, view, save, waitFor } from './session.js';
import { bumpWallet } from './hud.js';
import { dropPiece, DROP_START_BELOW_WELL } from './move.js';
import { useRemix } from './powers.js';

// On for localhost and for any page opened with ?debug. Off on a real host.
// Hold Shift and press a number key for a cheat. In the console, glintwell.help() lists them all.

const FILL_PAUSE_MS = 1500; // the wait for the blocks to rise before a Remix
const cheatsOn = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || new URLSearchParams(location.search).has('debug');

if (cheatsOn) {
	/** Picks the move that scores best now and keeps the stacks low. */
	const bestMove = () => {
		const g = state.game;
		let best = null;
		g.pieces.forEach((piece, slot) => {
			if (!piece) return;
			for (let x = 0; x <= g.cols - piece.w; x++) {
				if (!g.fits(piece, x)) continue;
				const c = g.clone();
				const before = c.score;
				c.place(slot, x, piece);
				c.resolveAll();
				let filled = 0;
				for (let i = 0; i < c.grid.length; i++) if (c.grid[i]) filled++;
				const v = c.score - before - filled * 4 + Math.random();
				if (!best || v > best.v) best = { v, slot, x, p: piece };
			}
		});
		return best;
	};
	window.glintwell = {
		state,
		view,
		store,
		/** Plays n moves with the bot, with full animation. */
		async bot(n = 1000) {
			for (let i = 0; i < n && state.screen === 'playing'; i++) {
				await waitFor(() => !state.busy && !state.paused);
				if (state.screen !== 'playing') break;
				const m = bestMove();
				if (!m) break;
				await dropPiece({ slot: m.slot, piece: m.p, col: m.x, left: m.x, top: state.game.rows + DROP_START_BELOW_WELL });
			}
			return { screen: state.screen, score: state.game && state.game.score, stats: state.game && state.game.stats };
		},
		setTime(t) {
			state.timeLeft = t;
		},
		/** Puts power-ups in the bag: give('prism', 'blast', 'remix'). The bag holds 3. */
		give(...kinds) {
			const g = state.game;
			if (!g) return [];
			for (const kind of kinds) {
				if (!POWER_KINDS.includes(kind)) {
					console.warn(`Unknown power-up "${kind}". Use: ${POWER_KINDS.join(', ')}`);
					continue;
				}
				if (g.bag.length >= g.bagSize) {
					console.warn(`The bag is full (${g.bagSize}). Use one or call glintwell.empty().`);
					break;
				}
				g.bag.push(kind);
				view.fx.pop({ x: view.bar.x + view.bar.w / 2, y: view.bar.y - view.cell * 0.4, text: `Cheat: ${POWER_NAMES[kind]}`, sub: '', color: GOLD });
			}
			return g.bag.slice();
		},
		prism: () => cheat.give('prism'),
		blast: () => cheat.give('blast'),
		/** The Remix styles you can pick: remix('swirl'). */
		remixStyles() {
			return REMIX_STYLE_NAMES.slice();
		},
		/** Gives a Remix and fires it at once. Pass a style name to pick one (it stays picked). */
		remix(style) {
			if (!state.game || state.busy) return;
			if (style) {
				if (!REMIX_STYLES[style]) {
					console.warn(`Unknown style "${style}". Use: ${REMIX_STYLE_NAMES.join(', ')}`);
					return;
				}
				view.remixStyle = style;
			}
			const { bag } = state.game;
			if (!bag.includes('remix')) {
				if (bag.length >= state.game.bagSize) bag.pop();
				cheat.give('remix');
			}
			const at = REMIX_STYLE_NAMES.indexOf(view.remixStyle) + 1;
			view.fx.pop({ x: view.boardX + view.boardW / 2, y: view.boardY + view.cell * 0.6, text: `${REMIX_STYLES[view.remixStyle].label} (${at}/${REMIX_STYLE_NAMES.length})`, sub: '', color: GOLD, big: true });
			useRemix();
		},
		/** Shows the next style, one after another. An empty well is filled first. */
		async nextRemix() {
			const g = state.game;
			if (!g || state.busy) return;
			if (!g.grid.some(Boolean)) {
				cheat.fill(0.6);
				await new Promise((resolve) => setTimeout(resolve, FILL_PAUSE_MS));
			}
			cheat.demo = (cheat.demo + 1) % REMIX_STYLE_NAMES.length;
			cheat.remix(REMIX_STYLE_NAMES[cheat.demo]);
		},
		demo: -1,
		/** Adds Glints to the wallet: glints(500). */
		glints(n = 100) {
			store.glints = Math.max(0, store.glints + Math.floor(n));
			save();
			bumpWallet();
			return store.glints;
		},
		/** One of each power-up. */
		all() {
			cheat.empty();
			return cheat.give(...POWER_KINDS);
		},
		empty() {
			if (state.game) state.game.bag.length = 0;
		},
		/** Adds up to n random blocks (default 50) that rise into the well. They do not match, so nothing clears. */
		drop(n = 50) {
			const g = state.game;
			if (!g || state.busy) return 0;
			const colors = g.colors;
			const heights = Array.from({ length: g.cols }, (_, x) => g.height(x));
			let added = 0;
			for (; added < n; added++) {
				const open = heights.map((h, x) => (h < g.rows ? x : -1)).filter((x) => x >= 0);
				if (!open.length) break;
				const x = open[Math.floor(Math.random() * open.length)];
				const y = heights[x]++;
				const options = [...Array(colors).keys()].sort(() => Math.random() - 0.5);
				const color = options.find((c) => g.linkedSize((i) => (g.grid[i] ? g.grid[i].color : null), { x, y }, c) < 3) ?? options[0];
				const block = g.makeBlock(color);
				g.grid[g.index(x, y)] = block;
				view.blockVisuals.set(block.id, view.newVis(x, y + g.rows + 1, added * 0.012));
			}
			return added;
		},
		/** Empties the well, then fills it: fill(0.6) is 60% full. */
		fill(amount = 0.6) {
			const g = state.game;
			if (!g || state.busy) return 0;
			g.grid.fill(null);
			return cheat.drop(Math.round(g.cols * g.rows * Math.min(1, Math.max(0, amount))));
		},
		help() {
			console.info(
				[
					'Glintwell cheats',
					'  Hold Shift and press: 1 Prism, 2 Blast, 3 Remix, 4 all three, 5 drop 50 blocks, 6 fill the well, 7 next Remix style, 8 play it again, 9 add 100 Glints, 0 empty the bag',
					'  glintwell.give("remix", "blast")  add power-ups (bag holds 3)',
					'  glintwell.prism() / blast()       add one',
					'  glintwell.remix("swirl")          fire a Remix in that style (glintwell.remixStyles() lists them)',
					'  glintwell.nextRemix()             show the next Remix style',
					'  glintwell.glints(500)             add Glints to the wallet',
					'  glintwell.all() / empty()         one of each / clear the bag',
					'  glintwell.drop(50)                drop 50 random blocks into the well',
					'  glintwell.fill(0.6)               empty the well, then fill it 60%',
					'  glintwell.bot(50)                 play 50 moves',
					'  glintwell.setTime(5)              set the clock in Timed mode',
				].join('\n'),
			);
		},
	};
	const cheat = window.glintwell;
	document.addEventListener('keydown', (e) => {
		if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || state.screen !== 'playing' || state.paused || !state.game) return;
		const codes = { Digit1: () => cheat.give('prism'), Digit2: () => cheat.give('blast'), Digit3: () => cheat.give('remix'), Digit4: () => cheat.all(), Digit7: () => cheat.nextRemix(), Digit8: () => cheat.remix(), Digit9: () => cheat.glints(100), Digit5: () => cheat.drop(50), Digit6: () => cheat.fill(0.6), Digit0: () => cheat.empty() };
		const run = codes[e.code];
		if (!run) return;
		e.preventDefault();
		run();
	});
	console.info('Glintwell cheats are on. Type glintwell.help()');
}
