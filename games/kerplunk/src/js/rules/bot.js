// A simple bot that plays a Game. It runs the warm-up boost, and the cheats use it too.

export const WARMUP_ROUNDS = 20; // the game plays these rounds for you at the start (costs WARMUP_COST)

// How the bot scores a move: the points it makes, minus a cost for a full, tall stack.
const FILLED_CELL_COST = 4;
const TALLEST_COLUMN_COST = 6;

/** The move a simple bot would pick now: the best score, with a low stack. Returns { slot, x } or null. */
export function chooseMove(game) {
	let best = null;
	game.pieces.forEach((piece, slot) => {
		if (!piece) return;
		for (let x = 0; x <= game.cols - piece.w; x++) {
			if (!game.fits(piece, x)) continue;
			// A small random part, so the bot does not always play the same way.
			const value = moveValue(game, slot, piece, x) + game.rngMisc();
			if (!best || value > best.value) best = { slot, x, value };
		}
	});
	return best;
}

/** Tries the move on a copy of the game. */
function moveValue(game, slot, piece, x) {
	const trial = game.clone();
	const scoreBefore = trial.score;
	trial.place(slot, x, piece);
	trial.resolveAll();
	const { filled, tallest } = stackSize(trial);
	return trial.score - scoreBefore - filled * FILLED_CELL_COST - tallest * TALLEST_COLUMN_COST;
}

function stackSize(game) {
	let filled = 0;
	let tallest = 0;
	for (let x = 0; x < game.cols; x++) {
		const height = game.height(x);
		filled += height;
		tallest = Math.max(tallest, height);
	}
	return { filled, tallest };
}

/**
 * The game plays the first rounds for the player (the warm-up). Score and power-ups earned count.
 * Returns how many rounds it played. It stops early if no piece fits.
 */
export function autoPlay(game, rounds = WARMUP_ROUNDS) {
	let played = 0;
	for (; played < rounds; played++) {
		const move = chooseMove(game);
		if (!move) break;
		playRound(game, move);
	}
	return played;
}

function playRound(game, move) {
	game.place(move.slot, move.x);
	const steps = game.resolveAll();
	game.awardChain(steps.length, Math.max(0, ...steps.map((step) => step.biggest)));
	game.refillTray();
	// In Timed an earned power-up acts at once, so the bag stays empty.
	if (game.autoPowers) useWholeBag(game);
}

function useWholeBag(game) {
	while (game.bag.length) {
		const used = game.autoUse(game.bag[0]);
		if (!used) game.bag.shift();
	}
}
