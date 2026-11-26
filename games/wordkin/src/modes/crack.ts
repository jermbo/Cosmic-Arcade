// Crack: open 4 locked words with Wordle-style guesses, then sort all 16.
import { sfx } from '../audio.ts';
import { buildCrack } from '../core/builder.ts';
import { LEVEL_EMOJI, DIFFICULTY, starsFor, TUNING } from '../core/tuning.ts';
import type { Mark } from '../core/types.ts';
import { mergeKeyMarks, scoreGuess } from '../core/words.ts';
import { SortBoard } from '../ui/board.ts';
import { h, wait } from '../ui/dom.ts';
import { toast } from '../ui/fx.ts';
import { GuessPanel } from '../ui/guesspanel.ts';
import { pushKeys } from '../ui/nav.ts';
import { Shell } from '../ui/shell.ts';
import { noteSticker } from '../ui/stickers.ts';
import { WordRows } from '../ui/wordrows.ts';
import type { GameCtx, ModeGame } from './ctx.ts';

interface LockState {
	guesses: string[];
	marks: Mark[][];
	done: boolean;
	cracked: boolean;
}

export function startCrack(ctx: GameCtx): ModeGame {
	const T = { ...TUNING.crack, ...DIFFICULTY[ctx.difficulty].crack };
	const puzzle = buildCrack(ctx.seed, ctx.difficulty, ctx.date ?? undefined);
	const shell = new Shell({ title: 'Crack', tag: ctx.tag ?? `${ctx.date ? 'Daily' : 'Practice'} · ${DIFFICULTY[ctx.difficulty].name}`, hearts: ctx.hearts?.max ?? T.hearts, heartsLeft: ctx.hearts?.left, scale: TUNING.scoreScale[ctx.difficulty], hints: DIFFICULTY[ctx.difficulty].hints, onHint: () => askKip(), onBack: ctx.exit, onHelp: ctx.help });
	const hints = new Map(puzzle.locked.map((w, i) => [w, puzzle.hints[i]]));
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
			onSolve: (g, _bar, given) => {
				if (given) return;
				noteSticker(g.id, shell.kip);
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
		hints,
	);
	shell.main.append(hint, board.el);
	const releaseKeys = pushKeys((key) => {
		if (key === 'Enter') board.submitKey();
	});

	function openLock(word: string) {
		const st = locks.get(word)!;
		if (st.done || panel) return;
		const rows = new WordRows({ length: word.length, rows: T.guesses, ghost: hints.get(word) });
		openWord = word;
		openRows = rows;
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
			checkWords: DIFFICULTY[ctx.difficulty].checkWords,
			parent: shell.main,
			onClose: () => {
				panel = null;
				openWord = null;
				openRows = null;
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

	let openWord: string | null = null;
	let openRows: WordRows | null = null;

	/** Ask Kip: a letter of the open lock, or two words that are kin. */
	function askKip(): string | null {
		if (over) return null;
		if (openWord) {
			const word = openWord;
			const shown = hints.get(word)!;
			const hit = new Set<number>();
			locks.get(word)!.marks.forEach((m) => m.forEach((k, i) => k === 'hit' && hit.add(i)));
			const free = [...word].map((_, i) => i).filter((i) => !shown[i] && !hit.has(i));
			if (!free.length) return null;
			const pos = free[Math.floor(Math.random() * free.length)];
			shown[pos] = word[pos];
			openRows?.setGhost(shown);
			board.refreshLock(word);
			return `Letter ${pos + 1} is ${word[pos]}!`;
		}
		return board.hintKin() ? 'Psst… tiles with the same number are kin.' : null;
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
		ctx.finish({ heartsLeft: shell.hearts.left, won: true, score: shell.score, stars: starsFor(shell.hearts.left, shell.hearts.max), lines: lines(), grid: grid() });
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
		ctx.finish({ heartsLeft: shell.hearts.left, won: false, score: shell.score, stars: 0, lines: out, grid: grid() });
	}

	return {
		el: shell.el,
		hints: () => shell.hintsUsed,
		destroy: () => {
			over = true;
			releaseKeys();
			panel?.kb.detach();
			shell.destroy();
		},
	};
}
