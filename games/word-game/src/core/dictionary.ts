// Loads the word list in its own chunk, after the title screen is up.
import { BANK_WORDS } from './bank.ts';
import { setDictionary } from './words.ts';

let loading: Promise<void> | null = null;

export function loadDictionary(): Promise<void> {
	loading ??= Promise.all([import('../data/dict.txt?raw'), import('../data/extra-words.txt?raw')])
		.then(([main, extra]) => {
			const lines = (main.default + '\n' + extra.default).split('\n').map((w) => w.trim().toUpperCase()).filter(Boolean);
			setDictionary([...lines, ...BANK_WORDS]);
		})
		.catch(() => {
			// Without the list, every guess counts as a word. The game still works.
		});
	return loading;
}
