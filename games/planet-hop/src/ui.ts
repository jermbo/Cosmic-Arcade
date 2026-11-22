import type { Device, MenuKey } from './input';
import type { Settings } from './save';
import { formatTime } from './util';

export type Screen = 'title' | 'story' | 'pause' | 'settings' | 'controls' | 'results' | null;

export interface ResultData {
	time: number;
	dust: number;
	total: number;
	stomps: number;
	hits: number;
	best: number | null;
	newBest: boolean;
}

export interface UiHandlers {
	play(): void;
	storyDone(): void;
	resume(): void;
	pause(): void;
	restart(): void;
	quit(): void;
	settings(s: Settings): void;
	replayTutorial(): void;
	click(): void;
	move(): void;
}

const icon = {
	dust: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 15 9 23 12 15 15 12 23 9 15 1 12 9 9Z" fill="#ffd23f" stroke="#14112b" stroke-width="2" stroke-linejoin="round"/></svg>`,
	spark: (on: boolean) =>
		`<svg viewBox="0 0 24 28" aria-hidden="true"><rect x="7" y="2" width="10" height="4" rx="1" fill="#14112b"/><rect x="4" y="6" width="16" height="18" rx="3" fill="${on ? '#ffd23f' : '#5a5480'}" stroke="#14112b" stroke-width="2"/><path d="M12 10c3 3 3 6 0 9-3-3-3-6 0-9Z" fill="${on ? '#ff6b6b' : '#3b3560'}"/></svg>`,
};

const kbd = (k: string) => `<kbd>${k}</kbd>`;

/** All menus and the HUD. Plain DOM over the canvas. */
export class Ui {
	readonly root: HTMLElement;
	private screen: Screen = null;
	private settingsFrom: Screen = 'title';
	private controlsFrom: Screen = 'title';
	private hud: HTMLElement;
	private promptEl: HTMLElement;
	private toastEl: HTMLElement;
	private bannerEl: HTMLElement;
	private fadeEl: HTMLElement;
	private toastT = 0;
	private bannerT = 0;
	private device: Device = 'keyboard';
	private promptKey: string | null = null;
	private screens: Record<string, HTMLElement> = {};

	private settings: Settings;
	private h: UiHandlers;

	constructor(host: HTMLElement, settings: Settings, h: UiHandlers) {
		this.settings = settings;
		this.h = h;
		this.root = host;
		host.innerHTML = `
			<div class="hud" hidden>
				<div class="hud__left">
					<div class="chip chip--dust"><span class="chip__icon">${icon.dust}</span><span class="chip__num" data-dust>0 / 8</span><span class="bar"><span class="bar__fill" data-bar></span></span></div>
					<div class="chip chip--sparks" data-sparks aria-label="Lantern sparks"></div>
				</div>
				<button class="btn btn--icon hud__pause" type="button" data-act="pause" aria-label="Pause">
					<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="5" height="16" fill="currentColor"/><rect x="14" y="4" width="5" height="16" fill="currentColor"/></svg>
				</button>
			</div>
			<div class="banner" hidden><div class="banner__name"></div><div class="banner__sub"></div><div class="banner__hint"></div></div>
			<div class="toast" hidden></div>
			<div class="prompt" hidden></div>
			<div class="fade"></div>

			<section class="screen screen--title" data-screen="title" hidden>
				<div class="title">
					<h1 class="logo"><span>Planet</span><span>Hop</span></h1>
					<p class="tagline">A small sheep, a big lantern, three sleeping worlds.</p>
					<div class="menu">
						<button class="btn btn--main" type="button" data-act="play">Play</button>
						<button class="btn" type="button" data-act="controls">Controls</button>
						<button class="btn" type="button" data-act="settings">Settings</button>
						<a class="btn btn--ghost" href="../">Back to the arcade</a>
					</div>
					<p class="best" data-best></p>
				</div>
			</section>

			<section class="screen" data-screen="story" hidden>
				<div class="panel panel--story">
					<h2>The worlds are asleep</h2>
					<p>The Star Lighthouse went dark, and the little worlds around it fell asleep. Pip, a small sheep with a big lantern, sets out to wake them.</p>
					<p>Wherever Pip walks, the lantern brings the color back. Gather stardust to charge each launch pad. On the last world, light the lighthouse.</p>
					<div class="menu menu--row"><button class="btn btn--main" type="button" data-act="story-go">Let's hop</button></div>
				</div>
			</section>

			<section class="screen" data-screen="pause" hidden>
				<div class="panel">
					<h2>Paused</h2>
					<div class="menu">
						<button class="btn btn--main" type="button" data-act="resume">Resume</button>
						<button class="btn" type="button" data-act="controls">Controls</button>
						<button class="btn" type="button" data-act="settings">Settings</button>
						<button class="btn" type="button" data-act="restart">Restart run</button>
						<button class="btn btn--ghost" type="button" data-act="quit">Quit to title</button>
					</div>
				</div>
			</section>

			<section class="screen" data-screen="settings" hidden>
				<div class="panel panel--wide">
					<h2>Settings</h2>
					<div class="form">
						${this.slider('master', 'Master volume', 0, 1, 0.05)}
						${this.slider('music', 'Music', 0, 1, 0.05)}
						${this.slider('sfx', 'Sound effects', 0, 1, 0.05)}
						${this.slider('sensitivity', 'Camera speed', 0.3, 2, 0.05)}
						${this.toggle('invertY', 'Invert camera up/down')}
						${this.toggle('cameraAssist', 'Camera assist', 'The camera slowly swings behind Pip.')}
						${this.toggle('reduceMotion', 'Reduce motion', 'Calmer camera. No shake or zoom.')}
						<div class="field">
							<span class="field__label">Graphics</span>
							<div class="seg" role="radiogroup" aria-label="Graphics">
								<button class="seg__btn" type="button" role="radio" data-quality="high">High</button>
								<button class="seg__btn" type="button" role="radio" data-quality="low">Fast</button>
							</div>
						</div>
					</div>
					<div class="menu menu--row">
						<button class="btn" type="button" data-act="tutorial">Show the tutorial again</button>
						<button class="btn btn--main" type="button" data-act="back">Done</button>
					</div>
				</div>
			</section>

			<section class="screen" data-screen="controls" hidden>
				<div class="panel panel--wide">
					<h2>Controls</h2>
					<table class="controls">
						<thead><tr><th>Action</th><th>Keyboard and mouse</th><th>Gamepad</th><th>Touch</th></tr></thead>
						<tbody>
							<tr><td>Move</td><td>${kbd('W')}${kbd('A')}${kbd('S')}${kbd('D')} or arrows</td><td>Left stick</td><td>Left thumb</td></tr>
							<tr><td>Camera</td><td>Mouse</td><td>Right stick</td><td>Drag on the right</td></tr>
							<tr><td>Jump</td><td>${kbd('Space')}, hold for higher</td><td>${kbd('A')}, hold for higher</td><td>JUMP button</td></tr>
							<tr><td>Pause</td><td>${kbd('Esc')} or ${kbd('P')}</td><td>${kbd('Start')}</td><td>Pause button</td></tr>
						</tbody>
					</table>
					<p class="note">Jump on frost mites to pop them. Pink blossoms bounce you high. Hold jump on a blossom to go even higher.</p>
					<div class="menu menu--row"><button class="btn btn--main" type="button" data-act="back">Back</button></div>
				</div>
			</section>

			<section class="screen" data-screen="results" hidden>
				<div class="panel panel--results">
					<p class="kicker">The Star Lighthouse shines again</p>
					<h2 data-medal>Star Keeper</h2>
					<dl class="stats">
						<div><dt>Time</dt><dd data-r="time"></dd></div>
						<div><dt>Stardust</dt><dd data-r="dust"></dd></div>
						<div><dt>Mites popped</dt><dd data-r="stomps"></dd></div>
						<div><dt>Bumps</dt><dd data-r="hits"></dd></div>
					</dl>
					<p class="best" data-r="best"></p>
					<div class="menu menu--row">
						<button class="btn btn--main" type="button" data-act="again">Play again</button>
						<button class="btn" type="button" data-act="quit">Title</button>
					</div>
				</div>
			</section>

			<div class="rotate"><div class="panel"><h2>Turn your phone</h2><p>Planet Hop plays in landscape.</p></div></div>
		`;
		this.hud = host.querySelector('.hud')!;
		this.promptEl = host.querySelector('.prompt')!;
		this.toastEl = host.querySelector('.toast')!;
		this.bannerEl = host.querySelector('.banner')!;
		this.fadeEl = host.querySelector('.fade')!;
		host.querySelectorAll<HTMLElement>('[data-screen]').forEach((el) => (this.screens[el.dataset.screen!] = el));

		host.addEventListener('click', (e) => {
			const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act], [data-quality], [data-toggle]');
			if (!t) return;
			if (t.dataset.act) this.act(t.dataset.act);
			if (t.dataset.quality) {
				this.settings.quality = t.dataset.quality as Settings['quality'];
				this.syncSettings();
				this.h.settings(this.settings);
				this.h.click();
			}
			if (t.dataset.toggle) {
				const key = t.dataset.toggle as 'invertY' | 'cameraAssist' | 'reduceMotion';
				this.settings[key] = !this.settings[key];
				this.syncSettings();
				this.h.settings(this.settings);
				this.h.click();
			}
		});
		host.addEventListener('input', (e) => {
			const t = e.target as HTMLInputElement;
			const key = t.dataset.slider as 'master' | 'music' | 'sfx' | 'sensitivity' | undefined;
			if (!key) return;
			this.settings[key] = Number(t.value);
			this.syncSettings();
			this.h.settings(this.settings);
		});
		host.addEventListener('keydown', (e) => {
			if (!this.screen) return;
			if (e.key === 'Escape') {
				e.preventDefault();
				this.back();
			}
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				const el = document.activeElement as HTMLElement | null;
				if (el?.tagName === 'INPUT') return;
				e.preventDefault();
				this.focusStep(e.key === 'ArrowDown' ? 1 : -1);
			}
		});
		addEventListener('keydown', (e) => {
			// Escape on a menu when focus is outside the UI.
			if (this.screen && e.key === 'Escape' && !host.contains(document.activeElement)) this.back();
		});
		host.addEventListener('mouseover', (e) => {
			const b = (e.target as HTMLElement).closest<HTMLElement>('.btn, .seg__btn');
			if (b && this.screen && document.activeElement !== b) b.focus({ preventScroll: true });
		});
		host.addEventListener('focusin', () => this.screen && this.h.move());
		this.syncSettings();
	}

	private slider(key: string, label: string, min: number, max: number, step: number): string {
		return `<label class="field field--slider"><span class="field__label">${label}</span><input class="range" type="range" min="${min}" max="${max}" step="${step}" data-slider="${key}"><output data-out="${key}"></output></label>`;
	}

	private toggle(key: string, label: string, note = ''): string {
		return `<div class="field"><span class="field__label">${label}${note ? `<small>${note}</small>` : ''}</span><button class="switch" type="button" role="switch" data-toggle="${key}" aria-label="${label}"><span></span></button></div>`;
	}

	private syncSettings(): void {
		const s = this.settings;
		this.root.querySelectorAll<HTMLInputElement>('[data-slider]').forEach((el) => {
			const key = el.dataset.slider as keyof Settings;
			el.value = String(s[key]);
			const out = this.root.querySelector<HTMLElement>(`[data-out="${key}"]`)!;
			out.textContent = key === 'sensitivity' ? `${Number(s[key]).toFixed(1)}×` : `${Math.round(Number(s[key]) * 100)}%`;
		});
		this.root.querySelectorAll<HTMLElement>('[data-toggle]').forEach((el) => {
			const on = !!s[el.dataset.toggle as keyof Settings];
			el.setAttribute('aria-checked', String(on));
		});
		this.root.querySelectorAll<HTMLElement>('[data-quality]').forEach((el) => {
			el.setAttribute('aria-checked', String(el.dataset.quality === s.quality));
		});
	}

	private act(a: string): void {
		this.h.click();
		switch (a) {
			case 'play':
			case 'again':
				this.h.play();
				break;
			case 'story-go':
				this.h.storyDone();
				break;
			case 'pause':
				this.h.pause();
				break;
			case 'resume':
				this.h.resume();
				break;
			case 'restart':
				this.h.restart();
				break;
			case 'quit':
				this.h.quit();
				break;
			case 'settings':
				this.settingsFrom = this.screen;
				this.show('settings');
				break;
			case 'controls':
				this.controlsFrom = this.screen;
				this.show('controls');
				break;
			case 'tutorial':
				this.h.replayTutorial();
				this.toast('The tutorial will show on your next run.', 2.5);
				break;
			case 'back':
				this.back();
				break;
		}
	}

	/** Back one level. Returns false when there is nothing to go back to. */
	back(): boolean {
		if (this.screen === 'settings') this.show(this.settingsFrom);
		else if (this.screen === 'controls') this.show(this.controlsFrom);
		else if (this.screen === 'pause') this.h.resume();
		else if (this.screen === 'story') this.show('title');
		else return false;
		return true;
	}

	get current(): Screen {
		return this.screen;
	}

	show(s: Screen): void {
		this.screen = s;
		for (const [name, el] of Object.entries(this.screens)) el.hidden = name !== s;
		if (s) {
			const el = this.screens[s];
			requestAnimationFrame(() => {
				const first = el.querySelector<HTMLElement>('.btn--main, .btn');
				first?.focus({ preventScroll: true });
			});
		} else if (this.root.contains(document.activeElement)) {
			(document.activeElement as HTMLElement).blur();
		}
	}

	private focusables(): HTMLElement[] {
		if (!this.screen) return [];
		return Array.from(this.screens[this.screen].querySelectorAll<HTMLElement>('button, a, input'));
	}

	private focusStep(d: number): void {
		const list = this.focusables();
		if (!list.length) return;
		const i = list.indexOf(document.activeElement as HTMLElement);
		const n = list[(i + d + list.length) % list.length];
		n.focus({ preventScroll: true });
	}

	/** Gamepad menu keys. */
	menu(k: MenuKey): void {
		if (!this.screen) return;
		const el = document.activeElement as HTMLElement | null;
		const inScreen = el && this.screens[this.screen].contains(el);
		if (k === 'up') this.focusStep(-1);
		if (k === 'down') this.focusStep(1);
		if ((k === 'left' || k === 'right') && inScreen) {
			if (el instanceof HTMLInputElement && el.type === 'range') {
				const step = Number(el.step) || 0.05;
				el.value = String(Number(el.value) + (k === 'right' ? step : -step));
				el.dispatchEvent(new Event('input', { bubbles: true }));
			} else if (el?.classList.contains('seg__btn') || el?.classList.contains('switch')) {
				if (el.classList.contains('seg__btn')) {
					const sib = k === 'right' ? el.nextElementSibling : el.previousElementSibling;
					(sib as HTMLElement | null)?.click();
					(sib as HTMLElement | null)?.focus();
				} else el.click();
			} else this.focusStep(k === 'right' ? 1 : -1);
		}
		if (k === 'confirm') {
			if (inScreen) el!.click();
			else this.focusStep(1);
		}
		if (k === 'back') this.back();
	}

	setDevice(d: Device): void {
		this.device = d;
		if (this.promptKey) this.prompt(this.promptKey);
		this.root.classList.toggle('is-touch', d === 'touch');
	}

	showHud(on: boolean): void {
		this.hud.hidden = !on;
	}

	setDust(n: number, quota: number, charged: boolean): void {
		this.root.querySelector('[data-dust]')!.textContent = `${n} / ${quota}`;
		const fill = this.root.querySelector<HTMLElement>('[data-bar]')!;
		fill.style.width = `${Math.min(100, (n / quota) * 100)}%`;
		this.hud.querySelector('.chip--dust')!.classList.toggle('is-ready', charged);
	}

	setSparks(n: number): void {
		this.root.querySelector('[data-sparks]')!.innerHTML = [0, 1, 2].map((i) => icon.spark(i < n)).join('');
	}

	/** Tutorial prompts by key, worded for the current device. */
	prompt(key: string | null): void {
		this.promptKey = key;
		if (!key) {
			this.promptEl.hidden = true;
			return;
		}
		const d = this.device;
		const txt: Record<string, string> = {
			move: d === 'touch' ? 'Drag your left thumb to move' : d === 'gamepad' ? `${kbd('Left stick')} Move` : `${kbd('W')}${kbd('A')}${kbd('S')}${kbd('D')} Move`,
			look: d === 'touch' ? 'Drag on the right side to turn the camera' : d === 'gamepad' ? `${kbd('Right stick')} Turn the camera` : `${kbd('Mouse')} Turn the camera`,
			jump: d === 'touch' ? 'Tap JUMP. Hold it to jump higher' : d === 'gamepad' ? `${kbd('A')} Jump. Hold to jump higher` : `${kbd('Space')} Jump. Hold to jump higher`,
			dust: `${icon.dust} Collect stardust to charge the launch pad`,
			pad: 'The pad is charged. Follow the light beam',
			rune: 'Follow the light beam to the lighthouse',
		};
		this.promptEl.innerHTML = txt[key] ?? key;
		this.promptEl.hidden = false;
		this.promptEl.classList.remove('is-in');
		void this.promptEl.offsetWidth;
		this.promptEl.classList.add('is-in');
	}

	toast(text: string, seconds = 2): void {
		this.toastEl.textContent = text;
		this.toastEl.hidden = false;
		this.toastT = seconds;
	}

	banner(name: string, sub: string, hint: string, seconds = 4.5): void {
		this.bannerEl.querySelector('.banner__name')!.textContent = name;
		this.bannerEl.querySelector('.banner__sub')!.textContent = sub;
		this.bannerEl.querySelector('.banner__hint')!.textContent = hint;
		this.bannerEl.hidden = false;
		this.bannerEl.classList.remove('is-out');
		this.bannerT = seconds;
	}

	fade(on: boolean): void {
		this.fadeEl.classList.toggle('is-on', on);
	}

	setBest(text: string): void {
		this.root.querySelector('[data-best]')!.textContent = text;
	}

	results(r: ResultData): void {
		const all = r.dust >= r.total;
		const medal = all && r.hits === 0 ? 'Star Keeper' : all ? 'Golden Fleece' : r.dust >= r.total * 0.75 ? 'Bright Spark' : 'Lamplighter';
		this.root.querySelector('[data-medal]')!.textContent = medal;
		const set = (k: string, v: string) => (this.root.querySelector(`[data-r="${k}"]`)!.textContent = v);
		set('time', formatTime(r.time));
		set('dust', `${r.dust} / ${r.total}`);
		set('stomps', String(r.stomps));
		set('hits', String(r.hits));
		set('best', r.newBest ? 'New best time!' : r.best !== null ? `Best time ${formatTime(r.best)}` : '');
		this.show('results');
	}

	update(dt: number): void {
		if (this.toastT > 0) {
			this.toastT -= dt;
			if (this.toastT <= 0) this.toastEl.hidden = true;
		}
		if (this.bannerT > 0) {
			this.bannerT -= dt;
			if (this.bannerT < 0.6) this.bannerEl.classList.add('is-out');
			if (this.bannerT <= 0) this.bannerEl.hidden = true;
		}
	}

	hideBanner(): void {
		this.bannerT = 0;
		this.bannerEl.hidden = true;
	}
}
