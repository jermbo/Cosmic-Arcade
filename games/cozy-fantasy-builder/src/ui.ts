/** The HTML side of the game: title, HUD, toolbar, toasts and the menu panels. */

import { COMBOS, GAME_NAME, GOALS, ISLANDS, PIECE, PIECES } from './content.ts';
import type { ComboDef, GoalDef, PieceId } from './content.ts';
import { goalProgress, nextGoal, S, saveSettings } from './state.ts';
import type { Quality } from './state.ts';

export type Panel = 'pause' | 'settings' | 'book' | 'goals' | 'help' | 'tutorial' | 'confirm';
export type Tool = PieceId | 'erase' | null;

export const ui = {
	screen: 'title' as 'title' | 'play',
	panel: null as Panel | null,
	tool: null as Tool,
	icons: {} as Record<string, string>,
	/** Pieces that were just unlocked and not picked yet. */
	fresh: new Set<PieceId>(),
};

/** What the shell does when the player uses the UI. */
export const uiActions = {
	play: () => {},
	newGame: () => {},
	toTitle: () => {},
	pickTool: (_tool: Tool) => {},
	undo: () => {},
	redo: () => {},
	rotate: () => {},
	settingsChanged: () => {},
	click: () => {},
	/** Called when a panel opens or closes. */
	panelChanged: () => {},
	tutorialDone: () => {},
};

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const el = {
	hud: $('hud'),
	dock: $('dock'),
	pieces: $('pieces'),
	hint: $('hint'),
	title: $('title'),
	modal: $('modal'),
	sheet: document.querySelector<HTMLElement>('.sheet')!,
	modalTitle: $('modal-title'),
	modalBody: $('modal-body'),
	toasts: $('toasts'),
	banner: $('banner'),
	goal: $<HTMLButtonElement>('btn-goal'),
	goalText: $('goal-text'),
	goalCount: $('goal-count'),
	bookCount: $('book-count'),
	undo: $<HTMLButtonElement>('btn-undo'),
	redo: $<HTMLButtonElement>('btn-redo'),
	rotate: $<HTMLButtonElement>('btn-rotate'),
	erase: $<HTMLButtonElement>('btn-erase'),
	play: $<HTMLButtonElement>('btn-play'),
	newGame: $<HTMLButtonElement>('btn-new'),
	arcade: $('arcade-link'),
};

/** The panel to go back to when a panel that was opened from it closes. */
let parent: Panel | null = null;
let tutorialStep = 0;
let bannerTimer = 0;

const isTouch = (): boolean => matchMedia('(pointer: coarse)').matches;
const inArcade = /\/play\/?$/.test(location.pathname);

/* Screens */

export function showTitle(): void {
	ui.screen = 'title';
	ui.panel = null;
	el.modal.hidden = true;
	el.title.hidden = false;
	el.hud.hidden = el.dock.hidden = true;
	el.play.textContent = S.hasSave ? 'Continue' : 'Play';
	el.newGame.hidden = !S.hasSave;
	el.arcade.hidden = !inArcade;
	uiActions.panelChanged();
	el.play.focus({ preventScroll: true });
}

export function showGame(): void {
	ui.screen = 'play';
	el.title.hidden = true;
	el.hud.hidden = el.dock.hidden = false;
	renderPieces();
	updateHud();
	uiActions.panelChanged();
}

/* Toolbar */

/** The unlocked pieces, in toolbar order. Number keys pick from this list. */
export const slots = (): PieceId[] => PIECES.filter((p) => S.unlocked.has(p.id)).map((p) => p.id);

export function renderPieces(): void {
	const open = slots();
	const locked = PIECES.filter((p) => !S.unlocked.has(p.id));
	el.pieces.replaceChildren(
		...open.map((id, i) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'piece' + (ui.fresh.has(id) ? ' piece--new' : '');
			b.dataset.piece = id;
			b.setAttribute('aria-label', PIECE[id].name);
			b.setAttribute('aria-pressed', String(ui.tool === id));
			b.innerHTML = `<img src="${ui.icons[id]}" alt="" />${i < 10 ? `<span class="piece__key">${(i + 1) % 10}</span>` : ''}`;
			return b;
		}),
		...locked.map((p) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'piece piece--locked';
			b.dataset.locked = p.id;
			b.setAttribute('aria-label', `${p.name} (locked)`);
			b.innerHTML = `<img src="${ui.icons[p.id]}" alt="" />`;
			return b;
		}),
	);
}

export function setTool(tool: Tool): void {
	ui.tool = tool;
	if (tool && tool !== 'erase') ui.fresh.delete(tool);
	for (const b of el.pieces.querySelectorAll<HTMLButtonElement>('.piece')) {
		const on = b.dataset.piece === tool;
		b.setAttribute('aria-pressed', String(on));
		if (on) {
			b.classList.remove('piece--new');
			b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
		}
	}
	el.erase.setAttribute('aria-pressed', String(tool === 'erase'));
	if (tool === 'erase') setHint('<b>Remove</b> Tap a piece to take it away.');
	else if (tool) setHint(`<b>${PIECE[tool].name}</b> ${PIECE[tool].blurb}`);
	else setHint('Pick a piece to build.');
}

export function setHint(html: string): void {
	el.hint.innerHTML = html;
}

function rewardText(g: GoalDef): string {
	if ('piece' in g.reward) return `New piece: ${PIECE[g.reward.piece].name}`;
	if ('island' in g.reward) return 'A new sky island';
	return g.reward.gift;
}

export function updateHud(): void {
	const g = nextGoal();
	if (g) {
		el.goalText.textContent = g.text;
		el.goalCount.textContent = g.n > 1 ? `${goalProgress(g)}/${g.n}` : '';
	} else {
		el.goalText.textContent = 'All goals done. Enjoy your isles!';
		el.goalCount.textContent = '';
	}
	el.bookCount.textContent = `${S.combos.size}`;
	el.undo.disabled = S.undo.length === 0;
	el.redo.disabled = S.redo.length === 0;
}

export function popGoal(): void {
	el.goal.classList.remove('goal--pop');
	void el.goal.offsetWidth;
	el.goal.classList.add('goal--pop');
}

/* Toasts */

let lastToast = '';
let lastToastAt = 0;

export function toast(text: string, sub = '', kind: 'plain' | 'goal' | 'soft' = 'plain'): void {
	const now = performance.now();
	if (text === lastToast && now - lastToastAt < 1800) return;
	lastToast = text;
	lastToastAt = now;
	const t = document.createElement('div');
	t.className = `toast toast--${kind}`;
	t.textContent = text;
	if (sub) {
		const s = document.createElement('small');
		s.textContent = sub;
		t.append(s);
	}
	el.toasts.append(t);
	while (el.toasts.children.length > 3) el.toasts.firstElementChild!.remove();
	const life = kind === 'soft' ? 1800 : kind === 'goal' ? 5200 : 3200;
	window.setTimeout(() => t.classList.add('toast--out'), life);
	window.setTimeout(() => t.remove(), life + 450);
}

export function goalToast(g: GoalDef): void {
	toast(`Goal done: ${g.text}`, rewardText(g), 'goal');
}

export function comboBanner(c: ComboDef): void {
	el.banner.innerHTML = `<p class="banner__kicker">Magic link found</p><p class="banner__name">${c.name}</p><p class="banner__text">${c.text}</p>`;
	el.banner.hidden = false;
	// Start the pop again when a second banner follows the first.
	el.banner.style.animation = 'none';
	void el.banner.offsetWidth;
	el.banner.style.animation = '';
	window.clearTimeout(bannerTimer);
	bannerTimer = window.setTimeout(() => (el.banner.hidden = true), 4200);
}

/* Panels */

function controlsHtml(kind: 'touch' | 'mouse' | 'pad'): string {
	const rows: Record<typeof kind, [string, string][]> = {
		touch: [
			['Tap', 'Place a piece'],
			['Drag', 'Move the view'],
			['Pinch', 'Zoom'],
			['Twist', 'Turn the view with two fingers'],
			['Turn button', 'Turn the piece you just placed'],
			['Bin button', 'Then tap a piece to remove it'],
			['Back', 'Pause. It never leaves the game'],
		],
		mouse: [
			['Click', 'Place a piece'],
			['Drag', 'Move the view'],
			['Scroll', 'Zoom'],
			['Right-drag', 'Turn the view'],
			['R', 'Turn a piece'],
			['X', 'Remove the piece under the cursor'],
			['Ctrl+Z / Ctrl+Y', 'Undo and redo'],
			['Arrows / WASD', 'Move a cursor, Enter to place'],
			['1–9, [ ]', 'Pick a piece'],
			['Q / E, + / −', 'Turn and zoom with keys'],
			['B, G, Esc', 'Book, goals, pause'],
		],
		pad: [
			['Left stick', 'Move the cursor'],
			['A', 'Place a piece'],
			['B', 'Remove a piece'],
			['X', 'Turn a piece'],
			['LB / RB', 'Pick a piece'],
			['Right stick', 'Turn and zoom the view'],
			['LT / RT', 'Undo and redo'],
			['Y, Start', 'Book, pause'],
		],
	};
	return `<dl class="keys">${rows[kind].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

function allControlsHtml(): string {
	const first = isTouch() ? 'touch' : 'mouse';
	const names = { touch: 'Touch', mouse: 'Mouse and keyboard', pad: 'Gamepad' } as const;
	const others = (['touch', 'mouse', 'pad'] as const).filter((k) => k !== first);
	return `<h3>${names[first]}</h3>${controlsHtml(first)}${others.map((k) => `<details><summary>${names[k]}</summary>${controlsHtml(k)}</details>`).join('')}`;
}

const TUTORIAL: { title: string; html: () => string }[] = [
	{
		title: `Welcome to ${GAME_NAME}`,
		html: () => `<p>These little islands float high above the clouds. Make them a home.</p><p>There is no score and no timer. Build what feels nice, and come back any time. Your islands save by themselves.</p>`,
	},
	{ title: 'How to build', html: () => `<p>Pick a piece at the bottom of the screen. Then:</p>${allControlsHtml()}` },
	{
		title: 'Watch it come alive',
		html: () =>
			`<p><b>Pieces join up.</b> Paths connect, cottages share roofs, and ponds flow together.</p><p><b>Life moves in.</b> Villagers come to live in cottages. Grass grows near water. Saplings grow into trees.</p><p><b>Magic links.</b> Some pieces spark when they stand side by side. The book keeps what you find.</p><p><b>Goals</b> unlock new pieces and new sky islands.</p>`,
	},
];

function panelHtml(p: Panel): { title: string; html: string; wide?: boolean } {
	switch (p) {
		case 'pause':
			return {
				title: 'Paused',
				html: `<div class="stack">
					<button class="btn btn--big" data-act="resume" type="button">Back to the isles</button>
					<div class="row">
						<button class="btn" data-open="goals" type="button">Goals</button>
						<button class="btn" data-open="book" type="button">Book</button>
					</div>
					<div class="row">
						<button class="btn" data-open="settings" type="button">Settings</button>
						<button class="btn" data-open="help" type="button">How to play</button>
					</div>
					<button class="btn btn--ghost" data-act="title" type="button">Title screen</button>
					${inArcade ? '<a class="btn btn--ghost" href="../">Back to the arcade</a>' : ''}
				</div>`,
			};
		case 'settings': {
			const q = (id: Quality, name: string): string => `<button type="button" data-quality="${id}" aria-pressed="${S.settings.quality === id}">${name}</button>`;
			return {
				title: 'Settings',
				html: `<div class="stack">
					<label class="field"><span>Music</span><input type="range" id="set-music" min="0" max="100" step="5" value="${Math.round(S.settings.music * 100)}" /></label>
					<label class="field"><span>Sounds</span><input type="range" id="set-sound" min="0" max="100" step="5" value="${Math.round(S.settings.sound * 100)}" /></label>
					<div class="field"><span id="quality-label">Quality</span><div class="choices" role="group" aria-labelledby="quality-label">${q('low', 'Low')}${q('medium', 'Medium')}${q('high', 'High')}</div></div>
					<p><small>Low quality turns shadows off. Try it if the game feels slow.</small></p>
					<button class="btn" data-act="close" type="button">Done</button>
				</div>`,
			};
		}
		case 'goals':
			return {
				title: 'Goals',
				html: `<ul class="list">${GOALS.map((g) => {
					const done = S.goals.has(g.id);
					return `<li class="entry${done ? ' entry--done' : ''}"><span class="entry__mark">${done ? '✓' : ''}</span><span><b>${g.text}</b><small>${rewardText(g)}</small></span><span class="entry__side">${done ? 'Done' : `${goalProgress(g)}/${g.n}`}</span></li>`;
				}).join('')}</ul>`,
			};
		case 'book':
			return {
				title: `Book of magic links  ${S.combos.size}/${COMBOS.length}`,
				html: `<p>Put the right two pieces side by side to wake a magic link.</p><ul class="list">${COMBOS.map((c) => {
					const found = S.combos.has(c.id);
					if (!found) return `<li class="entry"><span class="entry__mark">?</span><span><b>Not found yet</b><small>${c.hint}</small></span><span></span></li>`;
					return `<li class="entry entry--magic"><span class="entry__mark">✦</span><span><b>${c.name}</b><small>${c.text}</small></span><span class="pair"><img src="${ui.icons[c.a]}" alt="${PIECE[c.a].name}" />+<img src="${ui.icons[c.b]}" alt="${PIECE[c.b].name}" /></span></li>`;
				}).join('')}</ul>`,
			};
		case 'help':
			return { title: 'How to play', html: `${TUTORIAL[2].html()}<h3>Controls</h3>${allControlsHtml()}`, wide: false };
		case 'tutorial': {
			const step = TUTORIAL[tutorialStep];
			const last = tutorialStep === TUTORIAL.length - 1;
			return {
				title: step.title,
				html: `${step.html()}<div class="steps">${TUTORIAL.map((_, i) => `<i class="${i === tutorialStep ? 'on' : ''}"></i>`).join('')}</div>
					<div class="row">${tutorialStep > 0 ? '<button class="btn btn--ghost" data-act="tut-back" type="button">Back</button>' : ''}<button class="btn btn--big" data-act="tut-next" type="button">${last ? 'Start building' : 'Next'}</button></div>`,
			};
		}
		case 'confirm':
			return {
				title: 'Start new islands?',
				html: `<p>Your islands, goals and book will be cleared. This cannot be undone.</p><div class="row"><button class="btn" data-act="close" type="button">Keep my islands</button><button class="btn btn--danger" data-act="wipe" type="button">Start new</button></div>`,
			};
	}
}

export function openPanel(p: Panel, from: Panel | null = null): void {
	if (p === 'tutorial' && ui.panel !== 'tutorial') tutorialStep = 0;
	parent = from;
	ui.panel = p;
	const { title, html } = panelHtml(p);
	el.modalTitle.textContent = title;
	el.modalBody.innerHTML = html;
	el.modalBody.scrollTop = 0;
	el.modal.hidden = false;
	const first = el.modalBody.querySelector<HTMLElement>('.btn--big, button, input, a');
	(first ?? $('modal-close')).focus({ preventScroll: true });
	uiActions.panelChanged();
}

export function closePanel(): void {
	if (ui.panel === 'tutorial') uiActions.tutorialDone();
	const back = parent;
	parent = null;
	if (back) {
		openPanel(back);
		return;
	}
	ui.panel = null;
	el.modal.hidden = true;
	uiActions.panelChanged();
	if (ui.screen === 'title') el.play.focus({ preventScroll: true });
}

/** The back gesture, Escape or B: one step back, and never out of the game. */
export function goBack(): void {
	if (ui.panel) closePanel();
	else if (ui.screen === 'play') openPanel('pause');
}

/* Focus, for the gamepad */

function focusables(): HTMLElement[] {
	const root = ui.panel ? el.modal : ui.screen === 'title' ? el.title : document.body;
	return [...root.querySelectorAll<HTMLElement>('button, a[href], input, summary')].filter((e) => !e.hidden && e.offsetParent !== null && !(e as HTMLButtonElement).disabled);
}

export function moveFocus(step: number): void {
	const list = focusables();
	if (!list.length) return;
	const i = list.indexOf(document.activeElement as HTMLElement);
	list[(i + step + list.length) % list.length].focus();
}

export function adjustFocus(step: number): void {
	const a = document.activeElement;
	if (a instanceof HTMLInputElement && a.type === 'range') {
		if (step > 0) a.stepUp();
		else a.stepDown();
		a.dispatchEvent(new Event('input', { bubbles: true }));
	} else moveFocus(step);
}

export function pressFocus(): void {
	(document.activeElement as HTMLElement | null)?.click();
}

/* Wiring */

export function initUI(): void {
	document.title = GAME_NAME;

	el.play.addEventListener('click', () => uiActions.play());
	el.newGame.addEventListener('click', () => openPanel('confirm'));
	$('btn-title-settings').addEventListener('click', () => openPanel('settings'));
	$('btn-pause').addEventListener('click', () => openPanel('pause'));
	$('btn-book').addEventListener('click', () => openPanel('book'));
	el.goal.addEventListener('click', () => openPanel('goals'));
	$('modal-close').addEventListener('click', closePanel);
	el.undo.addEventListener('click', () => uiActions.undo());
	el.redo.addEventListener('click', () => uiActions.redo());
	el.rotate.addEventListener('click', () => uiActions.rotate());
	el.erase.addEventListener('click', () => uiActions.pickTool(ui.tool === 'erase' ? null : 'erase'));

	el.pieces.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLElement>('.piece');
		if (!b) return;
		if (b.dataset.locked) {
			const id = b.dataset.locked as PieceId;
			const g = GOALS.find((goal) => 'piece' in goal.reward && goal.reward.piece === id);
			toast(`${PIECE[id].name} is locked`, g ? `Goal: ${g.text}` : '', 'plain');
			return;
		}
		const id = b.dataset.piece as PieceId;
		uiActions.pickTool(ui.tool === id ? null : id);
	});
	// A mouse wheel over the toolbar scrolls it sideways.
	el.pieces.addEventListener('wheel', (e) => {
		if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.pieces.scrollLeft += e.deltaY;
	}, { passive: true });

	el.modal.addEventListener('click', (e) => {
		const t = e.target as HTMLElement;
		if (t === el.modal && ui.panel !== 'tutorial' && ui.panel !== 'confirm') {
			closePanel();
			return;
		}
		const b = t.closest<HTMLElement>('[data-act], [data-open], [data-quality]');
		if (!b) return;
		uiActions.click();
		if (b.dataset.open) openPanel(b.dataset.open as Panel, ui.panel);
		else if (b.dataset.quality) {
			S.settings.quality = b.dataset.quality as Quality;
			saveSettings();
			uiActions.settingsChanged();
			for (const o of el.modalBody.querySelectorAll<HTMLElement>('[data-quality]')) o.setAttribute('aria-pressed', String(o === b));
		} else if (b.dataset.act === 'resume' || b.dataset.act === 'close') closePanel();
		else if (b.dataset.act === 'title') uiActions.toTitle();
		else if (b.dataset.act === 'wipe') uiActions.newGame();
		else if (b.dataset.act === 'tut-back') {
			tutorialStep--;
			openPanel('tutorial');
		} else if (b.dataset.act === 'tut-next') {
			if (tutorialStep < TUTORIAL.length - 1) {
				tutorialStep++;
				openPanel('tutorial');
			} else closePanel();
		}
	});

	el.modal.addEventListener('input', (e) => {
		const t = e.target as HTMLInputElement;
		if (t.id === 'set-music') S.settings.music = Number(t.value) / 100;
		else if (t.id === 'set-sound') S.settings.sound = Number(t.value) / 100;
		else return;
		saveSettings();
		uiActions.settingsChanged();
	});
}

/** The name of the island that just appeared, for a toast. */
export const islandName = (index: number): string => ISLANDS[index].name;
