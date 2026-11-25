import { load, save } from './storage.ts';

export interface Stats {
	played: number;
	won: number;
	bestTime: number | null; // ms, hint-free wins only
	bestMoves: number | null; // hint-free wins only
}

const KEY = 'solitary.bests.v1';
const all: { [variant: string]: Stats } = load(KEY, {});

export function getRecord(variant: string): Stats {
	return all[variant] ?? { played: 0, won: 0, bestTime: null, bestMoves: null };
}

export function countPlayed(variant: string) {
	const r = getRecord(variant);
	all[variant] = { ...r, played: r.played + 1 };
	save(KEY, all);
}

export interface WinResult {
	stats: Stats;
	newTime: boolean;
	newMoves: boolean;
}

export function recordWin(variant: string, time: number, moves: number, hintFree: boolean): WinResult {
	const r = { ...getRecord(variant) };
	r.won++;
	let newTime = false;
	let newMoves = false;
	if (hintFree) {
		if (r.bestTime === null || time < r.bestTime) {
			newTime = true;
			r.bestTime = time;
		}
		if (r.bestMoves === null || moves < r.bestMoves) {
			newMoves = true;
			r.bestMoves = moves;
		}
	}
	all[variant] = r;
	save(KEY, all);
	return { stats: r, newTime, newMoves };
}

export function formatTime(ms: number): string {
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = String(s % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
