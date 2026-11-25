import { sfx, unlockAudio } from '../audio/sfx.ts';
import { randomSeed } from '../core/rng.ts';
import type { DealOptions, ModeId } from '../core/types.ts';
import { Session } from '../game/session.ts';
import { randomDealNumber } from '../rules/freecell.ts';
import { variantName } from '../rules/index.ts';
import { formatTime, recordWin } from '../store/bests.ts';
import { clearGame, loadGame } from '../store/savegame.ts';
import { onSettings, settings, updateSettings } from '../store/settings.ts';
import { dialogOpen, howToPlay, openDialog, openSettings, type DialogHandle } from './dialogs.ts';
import { GameView } from './game-view.ts';
import { icon } from './icons.ts';
import { isStandalone, promptInstall, setupPwa } from './pwa.ts';
import { TitleScreen } from './title-screen.ts';
import { dialogVariantOptions, readVariantOptions } from './variant-options.ts';

export class App {
	private title: TitleScreen;
	private view: GameView;
	private session: Session | null = null;
	private screen: 'title' | 'game' = 'title';
	private historyPushed = false;
	private leaving = false;
	private themeId = settings.theme;

	constructor(root: HTMLElement) {
		this.title = new TitleScreen({
			play: (mode, opts) => {
				unlockAudio();
				this.startNew(mode, opts);
			},
			continueGame: () => {
				unlockAudio();
				const game = loadGame();
				if (game) this.start(new Session(game.mode, game.opts, game.seed, game), 'instant');
			},
			howToPlay: () => howToPlay('klondike'),
			openSettings: () => openSettings(),
			installApp: () => promptInstall().then(() => this.title.render()),
		});
		this.view = new GameView({
			pause: () => this.pause(),
			newDeal: () => this.newDeal(),
			win: () => this.win(),
		});
		root.append(this.title.el, this.view.el);
		this.applyTheme();
		onSettings(() => this.settingsChanged());
		this.title.render();
		this.bindGlobal();
		setupPwa(() => {
			if (this.screen === 'title') this.title.render();
		});
	}

	private startNew(mode: ModeId, opts: DealOptions) {
		const seed = mode === 'freecell' ? randomDealNumber() : randomSeed();
		this.start(new Session(mode, opts, seed), 'deal');
	}

	private start(session: Session, how: 'deal' | 'instant') {
		if (how === 'deal') clearGame();
		this.session = session;
		this.screen = 'game';
		this.title.el.hidden = true;
		this.view.el.hidden = false;
		this.view.start(session, how);
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
		this.title.el.hidden = false;
		this.title.render();
		this.title.focusPlay();
		if (this.historyPushed) {
			this.leaving = true;
			this.historyPushed = false;
			history.back();
		}
	}

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
		const session = this.session;
		if (!session || dialogOpen()) return;
		this.view.cancel();
		session.setPaused(true);
		const dialog = openDialog({
			title: 'Paused',
			className: 'dialog--pause',
			onClose: () => this.resume(),
			body: `
				<p class="pause__line"><b>${variantName(session.mode, session.opts)}</b>${session.mode === 'freecell' ? ` · Deal #${session.seed}` : ''}<br>${formatTime(session.time())} · ${session.moves} moves${session.hintsUsed ? ' · hints used' : ''}</p>
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
		dialog.el.addEventListener('click', (e) => {
			const action = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
			if (!action) return;
			if (action === 'resume') dialog.close();
			if (action === 'how') howToPlay(session.mode);
			if (action === 'settings') openSettings();
			if (action === 'menu') {
				dialog.close();
				this.toTitle();
			}
			if (action === 'restart') {
				dialog.close();
				this.start(new Session(session.mode, session.opts, session.seed), 'deal');
			}
			if (action === 'new') {
				dialog.close();
				this.newDeal();
			}
		});
	}

	newDeal() {
		const session = this.session;
		if (!session || dialogOpen()) return;
		this.view.cancel();
		const midGame = session.midGame;
		if (!midGame && session.mode !== 'spider') {
			this.startNew(session.mode, session.opts);
			return;
		}
		session.setPaused(true);
		const dialog = openDialog({
			title: midGame ? 'Start a new deal?' : 'New deal',
			className: 'dialog--new',
			onClose: () => this.resume(),
			body: `
				${midGame ? `<p class="dialog__lead">This game will end. It counts as played, not won.</p>` : ''}
				${dialogVariantOptions(session.mode, 'nd', session.opts)}
				<div class="dialog__actions">
					<button class="btn" data-a="cancel">${midGame ? 'Keep playing' : 'Cancel'}</button>
					<button class="btn btn--primary" data-a="deal" autofocus>Deal</button>
				</div>`,
		});
		dialog.el.addEventListener('click', (e) => {
			const action = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
			if (action === 'cancel') dialog.close();
			if (action === 'deal') {
				const opts = readVariantOptions(dialog.el, 'nd', session.opts);
				dialog.close();
				this.startNew(session.mode, opts);
			}
		});
	}

	private async win() {
		const session = this.session!;
		const time = session.time();
		const hintFree = !session.hintsUsed;
		const result = recordWin(session.variant, time, session.moves, hintFree);
		this.view.board.animateLayout();
		this.view.refreshHud();
		await new Promise((resolve) => window.setTimeout(resolve, 260));
		if (this.session !== session) return;
		sfx.win();
		await this.view.board.celebrate();
		if (this.session !== session) return;
		const stats = result.stats;
		const stamp = (isNew: boolean) => (isNew ? `<span class="stamp">New best</span>` : '');
		const dialog = openDialog({
			title: 'Solved!',
			className: 'dialog--win',
			body: `
				<p class="win__variant">${variantName(session.mode, session.opts)}${session.mode === 'freecell' ? ` · Deal #${session.seed}` : ''}</p>
				<div class="win__stats">
					<div class="win__stat"><small>Time</small><b>${formatTime(time)}</b>${stamp(result.newTime)}</div>
					<div class="win__stat"><small>Moves</small><b>${session.moves}</b>${stamp(result.newMoves)}</div>
				</div>
				<p class="win__hint">${hintFree ? `<span class="stamp stamp--ok">Hint-free</span> This win can set a best.` : 'Hints used. The win counts, but sets no best.'}</p>
				<p class="win__record">${stats.won} of ${stats.played} won${stats.bestTime !== null ? ` · best ${formatTime(stats.bestTime)} · fewest ${stats.bestMoves} moves` : ''}</p>
				${dialogVariantOptions(session.mode, 'w', session.opts, 'Next game')}
				<div class="dialog__actions">
					<button class="btn" data-a="menu">Main menu</button>
					<button class="btn btn--primary" data-a="new" autofocus>New deal</button>
				</div>`,
		});
		dialog.el.addEventListener('click', (e) => {
			const action = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
			if (action === 'menu') {
				dialog.close();
				this.toTitle();
			}
			if (action === 'new') {
				const opts = readVariantOptions(dialog.el, 'w', session.opts);
				dialog.close();
				this.startNew(session.mode, opts);
			}
		});
	}

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
				this.view.board.snapToLayout();
			}
			if (this.screen === 'title') this.title.render();
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