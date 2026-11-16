/**
 * Playing as an elf: walk anywhere, in first or third person.
 * On a phone the left thumb walks with a stick and the right thumb looks around.
 * A space says where the elf can stand. The islands are one space, the inside of a home another.
 */

import * as THREE from 'three';
import { PIECE } from './content.ts';
import type { PieceId } from './content.ts';
import { camera, camTarget, setDriver } from './input.ts';
import type { Driver } from './input.ts';
import { bodyOf } from './life.ts';
import type { Villager } from './life.ts';
import { isLand, pieceAt, S } from './state.ts';
import { clamp, turnToward } from './util.ts';
import { groundY } from './view.ts';

/** Something the elf can do where it stands, shown as a big button. */
export interface Deed {
	label: string;
	run: () => void;
}

export interface Space {
	canStand: (x: number, z: number) => boolean;
	groundY: (x: number, z: number) => number;
	/** The size of the elf here. Rooms are drawn at a bigger scale than the islands. */
	scale: number;
	/** The group that holds the body of the elf in this space. */
	holder: THREE.Object3D;
	/** What the elf can do where it stands now. */
	deedAt: (x: number, z: number, yaw: number) => Deed | null;
	/** The farthest the third person camera may be. */
	camDist: number;
	/** What happens to the elf when the player lets go of it here. By default it walks on. */
	leave?: (v: Villager) => void;
}

/** What the shell does when the player starts or stops playing as an elf. */
export const driveEvents = {
	changed: (_on: boolean) => {},
	/** The player lets go of the elf. The shell can show its card again. */
	left: (_id: number) => {},
	click: () => {},
	step: () => {},
};

export const drive = {
	on: false,
	id: -1,
	view: 'third' as 'first' | 'third',
};

/** Pieces that an elf can walk over when the player leads it, though elves on their own go round. */
const SOFT = new Set<PieceId>(['flower', 'mushroom', 'garden', 'picnic', 'bench', 'stonebench']);

/** The islands, as a space to walk in. */
export function outdoors(holder: THREE.Object3D, deedAt: Space['deedAt']): Space {
	return {
		canStand: (x, z) => {
			const p = pieceAt(Math.round(x), Math.round(z));
			if (p) return !!PIECE[p.t].walk || SOFT.has(p.t);
			return isLand(Math.round(x), Math.round(z));
		},
		groundY: (x, z) => groundY(x, z),
		scale: 1,
		holder,
		deedAt,
		camDist: 2.3,
	};
}

let space: Space | null = null;
let body: Villager | null = null;
/** The group that held the body before the player took it. */
let origin: THREE.Object3D | null = null;
/** The angles of the camera. The elf turns toward where it walks. */
let yaw = 0;
const THIRD_PITCH = 0.42;
let pitch = THIRD_PITCH;
let stickId = -1;
let lookId = -1;
const stick = { ox: 0, oy: 0, x: 0, y: 0 };
let stepTimer = 0;
let deed: Deed | null = null;
let deedKey = '';
const RADIUS = 0.14;

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const el = {
	root: $('drive'),
	name: $('drive-name'),
	stick: $('drive-stick'),
	knob: $('drive-stick').firstElementChild as HTMLElement,
	act: $('drive-act') as HTMLButtonElement,
	view: $('drive-view'),
	hint: $('drive-hint'),
};

/* Input */

const driver: Driver = {
	down(id, x, y, touch) {
		// On touch, the left part of the screen is the stick. A mouse looks around with a drag.
		if (touch && x < window.innerWidth * 0.45 && stickId < 0) {
			stickId = id;
			stick.ox = stick.x = x;
			stick.oy = stick.y = y;
			el.stick.hidden = false;
			el.stick.style.transform = `translate(${x}px, ${y}px)`;
			el.knob.style.transform = '';
		} else if (lookId < 0) lookId = id;
	},
	move(id, x, y, dx, dy) {
		if (id === stickId) {
			stick.x = x;
			stick.y = y;
			const vx = x - stick.ox;
			const vy = y - stick.oy;
			const len = Math.hypot(vx, vy);
			const max = 52;
			const k = len > max ? max / len : 1;
			el.knob.style.transform = `translate(${vx * k}px, ${vy * k}px)`;
		} else if (id === lookId) {
			yaw -= dx * 0.006;
			pitch = clamp(pitch + dy * (drive.view === 'first' ? -0.005 : 0.005), drive.view === 'first' ? -1.1 : -0.15, drive.view === 'first' ? 1.1 : 1.25);
		}
	},
	up(id) {
		if (id === stickId) {
			stickId = -1;
			el.stick.hidden = true;
		}
		if (id === lookId) lookId = -1;
	},
	update(dt, keys, pad, pressed) {
		if (!body || !space) return;
		let mx = 0;
		let my = 0;
		if (keys.has('a') || keys.has('ArrowLeft')) mx -= 1;
		if (keys.has('d') || keys.has('ArrowRight')) mx += 1;
		if (keys.has('w') || keys.has('ArrowUp')) my -= 1;
		if (keys.has('s') || keys.has('ArrowDown')) my += 1;
		let run = keys.has('Shift');
		if (keys.has('q')) yaw += dt * 2;
		if (keys.has('e')) yaw -= dt * 2;
		if (stickId >= 0) {
			const vx = stick.x - stick.ox;
			const vy = stick.y - stick.oy;
			const len = Math.hypot(vx, vy);
			if (len > 8) {
				mx = vx / Math.max(len, 52);
				my = vy / Math.max(len, 52);
				run = len > 48;
			}
		}
		if (pad) {
			if (pad.lx || pad.ly) {
				mx = pad.lx;
				my = pad.ly;
				run = Math.hypot(pad.lx, pad.ly) > 0.9;
			}
			yaw -= pad.rx * dt * 2.4;
			pitch = clamp(pitch + pad.ry * dt * 1.6 * (drive.view === 'first' ? -1 : 1), -1.1, 1.25);
			if (pressed(0)) deed?.run();
			if (pressed(1)) stop();
			if (pressed(3)) toggleView();
		}
		walk(dt, mx, my, run);
	},
	key(k) {
		if (k === 'v') toggleView();
		else if (k === 'f' || k === 'Enter' || k === ' ') deed?.run();
		else return ['w', 'a', 's', 'd', 'q', 'e', 'Shift', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k);
		return true;
	},
};

/* Moving */

function free(x: number, z: number): boolean {
	if (!space) return false;
	const r = RADIUS * space.scale;
	return space.canStand(x, z) && space.canStand(x + r, z) && space.canStand(x - r, z) && space.canStand(x, z + r) && space.canStand(x, z - r);
}

function walk(dt: number, mx: number, my: number, run: boolean): void {
	if (!body || !space) return;
	const len = Math.min(1, Math.hypot(mx, my));
	if (len > 0.05) {
		// The stick is in screen space: up is where the camera looks.
		const fx = -Math.sin(yaw);
		const fz = -Math.cos(yaw);
		const rx = Math.cos(yaw);
		const rz = -Math.sin(yaw);
		const speed = (run ? 2.1 : 1.15) * space.scale * dt;
		const dx = (fx * -my + rx * mx) * speed;
		const dz = (fz * -my + rz * mx) * speed;
		// Slide along walls: try each axis on its own.
		if (free(body.x + dx, body.z)) body.x += dx;
		if (free(body.x, body.z + dz)) body.z += dz;
		const face = Math.atan2(-dx, -dz);
		body.yaw = drive.view === 'first' ? yaw : turnToward(body.yaw, face, Math.min(1, dt * 12));
		body.step += dt * (run ? 16 : 11) * len;
		body.act = 'stroll';
		stepTimer -= dt * (run ? 1.6 : 1) * len;
		if (stepTimer <= 0) {
			stepTimer = 0.32;
			driveEvents.step();
		}
	} else {
		body.act = 'home';
		if (drive.view === 'first') body.yaw = yaw;
	}
	placeBody();
	placeCamera();
	updateDeed();
}

function placeBody(): void {
	if (!body || !space) return;
	body.obj.scale.setScalar(space.scale);
	body.obj.visible = drive.view === 'third';
}

const _head = new THREE.Vector3();

function placeCamera(): void {
	if (!body || !space) return;
	const s = space.scale;
	const gy = space.groundY(body.x, body.z);
	if (drive.view === 'first') {
		_head.set(body.x - Math.sin(yaw) * 0.05 * s, gy + 0.3 * s, body.z - Math.cos(yaw) * 0.05 * s);
		camera.position.copy(_head);
		camera.lookAt(_head.x - Math.sin(yaw) * Math.cos(pitch), _head.y + Math.sin(pitch), _head.z - Math.cos(yaw) * Math.cos(pitch));
	} else {
		_head.set(body.x, gy + 0.36 * s, body.z);
		const d = space.camDist * s;
		const flat = Math.cos(pitch) * d;
		camera.position.set(_head.x + Math.sin(yaw) * flat, _head.y + Math.sin(pitch) * d, _head.z + Math.cos(yaw) * flat);
		camera.position.y = Math.max(camera.position.y, space.groundY(camera.position.x, camera.position.z) + 0.08 * s);
		camera.lookAt(_head);
	}
	camera.updateMatrixWorld();
	camTarget.set(body.x, 0, body.z);
}

function updateDeed(): void {
	if (!body || !space) return;
	const d = space.deedAt(body.x, body.z, body.yaw);
	const k = d?.label ?? '';
	deed = d;
	if (k === deedKey) return;
	deedKey = k;
	el.act.hidden = !d;
	el.act.textContent = k;
}

function toggleView(): void {
	drive.view = drive.view === 'first' ? 'third' : 'first';
	pitch = drive.view === 'first' ? 0 : THIRD_PITCH;
	if (body && drive.view === 'first') yaw = body.yaw;
	el.view.setAttribute('aria-pressed', String(drive.view === 'first'));
	el.view.setAttribute('aria-label', drive.view === 'first' ? 'Switch to third person' : 'Switch to first person');
	driveEvents.click();
	placeBody();
}

/* Starting and stopping */

/** Moves the elf into a space: the islands or a room. */
export function enterSpace(s: Space, x: number, z: number, faceYaw: number): void {
	if (!body) return;
	space = s;
	s.holder.add(body.obj);
	body.ground = s.groundY;
	body.x = x;
	body.z = z;
	body.yaw = faceYaw;
	yaw = faceYaw;
	pitch = drive.view === 'first' ? 0 : THIRD_PITCH;
	deedKey = '-';
	placeBody();
	placeCamera();
	updateDeed();
}

/** Starts playing as an elf. `start` gives the space and the place to start in. */
export function start(id: number, s: Space, x: number, z: number, faceYaw: number): boolean {
	const v = bodyOf(id);
	const f = S.folk.get(id);
	if (!v || !f) return false;
	if (drive.on) stop(true);
	drive.on = true;
	drive.id = id;
	body = v;
	origin = v.obj.parent;
	v.state = 'driven';
	v.path = [];
	v.goal = null;
	v.emote.visible = false;
	v.wave = 0;
	camera.near = 0.03;
	camera.updateProjectionMatrix();
	enterSpace(s, x, z, faceYaw);
	el.name.textContent = f.name;
	el.root.hidden = false;
	el.stick.hidden = true;
	el.hint.textContent = matchMedia('(pointer: coarse)').matches ? 'Left thumb walks. Right thumb looks.' : 'WASD walks, Shift runs. Drag to look. V turns the view.';
	el.hint.classList.remove('drive__hint--out');
	window.setTimeout(() => el.hint.classList.add('drive__hint--out'), 4200);
	setDriver(driver);
	driveEvents.changed(true);
	return true;
}

/** Lets go of the elf. It goes back to its plan for the day. */
export function stop(quiet = false): void {
	if (!drive.on) return;
	const id = drive.id;
	drive.on = false;
	drive.id = -1;
	if (body) {
		origin?.add(body.obj);
		body.obj.scale.setScalar(1);
		body.ground = undefined;
		if (space?.leave) space.leave(body);
		else {
			body.state = 'stay';
			body.wait = 0.4;
			body.act = 'stroll';
			body.obj.visible = true;
		}
	}
	body = null;
	space = null;
	stickId = lookId = -1;
	camera.near = 0.5;
	camera.updateProjectionMatrix();
	setDriver(null);
	el.root.hidden = true;
	driveEvents.changed(false);
	if (!quiet) driveEvents.left(id);
}

/** The body that the player steers, for other modules. */
export const drivenBody = (): Villager | null => body;
export const currentSpace = (): Space | null => space;

export function initDrive(): void {
	$('drive-exit').addEventListener('click', () => {
		driveEvents.click();
		stop();
	});
	el.view.addEventListener('click', toggleView);
	el.act.addEventListener('click', () => deed?.run());
}
