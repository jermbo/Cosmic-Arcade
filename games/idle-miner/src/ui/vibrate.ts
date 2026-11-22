// A short buzz on a phone, if the player wants it.

import { session } from '../session.ts';

export function buzz(ms: number) {
	if (session.g.settings.vibrate) navigator.vibrate?.(ms);
}
