import { sfx, unlockAudio } from '../audio/sfx.ts';
import { randomSeed } from '../core/rng.ts';
import { variantKey, type DealOptions, type ModeId } from '../core/types.ts';
import { Session } from '../game/session.ts';
import { randomDealNumber } from '../rules/freecell.ts';
import { MODE_NAMES, variantName } from '../rules/index.ts';
import { formatTime, getRecord, recordWin } from '../store/bests.ts';
import { clearGame, loadGame } from '../store/savegame.ts';
import { onSettings, settings, updateSettings } from '../store/settings.ts';
import { choice, dialogOpen, howToPlay, openDialog, openSettings, picked, type DialogHandle } from './dialogs.ts';
import { GameView } from './game-view.ts';
import { RANK_SHORT, type Suit } from '../core/cards.ts';
import { getTheme } from '../themes/themes.ts';
import { spriteStyle } from './board.ts';
import { icon, pixelSuit, suitIcon } from './icons.ts';
import { canInstall, isStandalone, promptInstall, setupPwa } from './pwa.ts';

const MODES: ModeId[] = ['klondike', 'spider', 'freecell'];

const BLURB: Record<ModeId, string> = {
	klondike: 'The classic. Build down in red and black, free the Aces.',
	spider: 'Two decks, ten columns. Build full suits from King to Ace.',
	freecell: 'Every card face up. Four cells, pure planning.',
};

/** Small fanned cards for the mode picker. */
const ART: Record<ModeId, [number, Suit][]> = {
	klondike: [[13, 'H'], [12, 'D'], [11, 'C']],
	spider: [[13, 'S'], [1, 'S'], [13, 'H']],
	freecell: [[1, 'D'], [1, 'C'], [1, 'H']],
};

function miniCard(rank: number, suit: Suit, i: number): string {
	const deck = getTheme(settings.theme).deck;
	const card = { id: 0, rank, suit };
	if (deck.kind === 'sprite') return `<span class="mini mini--sprite" style="--i:${i};${spriteStyle(deck, deck.at(card))}"></span>`;
	return `<span class="mini mini--vector suit-${suit}" style="--i:${i}"><b>${RANK_SHORT[rank]}</b>${suitIcon(suit, 'mini__pip')}</span>`;
}

function currentOpts(): DealOptions {
	return { draw: settings.klondikeDraw, suits: settings.spiderSuits };
}

function bestLine(mode: ModeId, opts: DealOptions): string {
	const r = getRecord(variantKey(mode, opts));
	if (!r.won) return r.played ? `${r.played} played · no wins yet` : 'No games yet';
	const best = r.bestTime !== null ? ` · best ${formatTime(r.bestTime)} · ${r.bestMoves} moves` : '';
	return `${r.won} of ${r.played} won${best}`;
}

export class App {
	private title: HTMLElement;
	private view: GameView;
	private session: Session | null = null;
	private screen: 'title' | 'game' = 'title';
	private historyPushed = false;
	private leaving = false;
	private themeId = settings.theme;

	constructor(root: HTMLElement) {
		this.title = document.createElement('section');
		this.title.className = 'title';
		this.view = new GameView({
			pause: () => this.pause(),
			newDeal: () => this.newDeal(),
			win: () => this.win(),
		});
		root.append(this.title, this.view.el);
		this.applyTheme();
		onSettings(() => this.settingsChanged());
		this.renderTitle();
		this.bindGlobal();
		setupPwa(() => {
			if (this.screen === 'title') this.renderTitle();
		});
	}

	// ---------- title ----------

	private renderTitle() {
		const saved = loadGame();
		this.title.innerHTML = `
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
				${MODES.map((m) => this.modeCard(m)).join('')}
			</div>`;
		this.title.querySelectorAll<HTMLElement>('.mode').forEach((card) => {
			const mode = card.dataset.mode as ModeId;
			card.addEventListener('change', () => {
				const draw = picked(card, `draw-${mode}`);
				const suits = picked(card, `suits-${mode}`);
				if (draw) updateSettings({ klondikeDraw: Number(draw) as 1 | 3 });
				if (suits) updateSettings({ spiderSuits: Number(suits) as 1 | 2 | 4 });
				card.querySelector('.mode__best')!.textContent = bestLine(mode, currentOpts());
			});
			card.querySelector('[data-play]')!.addEventListener('click', () => {
				unlockAudio();
				this.startNew(mode, currentOpts());
			});
		});
		this.title.querySelector('[data-act="install"]')?.addEventListener('click', () => promptInstall().then(() => this.renderTitle()));
		this.title.querySelector('[data-act="how"]')!.addEventListener('click', () => howToPlay('klondike'));
		this.title.querySelector('[data-act="settings"]')!.addEventListener('click', () => openSettings());
		this.title.querySelector('[data-act="continue"]')?.addEventListener('click', () => {
			unlockAudio();
			const game = loadGame();
			if (game) this.start(new Session(game.mode, game.opts, game.seed, game), 'instant');
		});
	}

	private modeCard(mode: ModeId): string {
		const opts = currentOpts();
		const option =
			mode === 'klondike'
				? choice(`draw-${mode}`, 'Draw', [[1, 'Draw 1'], [3, 'Draw 3']], opts.draw)
				: mode === 'spider'
					? choice(`suits-${mode}`, 'Suits', [[1, '1 suit'], [2, '2 suits'], [4, '4 suits']], opts.suits)
					: `<p class="mode__fixed">Numbered deals, 1 to 32000</p>`;
		const art = ART[mode].map(([r, s], i) => miniCard(r, s, i)).join('');
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

	// ---------- game flow ----------

	private startNew(mode: ModeId, opts: DealOptions) {
		const seed = mode === 'freecell' ? randomDealNumber() : randomSeed();
		this.start(new Session(mode, opts, seed), 'deal');
	}

	private start(session: Session, how: 'deal' | 'instant') {
		if (how === 'deal') clearGame();
		this.session = session;
		this.screen = 'game';
		this.title.hidden = true;
		this.view.el.hidden = false;
		this.view.start(session, how);
		// Dev only: lets a test script drive the game.
		if (import.meta.env.DEV) Object.assign(window, { __sol: { app: this, session, view: this.view } });
		if (!this.historyPushed) {
			history.pushState({ solitary: 'game' }, '');
			this.historyPushed = true;
		}
		this.view.focusBoard();
		if (!settings.seenHowTo[session.mode]) {
			updateSettings({ seenHowTo: { ...settings.seenHowTo, [session.mode]: true } });
			window.setTimeout(() => {
				if (this.session === session && !dialogOpen()) this.withPause(() => howToPlay(session.mode, () => this.resume()));
			}, how === 'deal' ? 900 : 100);
		}
	}

	private toTitle() {
		this.session?.persist();
		this.view.stop();
		this.session = null;
		this.screen = 'title';
		this.view.el.hidden = true;
		this.title.hidden = false;
		this.renderTitle();
		this.title.querySelector<HTMLElement>('.continue, [data-play]')?.focus();
		if (this.historyPushed) {
			this.leaving = true;
			this.historyPushed = false;
			history.back();
		}
	}

	/** Open a dialog with the clock stopped. */
	private withPause(open: () => DialogHandle) {
		this.session?.setPaused(true);
		return open();
	}

	private resume() {
		if (this.session && !dialogOpen()) {
			this.session.setPaused(false);
			this.view.focusBoard();
		}
	}

	pause() {
		const s = this.session;
		if (!s || dialogOpen()) return;
		this.view.cancel();
		s.setPaused(true);
		const d = openDialog({
			title: 'Paused',
			className: 'dialog--pause',
			onClose: () => this.resume(),
			body: `
				<p class="pause__line"><b>${variantName(s.mode, s.opts)}</b>${s.mode === 'freecell' ? ` · Deal #${s.seed}` : ''}<br>${formatTime(s.time())} · ${s.moves} moves${s.hintsUsed ? ' · hints used' : ''}</p>
				<div class="menu-list">
					<button class="btn btn--primary" data-a="resume" autofocus>Resume</button>
					<button class="btn" data-a="new">New deal</button>
					<button class="btn" data-a="restart">Restart this deal</button>
					<button class="btn" data-a="how">How to play</button>
					<button class="btn" data-a="settings">Settings</button>
					<button class="btn" data-a="menu">Main menu</button>
				</div>
				${isStandalone() ? '' : `<a class="btn btn--ghost btn--block" href="../">${icon('back')}<span>Back to the arcade</span></a>`}`,
		});
		d.el.addEventListener('click', (e) => {
			const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
			if (!a) return;
			if (a === 'resume') d.close();
			if (a === 'how') howToPlay(s.mode);
			if (a === 'settings') openSettings();
			if (a === 'menu') {
				d.close();
				this.toTitle();
			}
			if (a === 'restart') {
				d.close();
				this.start(new Session(s.mode, s.opts, s.seed), 'deal');
			}
			if (a === 'new') {
				d.close();
				this.newDeal();
			}
		});
	}

	/** New deal: Spider always asks for suits; others ask only mid-game. */
	newDeal() {
		const s = this.session;
		if (!s || dialogOpen()) return;
		this.view.cancel();
		const mid = s.midGame;
		if (!mid && s.mode !== 'spider') {
			this.startNew(s.mode, s.opts);
			return;
		}
		s.setPaused(true);
		const option =
			s.mode === 'klondike'
				? choice('nd-draw', 'Draw', [[1, 'Draw 1'], [3, 'Draw 3']], s.opts.draw)
				: s.mode === 'spider'
					? choice('nd-suits', 'Suits', [[1, '1 suit'], [2, '2 suits'], [4, '4 suits']], s.opts.suits)
					: '';
		const d = openDialog({
			title: mid ? 'Start a new deal?' : 'New deal',
			className: 'dialog--new',
			onClose: () => this.resume(),
			body: `
				${mid ? `<p class="dialog__lead">This game will end. It counts as played, not won.</p>` : ''}
				${option}
				<div class="dialog__actions">
					<button class="btn" data-a="cancel">${mid ? 'Keep playing' : 'Cancel'}</button>
					<button class="btn btn--primary" data-a="deal" autofocus>Deal</button>
				</div>`,
		});
		d.el.addEventListener('click', (e) => {
			const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
			if (a === 'cancel') d.close();
			if (a === 'deal') {
				const opts = this.readOpts(d.el, 'nd', s.opts);
				d.close();
				this.startNew(s.mode, opts);
			}
		});
	}

	private readOpts(root: HTMLElement, prefix: string, base: DealOptions): DealOptions {
		const draw = picked(root, `${prefix}-draw`);
		const suits = picked(root, `${prefix}-suits`);
		const opts = { ...base };
		if (draw) opts.draw = Number(draw) as 1 | 3;
		if (suits) opts.suits = Number(suits) as 1 | 2 | 4;
		updateSettings({ klondikeDraw: opts.draw, spiderSuits: opts.suits });
		return opts;
	}

	private async win() {
		const s = this.session!;
		const time = s.time();
		const hintFree = !s.hintsUsed;
		const result = recordWin(s.variant, time, s.moves, hintFree);
		this.view.board.render('animate');
		this.view.refreshHud();
		await new Promise((r) => window.setTimeout(r, 260));
		if (this.session !== s) return;
		sfx.win();
		await this.view.board.celebrate();
		if (this.session !== s) return;
		const r = result.stats;
		const stamp = (on: boolean) => (on ? `<span class="stamp">New best</span>` : '');
		const option =
			s.mode === 'klondike'
				? choice('w-draw', 'Next game', [[1, 'Draw 1'], [3, 'Draw 3']], s.opts.draw)
				: s.mode === 'spider'
					? choice('w-suits', 'Next game', [[1, '1 suit'], [2, '2 suits'], [4, '4 suits']], s.opts.suits)
					: '';
		const d = openDialog({
			title: 'Solved!',
			className: 'dialog--win',
			body: `
				<p class="win__variant">${variantName(s.mode, s.opts)}${s.mode === 'freecell' ? ` · Deal #${s.seed}` : ''}</p>
				<div class="win__stats">
					<div class="win__stat"><small>Time</small><b>${formatTime(time)}</b>${stamp(result.newTime)}</div>
					<div class="win__stat"><small>Moves</small><b>${s.moves}</b>${stamp(result.newMoves)}</div>
				</div>
				<p class="win__hint">${hintFree ? `<span class="stamp stamp--ok">Hint-free</span> This win can set a best.` : 'Hints used. The win counts, but sets no best.'}</p>
				<p class="win__record">${r.won} of ${r.played} won${r.bestTime !== null ? ` · best ${formatTime(r.bestTime)} · fewest ${r.bestMoves} moves` : ''}</p>
				${option}
				<div class="dialog__actions">
					<button class="btn" data-a="menu">Main menu</button>
					<button class="btn btn--primary" data-a="new" autofocus>New deal</button>
				</div>`,
		});
		d.el.addEventListener('click', (e) => {
			const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
			if (a === 'menu') {
				d.close();
				this.toTitle();
			}
			if (a === 'new') {
				const opts = this.readOpts(d.el, 'w', s.opts);
				d.close();
				this.startNew(s.mode, opts);
			}
		});
	}

	// ---------- settings, keys, back button ----------

	private applyTheme() {
		document.documentElement.dataset.theme = settings.theme;
		document.documentElement.classList.toggle('four-color', settings.fourColor);
		const felt = getComputedStyle(document.documentElement).getPropertyValue('--felt-2').trim();
		document.querySelector('meta[name="theme-color"]')?.setAttribute('content', felt || '#17402c');
	}

	private settingsChanged() {
		this.applyTheme();
		if (this.themeId !== settings.theme) {
			this.themeId = settings.theme;
			if (this.session) {
				this.view.board.refreshFaces();
				this.view.board.measure();
				this.view.board.render('instant');
			}
			if (this.screen === 'title') this.renderTitle();
		}
		if (this.session) {
			this.view.refreshHud();
			this.session.settingsChanged();
		}
	}

	private bindGlobal() {
		document.addEventListener('keydown', (e) => {
			if (this.screen !== 'game' || !this.session || dialogOpen()) return;
			if (e.altKey) return;
			const key = e.key.toLowerCase();
			if ((e.metaKey || e.ctrlKey) && key === 'z') {
				e.preventDefault();
				this.view.undo();
				return;
			}
			if (e.metaKey || e.ctrlKey) return;
			if (key === 'u') this.view.undo();
			else if (key === 'h') this.view.showHint();
			else if (key === 'n') this.newDeal();
			else if (key === 'p') this.pause();
			else if (key === 'f') this.view.finish();
			else if (key === 'escape') {
				if (this.view.board.held) this.view.cancel();
				else this.pause();
			} else return;
			e.preventDefault();
		});
		document.addEventListener('visibilitychange', () => {
			if (document.hidden && this.session?.started && !this.session.won) this.pause();
			this.session?.persist();
		});
		window.addEventListener('pagehide', () => this.session?.persist());
		// The phone back button stays in the game: it opens the pause menu.
		window.addEventListener('popstate', () => {
			if (this.leaving) {
				this.leaving = false;
				return;
			}
			if (this.screen !== 'game') return;
			history.pushState({ solitary: 'game' }, '');
			const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
			if (open.length) open[open.length - 1].dispatchEvent(new Event('cancel'));
			else this.pause();
		});
	}
}

export function boot() {
	const root = document.getElementById('app')!;
	new App(root);
}
