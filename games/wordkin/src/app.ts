// The flow: title, a game (or an Endless Run of games), results, back to title.
import { newThisGame, resetGameStickers } from './book.ts';
import { seedFor } from './core/builder.ts';
import { EARN, RUN } from './core/economy.ts';
import { todayKey } from './core/rng.ts';
import { DIFFICULTY, TUNING } from './core/tuning.ts';
import type { Difficulty, ModeId } from './core/types.ts';
import { startBlitz } from './modes/blitz.ts';
import type { GameCtx, ModeGame } from './modes/ctx.ts';
import { startCrack } from './modes/crack.ts';
import { startLink } from './modes/link.ts';
import { MODE_BY_ID } from './modes/meta.ts';
import { startSecret } from './modes/secret.ts';
import { persist, recordGame, save } from './save.ts';
import { earn } from './shop/wallet.ts';
import { h, icon } from './ui/dom.ts';
import { openHelp } from './ui/menus.ts';
import { openModal } from './ui/modal.ts';
import { closeLayer, pushLayer } from './ui/nav.ts';
import { shareText, showResults, type Outcome } from './ui/results.ts';
import { Hearts } from './ui/shell.ts';
import { titleScreen } from './ui/title.ts';

const START: Record<ModeId, (ctx: GameCtx) => ModeGame> = { crack: startCrack, secret: startSecret, link: startLink, blitz: startBlitz };

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
	show(titleScreen({ play, run: playRun }));
}

/** Lines every game adds to its results: hints, stickers. */
function extraLines(game: ModeGame, outcome: Outcome) {
	const asked = game.hints();
	if (asked) outcome.lines.push(`Asked Kip ${asked} ${asked === 1 ? 'time' : 'times'}`);
	if (newThisGame) outcome.lines.push(`📖 ${newThisGame} new ${newThisGame === 1 ? 'sticker' : 'stickers'} for the Kin Book`);
}

/** One game of a mode: a daily or practice, or a Blitz. */
function play(mode: ModeId, daily: boolean) {
	let game: ModeGame | null = null;
	const difficulty = save.settings.difficulty;
	const depth = pushLayer(() => {
		game = null;
		home();
	});

	const start = (date: string | null) => {
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
				extraLines(game, outcome);
				const newBest = recordGame(mode, difficulty, date, { won: outcome.won, stars: outcome.stars, score: outcome.score, share: shareText(mode, difficulty, date, outcome) });
				let coins: number;
				if (mode === 'blitz') {
					coins = earn((outcome.groups ?? 0) * EARN.blitzPerGroup);
					save.best.blitz = Math.max(save.best.blitz, outcome.score);
					persist();
				} else {
					coins = outcome.won ? earn(outcome.stars * (date ? EARN.dailyPerStar : EARN.practicePerStar)) : 0;
				}
				showResults({
					mode,
					difficulty,
					date,
					outcome,
					newBest,
					coins,
					streak: save.stats[mode].streak,
					parent: game.el,
					title: mode === 'blitz' ? `${outcome.groups ?? 0} groups!` : undefined,
					nextLabel: mode === 'blitz' ? 'Play again' : undefined,
					onNext: () => start(null),
					onHome: () => closeLayer(depth),
				});
			},
		};
		resetGameStickers();
		game = START[mode](ctx);
		show(game);
		if (!save.seenHelp[mode]) openHelp(mode, game.el);
	};
	start(daily ? todayKey() : null);
}

/** Endless Run: puzzles in turn, one set of hearts, until it runs out. */
function playRun() {
	let game: ModeGame | null = null;
	const depth = pushLayer(() => {
		game = null;
		home();
	});
	let index = 0;
	let hearts = RUN.hearts;
	let total = 0;
	let coins = 0;
	let perfects = 0;

	const tierOf = (i: number): Difficulty => RUN.tiers[Math.min(RUN.tiers.length - 1, Math.floor(i / RUN.tierEvery))];
	const modeOf = (i: number): ModeId => RUN.rotation[i % RUN.rotation.length];

	const next = () => {
		const mode = modeOf(index);
		const difficulty = tierOf(index);
		const startHearts = hearts;
		const ctx: GameCtx = {
			mode,
			date: null,
			difficulty,
			seed: seedFor(mode, difficulty, null),
			hearts: { left: hearts, max: RUN.maxHearts },
			tag: `Run #${index + 1} · ${DIFFICULTY[difficulty].name}`,
			exit: () => closeLayer(depth),
			help: () => game && openHelp(mode, game.el, undefined, difficulty),
			finish: (outcome) => {
				if (!game) return;
				total += outcome.score;
				if (!outcome.won) return void endRun();
				index++;
				hearts = outcome.heartsLeft ?? hearts;
				const perfect = hearts === startHearts;
				if (perfect) perfects++;
				const healed = perfect ? Math.min(RUN.maxHearts, hearts + RUN.perfectHeal) - hearts : 0;
				hearts += healed;
				const got = earn(EARN.runPuzzle + (perfect ? EARN.runPerfect : 0));
				coins += got;
				stepCard(outcome.score, got, perfect, healed);
			},
		};
		resetGameStickers();
		game = START[mode](ctx);
		show(game);
		if (!save.seenRun) {
			save.seenRun = true;
			persist();
			runHelp(game.el);
		} else if (!save.seenHelp[mode]) {
			openHelp(mode, game.el, undefined, difficulty);
		}
	};

	/** Between puzzles: what you got, your hearts, and what comes next. */
	function stepCard(score: number, got: number, perfect: boolean, healed: number) {
		const heartsEl = new Hearts(RUN.maxHearts, hearts - healed);
		const nextMode = MODE_BY_ID[modeOf(index)].name;
		const nextDiff = DIFFICULTY[tierOf(index)].name;
		const card = openModal({
			title: `Puzzle ${index} cleared!`,
			closable: false,
			parent: game!.el,
			cls: 'modal__card--results modal__card--step',
			body: [
				h('div', { class: 'step__hearts' }, heartsEl.el),
				h('p', { class: 'step__line' }, `+${score} points · run total ${total}`),
				h('div', { class: 'results__coins' }, icon('coin', 'coin'), `+${got}`),
				perfect ? h('p', { class: 'step__perfect' }, healed ? 'Perfect! +1 heart' : 'Perfect!') : h('p', { class: 'muted' }, 'Clear one with no mistakes to win a heart back.'),
				h('p', { class: 'step__next' }, 'Next: ', h('strong', {}, `${nextMode} · ${nextDiff}`)),
				h(
					'div',
					{ class: 'results__actions' },
					h('button', { class: 'btn btn--ghost', type: 'button', on: { click: () => { card.close(); endRun(); } } }, 'End run'),
					h('button', { class: 'btn btn--go', type: 'button', on: { click: () => { card.close(); next(); } } }, 'Next puzzle'),
				),
			],
		});
		if (healed) setTimeout(() => {
			const lost = heartsEl.el.querySelectorAll('.heart--lost');
			const back = lost[0] as HTMLElement | undefined;
			back?.classList.remove('heart--lost');
			back?.animate([{ transform: 'scale(1.8) rotate(-12deg)' }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.3,1.5,.5,1)' });
		}, 500);
	}

	function endRun() {
		if (!game) return;
		const cleared = index;
		const bestBefore = save.best.runPuzzles;
		save.best.runPuzzles = Math.max(save.best.runPuzzles, cleared);
		save.best.runScore = Math.max(save.best.runScore, total);
		persist();
		const outcome: Outcome = {
			won: cleared > 0,
			score: total,
			stars: RUN.stars.filter((n) => cleared >= n).length,
			lines: [`Cleared ${cleared} ${cleared === 1 ? 'puzzle' : 'puzzles'} · ${perfects} perfect`, `Best run: ${save.best.runPuzzles} puzzles`],
			grid: Array.from({ length: cleared }, (_, i) => ({ crack: '🔓', secret: '🔵', link: '🔗', blitz: '⏱' })[modeOf(i)]).join(''),
		};
		extraLines(game, outcome);
		showResults({
			mode: modeOf(0),
			difficulty: tierOf(Math.max(0, cleared - 1)),
			date: null,
			outcome,
			newBest: cleared > bestBefore,
			coins,
			streak: 0,
			parent: game.el,
			name: 'Endless Run',
			title: cleared ? `Run over: ${cleared} cleared` : 'Run over',
			nextLabel: 'New run',
			onNext: () => {
				index = 0;
				hearts = RUN.hearts;
				total = 0;
				coins = 0;
				perfects = 0;
				next();
			},
			onHome: () => closeLayer(depth),
		});
	}

	next();
}

function runHelp(parent: HTMLElement) {
	let card: ReturnType<typeof openModal>;
	card = openModal({
		title: 'Endless Run',
		parent,
		cls: 'modal__card--help',
		body: [
			h(
				'ol',
				{ class: 'steps' },
				h('li', {}, h('p', {}, `Puzzles keep coming: Crack, then Secret, then Link, and round again.`)),
				h('li', {}, h('p', {}, `You have ${RUN.hearts} hearts for the whole run. When they are gone, the run ends.`)),
				h('li', {}, h('p', {}, `Clear a puzzle with no mistakes to win a heart back. It gets harder every ${RUN.tierEvery} puzzles.`)),
				h('li', {}, h('p', {}, `Each puzzle you clear pays ${EARN.runPuzzle} coins, +${EARN.runPerfect} if perfect.`)),
			),
			h('button', { class: 'btn btn--go btn--wide', type: 'button', on: { click: () => card.close() } }, "Let's run"),
		],
	});
}

export function boot(el: HTMLElement): void {
	root = el;
	home();
}

