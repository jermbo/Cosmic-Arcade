// Aim input for a fight. Touch and mouse: drag back anywhere, release to shoot.
// Keyboard: arrows aim (up/down angle, left/right pull), hold and release Space.
// Gamepad: left stick aims (push further for more pull), hold and release A or the right trigger.

import type { Vec2 } from 'kaplay';
import { BOW } from '../rules/data/balance.ts';
import type { Battle } from '../rules/combat.ts';
import { k, viewScale } from './k.ts';

export type Device = 'touch' | 'keys' | 'pad';

const MIN_ANGLE = -1.45;
const MAX_ANGLE = 0.5;

export class AimInput {
	battle: Battle;
	device: Device = 'touch';
	origin: Vec2 | null = null;
	current: Vec2 | null = null;
	/** Resting aim for keys and pad. */
	angle = -0.42;
	pull = 0.85;
	enabled = true;
	private keyDrawing = false;
	private padDrawing = false;
	onShot: () => void = () => {};
	onBegin: () => void = () => {};

	constructor(battle: Battle) {
		this.battle = battle;
		k.onMousePress(() => {
			if (!this.enabled) return;
			this.device = 'touch';
			this.origin = k.mousePos();
			this.current = this.origin;
			this.battle.beginDraw();
			this.battle.setAim(this.battle.angle, 0);
			this.onBegin();
		});
		k.onMouseMove(() => {
			if (!this.origin) return;
			this.current = k.mousePos();
			this.applyDrag();
		});
		k.onMouseRelease(() => {
			if (!this.origin) return;
			this.current = k.mousePos();
			const len = this.applyDrag();
			this.origin = null;
			this.current = null;
			if (len < BOW.deadZone) {
				this.battle.cancelDraw();
				return;
			}
			if (this.battle.release()) this.onShot();
		});

		k.onKeyPress('space', () => {
			if (!this.enabled || this.keyDrawing) return;
			this.device = 'keys';
			this.keyDrawing = true;
			this.battle.beginDraw();
			this.onBegin();
		});
		k.onKeyRelease('space', () => {
			if (!this.keyDrawing) return;
			this.keyDrawing = false;
			this.battle.setAim(this.angle, this.pull);
			if (this.battle.release()) this.onShot();
		});
		const padDown = () => {
			if (!this.enabled || this.padDrawing) return;
			this.device = 'pad';
			this.padDrawing = true;
			this.battle.beginDraw();
			this.onBegin();
		};
		const padUp = () => {
			if (!this.padDrawing) return;
			this.padDrawing = false;
			this.battle.setAim(this.angle, this.pull);
			if (this.battle.release()) this.onShot();
		};
		k.onGamepadButtonPress(['south', 'rtrigger'], padDown);
		k.onGamepadButtonRelease(['south', 'rtrigger'], padUp);
	}

	/** Sets the battle aim from the drag. Returns the drag length in world units. */
	private applyDrag(): number {
		if (!this.origin || !this.current) return 0;
		const dx = (this.origin.x - this.current.x) / viewScale;
		const dy = (this.origin.y - this.current.y) / viewScale;
		const len = Math.hypot(dx, dy);
		let angle = Math.atan2(dy, dx);
		if (angle < -Math.PI / 2 - 0.0001) angle = MIN_ANGLE;
		else if (angle > Math.PI / 2) angle = MAX_ANGLE;
		angle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, angle));
		const pull = len < BOW.deadZone ? 0 : Math.min(1, len / BOW.pullLength);
		this.battle.setAim(angle, pull);
		if (len >= BOW.deadZone) this.angle = angle;
		return len;
	}

	/** Keys and stick, every frame. */
	update(dt: number) {
		if (!this.enabled) return;
		const fine = k.isKeyDown('shift') ? 0.35 : 1;
		let moved = false;
		if (k.isKeyDown(['up', 'w'])) {
			this.angle -= 1.15 * dt * fine;
			moved = true;
		}
		if (k.isKeyDown(['down', 's'])) {
			this.angle += 1.15 * dt * fine;
			moved = true;
		}
		if (k.isKeyDown(['right', 'd'])) {
			this.pull += 0.8 * dt * fine;
			moved = true;
		}
		if (k.isKeyDown(['left', 'a'])) {
			this.pull -= 0.8 * dt * fine;
			moved = true;
		}
		if (moved) this.device = 'keys';
		let stick = k.vec2(0, 0);
		try {
			stick = k.getGamepadStick('left');
		} catch {
			// No gamepad.
		}
		if (stick.len() > 0.3) {
			this.device = 'pad';
			this.angle = Math.atan2(stick.y, Math.max(0.05, stick.x));
			this.pull = 0.25 + Math.min(1, (stick.len() - 0.3) / 0.65) * 0.75;
		}
		if (k.isGamepadButtonDown('dpad-up')) this.angle -= 1.1 * dt;
		if (k.isGamepadButtonDown('dpad-down')) this.angle += 1.1 * dt;
		if (k.isGamepadButtonDown('dpad-right')) this.pull += 0.8 * dt;
		if (k.isGamepadButtonDown('dpad-left')) this.pull -= 0.8 * dt;
		this.angle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, this.angle));
		this.pull = Math.max(0.15, Math.min(1, this.pull));
		if (this.keyDrawing || this.padDrawing) this.battle.setAim(this.angle, this.pull);
	}

	/** True when keys or pad aim without a drag, so the game shows a faint resting arc. */
	get resting() {
		return this.device !== 'touch' && !this.battle.drawing;
	}

	cancel() {
		this.origin = null;
		this.current = null;
		this.keyDrawing = false;
		this.padDrawing = false;
		this.battle.cancelDraw();
	}
}
