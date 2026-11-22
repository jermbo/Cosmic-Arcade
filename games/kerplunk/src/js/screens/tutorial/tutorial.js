// The tutorial: four pages of text, each with a small moving picture (see tutorial-pictures.js).

import { REWARD_CHAIN, REWARD_GROUP } from '../../rules/power-ups.js';
import { store } from '../../app/storage.js';
import { $, showModal, hideModals, prefersStillness } from '../../app/dom.js';
import { state, save } from '../../play/session.js';
import { syncSettings } from '../settings-screen.js';
import { drawDropPicture, drawMatchPicture, drawPowerUpsPicture, drawEndPicture } from './tutorial-pictures.js';

const PAGES = [
	{
		title: 'Drop into the well',
		text: 'Drag a piece up into the well and let go. It <b>rises and sticks to the ceiling</b>. The ghost shows where each block lands. <b>Pieces never turn: you get what you get.</b> New pieces come only when you have used every piece in the tray.',
		draw: drawDropPicture,
	},
	{
		title: 'Match 3 or more',
		text: 'Link 3 or more blocks of one color. They can bend around corners, but <b>not diagonally</b>. They break, the blocks below rise, and new matches chain. <b>Each chain step raises the multiplier.</b> <b>Big groups pay more:</b> 5 blocks pay ×2, 6 pay ×3, and so on.',
		draw: drawMatchPicture,
	},
	{
		title: 'Earn power-ups',
		text: `A chain of ${REWARD_CHAIN} or a group of ${REWARD_GROUP} earns a power-up. In Endless it waits in the bar under the well until you tap it. In Timed it acts by itself. You get all three kinds in turn, never the same one twice in a row. <b>Prism</b> paints a piece one color. <b>Blast</b> clears a 3×3 area. <b>Remix</b> shuffles every block on the board.`,
		draw: drawPowerUpsPicture,
	},
	{
		title: 'Keep room to play',
		text: `The game ends when no piece fits. Endless has no clock. Timed starts with 60 seconds, and good chains add time. <b>Combos earn Plunks (✦).</b> Spend them in the Shop, on boosts before a game, on a Reroll, or to keep going when you run out of room.<br /><span class="tutorial__keys">Keys: <kbd class="tutorial__key">←</kbd> <kbd class="tutorial__key">→</kbd> move · <kbd class="tutorial__key">↓</kbd> next piece · <kbd class="tutorial__key">Space</kbd> drop</span>`,
		draw: drawEndPicture,
	},
];
const PICTURE_WIDTH = 220;
const PICTURE_HEIGHT = 150;
const STILL_PICTURE_TIME = 1.4; // with reduced motion, each picture shows this moment
let pageIndex = 0;
let pictureFrame = 0;

export function openTutorial() {
	state.modalReturn = returnScreen();
	pageIndex = 0;
	$('screen-title').hidden = true;
	showModal('screen-tutorial');
	renderPage();
}

/** Where the tutorial goes back to when it closes. */
function returnScreen() {
	if (!$('screen-settings').hidden) return 'screen-settings';
	return state.screen === 'title' ? 'title' : 'screen-pause';
}

/** Goes `delta` pages on. Past the last page, the tutorial closes. */
export function tutorialStep(delta) {
	pageIndex += delta;
	if (pageIndex >= PAGES.length) closeTutorial();
	else renderPage();
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
		return;
	}
	if (state.modalReturn === 'screen-settings') syncSettings();
	showModal(state.modalReturn);
}

function renderPage() {
	const page = PAGES[pageIndex];
	const box = $('tutorial');
	box.innerHTML = `<canvas class="tutorial__picture"></canvas><h3 class="tutorial__title">${page.title}</h3><p class="tutorial__text">${page.text}</p>`;
	hideKeysOnTouchScreens(box);
	animatePicture(pictureContext(box.querySelector('canvas')), page.draw);
	$('tutorial-dots').innerHTML = PAGES.map((_, i) => `<span class="tutorial__dot ${i === pageIndex ? 'is-on' : ''}"></span>`).join('');
	$('tutorial-next').textContent = nextLabel();
}

function nextLabel() {
	if (pageIndex < PAGES.length - 1) return 'Next';
	return state.afterTutorial ? "Let's play" : 'Done';
}

/** The keyboard line (and the line break before it) only shows with a mouse. */
function hideKeysOnTouchScreens(box) {
	const keys = box.querySelector('.tutorial__keys');
	if (!keys || window.matchMedia('(pointer: fine)').matches) return;
	keys.previousElementSibling.remove();
	keys.remove();
}

function pictureContext(canvas) {
	const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = PICTURE_WIDTH * pixelRatio;
	canvas.height = PICTURE_HEIGHT * pixelRatio;
	const ctx = canvas.getContext('2d');
	ctx.scale(pixelRatio, pixelRatio);
	return ctx;
}

/** Draws the picture of the page each frame while the tutorial is open. With reduced motion, one still frame. */
function animatePicture(ctx, draw) {
	cancelAnimationFrame(pictureFrame);
	const still = prefersStillness();
	const start = performance.now();
	const frame = (now) => {
		if ($('screen-tutorial').hidden) return;
		ctx.clearRect(0, 0, PICTURE_WIDTH, PICTURE_HEIGHT);
		draw(ctx, still ? STILL_PICTURE_TIME : (now - start) / 1000);
		if (!still) pictureFrame = requestAnimationFrame(frame);
	};
	frame(start);
}
