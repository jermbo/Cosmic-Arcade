// Springs for card motion. Every card is a body that chases a target.
// Moves are interruptible: a new target keeps the speed the card already has.

export interface Body {
	el: HTMLElement;
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number; // tilt in degrees
	vr: number;
	tx: number;
	ty: number;
	tr: number;
	/** ms to wait before chasing the target. */
	wait: number;
	/** Spring strength and damping ratio. */
	k: number;
	zeta: number;
	active: boolean;
	/** Held by the pointer: moved by hand, not by the spring. */
	held: boolean;
	/** Plays the landing squash when it arrives. */
	land: boolean;
	onStart?: () => void;
	onSettle?: () => void;
	kickLater?: MoveOptions;
}

export interface MoveOptions {
	wait?: number;
	/** Kick at the start, px/s. A negative vy makes an arc. */
	kickX?: number;
	kickY?: number;
	spin?: number;
	k?: number;
	zeta?: number;
	land?: boolean;
	onStart?: () => void;
	onSettle?: () => void;
}

const SPRING = { k: 420, zeta: 0.74 };
const TILT = { k: 260, zeta: 0.6 };

export class Motion {
	private bodies = new Map<number, Body>();
	private frame = 0;
	private last = 0;
	reduced = false;

	body(id: number, el: HTMLElement): Body {
		let b = this.bodies.get(id);
		if (!b) {
			b = { el, x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, tx: 0, ty: 0, tr: 0, wait: 0, k: SPRING.k, zeta: SPRING.zeta, active: false, held: false, land: false };
			this.bodies.set(id, b);
		}
		b.el = el;
		return b;
	}

	clear() {
		this.bodies.clear();
		cancelAnimationFrame(this.frame);
		this.frame = 0;
	}

	isMoving(id: number): boolean {
		const b = this.bodies.get(id);
		return Boolean(b && (b.active || b.held));
	}

	/** Jump to a spot with no motion. */
	snap(id: number, el: HTMLElement, x: number, y: number) {
		const b = this.body(id, el);
		Object.assign(b, { x, y, tx: x, ty: y, vx: 0, vy: 0, r: 0, vr: 0, tr: 0, wait: 0, active: false, held: false, land: false });
		b.onStart = b.onSettle = undefined;
		this.paint(b);
	}

	/** Spring to a spot. */
	to(id: number, el: HTMLElement, x: number, y: number, o: MoveOptions = {}) {
		const b = this.body(id, el);
		if (this.reduced) {
			o.onStart?.();
			this.snap(id, el, x, y);
			o.onSettle?.();
			return;
		}
		const same = Math.abs(b.tx - x) < 0.5 && Math.abs(b.ty - y) < 0.5;
		if (same && (b.active || (Math.abs(b.x - x) < 0.5 && Math.abs(b.y - y) < 0.5)) && !b.held) return;
		b.tx = x;
		b.ty = y;
		b.tr = 0;
		b.held = false;
		b.wait = o.wait ?? 0;
		b.k = o.k ?? SPRING.k;
		b.zeta = o.zeta ?? SPRING.zeta;
		b.land = o.land ?? true;
		b.onStart = o.onStart;
		b.onSettle = o.onSettle;
		if (b.wait <= 0) this.kick(b, o);
		else b.kickLater = o;
		b.active = true;
		this.run();
	}

	private kick(b: Body, o: MoveOptions) {
		b.vx += o.kickX ?? 0;
		b.vy += o.kickY ?? 0;
		b.vr += o.spin ?? 0;
		b.kickLater = undefined;
		const start = b.onStart;
		b.onStart = undefined;
		start?.();
	}

	/** Held by the pointer. Speed is measured, so the card tilts and keeps momentum when let go. */
	hold(id: number, el: HTMLElement, x: number, y: number, dt: number, follow = false) {
		const b = this.body(id, el);
		if (follow && !this.reduced) {
			// Cards under the lead one chase it on a stiff spring: a short chain.
			b.held = false;
			b.tx = x;
			b.ty = y;
			b.k = 1400;
			b.zeta = 0.82;
			b.wait = 0;
			b.land = false;
			b.active = true;
			b.tr = Math.max(-10, Math.min(10, b.vx * 0.012));
			this.run();
			return;
		}
		const ddt = Math.max(dt, 1 / 240);
		const vx = (x - b.x) / ddt;
		const vy = (y - b.y) / ddt;
		b.vx = b.vx * 0.6 + vx * 0.4;
		b.vy = b.vy * 0.6 + vy * 0.4;
		b.x = b.tx = x;
		b.y = b.ty = y;
		b.held = true;
		b.active = true;
		b.tr = Math.max(-14, Math.min(14, b.vx * 0.014));
		this.run();
	}

	private run() {
		if (this.frame) return;
		this.last = performance.now();
		const step = (now: number) => {
			const dt = Math.min(0.05, (now - this.last) / 1000);
			this.last = now;
			let any = false;
			for (const b of this.bodies.values()) {
				if (!b.active) continue;
				any = this.advance(b, dt) || any;
			}
			this.frame = any ? requestAnimationFrame(step) : 0;
		};
		this.frame = requestAnimationFrame(step);
	}

	private advance(b: Body, dt: number): boolean {
		if (b.wait > 0) {
			b.wait -= dt * 1000;
			if (b.wait > 0) return true;
			if (b.kickLater) this.kick(b, b.kickLater);
		}
		// Small steps keep stiff springs stable.
		const steps = Math.ceil(dt / (1 / 240));
		const h = dt / steps;
		for (let i = 0; i < steps; i++) {
			if (!b.held) {
				const c = 2 * b.zeta * Math.sqrt(b.k);
				b.vx += (b.k * (b.tx - b.x) - c * b.vx) * h;
				b.vy += (b.k * (b.ty - b.y) - c * b.vy) * h;
				b.x += b.vx * h;
				b.y += b.vy * h;
			}
			const cr = 2 * TILT.zeta * Math.sqrt(TILT.k);
			b.vr += (TILT.k * (b.tr - b.r) - cr * b.vr) * h;
			b.r += b.vr * h;
		}
		if (b.held) {
			// Speed fades when the pointer rests, so the tilt settles.
			b.vx *= Math.pow(0.02, dt);
			b.vy *= Math.pow(0.02, dt);
			b.tr = Math.max(-14, Math.min(14, b.vx * 0.014));
			this.paint(b);
			return true;
		}
		const done =
			Math.abs(b.tx - b.x) < 0.4 &&
			Math.abs(b.ty - b.y) < 0.4 &&
			Math.hypot(b.vx, b.vy) < 8 &&
			Math.abs(b.r) < 0.3 &&
			Math.abs(b.vr) < 4;
		if (done) {
			b.x = b.tx;
			b.y = b.ty;
			b.vx = b.vy = b.r = b.vr = 0;
			b.active = false;
			this.paint(b);
			if (b.land) {
				b.el.classList.remove('is-landing');
				void b.el.offsetWidth;
				b.el.classList.add('is-landing');
			}
			const settle = b.onSettle;
			b.onSettle = undefined;
			settle?.();
			return false;
		}
		this.paint(b);
		return true;
	}

	private paint(b: Body) {
		b.el.style.transform = `translate3d(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px, 0) rotate(${b.r.toFixed(2)}deg)`;
	}
}
