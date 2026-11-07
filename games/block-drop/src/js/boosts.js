// The boosts a player can buy before a game: a warm-up, a first power-up, and a banned shape.

import { WARMUP_COST, START_POWER_COST, BAN_COST } from './prices.js';
import { SHAPES } from './shape-list.js';
import { canAfford, boostsCost } from './wallet.js';
import { audio } from './audio.js';
import { PALETTE } from './sprites.js';
import { store } from './storage.js';
import { $, showModal } from './dom.js';
import { save } from './session.js';
import { onWalletUpdate } from './hud.js';

const picked = { warmup: false, power: null, ban: null };
const MIN_BOOST_COST = Math.min(WARMUP_COST, START_POWER_COST, BAN_COST);
const pickedCost = () => boostsCost(picked);
const canAddBoost = (cost) => canAfford(store.glints - pickedCost(), cost);

export const canOfferBoosts = () => canAfford(store.glints, MIN_BOOST_COST);

/** Shows the boosts screen with nothing picked. */
export function openBoosts() {
	picked.warmup = false;
	picked.power = null;
	picked.ban = null;
	renderBoosts();
	showModal('screen-start');
}

export function toggleWarmup() {
	if (!picked.warmup && !canAddBoost(WARMUP_COST)) return audio.deny();
	picked.warmup = !picked.warmup;
	renderBoosts();
}

export function togglePower(kind) {
	if (picked.power === null && !canAddBoost(START_POWER_COST)) return audio.deny();
	picked.power = picked.power === kind ? null : kind;
	renderBoosts();
}

export function openBanPicker() {
	if (picked.ban === null && !canAddBoost(BAN_COST)) return audio.deny();
	renderBanGrid();
	showModal('screen-ban');
}

export function clearBan() {
	picked.ban = null;
	renderBoosts();
	showModal('screen-start');
}

export const canPayBoosts = () => canAfford(store.glints, pickedCost());

/** The boosts picked so far: { warmup, power, ban }. */
export const pickedBoosts = () => ({ ...picked });

/** Takes the price of the picked boosts from the wallet. */
export function payBoosts() {
	const total = pickedCost();
	store.glints -= total;
	if (total) save();
}

onWalletUpdate(() => {
	if (!$('screen-start').hidden) renderBoosts();
});

/** A tiny picture of a shape (a list of [dx, dy]) for the ban picker. */
function shapeThumb(cells) {
	const el = document.createElement('div');
	el.className = 'shapethumb';
	const w = Math.max(...cells.map(([x]) => x)) + 1;
	const h = Math.max(...cells.map(([, y]) => y)) + 1;
	el.style.gridTemplateColumns = `repeat(${w}, 12px)`;
	const on = new Set(cells.map(([x, y]) => `${x},${y}`));
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = document.createElement('i');
			i.className = 'shapethumb__cell';
			if (on.has(`${x},${y}`)) i.style.background = PALETTE[(x * 7 + y * 13) % 5].base;
			else i.style.visibility = 'hidden';
			el.append(i);
		}
	}
	return el;
}

function renderBoosts() {
	const mark = (el, pressed, enabled) => {
		el.setAttribute('aria-pressed', String(pressed));
		el.setAttribute('aria-disabled', String(!pressed && !enabled));
	};
	const room = (cost) => canAddBoost(cost);
	$('start-wallet').textContent = `✦ ${store.glints.toLocaleString()} Glints`;
	const warm = document.querySelector('[data-action="start-warmup"]');
	mark(warm, picked.warmup, room(WARMUP_COST));
	$('cost-warmup').textContent = `✦ ${WARMUP_COST} · score and power-ups it earns are yours`;
	for (const b of document.querySelectorAll('[data-action="start-power"]')) mark(b, picked.power === b.dataset.kind, picked.power !== null || room(START_POWER_COST));
	$('cost-power').textContent = `✦ ${START_POWER_COST} for one`;
	const ban = document.querySelector('[data-action="start-ban"]');
	mark(ban, picked.ban !== null, room(BAN_COST));
	const label = $('ban-label');
	label.textContent = picked.ban === null ? 'Ban a shape from this game' : 'Banned shape (tap to change)';
	if (picked.ban !== null && SHAPES[picked.ban]) label.append(' ', shapeThumb(SHAPES[picked.ban]));
	$('cost-ban').textContent = `✦ ${BAN_COST}`;
	const total = pickedCost();
	$('start-total').textContent = total ? `✦ ${total}` : 'Free';
}

function renderBanGrid() {
	const grid = $('shape-grid');
	grid.textContent = '';
	const total = SHAPES.length;
	SHAPES.forEach((cells, i) => {
		const card = document.createElement('button');
		card.type = 'button';
		card.className = 'shapecard';
		card.setAttribute('aria-label', `Ban shape ${i + 1}, ${cells.length} blocks`);
		card.append(shapeThumb(cells));
		const small = document.createElement('small');
		small.className = 'shapecard__note';
		small.textContent = `${cells.length} blocks`;
		card.append(small);
		card.addEventListener('click', () => {
			audio.ui();
			picked.ban = i;
			renderBoosts();
			showModal('screen-start');
		});
		grid.append(card);
	});
	if (!total) grid.textContent = 'No shapes.';
}
