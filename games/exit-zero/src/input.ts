// Keyboard, mouse (with pointer lock) and a standard gamepad, read as named actions.

export type Action = 'interact' | 'inventory' | 'flashlight' | 'view' | 'pause' | 'sprint' | 'up' | 'down' | 'left' | 'right' | 'ok' | 'back';

const KEYS: Record<Action, string[]> = {
	interact: ['KeyE'],
	inventory: ['Tab', 'KeyI'],
	flashlight: ['KeyF'],
	view: ['KeyV'],
	pause: ['Escape', 'KeyP'],
	sprint: ['ShiftLeft', 'ShiftRight'],
	up: ['ArrowUp'],
	down: ['ArrowDown'],
	left: ['ArrowLeft'],
	right: ['ArrowRight'],
	ok: ['Enter', 'Space'],
	back: ['Escape', 'Backspace'],
};

// Standard mapping: 0 A, 1 B, 2 X, 3 Y, 6 LT, 8 Back, 9 Start, 10 L3, 12-15 d-pad.
const PAD: Record<Action, number[]> = {
	interact: [0, 7],
	inventory: [3],
	flashlight: [2],
	view: [8],
	pause: [9],
	sprint: [6, 10],
	up: [12],
	down: [13],
	left: [14],
	right: [15],
	ok: [0],
	back: [1],
};

const DEAD = 0.16;

function axis(v: number): number {
	const a = Math.abs(v);
	if (a < DEAD) return 0;
	const k = (a - DEAD) / (1 - DEAD);
	return Math.sign(v) * k * k;
}

export class Input {
	private down = new Set<string>();
	private hit = new Set<string>();
	private padDown: boolean[] = [];
	private padHit: boolean[] = [];
	private mouseHit = false;
	mouseDown = false;
	mx = 0;
	my = 0;
	locked = false;
	padActive = false;
	stick = { lx: 0, ly: 0, rx: 0, ry: 0 };
	/** The last device used, for button hints. */
	device: 'keys' | 'pad' = 'keys';
	/** Text typed this frame, for the keypad. */
	typed: string[] = [];
	private canvas: HTMLCanvasElement;
	onLockChange: (locked: boolean) => void = () => {};

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		addEventListener('keydown', (e) => {
			if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
			if (!e.repeat) this.hit.add(e.code);
			this.down.add(e.code);
			if (/^Digit\d$|^Numpad\d$/.test(e.code)) this.typed.push(e.code.slice(-1));
			this.device = 'keys';
		});
		addEventListener('keyup', (e) => this.down.delete(e.code));
		addEventListener('blur', () => {
			this.down.clear();
			this.mouseDown = false;
		});
		canvas.addEventListener('mousedown', (e) => {
			if (e.button !== 0) return;
			this.mouseDown = true;
			this.mouseHit = true;
			this.device = 'keys';
		});
		addEventListener('mouseup', (e) => {
			if (e.button === 0) this.mouseDown = false;
		});
		addEventListener('mousemove', (e) => {
			if (!this.locked) return;
			this.mx += e.movementX;
			this.my += e.movementY;
		});
		document.addEventListener('pointerlockchange', () => {
			this.locked = document.pointerLockElement === canvas;
			this.onLockChange(this.locked);
		});
	}

	lock(): void {
		if (this.locked) return;
		try {
			const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
			p?.catch?.(() => {});
		} catch {
			// some browsers refuse right after an unlock; the click-to-look hint covers it
		}
	}

	unlock(): void {
		if (document.pointerLockElement) document.exitPointerLock();
	}

	poll(): void {
		const pads = navigator.getGamepads?.() ?? [];
		const pad = [...pads].find((p) => p && p.connected && p.mapping === 'standard') ?? [...pads].find((p) => p && p.connected);
		if (!pad) {
			this.padActive = false;
			this.stick = { lx: 0, ly: 0, rx: 0, ry: 0 };
			this.padHit = [];
			return;
		}
		this.padActive = true;
		const now = pad.buttons.map((b) => b.pressed || b.value > 0.5);
		this.padHit = now.map((v, i) => v && !this.padDown[i]);
		this.padDown = now;
		this.stick = { lx: axis(pad.axes[0] ?? 0), ly: axis(pad.axes[1] ?? 0), rx: axis(pad.axes[2] ?? 0), ry: axis(pad.axes[3] ?? 0) };
		if (this.padHit.some(Boolean) || Math.abs(this.stick.lx) + Math.abs(this.stick.ly) + Math.abs(this.stick.rx) > 0.2) this.device = 'pad';
	}

	held(a: Action): boolean {
		if (KEYS[a].some((k) => this.down.has(k))) return true;
		if (PAD[a].some((b) => this.padDown[b])) return true;
		if (a === 'interact' && this.mouseDown && this.locked) return true;
		return false;
	}

	pressed(a: Action): boolean {
		if (KEYS[a].some((k) => this.hit.has(k))) return true;
		if (PAD[a].some((b) => this.padHit[b])) return true;
		if (a === 'interact' && this.mouseHit && this.locked) return true;
		return false;
	}

	/** Movement on the floor: x is right, y is forward. Keys and the left stick. */
	move(): [number, number] {
		let x = 0;
		let y = 0;
		if (this.down.has('KeyW')) y += 1;
		if (this.down.has('KeyS')) y -= 1;
		if (this.down.has('KeyD')) x += 1;
		if (this.down.has('KeyA')) x -= 1;
		x += this.stick.lx;
		y -= this.stick.ly;
		const len = Math.hypot(x, y);
		return len > 1 ? [x / len, y / len] : [x, y];
	}

	endFrame(): void {
		this.hit.clear();
		this.mouseHit = false;
		this.mx = 0;
		this.my = 0;
		this.typed = [];
	}
}
