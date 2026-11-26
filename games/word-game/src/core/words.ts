// Guess checks: is it a word, and how does it match the answer.
import type { Mark } from './types.ts';

let dict: Set<string> | null = null;

/** Sets the valid word list. Until it is set, every guess counts as a word. */
export function setDictionary(words: Iterable<string>): void {
	dict = new Set(words);
}

export function hasDictionary(): boolean {
	return dict !== null;
}

/** True for a known word, or a plain plural or verb form of one. */
export function isWord(word: string): boolean {
	if (!dict) return true;
	const w = word.toUpperCase();
	if (dict.has(w)) return true;
	const tries: string[] = [];
	if (w.endsWith('S')) tries.push(w.slice(0, -1));
	if (w.endsWith('ES')) tries.push(w.slice(0, -2));
	if (w.endsWith('IES')) tries.push(w.slice(0, -3) + 'Y');
	if (w.endsWith('ED')) tries.push(w.slice(0, -2), w.slice(0, -1));
	if (w.endsWith('IED')) tries.push(w.slice(0, -3) + 'Y');
	if (w.endsWith('ING')) tries.push(w.slice(0, -3), w.slice(0, -3) + 'E');
	if (w.endsWith('ER')) tries.push(w.slice(0, -2), w.slice(0, -1));
	if (w.endsWith('EST')) tries.push(w.slice(0, -3), w.slice(0, -2));
	if (w.endsWith('LY')) tries.push(w.slice(0, -2));
	// Doubled end letter: STOPPED, RUNNING.
	for (const t of tries.slice()) if (t.length > 2 && t.at(-1) === t.at(-2)) tries.push(t.slice(0, -1));
	return tries.some((t) => t.length >= 2 && dict!.has(t));
}

/** Marks each letter: right spot, in the word, or not in it. Repeats count fairly. */
export function scoreGuess(guess: string, answer: string): Mark[] {
	const marks: Mark[] = Array(guess.length).fill('miss');
	const left = new Map<string, number>();
	for (let i = 0; i < answer.length; i++) {
		if (guess[i] === answer[i]) marks[i] = 'hit';
		else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1);
	}
	for (let i = 0; i < guess.length; i++) {
		if (marks[i] === 'hit') continue;
		const n = left.get(guess[i]) ?? 0;
		if (n > 0) {
			marks[i] = 'near';
			left.set(guess[i], n - 1);
		}
	}
	return marks;
}

const RANK: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };

/** Merges new marks into a letter → best mark map for the keyboard. */
export function mergeKeyMarks(into: Map<string, Mark>, guess: string, marks: Mark[]): void {
	for (let i = 0; i < guess.length; i++) {
		const old = into.get(guess[i]);
		if (!old || RANK[marks[i]] > RANK[old]) into.set(guess[i], marks[i]);
	}
}
