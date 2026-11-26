// The shop: four tabs (themes, tile styles, sounds, motion). Buy once, then pick.
import { previewPack, sfx } from '../audio.ts';
import { CURRENCY } from '../core/economy.ts';
import { SECTIONS, type Category, type ShopItem } from '../shop/catalog.ts';
import { buy, coins, inUse, onCoins, owns, use } from '../shop/wallet.ts';
import { h, icon } from './dom.ts';
import { confetti, pulse, toast } from './fx.ts';
import { openModal } from './modal.ts';

let lastTab: Category = 'theme';

export function coinIcon(): HTMLElement {
	return icon('coin', 'coin');
}

function preview(cat: Category, item: ShopItem): HTMLElement {
	const tiles = (letters: string) => h('div', { class: 'preview__row' }, ...[...letters].map((ch, i) => h('span', { class: `tile${i === 1 ? ' tile--on' : ''}` }, ch)));
	if (cat === 'theme') {
		return h(
			'div',
			{ class: 'preview', 'data-theme': item.id, 'aria-hidden': 'true' },
			h('div', { class: 'preview__row' }, ...[1, 2, 3, 4].map((l) => h('span', { class: 'preview__swatch', style: { background: `var(--l${l})` } })), h('span', { class: 'tile preview__go' }, '✓')),
		);
	}
	if (cat === 'tiles') return h('div', { class: 'preview', 'data-tiles': item.id, 'aria-hidden': 'true' }, tiles('KIN'));
	if (cat === 'sound') {
		const b = h('button', { class: 'preview preview--sound', type: 'button', 'aria-label': `Play ${item.name}` }, icon('play'));
		b.addEventListener('click', () => {
			pulse(b, 'tile--nudge');
			void previewPack(item.id);
		});
		return b;
	}
	// Motion: tap to see the tiles hop in that style.
	const box = h('button', { class: 'preview', type: 'button', 'data-motion': item.id, 'aria-label': `Try ${item.name}`, ...motionVars(item.id) }, tiles('HOP'));
	box.addEventListener('click', () => {
		[...box.querySelectorAll('.tile')].forEach((t, i) => {
			(t as HTMLElement).style.setProperty('--d', `${i * 70}ms`);
			pulse(t, 'tile--hop');
		});
		sfx.hop(1);
	});
	return box;
}

function motionVars(id: string): Record<string, string> {
	// The preview box carries its own spring, so it moves in that style even before you buy it.
	const feel: Record<string, [string, string]> = {
		bouncy: ['1', 'cubic-bezier(0.3, 1.5, 0.5, 1)'],
		snappy: ['0.7', 'cubic-bezier(0.2, 1.15, 0.4, 1)'],
		floaty: ['1.4', 'cubic-bezier(0.25, 1.25, 0.4, 1)'],
		jelly: ['1.1', 'cubic-bezier(0.3, 2, 0.45, 1)'],
	};
	const [t, spring] = feel[id] ?? feel.bouncy;
	return { '--t': t, '--spring': spring } as Record<string, string>;
}

export function openShop(): void {
	const wallet = h('span', { class: 'wallet', 'aria-live': 'polite' }, coinIcon(), h('span', {}, String(coins())));
	const list = h('div', { class: 'shop__list' });
	const tabs = SECTIONS.map((s) =>
		h('button', { class: 'shop__tab', type: 'button', role: 'tab', 'aria-selected': String(s.id === lastTab), on: { click: () => show(s.id) } }, s.title === 'Tile styles' ? 'Tiles' : s.title),
	);

	function show(cat: Category) {
		lastTab = cat;
		tabs.forEach((t, i) => t.setAttribute('aria-selected', String(SECTIONS[i].id === cat)));
		const section = SECTIONS.find((s) => s.id === cat)!;
		list.replaceChildren(...section.items.map((item) => row(cat, item)));
	}

	function row(cat: Category, item: ShopItem): HTMLElement {
		const have = owns(cat, item.id);
		const on = inUse(cat) === item.id;
		let btn: HTMLButtonElement;
		if (on) btn = h('button', { class: 'btn btn--done', type: 'button', disabled: true }, 'In use');
		else if (have) btn = h('button', { class: 'btn btn--ghost', type: 'button', on: { click: () => pick() } }, 'Use');
		else btn = h('button', { class: `btn btn--go${item.price > coins() ? ' btn--short' : ''}`, type: 'button', on: { click: () => purchase() } }, h('span', { class: 'item__price' }, coinIcon(), String(item.price)));

		const el = h(
			'div',
			{ class: `item${on ? ' item--on' : ''}` },
			preview(cat, item),
			h('div', { class: 'item__text' }, h('strong', {}, item.name), h('small', {}, item.blurb)),
			btn,
		);

		function pick() {
			use(cat, item.id);
			sfx.select(3);
			show(cat);
		}

		function purchase() {
			if (!buy(cat, item)) {
				sfx.invalid();
				pulse(btn, 'tile--nope');
				toast(`You need ${item.price - coins()} more ${CURRENCY.name.toLowerCase()}`);
				return;
			}
			sfx.unlock();
			const r = btn.getBoundingClientRect();
			confetti(r.left + r.width / 2, r.top + r.height / 2, 20);
			toast(`${item.name} is yours!`);
			show(cat);
		}
		return el;
	}

	const stop = onCoins(() => {
		wallet.lastElementChild!.textContent = String(coins());
		pulse(wallet, 'pop-again');
	});

	openModal({
		title: 'Shop',
		cls: 'modal__card--shop',
		body: [
			h('div', { class: 'shop__top' }, wallet, h('small', { class: 'muted' }, ' Earn more by playing.')),
			h('div', { class: 'shop__tabs', role: 'tablist' }, ...tabs),
			list,
		],
		onClose: stop,
	});
	show(lastTab);
}
