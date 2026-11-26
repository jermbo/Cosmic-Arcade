// Link: 4 rounds. Guess hidden words to find what links them, then name the link.
import { sfx } from '../audio.ts';
import { buildLink } from '../core/builder.ts';
import { LEVEL_EMOJI, LEVEL_NAMES, DIFFICULTY, starsFor, TUNING } from '../core/tuning.ts';
import type { LinkRound, Mark } from '../core/types.ts';
import { isWord, mergeKeyMarks, scoreGuess } from '../core/words.ts';
import { h, lengthClass, wait } from '../ui/dom.ts';
import { calm, confetti, pulse, toast } from '../ui/fx.ts';
import { Keyboard } from '../ui/keyboard.ts';
import { openModal, type ModalHandle } from '../ui/modal.ts';
import { Shell } from '../ui/shell.ts';
import { noteSticker } from '../ui/stickers.ts';
import { WordRows } from '../ui/wordrows.ts';
import type { GameCtx, ModeGame } from './ctx.ts';

interface Slot {
	word: string;
	found: boolean;
	guesses: string[];
	marks: Mark[][];
	/** Letter spots Kip showed. */
	extra: Set<number>;
	el: HTMLButtonElement;
}

export function startLink(ctx: GameCtx): ModeGame {
	const T = { ...TUNING.link, ...DIFFICULTY[ctx.difficulty].link };
	const puzzle = buildLink(ctx.seed, ctx.difficulty, ctx.date ?? undefined);
	const shell = new Shell({ title: 'Link', tag: `${ctx.date ? 'Daily' : 'Practice'} · ${DIFFICULTY[ctx.difficulty].name}`, hearts: T.hearts, scale: TUNING.scoreScale[ctx.difficulty], hints: DIFFICULTY[ctx.difficulty].hints, onHint: () => hint(), onBack: ctx.exit, onHelp: ctx.help });
	let over = false;
	let roundIndex = 0;
	let round: LinkRound;
	let slots: Slot[] = [];
	let active = 0;
	let left = T.guesses;
	let rows: WordRows | null = null;
	let keyMarks = new Map<string, Mark>();
	let struck = new Set<string>();
	let sheet: ModalHandle | null = null;
	let combo = 0;
	let wordsFound = 0;
	let busy = false;
	const summary: string[] = [];

	const pips = puzzle.rounds.map((r) => h('span', { class: `pip pip--l${r.group.level}` }));
	const roundTitle = h('h2', { class: 'round__title' });
	const leftEl = h('span', { class: 'round__left' });
	const slotGrid = h('div', { class: 'slots' });
	const rowsBox = h('div', { class: 'link__rows' });
	const nameBtn = h('button', { class: 'btn btn--go btn--wide', type: 'button', on: { click: () => openNames(false) } }, 'Name the link');
	const themeBanner = h('div', { class: 'round__banner', hidden: true });
	const card = h('section', { class: 'round' }, h('div', { class: 'round__top' }, roundTitle, leftEl), slotGrid, themeBanner);
	const kb = new Keyboard((k) => void key(k));
	shell.main.classList.add('game__main--link');
	shell.main.append(h('div', { class: 'pips', 'aria-hidden': 'true' }, ...pips), card, rowsBox, h('div', { class: 'link__actions' }, nameBtn), kb.el);
	kb.attach();

	function startRound(i: number) {
		roundIndex = i;
		round = puzzle.rounds[i];
		left = T.guesses;
		struck = new Set();
		keyMarks = new Map();
		kb.setMarks(keyMarks);
		pips.forEach((p, k) => {
			p.classList.toggle('pip--now', k === i);
		});
		roundTitle.textContent = `Round ${i + 1} · ${LEVEL_NAMES[round.group.level]}`;
		card.className = `round round--l${round.group.level}`;
		themeBanner.hidden = true;
		slots = round.group.words.map((word) => {
			const el = h('button', { class: `slot-word ${lengthClass(word)}`, type: 'button', on: { click: () => choose(slots.indexOf(slot)) } });
			const slot: Slot = { word, found: false, guesses: [], marks: [], extra: new Set(), el };
			return slot;
		});
		slotGrid.replaceChildren(...slots.map((s) => s.el));
		slots.forEach(paintSlot);
		if (!calm()) {
			slots.forEach((s, k) => {
				s.el.style.setProperty('--d', `${k * 70}ms`);
				pulse(s.el, 'slot-word--in');
			});
			pulse(card, 'round--in');
		}
		choose(0, true);
		syncLeft();
	}

	function paintSlot(s: Slot) {
		const known = ghostFor(s);
		s.el.replaceChildren(...[...s.word].map((ch, i) => h('span', { class: `slot-word__ch${s.found || known[i] ? ' slot-word__ch--on' : ''}` }, s.found || known[i] ? ch : '')));
		s.el.classList.toggle('slot-word--found', s.found);
		s.el.setAttribute('aria-label', s.found ? s.word : `${s.word.length} letters, starts with ${s.word[0]}`);
	}

	/** First letter, plus any letter a past guess put in the right spot. */
	function ghostFor(s: Slot): (string | null)[] {
		const last = s.word.length - 1;
		const g: (string | null)[] = [...s.word].map((ch, i) => (i === 0 || (T.showLast && i === last) || s.extra.has(i) ? ch : null));
		s.marks.forEach((m) => m.forEach((mark, i) => mark === 'hit' && (g[i] = s.word[i])));
		return g;
	}

	/** Ask Kip: one more letter of the word you are on. */
	function hint(): string | null {
		if (over || busy || sheet) return null;
		const s = slots[active];
		if (!s || s.found) return null;
		const free = ghostFor(s).map((g, i) => (g ? -1 : i)).filter((i) => i >= 0);
		if (!free.length) return "You know every letter. Type it in!";
		const pos = free[Math.floor(Math.random() * free.length)];
		s.extra.add(pos);
		paintSlot(s);
		pulse(s.el, 'tile--nudge');
		rows?.setGhost(ghostFor(s));
		return `Letter ${pos + 1} is ${s.word[pos]}!`;
	}

	function choose(i: number, quiet = false) {
		if (busy || over || i < 0 || slots[i].found) return;
		active = i;
		slots.forEach((s, k) => s.el.classList.toggle('slot-word--active', k === i));
		const s = slots[i];
		rows = new WordRows({ length: s.word.length, rows: 0, ghost: ghostFor(s) });
		s.guesses.forEach(() => rows!.addRow());
		s.guesses.forEach((g, k) => rows!.fill(g, s.marks[k]));
		if (left > 0) rows.addRow();
		rowsBox.replaceChildren(rows.el);
		rows.el.classList.add('rows--link');
		rows.scrollToNow();
		if (!quiet) sfx.select(1);
	}

	function syncLeft() {
		leftEl.replaceChildren(h('b', {}, String(left)), left === 1 ? ' guess left' : ' guesses left');
		leftEl.classList.toggle('round__left--low', left <= 2);
	}

	async function key(k: string) {
		if (over || busy || sheet || !rows) return;
		if (left <= 0) return;
		if (k === 'BACK') return rows.erase();
		if (k !== 'ENTER') return rows.type(k);
		const s = slots[active];
		const guess = rows.guess;
		if (guess.length < s.word.length) {
			rows.shake();
			sfx.invalid();
			return toast('Not enough letters');
		}
		if (DIFFICULTY[ctx.difficulty].checkWords && !isWord(guess)) {
			rows.shake();
			sfx.invalid();
			return toast('Not in the word list');
		}
		busy = true;
		const m = scoreGuess(guess, s.word);
		s.guesses.push(guess);
		s.marks.push(m);
		left--;
		syncLeft();
		await rows.reveal(m);
		mergeKeyMarks(keyMarks, guess, m);
		kb.setMarks(keyMarks);
		if (guess === s.word) {
			s.found = true;
			wordsFound++;
			await rows.bounce();
			paintSlot(s);
			pulse(s.el, 'slot-word--pop');
			sfx.unlock();
			shell.kip.react('happy');
			shell.addScore(T.points.perWord);
			busy = false;
			const next = slots.findIndex((x) => !x.found);
			if (next < 0) {
				toast('All 4 found. Name the link!');
				openNames(true);
			} else if (left > 0) {
				choose(next, true);
			}
		} else {
			paintSlot(s);
			rows.setGhost(ghostFor(s));
			shell.kip.react('think', 600);
			busy = false;
			if (left > 0) rows.addRow();
		}
		if (left <= 0 && !sheet && !over) {
			toast('Out of guesses. Name the link!');
			openNames(true);
		}
	}

	function openNames(forced: boolean) {
		if (over || busy || sheet) return;
		sfx.ui();
		const buttons = round.options.map((opt) => {
			const b = h('button', { class: 'option', type: 'button', disabled: struck.has(opt), on: { click: () => void pickName(opt, b, forced) } }, opt);
			if (struck.has(opt)) b.classList.add('option--struck');
			return b;
		});
		sheet = openModal({
			title: 'What links them?',
			body: [h('p', { class: 'muted' }, 'A wrong pick costs a heart.'), h('div', { class: 'options' }, ...buttons)],
			closable: !forced,
			parent: shell.el,
			cls: 'modal__card--names',
			onClose: () => {
				sheet = null;
			},
		});
	}

	async function pickName(opt: string, btn: HTMLButtonElement, forced: boolean) {
		if (busy || over) return;
		if (opt === round.group.theme) {
			busy = true;
			btn.classList.add('option--right');
			pulse(btn, 'option--yes');
			await wait(calm() ? 100 : 420);
			const s = sheet;
			sheet = null;
			s?.close();
			busy = false;
			await clearRound();
			return;
		}
		struck.add(opt);
		btn.disabled = true;
		btn.classList.add('option--struck');
		pulse(btn, 'option--no');
		combo = 0;
		sfx.wrong();
		shell.hearts.lose();
		shell.kip.react('sad');
		if (shell.hearts.left <= 0) {
			const s = sheet;
			sheet = null;
			await wait(500);
			s?.close();
			return void lose();
		}
		if (!forced && left > 0) {
			await wait(450);
			const s = sheet;
			sheet = null;
			s?.close();
		}
	}

	function revealSlots() {
		slots.forEach((s, k) => {
			if (!s.found) s.el.classList.add('slot-word--given');
			s.el.replaceChildren(...[...s.word].map((ch) => h('span', { class: 'slot-word__ch slot-word__ch--on' }, ch)));
			s.el.style.setProperty('--d', `${k * 60}ms`);
			pulse(s.el, 'slot-word--pop');
		});
	}

	async function clearRound() {
		busy = true;
		combo++;
		const hidden = slots.filter((s) => !s.found).length;
		const points = Math.round((T.points.round + left * T.points.perGuessLeft + hidden * T.points.perHiddenWord) * (1 + (combo - 1) * TUNING.comboBonus));
		revealSlots();
		themeBanner.hidden = false;
		themeBanner.textContent = round.group.theme;
		pulse(themeBanner, 'round__banner--stamp');
		pips[roundIndex].classList.add('pip--done');
		noteSticker(round.group.id, shell.kip);
		sfx.solve(combo);
		shell.kip.react('happy');
		shell.addScore(points);
		summary.push(`${LEVEL_EMOJI[round.group.level]} ${T.guesses - left}/${T.guesses}${hidden ? ` · ${hidden} unseen` : ''}`);
		const r = card.getBoundingClientRect();
		confetti(r.left + r.width / 2, r.top + r.height / 2, 22);
		await wait(calm() ? 500 : 1500);
		busy = false;
		if (roundIndex + 1 < puzzle.rounds.length) startRound(roundIndex + 1);
		else void win();
	}

	async function win() {
		over = true;
		shell.addScore(shell.hearts.left * T.points.perHeart);
		shell.kip.react('wow', 0);
		await wait(500);
		ctx.finish({
			won: true,
			score: shell.score,
			stars: starsFor(shell.hearts.left, shell.hearts.max),
			lines: [`Named all 4 links`, `Found ${wordsFound} of 16 words`],
			grid: summary.join('\n'),
		});
	}

	async function lose() {
		over = true;
		revealSlots();
		themeBanner.hidden = false;
		themeBanner.textContent = round.group.theme;
		themeBanner.classList.add('round__banner--lost');
		pulse(themeBanner, 'round__banner--stamp');
		summary.push(`${LEVEL_EMOJI[round.group.level]} ✖`);
		shell.kip.react('oops', 0);
		await wait(1600);
		ctx.finish({
			won: false,
			score: shell.score,
			stars: 0,
			lines: [`Named ${roundIndex} of 4 links`, `The link was: ${round.group.theme}`],
			grid: summary.join('\n'),
		});
	}

	startRound(0);

	return {
		el: shell.el,
		hints: () => shell.hintsUsed,
		destroy: () => {
			over = true;
			kb.detach();
			shell.destroy();
		},
	};
}
