import { RANK_SHORT, type Suit } from '../core/cards.ts';
import { variantKey, type DealOptions, type ModeId } from '../core/types.ts';
import { MODE_NAMES, variantName } from '../rules/index.ts';
import { formatTime, getRecord } from '../store/bests.ts';
import { loadGame } from '../store/savegame.ts';
import { settings, updateSettings } from '../store/settings.ts';
import { getTheme } from '../themes/themes.ts';
import { spriteStyle } from './card-face.ts';
import { picked } from './dialogs.ts';
import { icon, pixelSuit, suitIcon } from './icons.ts';
import { canInstall, isStandalone } from './pwa.ts';
import { defaultDealOptions, titleModeOptions } from './variant-options.ts';

const MODES: ModeId[] = ['klondike', 'spider', 'freecell'];

const BLURB: Record<ModeId, string> = {
	klondike: 'The classic. Build down in red and black, free the Aces.',
	spider: 'Two decks, ten columns. Build full suits from King to Ace.',
	freecell: 'Every card face up. Four cells, pure planning.',
};

const MODE_ART: Record<ModeId, [number, Suit][]> = {
	klondike: [[13, 'H'], [12, 'D'], [11, 'C']],
	spider: [[13, 'S'], [1, 'S'], [13, 'H']],
	freecell: [[1, 'D'], [1, 'C'], [1, 'H']],
};

function miniCard(rank: number, suit: Suit, index: number): string {
	const deck = getTheme(settings.theme).deck;
	const card = { id: 0, rank, suit };
	if (deck.kind === 'sprite') return `<span class="mini mini--sprite" style="--i:${index};${spriteStyle(deck, deck.at(card))}"></span>`;
	return `<span class="mini mini--vector suit-${suit}" style="--i:${index}"><b>${RANK_SHORT[rank]}</b>${suitIcon(suit, 'mini__pip')}</span>`;
}

function bestLine(mode: ModeId, opts: DealOptions): string {
	const record = getRecord(variantKey(mode, opts));
	if (!record.won) return record.played ? `${record.played} played · no wins yet` : 'No games yet';
	const best =
		record.bestTime !== null ? ` · best ${formatTime(record.bestTime)} · ${record.bestMoves} moves` : '';
	return `${record.won} of ${record.played} won${best}`;
}

function modeCardHtml(mode: ModeId, opts: DealOptions): string {
	const option =
		mode === 'freecell'
			? `<p class="mode__fixed">Numbered deals, 1 to 32000</p>`
			: titleModeOptions(mode, opts);
	const art = MODE_ART[mode].map(([rank, suit], index) => miniCard(rank, suit, index)).join('');
	return `
		<article class="mode" data-mode="${mode}">
			<div class="mode__art" aria-hidden="true">${art}</div>
			<h2 class="mode__name">${MODE_NAMES[mode]}</h2>
			<p class="mode__blurb">${BLURB[mode]}</p>
			<div class="mode__option">${option}</div>
			<p class="mode__best">${bestLine(mode, opts)}</p>
			<button class="btn btn--primary mode__play" data-play>Play ${MODE_NAMES[mode]}</button>
		</article>`;
}

export interface TitleScreenActions {
	play(mode: ModeId, opts: DealOptions): void;
	continueGame(): void;
	howToPlay(): void;
	openSettings(): void;
	installApp(): void;
}

/** Main menu: pick a mode and start or continue a saved game. */
export class TitleScreen {
	readonly el: HTMLElement;
	private actions: TitleScreenActions;

	constructor(actions: TitleScreenActions) {
		this.actions = actions;
		this.el = document.createElement('section');
		this.el.className = 'title';
	}

	render() {
		const saved = loadGame();
		const opts = defaultDealOptions();
		this.el.innerHTML = `
			<header class="title__bar">
				${isStandalone() ? '' : `<a class="btn btn--ghost btn--small" href="../">${icon('back')}<span>Arcade</span></a>`}
				<div class="title__tools">
					${canInstall() ? `<button class="btn btn--ghost btn--small" data-act="install" aria-label="Install app">${icon('install')}<span>Install</span></button>` : ''}
					<button class="btn btn--ghost btn--small" data-act="how">${icon('help')}<span>How to play</span></button>
					<button class="btn btn--ghost btn--small" data-act="settings">${icon('gear')}<span>Settings</span></button>
				</div>
			</header>
			<div class="title__brand">
				<h1 class="logo"><span class="logo__word">Solitary</span>${pixelSuit('S', 'logo__pip')}</h1>
				<p class="title__tag">Three classic patience games. Standard rules, no tricks.</p>
			</div>
			${saved ? `<button class="btn btn--primary continue" data-act="continue">${icon('redo')}<span>Continue ${variantName(saved.mode, saved.opts)} <small>${formatTime(saved.elapsed)} · ${saved.moves} moves</small></span></button>` : ''}
			<div class="modes">
				${MODES.map((mode) => modeCardHtml(mode, opts)).join('')}
			</div>`;
		this.el.querySelectorAll<HTMLElement>('.mode').forEach((card) => {
			const mode = card.dataset.mode as ModeId;
			card.addEventListener('change', () => {
				const draw = picked(card, `draw-${mode}`);
				const suits = picked(card, `suits-${mode}`);
				if (draw) updateSettings({ klondikeDraw: Number(draw) as 1 | 3 });
				if (suits) updateSettings({ spiderSuits: Number(suits) as 1 | 2 | 4 });
				card.querySelector('.mode__best')!.textContent = bestLine(mode, defaultDealOptions());
			});
			card.querySelector('[data-play]')!.addEventListener('click', () => {
				this.actions.play(mode, defaultDealOptions());
			});
		});
		this.el.querySelector('[data-act="install"]')?.addEventListener('click', () => this.actions.installApp());
		this.el.querySelector('[data-act="how"]')!.addEventListener('click', () => this.actions.howToPlay());
		this.el.querySelector('[data-act="settings"]')!.addEventListener('click', () => this.actions.openSettings());
		this.el.querySelector('[data-act="continue"]')?.addEventListener('click', () => this.actions.continueGame());
	}

	focusPlay() {
		this.el.querySelector<HTMLElement>('.continue, [data-play]')?.focus();
	}
}