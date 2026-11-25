// The one KAPLAY instance, and the camera that fits the 960 x 540 world to any screen.

import kaplay from 'kaplay';
import { WORLD } from '../rules/data/balance.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;

export const k = kaplay({
	canvas,
	global: false,
	background: [20, 12, 24],
	touchToMouse: true,
	letterbox: false,
	crisp: false,
	pixelDensity: Math.min(2, window.devicePixelRatio || 1),
	debug: import.meta.env.DEV,
	debugKey: 'f1',
	loadingScreen: false,
	burp: false,
	focus: true,
	backgroundAudio: false,
	maxFPS: 120,
});

/** World y where the view starts on a wide screen. Above it is only sky. */
const FOCUS_TOP = 76;

/** Screen pixels per world unit. */
export let viewScale = 1;

/** Fits the world to the screen. Extra room shows more sky and land around it. */
export function fitCamera() {
	const w = k.width();
	const h = k.height();
	// The top of the world is empty sky: show from FOCUS_TOP down, so figures are bigger on phones.
	viewScale = Math.min(w / WORLD.width, h / (WORLD.height - FOCUS_TOP));
	k.setCamScale(viewScale);
	// The bottom edge stays just under the ground band; extra height shows more sky above.
	const visibleH = h / viewScale;
	k.setCamPos(WORLD.width / 2, WORLD.height + 4 - visibleH / 2);
}

/** The world rectangle the screen shows. */
export function visibleWorld() {
	const tl = k.toWorld(k.vec2(0, 0));
	const br = k.toWorld(k.vec2(k.width(), k.height()));
	return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
}

/** Every scene starts with this: KAPLAY resets the camera and input events on a scene change. */
export function sceneSetup() {
	fitCamera();
	k.onResize(fitCamera);
}

fitCamera();
