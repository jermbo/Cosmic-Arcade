import { CARDS, STARTER_DECK } from '../data/cards.ts';
import type { Run } from '../rules/run.ts';
import { cardHtml } from './card-view.ts';
import { motion } from './fx.ts';

function makeDialog(cls: string): HTMLDialogElement {
	const d = document.createElement('dialog');
	d.className = `panel dialog ${cls}`;
	document.body.append(d);
	d.addEventListener('click', (e) => {
		const t = e.target as HTMLElement;
		if (t === d || t.closest('[data-close]')) d.close();
	});
	return d;
}

const deckDialog = makeDialog('dialog--deck');

export function openDeck(run: Run | null): void {
	const deck = run?.deck ?? STARTER_DECK;
	const counts = new Map<string, number>();
	for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
	const ids = [...counts.keys()].sort((a, b) => CARDS[a].cost - CARDS[b].cost || CARDS[a].name.localeCompare(CARDS[b].name));
	const c = run?.combat;
	deckDialog.innerHTML = `
		<header class="dialog__head">
			<h2>DECK // ${deck.length} CARDS</h2>
			<button class="btn btn--icon" type="button" data-close aria-label="Close">X</button>
		</header>
		${c ? `<p class="dim">DRAW ${c.drawPile.length} · HAND ${c.hand.length} · DISCARD ${c.discard.length}</p>` : ''}
		<div class="deck-grid">
			${ids.map((id) => `<div class="deck-grid__item">${cardHtml(run, id)}<span class="deck-grid__count">x${counts.get(id)}</span></div>`).join('')}
		</div>`;
	deckDialog.showModal();
}

const settingsDialog = makeDialog('dialog--settings');

export interface DisplaySettings {
	scanlines: boolean;
}

export function openSettings(display: DisplaySettings, onChange: () => void): void {
	settingsDialog.innerHTML = `
		<header class="dialog__head">
			<h2>SYS // DISPLAY</h2>
			<button class="btn btn--icon" type="button" data-close aria-label="Close">X</button>
		</header>
		<label class="toggle"><input type="checkbox" data-set="scanlines" ${display.scanlines ? 'checked' : ''}> SCANLINES</label>
		<label class="toggle"><input type="checkbox" data-set="calm" ${motion.calm ? 'checked' : ''}> CALM MOTION</label>
		<p class="dim">WARN v1: settings reset when the tab closes.</p>
		<div class="dialog__actions">
			<a class="btn btn--ghost" href="../">EXIT TO ARCADE</a>
			<button class="btn" type="button" data-close>DONE</button>
		</div>`;
	settingsDialog.querySelectorAll<HTMLInputElement>('[data-set]').forEach((input) => {
		input.addEventListener('change', () => {
			if (input.dataset.set === 'scanlines') display.scanlines = input.checked;
			if (input.dataset.set === 'calm') motion.calm = input.checked;
			onChange();
		});
	});
	settingsDialog.showModal();
}

const helpDialog = makeDialog('dialog--help');

export function openHelp(): void {
	helpDialog.innerHTML = `
		<header class="dialog__head">
			<h2>MANUAL // OPERATOR</h2>
			<button class="btn btn--icon" type="button" data-close aria-label="Close">X</button>
		</header>
		<ul class="manual">
			<li><b>TRACE</b> is your only life. It hits <b>100</b>, you are booted. It never resets on its own.</li>
			<li>Loud cards add <b class="coral">NOISE</b> to trace. Vent cards cut it.</li>
			<li>Daemons that <b>ATTACK</b> add their damage to trace at end of turn. <b class="green">MASK</b> blocks it. Unused mask is lost.</li>
			<li>Single hits strike the <b>first</b> daemon in line. It is marked <span class="gold">TARGET</span>.</li>
			<li>A run is 4 floors. Floors 1-3 end in a <b>GATE</b>: breach it to shed 35% trace. Floor 4 ends in the <b>BOSS</b>.</li>
			<li>Cycles buy gear at the <b class="green">MARKET</b>. Jack out from the map to keep 40%. Clear the layer to keep all.</li>
		</ul>
		<p class="dim">KEYS: 1-7 play card · E end turn · D deck · Esc close</p>
		<div class="dialog__actions"><button class="btn" type="button" data-close>GOT IT</button></div>`;
	helpDialog.showModal();
}

const confirmDialog = makeDialog('dialog--confirm');

export function confirmBox(title: string, body: string, yes: string, no = 'CANCEL'): Promise<boolean> {
	return new Promise((resolve) => {
		confirmDialog.innerHTML = `
			<header class="dialog__head"><h2>${title}</h2></header>
			<p>${body}</p>
			<div class="dialog__actions">
				<button class="btn btn--ghost" type="button" data-answer="no">${no}</button>
				<button class="btn btn--warn" type="button" data-answer="yes">${yes}</button>
			</div>`;
		let answer = false;
		confirmDialog.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach((b) =>
			b.addEventListener('click', () => {
				answer = b.dataset.answer === 'yes';
				confirmDialog.close();
			}),
		);
		confirmDialog.addEventListener('close', () => resolve(answer), { once: true });
		confirmDialog.showModal();
	});
}

export const anyDialogOpen = () => document.querySelector('dialog[open]') !== null;
