// The daily chain card on the title screen, and the card to guess it.
import { sfx } from '../audio.ts';
import { buildChain, CHAIN_MODES, type Chain } from '../core/chain.ts';
import { EARN } from '../core/economy.ts';
import { DIFFICULTY, TUNING } from '../core/tuning.ts';
import { earn } from '../shop/wallet.ts';
import type { Difficulty, Mark } from '../core/types.ts';
import { isWord, mergeKeyMarks, scoreGuess } from '../core/words.ts';
import { MODE_BY_ID } from '../modes/meta.ts';
import { chainState, dailyResult, recordChain, save } from '../save.ts';
import { h, wait } from './dom.ts';
import { confetti, pulse, toast } from './fx.ts';
import { Keyboard } from './keyboard.ts';
import { openModal } from './modal.ts';
import { WordRows } from './wordrows.ts';

interface View {
	chain: Chain;
	/** Known letters: shown by won dailies, plus right-spot letters from guesses. */
	known: (string | null)[];
	/** Which mode gives each spot. */
	from: (string | null)[];
	played: number;
}

function view(diff: Difficulty, date: string): View {
	const chain = buildChain(diff, date);
	const known: (string | null)[] = [...chain.word].map(() => null);
	const from: (string | null)[] = [...chain.word].map(() => null);
	let played = 0;
	for (const m of CHAIN_MODES) {
		const r = dailyResult(m, diff, date);
		if (r) played++;
		for (const i of chain.spots[m]) {
			from[i] = m;
			if (r?.won) known[i] = chain.word[i];
		}
	}
	for (const g of chainState(diff, date).guesses) {
		scoreGuess(g, chain.word).forEach((m, i) => m === 'hit' && (known[i] = chain.word[i]));
	}
	return { chain, known, from, played };
}

/** The card under the modes. `refresh` redraws it after the chain changes. */
export function chainCard(diff: Difficulty, date: string, refresh: () => void): HTMLElement {
	const v = view(diff, date);
	const st = chainState(diff, date);
	const slots = v.known.map((k, i) =>
		h('span', { class: `chain__slot chain__slot--${v.from[i]}${k ? ' chain__slot--on' : ''}${st.done && !st.won ? ' chain__slot--lost' : ''}` }, st.done ? v.chain.word[i] : (k ?? '')),
	);
	let note: string;
	let action: HTMLElement | null = null;
	if (st.done) {
		note = st.won ? `Solved in ${st.guesses.length}! New chain tomorrow.` : 'New chain tomorrow.';
	} else if (v.played < 3) {
		note = `Win dailies to fill it · ${v.played}/3`;
	} else {
		note = 'All 3 dailies played!';
		action = h('button', { class: 'btn btn--go btn--wide btn--ready', type: 'button', on: { click: () => openChain(diff, date, refresh) } }, 'Solve the chain');
	}
	const streak = save.chainStreak.streak;
	return h(
		'section',
		{ class: `chain${st.won ? ' chain--won' : ''}` },
		h(
			'div',
			{ class: 'chain__head' },
			h('h2', { class: 'chain__title' }, '🔗 Daily chain'),
			h('span', { class: 'chain__note' }, note),
			streak > 0 && h('span', { class: 'chip chip--streak' }, `🔥 ${streak}`),
		),
		h('div', { class: 'chain__slots' }, ...slots),
		!action && h('div', { class: 'chain__key' }, ...CHAIN_MODES.map((m) => h('span', { class: `chain__keyitem chain__keyitem--${m}` }, MODE_BY_ID[m].name))),
		action,
	);
}

function openChain(diff: Difficulty, date: string, refresh: () => void): void {
	const { tries } = TUNING.chain;
	const v = view(diff, date);
	const word = v.chain.word;
	const st = chainState(diff, date);
	const guesses = st.guesses.slice();
	const rows = new WordRows({ length: word.length, rows: tries, ghost: v.known });
	const keyMarks = new Map<string, Mark>();
	for (const g of guesses) {
		const m = scoreGuess(g, word);
		rows.fill(g, m);
		mergeKeyMarks(keyMarks, g, m);
	}
	let finished = false;
	const sub = h('p', { class: 'muted' }, `It is one of: `, h('strong', {}, v.chain.clue), ` · ${tries - guesses.length} tries`);
	const kb = new Keyboard(async (k) => {
		if (finished || rows.busy) return;
		if (k === 'BACK') return rows.erase();
		if (k !== 'ENTER') return rows.type(k);
		if (rows.guess.length < word.length) {
			rows.shake();
			sfx.invalid();
			return toast('Not enough letters');
		}
		if (DIFFICULTY[diff].checkWords && !isWord(rows.guess)) {
			rows.shake();
			sfx.invalid();
			return toast('Not in the word list');
		}
		const g = rows.guess;
		const m = scoreGuess(g, word);
		guesses.push(g);
		await rows.reveal(m);
		mergeKeyMarks(keyMarks, g, m);
		kb.setMarks(keyMarks);
		m.forEach((mark, i) => mark === 'hit' && (v.known[i] = word[i]));
		rows.setGhost(v.known);
		const won = g === word;
		const done = won || guesses.length >= tries;
		recordChain(diff, date, guesses, won, done);
		sub.lastChild!.textContent = ` · ${tries - guesses.length} tries`;
		if (won) {
			finished = true;
			await rows.bounce();
			sfx.win();
			confetti();
			const got = earn(EARN.chain);
			toast(`Chain solved! +${got} coins · 🔥 ${save.chainStreak.streak}`, 2400);
			await wait(1200);
			modal.close();
		} else if (done) {
			finished = true;
			rows.showAnswer(word);
			sfx.lose();
			toast(`It was ${word}`, 2000);
			await wait(1800);
			modal.close();
		}
	});
	kb.setMarks(keyMarks);
	const modal = openModal({
		title: 'Daily chain',
		cls: 'modal__card--chain',
		body: [sub, rows.el, kb.el],
		onClose: () => {
			kb.detach();
			refresh();
		},
	});
	modal.el.classList.add('modal--keys');
	kb.attach();
	pulse(rows.el, 'rows__row--in');
}
