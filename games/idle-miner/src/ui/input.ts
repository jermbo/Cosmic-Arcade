// Pointer, wheel and keyboard input on the canvas and the page.

import { initAudio, sfx } from '../audio.ts';
import { PLANETS } from '../content/planets.ts';
import { cellX, cellY } from '../core/grid.ts';
import { fmt } from '../core/format.ts';
import { rotateAt } from '../core/build.ts';
import { tap } from '../core/hand-mining.ts';
import { incomeRate } from '../core/income.ts';
import { closePanel, isLocked, panelOpen } from './modal.ts';
import { openPause } from './panels/pause.ts';
import { session } from '../session.ts';
import { canvas, ui } from './elements.ts';
import { bumpCredits } from './hud.ts';
import { inspectAct, select } from './inspect.ts';
import { updateCard } from './planet-card.ts';
import { relayout, startGame, toPlanet, toSpace } from './screens.ts';
import { toast } from './toasts.ts';
import { availableTools, setTool } from './toolbar.ts';
import { buzz } from './vibrate.ts';
import { pv, space } from '../views.ts';

let tapCombo = 0;

let lastTapAt = 0;

const pointers = new Map<number, { x: number; y: number }>();

/** Two-finger gesture: last finger distance and midpoint. */
let pinch: { dist: number; x: number; y: number } | null = null;

/** One-finger press on the space map: a tap on release, or a pan once it moves. */
let spaceDrag: { id: number; x0: number; y0: number; x: number; y: number; moved: boolean; tap: boolean } | null = null;

/** The camera for the current view. */
function cam() {
	return session.view === 'planet' ? pv : space;
}

function pinchState() {
	const [a, b] = [...pointers.values()];
	return { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const up = (e: PointerEvent) => {
	pointers.delete(e.pointerId);
	if (pointers.size < 2) pinch = null;
	if (!session.started) return;
	if (session.view === 'space' && spaceDrag?.id === e.pointerId) {
		const d = spaceDrag;
		spaceDrag = null;
		canvas.style.cursor = 'default';
		if (!d.moved && d.tap) spaceTap(e.clientX, e.clientY);
		return;
	}
	if (session.view === 'planet') {
		pv.build.pointerUp(session.g, e.clientX, e.clientY, e.pointerId);
		if (e.pointerType !== 'mouse') pv.hover = null;
	}
};

/** A mouse wheel moves in big notches; a trackpad sends many small, smooth deltas. */
function isWheelNotch(e: WheelEvent) {
	if (e.deltaMode !== 0) return true;
	return e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY);
}

// Safari sends trackpad pinch as gesture events instead of ctrl + wheel.
let gestureScale = 1;

function spaceTap(x: number, y: number) {
	const hit = space.hit(session.g, x, y);
	if (hit >= 0) {
		const p = session.g.planets[hit];
		if (p.unlocked) {
			const v = tap(session.g, hit);
			const now = performance.now();
			tapCombo = now - lastTapAt < 500 ? tapCombo + 1 : 0;
			lastTapAt = now;
			space.tapPlanet(hit, v, PLANETS[hit].color);
			sfx.tap(tapCombo);
			buzz(8);
			bumpCredits();
		} else sfx.click();
		if (space.selected !== hit) {
			space.selected = hit;
			updateCard();
		}
	} else if (hit === -2) {
		toast(`Home station. Cargo sells here. Income: ${fmt(incomeRate())}/s`);
	} else {
		space.selected = -1;
		updateCard();
	}
}

/** Adds the listeners. main.ts calls it once, at boot. */
export function initInput() {
	canvas.addEventListener('pointerdown', (e) => {
		initAudio();
		if (!session.started) return;
		canvas.setPointerCapture?.(e.pointerId);
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.size === 2) {
			spaceDrag = null;
			// A second finger turns any drag into pinch + pan.
			pv.build.pointerCancel();
			pinch = pinchState();
			return;
		}
		if (pointers.size > 2) return;
		if (session.view === 'space') {
			spaceDrag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, tap: e.button === 0 };
			return;
		}
		if (e.button === 1 || e.button === 2) pv.build.startPan(e.clientX, e.clientY, e.pointerId);
		else pv.build.pointerDown(session.g, e.clientX, e.clientY, e.pointerId);
	});

	canvas.addEventListener('pointermove', (e) => {
		if (!session.started) return;
		if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pinch && pointers.size >= 2) {
			const now = pinchState();
			if (pinch.dist > 0) cam().zoomAt(now.dist / pinch.dist, now.x, now.y);
			cam().panBy(now.x - pinch.x, now.y - pinch.y);
			pinch = now;
			return;
		}
		if (session.view === 'space' && spaceDrag?.id === e.pointerId) {
			if (!spaceDrag.moved && Math.hypot(e.clientX - spaceDrag.x0, e.clientY - spaceDrag.y0) > 8) spaceDrag.moved = true;
			if (spaceDrag.moved) space.panBy(e.clientX - spaceDrag.x, e.clientY - spaceDrag.y);
			spaceDrag.x = e.clientX;
			spaceDrag.y = e.clientY;
			canvas.style.cursor = spaceDrag.moved ? 'grabbing' : canvas.style.cursor;
			return;
		}
		if (session.view === 'planet') {
			pv.build.pointerMove(session.g, e.clientX, e.clientY, e.pointerId);
			if (e.pointerType !== 'mouse' && !pointers.has(e.pointerId)) pv.hover = null;
		} else canvas.style.cursor = space.hit(session.g, e.clientX, e.clientY) !== -1 ? 'pointer' : 'default';
	});

	canvas.addEventListener('pointerup', up);

	canvas.addEventListener('pointercancel', (e) => {
		pointers.delete(e.pointerId);
		if (pointers.size < 2) pinch = null;
		spaceDrag = null;
		pv.build.pointerCancel();
	});

	canvas.addEventListener('pointerleave', () => (pv.hover = null));

	canvas.addEventListener('contextmenu', (e) => e.preventDefault());

	canvas.addEventListener(
		'wheel',
		(e) => {
			if (!session.started) return;
			e.preventDefault();
			if (e.ctrlKey) {
				// Trackpad pinch (browsers send it as ctrl + wheel).
				cam().zoomAt(Math.exp(-e.deltaY * 0.008), e.clientX, e.clientY);
			} else if (isWheelNotch(e)) {
				const step = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
				cam().zoomAt(Math.exp(-Math.max(-120, Math.min(120, step)) * 0.0012), e.clientX, e.clientY);
			} else {
				// Two-finger trackpad scroll pans.
				cam().panBy(-e.deltaX, -e.deltaY);
				return;
			}
			if (session.view === 'planet') relayout();
		},
		{ passive: false },
	);

	canvas.addEventListener('gesturestart', (e) => {
		e.preventDefault();
		gestureScale = 1;
	});

	canvas.addEventListener('gesturechange', (e) => {
		if (!session.started) return;
		e.preventDefault();
		const ge = e as unknown as { scale: number; clientX: number; clientY: number };
		cam().zoomAt(ge.scale / gestureScale, ge.clientX, ge.clientY);
		gestureScale = ge.scale;
		if (session.view === 'planet') relayout();
	});

	window.addEventListener('keydown', (e) => {
		if (!session.started) {
			if (e.key === 'Enter' && ui.title.hidden === false && !panelOpen()) startGame();
			return;
		}
		if (panelOpen()) {
			if (e.key === 'Escape' && !isLocked()) closePanel();
			return;
		}
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
		if (e.key === 'Escape') {
			if (session.view === 'planet') {
				if (pv.tool) setTool(null);
				else if (pv.selected !== null) select(null);
				else toSpace();
			} else openPause();
			return;
		}
		if (e.key === 'Tab') {
			e.preventDefault();
			if (session.view === 'planet') toSpace();
			else toPlanet(space.selected >= 0 && session.g.planets[space.selected].unlocked ? space.selected : 0);
			return;
		}
		if (session.view !== 'planet') {
			if (e.key === 'f' || e.key === 'F') space.resetCamera();
			if (e.key === ' ' && space.selected >= 0 && session.g.planets[space.selected].unlocked) {
				e.preventDefault();
				const p = space.screenPos(space.selected);
				spaceTap(p.x, p.y);
			}
			return;
		}
		const n = Number(e.key);
		if (n >= 1 && n <= 9) {
			const tools = availableTools();
			const t = tools[n - 1];
			if (t) setTool(pv.tool === t ? null : t);
		}
		if (e.key === '0') setTool(pv.tool === 'remove' ? null : 'remove');
		if (e.key === 'r' || e.key === 'R') {
			if (pv.selected !== null) {
				rotateAt(session.g, pv.pi, cellX(pv.selected), cellY(pv.selected));
				sfx.click();
			}
		}
		if ((e.key === 'Delete' || e.key === 'Backspace') && pv.selected !== null) inspectAct('remove');
		if (e.key === 'u' || e.key === 'U') inspectAct('upgrade');
		if (e.key === 'f' || e.key === 'F') {
			pv.resetCamera();
			relayout();
		}
	});
}
