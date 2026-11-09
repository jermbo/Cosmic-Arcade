// The planet view: the factory grid, drawing and touch / mouse building.

import { COLS, DX, DY, MACHINES, PLANETS, ROWS, TILE_ORE, TILE_ROCK, beltSpeed, shipCargo } from '../core/data.ts';
import type { Dir, MachineType } from '../core/data.ts';
import * as sim from '../core/sim.ts';
import { tilesOf } from '../core/state.ts';
import type { Game, Machine } from '../core/state.ts';
import { drawBelt, drawItem, drawMachine, drawShip, glow, mix, roundRect, withAlpha } from './draw.ts';
import { burst, popup, ring, spray } from './fx.ts';
import { fmt as fmtShort } from '../core/format.ts';

export type Tool = MachineType | 'remove' | null;

export interface PlanetHooks {
	sound: (name: 'place' | 'belt' | 'remove' | 'error' | 'click') => void;
	toast: (text: string) => void;
	select: (cell: number | null) => void;
	changed: () => void;
}

interface Drag {
	path: number[];
	moved: boolean;
	mode: 'belt' | 'machine' | 'remove' | 'none';
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
	layout(w: number, h: number, top: number, bottom: number) {
		const availH = h - top - bottom;
		const pad = 12;
		const flat = Math.min((w - pad * 2) / COLS, (availH - pad * 2) / ROWS);
		const tall = Math.min((w - pad * 2) / ROWS, (availH - pad * 2) / COLS);
		this.rot = tall > flat * 1.08;
		this.ts = Math.floor(Math.max(flat, tall));
		const gw = (this.rot ? ROWS : COLS) * this.ts;
		const gh = (this.rot ? COLS : ROWS) * this.ts;
		this.ox = Math.round((w - gw) / 2);
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
		const mode = this.tool === 'belt' ? 'belt' : this.tool === 'remove' ? 'remove' : this.tool ? 'machine' : 'none';
		this.drag = { path: [c], moved: false, mode, pointer: id, startX: sx, startY: sy };
		if (mode === 'remove') this.removeCell(g, c);
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
		} else if (d.mode === 'machine' && this.tool && this.tool !== 'remove') {
			const target = d.moved ? (c ?? d.path[0]) : d.path[0];
			this.placeMachine(g, target, this.tool);
		} else if (d.mode === 'none') {
			const m = g.planets[this.pi].cells[d.path[0]];
			this.hooks.select(m ? d.path[0] : null);
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

	private commitBelts(g: Game, path: number[]) {
		const p = g.planets[this.pi];
		const tiles = tilesOf(this.pi);
		const dirs = this.pathDirs(g, path);
		let placed = 0;
		let short = false;
		for (let i = 0; i < path.length; i++) {
			const c = path[i];
			const m = p.cells[c];
			if (tiles[c] === TILE_ROCK) continue;
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

	private removeCell(g: Game, c: number) {
		const m = g.planets[this.pi].cells[c];
		if (!m || m.t === 'pad') return;
		const refund = sim.removeAt(g, this.pi, cx(c), cy(c));
		const s = this.cellCenter(c);
		burst(s.x, s.y, '#ff6b8a', 8, 120, { size: 2.5, life: 0.4 });
		if (refund > 0) popup(s.x, s.y, '+' + fmtShort(refund), '#9dffb0', 12);
		if (this.selected === c) this.hooks.select(null);
		this.hooks.sound('remove');
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
		const key = `${this.pi}:${s}`;
		if (key !== this.boardKey || !this.boardCache) {
			this.boardCache = this.renderBoard(s);
			this.boardKey = key;
		}
		glow(ctx, (COLS * s) / 2, (ROWS * s) / 2, COLS * s * 0.75, def.color, 0.12);
		ctx.drawImage(this.boardCache, -8, -8, COLS * s + 16, ROWS * s + 16);

		// ore sparkle
		const tiles = tilesOf(this.pi);
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
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (m && m.t === 'belt') drawBelt(ctx, m.d, m.bend ?? -1, cx(i) * s, cy(i) * s, s, offset);
		}
		// items on belts
		const u = s * 0.15;
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (!m || m.t !== 'belt') continue;
			const x0 = (cx(i) + 0.5) * s;
			const y0 = (cy(i) + 0.5) * s;
			for (const it of m.items) {
				const ax = x0 - DX[it.e] * s * 0.5;
				const ay = y0 - DY[it.e] * s * 0.5;
				const bx = x0 + DX[m.d] * s * 0.5;
				const by = y0 + DY[m.d] * s * 0.5;
				const q = it.p;
				const k1 = (1 - q) * (1 - q);
				const k2 = 2 * (1 - q) * q;
				const k3 = q * q;
				drawItem(ctx, it.k, ax * k1 + x0 * k2 + bx * k3, ay * k1 + y0 * k2 + by * k3, u);
			}
		}

		// machines
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (!m || m.t === 'belt') continue;
			drawMachine(ctx, { t: m.t, d: m.d, lv: m.lv, glow: m.glow || 0, prog: m.job ? m.prog : 0 }, cx(i) * s, cy(i) * s, s, time);
			if (m.t === 'pad') this.drawPad(ctx, g, i, time, dt);
			else if ((m.stuck || 0) > 2) {
				// blocked: a soft red blink
				const a = 0.35 + 0.35 * Math.sin(time * 6);
				roundRect(ctx, cx(i) * s + 2, cy(i) * s + 2, s - 4, s - 4, s * 0.18);
				ctx.strokeStyle = withAlpha('#ff5d73', a);
				ctx.lineWidth = 2;
				ctx.stroke();
			}
			// items waiting inside, as small dots
			if (m.out.length && m.t !== 'pad') drawItem(ctx, m.out[0], cx(i) * s + s * 0.8, cy(i) * s + s * 0.8, s * 0.09);
		}

		this.drawOverlay(ctx, g, time);
		ctx.restore();
	}

	private drawPad(ctx: CanvasRenderingContext2D, g: Game, i: number, time: number, dt: number) {
		const p = g.planets[this.pi];
		const s = this.ts;
		const x = (cx(i) + 0.5) * s;
		const y = (cy(i) + 0.5) * s;
		// stock ring
		const cap = 40 + shipCargo(p.up.cargo) * 2;
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
			const load = docked.cargo.length / shipCargo(p.up.cargo);
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
			let cost = 0;
			const price = sim.buildCost(g, this.pi, 'belt');
			const tiles = tilesOf(this.pi);
			for (let k = 0; k < d.path.length; k++) {
				const c = d.path[k];
				const m = p.cells[c];
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
			roundRect(ctx, cx(ghostCell) * s + 1, cy(ghostCell) * s + 1, s - 2, s - 2, s * 0.15);
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

	private renderBoard(s: number): HTMLCanvasElement {
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
		const tiles = tilesOf(this.pi);
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

