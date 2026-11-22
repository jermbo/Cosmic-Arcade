/**
 * Reads the keyboard, the mouse, touch and a gamepad, and gives the game one simple view of them.
 * A "press" is read once with take(). An axis is read each frame.
 */

export type Press = 'action' | 'retry' | 'pause' | 'back' | 'confirm' | 'up' | 'down' | 'left' | 'right';
export type Device = 'keyboard' | 'gamepad' | 'touch';

const KEY_PRESSES: Record<string, Press> = {
	Space: 'action',
	KeyR: 'retry',
	Escape: 'pause',
	KeyP: 'pause',
	ArrowUp: 'up',
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right',
	KeyW: 'up',
	KeyS: 'down',
	KeyA: 'left',
	KeyD: 'right',
};

const PAD_PRESSES: [number, Press][] = [
	[0, 'action'],
	[2, 'action'],
	[1, 'back'],
	[3, 'retry'],
	[9, 'pause'],
	[12, 'up'],
	[13, 'down'],
	[14, 'left'],
	[15, 'right'],
];

export class Input {
	/** Left and right, from -1 to 1: keys, d-pad or stick. */
	x = 0;
	/** Down and up, from -1 to 1. Up is positive. */
	y = 0;
	/** A drag on the screen, from -1 to 1 on each axis. Zero when no finger or button is down. */
	dragX = 0;
	dragY = 0;
	dragging = false;
	/** Mouse place over the game from -1 (left) to 1 (right), set only in the frame that the mouse moved. */
	mouseAim: number | undefined;
	/** Degrees of aim that a touch drag asked for in this frame. */
	touchAim = 0;
	device: Device = 'keyboard';
	/** True while a menu is open: Space and Enter then belong to the buttons of the page. */
	menuOpen = true;
	onFirstInput: (() => void) | undefined;

	private keys = new Set<string>();
	private presses = new Set<Press>();
	private padDown = new Set<number>();
	private padStick = { x: 0, y: 0 };
	private stickRepeat = 0;
	private pointerId = -1;
	private startX = 0;
	private startY = 0;
	private lastX = 0;

	constructor(surface: HTMLElement) {
		window.addEventListener('keydown', (event) => {
			this.wake('keyboard');
			if (event.repeat && !event.code.startsWith('Arrow')) return;
			const press = KEY_PRESSES[event.code];
			const typing = event.target instanceof HTMLInputElement;
			if (this.menuOpen) {
				if (event.code === 'Escape') this.presses.add('back');
				if (press && press !== 'action' && press !== 'pause' && !(typing && (press === 'left' || press === 'right'))) {
					if (!typing || event.code.startsWith('Arrow')) {
						this.presses.add(press);
						event.preventDefault();
					}
				}
				return;
			}
			this.keys.add(event.code);
			if (event.code === 'Enter') this.presses.add('action');
			if (press && !event.repeat) this.presses.add(press);
			if (press || event.code === 'Enter') event.preventDefault();
		});
		window.addEventListener('keyup', (event) => this.keys.delete(event.code));
		window.addEventListener('blur', () => this.keys.clear());

		surface.addEventListener('pointerdown', (event) => {
			this.wake(event.pointerType === 'touch' ? 'touch' : this.device === 'touch' ? 'keyboard' : this.device);
			if (this.pointerId !== -1) return;
			this.pointerId = event.pointerId;
			this.startX = event.clientX;
			this.startY = event.clientY;
			this.lastX = event.clientX;
			this.dragging = true;
			surface.setPointerCapture(event.pointerId);
			if (event.pointerType === 'mouse' && event.button === 0) this.presses.add('confirm');
		});
		surface.addEventListener('pointermove', (event) => {
			if (event.pointerType === 'mouse') {
				const box = surface.getBoundingClientRect();
				this.mouseAim = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1));
			}
			if (event.pointerId !== this.pointerId) return;
			if (event.pointerType !== 'mouse') this.touchAim += (event.clientX - this.lastX) * 0.09;
			this.lastX = event.clientX;
			const reach = Math.max(50, Math.min(window.innerWidth, window.innerHeight) * 0.14);
			this.dragX = Math.max(-1, Math.min(1, (event.clientX - this.startX) / reach));
			this.dragY = Math.max(-1, Math.min(1, -(event.clientY - this.startY) / reach));
		});
		const end = (event: PointerEvent): void => {
			if (event.pointerId !== this.pointerId) return;
			this.pointerId = -1;
			this.dragging = false;
			this.dragX = 0;
			this.dragY = 0;
		};
		surface.addEventListener('pointerup', end);
		surface.addEventListener('pointercancel', end);
		surface.addEventListener('contextmenu', (event) => event.preventDefault());
	}

	/** Call once each frame, before the game reads the input. */
	update(dt: number): void {
		let x = 0;
		let y = 0;
		if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) x -= 1;
		if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) x += 1;
		if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) y += 1;
		if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) y -= 1;

		const pad = this.firstPad();
		if (pad) {
			let sx = pad.axes[0] ?? 0;
			let sy = -(pad.axes[1] ?? 0);
			if (Math.hypot(sx, sy) < 0.22) {
				sx = 0;
				sy = 0;
			}
			if (pad.buttons[14]?.pressed) sx = -1;
			if (pad.buttons[15]?.pressed) sx = 1;
			if (pad.buttons[12]?.pressed) sy = 1;
			if (pad.buttons[13]?.pressed) sy = -1;
			if (sx !== 0 || sy !== 0) {
				x = sx;
				y = sy;
				this.wake('gamepad');
			}
			for (const [index, press] of PAD_PRESSES) {
				const down = pad.buttons[index]?.pressed === true;
				if (down && !this.padDown.has(index)) {
					this.presses.add(this.menuOpen && press === 'action' ? 'confirm' : press);
					this.wake('gamepad');
				}
				if (down) this.padDown.add(index);
				else this.padDown.delete(index);
			}
			// In a menu, the stick moves the focus, with a pause between moves.
			const ax = Math.abs(pad.axes[0] ?? 0) > 0.6 ? Math.sign(pad.axes[0]) : 0;
			const ay = Math.abs(pad.axes[1] ?? 0) > 0.6 ? Math.sign(pad.axes[1]) : 0;
			if (ax !== this.padStick.x || ay !== this.padStick.y) {
				this.padStick = { x: ax, y: ay };
				this.stickRepeat = 0;
			}
			if (this.menuOpen && (ax !== 0 || ay !== 0)) {
				this.stickRepeat -= dt;
				if (this.stickRepeat <= 0) {
					this.stickRepeat = 0.28;
					if (ay !== 0) this.presses.add(ay < 0 ? 'up' : 'down');
					else this.presses.add(ax < 0 ? 'left' : 'right');
				}
			}
		}
		this.x = x;
		this.y = y;
	}

	/** Call at the end of each frame. */
	endFrame(): void {
		this.presses.clear();
		this.mouseAim = undefined;
		this.touchAim = 0;
	}

	take(press: Press): boolean {
		return this.presses.delete(press);
	}

	/** Lets a button of the page act as a press. */
	push(press: Press): void {
		this.presses.add(press);
	}

	private wake(device: Device): void {
		this.device = device;
		if (this.onFirstInput) this.onFirstInput();
	}

	private firstPad(): Gamepad | undefined {
		if (!navigator.getGamepads) return undefined;
		for (const pad of navigator.getGamepads()) {
			if (pad && pad.connected) return pad;
		}
		return undefined;
	}
}
