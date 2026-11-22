// The title screen: the logo, the best scores, the version number, and the secret door to the labs.

import { VERSION } from '../app/version.js';
import { store } from '../app/storage.js';
import { $, replayAnimation } from '../app/dom.js';
import { view } from '../play/session.js';
import { drawBlock } from '../view/sprites/block-sprites.js';
import { onLooksChange, rollForGame } from '../looks/looks.js';
import { audio } from '../audio/sound-player.js';

// The logo: one long piece. Each letter of the name sits on a game block, drawn in the theme and
// block style in use, so the logo changes with the shop. The colors run through the five blocks.
const LOGO = 'KERPLUNK';
const LOGO_BLOCK_PX = 104; // twice the largest tile, so the block stays sharp on a 2x screen

// A secret door: tap the version number 7 times to open the shape lab.
const DOOR_TAPS = 7;
const DOOR_TAP_WINDOW_MS = 1500;
const DOOR_PAGE = 'labs/shape-lab.html';

export function updateBestLabels() {
	$('best-endless').textContent = `Best ${store.best.endless.toLocaleString()}`;
	$('best-timed').textContent = `Best ${store.best.timed.toLocaleString()}`;
}

let logoImages = { key: '', urls: [] };

/** The block image of each color, as data URLs. They are drawn again only when the look changes. */
function logoBlockUrls() {
	const { theme, style } = view;
	const key = `${theme.id}|${style}|${theme.blocks.join()}`;
	if (logoImages.key === key) return logoImages.urls;
	const urls = theme.blocks.map((base, color) => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = LOGO_BLOCK_PX;
		drawBlock(canvas.getContext('2d'), { style, color, size: LOGO_BLOCK_PX, theme, base });
		return canvas.toDataURL();
	});
	logoImages = { key, urls };
	return urls;
}

export function buildLogo() {
	const box = $('logo-tiles');
	box.textContent = '';
	const urls = logoBlockUrls();
	[...LOGO].forEach((letter, i) => {
		const tile = document.createElement('span');
		tile.className = 'logo__tile';
		tile.textContent = letter;
		tile.style.backgroundImage = `url(${urls[i % urls.length]})`;
		tile.style.setProperty('--i', i);
		box.append(tile);
	});
}

onLooksChange(() => view.sprites && buildLogo());

/** A tap on a logo tile: it hops and plays its note. With Random in use, it also rolls a new look. */
function tapTile(event) {
	const tile = event.target.closest('.logo__tile');
	if (!tile) return;
	audio.unlock();
	audio.tile(Number(tile.style.getPropertyValue('--i')));
	if (store.looks.theme === 'random') {
		rollForGame();
		return;
	}
	replayAnimation(tile, 'is-tapped');
}

export function initTitle() {
	$('logo-tiles').addEventListener('pointerdown', tapTile);
	$('version-title').textContent = `v${VERSION}`;
	$('version-settings').textContent = `Kerplunk v${VERSION}`;
	const knock = secretDoor();
	$('version-title').addEventListener('click', knock);
	$('version-settings').addEventListener('click', knock);
}

/** Counts quick taps. The door opens on the DOOR_TAPS-th tap in a row. */
function secretDoor() {
	let taps = 0;
	let timer = 0;
	return () => {
		taps++;
		clearTimeout(timer);
		timer = setTimeout(() => (taps = 0), DOOR_TAP_WINDOW_MS);
		if (taps >= DOOR_TAPS) location.href = DOOR_PAGE;
	};
}
