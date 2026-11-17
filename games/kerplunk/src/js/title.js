// The title screen: the logo, the best scores, and the version number.

import { VERSION } from './version.js';
import { store } from './storage.js';
import { $ } from './dom.js';
import { view } from './session.js';
import { onLooksChange } from './looks.js';

export function updateBestLabels() {
	$('best-endless').textContent = `Best ${store.best.endless.toLocaleString()}`;
	$('best-timed').textContent = `Best ${store.best.timed.toLocaleString()}`;
}

export function buildLogo() {
	const box = $('logo-gems');
	box.innerHTML = '';
	[0, 1, 2, 3, 4].forEach((c, i) => {
		const img = document.createElement('img');
		img.className = 'logo__gem';
		img.alt = '';
		img.src = view.sprites.plain[c].toDataURL();
		img.style.animationDelay = `${i * 0.18}s`;
		box.appendChild(img);
	});
}

onLooksChange(() => view.sprites && buildLogo());

const DOOR_TAPS = 7;
const DOOR_TAP_WINDOW_MS = 1500;

export function initTitle() {
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
