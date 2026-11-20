// The shop: themes, block styles, sound profiles, animation styles, and the power-up bag upgrade.

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
import { SOUND_PROFILES, MOTION_STYLES, withSound, motionValues } from './feels.js';

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
	body.append(makeElement('h3', 'shop__section', 'Sounds'));
	for (const profile of SOUND_PROFILES) body.append(lookItem(profile, 'sounds', 'sound', soundPreview(profile)));
	body.append(makeElement('h3', 'shop__section', 'Animation'));
	for (const style of MOTION_STYLES) body.append(lookItem(style, 'motions', 'motion', motionPreview(style)));
	body.append(makeElement('h3', 'shop__section', 'Upgrades'));
	body.append(bagItem());
}

/**
 * One look (a theme, block style, sound profile or animation style): its preview, its price or "Owned", and Buy, Use or In use.
 * listKey is the owned list in the save ('themes', 'styles', 'sounds' or 'motions'); activeKey is the one in use
 * ('theme', 'style', 'sound' or 'motion').
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

// ---- the feel: sound profiles and animation styles ----

const HEAR_STEPS = [
	[0, () => audio.land(2)],
	[450, () => audio.clear(1, 3)],
	[800, () => audio.clear(2, 3)],
	[1150, () => audio.clear(3, 5)],
	[1750, () => audio.forge('flare')],
];

/** A sound profile: a button that plays a drop, a chain of 3 and a power-up with it. */
function soundPreview(profile) {
	const b = makeElement('button', 'button button--small shop-hear', '▶ Hear it');
	b.type = 'button';
	b.setAttribute('aria-label', `Hear ${profile.name}`);
	b.addEventListener('click', (e) => {
		e.stopPropagation();
		audio.unlock();
		for (const [ms, play] of HEAR_STEPS) setTimeout(() => withSound(profile.id, play), ms);
	});
	return b;
}

const PREVIEW_CELL = 13; // px
const GAME_CELL = 44; // the hop and fall sizes are in pixels of a game cell about this big

/**
 * An animation style: a tiny well where a block rises, lands between two blocks of its color,
 * and the three clear, with the numbers of this style. It loops while the shop shows it.
 */
function motionPreview(style) {
	const m = motionValues(style.id);
	const canvas = makeElement('canvas', 'motion-preview');
	const w = PREVIEW_CELL * 7;
	const h = PREVIEW_CELL * 3.4;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = Math.round(w * dpr);
	canvas.height = Math.round(h * dpr);
	canvas.style.width = `${w}px`;
	canvas.style.height = `${h}px`;
	canvas.setAttribute('aria-hidden', 'true');
	const ctx = canvas.getContext('2d');
	const theme = activeTheme();
	const px = PREVIEW_CELL / GAME_CELL;
	const s = { phase: 'rise', t: 0, y: 2.6, vy: m.dropSpeed, sx: 1, sy: 1, shake: 0 };
	let last = performance.now();

	function block(x, y, size = 1, rot = 0, alpha = 1) {
		const c = PREVIEW_CELL;
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.fillStyle = theme.blocks[2];
		ctx.strokeStyle = theme.ink;
		ctx.lineWidth = 1.5;
		const bw = c * size;
		ctx.fillRect(-bw / 2, -bw / 2, bw, bw);
		ctx.strokeRect(-bw / 2, -bw / 2, bw, bw);
		ctx.restore();
	}

	function frame(now) {
		if (!canvas.isConnected) return;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		s.t += dt;
		s.shake *= Math.pow(0.5, dt / Math.max(0.01, m.shakeTime));
		s.sx += (1 - s.sx) * Math.min(1, dt * m.squashSpring);
		s.sy += (1 - s.sy) * Math.min(1, dt * m.squashSpring);
		if (s.phase === 'rise') {
			s.vy += m.gravity * dt;
			s.y -= s.vy * dt;
			if (s.y <= 0) {
				s.y = 0;
				s.sy = 1 - m.landSquash;
				s.sx = 1 + m.landSquash * 0.67;
				s.shake = m.landShake * px * 2;
				s.phase = 'land';
				s.t = 0;
			}
		} else if (s.phase === 'land' && s.t > 0.35) {
			s.phase = 'clear';
			s.t = 0;
		} else if (s.phase === 'clear' && s.t > m.clearTime + m.clearStagger * 2 + 0.6) {
			Object.assign(s, { phase: 'rise', t: 0, y: 2.6, vy: m.dropSpeed, sx: 1, sy: 1 });
		}

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		const ox = (Math.random() * 2 - 1) * s.shake;
		const oy = (Math.random() * 2 - 1) * s.shake;
		ctx.save();
		ctx.translate(ox, oy);
		// The ceiling of the well.
		ctx.fillStyle = theme.ink;
		ctx.fillRect(0, 0, w, 2);
		const c = PREVIEW_CELL;
		const left = (w - c * 3) / 2;
		const cx = (col) => left + c * (col + 0.5);
		const top = 2 + c / 2;
		if (s.phase !== 'clear') {
			block(cx(0), top);
			block(cx(2), top);
			// The landing block squashes against the ceiling.
			const bx = cx(1);
			ctx.save();
			ctx.translate(bx, top + s.y * c - (c * (1 - s.sy)) / 2);
			ctx.scale(s.sx, s.sy);
			block(0, 0);
			ctx.restore();
		} else {
			// The clear: each block hops up and left, then falls and turns while it shrinks.
			[0, 1, 2].forEach((col, i) => {
				const k = Math.min(1, Math.max(0, (s.t - i * m.clearStagger) / Math.max(0.01, m.clearTime)));
				if (k >= 1) return;
				const hopPart = Math.min(0.95, Math.max(0.01, m.hopPart));
				const hop = m.hopSize * px;
				const big = 1 + m.clearGrow;
				let dx;
				let dy;
				let size;
				let rot = 0;
				let alpha = 1;
				if (k < hopPart) {
					const u = k / hopPart;
					dx = -hop * u;
					dy = -hop * u;
					size = 1 + (big - 1) * u;
				} else {
					const u = (k - hopPart) / (1 - hopPart);
					const e = Math.pow(u, m.fallEase);
					dx = -hop + hop * e;
					dy = -hop + m.fallSize * px * e;
					size = big - (big - m.clearEnd) * e;
					rot = m.fallSpin * e;
					alpha = 1 - e;
				}
				block(cx(col) + dx, top + dy, size, rot, alpha);
			});
		}
		ctx.restore();
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
	return canvas;
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
