// Names, blurbs and how-to-play steps for each mode.
import type { ModeId } from '../core/types.ts';
import { TUNING } from '../core/tuning.ts';

export interface ModeMeta {
	id: ModeId;
	name: string;
	blurb: string;
	/** Short steps for the help card. Use **word** for bold. */
	steps: string[];
}

export const MODES: ModeMeta[] = [
	{
		id: 'crack',
		name: 'Crack',
		blurb: 'Crack 4 locked words, then sort all 16 into groups.',
		steps: [
			'The board has **16 words** in **4 hidden groups**. One word in each group is **locked**.',
			`Tap a lock to crack it. You get **${TUNING.crack.guesses} guesses**. Colors show which letters are right.`,
			'Use the other words as clues. A locked word belongs with 3 of them.',
			`Pick 4 words that share a link and tap **Submit**. Wrong picks or failed cracks cost a heart. You have **${TUNING.hearts.crack}**.`,
		],
	},
	{
		id: 'secret',
		name: 'Secret',
		blurb: 'Sort the groups. Each one shows a letter of a secret word.',
		steps: [
			'Sort **16 words** into **4 groups** of 4. Pick 4, then tap **Submit**.',
			'Each group you solve shows **one letter** of the secret word.',
			`Tap **Guess** at any time. You get **${TUNING.secret.tries} tries**. Guess early for a big bonus.`,
			`Stuck? The **Clue** names the secret's group, but costs a heart. You have **${TUNING.hearts.secret}**.`,
		],
	},
	{
		id: 'link',
		name: 'Link',
		blurb: 'Guess words to find the hidden link, then name it.',
		steps: [
			'Each round hides **4 words** that share a link. You see the first letter of each.',
			`Tap a word and guess it. Colors show which letters are right. You have **${TUNING.link.guesses} guesses** per round.`,
			'Tap **Name the link** when you know it. Fewer guesses means more points.',
			`A wrong name costs a heart. You have **${TUNING.hearts.link}** for all 4 rounds.`,
		],
	},
];

export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<ModeId, ModeMeta>;
