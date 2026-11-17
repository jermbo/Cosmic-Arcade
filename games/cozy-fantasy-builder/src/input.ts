/** The camera and every way to steer it: touch, mouse, keys and gamepad. */

import * as THREE from 'three';
import { WORLD_RADIUS } from './content.ts';
import { clamp, lerp } from './util.ts';

export const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 600);

/** The view the camera has now, and the view it moves toward. */
const view = { x: 1, z: 0, yaw: 0.65, pitch: 0.78, dist: 26 };
const goal = { ...view };
export const camTarget = new THREE.Vector3();

/** How the player steers now. It decides if a cursor shows. */
export type Mode = 'touch' | 'mouse' | 'cursor';

export const input = {
	mode: 'mouse' as Mode,
	/** The cell under the mouse, the key cursor or the gamepad cursor. */
	cx: 0,
	cz: 0,
	hasCell: false,
	/** False while a menu is open: the world does not take input. */
	active: false,
};

/** What the game does with input. The shell sets these. */
export const actions = {
	tap: (_x: number, _z: number) => {},
	/** A tap, as a line from the eye into the world. Returns true when a creature took the tap. */
	tapRay: (_ray: THREE.Ray): boolean => false,
	/** A drag begins on a cell. Returns true when it draws a road. Then the view does not move. */
	roadStart: (_x: number, _z: number): boolean => false,
	roadMove: (_x: number, _z: number) => {},
	/** The drag is over. `keep` is false when a second finger broke it off. */
	roadEnd: (_keep: boolean) => {},
	place: () => {},
	eraseAtCursor: () => {},
	rotate: () => {},
	undo: () => {},
	redo: () => {},
	cyclePiece: (_step: number) => {},
	pickSlot: (_index: number) => {},
	pause: () => {},
	book: () => {},
	goals: () => {},
	/** In a menu: move the focus, press the focused button, or go back. */
	menuMove: (_step: number) => {},
	menuPress: () => {},
	menuBack: () => {},
	menuAdjust: (_step: number) => {},
	modeChanged: () => {},
	/** The player moved the view by hand. */
	viewDragged: () => {},
};

/**
 * Another module can take over pointers, held keys and the gamepad, for walking as an elf.
 * Then the build camera stands still and the driver moves the camera itself.
 */
export interface Driver {
	down: (id: number, x: number, y: number, touch: boolean) => void;
	move: (id: number, x: number, y: number, dx: number, dy: number) => void;
	up: (id: number, tap: boolean, x: number, y: number) => void;
	/** Each frame: the held keys and the sticks of the gamepad. */
	update: (dt: number, keys: Set<string>, pad: { lx: number; ly: number; rx: number; ry: number } | null, pressed: (i: number) => boolean) => void;
	key: (k: string) => boolean;
	/** The mouse wheel, as a zoom factor. */
	wheel?: (factor: number) => void;
	/** The mouse moves with no button down. */
	hover?: (x: number, y: number) => void;
}

let driver: Driver | null = null;

export function setDriver(d: Driver | null): void {
	driver = d;
	pointers.clear();
	pinch = null;
	multi = false;
	held.clear();
}

/** Puts the build camera back where it was, after a driver lets go. */
export function placeBuildCamera(): void {
	placeCamera();
}

const MIN_DIST = 5;
const MAX_DIST = 78;
const ray = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();
const _ndc = new THREE.Vector2();
let canvas: HTMLCanvasElement;
/** The gamepad cursor moves smoothly; this is its exact place. */
const stick = { x: 0, z: 0 };

function setMode(m: Mode): void {
	if (input.mode === m) return;
	input.mode = m;
	if (m === 'cursor') {
		stick.x = input.hasCell ? input.cx : Math.round(view.x);
		stick.z = input.hasCell ? input.cz : Math.round(view.z);
		input.cx = stick.x;
		input.cz = stick.z;
		input.hasCell = true;
	}
	actions.modeChanged();
}

/** The point on the ground under a place on the screen. */
function groundAt(px: number, py: number): THREE.Vector3 | null {
	const r = canvas.getBoundingClientRect();
	_ndc.set(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
	ray.setFromCamera(_ndc, camera);
	return ray.ray.intersectPlane(ground, _hit);
}

function clampGoal(): void {
	const d = Math.hypot(goal.x, goal.z);
	if (d > WORLD_RADIUS) {
		goal.x *= WORLD_RADIUS / d;
		goal.z *= WORLD_RADIUS / d;
	}
	goal.dist = clamp(goal.dist, MIN_DIST, MAX_DIST);
	goal.pitch = clamp(goal.pitch, 0.2, 1.35);
}

function panBy(dx: number, dz: number): void {
	goal.x += dx;
	goal.z += dz;
	clampGoal();
	// A drag moves the view at once, so the ground stays under the finger.
	view.x = goal.x;
	view.z = goal.z;
	placeCamera();
}

function placeCamera(): void {
	camTarget.set(view.x, 0, view.z);
	const flat = Math.cos(view.pitch) * view.dist;
	camera.position.set(view.x + Math.sin(view.yaw) * flat, Math.sin(view.pitch) * view.dist, view.z + Math.cos(view.yaw) * flat);
	camera.lookAt(camTarget);
	camera.updateMatrixWorld();
}

export const cameraYaw = (): number => view.yaw;

/** Resets the camera to look at the home island. A tall screen starts farther back. */
export function resetCamera(): void {
	const tall = camera.aspect < 1;
	Object.assign(goal, { x: 0.5, z: 0, yaw: 0.65, pitch: 0.54, dist: tall ? 52 : 36 });
	Object.assign(view, goal, { dist: goal.dist + 10, yaw: goal.yaw - 0.5 });
}

/** Glides the camera to look at a place, for a jump to another island. */
export function flyTo(x: number, z: number, dist?: number): void {
	goal.x = x;
	goal.z = z;
	if (dist) goal.dist = dist;
	clampGoal();
}

/* Pointers: touch and mouse */

interface Pointer {
	x: number;
	y: number;
	startX: number;
	startY: number;
	button: number;
	moved: boolean;
	touch: boolean;
	/** This drag draws a road. */
	road: boolean;
}
const pointers = new Map<number, Pointer>();
let pinch: { dist: number; angle: number; midX: number; midY: number } | null = null;
let multi = false;

function pinchState(): { dist: number; angle: number; midX: number; midY: number } {
	const [a, b] = [...pointers.values()];
	return { dist: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
}

function onDown(e: PointerEvent): void {
	if (!input.active) return;
	try {
		canvas.setPointerCapture(e.pointerId);
	} catch {
		/* A pointer that is already gone. Nothing to capture. */
	}
	const touch = e.pointerType !== 'mouse';
	if (driver) {
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, button: e.button, moved: false, touch, road: false });
		driver.down(e.pointerId, e.clientX, e.clientY, touch);
		return;
	}
	setMode(touch ? 'touch' : 'mouse');
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, button: e.button, moved: false, touch, road: false });
	if (pointers.size === 2) {
		pinch = pinchState();
		multi = true;
		// A second finger ends a road drag. Two fingers always move the view.
		for (const o of pointers.values()) {
			if (o.road) actions.roadEnd(false);
			o.road = false;
		}
	}
}

function onMove(e: PointerEvent): void {
	const p = pointers.get(e.pointerId);
	if (!p) {
		if (driver) {
			if (e.pointerType === 'mouse' && input.active) driver.hover?.(e.clientX, e.clientY);
			return;
		}
		if (e.pointerType === 'mouse' && input.active) {
			setMode('mouse');
			hover(e.clientX, e.clientY);
		}
		return;
	}
	const dx = e.clientX - p.x;
	const dy = e.clientY - p.y;
	if (driver) {
		if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 10) p.moved = true;
		p.x = e.clientX;
		p.y = e.clientY;
		driver.move(e.pointerId, e.clientX, e.clientY, dx, dy);
		return;
	}
	if (!p.moved && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > (p.touch ? 10 : 5)) {
		p.moved = true;
		if (p.button === 0 && !multi && pointers.size === 1) {
			const from = groundAt(p.startX, p.startY);
			if (from) p.road = actions.roadStart(Math.round(from.x), Math.round(from.z));
		}
	}
	if (p.road) {
		const hit = groundAt(e.clientX, e.clientY);
		if (hit) actions.roadMove(Math.round(hit.x), Math.round(hit.z));
		p.x = e.clientX;
		p.y = e.clientY;
		if (!p.touch) hover(e.clientX, e.clientY);
		return;
	}

	if (pointers.size >= 2 && pinch) {
		// Two fingers: pinch to zoom, twist to turn, slide to move.
		p.x = e.clientX;
		p.y = e.clientY;
		const now = pinchState();
		goal.dist *= pinch.dist / Math.max(20, now.dist);
		let turn = now.angle - pinch.angle;
		if (turn > Math.PI) turn -= Math.PI * 2;
		if (turn < -Math.PI) turn += Math.PI * 2;
		goal.yaw += turn;
		view.yaw = goal.yaw;
		clampGoal();
		view.dist = goal.dist;
		placeCamera();
		const before = groundAt(pinch.midX, pinch.midY)?.clone();
		const after = groundAt(now.midX, now.midY);
		if (before && after) panBy(before.x - after.x, before.z - after.z);
		pinch = now;
		return;
	}

	if (p.moved) {
		if (p.button === 2 || p.button === 1) {
			goal.yaw -= dx * 0.008;
			goal.pitch += dy * 0.006;
			clampGoal();
		} else if (!multi) {
			const before = groundAt(p.x, p.y)?.clone();
			const after = groundAt(e.clientX, e.clientY);
			if (before && after) panBy(before.x - after.x, before.z - after.z);
			actions.viewDragged();
		}
	}
	p.x = e.clientX;
	p.y = e.clientY;
	if (!p.touch) hover(e.clientX, e.clientY);
}

function onUp(e: PointerEvent): void {
	const p = pointers.get(e.pointerId);
	if (!p) return;
	pointers.delete(e.pointerId);
	if (driver) {
		driver.up(e.pointerId, !p.moved && e.type !== 'pointercancel', e.clientX, e.clientY);
		return;
	}
	if (pointers.size < 2) pinch = null;
	const wasMulti = multi;
	if (pointers.size === 0) multi = false;
	if (p.road) {
		actions.roadEnd(e.type !== 'pointercancel');
		return;
	}
	if (e.type === 'pointercancel' || p.moved || wasMulti || p.button !== 0 || !input.active) return;
	const hit = groundAt(e.clientX, e.clientY);
	if (actions.tapRay(ray.ray)) return;
	if (hit) actions.tap(Math.round(hit.x), Math.round(hit.z));
}

function hover(px: number, py: number): void {
	const hit = groundAt(px, py);
	input.hasCell = !!hit;
	if (hit) {
		input.cx = Math.round(hit.x);
		input.cz = Math.round(hit.z);
	}
}

function onWheel(e: WheelEvent): void {
	if (!input.active) return;
	e.preventDefault();
	const amount = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
	if (driver) {
		driver.wheel?.(Math.exp(clamp(amount, -200, 200) * (e.ctrlKey ? 0.01 : 0.0012)));
		return;
	}
	goal.dist *= Math.exp(clamp(amount, -200, 200) * (e.ctrlKey ? 0.01 : 0.0012));
	clampGoal();
}

/* Keys */

const held = new Set<string>();

/** Moves the cell cursor one step, as the player sees it on screen. */
function nudge(right: number, down: number): void {
	setMode('cursor');
	// Snap the camera angle to the nearest quarter turn, so a key press is one clear step.
	const q = Math.round(view.yaw / (Math.PI / 2));
	const s = Math.round(Math.sin((q * Math.PI) / 2));
	const c = Math.round(Math.cos((q * Math.PI) / 2));
	stick.x = clamp(Math.round(stick.x) + right * c + down * s, -WORLD_RADIUS, WORLD_RADIUS);
	stick.z = clamp(Math.round(stick.z) - right * s + down * c, -WORLD_RADIUS, WORLD_RADIUS);
	input.cx = stick.x;
	input.cz = stick.z;
	input.hasCell = true;
}

function onKey(e: KeyboardEvent): void {
	const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
	const mod = e.ctrlKey || e.metaKey;
	if (mod && k === 'z') {
		e.preventDefault();
		if (input.active) (e.shiftKey ? actions.redo : actions.undo)();
		return;
	}
	if (mod && k === 'y') {
		e.preventDefault();
		if (input.active) actions.redo();
		return;
	}
	if (mod || e.altKey) return;
	if (k === 'Escape') {
		e.preventDefault();
		if (input.active) actions.pause();
		else actions.menuBack();
		return;
	}
	if (!input.active) return;
	const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT';
	if (typing) return;
	held.add(k);
	if (driver) {
		if (driver.key(k)) e.preventDefault();
		return;
	}
	switch (k) {
		case 'ArrowLeft':
		case 'a':
			nudge(-1, 0);
			break;
		case 'ArrowRight':
		case 'd':
			nudge(1, 0);
			break;
		case 'ArrowUp':
		case 'w':
			nudge(0, -1);
			break;
		case 'ArrowDown':
		case 's':
			nudge(0, 1);
			break;
		case 'Enter':
		case ' ':
			if ((e.target as HTMLElement | null)?.tagName === 'BUTTON') return;
			setMode('cursor');
			actions.place();
			break;
		case 'Delete':
		case 'Backspace':
		case 'x':
			actions.eraseAtCursor();
			break;
		case 'r':
			actions.rotate();
			break;
		case 'b':
			actions.book();
			break;
		case 'g':
			actions.goals();
			break;
		case '[':
		case ',':
			actions.cyclePiece(-1);
			break;
		case ']':
		case '.':
			actions.cyclePiece(1);
			break;
		default:
			if (/^[0-9]$/.test(k)) actions.pickSlot(k === '0' ? 9 : Number(k) - 1);
			else return;
	}
	e.preventDefault();
}

/* Gamepad */

const padWas: boolean[] = [];
/** The driver got its update from the gamepad this frame. */
let padDriven = false;
let padRepeat = 0;
let menuRepeat = 0;

function readPad(dt: number): void {
	const pad = navigator.getGamepads?.().find((p) => p && p.connected);
	if (!pad) return;
	const down = (i: number): boolean => !!pad.buttons[i]?.pressed;
	const hit = (i: number): boolean => down(i) && !padWas[i];
	const dead = (v: number): number => (Math.abs(v) < 0.22 ? 0 : v);
	const lx = dead(pad.axes[0] ?? 0);
	const ly = dead(pad.axes[1] ?? 0);
	const rx = dead(pad.axes[2] ?? 0);
	const ry = dead(pad.axes[3] ?? 0);
	const any = lx || ly || rx || ry || pad.buttons.some((b) => b.pressed);
	if (driver && input.active) {
		driver.update(dt, held, { lx, ly, rx, ry }, hit);
		for (let i = 0; i < pad.buttons.length; i++) padWas[i] = down(i);
		padDriven = true;
		return;
	}
	if (any && input.active) setMode('cursor');

	if (!input.active) {
		// In a menu: the pad moves the focus.
		const dir = (down(13) || ly > 0.5 ? 1 : 0) - (down(12) || ly < -0.5 ? 1 : 0);
		const side = (down(15) || lx > 0.5 ? 1 : 0) - (down(14) || lx < -0.5 ? 1 : 0);
		menuRepeat -= dt;
		if (!dir && !side) menuRepeat = 0;
		else if (menuRepeat <= 0) {
			menuRepeat = 0.22;
			if (dir) actions.menuMove(dir);
			else actions.menuAdjust(side);
		}
		if (hit(0)) actions.menuPress();
		if (hit(1) || hit(9)) actions.menuBack();
	} else {
		if (lx || ly) {
			const speed = 7 * dt;
			const s = Math.sin(view.yaw);
			const c = Math.cos(view.yaw);
			stick.x = clamp(stick.x + (lx * c + ly * s) * speed, -WORLD_RADIUS, WORLD_RADIUS);
			stick.z = clamp(stick.z + (-lx * s + ly * c) * speed, -WORLD_RADIUS, WORLD_RADIUS);
			input.cx = Math.round(stick.x);
			input.cz = Math.round(stick.z);
		}
		const px = (down(15) ? 1 : 0) - (down(14) ? 1 : 0);
		const py = (down(13) ? 1 : 0) - (down(12) ? 1 : 0);
		padRepeat -= dt;
		if (!px && !py) padRepeat = 0;
		else if (padRepeat <= 0) {
			padRepeat = 0.16;
			nudge(px, py);
		}
		goal.yaw -= rx * dt * 2;
		goal.dist *= Math.exp(ry * dt * 1.2);
		clampGoal();
		if (hit(0)) actions.place();
		if (hit(1)) actions.eraseAtCursor();
		if (hit(2)) actions.rotate();
		if (hit(3)) actions.book();
		if (hit(4)) actions.cyclePiece(-1);
		if (hit(5)) actions.cyclePiece(1);
		if (hit(6)) actions.undo();
		if (hit(7)) actions.redo();
		if (hit(8)) actions.goals();
		if (hit(9)) actions.pause();
	}
	for (let i = 0; i < pad.buttons.length; i++) padWas[i] = down(i);
}

export function initInput(el: HTMLCanvasElement): void {
	canvas = el;
	el.addEventListener('pointerdown', onDown);
	el.addEventListener('pointermove', onMove);
	el.addEventListener('pointerup', onUp);
	el.addEventListener('pointercancel', onUp);
	el.addEventListener('pointerleave', (e) => {
		if (e.pointerType === 'mouse' && input.mode === 'mouse') input.hasCell = false;
	});
	el.addEventListener('wheel', onWheel, { passive: false });
	el.addEventListener('contextmenu', (e) => e.preventDefault());
	window.addEventListener('keydown', onKey);
	window.addEventListener('keyup', (e) => held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
	window.addEventListener('blur', () => held.clear());
}

/** Each frame: reads held keys and the gamepad, and eases the camera. `orbit` turns it slowly, for the title. */
export function updateInput(dt: number, orbit: boolean): void {
	padDriven = false;
	readPad(dt);
	if (driver) {
		if (!padDriven) driver.update(dt, input.active ? held : new Set(), null, () => false);
		return;
	}
	if (input.active) {
		if (held.has('q')) goal.yaw += dt * 1.6;
		if (held.has('e')) goal.yaw -= dt * 1.6;
		if (held.has('=') || held.has('+')) goal.dist *= Math.exp(-dt * 1.4);
		if (held.has('-') || held.has('_')) goal.dist *= Math.exp(dt * 1.4);
		if (input.mode === 'cursor') {
			// The camera follows the cursor when it nears the edge of the view.
			const far = Math.hypot(stick.x - goal.x, stick.z - goal.z);
			const slack = goal.dist * 0.16;
			if (far > slack) {
				const pull = Math.min(1, dt * 3) * (1 - slack / far);
				goal.x += (stick.x - goal.x) * pull;
				goal.z += (stick.z - goal.z) * pull;
			}
		}
		clampGoal();
	}
	if (orbit) goal.yaw += dt * 0.05;
	const ease = 1 - Math.exp(-dt * 9);
	view.x = lerp(view.x, goal.x, ease);
	view.z = lerp(view.z, goal.z, ease);
	view.yaw = lerp(view.yaw, goal.yaw, ease);
	view.pitch = lerp(view.pitch, goal.pitch, ease);
	view.dist = lerp(view.dist, goal.dist, ease);
	placeCamera();
}

/** Keeps the camera on a moving point, for following an elf. */
export function followTo(x: number, z: number, dist?: number): void {
	goal.x = x;
	goal.z = z;
	if (dist) goal.dist = Math.min(goal.dist, dist);
	clampGoal();
}

/** Zooms by a factor, for the on-screen buttons. */
export function zoomBy(factor: number): void {
	goal.dist *= factor;
	clampGoal();
}

export function turnBy(angle: number): void {
	goal.yaw += angle;
}
