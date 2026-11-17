// The title screen: the logo, the best scores, and the version number.

import { DAILY_BONUS } from './prices.js';
import { VERSION } from './version.js';
import { store } from './storage.js';
import { $ } from './dom.js';
import { view } from './session.js';
import { syncDaily } from './daily.js';

export function updateBestLabels() {
	syncDaily();
	$('daily-sub').textContent = store.daily.claimed ? `Today's best ${store.daily.best.toLocaleString()}` : `First run pays ✦${DAILY_BONUS}`;
	$('best-endless').textContent = `Best ${store.best.endless.toLocaleString()}`;
	$('best-timed').textContent = `Best ${store.best.timed.toLocaleString()}`;
}

export function buildLogo() {
	const box = $('logo-gems');
	box.innerHTML = '';
	[0, 1, 'nova', 3, 4].forEach((c, i) => {
		const img = document.createElement('img');
		img.className = 'logo__gem';
		img.alt = '';
		img.src = (c === 'nova' ? view.sprites.nova[2] : view.sprites.plain[c]).toDataURL();
		img.style.animationDelay = `${i * 0.18}s`;
		box.appendChild(img);
	});
}

const DOOR_TAPS = 7;
const DOOR_TAP_WINDOW_MS = 1500;

export function initTitle() {
	$('version-title').textContent = `v${VERSION}`;
	$('version-settings').textContent = `Glintwell v${VERSION}`;
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
