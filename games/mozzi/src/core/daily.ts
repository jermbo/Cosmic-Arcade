/** Daily windows: the same date gives the same puzzle on every device. */
import { makePuzzle } from './generate.ts';
import type { Level, Puzzle } from './types.ts';

/** Which level each weekday gets. Monday is gentle, the weekend is tough. Tune here. */
export const WEEKDAY_LEVEL: Record<number, Level> = {
	1: 'easy',
	2: 'medium',
	3: 'medium',
	4: 'hard',
	5: 'hard',
	6: 'expert',
	0: 'expert',
};

/** "2026-11-26" in the player's local time. */
export function dateKey(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function parseKey(key: string): Date {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d, 12);
}

export function addDays(key: string, days: number): string {
	const d = parseKey(key);
	d.setDate(d.getDate() + days);
	return dateKey(d);
}

/** Monday to Sunday of the week that holds this date. */
export function weekOf(key: string): string[] {
	const d = parseKey(key);
	const fromMonday = (d.getDay() + 6) % 7;
	const monday = addDays(key, -fromMonday);
	return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const levelOfDay = (key: string): Level => WEEKDAY_LEVEL[parseKey(key).getDay()];

export function dailyPuzzle(key: string): Puzzle {
	return makePuzzle(`daily-${key}`, `mozzi-daily-${key}`, levelOfDay(key));
}

export function practicePuzzle(level: Level, n: number): Puzzle {
	return makePuzzle(`practice-${level}-${n}`, `mozzi-practice-${level}-${n}`, level);
}
