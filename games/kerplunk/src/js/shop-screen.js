// The shop: themes, block styles, and the power-up bag upgrade.

import { BAG_UPGRADE_COSTS } from './prices.js';
import { BAG_SIZE } from './engine.js';
import { THEMES, STYLES, BAG_MAX_UPGRADES } from './shop.js';
import { LIGHT, DARK, RANDOM_BACKGROUNDS } from './themes.js';
import { canAfford, buyLook } from './wallet.js';
import { blockStrip } from './sprites.js';
import { audio } from './audio.js';
import { store } from './storage.js';
import { $, showModal } from './dom.js';
import { save } from './session.js';
import { bumpWallet, onWalletUpdate } from './hud.js';
import { applyLooks, activeTheme, rollForGame } from './looks.js';

export function openShop() {
	renderShop();
	showModal('screen-shop');
}

onWalletUpdate(() => {
	if (!$('screen-shop').hidden) renderShop();
});

function renderShop() {
	$('shop-wallet').textContent = `✦ ${store.glints.toLocaleString()} Plunks`;
	const body = $('shop-body');
	body.textContent = '';
	body.append(makeElement('h3', 'shop__section', 'Themes'));
	for (const theme of THEMES) body.append(lookItem(theme, 'themes', 'theme', themePreview(theme)));
	body.append(makeElement('h3', 'shop__section', 'Block styles'));
	for (const style of STYLES) body.append(lookItem(style, 'styles', 'style', blockStrip({ style: style.id, theme: activeTheme(), size: 22 })));
	body.append(makeElement('h3', 'shop__section', 'Upgrades'));
	body.append(bagItem());
}

/**
 * One theme or block style: its preview, its price or "Owned", and Buy, Use or In use.
 * listKey is the owned list in the save ('themes' or 'styles'); activeKey is the one in use ('theme' or 'style').
 */
function lookItem(item, listKey, activeKey, preview) {
	const owned = store.looks[listKey].includes(item.id);
	const active = store.looks[activeKey] === item.id;
	const el = makeElement('div', `shop__item${active ? ' is-on' : ''}`);
	const head = makeElement('div', 'shop__head');
	head.append(makeElement('h4', 'shop__title', item.name), makeElement('span', 'shop__price', owned ? 'Owned' : `✦${item.price}`));
	el.append(head, makeElement('div', 'shop__preview', ''), makeElement('p', 'shop__text', item.text));
	el.querySelector('.shop__preview').append(preview);
	// Random in use: each tap rolls a new look, free, as often as the player likes.
	if (active && item.id === 'random') el.append(shopButton('New look', true, newRandomLook));
	else if (active) el.append(stateButton('In use'));
	else if (owned) el.append(shopButton('Use', true, () => useLook(activeKey, item.id)));
	else el.append(shopButton(`Buy ✦${item.price}`, canAfford(store.glints, item.price), () => buy(item, listKey)));
	return el;
}

function buy(item, listKey) {
	const result = buyLook(store.glints, store.looks[listKey], item);
	if (!result) return audio.deny();
	store.glints = result.glints;
	store.looks[listKey] = result.owned;
	save();
	bumpWallet();
	renderShop();
}

/** "Use" makes the look active at once, on every screen. */
function useLook(activeKey, id) {
	store.looks[activeKey] = id;
	save();
	if (activeKey === 'theme' && id === 'random') rollForGame();
	else applyLooks();
	renderShop();
}

function newRandomLook() {
	rollForGame();
	renderShop();
}

/** A small picture of a theme: its paper and its cards. Random in use shows its current roll. */
function themePreview(item) {
	const el = makeElement('div', 'theme-preview');
	const rolled = item.id === 'random' && store.looks.theme === 'random';
	if (item.id === 'random' && !rolled) {
		el.classList.add('theme-preview--random');
		el.style.background = `linear-gradient(90deg, ${RANDOM_BACKGROUNDS.slice(0, 5).join(', ')})`;
		el.append(makeElement('span', 'theme-preview__mark', '?'));
		return el;
	}
	const t = rolled ? activeTheme() : item.id === 'dark' ? DARK : LIGHT;
	el.style.backgroundColor = t.bg;
	el.style.backgroundImage = `radial-gradient(${t.dot} 1.2px, transparent 1.4px)`;
	el.style.borderColor = t.ink;
	for (const color of rolled ? [t.accent, t.accent2, ...t.blocks.slice(0, 2)] : [t.accent, t.accent2, t.card]) {
		const card = makeElement('i', 'theme-preview__card');
		card.style.background = color;
		card.style.borderColor = t.ink;
		card.style.boxShadow = `2px 2px 0 ${t.shadow}`;
		el.append(card);
	}
	return el;
}

function bagItem() {
	const level = store.perks.bag;
	const item = makeElement('div', 'shop__item');
	const head = makeElement('div', 'shop__head');
	const done = level >= BAG_MAX_UPGRADES;
	head.append(makeElement('h4', 'shop__title', 'Power-up bag'), makeElement('span', 'shop__price', done ? 'Full' : `✦${BAG_UPGRADE_COSTS[level]}`));
	item.append(head, makeElement('p', 'shop__text', done ? `Holds ${BAG_SIZE + level}. Fully upgraded.` : `Holds ${BAG_SIZE + level}. Upgrade to hold ${BAG_SIZE + level + 1}.`));
	if (!done) {
		const cost = BAG_UPGRADE_COSTS[level];
		item.append(shopButton(`Buy ✦${cost}`, canAfford(store.glints, cost), () => buyBagUpgrade(cost)));
	}
	return item;
}

function buyBagUpgrade(cost) {
	if (!canAfford(store.glints, cost)) return audio.deny();
	store.glints -= cost;
	store.perks.bag++;
	save();
	bumpWallet();
}

function makeElement(tag, cls, text) {
	const el = document.createElement(tag);
	if (cls) el.className = cls;
	if (text !== undefined) el.textContent = text;
	return el;
}

function stateButton(label) {
	const b = makeElement('button', 'button button--small shop__action shop__action--on', label);
	b.type = 'button';
	b.setAttribute('aria-disabled', 'true');
	return b;
}

function shopButton(label, enabled, onClick) {
	const b = makeElement('button', 'button button--small shop__action', label);
	b.type = 'button';
	b.setAttribute('aria-disabled', String(!enabled));
	b.addEventListener('click', (e) => {
		e.stopPropagation();
		if (!enabled) return audio.deny();
		audio.ui();
		onClick();
	});
	return b;
}
