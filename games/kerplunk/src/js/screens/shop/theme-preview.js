// A small picture of a theme in the shop: its paper and its cards. Random in use shows its current roll.

import { kitTheme, RANDOM_BACKGROUNDS } from '../../looks/themes.js';
import { store } from '../../app/storage.js';
import { makeElement } from '../../app/dom.js';
import { activeTheme, activeKitStyle } from '../../looks/looks.js';

export function themePreview(item) {
	const preview = makeElement('div', 'theme-preview');
	const rolled = item.id === 'random' && store.looks.theme === 'random';
	if (item.id === 'random' && !rolled) return randomPreview(preview);
	const theme = rolled ? activeTheme() : kitTheme(item.id, activeKitStyle());
	preview.style.backgroundColor = theme.bg;
	preview.style.backgroundImage = `radial-gradient(${theme.dot} 1.2px, transparent 1.4px)`;
	preview.style.borderColor = theme.ink;
	const cardColors = rolled ? [theme.accent, theme.accent2, ...theme.blocks.slice(0, 2)] : [theme.accent, theme.accent2, theme.card];
	for (const color of cardColors) preview.append(previewCard(color, theme));
	return preview;
}

/** Random before it is in use: a rainbow with a question mark. */
function randomPreview(preview) {
	preview.classList.add('theme-preview--random');
	preview.style.background = `linear-gradient(90deg, ${RANDOM_BACKGROUNDS.slice(0, 5).join(', ')})`;
	preview.append(makeElement('span', 'theme-preview__mark', '?'));
	return preview;
}

function previewCard(color, theme) {
	const card = makeElement('i', 'theme-preview__card');
	card.style.background = color;
	card.style.borderColor = theme.ink;
	card.style.boxShadow = `${theme.shadowSideways ? 2 : 0}px 2px 0 ${theme.shadow}`;
	return card;
}
