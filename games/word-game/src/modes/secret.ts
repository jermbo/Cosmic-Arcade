// Secret: sort the board; each solved group shows a letter of a secret word.
import { sfx } from '../audio.ts';
import { buildSecret } from '../core/builder.ts';
import { LEVEL_EMOJI, DIFFICULTY, starsFor, TUNING } from '../core/tuning.ts';
import type { Mark } from '../core/types.ts';
import { mergeKeyMarks, scoreGuess } from '../core/words.ts';
import { SortBoard } from '../ui/board.ts';
import { h, icon, wait } from '../ui/dom.ts';
import { confetti, fly, pulse, toast } from '../ui/fx.ts';
import { GuessPanel } from '../ui/guesspanel.ts';
import { pushKeys } from '../ui/nav.ts';
import { Shell } from '../ui/shell.ts';
import { WordRows } from '../ui/wordrows.ts';
import { MARK_EMOJI, type GameCtx, type ModeGame } from './ctx.ts';

export function startSecret(ctx: GameCtx): ModeGame {
	const T = { ...TUNING.secret, ...DIFFICULTY[ctx.difficulty].secret };
	const puzzle = buildSecret(ctx.seed, ctx.difficulty, ctx.date ?? undefined);
	const word = puzzle.word;
	const shell = new Shell({ title: 'Secret', tag: `${ctx.date ? 'Daily' : 'Practice'} · ${DIFFICULTY[ctx.difficulty].name}`, hearts: T.hearts, scale: TUNING.scoreScale[ctx.difficulty], onBack: ctx.exit, onHelp: ctx.help });
	const known: (string | null)[] = Array(word.length).fill(null);
	const guesses: string[] = [];
	const marks: Mark[][] = [];
	const keyMarks = new Map<string, Mark>();
	let panel: GuessPanel | null = null;
	let over = false;
	let combo = 0;
	let mistakes = 0;
	let letters = 0;
	let clueUsed = false;
	let sortingDone = false;

	// The secret strip.
	const slots = [...word].map(() => h('span', { class: 'slot' }, '?'));
	const clueText = h('p', { class: 'secret__clue', hidden: true });
	const clueBtn = h('button', { class: 'btn btn--ghost btn--small', type: 'button', on: { click: () => useClue() } }, icon('bulb'), 'Clue', h('span', { class: 'btn__cost' }, '−1 ', icon('heart', 'heart heart--tiny')));
	const guessBtn = h('button', { class: 'btn btn--go btn--small', type: 'button', on: { click: () => openGuess(false) } }, 'Guess');
	const triesEl = h('span', { class: 'secret__tries' });
	const strip = h(
		'section',
		{ class: 'secret' },
		h('div', { class: 'secret__top' }, h('span', { class: 'secret__label' }, 'Secret word'), triesEl),
		h('div', { class: 'secret__slots', '--len': word.length }, ...slots),
		clueText,
		h('div', { class: 'secret__actions' }, clueBtn, guessBtn),
	);
	const syncStrip = () => {
		const left = T.tries - guesses.length;
		triesEl.textContent = `${left} ${left === 1 ? 'try' : 'tries'} left`;
		clueBtn.disabled = clueUsed || over || shell.hearts.left <= T.cluePrice;
		guessBtn.disabled = over;
	};

	const board = new SortBoard(puzzle.board, {
		canPlay: () => !over && !panel && !sortingDone,
		onSolve: (_g, bar, given) => {
			if (given) return;
			combo++;
			shell.addScore(Math.round(T.points.group * (1 + (combo - 1) * TUNING.comboBonus)));
			sfx.solve(combo);
			shell.kip.react('happy');
			void giveLetter(bar);
			if (board.done) void endSorting();
		},
		onMistake: () => {
			combo = 0;
			mistakes++;
			shell.hearts.lose();
			shell.kip.react('sad');
			syncStrip();
			if (shell.hearts.left <= 0) {
				toast('Out of hearts. Now guess the secret!', 2200);
				void endSorting();
			}
		},
	});
	shell.main.append(strip, board.el);
	if (T.clue !== 'paid') clueBtn.hidden = true;
	if (T.clue === 'free') {
		clueText.hidden = false;
		clueText.replaceChildren('It is one of: ', h('strong', {}, puzzle.clue));
	}
	syncStrip();
	const releaseKeys = pushKeys((key) => {
		if (key === 'Enter') board.submitKey();
	});

	async function giveLetter(bar: HTMLElement) {
		const pos = puzzle.reveal[letters++];
		if (pos === undefined) return;
		const badge = h('span', { class: 'bar__letter' }, word[pos]);
		bar.append(badge);
		pulse(badge, 'bar__letter--pop');
		await wait(250);
		await fly(badge, slots[pos]);
		setKnown(pos);
		sfx.letter();
	}

	function setKnown(pos: number) {
		if (known[pos]) return;
		known[pos] = word[pos];
		slots[pos].textContent = word[pos];
		slots[pos].classList.add('slot--known');
		pulse(slots[pos], 'slot--pop');
		panel?.setSub(sub());
		rows?.setGhost(known);
	}

	async function endSorting() {
		if (sortingDone) return;
		sortingDone = true;
		await wait(900);
		if (!board.done) await board.revealRest();
		board.setEnabled(false);
		if (!over) openGuess(true);
	}

	function useClue() {
		if (clueBtn.disabled) return;
		clueUsed = true;
		for (let i = 0; i < T.cluePrice; i++) shell.hearts.lose();
		clueText.hidden = false;
		clueText.replaceChildren('It is one of: ', h('strong', {}, puzzle.clue));
		pulse(clueText, 'secret__clue--stamp');
		sfx.ui();
		syncStrip();
	}

	let rows: WordRows | null = null;
	const sub = () => {
		const left = T.tries - guesses.length;
		return `${word.length} letters · ${left} ${left === 1 ? 'try' : 'tries'} left`;
	};

	function openGuess(forced: boolean) {
		if (over || panel) return;
		rows = new WordRows({ length: word.length, rows: T.tries, ghost: known });
		guesses.forEach((g, i) => rows!.fill(g, marks[i]));
		board.setCompact(true);
		strip.classList.add('secret--guessing');
		shell.kip.react('think', 900);
		panel = new GuessPanel({
			title: forced ? 'Now name the secret' : 'Guess the secret',
			sub: sub(),
			rows,
			length: word.length,
			keyMarks,
			closable: !forced,
			checkWords: DIFFICULTY[ctx.difficulty].checkWords,
			parent: shell.main,
			onClose: () => {
				panel = null;
				rows = null;
				board.setCompact(false);
				strip.classList.remove('secret--guessing');
			},
			onGuess: async (guess) => {
				const m = scoreGuess(guess, word);
				guesses.push(guess);
				marks.push(m);
				await rows!.reveal(m);
				mergeKeyMarks(keyMarks, guess, m);
				panel?.kb.setMarks(keyMarks);
				m.forEach((mark, i) => mark === 'hit' && setKnown(i));
				panel?.setSub(sub());
				syncStrip();
				if (guess === word) void win();
				else if (guesses.length >= T.tries) void lose();
				else shell.kip.react('think', 700);
			},
		});
	}

	function grid(): string {
		return [...board.history.map((r) => r.map((l) => LEVEL_EMOJI[l]).join('')), ...marks.map((m) => m.map((k) => MARK_EMOJI[k]).join(''))].join('\n');
	}

	async function win() {
		over = true;
		await rows?.bounce();
		slots.forEach((s, i) => {
			s.textContent = word[i];
			s.classList.add('slot--win');
			s.style.setProperty('--d', `${i * 60}ms`);
			pulse(s, 'slot--hop');
		});
		const groupsLeft = puzzle.board.groups.length - letters;
		const early = sortingDone ? 0 : groupsLeft;
		shell.addScore(T.points.win + (T.tries - guesses.length) * T.points.perTryLeft + early * T.points.perGroupLeft + shell.hearts.left * T.points.perHeart);
		shell.kip.react('wow', 0);
		const r = strip.getBoundingClientRect();
		confetti(r.left + r.width / 2, r.top + r.height / 2, 30);
		await wait(900);
		panel?.close();
		const solved = letters;
		if (!board.done) await board.revealRest();
		await wait(400);
		ctx.finish({
			won: true,
			score: shell.score,
			stars: starsFor(shell.hearts.left, shell.hearts.max),
			lines: [
				`Secret: ${word} in ${guesses.length} ${guesses.length === 1 ? 'try' : 'tries'}`,
				`Sorted ${solved} of 4 groups · ${mistakes} wrong ${mistakes === 1 ? 'pick' : 'picks'}`,
				early ? `Early guess bonus: ${early} ${early === 1 ? 'group' : 'groups'} to spare` : T.clue !== 'paid' ? '' : clueUsed ? 'Used the clue' : 'No clue used',
			].filter(Boolean),
			grid: grid(),
		});
	}

	async function lose() {
		over = true;
		slots.forEach((s, i) => {
			s.textContent = word[i];
			s.classList.add('slot--lost');
		});
		toast(`It was ${word}`, 2000);
		shell.kip.react('oops', 0);
		await wait(1200);
		panel?.close();
		const solved = letters;
		if (!board.done) await board.revealRest();
		await wait(300);
		ctx.finish({
			won: false,
			score: shell.score,
			stars: 0,
			lines: [`The secret was ${word}`, `Sorted ${solved} of 4 groups · ${mistakes} wrong ${mistakes === 1 ? 'pick' : 'picks'}`],
			grid: grid(),
		});
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
