import type { ModeId } from '../core/types.ts';
import { settings, updateSettings } from '../store/settings.ts';
import { THEMES } from '../themes/themes.ts';

export interface DialogHandle {
	el: HTMLDialogElement;
	close(): void;
}

interface DialogOptions {
	title: string;
	body: string;
	className?: string;
	/** Escape and the backdrop close it. */
	dismissable?: boolean;
	onClose?: () => void;
}

/** A modal on the native <dialog>: it traps focus and stacks. */
export function openDialog(opts: DialogOptions): DialogHandle {
	const el = document.createElement('dialog');
	el.className = `dialog ${opts.className ?? ''}`;
	el.innerHTML = `<div class="dialog__panel"><h2 class="dialog__title">${opts.title}</h2>${opts.body}</div>`;
	document.body.append(el);
	let closed = false;
	const close = () => {
		if (closed) return;
		closed = true;
		el.close();
		el.remove();
		opts.onClose?.();
	};
	el.addEventListener('cancel', (e) => {
		e.preventDefault();
		if (opts.dismissable !== false) close();
	});
	el.addEventListener('click', (e) => {
		if (e.target === el && opts.dismissable !== false) close();
	});
	el.showModal();
	const auto = el.querySelector<HTMLElement>('[autofocus]');
	auto?.focus();
	return { el, close };
}

export function dialogOpen(): boolean {
	return Boolean(document.querySelector('dialog[open]'));
}

export function choice<T extends string | number>(name: string, legend: string, options: [T, string][], value: T): string {
	return `<fieldset class="seg"><legend>${legend}</legend>${options
		.map(
			([v, label]) =>
				`<label class="seg__opt"><input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''}><span>${label}</span></label>`,
		)
		.join('')}</fieldset>`;
}

export function picked(root: HTMLElement, name: string): string | null {
	return root.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? null;
}

// ---------- How to play ----------

const HOW: Record<ModeId, { goal: string; rules: string[] }> = {
	klondike: {
		goal: 'Move all 52 cards to the four foundations, Ace up to King, one suit each.',
		rules: [
			'In the columns, build down in alternating colors: a red 6 on a black 7.',
			'Move any face-up run as one. A face-down card turns up when it is free.',
			'Only a King (or a run that starts with one) goes into an empty column.',
			'Tap the stock to draw 1 or 3 cards. Tap the empty stock to turn the waste over. No limit.',
		],
	},
	spider: {
		goal: 'Build eight runs from King down to Ace, each in one suit. A full run goes to a foundation.',
		rules: [
			'Any card goes on a card one rank higher, of any suit.',
			'Only a run of one suit moves as a group. Mixed runs move one card at a time.',
			'Any card or run goes into an empty column.',
			'Tap the stock to deal one card to every column. Every column must have a card first.',
			'Move a finished King-to-Ace run to a foundation: tap its King twice, or drag it.',
		],
	},
	freecell: {
		goal: 'Move all 52 cards to the four foundations, Ace up to King, one suit each.',
		rules: [
			'All cards are face up. Build down in alternating colors in the columns.',
			'Each of the four free cells holds one card.',
			'Any card goes into an empty column.',
			'You can move a run as large as your free cells and empty columns allow.',
			'Nearly every deal can be won. Deal #11982 is not in the pool.',
		],
	},
};

const CONTROLS = `
<ul class="how__list how__list--controls">
	<li><b>Drag</b> a card or run to move it. Or <b>tap</b> it, then tap where it goes.</li>
	<li>Tap a picked card <b>again</b> (or double-click) to send it to a foundation.</li>
	<li>When every card can go home, <b>Finish</b> plays the game out. Auto-move is in Settings.</li>
	<li><kbd>Tab</kbd> and the <kbd>arrows</kbd> move between piles. <kbd>↑</kbd> <kbd>↓</kbd> pick how much of a run to take.</li>
	<li><kbd>Enter</kbd> or <kbd>Space</kbd> picks up and puts down. <kbd>Esc</kbd> puts back.</li>
	<li><kbd>U</kbd> undo · <kbd>H</kbd> hint · <kbd>N</kbd> new deal · <kbd>P</kbd> pause · <kbd>F</kbd> finish</li>
</ul>`;

export function howToPlay(mode: ModeId, onClose?: () => void): DialogHandle {
	const tab = (m: ModeId) => {
		const h = HOW[m];
		return `<div class="how__pane" data-pane="${m}" ${m === mode ? '' : 'hidden'}>
			<p class="how__goal">${h.goal}</p>
			<ul class="how__list">${h.rules.map((r) => `<li>${r}</li>`).join('')}</ul>
		</div>`;
	};
	const d = openDialog({
		title: 'How to play',
		className: 'dialog--how',
		onClose,
		body: `
			${choice('how-mode', 'Game', [['klondike', 'Klondike'], ['spider', 'Spider'], ['freecell', 'FreeCell']], mode)}
			${tab('klondike')}${tab('spider')}${tab('freecell')}
			<h3 class="dialog__sub">Controls</h3>
			${CONTROLS}
			<p class="dialog__note">Hints are fine to use. A win with a hint counts, but only hint-free wins set a best.</p>
			<div class="dialog__actions"><button class="btn btn--primary" data-close autofocus>Got it</button></div>`,
	});
	d.el.addEventListener('change', () => {
		const m = picked(d.el, 'how-mode');
		d.el.querySelectorAll<HTMLElement>('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== m));
	});
	d.el.querySelector('[data-close]')!.addEventListener('click', d.close);
	return d;
}

// ---------- Settings ----------

const toggle = (key: string, label: string, on: boolean, note = '') =>
	`<label class="toggle"><span class="toggle__text">${label}${note ? `<small>${note}</small>` : ''}</span><input type="checkbox" role="switch" data-key="${key}" ${on ? 'checked' : ''}><span class="toggle__track" aria-hidden="true"></span></label>`;

export function openSettings(onClose?: () => void): DialogHandle {
	const d = openDialog({
		title: 'Settings',
		className: 'dialog--settings',
		onClose,
		body: `
			<div class="settings">
				<section class="settings__group">
					${toggle('sound', 'Sound', settings.sound)}
					${toggle('showStats', 'Timer and moves', settings.showStats)}
					${toggle('hints', 'Hint button', settings.hints, 'Wins with hints count, but set no best.')}
				</section>
				<section class="settings__group">
					<h3 class="dialog__sub">Accessibility</h3>
					${toggle('autoMove', 'Auto-move to foundations', settings.autoMove, 'Safe cards go up by themselves, and a solved game plays out.')}
					${toggle('fourColor', 'Four-color suits', settings.fourColor, 'Clubs green, diamonds blue.')}
					${toggle('reduceMotion', 'Reduce motion', settings.reduceMotion, 'Cards move without springs or effects.')}
				</section>
				<section class="settings__group">
					<fieldset class="themes"><legend>Table</legend>
						${THEMES.map(
							(t) => `<label class="theme-opt"><input type="radio" name="theme" value="${t.id}" ${t.id === settings.theme ? 'checked' : ''}>
							<span class="theme-opt__swatch" style="--sw-felt:${t.swatch[0]};--sw-back:${t.swatch[1]}"></span><span>${t.name}</span></label>`,
						).join('')}
					</fieldset>
				</section>
			</div>
			<p class="credits">Cards: <b>Pixel Plebes</b> by Devlyn JD. Card sounds: <b>Kenney</b> (CC0).</p>
			<div class="dialog__actions"><button class="btn btn--primary" data-close autofocus>Done</button></div>`,
	});
	d.el.addEventListener('change', (e) => {
		const input = e.target as HTMLInputElement;
		const key = input.dataset.key;
		if (key) {
			updateSettings({ [key]: input.checked });
		} else if (input.name === 'theme') {
			updateSettings({ theme: input.value });
		}
	});
	d.el.querySelector('[data-close]')!.addEventListener('click', d.close);
	return d;
}

