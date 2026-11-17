// The title screen: the logo, the best scores, and the version number.

import { VERSION } from './version.js';
import { store } from './storage.js';
import { $ } from './dom.js';
import { view } from './session.js';
import { textOn } from './themes.js';
import { onLooksChange, rollForGame } from './looks.js';
import { audio } from './audio.js';

export function updateBestLabels() {
	$('best-endless').textContent = `Best ${store.best.endless.toLocaleString()}`;
	$('best-timed').textContent = `Best ${store.best.timed.toLocaleString()}`;
}

// The logo: each letter of the name sits on a block of its own color. The ink on each block is
// black or white, whichever has more contrast, so the name reads in every theme.
const LOGO = 'KERPLUNK';
const LOGO_TILT = [-4, 3, -2, 4, -3, 2, -4, 3]; // degrees, one for each letter

export function buildLogo() {
	const box = $('logo-tiles');
	box.textContent = '';
	const { blocks } = view.theme;
	[...LOGO].forEach((letter, i) => {
		const tile = document.createElement('span');
		tile.className = 'logo__tile';
		tile.textContent = letter;
		const base = blocks[i % blocks.length];
		tile.style.setProperty('--tile', base);
		tile.style.setProperty('--tile-ink', textOn(base));
		tile.style.setProperty('--turn', `${LOGO_TILT[i]}deg`);
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
