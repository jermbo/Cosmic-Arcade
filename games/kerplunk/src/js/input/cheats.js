// Cheats and test hooks for play-testing.
// On for localhost and for any page opened with ?debug. Off on a real host.
// Hold Shift and press a number key for a cheat. In the console, kerplunk.help() lists them all.

import { POWER_KINDS } from '../rules/power-ups.js';
import { MIN_GROUP_SIZE } from '../rules/scoring.js';
import { chooseMove } from '../rules/bot.js';
import { REMIX_STYLES, REMIX_STYLE_NAMES } from '../view/remix-styles.js';
import { POWER_NAMES } from '../view/power-icons.js';
import { newBlockVisual } from '../view/block-motion.js';
import { store } from '../app/storage.js';
import { state, view, save, waitFor } from '../play/session.js';
import { bumpWallet } from '../screens/hud.js';
import { dropPiece, DROP_START_BELOW_WELL } from '../play/move.js';
import { useRemix } from '../play/use-power-ups.js';

const FILL_PAUSE_MS = 1500; // the wait for the blocks to rise before a Remix
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const cheatsOn = LOCAL_HOSTS.includes(location.hostname) || new URLSearchParams(location.search).has('debug');

const HELP = [
	'Kerplunk cheats',
	'  Hold Shift and press: 1 Prism, 2 Blast, 3 Remix, 4 all three, 5 drop 50 blocks, 6 fill the well, 7 next Remix style, 8 play it again, 9 add 100 Plunks, 0 empty the bag',
	'  kerplunk.give("remix", "blast")  add power-ups (bag holds 3)',
	'  kerplunk.prism() / blast()       add one',
	'  kerplunk.remix("swirl")          fire a Remix in that style (kerplunk.remixStyles() lists them)',
	'  kerplunk.nextRemix()             show the next Remix style',
	'  kerplunk.glints(500)             add Plunks to the wallet',
	'  kerplunk.all() / empty()         one of each / clear the bag',
	'  kerplunk.drop(50)                drop 50 random blocks into the well',
	'  kerplunk.fill(0.6)               empty the well, then fill it 60%',
	'  kerplunk.bot(50)                 play 50 moves',
	'  kerplunk.setTime(5)              set the clock in Timed mode',
].join('\n');

/** A sticker over the power-up bar. */
function barSticker(text) {
	const { bar } = view;
	view.effects.sticker({ x: bar.x + bar.w / 2, y: bar.y - view.cell * 0.4, text, sub: '' });
}

const cheats = {
	state,
	view,
	store,
	demoIndex: -1, // the Remix style nextRemix() showed last

	/** Plays n moves with the bot, with full animation. */
	async bot(moves = 1000) {
		for (let i = 0; i < moves && state.screen === 'playing'; i++) {
			await waitFor(() => !state.busy && !state.paused);
			if (state.screen !== 'playing') break;
			const move = chooseMove(state.game);
			if (!move) break;
			const piece = state.game.pieces[move.slot];
			await dropPiece({ slot: move.slot, piece, col: move.x, left: move.x, top: state.game.rows + DROP_START_BELOW_WELL });
		}
		const game = state.game;
		return { screen: state.screen, score: game && game.score, stats: game && game.stats };
	},

	setTime(seconds) {
		state.timeLeft = seconds;
	},

	/** Puts power-ups in the bag: give('prism', 'blast', 'remix'). */
	give(...kinds) {
		const game = state.game;
		if (!game) return [];
		for (const kind of kinds) {
			if (!POWER_KINDS.includes(kind)) {
				console.warn(`Unknown power-up "${kind}". Use: ${POWER_KINDS.join(', ')}`);
				continue;
			}
			if (game.bag.length >= game.bagSize) {
				console.warn(`The bag is full (${game.bagSize}). Use one or call kerplunk.empty().`);
				break;
			}
			game.bag.push(kind);
			barSticker(`Cheat: ${POWER_NAMES[kind]}`);
		}
		return game.bag.slice();
	},

	prism: () => cheats.give('prism'),
	blast: () => cheats.give('blast'),

	/** The Remix styles you can pick: remix('swirl'). */
	remixStyles() {
		return REMIX_STYLE_NAMES.slice();
	},

	/** Gives a Remix and fires it at once. Pass a style name to pick one (it stays picked). */
	remix(style) {
		const game = state.game;
		if (!game || state.busy) return;
		if (style && !REMIX_STYLES[style]) {
			console.warn(`Unknown style "${style}". Use: ${REMIX_STYLE_NAMES.join(', ')}`);
			return;
		}
		if (style) view.remixStyle = style;
		if (!game.bag.includes('remix')) {
			if (game.bag.length >= game.bagSize) game.bag.pop();
			cheats.give('remix');
		}
		const number = REMIX_STYLE_NAMES.indexOf(view.remixStyle) + 1;
		const label = `${REMIX_STYLES[view.remixStyle].label} (${number}/${REMIX_STYLE_NAMES.length})`;
		view.effects.sticker({ x: view.boardX + view.boardW / 2, y: view.boardY + view.cell * 0.6, text: label, sub: '', big: true });
		useRemix();
	},

	/** Shows the next style, one after another. An empty well is filled first. */
	async nextRemix() {
		const game = state.game;
		if (!game || state.busy) return;
		if (!game.grid.some(Boolean)) {
			cheats.fill(0.6);
			await new Promise((resolve) => setTimeout(resolve, FILL_PAUSE_MS));
		}
		cheats.demoIndex = (cheats.demoIndex + 1) % REMIX_STYLE_NAMES.length;
		cheats.remix(REMIX_STYLE_NAMES[cheats.demoIndex]);
	},

	/** Adds Plunks to the wallet: glints(500). */
	glints(amount = 100) {
		store.glints = Math.max(0, store.glints + Math.floor(amount));
		save();
		bumpWallet();
		return store.glints;
	},

	/** One of each power-up. */
	all() {
		cheats.empty();
		return cheats.give(...POWER_KINDS);
	},

	empty() {
		if (state.game) state.game.bag.length = 0;
	},

	/** Adds up to `count` random blocks that rise into the well. They do not match, so nothing clears. */
	drop(count = 50) {
		const game = state.game;
		if (!game || state.busy) return 0;
		const heights = Array.from({ length: game.cols }, (_, x) => game.height(x));
		let added = 0;
		for (; added < count; added++) {
			const openColumns = heights.map((height, x) => (height < game.rows ? x : -1)).filter((x) => x >= 0);
			if (!openColumns.length) break;
			const x = openColumns[Math.floor(Math.random() * openColumns.length)];
			const y = heights[x]++;
			const block = game.makeBlock(colorWithNoMatch(game, x, y));
			game.grid[game.index(x, y)] = block;
			view.blockVisuals.set(block.id, newBlockVisual(x, y + game.rows + 1, added * 0.012));
		}
		return added;
	},

	/** Empties the well, then fills it: fill(0.6) is 60% full. */
	fill(amount = 0.6) {
		const game = state.game;
		if (!game || state.busy) return 0;
		game.grid.fill(null);
		return cheats.drop(Math.round(game.cols * game.rows * Math.min(1, Math.max(0, amount))));
	},

	help() {
		console.info(HELP);
	},
};

/** A random color that makes no match at (x, y), if there is one. */
function colorWithNoMatch(game, x, y) {
	const colors = [...Array(game.colors).keys()].sort(() => Math.random() - 0.5);
	const colorAt = (index) => (game.grid[index] ? game.grid[index].color : null);
	return colors.find((color) => game.linkedSize(colorAt, { x, y }, color) < MIN_GROUP_SIZE) ?? colors[0];
}

// Shift + a number key.
const SHORTCUTS = {
	Digit1: () => cheats.give('prism'),
	Digit2: () => cheats.give('blast'),
	Digit3: () => cheats.give('remix'),
	Digit4: () => cheats.all(),
	Digit5: () => cheats.drop(50),
	Digit6: () => cheats.fill(0.6),
	Digit7: () => cheats.nextRemix(),
	Digit8: () => cheats.remix(),
	Digit9: () => cheats.glints(100),
	Digit0: () => cheats.empty(),
};

function onShortcut(event) {
	const otherKeys = event.ctrlKey || event.metaKey || event.altKey;
	if (!event.shiftKey || otherKeys || state.screen !== 'playing' || state.paused || !state.game) return;
	const run = SHORTCUTS[event.code];
	if (!run) return;
	event.preventDefault();
	run();
}

if (cheatsOn) {
	window.kerplunk = cheats;
	document.addEventListener('keydown', onShortcut);
	console.info('Kerplunk cheats are on. Type kerplunk.help()');
}
