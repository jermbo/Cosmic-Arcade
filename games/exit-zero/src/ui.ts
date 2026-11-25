import type { GameState } from './core/state.ts';
import type { ItemDef, NoteDef, StoryDef, TutorialDef } from './core/types.ts';
import type { Input } from './input.ts';
import type { Settings } from './save.ts';

// The DOM layer: menus, HUD, notes and the keypad. Text comes from the data files.

export type Screen = 'none' | 'title' | 'intro' | 'pause' | 'settings' | 'controls' | 'inventory' | 'note' | 'keypad' | 'dead' | 'ending';

export interface UIActions {
	newGame(): void;
	continueGame(): void;
	resume(): void;
	quitToTitle(): void;
	retry(): void;
	settingsChanged(s: Settings): void;
	sound(id: string): void;
	keypadWrong(): void;
	readNote(id: string): void;
}

export interface Prompt {
	label: string;
	detail?: string;
	disabled?: boolean;
	hold?: number;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Pixel icons for items, 12 x 12 cells. */
const ICONS: Record<string, string> = {
	key: '<rect x="1" y="3" width="5" height="5" fill="#e8b93a"/><rect x="2" y="4" width="3" height="3" fill="#14120a"/><rect x="6" y="5" width="5" height="1.6" fill="#e8b93a"/><rect x="9" y="6" width="1.4" height="2.4" fill="#e8b93a"/><rect x="7" y="6" width="1.4" height="1.8" fill="#e8b93a"/>',
	wrench: '<rect x="5.2" y="4" width="1.8" height="7" fill="#d8392b"/><rect x="4" y="1" width="4.2" height="3.4" fill="#c9ccd0"/><rect x="5.2" y="1" width="1.8" height="1.6" fill="#14120a"/>',
	fuse: '<rect x="3" y="4" width="6" height="4" fill="#bfe8e2"/><rect x="1" y="3.5" width="2.2" height="5" fill="#e08a3c"/><rect x="8.8" y="3.5" width="2.2" height="5" fill="#e08a3c"/><rect x="3" y="5.8" width="6" height=".6" fill="#7aa"/>',
	flashlight: '<rect x="1" y="5" width="6" height="2.6" fill="#3a4a5a"/><rect x="7" y="4" width="2.5" height="4.6" fill="#8a9aa8"/><rect x="9.5" y="4.6" width="1.6" height="3.4" fill="#fff6b0"/>',
	note: '<rect x="2.5" y="1" width="7" height="10" fill="#efe6c4"/><rect x="3.5" y="3" width="5" height=".7" fill="#7a8ab8"/><rect x="3.5" y="5" width="5" height=".7" fill="#7a8ab8"/><rect x="3.5" y="7" width="3.5" height=".7" fill="#7a8ab8"/>',
};

function icon(id: string): string {
	return `<svg viewBox="0 0 12 12" class="icon" aria-hidden="true" shape-rendering="crispEdges">${ICONS[id] ?? ICONS.note}</svg>`;
}

const CONTROLS: [string, string, string][] = [
	['Move', 'W A S D', 'Left stick'],
	['Look', 'Mouse', 'Right stick'],
	['Sprint (loud)', 'Shift', 'LT / L3'],
	['Use / pick up', 'E or click', 'A / RT'],
	['Pockets and notes', 'Tab or I', 'Y'],
	['Flashlight', 'F', 'X'],
	['First / third person', 'V', 'Back'],
	['Pause', 'Esc', 'Start'],
];

export class UI {
	screen: Screen = 'none';
	private layer: HTMLElement;
	private hud: HTMLElement;
	private promptEl: HTMLElement;
	private toasts: HTMLElement;
	private bannerEl: HTMLElement;
	private tipEl: HTMLElement;
	private savedEl: HTMLElement;
	private loudEl: HTMLElement;
	private lookEl: HTMLElement;
	private crossEl: HTMLElement;
	private fadeEl: HTMLElement;
	private back: Screen[] = [];
	private onNav: ((dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back') => boolean) | null = null;
	private story: StoryDef;
	private items: Record<string, ItemDef>;
	private notes: Record<string, NoteDef>;
	private a: UIActions;
	private settings!: Settings;
	private keypad: { code: string; entry: string; onSolve: () => void } | null = null;
	private noteReturn: Screen = 'none';
	private typing: { lines: string[]; i: number; chars: number; el: HTMLElement; done: () => void } | null = null;
	device: 'keys' | 'pad' = 'keys';

	constructor(root: HTMLElement, story: StoryDef, items: Record<string, ItemDef>, notes: Record<string, NoteDef>, actions: UIActions) {
		this.story = story;
		this.items = items;
		this.notes = notes;
		this.a = actions;
		root.innerHTML = `
			<div class="hud" hidden>
				<div class="cross"></div>
				<div class="banner" aria-live="polite"></div>
				<div class="tip" aria-live="polite"></div>
				<div class="toasts" aria-live="polite"></div>
				<div class="prompt" hidden></div>
				<div class="saved" hidden>${icon('note')}<span></span></div>
				<div class="loud" hidden><span>LOUD</span></div>
				<div class="look" hidden>Click to look around</div>
			</div>
			<div class="fade"></div>
			<div class="layer"></div>`;
		this.hud = root.querySelector('.hud')!;
		this.layer = root.querySelector('.layer')!;
		this.promptEl = root.querySelector('.prompt')!;
		this.toasts = root.querySelector('.toasts')!;
		this.bannerEl = root.querySelector('.banner')!;
		this.tipEl = root.querySelector('.tip')!;
		this.savedEl = root.querySelector('.saved')!;
		this.loudEl = root.querySelector('.loud')!;
		this.lookEl = root.querySelector('.look')!;
		this.crossEl = root.querySelector('.cross')!;
		this.fadeEl = root.querySelector('.fade')!;
		this.layer.addEventListener('click', (e) => {
			const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
			if (el) this.act(el.dataset.act!, el);
		});
		this.layer.addEventListener('input', (e) => this.onInput(e.target as HTMLInputElement));
		this.layer.addEventListener('change', (e) => this.onInput(e.target as HTMLInputElement));
	}

	t(key: string): string {
		return this.story.text[key] ?? key;
	}

	setSettings(s: Settings): void {
		this.settings = s;
	}

	// --- HUD ---

	showHud(on: boolean): void {
		this.hud.hidden = !on;
	}

	prompt(p: Prompt | null, hold = 0): void {
		if (!p) {
			this.promptEl.hidden = true;
			this.crossEl.classList.remove('on');
			return;
		}
		const key = this.device === 'pad' ? 'A' : 'E';
		const html = `<span class="key${p.disabled ? ' off' : ''}">${key}</span><span class="label">${esc(p.label)}${p.hold && !p.disabled ? ` <em>(${this.t('prompt.hold')})</em>` : ''}</span>${p.detail ? `<span class="detail${p.disabled ? ' warn' : ''}">${esc(p.detail)}</span>` : ''}${p.hold && !p.disabled ? `<span class="bar"><i style="width:${Math.round(hold * 100)}%"></i></span>` : ''}`;
		if (this.promptEl.dataset.html !== html) {
			this.promptEl.innerHTML = html;
			this.promptEl.dataset.html = html;
		}
		this.promptEl.hidden = false;
		this.promptEl.classList.toggle('disabled', !!p.disabled);
		this.crossEl.classList.add('on');
	}

	toast(text: string): void {
		const el = document.createElement('div');
		el.className = 'toast';
		el.textContent = text;
		this.toasts.append(el);
		while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
		setTimeout(() => el.classList.add('out'), Math.max(3500, text.length * 70));
		setTimeout(() => el.remove(), Math.max(3500, text.length * 70) + 600);
	}

	banner(name: string, blurb: string): void {
		this.bannerEl.innerHTML = `<b>${esc(name)}</b><span>${esc(blurb)}</span>`;
		this.bannerEl.classList.remove('show');
		void this.bannerEl.offsetWidth;
		this.bannerEl.classList.add('show');
	}

	tip(def: TutorialDef): void {
		const keys = this.device === 'pad' ? def.pad : def.keys;
		this.tipEl.innerHTML = `<span class="key">${esc(keys)}</span><span>${esc(def.text)}</span>`;
		this.tipEl.classList.remove('show');
		void this.tipEl.offsetWidth;
		this.tipEl.classList.add('show');
	}

	saved(): void {
		this.savedEl.querySelector('span')!.textContent = this.t('saved');
		this.savedEl.hidden = false;
		this.savedEl.classList.remove('show');
		void this.savedEl.offsetWidth;
		this.savedEl.classList.add('show');
	}

	loud(on: boolean): void {
		this.loudEl.hidden = !on;
	}

	lookHint(on: boolean): void {
		this.lookEl.hidden = !on;
	}

	fade(amount: number, color = '#000'): void {
		this.fadeEl.style.opacity = String(amount);
		this.fadeEl.style.background = color;
	}

	// --- screens ---

	private open(screen: Screen, html: string, nav = true): void {
		this.screen = screen;
		this.layer.innerHTML = html;
		this.layer.className = `layer s-${screen}`;
		this.onNav = null;
		if (nav) {
			const first = this.layer.querySelector<HTMLElement>('[data-nav]');
			first?.focus({ preventScroll: true });
		}
	}

	close(): void {
		this.screen = 'none';
		this.layer.innerHTML = '';
		this.layer.className = 'layer';
		this.onNav = null;
		this.keypad = null;
		this.typing = null;
	}

	title(canContinue: boolean, clearedTime: number | null): void {
		this.back = [];
		this.open('title', `
			<div class="title">
				<h1 class="logo"><span>EXIT</span><span class="zero">0</span></h1>
				<p class="chip">${esc(this.t('level.m0'))}</p>
				<nav class="menu">
					${canContinue ? `<button data-nav data-act="continue" class="btn">Continue</button>` : ''}
					<button data-nav data-act="new" class="btn ${canContinue ? 'alt' : ''}">New game</button>
					<button data-nav data-act="settings" class="btn alt">Settings</button>
					<button data-nav data-act="controls" class="btn alt">Controls</button>
					<a data-nav class="btn link" href="../">&larr; Cosmic Arcade</a>
				</nav>
				${clearedTime !== null ? `<p class="cleared">Exit code 0 reached in ${fmtTime(clearedTime)}</p>` : ''}
				<p class="hint">Desktop. Keyboard and mouse, or a gamepad. Headphones help.</p>
			</div>`);
	}

	intro(lines: string[], done: () => void): void {
		this.open('intro', `<div class="intro"><p class="type"></p><p class="next">${this.device === 'pad' ? 'A' : 'Click or Enter'} to continue</p><button data-act="skip" class="btn small alt">Skip</button></div>`, false);
		const el = this.layer.querySelector<HTMLElement>('.type')!;
		this.typing = { lines, i: 0, chars: 0, el, done };
		this.layer.querySelector('.intro')!.addEventListener('click', (e) => {
			if ((e.target as HTMLElement).dataset.act === 'skip') return;
			this.advanceTyping();
		});
		this.onNav = (d) => {
			if (d === 'ok') this.advanceTyping();
			if (d === 'back') this.finishTyping();
			return true;
		};
	}

	private advanceTyping(): void {
		const ty = this.typing;
		if (!ty) return;
		const line = ty.lines[ty.i];
		if (ty.chars < line.length) {
			ty.chars = line.length;
			ty.el.textContent = line;
			return;
		}
		ty.i++;
		ty.chars = 0;
		this.a.sound('ui');
		if (ty.i >= ty.lines.length) this.finishTyping();
	}

	private finishTyping(): void {
		const ty = this.typing;
		this.typing = null;
		ty?.done();
	}

	/** Moves the typewriter on. Called each frame. */
	tick(dt: number): void {
		const ty = this.typing;
		if (!ty) return;
		const line = ty.lines[ty.i];
		if (!line) return;
		if (ty.chars < line.length) {
			const before = Math.floor(ty.chars);
			ty.chars = Math.min(line.length, ty.chars + dt * 38);
			if (Math.floor(ty.chars) !== before) ty.el.textContent = line.slice(0, Math.floor(ty.chars));
		}
	}

	pause(): void {
		this.back = [];
		this.open('pause', `
			<div class="panel pause">
				<h2>Paused</h2>
				<nav class="menu">
					<button data-nav data-act="resume" class="btn">Resume</button>
					<button data-nav data-act="settings" class="btn alt">Settings</button>
					<button data-nav data-act="controls" class="btn alt">Controls</button>
					<button data-nav data-act="quit" class="btn alt">Quit to title</button>
					<a data-nav class="btn link" href="../">&larr; Cosmic Arcade</a>
				</nav>
				<p class="hint">Progress saves at checkpoints.</p>
			</div>`);
	}

	settingsScreen(from: Screen): void {
		this.back.push(from);
		const s = this.settings;
		const range = (id: keyof Settings, label: string, min: number, max: number, step: number, fmt: (v: number) => string) =>
			`<label class="row"><span>${label}</span><input data-nav type="range" data-set="${id}" min="${min}" max="${max}" step="${step}" value="${s[id]}"><output>${fmt(s[id] as number)}</output></label>`;
		const toggle = (id: keyof Settings, label: string, on: string, off: string, value: boolean) =>
			`<div class="row"><span>${label}</span><button data-nav data-act="toggle" data-set="${id}" class="btn small ${value ? '' : 'alt'}">${value ? on : off}</button></div>`;
		const pct = (v: number) => `${Math.round(v * 100)}%`;
		this.open('settings', `
			<div class="panel settings">
				<h2>Settings</h2>
				<div class="rows">
					${range('master', 'Master volume', 0, 1, 0.05, pct)}
					${range('music', 'Music', 0, 1, 0.05, pct)}
					${range('sfx', 'Sound effects', 0, 1, 0.05, pct)}
					${range('sensitivity', 'Look speed', 0.2, 3, 0.1, (v) => v.toFixed(1))}
					${range('fov', 'Field of view', 60, 100, 1, (v) => `${v}&deg;`)}
					${toggle('view', 'Camera', 'First person', 'Third person', s.view === 'first')}
					${toggle('invertY', 'Invert look', 'On', 'Off', s.invertY)}
					<div class="row"><span>Resolution</span><button data-nav data-act="lines" class="btn small">${s.lines}p</button></div>
					${toggle('crt', 'CRT filter', 'On', 'Off', s.crt)}
					${toggle('wobble', 'Vertex wobble', 'On', 'Off', s.wobble)}
					${toggle('bob', 'Head bob', 'On', 'Off', s.bob)}
				</div>
				<button data-nav data-act="back" class="btn">Back</button>
			</div>`);
	}

	controls(from: Screen): void {
		this.back.push(from);
		this.open('controls', `
			<div class="panel controls">
				<h2>Controls</h2>
				<table>
					<thead><tr><th>Action</th><th>Keyboard + mouse</th><th>Gamepad</th></tr></thead>
					<tbody>${CONTROLS.map(([a, k, p]) => `<tr><td>${a}</td><td><span class="key">${k}</span></td><td><span class="key">${p}</span></td></tr>`).join('')}</tbody>
				</table>
				<p class="hint">Running is loud. Some things listen.</p>
				<button data-nav data-act="back" class="btn">Back</button>
			</div>`);
	}

	inventory(state: GameState): void {
		const items = state.inventory.map((id) => {
			const it = this.items[id];
			return `<button data-nav data-act="item" data-id="${id}" class="slot">${icon(it?.icon ?? 'note')}<span>${esc(it?.name ?? id)}</span></button>`;
		});
		const notes = state.notes.map((id) => `<button data-nav data-act="readnote" data-id="${id}" class="slot note">${icon('note')}<span>${esc(this.notes[id]?.title ?? id)}</span></button>`);
		this.open('inventory', `
			<div class="panel inventory">
				<h2>Pockets</h2>
				<div class="grid">${items.join('') || '<p class="hint">Empty.</p>'}</div>
				<p class="desc">${state.inventory[0] ? esc(this.items[state.inventory[0]]?.desc ?? '') : ''}</p>
				<h3>Notes <small>${state.notes.length}</small></h3>
				<div class="grid notes">${notes.join('') || '<p class="hint">No notes yet.</p>'}</div>
				<button data-nav data-act="close" class="btn">Close</button>
			</div>`);
	}

	note(id: string, returnTo: Screen): void {
		const n = this.notes[id];
		if (!n) return;
		this.noteReturn = returnTo;
		this.open('note', `
			<div class="paper ${n.style ?? 'paper'}">
				<h2>${esc(n.title)}</h2>
				${n.body.map((p) => `<p>${esc(p)}</p>`).join('')}
				<button data-nav data-act="closenote" class="btn small">Close</button>
			</div>`);
	}

	keypadScreen(code: string, onSolve: () => void): void {
		this.keypad = { code, entry: '', onSolve };
		const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];
		this.open('keypad', `
			<div class="panel keypad">
				<div class="display">----</div>
				<div class="pad">${keys.map((k) => `<button data-nav data-act="key" data-k="${k}" class="btn ${k === 'OK' ? '' : 'alt'}">${k}</button>`).join('')}</div>
				<button data-nav data-act="close" class="btn small alt">Step back</button>
			</div>`);
		this.onNav = (d) => this.gridNav(d, 3);
	}

	/** Digits typed on the keyboard go to the keypad. */
	typeDigits(digits: string[]): void {
		for (const d of digits) this.keyPress(d);
	}

	submitKeypad(): void {
		this.keyPress('OK');
	}

	private keyPress(k: string): void {
		const kp = this.keypad;
		if (!kp) return;
		const display = this.layer.querySelector('.display')!;
		if (k === 'C') kp.entry = '';
		else if (k === 'OK') {
			if (kp.entry === kp.code) {
				this.a.sound('keyOk');
				const solve = kp.onSolve;
				this.keypad = null;
				solve();
				return;
			}
			this.a.keypadWrong();
			display.classList.remove('shake');
			void (display as HTMLElement).offsetWidth;
			display.classList.add('shake');
			kp.entry = '';
		} else if (kp.entry.length < kp.code.length) {
			kp.entry += k;
			this.a.sound('keyBeep');
		}
		display.textContent = kp.entry.padEnd(kp.code.length, '-');
	}

	dead(cause: string): void {
		this.open('dead', `
			<div class="dead">
				<h1>EXIT 1</h1>
				<p>${esc(cause)}</p>
				<nav class="menu">
					<button data-nav data-act="retry" class="btn">Retry from checkpoint</button>
					<button data-nav data-act="quit" class="btn alt">Quit to title</button>
				</nav>
			</div>`);
	}

	ending(stats: { time: number; notes: number; total: number }): void {
		const s = this.story;
		this.open('ending', `
			<div class="ending">
				<div class="lines"></div>
				<div class="after" hidden>
					<p class="stats"><span>Time ${fmtTime(stats.time)}</span><span>Notes ${stats.notes}/${stats.total}</span></p>
					<div class="teaser"><b>${esc(s.teaser.title)}</b><span>${esc(s.teaser.body)}</span></div>
					<nav class="menu">
						<button data-nav data-act="quit" class="btn">Back to title</button>
						<a data-nav class="btn link" href="../">&larr; Cosmic Arcade</a>
					</nav>
				</div>
			</div>`, false);
		const box = this.layer.querySelector('.lines')!;
		const after = this.layer.querySelector<HTMLElement>('.after')!;
		const el = document.createElement('p');
		box.append(el);
		const lines = s.ending;
		this.typing = {
			lines,
			i: 0,
			chars: 0,
			el,
			done: () => {
				box.innerHTML = lines.map((l) => `<p class="${l.startsWith('>') ? 'term' : ''}">${esc(l)}</p>`).join('');
				after.hidden = false;
				after.querySelector<HTMLElement>('[data-nav]')?.focus();
			},
		};
		this.layer.querySelector('.ending')!.addEventListener('click', () => this.typing && this.advanceTyping());
		this.onNav = (d) => {
			if (this.typing && (d === 'ok' || d === 'back')) {
				this.advanceTyping();
				return true;
			}
			return false;
		};
	}

	// --- events ---

	private act(act: string, el: HTMLElement): void {
		this.a.sound('ui');
		switch (act) {
			case 'continue':
				return this.a.continueGame();
			case 'new':
				return this.a.newGame();
			case 'resume':
				return this.a.resume();
			case 'settings':
				return this.settingsScreen(this.screen);
			case 'controls':
				return this.controls(this.screen);
			case 'quit':
				return this.a.quitToTitle();
			case 'retry':
				return this.a.retry();
			case 'skip':
				return this.finishTyping();
			case 'back':
				this.goBack();
				return;
			case 'close':
				return this.a.resume();
			case 'closenote':
				if (this.noteReturn === 'inventory') return this.a.readNote('');
				return this.a.resume();
			case 'item': {
				const it = this.items[el.dataset.id!];
				const d = this.layer.querySelector('.desc');
				if (d && it) d.textContent = it.desc;
				return;
			}
			case 'readnote':
				return this.a.readNote(el.dataset.id!);
			case 'key':
				return this.keyPress(el.dataset.k!);
			case 'toggle': {
				const id = el.dataset.set as keyof Settings;
				const s = this.settings as unknown as Record<string, unknown>;
				if (id === 'view') s.view = s.view === 'first' ? 'third' : 'first';
				else s[id] = !s[id];
				this.a.settingsChanged(this.settings);
				const keep = this.back.pop() ?? 'title';
				this.settingsScreen(keep);
				this.layer.querySelector<HTMLElement>(`[data-set="${id}"]`)?.focus();
				return;
			}
			case 'lines': {
				const order = [240, 360, 480] as const;
				this.settings.lines = order[(order.indexOf(this.settings.lines) + 1) % order.length];
				this.a.settingsChanged(this.settings);
				el.textContent = `${this.settings.lines}p`;
				return;
			}
		}
	}

	private onInput(el: HTMLInputElement): void {
		const id = el.dataset.set as keyof Settings | undefined;
		if (!id || el.type !== 'range') return;
		(this.settings as unknown as Record<string, number>)[id] = Number(el.value);
		const out = el.parentElement?.querySelector('output');
		if (out) out.innerHTML = id === 'fov' ? `${el.value}&deg;` : id === 'sensitivity' ? Number(el.value).toFixed(1) : `${Math.round(Number(el.value) * 100)}%`;
		this.a.settingsChanged(this.settings);
	}

	/** Esc or B: one step back. Returns true when the screen handled it. */
	goBack(): boolean {
		switch (this.screen) {
			case 'settings':
			case 'controls': {
				const to = this.back.pop() ?? 'title';
				if (to === 'pause') this.pause();
				else if (to === 'title') this.a.quitToTitle();
				return true;
			}
			case 'pause':
			case 'inventory':
			case 'keypad':
				this.a.resume();
				return true;
			case 'note':
				if (this.noteReturn === 'inventory') this.a.readNote('');
				else this.a.resume();
				return true;
			case 'intro':
				this.finishTyping();
				return true;
		}
		return false;
	}

	private gridNav(d: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back', cols: number): boolean {
		if (d === 'ok' || d === 'back') return false;
		const list = [...this.layer.querySelectorAll<HTMLElement>('.pad [data-nav]')];
		const i = list.indexOf(document.activeElement as HTMLElement);
		if (i < 0) {
			list[0]?.focus();
			return true;
		}
		const step = d === 'left' ? -1 : d === 'right' ? 1 : d === 'up' ? -cols : cols;
		const n = i + step;
		if (n >= 0 && n < list.length) list[n].focus();
		else if (d === 'down') this.layer.querySelector<HTMLElement>('[data-act="close"]')?.focus();
		return true;
	}

	/** Menu navigation with arrows and the gamepad. */
	nav(input: Input): void {
		if (this.screen === 'none') return;
		const dirs = ['up', 'down', 'left', 'right', 'ok', 'back'] as const;
		for (const d of dirs) {
			if (!input.pressed(d)) continue;
			if (this.onNav?.(d)) continue;
			const active = document.activeElement as HTMLElement | null;
			const list = [...this.layer.querySelectorAll<HTMLElement>('[data-nav]')];
			const i = active ? list.indexOf(active) : -1;
			if (d === 'up' || d === 'down') {
				if (this.keypad && i >= 0 && list[i].closest('.pad') === null && d === 'up') {
					list[list.length - 2]?.focus();
					continue;
				}
				const n = i < 0 ? 0 : (i + (d === 'down' ? 1 : -1) + list.length) % list.length;
				list[n]?.focus();
				this.a.sound('ui');
			} else if ((d === 'left' || d === 'right') && active instanceof HTMLInputElement && active.type === 'range') {
				const step = Number(active.step) || 0.1;
				active.value = String(Number(active.value) + (d === 'right' ? step : -step));
				this.onInput(active);
			} else if (d === 'ok' && input.device === 'pad') {
				active?.click();
			} else if (d === 'back' && input.device === 'pad') {
				this.goBack();
			}
		}
	}
}

export function fmtTime(sec: number): string {
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	return `${m}:${String(s).padStart(2, '0')}`;
}
