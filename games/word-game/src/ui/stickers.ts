// Adds a solved group to the Kin Book and tells the player when it is new.
import { sfx } from '../audio.ts';
import { collect } from '../book.ts';
import { save } from '../save.ts';
import { confetti, toast } from './fx.ts';
import type { Kip } from './kip.ts';

export function noteSticker(groupId: string, kip: Kip): void {
	const c = collect(groupId);
	if (!c?.isNew) return;
	setTimeout(() => {
		if (c.finished) {
			toast(`Set done! Kip won the ${c.finished.hatName.toLowerCase()}`, 2600);
			confetti();
			sfx.win();
			if (save.hat === c.finished.id) kip.setHat(c.finished.hat);
			kip.react('wow', 1200);
		} else {
			toast(`📖 New sticker: ${c.theme}`, 1500);
			sfx.letter();
		}
	}, 750);
}
