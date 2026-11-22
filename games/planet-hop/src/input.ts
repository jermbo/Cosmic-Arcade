export type Device = 'keyboard' | 'gamepad' | 'touch';
export type MenuKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

/** One place for keyboard, mouse, gamepad and touch. The game reads a frame of it. */
export class Input {
	moveX = 0;
	moveY = 0; // +1 is forward
	lookX = 0; // radians this frame, + turns right
	lookY = 0; // radians this frame, + looks up
	jumpHeld = false;
	jumpPressed = false;
	pausePressed = false;
	mapPressed = false;
	device: Device = 'keyboard';
	sensitivity = 1;
	invertY = false;
	/** Camera input in the last moments, so the camera assist waits. */
	lookActiveTime = 0;
	onDevice: ((d: Device) => void) | null = null;
	onMenu: ((k: MenuKey) => void) | null = null;
	playing = false;

	private keys = new Set<string>();
	private mouseDX = 0;
	private mouseDY = 0;
	private dragging = false;
	lookDrag = false;
	private lookLastX = 0;
	private lookLastY = 0;
	lookMode: 'drag' | 'capture' = 'drag';
	private lastJumpKey = false;
	private padPrev: boolean[] = [];
	private padAxesPrev = [0, 0];
	private padRepeat = 0;
	private touchJump = false;
	private touchMove = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
	private touchLook = { id: -1, x: 0, y: 0 };
	private touchLookDX = 0;
	private touchLookDY = 0;
	private touchEl: HTMLElement;
	private stickBase: HTMLElement;
	private stickKnob: HTMLElement;
	private jumpBtn: HTMLElement;

	private canvas: HTMLCanvasElement;

	constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
		this.canvas = canvas;
		addEventListener('keydown', (e) => this.key(e, true));
		addEventListener('keyup', (e) => this.key(e, false));
		addEventListener('blur', () => {
			this.keys.clear();
			this.touchJump = false;
		});

		canvas.addEventListener('mousedown', (e) => {
			this.setDevice('keyboard');
			if (!this.playing || this.lookMode !== 'drag' || e.button !== 0) return;
			this.lookDrag = true;
			this.lookLastX = e.clientX;
			this.lookLastY = e.clientY;
		});
		addEventListener('mouseup', () => {
			this.dragging = false;
			this.lookDrag = false;
		});
		addEventListener('mousemove', (e) => {
			if (document.pointerLockElement === canvas) {
				this.mouseDX += e.movementX;
				this.mouseDY += e.movementY;
			} else if (this.lookDrag && this.lookMode === 'drag' && this.playing) {
				const dx = e.clientX - this.lookLastX;
				const dy = e.clientY - this.lookLastY;
				this.lookLastX = e.clientX;
				this.lookLastY = e.clientY;
				this.mouseDX += dx;
				this.mouseDY += dy;
			} else if (this.dragging) {
				this.mouseDX += e.movementX;
				this.mouseDY += e.movementY;
			}
			if (Math.abs(this.mouseDX) + Math.abs(this.mouseDY) > 0) this.setDevice('keyboard');
		});
		canvas.addEventListener('contextmenu', (e) => e.preventDefault());

		// Touch layer
		this.touchEl = document.createElement('div');
		this.touchEl.className = 'touch';
		this.touchEl.innerHTML = `
			<div class="touch__zone touch__zone--move"></div>
			<div class="touch__zone touch__zone--look"></div>
			<div class="touch__stick" hidden><div class="touch__knob"></div></div>
			<button class="touch__jump" type="button" aria-label="Jump">JUMP</button>`;
		overlay.appendChild(this.touchEl);
		this.stickBase = this.touchEl.querySelector('.touch__stick')!;
		this.stickKnob = this.touchEl.querySelector('.touch__knob')!;
		this.jumpBtn = this.touchEl.querySelector('.touch__jump')!;
		const moveZone = this.touchEl.querySelector<HTMLElement>('.touch__zone--move')!;
		const lookZone = this.touchEl.querySelector<HTMLElement>('.touch__zone--look')!;

		moveZone.addEventListener('touchstart', (e) => {
			e.preventDefault();
			const t = e.changedTouches[0];
			if (this.touchMove.id !== -1) return;
			this.touchMove = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
			this.stickBase.hidden = false;
			this.stickBase.style.transform = `translate(${t.clientX}px, ${t.clientY}px)`;
			this.stickKnob.style.transform = 'translate(0px, 0px)';
			this.setDevice('touch');
		}, { passive: false });
		lookZone.addEventListener('touchstart', (e) => {
			e.preventDefault();
			const t = e.changedTouches[0];
			if (this.touchLook.id !== -1) return;
			this.touchLook = { id: t.identifier, x: t.clientX, y: t.clientY };
			this.setDevice('touch');
		}, { passive: false });
		this.jumpBtn.addEventListener('touchstart', (e) => {
			e.preventDefault();
			this.touchJump = true;
			this.jumpBtn.classList.add('is-down');
			this.setDevice('touch');
		}, { passive: false });
		const endJump = (e: TouchEvent) => {
			e.preventDefault();
			this.touchJump = false;
			this.jumpBtn.classList.remove('is-down');
		};
		this.jumpBtn.addEventListener('touchend', endJump);
		this.jumpBtn.addEventListener('touchcancel', endJump);

		addEventListener('touchmove', (e) => {
			for (const t of Array.from(e.changedTouches)) {
				if (t.identifier === this.touchMove.id) {
					this.touchMove.x = t.clientX;
					this.touchMove.y = t.clientY;
					const dx = t.clientX - this.touchMove.ox;
					const dy = t.clientY - this.touchMove.oy;
					const max = 48;
					const len = Math.hypot(dx, dy);
					const k = len > max ? max / len : 1;
					this.stickKnob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
				}
				if (t.identifier === this.touchLook.id) {
					this.touchLookDX += t.clientX - this.touchLook.x;
					this.touchLookDY += t.clientY - this.touchLook.y;
					this.touchLook.x = t.clientX;
					this.touchLook.y = t.clientY;
				}
			}
		}, { passive: true });
		const endTouch = (e: TouchEvent) => {
			for (const t of Array.from(e.changedTouches)) {
				if (t.identifier === this.touchMove.id) {
					this.touchMove.id = -1;
					this.stickBase.hidden = true;
				}
				if (t.identifier === this.touchLook.id) this.touchLook.id = -1;
			}
		};
		addEventListener('touchend', endTouch);
		addEventListener('touchcancel', endTouch);
		addEventListener('touchstart', () => this.setDevice('touch'), { passive: true });
	}

	showTouch(on: boolean): void {
		this.touchEl.classList.toggle('is-on', on);
		if (!on) {
			this.touchMove.id = -1;
			this.touchLook.id = -1;
			this.touchJump = false;
			this.stickBase.hidden = true;
		}
	}

	private setDevice(d: Device): void {
		if (d === this.device) return;
		this.device = d;
		this.onDevice?.(d);
	}

	private key(e: KeyboardEvent, down: boolean): void {
		const code = e.code;
		if (down) this.keys.add(code);
		else this.keys.delete(code);
		if (down) this.setDevice('keyboard');
		if (!this.playing) return;
		if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
		if (down && !e.repeat && (code === 'Escape' || code === 'KeyP')) this.pausePressed = true;
		if (this.playing && down && !e.repeat && (code === 'KeyM' || code === 'Tab')) this.mapPressed = true;
	}

	/** Call once per frame before the game reads the fields. */
	update(dt: number): void {
		const k = this.keys;
		let mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
		let my = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
		const kl = Math.hypot(mx, my);
		if (kl > 1) {
			mx /= kl;
			my /= kl;
		}
		let jump = k.has('Space');
		const sens = this.sensitivity;
		const inv = this.invertY ? -1 : 1;
		let lx = this.mouseDX * 0.0028 * sens;
		let ly = -this.mouseDY * 0.0028 * sens * inv;
		this.mouseDX = 0;
		this.mouseDY = 0;

		// Touch stick
		if (this.touchMove.id !== -1) {
			const dx = this.touchMove.x - this.touchMove.ox;
			const dy = this.touchMove.y - this.touchMove.oy;
			const len = Math.hypot(dx, dy);
			if (len > 6) {
				const mag = Math.min(1, (len - 6) / 42);
				mx = (dx / len) * mag;
				my = (-dy / len) * mag;
			}
		}
		lx += this.touchLookDX * 0.006 * sens;
		ly += -this.touchLookDY * 0.005 * sens * inv;
		this.touchLookDX = 0;
		this.touchLookDY = 0;
		if (this.touchJump) jump = true;

		// Gamepad
		const pads = navigator.getGamepads ? navigator.getGamepads() : [];
		for (const pad of pads) {
			if (!pad || !pad.connected) continue;
			const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
			const ax = dz(pad.axes[0] ?? 0);
			const ay = dz(pad.axes[1] ?? 0);
			const rx = dz(pad.axes[2] ?? 0);
			const ry = dz(pad.axes[3] ?? 0);
			const b = (i: number) => !!pad.buttons[i]?.pressed;
			const any = Math.abs(ax) + Math.abs(ay) + Math.abs(rx) + Math.abs(ry) > 0 || pad.buttons.some((x) => x.pressed);
			if (any) this.setDevice('gamepad');
			if (Math.abs(ax) + Math.abs(ay) > 0) {
				mx = ax;
				my = -ay;
				const l = Math.hypot(mx, my);
				if (l > 1) {
					mx /= l;
					my /= l;
				}
			}
			// Curve the stick so small moves are fine and full tilt turns fast.
			const curve = (v: number) => Math.sign(v) * v * v;
			lx += curve(rx) * 2.6 * sens * dt;
			ly += -curve(ry) * 1.6 * sens * inv * dt;
			if (b(0) || b(1)) jump = this.playing ? true : jump;
			const pressed = (i: number) => b(i) && !this.padPrev[i];
			if (this.playing && (pressed(9) || pressed(8))) this.pausePressed = true;
			if (!this.playing) {
				// Menu navigation
				const up = pressed(12) || (ay < -0.6 && this.padAxesPrev[1] >= -0.6);
				const down = pressed(13) || (ay > 0.6 && this.padAxesPrev[1] <= 0.6);
				const left = pressed(14) || (ax < -0.6 && this.padAxesPrev[0] >= -0.6);
				const right = pressed(15) || (ax > 0.6 && this.padAxesPrev[0] <= 0.6);
				this.padRepeat -= dt;
				const holdLR = Math.abs(ax) > 0.6 || b(14) || b(15);
				if (up) this.onMenu?.('up');
				if (down) this.onMenu?.('down');
				if (left) this.onMenu?.('left'), (this.padRepeat = 0.4);
				if (right) this.onMenu?.('right'), (this.padRepeat = 0.4);
				if (holdLR && this.padRepeat <= 0 && !left && !right) {
					this.onMenu?.((ax < 0 || b(14)) ? 'left' : 'right');
					this.padRepeat = 0.08;
				}
				if (pressed(0)) this.onMenu?.('confirm');
				if (pressed(1) || pressed(9)) this.onMenu?.('back');
			}
			this.padPrev = pad.buttons.map((x) => x.pressed);
			this.padAxesPrev = [ax, ay];
			break;
		}

		this.moveX = mx;
		this.moveY = my;
		this.lookX = lx;
		this.lookY = ly;
		this.lookActiveTime = Math.abs(lx) + Math.abs(ly) > 0.0005 ? 0 : this.lookActiveTime + dt;
		this.jumpPressed = jump && !this.lastJumpKey;
		this.jumpHeld = jump;
		this.lastJumpKey = jump;
	}

	/** Clear one-frame events after the game used them. */
	endFrame(): void {
		this.pausePressed = false;
		this.jumpPressed = false;
		this.mapPressed = false;
	}

	/** Swallow the jump so a menu press does not also jump. */
	clearJump(): void {
		this.lastJumpKey = true;
		this.jumpPressed = false;
	}

	get canvasEl(): HTMLCanvasElement {
		return this.canvas;
	}
}
