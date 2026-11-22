// The shop: themes, block styles, sound profiles, animation styles, and the power-up bag upgrade.
// A "look" is anything the player buys once and then picks: a theme, a block style, a sound or an animation.

import { BAG_UPGRADE_COSTS } from '../../shop/prices.js';
import { BAG_SIZE } from '../../rules/power-ups.js';
import { THEMES, STYLES, BAG_MAX_UPGRADES } from '../../shop/shop-items.js';
import { canAfford, buyLook } from '../../shop/wallet.js';
import { blockStrip } from '../../view/sprites/block-sprites.js';
import { audio } from '../../audio/sound-player.js';
import { store } from '../../app/storage.js';
import { $, showModal, makeElement } from '../../app/dom.js';
import { save } from '../../play/session.js';
import { bumpWallet, onWalletUpdate } from '../hud.js';
import { applyLooks, activeTheme, rollForGame } from '../../looks/looks.js';
import { SOUND_PROFILES } from '../../feel/sound-profiles.js';
import { MOTION_STYLES } from '../../feel/motion-styles.js';
import { withSound } from '../../feel/player-feel.js';
import { themePreview } from './theme-preview.js';
import { motionPreview } from './motion-preview.js';

// Each shop section, and where its owned list and its pick live in store.looks.
const SECTIONS = [
	{ title: 'Themes', items: THEMES, ownedKey: 'themes', activeKey: 'theme', preview: themePreview },
	{ title: 'Block styles', items: STYLES, ownedKey: 'styles', activeKey: 'style', preview: (style) => blockStrip({ style: style.id, theme: activeTheme(), size: 22 }) },
	{ title: 'Sounds', items: SOUND_PROFILES, ownedKey: 'sounds', activeKey: 'sound', preview: soundPreview },
	{ title: 'Animation', items: MOTION_STYLES, ownedKey: 'motions', activeKey: 'motion', preview: motionPreview },
];

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
	for (const section of SECTIONS) {
		body.append(makeElement('h3', 'shop__section', section.title));
		for (const item of section.items) body.append(lookItem(item, section));
	}
	body.append(makeElement('h3', 'shop__section', 'Upgrades'));
	body.append(bagItem());
}

/** One look: its preview, its price or "Owned", and a Buy, Use or In use button. */
function lookItem(item, { ownedKey, activeKey, preview }) {
	const owned = store.looks[ownedKey].includes(item.id);
	const active = store.looks[activeKey] === item.id;
	const card = makeElement('div', `shop__item${active ? ' is-on' : ''}`);
	const head = makeElement('div', 'shop__head');
	head.append(makeElement('h4', 'shop__title', item.name), makeElement('span', 'shop__price', owned ? 'Owned' : `✦${item.price}`));
	const previewBox = makeElement('div', 'shop__preview', '');
	previewBox.append(preview(item));
	card.append(head, previewBox, makeElement('p', 'shop__text', item.text), lookButton(item, { owned, active, ownedKey, activeKey }));
	return card;
}

function lookButton(item, { owned, active, ownedKey, activeKey }) {
	// Random in use: each tap rolls a new look, free, as often as the player likes.
	if (active && item.id === 'random') return shopButton('New look', true, newRandomLook);
	if (active) return inUseButton();
	if (owned) return shopButton('Use', true, () => useLook(activeKey, item.id));
	return shopButton(`Buy ✦${item.price}`, canAfford(store.glints, item.price), () => buy(item, ownedKey));
}

function buy(item, ownedKey) {
	const result = buyLook(store.glints, store.looks[ownedKey], item);
	if (!result) return audio.deny();
	store.glints = result.glints;
	store.looks[ownedKey] = result.owned;
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

// ---- the sound preview ----

// A drop, a chain of 3 and a power-up earned: [milliseconds from the tap, sound].
const HEAR_STEPS = [
	[0, () => audio.land(2)],
	[450, () => audio.clear(1, 3)],
	[800, () => audio.clear(2, 3)],
	[1150, () => audio.clear(3, 5)],
	[1750, () => audio.powerUpEarned()],
];

/** A sound profile: a button that plays a drop, a chain of 3 and a power-up with it. */
function soundPreview(profile) {
	const button = makeElement('button', 'button button--small shop-hear', '▶ Hear it');
	button.type = 'button';
	button.setAttribute('aria-label', `Hear ${profile.name}`);
	button.addEventListener('click', (event) => {
		event.stopPropagation();
		audio.unlock();
		for (const [ms, play] of HEAR_STEPS) setTimeout(() => withSound(profile.id, play), ms);
	});
	return button;
}

// ---- the bag upgrade ----

function bagItem() {
	const level = store.perks.bag;
	const holds = BAG_SIZE + level;
	const full = level >= BAG_MAX_UPGRADES;
	const card = makeElement('div', 'shop__item');
	const head = makeElement('div', 'shop__head');
	head.append(makeElement('h4', 'shop__title', 'Power-up bag'), makeElement('span', 'shop__price', full ? 'Full' : `✦${BAG_UPGRADE_COSTS[level]}`));
	card.append(head, makeElement('p', 'shop__text', full ? `Holds ${holds}. Fully upgraded.` : `Holds ${holds}. Upgrade to hold ${holds + 1}.`));
	if (full) return card;
	const cost = BAG_UPGRADE_COSTS[level];
	card.append(shopButton(`Buy ✦${cost}`, canAfford(store.glints, cost), () => buyBagUpgrade(cost)));
	return card;
}

function buyBagUpgrade(cost) {
	if (!canAfford(store.glints, cost)) return audio.deny();
	store.glints -= cost;
	store.perks.bag++;
	save();
	bumpWallet();
}

// ---- buttons ----

function inUseButton() {
	const button = makeElement('button', 'button button--small shop__action shop__action--on', 'In use');
	button.type = 'button';
	button.setAttribute('aria-disabled', 'true');
	return button;
}

function shopButton(label, enabled, onClick) {
	const button = makeElement('button', 'button button--small shop__action', label);
	button.type = 'button';
	button.setAttribute('aria-disabled', String(!enabled));
	button.addEventListener('click', (event) => {
		event.stopPropagation();
		if (!enabled) return audio.deny();
		audio.ui();
		onClick();
	});
	return button;
}
