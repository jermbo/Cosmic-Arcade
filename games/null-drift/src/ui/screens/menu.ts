import { LAYERS } from '../../data/layers.ts';
import type { App } from '../app.ts';
import { openDeck, openHelp } from '../dialogs.ts';

export function mountMenu(app: App): void {
	const s = app.session;
	app.stage.innerHTML = `
		<section class="menu">
			<div class="menu__brand">
				<p class="eyebrow">TERMINAL EPOCH // CORP STACK BREACH</p>
				<h1 class="title glitch" data-text="NULLDRIFT">NULLDRIFT</h1>
				<p class="menu__tag">Breach terminals. Bank cycles. Die better.</p>
			</div>
			<nav class="menu__nav" aria-label="Main menu">
				<button class="btn btn--primary btn--wide" type="button" data-go="descend">BEGIN DESCENT</button>
				<button class="btn btn--wide" type="button" data-go="help">MANUAL</button>
				<button class="btn btn--wide" type="button" data-go="deck">STARTER DECK</button>
				<button class="btn btn--wide" type="button" data-go="settings">SETTINGS</button>
				<a class="btn btn--ghost btn--wide" href="../">EXIT TO ARCADE</a>
			</nav>
			<aside class="panel menu__status">
				<h2 class="panel__title">OPERATOR // KESTREL UNIT 09</h2>
				<dl class="stats">
					<div><dt>LAYERS OPEN</dt><dd>${s.unlocked}/${LAYERS.length}</dd></div>
					<div><dt>LAYERS CLEARED</dt><dd>${s.clears}</dd></div>
					<div><dt>RUNS</dt><dd>${s.runs}</dd></div>
					<div><dt>CYCLES BANKED</dt><dd class="gold">${s.banked}</dd></div>
				</dl>
				<p class="dim small">Session memory only. Close the tab and the stack forgets you.</p>
			</aside>
		</section>`;

	app.stage.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) =>
		b.addEventListener('click', () => {
			const go = b.dataset.go;
			if (go === 'descend') app.go('layers');
			if (go === 'help') openHelp();
			if (go === 'deck') openDeck(null);
			if (go === 'settings') app.openSettings();
		}),
	);
	app.stage.querySelector<HTMLButtonElement>('[data-go="descend"]')?.focus();
}
