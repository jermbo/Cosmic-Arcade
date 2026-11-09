// A simple bot that plays a Game. It runs the warm-up boost.

export const WARMUP_ROUNDS = 20; // the game plays these rounds for you at the start (costs WARMUP_COST)

/** The move a simple bot would pick now: the best score, with a low stack. Returns { slot, x } or null. */
export function chooseMove(game) {
	let best = null;
	game.pieces.forEach((piece, slot) => {
		if (!piece) return;
		for (let x = 0; x <= game.cols - piece.w; x++) {
			if (!game.fits(piece, x)) continue;
			const c = game.clone();
			const before = c.score;
			c.place(slot, x, piece);
			c.resolveAll();
			let filled = 0;
			let top = 0;
			for (let cx = 0; cx < c.cols; cx++) {
				const h = c.height(cx);
				filled += h;
				top = Math.max(top, h);
			}
			const value = c.score - before - filled * 4 - top * 6 + game.rngMisc();
			if (!best || value > best.value) best = { slot, x, value };
		}
	});
	return best;
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
		game.place(move.slot, move.x);
		const steps = game.resolveAll();
		game.awardChain(steps.length, Math.max(0, ...steps.map((s) => s.biggest)));
		game.refill(move.slot);
	}
	return played;
}
