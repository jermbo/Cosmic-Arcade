// The boosts screen before a game: buy a warm-up, a first power-up, or a banned shape.

import { WARMUP_COST, START_POWER_COST, BAN_COST } from '../shop/prices.js';
import { SHAPES } from '../rules/shapes/shape-list.js';
import { canAfford, boostsCost } from '../shop/wallet.js';
import { audio } from '../audio/sound-player.js';
import { PALETTE } from '../view/sprites/block-sprites.js';
import { store } from '../app/storage.js';
import { $, showModal, setPlunkText, makeElement } from '../app/dom.js';
import { save } from '../play/session.js';
import { onWalletUpdate } from './hud.js';

const THUMB_CELL_PX = 12;
const picked = { warmup: false, power: null, ban: null };
const CHEAPEST_BOOST = Math.min(WARMUP_COST, START_POWER_COST, BAN_COST);

const pickedCost = () => boostsCost(picked);
/** True when the wallet still has room for a boost of this cost, on top of the ones picked. */
const canAddBoost = (cost) => canAfford(store.glints - pickedCost(), cost);

/** True when the player has enough Plunks for at least one boost. */
export const canOfferBoosts = () => canAfford(store.glints, CHEAPEST_BOOST);
export const canPayBoosts = () => canAfford(store.glints, pickedCost());

/** The boosts picked so far: { warmup, power, ban }. */
export const pickedBoosts = () => ({ ...picked });

/** Shows the boosts screen with nothing picked. */
export function openBoosts() {
	Object.assign(picked, { warmup: false, power: null, ban: null });
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

/** Takes the price of the picked boosts from the wallet. */
export function payBoosts() {
	const total = pickedCost();
	store.glints -= total;
	if (total) save();
}

onWalletUpdate(() => {
	if (!$('screen-start').hidden) renderBoosts();
});

// ---- drawing the screen ----

/** Marks a boost button as picked, and as off when the player cannot add it. */
function markButton(button, isPicked, canPick) {
	button.setAttribute('aria-pressed', String(isPicked));
	button.setAttribute('aria-disabled', String(!isPicked && !canPick));
}

function renderBoosts() {
	$('start-wallet').textContent = `✦ ${store.glints.toLocaleString()} Plunks`;
	markButton(document.querySelector('[data-action="start-warmup"]'), picked.warmup, canAddBoost(WARMUP_COST));
	setPlunkText($('cost-warmup'), `✦ ${WARMUP_COST} · score and power-ups it earns are yours`);
	for (const button of document.querySelectorAll('[data-action="start-power"]')) {
		// Swapping one power-up for another costs nothing more.
		markButton(button, picked.power === button.dataset.kind, picked.power !== null || canAddBoost(START_POWER_COST));
	}
	setPlunkText($('cost-power'), `✦ ${START_POWER_COST} for one`);
	markButton(document.querySelector('[data-action="start-ban"]'), picked.ban !== null, canAddBoost(BAN_COST));
	renderBanLabel();
	setPlunkText($('cost-ban'), `✦ ${BAN_COST}`);
	const total = pickedCost();
	setPlunkText($('start-total'), total ? `✦ ${total}` : 'Free');
}

function renderBanLabel() {
	const label = $('ban-label');
	label.textContent = picked.ban === null ? 'Ban a shape from this game' : 'Banned shape (tap to change)';
	if (picked.ban !== null && SHAPES[picked.ban]) label.append(' ', shapeThumb(SHAPES[picked.ban]));
}

/** The ban picker: a card for each shape. */
function renderBanGrid() {
	const grid = $('shape-grid');
	grid.textContent = '';
	if (!SHAPES.length) {
		grid.textContent = 'No shapes.';
		return;
	}
	SHAPES.forEach((cells, index) => grid.append(banCard(cells, index)));
}

function banCard(cells, index) {
	const card = makeElement('button', 'shapecard');
	card.type = 'button';
	card.setAttribute('aria-label', `Ban shape ${index + 1}, ${cells.length} blocks`);
	card.append(shapeThumb(cells), makeElement('small', 'shapecard__note', `${cells.length} blocks`));
	card.addEventListener('click', () => {
		audio.ui();
		picked.ban = index;
		renderBoosts();
		showModal('screen-start');
	});
	return card;
}

/** A tiny picture of a shape (a list of [dx, dy]). */
function shapeThumb(cells) {
	const thumb = makeElement('div', 'shapethumb');
	const width = Math.max(...cells.map(([x]) => x)) + 1;
	const height = Math.max(...cells.map(([, y]) => y)) + 1;
	thumb.style.gridTemplateColumns = `repeat(${width}, ${THUMB_CELL_PX}px)`;
	const filled = new Set(cells.map(([x, y]) => `${x},${y}`));
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const square = makeElement('i', 'shapethumb__cell');
			// A fixed mix of colors, so each block of the thumb looks different.
			if (filled.has(`${x},${y}`)) square.style.background = PALETTE[(x * 7 + y * 13) % 5].base;
			else square.style.visibility = 'hidden';
			thumb.append(square);
		}
	}
	return thumb;
}
