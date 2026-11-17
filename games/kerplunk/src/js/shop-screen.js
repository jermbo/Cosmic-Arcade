// The shop: upgrade the power-up bag and buy block skins.

import { BAG_UPGRADE_COSTS } from './prices.js';
import { BAG_SIZE } from './engine.js';
import { SKINS, skinById, BAG_MAX_UPGRADES } from './shop.js';
import { canAfford } from './wallet.js';
import { audio } from './audio.js';
import { paintPalette } from './sprites.js';
import { store } from './storage.js';
import { $, showModal } from './dom.js';
import { view, save } from './session.js';
import { bumpWallet, onWalletUpdate } from './hud.js';
import { buildLogo } from './title.js';

export function openShop() {
	renderShop();
	showModal('screen-shop');
}

onWalletUpdate(() => {
	if (!$('screen-shop').hidden) renderShop();
});

function renderShop() {
	$('shop-wallet').textContent = `✦ ${store.glints.toLocaleString()} Glints`;
	const body = $('shop-body');
	body.textContent = '';
	body.append(bagItem());
	for (const skin of SKINS) body.append(skinItem(skin));
}

function bagItem() {
	const level = store.perks.bag;
	const item = makeElement('div', 'shop__item');
	item.append(makeElement('h3', 'shop__title', 'Power-up bag'));
	item.append(makeElement('p', 'shop__text', level >= BAG_MAX_UPGRADES ? `Holds ${BAG_SIZE + level}. Fully upgraded.` : `Holds ${BAG_SIZE + level}. Upgrade to hold ${BAG_SIZE + level + 1}.`));
	if (level < BAG_MAX_UPGRADES) {
		const cost = BAG_UPGRADE_COSTS[level];
		item.append(buyButton(`Buy ✦${cost}`, canAfford(store.glints, cost), () => buyBagUpgrade(cost)));
	}
	return item;
}

function buyBagUpgrade(cost) {
	store.glints -= cost;
	store.perks.bag++;
	save();
	bumpWallet();
}

function skinItem(skin) {
	const owned = store.perks.skins.includes(skin.id);
	const active = store.perks.skin === skin.id;
	const item = makeElement('div', `shop__item${active ? ' is-on' : ''}`);
	item.append(makeElement('h3', 'shop__title', `${skin.name} blocks`));
	item.append(swatches(skin));
	if (active) {
		const inUse = makeElement('button', 'button shop__action', 'In use');
		inUse.type = 'button';
		inUse.setAttribute('aria-disabled', 'true');
		item.append(inUse);
	} else if (owned) {
		item.append(buyButton('Use', true, () => useSkin(skin.id)));
	} else {
		item.append(buyButton(`Buy ✦${skin.price}`, canAfford(store.glints, skin.price), () => buySkin(skin)));
	}
	return item;
}

function swatches(skin) {
	const sw = makeElement('div', 'swatches');
	for (const c of skin.colors) {
		const i = document.createElement('i');
		i.className = 'swatches__swatch';
		i.style.background = c.base;
		sw.append(i);
	}
	return sw;
}

function buySkin(skin) {
	store.glints -= skin.price;
	store.perks.skins.push(skin.id);
	save();
	useSkin(skin.id);
}

function useSkin(id) {
	store.perks.skin = id;
	paintPalette(skinById(id).colors);
	view.sprites = null;
	view.layout();
	buildLogo();
	save();
	bumpWallet();
	renderShop();
}

function makeElement(tag, cls, text) {
	const el = document.createElement(tag);
	if (cls) el.className = cls;
	if (text !== undefined) el.textContent = text;
	return el;
}

function buyButton(label, enabled, onClick) {
	const b = makeElement('button', 'button shop__action', label);
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
