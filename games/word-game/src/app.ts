// The flow: title, game, results, back to title.
import { seedFor } from './core/builder.ts';
import { todayKey } from './core/rng.ts';
import type { ModeId } from './core/types.ts';
import type { GameCtx, ModeGame } from './modes/ctx.ts';
import { startCrack } from './modes/crack.ts';
import { startLink } from './modes/link.ts';
import { startSecret } from './modes/secret.ts';
import { newThisGame, resetGameStickers } from './book.ts';
import { TUNING } from './core/tuning.ts';
import { recordGame, save } from './save.ts';
import { openHelp } from './ui/menus.ts';
import { closeLayer, pushLayer } from './ui/nav.ts';
import { shareText, showResults } from './ui/results.ts';
import { titleScreen } from './ui/title.ts';

const START: Record<ModeId, (ctx: GameCtx) => ModeGame> = { crack: startCrack, secret: startSecret, link: startLink };

let root: HTMLElement;
let current: { el: HTMLElement; destroy: () => void } | null = null;

function show(screen: { el: HTMLElement; destroy: () => void }) {
	current?.destroy();
	current = screen;
	root.replaceChildren(screen.el);
	screen.el.classList.add('screen--in');
	scrollTo(0, 0);
}

function home() {
	show(titleScreen(play));
}

function play(mode: ModeId, daily: boolean) {
	let game: ModeGame | null = null;
	const difficulty = save.settings.difficulty;
	const depth = pushLayer(() => {
		game = null;
		home();
	});

	const run = (date: string | null) => {
		const ctx: GameCtx = {
			mode,
			date,
			difficulty,
			seed: seedFor(mode, difficulty, date),
			exit: () => closeLayer(depth),
			help: () => game && openHelp(mode, game.el),
			finish: (outcome) => {
				if (!game) return;
				if (date && outcome.won) outcome.lines.push(`🔗 +${TUNING.chain.lettersPerMode} letters for the daily chain`);
				const asked = game.hints();
				if (asked) outcome.lines.push(`Asked Kip ${asked} ${asked === 1 ? 'time' : 'times'}`);
				if (newThisGame) outcome.lines.push(`📖 ${newThisGame} new ${newThisGame === 1 ? 'sticker' : 'stickers'} for the Kin Book`);
				const newBest = recordGame(mode, difficulty, date, { won: outcome.won, stars: outcome.stars, score: outcome.score, share: shareText(mode, difficulty, date, outcome) });
				showResults({
					mode,
					difficulty,
					date,
					outcome,
					newBest,
					streak: save.stats[mode].streak,
					parent: game.el,
					onNext: () => run(null),
					onHome: () => closeLayer(depth),
				});
			},
		};
		resetGameStickers();
		game = START[mode](ctx);
		show(game);
		if (!save.seenHelp[mode]) openHelp(mode, game.el);
	};
	run(daily ? todayKey() : null);
}

export function boot(el: HTMLElement): void {
	root = el;
	home();
}
