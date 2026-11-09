// The tutorial: four pages of text, each with a small picture.

import { REWARD_CHAIN, REWARD_GROUP } from './engine.js';
import { store } from './storage.js';
import { $, showModal, hideModals } from './dom.js';
import { state, save } from './session.js';
import { syncSettings } from './settings.js';
import { drawTutorialDrop, drawTutorialMatch, drawTutorialPowerUps, drawTutorialEnd } from './tutorial-art.js';

const TUTORIAL = [
	{
		title: 'Drop into the well',
		text: 'Drag a piece up into the well and let go. It <b>rises and sticks to the ceiling</b>. The ghost shows where each block lands. <b>Pieces never turn: you get what you get.</b>',
		draw: drawTutorialDrop,
	},
	{
		title: 'Match 3 or more',
		text: 'Link 3 or more blocks of one color. They can bend around corners, but <b>not diagonally</b>. They break, the blocks below rise, and new matches chain. <b>Each chain step raises the multiplier.</b> <b>Big groups pay more:</b> 5 blocks pay ×2, 6 pay ×3, and so on.',
		draw: drawTutorialMatch,
	},
	{
		title: 'Earn power-ups',
		text: `A chain of ${REWARD_CHAIN} or a group of ${REWARD_GROUP} earns a power-up for the bar under the well. You get all three kinds in turn, never the same one twice in a row. <b>Prism</b> paints a piece one color. <b>Blast</b> clears a 3×3 area. <b>Remix</b> shuffles every block on the board.`,
		draw: drawTutorialPowerUps,
	},
	{
		title: 'Keep room to play',
		text: `The game ends when no piece fits. Endless has no clock. Timed gives you 90 seconds. <b>Combos earn Glints (✦).</b> Spend them in the Shop, on boosts before a game, on a Reroll, or to keep going when you run out of room.<br /><span class="tutorial__keys">Keys: <kbd class="tutorial__key">←</kbd> <kbd class="tutorial__key">→</kbd> move · <kbd class="tutorial__key">↓</kbd> next piece · <kbd class="tutorial__key">Space</kbd> drop</span>`,
		draw: drawTutorialEnd,
	},
];
const PICTURE_WIDTH = 220;
const PICTURE_HEIGHT = 150;
let tutorialPage = 0;

export function openTutorial() {
	state.modalReturn = !$('screen-settings').hidden ? 'screen-settings' : state.screen === 'title' ? 'title' : 'screen-pause';
	tutorialPage = 0;
	$('screen-title').hidden = true;
	showModal('screen-tutorial');
	renderTutorial();
}

export function tutorialStep(delta) {
	tutorialPage += delta;
	if (tutorialPage >= TUTORIAL.length) closeTutorial();
	else renderTutorial();
}

export function closeTutorial() {
	store.tutorialDone = true;
	save();
	const next = state.afterTutorial;
	state.afterTutorial = null;
	if (next) return next();
	if (state.modalReturn === 'title') {
		hideModals();
		$('screen-title').hidden = false;
	} else {
		if (state.modalReturn === 'screen-settings') syncSettings();
		showModal(state.modalReturn);
	}
}

function renderTutorial() {
	const page = TUTORIAL[tutorialPage];
	const box = $('tutorial');
	box.innerHTML = `<canvas class="tutorial__picture"></canvas><h3 class="tutorial__title">${page.title}</h3><p class="tutorial__text">${page.text}</p>`;
	const keys = box.querySelector('.tutorial__keys');
	if (keys && !window.matchMedia('(pointer: fine)').matches) keys.previousElementSibling.remove(), keys.remove();
	const c = box.querySelector('canvas');
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	c.width = PICTURE_WIDTH * dpr;
	c.height = PICTURE_HEIGHT * dpr;
	const ctx = c.getContext('2d');
	ctx.scale(dpr, dpr);
	page.draw(ctx);
	$('tutorial-dots').innerHTML = TUTORIAL.map((_, i) => `<span class="tutorial__dot ${i === tutorialPage ? 'is-on' : ''}"></span>`).join('');
	$('tutorial-next').textContent = tutorialPage === TUTORIAL.length - 1 ? (state.afterTutorial ? "Let's play" : 'Done') : 'Next';
}
