// The panel that asks before a new game erases the save.

import { closePanel, openPanel } from '../modal.ts';

export function openConfirmNew(onYes: () => void) {
	openPanel({
		id: 'new',
		title: 'New game?',
		render: () => `<p>Starting over erases your save on this device, with stardust and perks. It cannot be undone.</p><div class="card__row"><button class="btn btn--ghost" data-act="no">Cancel</button><button class="btn btn--danger" data-act="yes">Start over</button></div>`,
		act: (name) => {
			closePanel();
			if (name === 'yes') onYes();
		},
	});
}
