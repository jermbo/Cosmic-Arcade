// Small helpers for the page: find an element, show one modal, flash a banner.

export const $ = (id) => document.getElementById(id);

export function showModal(id) {
	for (const el of document.querySelectorAll('.screen--modal')) el.hidden = el.id !== id;
}

export function hideModals() {
	showModal(null);
}

export function bump(el) {
	el.classList.remove('is-bump');
	void el.offsetWidth;
	el.classList.add('is-bump');
}

export function showBanner(text, ms) {
	const b = $('banner');
	b.textContent = text;
	b.hidden = false;
	b.style.animation = 'none';
	void b.offsetWidth;
	b.style.animation = '';
	clearTimeout(showBanner.timer);
	if (ms) showBanner.timer = setTimeout(() => (b.hidden = true), ms);
}

/** Keeps the pointer events on an element while a finger or the mouse is down. */
export function capturePointer(element, pointerId) {
	try {
		element.setPointerCapture(pointerId);
	} catch {
		// Capture can fail if the pointer is already gone.
	}
}
