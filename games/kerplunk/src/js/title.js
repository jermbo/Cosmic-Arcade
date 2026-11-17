// The title screen: the logo, the best scores, and the version number.

import { VERSION } from './version.js';
import { store } from './storage.js';
import { $ } from './dom.js';
import { view } from './session.js';
import { drawBlock } from './sprites.js';
import { onLooksChange, rollForGame } from './looks.js';
import { audio } from './audio.js';

export function updateBestLabels() {
	$('best-endless').textContent = `Best ${store.best.endless.toLocaleString()}`;
	$('best-timed').textContent = `Best ${store.best.timed.toLocaleString()}`;
}

// The logo: one long piece. Each letter of the name sits on a game block, drawn in the theme and
// block style in use, so the logo changes with the shop. The colors run through the five blocks.
const LOGO = 'KERPLUNK';
const LOGO_BLOCK_PX = 104; // twice the largest tile, so the block stays sharp on a 2x screen

let logoImages = { key: '', urls: [] };

/** The block image of each color, as data URLs. They are drawn again only when the look changes. */
function logoBlockUrls() {
	const { theme, style } = view;
	const key = `${theme.id}|${style}|${theme.blocks.join()}`;
	if (logoImages.key === key) return logoImages.urls;
	const urls = theme.blocks.map((base, color) => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = LOGO_BLOCK_PX;
		drawBlock(canvas.getContext('2d'), { style, color, s: LOGO_BLOCK_PX, theme, base });
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
function tapTile(e) {
	const tile = e.target.closest('.logo__tile');
	if (!tile) return;
	audio.unlock();
	audio.tile(Number(tile.style.getPropertyValue('--i')));
	if (store.looks.theme === 'random') {
		rollForGame();
		return;
	}
	tile.classList.remove('is-tapped');
	void tile.offsetWidth; // restarts the hop
	tile.classList.add('is-tapped');
}

const DOOR_TAPS = 7;
const DOOR_TAP_WINDOW_MS = 1500;

export function initTitle() {
	$('logo-tiles').addEventListener('pointerdown', tapTile);
	$('version-title').textContent = `v${VERSION}`;
	$('version-settings').textContent = `Kerplunk v${VERSION}`;
	// A secret door: tap the version number 7 times to open the shape lab.
	let taps = 0;
	let timer = 0;
	const door = () => {
		taps++;
		clearTimeout(timer);
		timer = setTimeout(() => (taps = 0), DOOR_TAP_WINDOW_MS);
		if (taps >= DOOR_TAPS) location.href = 'shape-lab.html';
	};
	$('version-title').addEventListener('click', door);
	$('version-settings').addEventListener('click', door);
}
