// Crack: open 4 locked words with Wordle-style guesses, then sort all 16.
import { sfx } from '../audio.ts';
import { buildCrack } from '../core/builder.ts';
import { LEVEL_EMOJI, starsFor, TUNING } from '../core/tuning.ts';
import type { Mark } from '../core/types.ts';
import { mergeKeyMarks, scoreGuess } from '../core/words.ts';
import { SortBoard } from '../ui/board.ts';
import { h, wait } from '../ui/dom.ts';
import { toast } from '../ui/fx.ts';
import { GuessPanel } from '../ui/guesspanel.ts';
import { pushKeys } from '../ui/nav.ts';
import { Shell } from '../ui/shell.ts';
import { WordRows } from '../ui/wordrows.ts';
import type { GameCtx, ModeGame } from './ctx.ts';

interface LockState {
	guesses: string[];
	marks: Mark[][];
	done: boolean;
	cracked: boolean;
}

export function startCrack(ctx: GameCtx): ModeGame {
	const T = TUNING.crack;
	const puzzle = buildCrack(ctx.seed, ctx.date ?? undefined);
	const shell = new Shell({ title: 'Crack', tag: ctx.date ? 'Daily' : 'Practice', hearts: TUNING.hearts.crack, onBack: ctx.exit, onHelp: ctx.help });
	const locks = new Map<string, LockState>(puzzle.locked.map((w) => [w, { guesses: [], marks: [], done: false, cracked: false }]));
	let panel: GuessPanel | null = null;
	let over = false;
	let combo = 0;
	let mistakes = 0;

	const hint = h('p', { class: 'hint' }, 'Tap a ', h('b', {}, 'lock'), ' to crack it. Then sort the words into 4 groups.');

	const board = new SortBoard(
		puzzle.board,
		{
			canPlay: () => !over && !panel,
			onLockedTap: (w) => openLock(w),
			onSolve: (_g, _bar, given) => {
				if (given) return;
				combo++;
				shell.addScore(Math.round(T.points.group * (1 + (combo - 1) * TUNING.comboBonus)));
				sfx.solve(combo);
				shell.kip.react('happy');
				if (combo > 1) toast(`Combo x${combo}`);
				if (board.done) void win();
			},
			onMistake: () => {
				combo = 0;
				mistakes++;
				shell.hearts.lose();
				shell.kip.react('sad');
				if (shell.hearts.left <= 0) void lose();
			},
		},
		puzzle.locked,
	);
	shell.main.append(hint, board.el);
	const releaseKeys = pushKeys((key) => {
		if (key === 'Enter') board.submitKey();
	});

	function openLock(word: string) {
		const st = locks.get(word)!;
		if (st.done || panel) return;
		const rows = new WordRows({ length: word.length, rows: T.guesses });
		const keyMarks = new Map<string, Mark>();
		st.guesses.forEach((g, i) => {
			rows.fill(g, st.marks[i]);
			mergeKeyMarks(keyMarks, g, st.marks[i]);
		});
		const left = () => `${word.length} letters · ${T.guesses - st.guesses.length} guesses left`;
		board.setCompact(true);
		hint.hidden = true;
		shell.kip.react('think', 900);
		panel = new GuessPanel({
			title: 'Crack the lock',
			sub: left(),
			rows,
			length: word.length,
			keyMarks,
			closable: true,
			parent: shell.main,
			onClose: () => {
				panel = null;
				board.setCompact(false);
				hint.hidden = false;
			},
			onGuess: async (guess) => {
				const marks = scoreGuess(guess, word);
				st.guesses.push(guess);
				st.marks.push(marks);
				await rows.reveal(marks);
				mergeKeyMarks(keyMarks, guess, marks);
				panel?.kb.setMarks(keyMarks);
				panel?.setSub(left());
				if (guess === word) {
					st.done = st.cracked = true;
					await rows.bounce();
					shell.addScore(T.points.crack + (T.guesses - st.guesses.length) * T.points.perGuessLeft);
					sfx.unlock();
					shell.kip.react('happy');
					panel?.close();
					await board.unlock(word);
					toast(st.guesses.length === 1 ? 'First try!' : 'Cracked!');
				} else if (st.guesses.length >= T.guesses) {
					st.done = true;
					rows.showAnswer(word);
					toast(`It was ${word}`, 1800);
					shell.hearts.lose();
					shell.kip.react('sad');
					await wait(1100);
					panel?.close();
					await board.unlock(word, true);
					if (shell.hearts.left <= 0) void lose();
				} else {
					shell.kip.react('think', 700);
				}
			},
		});
	}

	function grid(): string {
		const lockRow = puzzle.locked.map((w) => (locks.get(w)!.cracked ? '🔓' : '🔒')).join('');
		return [lockRow, ...board.history.map((r) => r.map((l) => LEVEL_EMOJI[l]).join(''))].join('\n');
	}

	function lines(): string[] {
		const cracked = [...locks.values()].filter((s) => s.cracked).length;
		const guesses = [...locks.values()].filter((s) => s.cracked).reduce((n, s) => n + s.guesses.length, 0);
		return [
			`Cracked ${cracked} of 4 locks${cracked ? ` in ${guesses} guesses` : ''}`,
			`Sorted ${board.solved.length} of 4 groups · ${mistakes} wrong ${mistakes === 1 ? 'pick' : 'picks'}`,
		];
	}

	async function win() {
		over = true;
		board.setEnabled(false);
		shell.addScore(shell.hearts.left * T.points.perHeart);
		shell.kip.react('wow', 0);
		await wait(700);
		ctx.finish({ won: true, score: shell.score, stars: starsFor(shell.hearts.left, shell.hearts.max), lines: lines(), grid: grid() });
	}

	async function lose() {
		if (over) return;
		over = true;
		panel?.close();
		shell.kip.react('oops', 0);
		const sorted = board.solved.length;
		await wait(400);
		await board.revealRest();
		await wait(500);
		const out = lines();
		out[1] = `Sorted ${sorted} of 4 groups · out of hearts`;
		ctx.finish({ won: false, score: shell.score, stars: 0, lines: out, grid: grid() });
	}

	return {
		el: shell.el,
		destroy: () => {
			over = true;
			releaseKeys();
			panel?.kb.detach();
			shell.destroy();
		},
	};
}
