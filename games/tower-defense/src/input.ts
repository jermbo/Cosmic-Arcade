// Turns keys and gamepad buttons into game actions. The mouse and touch are handled by the app,
// because they point at things.

export type Action =
	| 'up'
	| 'down'
	| 'left'
	| 'right'
	| 'confirm'
	| 'back'
	| 'upgrade'
	| 'sell'
	| 'wave'
	| 'speed'
	| 'pause'
	| 'target'
	| 'prev'
	| 'next'
	| 'tower1'
	| 'tower2'
	| 'tower3'
	| 'tower4';

export type Source = 'mouse' | 'touch' | 'key' | 'pad';

const KEYS: Record<string, Action> = {
	ArrowUp: 'up',
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right',
	Enter: 'confirm',
	Escape: 'back',
	u: 'upgrade',
	s: 'sell',
	' ': 'wave',
	f: 'speed',
	p: 'pause',
	t: 'target',
	q: 'prev',
	e: 'next',
	'1': 'tower1',
	'2': 'tower2',
	'3': 'tower3',
	'4': 'tower4',
};

// Standard gamepad layout.
const PAD: [number, Action][] = [
	[0, 'confirm'],
	[1, 'back'],
	[2, 'upgrade'],
	[3, 'sell'],
	[4, 'prev'],
	[5, 'next'],
	[7, 'speed'],
	[8, 'wave'],
	[9, 'pause'],
	[12, 'up'],
	[13, 'down'],
	[14, 'left'],
	[15, 'right'],
];

const REPEAT_DELAY = 0.32;
const REPEAT_RATE = 0.1;

export class Input {
	source: Source = 'mouse';
	onAction: (action: Action, source: Source) => void = () => {};
	onSource: (source: Source) => void = () => {};
	private held = new Set<number>();
	private stickDir: Action | null = null;
	private stickTime = 0;
	private padDir = new Map<number, number>();

	constructor() {
		window.addEventListener('keydown', (event) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			const action = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
			if (!action) return;
			const target = event.target as HTMLElement;
			// Sliders use the left and right keys themselves.
			if (target instanceof HTMLInputElement && target.type === 'range' && (action === 'left' || action === 'right')) return;
			event.preventDefault();
			this.setSource('key');
			if (event.repeat && !['up', 'down', 'left', 'right'].includes(action)) return;
			this.onAction(action, 'key');
		});
		window.addEventListener('pointerdown', (event) => this.setSource(event.pointerType === 'touch' ? 'touch' : 'mouse'), true);
		window.addEventListener('pointermove', (event) => {
			if (event.pointerType === 'mouse' && (event.movementX || event.movementY)) this.setSource('mouse');
		});
	}

	setSource(source: Source): void {
		if (this.source === source) return;
		this.source = source;
		document.body.dataset.input = source;
		this.onSource(source);
	}

	/** Reads the gamepads. Call once per frame. */
	poll(dt: number): void {
		const pads = navigator.getGamepads ? navigator.getGamepads() : [];
		for (const pad of pads) {
			if (!pad) continue;
			for (const [index, action] of PAD) {
				const id = pad.index * 100 + index;
				const pressed = !!pad.buttons[index]?.pressed;
				if (pressed && !this.held.has(id)) {
					this.held.add(id);
					this.setSource('pad');
					this.onAction(action, 'pad');
					if (index >= 12) this.padDir.set(id, 0);
				} else if (!pressed && this.held.has(id)) {
					this.held.delete(id);
					this.padDir.delete(id);
				} else if (pressed && index >= 12) {
					// Hold the D-pad to keep moving.
					const t = (this.padDir.get(id) ?? 0) + dt;
					this.padDir.set(id, t);
					if (t > REPEAT_DELAY) {
						this.padDir.set(id, REPEAT_DELAY - REPEAT_RATE);
						this.onAction(action, 'pad');
					}
				}
			}
			const x = pad.axes[0] ?? 0;
			const y = pad.axes[1] ?? 0;
			let dir: Action | null = null;
			if (Math.hypot(x, y) > 0.55) dir = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
			if (dir !== this.stickDir) {
				this.stickDir = dir;
				this.stickTime = 0;
				if (dir) {
					this.setSource('pad');
					this.onAction(dir, 'pad');
				}
			} else if (dir) {
				this.stickTime += dt;
				if (this.stickTime > REPEAT_DELAY) {
					this.stickTime = REPEAT_DELAY - REPEAT_RATE;
					this.onAction(dir, 'pad');
				}
			}
		}
	}
}

/** Moves focus to the nearest control in a direction, inside a container. */
export function moveFocus(container: HTMLElement, dir: 'up' | 'down' | 'left' | 'right'): void {
	const items = focusables(container);
	if (items.length === 0) return;
	const current = document.activeElement as HTMLElement | null;
	if (!current || !container.contains(current) || !items.includes(current)) {
		items[0].focus();
		return;
	}
	if (current instanceof HTMLInputElement && current.type === 'range' && (dir === 'left' || dir === 'right')) {
		const step = Number(current.step) || 0.1;
		current.value = String(Number(current.value) + (dir === 'right' ? step : -step));
		current.dispatchEvent(new Event('input', { bubbles: true }));
		return;
	}
	const from = current.getBoundingClientRect();
	const fx = from.left + from.width / 2;
	const fy = from.top + from.height / 2;
	let best: HTMLElement | null = null;
	let bestScore = Infinity;
	for (const item of items) {
		if (item === current) continue;
		const r = item.getBoundingClientRect();
		const dx = r.left + r.width / 2 - fx;
		const dy = r.top + r.height / 2 - fy;
		const main = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
		const side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
		if (main <= 4) continue;
		const score = main + side * 2.5;
		if (score < bestScore) {
			bestScore = score;
			best = item;
		}
	}
	best?.focus();
}

export function focusables(container: HTMLElement): HTMLElement[] {
	return [...container.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), a[href], input')].filter((el) => el.offsetParent !== null || el === document.activeElement);
}
