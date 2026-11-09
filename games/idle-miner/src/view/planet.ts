// The planet view: the factory grid, drawing and touch / mouse building.

import { BRIDGE_SPAN, COLS, DX, DY, MACHINES, PLANETS, ROWS, TILE_ORE, TILE_ROCK, beltSpeed } from '../core/data.ts';
import type { Dir, MachineType } from '../core/data.ts';
import * as sim from '../core/sim.ts';
import { baseTilesOf, tilesOf } from '../core/state.ts';
import type { BeltItem, Game, Machine } from '../core/state.ts';
import { drawBelt, drawBridgeDeck, drawBridgeEnd, drawCrossDeck, drawItem, drawMachine, drawShip, glow, mix, roundRect, withAlpha } from './draw.ts';
import { burst, popup, ring, spray } from './fx.ts';
import { fmt as fmtShort } from '../core/format.ts';

export type Tool = MachineType | 'remove' | null;

export interface PlanetHooks {
	sound: (name: 'place' | 'belt' | 'remove' | 'error' | 'click' | 'blast') => void;
	toast: (text: string) => void;
	select: (cell: number | null) => void;
	changed: () => void;
}

interface Drag {
	path: number[];
	moved: boolean;
	mode: 'belt' | 'bridge' | 'machine' | 'remove' | 'none';
	pointer: number;
	startX: number;
	startY: number;
}

interface Anim {
	kind: 'up' | 'down';
	t: number;
}

const idx = (x: number, y: number) => y * COLS + x;
const cx = (i: number) => i % COLS;
const cy = (i: number) => Math.floor(i / COLS);

const RED = '#ff5d73';
const AMBER = '#ffb347';

/** A pulsing outline around a cell. */
function blink(ctx: CanvasRenderingContext2D, i: number, s: number, color: string, time: number, width: number) {
	const a = 0.35 + 0.35 * Math.sin(time * 6);
	roundRect(ctx, cx(i) * s + 2, cy(i) * s + 2, s - 4, s - 4, s * 0.18);
	ctx.strokeStyle = withAlpha(color, a);
	ctx.lineWidth = width;
	ctx.stroke();
}

export class PlanetView {
	pi = 0;
	tool: Tool = null;
	selected: number | null = null;
	hover: number | null = null;
	ts = 40;
	ox = 0;
	oy = 0;
	rot = false;
	private drag: Drag | null = null;
	/** Blocked machines on this planet. Backups are held a moment so the marks do not flicker. */
	blocks: sim.Block[] = [];
	private held = new Map<number, { b: sim.Block; t: number; pi: number }>();
	private boardCache: HTMLCanvasElement | null = null;
	private boardKey = '';
	private lastSpark = new Float32Array(COLS * ROWS);
	private shipAnims: Anim[] = [];
	/** For the tutorial: cells to point at. */
	highlight: number[] = [];

	private hooks: PlanetHooks;

	constructor(hooks: PlanetHooks) {
		this.hooks = hooks;
	}

	open(pi: number) {
		this.pi = pi;
		this.selected = null;
		this.drag = null;
		this.shipAnims = [];
		this.boardKey = '';
	}

	/** Fits the grid in the free area. Turns it 90 degrees on tall screens. */
	layout(w: number, h: number, top: number, bottom: number, left = 0, right = 0) {
		const availW = w - left - right;
		const availH = h - top - bottom;
		const pad = 12;
		const flat = Math.min((availW - pad * 2) / COLS, (availH - pad * 2) / ROWS);
		const tall = Math.min((availW - pad * 2) / ROWS, (availH - pad * 2) / COLS);
		this.rot = tall > flat * 1.08;
		this.ts = Math.floor(Math.max(flat, tall));
		const gw = (this.rot ? ROWS : COLS) * this.ts;
		const gh = (this.rot ? COLS : ROWS) * this.ts;
		this.ox = Math.round(left + (availW - gw) / 2);
		this.oy = Math.round(top + (availH - gh) / 2);
		this.boardKey = '';
	}

	/** Screen point to grid cell, or null. */
	cellAt(sx: number, sy: number): number | null {
		let gx: number;
		let gy: number;
		if (this.rot) {
			gx = (sy - this.oy) / this.ts;
			gy = (this.ox + ROWS * this.ts - sx) / this.ts;
		} else {
			gx = (sx - this.ox) / this.ts;
			gy = (sy - this.oy) / this.ts;
		}
		const x = Math.floor(gx);
		const y = Math.floor(gy);
		if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
		return idx(x, y);
	}

	/** Grid point (in tiles) to screen point. */
	toScreen(gx: number, gy: number) {
		if (this.rot) return { x: this.ox + (ROWS - gy) * this.ts, y: this.oy + gx * this.ts };
		return { x: this.ox + gx * this.ts, y: this.oy + gy * this.ts };
	}

	cellCenter(i: number) {
		return this.toScreen(cx(i) + 0.5, cy(i) + 0.5);
	}

	/** The screen box of the board. */
	bounds() {
		const w = (this.rot ? ROWS : COLS) * this.ts;
		const h = (this.rot ? COLS : ROWS) * this.ts;
		return { x: this.ox, y: this.oy, w, h };
	}

	// ---------- input ----------

	pointerDown(g: Game, sx: number, sy: number, id: number) {
		const c = this.cellAt(sx, sy);
		if (c === null) {
			this.hooks.select(null);
			return;
		}
		const mode = this.tool === 'belt' ? 'belt' : this.tool === 'bridge' ? 'bridge' : this.tool === 'remove' ? 'remove' : this.tool ? 'machine' : 'none';
		this.drag = { path: [c], moved: false, mode, pointer: id, startX: sx, startY: sy };
		if (mode === 'remove') this.removeCell(g, c, true);
	}

	pointerMove(g: Game, sx: number, sy: number, id: number) {
		const c = this.cellAt(sx, sy);
		this.hover = c;
		const d = this.drag;
		if (!d || d.pointer !== id) return;
		if (!d.moved && Math.hypot(sx - d.startX, sy - d.startY) > this.ts * 0.45) {
			d.moved = true;
			// Dragging with no tool lays belts.
			if (d.mode === 'none') d.mode = 'belt';
		}
		if (c === null || !d.moved) return;
		if (d.mode === 'bridge') {
			const end = straightEnd(d.path[0], c);
			if (end !== d.path[d.path.length - 1]) this.hooks.sound('click');
			d.path = end === d.path[0] ? [end] : [d.path[0], end];
			return;
		}
		if (d.mode === 'machine') {
			d.path = [c];
			return;
		}
		const last = d.path[d.path.length - 1];
		if (c === last) return;
		// Step one cell at a time so the path stays connected.
		let x = cx(last);
		let y = cy(last);
		const tx = cx(c);
		const ty = cy(c);
		let guard = 0;
		while ((x !== tx || y !== ty) && guard++ < 40) {
			if (Math.abs(tx - x) >= Math.abs(ty - y)) x += Math.sign(tx - x);
			else y += Math.sign(ty - y);
			const n = idx(x, y);
			const at = d.path.indexOf(n);
			if (at >= 0) d.path.length = at + 1;
			else d.path.push(n);
			if (d.mode === 'remove') this.removeCell(g, n);
			else if (d.mode === 'belt') this.hooks.sound('click');
		}
	}

	pointerUp(g: Game, sx: number, sy: number, id: number) {
		const d = this.drag;
		if (!d || d.pointer !== id) return;
		this.drag = null;
		const c = this.cellAt(sx, sy);
		if (d.mode === 'belt') {
			if (!d.moved && d.path.length === 1) this.tapBelt(g, d.path[0]);
			else this.commitBelts(g, d.path);
		} else if (d.mode === 'bridge') {
			if (d.path.length === 2) this.placeBridge(g, d.path[0], d.path[1]);
			else {
				this.hooks.toast(`Drag from where items go in to where they come out. Up to ${BRIDGE_SPAN - 1} tiles between.`);
				this.hooks.sound('error');
			}
		} else if (d.mode === 'machine' && this.tool && this.tool !== 'remove') {
			const target = d.moved ? (c ?? d.path[0]) : d.path[0];
			this.placeMachine(g, target, this.tool);
		} else if (d.mode === 'none') {
			const m = g.planets[this.pi].cells[d.path[0]];
			this.hooks.select(m ? d.path[0] : null);
			if (!m && !d.moved && tilesOf(this.pi, g.blasted[this.pi])[d.path[0]] === TILE_ROCK) {
				this.hooks.toast(g.research.blast ? `Rock. Tap it with Remove to blast it for ${fmtShort(sim.blastCost(g, this.pi))}.` : 'Rock. Research Blast Charges to clear rocks.');
			}
		}
	}

	pointerCancel() {
		this.drag = null;
	}

	private tapBelt(g: Game, c: number) {
		const p = g.planets[this.pi];
		const m = p.cells[c];
		if (m && m.t === 'belt') {
			sim.rotateAt(g, this.pi, cx(c), cy(c));
			this.hooks.sound('belt');
			return;
		}
		if (m) {
			this.hooks.select(c);
			return;
		}
		this.commitBelts(g, [c]);
	}

	/** The direction each path cell's belt should face. */
	private pathDirs(g: Game, path: number[]): Dir[] {
		const dirs: Dir[] = [];
		for (let i = 0; i < path.length; i++) {
			if (i + 1 < path.length) dirs.push(dirTo(path[i], path[i + 1]));
			else if (i > 0) dirs.push(dirTo(path[i - 1], path[i]));
			else dirs.push(sim.autoDir(g, this.pi, cx(path[i]), cy(path[i]), 0));
		}
		// The end turns toward a pad or machine next to it, if straight ahead is nothing useful.
		const end = path.length - 1;
		const e = path[end];
		const p = g.planets[this.pi];
		const takes = (m: Machine | null) => !!m && m.t !== 'drill' && m.t !== 'pylon';
		const ahead = neighbor(e, dirs[end]);
		if (!takes(ahead !== null ? p.cells[ahead] : null)) {
			for (const dd of [0, 1, 2, 3] as Dir[]) {
				const n = neighbor(e, dd);
				if (n === null || (end > 0 && n === path[end - 1])) continue;
				const nm = p.cells[n];
				if (takes(nm) && nm!.t !== 'belt') {
					dirs[end] = dd;
					break;
				}
			}
		}
		return dirs;
	}

	/** Path steps where the line goes straight across a straight belt: these become crossings. */
	private crossings(g: Game, path: number[]): Set<number> {
		const out = new Set<number>();
		if (!g.research.bridges) return out;
		const cells = g.planets[this.pi].cells;
		for (let i = 1; i < path.length - 1; i++) {
			const m = cells[path[i]];
			if (!m || m.t !== 'belt') continue;
			const din = dirTo(path[i - 1], path[i]);
			if (din !== dirTo(path[i], path[i + 1]) || din % 2 === m.d % 2) continue;
			// The line being dragged will feed it from the side; that is the point.
			if (sim.straightBelt(g, this.pi, path[i], [path[i - 1], path[i + 1]])) out.add(i);
		}
		return out;
	}

	private commitBelts(g: Game, path: number[]) {
		const p = g.planets[this.pi];
		const tiles = tilesOf(this.pi, g.blasted[this.pi]);
		const dirs = this.pathDirs(g, path);
		const cross = this.crossings(g, path);
		let placed = 0;
		let short = false;
		for (let i = 0; i < path.length; i++) {
			const c = path[i];
			const m = p.cells[c];
			if (tiles[c] === TILE_ROCK) continue;
			if (cross.has(i)) {
				if (sim.makeCross(g, this.pi, c, [path[i - 1], path[i + 1]])) {
					placed++;
					const s = this.cellCenter(c);
					burst(s.x, s.y, '#9fb4ff', 6, 70, { size: 2, life: 0.35 });
				} else short = true;
				continue;
			}
			if (m) {
				// A drag that ends on a belt joins it, so that belt keeps its way.
				const joins = i === path.length - 1 && path.length > 1;
				if (m.t === 'belt' && !joins) sim.rotateAt(g, this.pi, cx(c), cy(c), dirs[i]);
				else if (i === 0 && path.length > 1 && m.t !== 'pad' && m.t !== 'pylon') sim.rotateAt(g, this.pi, cx(c), cy(c), dirs[0]);
				continue;
			}
			if (sim.place(g, this.pi, cx(c), cy(c), 'belt', dirs[i])) {
				placed++;
				const s = this.cellCenter(c);
				burst(s.x, s.y, '#7f8cff', 3, 50, { size: 2, life: 0.3 });
			} else short = true;
		}
		if (placed) this.hooks.sound('belt');
		if (short) {
			this.hooks.toast('Not enough credits for all belts');
			this.hooks.sound('error');
		}
		this.hooks.changed();
	}

	private placeBridge(g: Game, a: number, b: number) {
		const check = sim.canBridge(g, this.pi, a, b);
		if (!check.ok) {
			this.hooks.toast(check.why);
			this.hooks.sound('error');
			return;
		}
		sim.placeBridge(g, this.pi, a, b);
		const col = MACHINES.bridge.color;
		for (const c of [a, b]) {
			const s = this.cellCenter(c);
			burst(s.x, s.y, col, 10, 140, { size: 2.5, life: 0.45 });
		}
		const s = this.cellCenter(b);
		popup(s.x, s.y - this.ts * 0.4, '-' + fmtShort(check.cost), '#ffb3b3', 13);
		this.hooks.sound('place');
		this.hooks.changed();
	}

	placeMachine(g: Game, c: number, t: MachineType) {
		const x = cx(c);
		const y = cy(c);
		const check = sim.canPlace(g, this.pi, x, y, t);
		if (!check.ok) {
			const m = g.planets[this.pi].cells[c];
			if (m && check.why === 'Space is taken') {
				this.hooks.select(c);
				return;
			}
			this.hooks.toast(check.why);
			this.hooks.sound('error');
			return;
		}
		const d = sim.autoDir(g, this.pi, x, y, 0);
		sim.place(g, this.pi, x, y, t, d);
		const s = this.cellCenter(c);
		burst(s.x, s.y, MACHINES[t].color, 14, 160, { size: 3, life: 0.5 });
		ring(s.x, s.y, MACHINES[t].color, this.ts * 0.3, 90, 0.4);
		popup(s.x, s.y - this.ts * 0.4, '-' + fmtShort(check.cost), '#ffb3b3', 13);
		this.hooks.sound('place');
		this.hooks.changed();
	}

	private removeCell(g: Game, c: number, tap = false) {
		const m = g.planets[this.pi].cells[c];
		if (!m && tap) this.blastCell(g, c);
		if (!m || m.t === 'pad') return;
		const refund = sim.removeAt(g, this.pi, cx(c), cy(c));
		const s = this.cellCenter(c);
		burst(s.x, s.y, '#ff6b8a', 8, 120, { size: 2.5, life: 0.4 });
		if (refund > 0) popup(s.x, s.y, '+' + fmtShort(refund), '#9dffb0', 12);
		if (this.selected === c) this.hooks.select(null);
		this.hooks.sound('remove');
		this.hooks.changed();
	}

	private blastCell(g: Game, c: number) {
		if (tilesOf(this.pi, g.blasted[this.pi])[c] !== TILE_ROCK) return;
		const check = sim.canBlast(g, this.pi, c);
		if (!check.ok) {
			this.hooks.toast(check.why);
			this.hooks.sound('error');
			return;
		}
		sim.blastRock(g, this.pi, c);
		const def = PLANETS[this.pi];
		const s = this.cellCenter(c);
		burst(s.x, s.y, '#ffd9a8', 16, 260, { size: 2.5, life: 0.45 });
		burst(s.x, s.y, mix(def.dark, '#8a8fa6', 0.5), 18, 170, { size: 4, life: 0.8, grav: 260, spark: false });
		ring(s.x, s.y, '#ffb347', this.ts * 0.25, 160, 0.5);
		popup(s.x, s.y - this.ts * 0.4, '-' + fmtShort(check.cost), '#ffb3b3', 13);
		this.hooks.sound('blast');
		this.hooks.changed();
	}

	// ---------- events from the game ----------

	onMade(i: number, t: MachineType) {
		const now = performance.now() / 1000;
		if (now - this.lastSpark[i] < 0.25) return;
		this.lastSpark[i] = now;
		const s = this.cellCenter(i);
		const col = MACHINES[t].color;
		if (t === 'drill') spray(s.x, s.y, PLANETS[this.pi].light, 4, -Math.PI / 2, 1.6, 110);
		else burst(s.x, s.y, col, 5, 70, { size: 2.2, life: 0.4 });
	}

	onShip(kind: 'up' | 'down') {
		this.shipAnims.push({ kind, t: 0 });
	}

	// ---------- drawing ----------

	draw(ctx: CanvasRenderingContext2D, g: Game, time: number, dt: number) {
		const p = g.planets[this.pi];
		const def = PLANETS[this.pi];
		const s = this.ts;
		ctx.save();
		if (this.rot) {
			ctx.translate(this.ox + ROWS * s, this.oy);
			ctx.rotate(Math.PI / 2);
		} else ctx.translate(this.ox, this.oy);

		// board
		const blasted = g.blasted[this.pi];
		const key = `${this.pi}:${s}:${blasted.length}`;
		if (key !== this.boardKey || !this.boardCache) {
			this.boardCache = this.renderBoard(s, blasted);
			this.boardKey = key;
		}
		glow(ctx, (COLS * s) / 2, (ROWS * s) / 2, COLS * s * 0.75, def.color, 0.12);
		ctx.drawImage(this.boardCache, -8, -8, COLS * s + 16, ROWS * s + 16);

		// ore sparkle
		const tiles = tilesOf(this.pi, blasted);
		for (let i = 0; i < tiles.length; i++) {
			if (tiles[i] !== TILE_ORE || p.cells[i]) continue;
			const tw = Math.sin(time * 2 + i * 1.7);
			if (tw > 0.6) glow(ctx, (cx(i) + 0.5) * s, (cy(i) + 0.5) * s, s * 0.5, def.color, (tw - 0.6) * 1.2);
		}

		// pylon auras
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (!m || m.t !== 'pylon') continue;
			const pulse = 0.5 + 0.5 * Math.sin(time * 2.5);
			roundRect(ctx, (cx(i) - 1) * s + 3, (cy(i) - 1) * s + 3, s * 3 - 6, s * 3 - 6, s * 0.3);
			ctx.fillStyle = withAlpha(MACHINES.pylon.color, 0.05 + pulse * 0.04);
			ctx.fill();
			ctx.setLineDash([s * 0.12, s * 0.1]);
			ctx.lineDashOffset = -time * s * 0.3;
			ctx.strokeStyle = withAlpha(MACHINES.pylon.color, 0.3);
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.setLineDash([]);
		}

		// belts
		const speed = beltSpeed(g.research.belt, !!g.perks.belts);
		const offset = (time * speed) % 1;
		const u = s * 0.15;
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (!m) continue;
			if (m.t === 'belt') drawBelt(ctx, m.d, m.bend ?? -1, cx(i) * s, cy(i) * s, s, offset);
			else if (m.t === 'bridge') drawBridgeEnd(ctx, m.d, !!m.end, cx(i) * s, cy(i) * s, s, offset);
			else if (m.t === 'cross') {
				// across runs below, down passes over it on a deck
				const [h, v] = sim.crossLanes(p, i);
				drawBelt(ctx, h, -1, cx(i) * s, cy(i) * s, s, offset);
				for (const it of m.items) if (it.e % 2 === 0) drawMoving(ctx, it, it.e, i, s, u);
				drawCrossDeck(ctx, v, cx(i) * s, cy(i) * s, s, offset);
				for (const it of m.items) if (it.e % 2 === 1) drawMoving(ctx, it, it.e, i, s, u);
			}
		}
		// items on belts and coming off bridges
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (m?.t === 'bridge' && m.end) for (const it of m.items) drawMoving(ctx, it, m.d, i, s, u);
		}
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (!m || m.t !== 'belt') continue;
			for (const it of m.items) drawMoving(ctx, it, m.d, i, s, u);
		}

		// machines
		this.updateBlocks(g, time);
		const blockOf = new Map<number, sim.Block>();
		for (const b of this.blocks) blockOf.set(b.from, b);
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (!m || m.t === 'belt' || m.t === 'cross' || m.t === 'bridge') continue;
			drawMachine(ctx, { t: m.t, d: m.d, lv: m.lv, glow: m.glow || 0, prog: m.job ? m.prog : 0 }, cx(i) * s, cy(i) * s, s, time);
			if (m.t === 'pad') this.drawPad(ctx, g, i, time, dt);
			const b = blockOf.get(i);
			// blocked: red blink for a dead end, amber for a backup
			if (b) blink(ctx, i, s, b.kind === 'dead' ? RED : AMBER, time, 2);
			// items waiting inside, as small dots
			if (m.out.length && m.t !== 'pad') drawItem(ctx, m.out[0], cx(i) * s + s * 0.8, cy(i) * s + s * 0.8, s * 0.09);
		}
		// items this machine cannot use, sliding across on top of it
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (m?.thru?.length) for (const it of m.thru) drawMoving(ctx, it, m.d, i, s, u);
		}

		// bridge decks pass over everything, with their items on top
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (m?.t !== 'bridge' || m.end || m.link === undefined) continue;
			const ax = (cx(i) + 0.5) * s;
			const ay = (cy(i) + 0.5) * s;
			const bx = (cx(m.link) + 0.5) * s;
			const by = (cy(m.link) + 0.5) * s;
			drawBridgeDeck(ctx, ax, ay, bx, by, s, offset);
			// items ride from this end's back edge to the far end's back edge
			const hx = DX[m.d] * s * 0.5;
			const hy = DY[m.d] * s * 0.5;
			for (const it of m.items) {
				const lift = 1 + 0.35 * Math.sin(it.p * Math.PI);
				drawItem(ctx, it.k, ax - hx + (bx - ax) * it.p, ay - hy + (by - ay) * it.p, u * lift);
			}
		}
		this.drawBlockMarks(ctx, s, time);
		this.drawOverlay(ctx, g, time);
		ctx.restore();
	}

	private updateBlocks(g: Game, time: number) {
		const now = new Set<number>();
		for (const b of sim.planetBlocks(g, this.pi)) {
			this.held.set(b.from, { b, t: time, pi: this.pi });
			now.add(b.from);
		}
		this.blocks = [];
		for (const [k, h] of this.held) {
			// Dead ends stay stuck until fixed, so drop them at once. Backups come and go.
			const gone = h.pi !== this.pi || !g.planets[this.pi].cells[k] || (!now.has(k) && (h.b.kind === 'dead' || time - h.t > 1.5));
			if (gone) this.held.delete(k);
			else this.blocks.push(h.b);
		}
	}

	/** The cause of each block: an X where a dead end points, a ring on a slow machine. */
	private drawBlockMarks(ctx: CanvasRenderingContext2D, s: number, time: number) {
		const done = new Set<number>();
		for (const b of this.blocks) {
			if (done.has(b.cell)) continue;
			done.add(b.cell);
			if (b.kind === 'slow') {
				blink(ctx, b.cell, s, AMBER, time, 3);
				continue;
			}
			// The cell to turn, then an X where it points (or at its edge, if off the map).
			blink(ctx, b.cell, s, RED, time, 3);
			const a = 0.8 + 0.2 * Math.sin(time * 6);
			let x: number;
			let y: number;
			if (b.target >= 0) {
				x = (cx(b.target) + 0.5) * s;
				y = (cy(b.target) + 0.5) * s;
			} else {
				const d = b.dir;
				x = (cx(b.cell) + 0.5 + DX[d] * 0.5) * s;
				y = (cy(b.cell) + 0.5 + DY[d] * 0.5) * s;
			}
			const r = s * 0.2;
			const w = Math.max(4, s * 0.1);
			ctx.save();
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(x - r, y - r);
			ctx.lineTo(x + r, y + r);
			ctx.moveTo(x + r, y - r);
			ctx.lineTo(x - r, y + r);
			// A dark edge first, so the X reads on bright ore too.
			ctx.lineWidth = w + 4;
			ctx.strokeStyle = 'rgba(7, 10, 20, 0.85)';
			ctx.stroke();
			ctx.lineWidth = w;
			ctx.strokeStyle = withAlpha(RED, a);
			ctx.shadowColor = RED;
			ctx.shadowBlur = 10;
			ctx.stroke();
			ctx.restore();
		}
	}

	private drawPad(ctx: CanvasRenderingContext2D, g: Game, i: number, time: number, dt: number) {
		const p = g.planets[this.pi];
		const s = this.ts;
		const x = (cx(i) + 0.5) * s;
		const y = (cy(i) + 0.5) * s;
		// stock ring
		const cap = sim.padCap(p);
		const fill = Math.min(1, p.pad.length / cap);
		if (fill > 0) {
			ctx.beginPath();
			ctx.arc(x, y, s * 0.46, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
			ctx.strokeStyle = fill > 0.95 ? '#ff5d73' : '#5ef2ff';
			ctx.lineWidth = s * 0.07;
			ctx.stroke();
		}
		const docked = p.ships.find((sh) => sh.ph === 0);
		const sz = s * 0.3;
		const upAngle = this.rot ? Math.PI : -Math.PI / 2;
		// takeoff / landing animations
		for (let k = this.shipAnims.length - 1; k >= 0; k--) {
			const a = this.shipAnims[k];
			a.t += dt;
			const T = 0.9;
			if (a.t > T) {
				this.shipAnims.splice(k, 1);
				continue;
			}
			const q = a.t / T;
			const lift = a.kind === 'up' ? q * q : 1 - (1 - (1 - q) * (1 - q));
			const scale = 1 + lift * 0.8;
			ctx.globalAlpha = 1 - lift * 0.9;
			// "Up" on screen: in the turned grid that is toward -x.
			const ux = this.rot ? -1 : 0;
			const uy = this.rot ? 0 : -1;
			drawShip(ctx, x + ux * lift * s * 2.2, y + uy * lift * s * 2.2, upAngle, sz * scale, PLANETS[this.pi].color, 1, time);
			ctx.globalAlpha = 1;
		}
		if (docked && !this.shipAnims.some((a) => a.kind === 'down')) {
			const load = docked.cargo.length / sim.shipCap(p);
			glow(ctx, x, y, s * 0.6, PLANETS[this.pi].color, 0.3 + load * 0.5);
			drawShip(ctx, x, y + Math.sin(time * 3) * s * 0.02, upAngle, sz, PLANETS[this.pi].color, 0, time);
		}
	}

	private drawOverlay(ctx: CanvasRenderingContext2D, g: Game, time: number) {
		const s = this.ts;
		const p = g.planets[this.pi];
		// tutorial highlights
		for (const c of this.highlight) {
			const a = 0.5 + 0.5 * Math.sin(time * 5);
			roundRect(ctx, cx(c) * s + 2, cy(c) * s + 2, s - 4, s - 4, s * 0.2);
			ctx.strokeStyle = withAlpha('#ffffff', 0.4 + a * 0.5);
			ctx.lineWidth = 2.5;
			ctx.stroke();
		}
		// selection
		if (this.selected !== null) {
			const c = this.selected;
			roundRect(ctx, cx(c) * s - 2, cy(c) * s - 2, s + 4, s + 4, s * 0.22);
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 2;
			ctx.setLineDash([6, 4]);
			ctx.lineDashOffset = -time * 20;
			ctx.stroke();
			ctx.setLineDash([]);
		}
		const d = this.drag;
		// belt path preview
		if (d && d.mode === 'belt' && (d.moved || this.tool === 'belt')) {
			const dirs = this.pathDirs(g, d.path);
			const cross = this.crossings(g, d.path);
			let cost = 0;
			const price = sim.buildCost(g, this.pi, 'belt');
			const tiles = tilesOf(this.pi, g.blasted[this.pi]);
			for (let k = 0; k < d.path.length; k++) {
				const c = d.path[k];
				const m = p.cells[c];
				if (cross.has(k)) {
					cost += sim.buildCost(g, this.pi, 'cross');
					roundRect(ctx, cx(c) * s + 1, cy(c) * s + 1, s - 2, s - 2, s * 0.15);
					ctx.fillStyle = withAlpha(g.credits >= cost ? '#5ef2ff' : '#ff5d73', 0.16);
					ctx.fill();
					drawCrossDeck(ctx, dirs[k], cx(c) * s, cy(c) * s, s, (time * 1.5) % 1, 0.75);
					continue;
				}
				const bad = tiles[c] === TILE_ROCK;
				if (m && m.t !== 'belt') continue;
				if (m && k === d.path.length - 1 && k > 0) continue;
				if (!m && !bad) cost += price;
				const ok = !bad && g.credits >= cost;
				roundRect(ctx, cx(c) * s + 1, cy(c) * s + 1, s - 2, s - 2, s * 0.15);
				ctx.fillStyle = withAlpha(ok ? '#5ef2ff' : '#ff5d73', 0.16);
				ctx.fill();
				drawBelt(ctx, dirs[k], -1, cx(c) * s, cy(c) * s, s, (time * 1.5) % 1, 0.75);
			}
			this.previewCost = cost;
			this.previewAt = d.path[d.path.length - 1];
		} else this.previewCost = -1;
		// bridge preview
		if (d && d.mode === 'bridge') {
			const a = d.path[0];
			const b = d.path.length === 2 ? d.path[1] : -1;
			const check = b >= 0 ? sim.canBridge(g, this.pi, a, b) : null;
			const col = !check || check.ok ? '#5ef2ff' : '#ff5d73';
			for (const c of b >= 0 ? [a, b] : [a]) {
				roundRect(ctx, cx(c) * s + 1, cy(c) * s + 1, s - 2, s - 2, s * 0.15);
				ctx.fillStyle = withAlpha(col, 0.2);
				ctx.fill();
				ctx.strokeStyle = col;
				ctx.lineWidth = 2;
				ctx.stroke();
			}
			if (b >= 0) {
				const dd = dirTo(a, b);
				const t = (time * 1.5) % 1;
				drawBridgeEnd(ctx, dd, false, cx(a) * s, cy(a) * s, s, t, 0.7);
				drawBridgeEnd(ctx, dd, true, cx(b) * s, cy(b) * s, s, t, 0.7);
				drawBridgeDeck(ctx, (cx(a) + 0.5) * s, (cy(a) + 0.5) * s, (cx(b) + 0.5) * s, (cy(b) + 0.5) * s, s, t, 0.7);
				this.ghost = { cell: b, ok: check!.ok, text: check!.ok ? fmtShort(check!.cost) : check!.why };
			} else this.ghost = { cell: a, ok: true, text: 'Drag to the far end' };
			return;
		}
		if (!d && this.hover !== null && this.tool === 'bridge') {
			const c = this.hover;
			roundRect(ctx, cx(c) * s + 1, cy(c) * s + 1, s - 2, s - 2, s * 0.15);
			ctx.strokeStyle = withAlpha('#5ef2ff', 0.6);
			ctx.lineWidth = 1.5;
			ctx.stroke();
			this.ghost = { cell: c, ok: true, text: `Bridge ${fmtShort(sim.buildCost(g, this.pi, 'bridge'))}` };
			return;
		}
		// machine ghost
		const ghostCell = d && d.mode === 'machine' ? d.path[0] : !d ? this.hover : null;
		if (ghostCell !== null && this.tool && this.tool !== 'remove' && this.tool !== 'belt') {
			const check = sim.canPlace(g, this.pi, cx(ghostCell), cy(ghostCell), this.tool);
			const dir = sim.autoDir(g, this.pi, cx(ghostCell), cy(ghostCell), 0);
			roundRect(ctx, cx(ghostCell) * s + 1, cy(ghostCell) * s + 1, s - 2, s - 2, s * 0.15);
			ctx.fillStyle = withAlpha(check.ok ? '#5ef2ff' : '#ff5d73', 0.22);
			ctx.fill();
			ctx.strokeStyle = check.ok ? '#5ef2ff' : '#ff5d73';
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.globalAlpha = 0.6;
			drawMachine(ctx, { t: this.tool, d: dir, lv: 1, glow: 0, prog: 0 }, cx(ghostCell) * s, cy(ghostCell) * s, s, time);
			ctx.globalAlpha = 1;
			this.ghost = { cell: ghostCell, ok: check.ok, text: check.ok ? fmtShort(check.cost) : check.why };
		} else if (ghostCell !== null && this.tool === 'belt' && !d) {
			roundRect(ctx, cx(ghostCell) * s + 1, cy(ghostCell) * s + 1, s - 2, s - 2, s * 0.15);
			ctx.strokeStyle = withAlpha('#5ef2ff', 0.6);
			ctx.lineWidth = 1.5;
			ctx.stroke();
			this.ghost = null;
		} else if (ghostCell !== null && this.tool === 'remove') {
			const m = p.cells[ghostCell];
			const rock = !m && tilesOf(this.pi, g.blasted[this.pi])[ghostCell] === TILE_ROCK;
			roundRect(ctx, cx(ghostCell) * s + 1, cy(ghostCell) * s + 1, s - 2, s - 2, s * 0.15);
			if (rock) {
				const check = sim.canBlast(g, this.pi, ghostCell);
				ctx.strokeStyle = check.ok ? '#ffb347' : withAlpha('#ff5d73', 0.6);
				ctx.lineWidth = 2;
				ctx.stroke();
				this.ghost = { cell: ghostCell, ok: check.ok, text: check.ok ? `Blast ${fmtShort(check.cost)}` : g.research.blast ? `Blast ${fmtShort(check.cost)}` : 'Needs Blast Charges' };
				return;
			}
			ctx.strokeStyle = m && m.t !== 'pad' ? '#ff5d73' : withAlpha('#ff5d73', 0.3);
			ctx.lineWidth = 2;
			ctx.stroke();
			this.ghost = null;
		} else this.ghost = null;
	}

	previewCost = -1;
	previewAt = -1;
	ghost: { cell: number; ok: boolean; text: string } | null = null;

	/** Text labels in screen space (so they are never turned). */
	drawLabels(ctx: CanvasRenderingContext2D, g: Game) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const p = g.planets[this.pi];
		const padCell = p.cells.findIndex((m) => m?.t === 'pad');
		if (padCell >= 0) {
			const c = this.cellCenter(padCell);
			const n = p.pad.length;
			if (n > 0) label(ctx, c.x, c.y + this.ts * 0.62, `${n}`, '#5ef2ff', 11);
		}
		if (this.ghost) {
			const c = this.cellCenter(this.ghost.cell);
			label(ctx, c.x, c.y - this.ts * 0.72, this.ghost.text, this.ghost.ok ? '#ffffff' : '#ff8a9c', 12);
		}
		if (this.previewCost > 0 && this.previewAt >= 0) {
			const c = this.cellCenter(this.previewAt);
			label(ctx, c.x, c.y - this.ts * 0.72, fmtShort(this.previewCost), g.credits >= this.previewCost ? '#ffffff' : '#ff8a9c', 12);
		}
	}

	private renderBoard(s: number, blasted: readonly number[]): HTMLCanvasElement {
		const def = PLANETS[this.pi];
		const c = document.createElement('canvas');
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		c.width = (COLS * s + 16) * dpr;
		c.height = (ROWS * s + 16) * dpr;
		const g = c.getContext('2d')!;
		g.scale(dpr, dpr);
		g.translate(8, 8);
		const ground = mix(def.dark, '#0a0e1a', 0.72);
		roundRect(g, -6, -6, COLS * s + 12, ROWS * s + 12, s * 0.3);
		g.fillStyle = mix(def.dark, '#05070f', 0.85);
		g.fill();
		g.strokeStyle = withAlpha(def.color, 0.35);
		g.lineWidth = 2;
		g.stroke();
		// Walk the first map, so the random detail on other tiles stays the same after a blast.
		const tiles = baseTilesOf(this.pi);
		let seed = def.seed;
		const r = () => {
			seed = (seed * 16807) % 2147483647;
			return seed / 2147483647;
		};
		for (let i = 0; i < tiles.length; i++) {
			const x = cx(i) * s;
			const y = cy(i) * s;
			roundRect(g, x + 1.5, y + 1.5, s - 3, s - 3, s * 0.14);
			g.fillStyle = (cx(i) + cy(i)) % 2 ? ground : mix(ground, '#ffffff', 0.025);
			g.fill();
			if (tiles[i] === TILE_ORE) {
				g.fillStyle = withAlpha(def.color, 0.12);
				g.fill();
				g.strokeStyle = withAlpha(def.color, 0.45);
				g.lineWidth = 1.2;
				g.stroke();
				for (let k = 0; k < 3; k++) {
					const px = x + s * (0.25 + r() * 0.5);
					const py = y + s * (0.25 + r() * 0.5);
					const cs = s * (0.08 + r() * 0.07);
					g.beginPath();
					g.moveTo(px, py - cs * 1.4);
					g.lineTo(px + cs, py);
					g.lineTo(px, py + cs * 0.8);
					g.lineTo(px - cs, py);
					g.closePath();
					g.fillStyle = def.color;
					g.fill();
					g.beginPath();
					g.moveTo(px, py - cs * 1.4);
					g.lineTo(px + cs, py);
					g.lineTo(px, py);
					g.closePath();
					g.fillStyle = def.light;
					g.fill();
				}
			} else if (tiles[i] === TILE_ROCK && blasted.includes(i)) {
				// a shallow crater where a rock was
				for (let k = 0; k < 7; k++) r();
				g.beginPath();
				g.ellipse(x + s / 2, y + s / 2, s * 0.3, s * 0.24, 0, 0, Math.PI * 2);
				g.fillStyle = withAlpha('#000000', 0.18);
				g.fill();
				g.strokeStyle = withAlpha(def.light, 0.1);
				g.lineWidth = 1.5;
				g.stroke();
			} else if (tiles[i] === TILE_ROCK) {
				g.beginPath();
				const n = 7;
				for (let k = 0; k < n; k++) {
					const a = (k / n) * Math.PI * 2;
					const rr = s * (0.3 + r() * 0.1);
					g.lineTo(x + s / 2 + Math.cos(a) * rr, y + s / 2 + Math.sin(a) * rr * 0.85);
				}
				g.closePath();
				g.fillStyle = mix(def.dark, '#1c2030', 0.6);
				g.fill();
				g.strokeStyle = withAlpha('#000000', 0.4);
				g.lineWidth = 2;
				g.stroke();
				g.fillStyle = withAlpha(def.light, 0.08);
				g.beginPath();
				g.arc(x + s * 0.42, y + s * 0.4, s * 0.12, 0, Math.PI * 2);
				g.fill();
			} else if (r() < 0.25) {
				g.fillStyle = withAlpha(def.light, 0.05);
				g.beginPath();
				g.arc(x + s * (0.2 + r() * 0.6), y + s * (0.2 + r() * 0.6), s * 0.05, 0, Math.PI * 2);
				g.fill();
			}
		}
		return c;
	}
}

/** The far end of a bridge dragged from a toward c: straight, and at most BRIDGE_SPAN away. */
function straightEnd(a: number, c: number): number {
	const dx = cx(c) - cx(a);
	const dy = cy(c) - cy(a);
	if (Math.abs(dx) >= Math.abs(dy)) return idx(cx(a) + Math.sign(dx) * Math.min(Math.abs(dx), BRIDGE_SPAN), cy(a));
	return idx(cx(a), cy(a) + Math.sign(dy) * Math.min(Math.abs(dy), BRIDGE_SPAN));
}

function dirTo(a: number, b: number): Dir {
	const dx = cx(b) - cx(a);
	const dy = cy(b) - cy(a);
	if (dx > 0) return 0;
	if (dy > 0) return 1;
	if (dx < 0) return 2;
	return 3;
}

function neighbor(i: number, d: Dir): number | null {
	const x = cx(i) + DX[d];
	const y = cy(i) + DY[d];
	if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
	return idx(x, y);
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, size: number) {
	ctx.font = `700 ${size}px "Chakra Petch", system-ui, sans-serif`;
	const w = ctx.measureText(text).width + 10;
	roundRect(ctx, x - w / 2, y - size * 0.75, w, size * 1.5, size * 0.5);
	ctx.fillStyle = 'rgba(8,11,22,0.85)';
	ctx.fill();
	ctx.fillStyle = color;
	ctx.fillText(text, x, y + 1);
}


/** An item moving across a cell: in from side `it.e`, out the side `out`, along a curve. */
function drawMoving(ctx: CanvasRenderingContext2D, it: BeltItem, out: Dir, i: number, s: number, u: number) {
	const x0 = (cx(i) + 0.5) * s;
	const y0 = (cy(i) + 0.5) * s;
	const ax = x0 - DX[it.e] * s * 0.5;
	const ay = y0 - DY[it.e] * s * 0.5;
	const bx = x0 + DX[out] * s * 0.5;
	const by = y0 + DY[out] * s * 0.5;
	const q = it.p;
	const k1 = (1 - q) * (1 - q);
	const k2 = 2 * (1 - q) * q;
	const k3 = q * q;
	drawItem(ctx, it.k, ax * k1 + x0 * k2 + bx * k3, ay * k1 + y0 * k2 + by * k3, u);
}
