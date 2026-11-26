// Names, blurbs and how-to-play steps for each mode.
import type { DiffTuning } from '../core/tuning.ts';
import type { ModeId } from '../core/types.ts';

export interface ModeMeta {
	id: ModeId;
	name: string;
	blurb: string;
	/** Short steps for the help card, for the chosen difficulty. Use **word** for bold. */
	steps: (d: DiffTuning) => string[];
}

const letters = (n: number) => `${n} ${n === 1 ? 'letter' : 'letters'}`;

export const MODES: ModeMeta[] = [
	{
		id: 'crack',
		name: 'Crack',
		blurb: 'Crack the locks, then sort 16 words.',
		steps: (d) => [
			'The board has **16 words** in **4 hidden groups**. One word in each group is **locked**.',
			`Tap a lock to crack it. You get **${d.crack.guesses} guesses**. Colors show which letters are right.` +
				(d.crack.showFirst ? ` The lock already shows **${letters(1 + d.crack.showExtra)}**.` : ''),
			'Use the other words as clues. A locked word belongs with 3 of them.',
			`Pick 4 words that share a link and tap **Submit**. Wrong picks or failed cracks cost a heart. You have **${d.crack.hearts}**.`,
		],
	},
	{
		id: 'secret',
		name: 'Secret',
		blurb: 'Sort groups to find a secret word.',
		steps: (d) => [
			'Sort **16 words** into **4 groups** of 4. Pick 4, then tap **Submit**.',
			'Each group you solve shows **one letter** of the secret word.',
			`Tap **Guess** at any time. You get **${d.secret.tries} tries**. Guess early for a big bonus.`,
			(d.secret.clue === 'free'
				? 'The **clue** under the secret word tells you what kind of word it is.'
				: d.secret.clue === 'paid'
					? "Stuck? The **Clue** names the secret's group, but costs a heart."
					: 'No clue on this difficulty. Letters only!') + ` You have **${d.secret.hearts}** hearts.`,
		],
	},
	{
		id: 'link',
		name: 'Link',
		blurb: 'Guess words, then name their link.',
		steps: (d) => [
			`Each round hides **4 words** that share a link. You see the **first${d.link.showLast ? ' and last' : ''} letter** of each.`,
			`Tap a word and guess it. Colors show which letters are right. You have **${d.link.guesses} guesses** per round.`,
			`Tap **Name the link** and pick from **${d.link.options} choices**. Fewer guesses means more points.`,
			`A wrong name costs a heart. You have **${d.link.hearts}** for all 4 rounds.`,
		],
	},
];

export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<ModeId, ModeMeta>;
