import { LAYERS } from '../data/layers.ts';
import type { Run } from './run.ts';

/** Kept for this browser tab only. No save file in v1. */
export interface Session {
	unlocked: number;
	banked: number;
	runs: number;
	clears: number;
}

const KEY = 'nulldrift.session';

export function loadSession(): Session {
	const fresh: Session = { unlocked: 1, banked: 0, runs: 0, clears: 0 };
	try {
		const raw = sessionStorage.getItem(KEY);
		return raw ? { ...fresh, ...JSON.parse(raw) } : fresh;
	} catch {
		return fresh;
	}
}

export function saveSession(s: Session): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(s));
	} catch {
		// Private mode or blocked storage. Memory still works.
	}
}

/** Returns true when this run opened a new layer. */
export function recordEnding(s: Session, run: Run): boolean {
	if (!run.ending) return false;
	s.runs++;
	s.banked += run.ending.banked;
	let opened = false;
	if (run.ending.kind === 'cleared') {
		s.clears++;
		const next = Math.min(LAYERS.length, run.layer.index + 2);
		if (next > s.unlocked) {
			s.unlocked = next;
			opened = true;
		}
	}
	saveSession(s);
	return opened;
}
