// Plays many games with bots to check balance. Run: node tools/sim.js
import { Game, rotatePiece, DEFAULT_LAB } from '../src/js/engine.js';

function moves(game) {
	const out = [];
	game.pieces.forEach((piece, slot) => {
		if (!piece) return;
		let p = piece;
		for (let r = 0; r < 4; r++) {
			for (let x = 0; x <= game.cols - p.w; x++) if (game.fits(p, x)) out.push({ slot, piece: p, x });
			p = rotatePiece(p);
		}
	});
	return out;
}

function chainValue(game, move) {
	const g = game.clone();
	g.place(move.slot, move.x, move.piece);
	const steps = g.resolveAll().length;
	let top = 0;
	for (let x = 0; x < g.cols; x++) top = Math.max(top, g.height(x));
	return steps * 100 - top * 6 + g.score * 0.001;
}

function value(game, move) {
	const g = game.clone();
	const before = g.score;
	g.place(move.slot, move.x, move.piece);
	g.resolveAll();
	let filled = 0;
	let top = 0;
	for (let x = 0; x < g.cols; x++) {
		const h = g.height(x);
		filled += h;
		top = Math.max(top, h);
	}
	return g.score - before - filled * 4 - top * 6;
}

const bots = {
	random: (game, rng) => {
		const list = moves(game);
		return list[Math.floor(rng() * list.length)];
	},
	// Looks for the longest chain: a stand-in for a player who plans ahead.
	chainer: (game) => {
		let best = null;
		let bestValue = -Infinity;
		for (const m of moves(game)) {
			const v = chainValue(game, m);
			if (v > bestValue) {
				bestValue = v;
				best = m;
			}
		}
		return best;
	},
	greedy: (game) => {
		let best = null;
		let bestValue = -Infinity;
		for (const m of moves(game)) {
			const v = value(game, m);
			if (v > bestValue) {
				bestValue = v;
				best = m;
			}
		}
		return best;
	},
};

function play(botName, lab, mode, seed, maxTurns = 400) {
	const game = new Game({ mode, lab, seed });
	let r = seed;
	const rng = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
	const rewards = { prism: 0, blast: 0, remix: 0 };
	const chains = [];
	while (game.hasMove() && game.turn < maxTurns) {
		const m = bots[botName](game, rng);
		game.place(m.slot, m.x, m.piece);
		const steps = game.resolveAll();
		chains.push(steps.length);
		const won = game.awardChain(steps.length);
		if (won) rewards[won.kind]++;
		game.bag.length = 0;
		game.refill(m.slot);
	}
	game.sim = { rewards, chains };
	return game;
}

function report(label, botName, lab, mode = 'endless', n = 40) {
	const games = [];
	for (let i = 0; i < n; i++) games.push(play(botName, lab, mode, 1000 + i));
	const avg = (f) => (games.reduce((s, g) => s + f(g), 0) / n).toFixed(1);
	const capped = games.filter((g) => g.turn >= 400).length;
	const turns = games.reduce((s, g) => s + g.turn, 0);
	// How many turns on average between rewards (a reward is the highest tier a chain reached).
	const per = (kind) => {
		const total = games.reduce((s, g) => s + g.sim.rewards[kind], 0);
		return total ? (turns / total).toFixed(0) : '-';
	};
	const dist = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	for (const g of games) for (const c of g.sim.chains) dist[Math.min(10, c)]++;
	console.log(
		`${label.padEnd(18)} ${botName.padEnd(7)} turns ${avg((g) => g.turn).padStart(6)}  score ${avg((g) => g.score).padStart(8)}  ` +
			`best chain ${avg((g) => g.stats.bestChain)}  capped ${capped}/${n}  ` +
			`turns per prism/blast/remix ${per('prism')}/${per('blast')}/${per('remix')}`,
	);
	console.log(`${''.padEnd(18)} chain length counts (0..10+): ${dist.join(' ')}`);
}

const only = process.argv[2];
const variants = [
	['default', {}],
	['small grid', { grid: 'small' }],
	['large grid', { grid: 'large' }],
	['3 pieces', { pieces: 3 }],
];
for (const [label, lab] of variants) {
	if (only && only !== label) continue;
	for (const bot of ['random', 'greedy', 'chainer']) report(label, bot, { ...DEFAULT_LAB, ...lab }, 'endless', bot === 'random' ? 60 : 12);
}
