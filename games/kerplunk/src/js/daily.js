// The daily challenge: today's key, and a fresh record when a new day starts.

import { store } from './storage.js';
import { dayKey, dailyFor } from './wallet.js';
import { save } from './session.js';

export const todayKey = () => dayKey(new Date());

/** The daily challenge starts fresh each day. */
export function syncDaily() {
	const daily = dailyFor(store.daily, todayKey());
	if (daily === store.daily) return;
	store.daily = daily;
	save();
}
