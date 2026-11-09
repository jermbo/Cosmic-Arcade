// The planet view: the camera on the factory grid, and the drawing of it. planet-build.ts has the building gestures.

import { MACHINES } from '../content/machines.ts';
import type { MachineType } from '../content/machines.ts';
import { PLANETS } from '../content/planets.ts';
import { DX, DY } from '../core/direction.ts';
import type { Dir } from '../core/direction.ts';
import { beltSpeed } from '../core/levels.ts';
import { hasPower } from '../core/effects.ts';
import { TILE_ORE, TILE_ROCK } from '../core/tiles.ts';
import {
	MAX_CELLS,
	MAX_COLS,
	MAX_ROWS,
	PLOT,
	type Bounds,
	buyablePlots,
	cellIdx,
	cellX,
	cellY,
	inPlay,
	nextPlotCost,
	ownedPlots,
	plotBounds,
	plotCells,
	plotOf,
	plotOfCell,
} from '../core/grid.ts';
import { planetBlocks } from '../core/blocks.ts';
import type { Block } from '../core/blocks.ts';
import { autoDir, canBlast, canBridge, canPlace } from '../core/build.ts';
import { crossLanes } from '../core/layout.ts';
import { buildCost } from '../core/prices.ts';
import { padCap, shipCap } from '../core/ships.ts';
import { baseTilesOf, tilesOf } from '../core/planet-map.ts';
import type { BeltItem, Game } from '../core/game.ts';
import { drawBelt, drawBridgeDeck, drawBridgeEnd, drawCrossDeck, drawItem, drawMachine, drawShip, glow, mix, roundRect, withAlpha } from './draw.ts';
import { burst, spray } from './fx.ts';
import { PlanetBuilder, dirTo } from './planet-build.ts';
import { fmt as fmtShort } from '../core/format.ts';

export type Tool = MachineType | 'remove' | null;

export interface PlanetHooks {
	sound: (name: 'place' | 'belt' | 'remove' | 'error' | 'click' | 'blast') => void;
	toast: (text: string) => void;
	select: (cell: number | null) => void;
	changed: () => void;
	expanded?: () => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

interface Anim {
	kind: 'up' | 'down';
	t: number;
}

const idx = cellIdx;

const RED = '#ff5d73';
const AMBER = '#ffb347';

/** A pulsing outline around a cell. */
function blink(ctx: CanvasRenderingContext2D, i: number, s: number, color: string, time: number, width: number, ox: number, oy: number) {
	const a = 0.35 + 0.35 * Math.sin(time * 6);
	roundRect(ctx, (cellX(i) - ox) * s + 2, (cellY(i) - oy) * s + 2, s - 4, s - 4, s * 0.18);
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
	gridCols = 12;
	gridRows = 8;
	offX = 0;
	offY = 0;
	zoom = 1;
	panX = 0;
	panY = 0;
	private viewW = 0;
	private viewH = 0;
	/** Blocked machines on this planet. Backups are held a moment so the marks do not flicker. */
	blocks: Block[] = [];
	private held = new Map<number, { b: Block; t: number; pi: number }>();
	private boardCache: HTMLCanvasElement | null = null;
	private boardKey = '';
	private lastSpark = new Float32Array(MAX_CELLS);
	private shipAnims: Anim[] = [];
	/** For the tutorial: cells to point at. */
	highlight: number[] = [];

	/** The gestures that build on this view. */
	readonly build: PlanetBuilder;

	constructor(hooks: PlanetHooks) {
		this.build = new PlanetBuilder(this, hooks);
	}

	open(pi: number) {
		this.pi = pi;
		this.selected = null;
		this.build.drag = null;
		this.shipAnims = [];
		this.boardKey = '';
		this.zoom = 1;
		this.panX = 0;
		this.panY = 0;
	}

	resetCamera() {
		this.zoom = 1;
		this.panX = 0;
		this.panY = 0;
	}

	invalidateBoard() {
		this.boardKey = '';
	}

	/** Zoom by a factor, keeping the board point under (sx, sy) in place. */
	zoomAt(factor: number, sx: number, sy: number) {
		const z0 = this.zoom;
		const z1 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z0 * factor));
		if (z1 === z0) return;
		const w = (this.rot ? this.gridRows : this.gridCols) * this.ts;
		const h = (this.rot ? this.gridCols : this.gridRows) * this.ts;
		// layout() keeps the board centred, so its origin shifts as the zoom changes.
		const ox1 = this.ox + (w * (z0 - z1)) / 2;
		const oy1 = this.oy + (h * (z0 - z1)) / 2;
		const k = z1 / z0;
		this.panX = sx - ox1 - (sx - this.ox - this.panX) * k;
		this.panY = sy - oy1 - (sy - this.oy - this.panY) * k;
		this.ox = ox1;
		this.oy = oy1;
		this.zoom = z1;
		this.clampPan();
	}

	panBy(dx: number, dy: number) {
		this.panX += dx;
		this.panY += dy;
		this.clampPan();
	}

	/** Keep part of the board on screen. */
	private clampPan() {
		const ts = this.tileScale();
		const w = (this.rot ? this.gridRows : this.gridCols) * ts;
		const h = (this.rot ? this.gridCols : this.gridRows) * ts;
		const mx = Math.max(0, (w + this.viewW) / 2 - 80);
		const my = Math.max(0, (h + this.viewH) / 2 - 80);
		this.panX = Math.min(mx, Math.max(-mx, this.panX));
		this.panY = Math.min(my, Math.max(-my, this.panY));
	}

	/** Fits the grid in the free area, north up. */
	layout(w: number, h: number, top: number, bottom: number, b: Bounds, left = 0, right = 0) {
		this.offX = b.x0;
		this.offY = b.y0;
		this.gridCols = b.x1 - b.x0 + 1;
		this.gridRows = b.y1 - b.y0 + 1;
		const availW = w - left - right;
		const availH = h - top - bottom;
		this.viewW = availW;
		this.viewH = availH;
		const pad = 12;
		const cols = this.gridCols;
		const rows = this.gridRows;
		// Never rotate: land grows in any direction, and a turning board makes "right" mean a different plot.
		this.rot = false;
		this.ts = Math.floor(Math.min((availW - pad * 2) / cols, (availH - pad * 2) / rows));
		const z = this.zoom;
		const gw = (this.rot ? rows : cols) * this.ts * z;
		const gh = (this.rot ? cols : rows) * this.ts * z;
		this.ox = Math.round(left + (availW - gw) / 2);
		this.oy = Math.round(top + (availH - gh) / 2);
		this.boardKey = '';
		this.clampPan();
	}

	private tileScale() {
		return this.ts * this.zoom;
	}

	private tileX(i: number) {
		return cellX(i) - this.offX;
	}

	private tileY(i: number) {
		return cellY(i) - this.offY;
	}

	/** Screen point to a plot that can be bought, or null. */
	plotAt(sx: number, sy: number, g: Game): number | null {
		const ts = this.tileScale();
		let gx: number;
		let gy: number;
		if (this.rot) {
			gx = (sy - this.oy - this.panY) / ts;
			gy = (this.ox + this.panX + this.gridRows * ts - sx) / ts;
		} else {
			gx = (sx - this.ox - this.panX) / ts;
			gy = (sy - this.oy - this.panY) / ts;
		}
		const x = Math.floor(gx) + this.offX;
		const y = Math.floor(gy) + this.offY;
		if (x < 0 || y < 0 || x >= MAX_COLS || y >= MAX_ROWS) return null;
		const plot = plotOf(x, y);
		return buyablePlots(g.planets[this.pi]).includes(plot) ? plot : null;
	}

	/** Screen point to grid cell, or null. */
	cellAt(sx: number, sy: number, p: import('../core/game.ts').PlanetState): number | null {
		const ts = this.tileScale();
		let gx: number;
		let gy: number;
		if (this.rot) {
			gx = (sy - this.oy - this.panY) / ts;
			gy = (this.ox + this.panX + this.gridRows * ts - sx) / ts;
		} else {
			gx = (sx - this.ox - this.panX) / ts;
			gy = (sy - this.oy - this.panY) / ts;
		}
		const x = Math.floor(gx) + this.offX;
		const y = Math.floor(gy) + this.offY;
		if (!inPlay(x, y, p, this.pi)) return null;
		return idx(x, y);
	}

	/** Grid point (in tiles) to screen point. */
	toScreen(gx: number, gy: number) {
		const ts = this.tileScale();
		if (this.rot) return { x: this.ox + this.panX + (this.gridRows - gy) * ts, y: this.oy + this.panY + gx * ts };
		return { x: this.ox + this.panX + gx * ts, y: this.oy + this.panY + gy * ts };
	}

	cellCenter(i: number) {
		return this.toScreen(this.tileX(i) + 0.5, this.tileY(i) + 0.5);
	}

	/** The screen box of the board. */
	bounds() {
		const ts = this.tileScale();
		const w = (this.rot ? this.gridRows : this.gridCols) * ts;
		const h = (this.rot ? this.gridCols : this.gridRows) * ts;
		return { x: this.ox + this.panX, y: this.oy + this.panY, w, h };
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
		const cols = this.gridCols;
		const rows = this.gridRows;
		const s = this.ts;
		const z = this.zoom;
		ctx.save();
		if (this.rot) {
			ctx.translate(this.ox + this.panX + rows * s * z, this.oy + this.panY);
			ctx.rotate(Math.PI / 2);
		} else ctx.translate(this.ox + this.panX, this.oy + this.panY);
		ctx.scale(z, z);

		// board
		const blasted = g.blasted[this.pi];
		const key = `${this.pi}:${s}:${blasted.length}:${ownedPlots(p).join(',')}`;
		const box = { x0: this.offX, y0: this.offY, x1: this.offX + cols - 1, y1: this.offY + rows - 1 };
		if (key !== this.boardKey || !this.boardCache) {
			this.boardCache = this.renderBoard(s, blasted, box, ownedPlots(p));
			this.boardKey = key;
		}
		glow(ctx, (cols * s) / 2, (rows * s) / 2, cols * s * 0.75, def.color, 0.12);
		ctx.drawImage(this.boardCache, -8, -8, cols * s + 16, rows * s + 16);

		// ore sparkle
		const tiles = tilesOf(this.pi, blasted);
		for (let y = box.y0; y <= box.y1; y++) {
			for (let x = box.x0; x <= box.x1; x++) {
				const i = idx(x, y);
				if (tiles[i] !== TILE_ORE || p.cells[i] || !inPlay(x, y, p)) continue;
				const tw = Math.sin(time * 2 + i * 1.7);
				if (tw > 0.6) glow(ctx, (x - box.x0 + 0.5) * s, (y - box.y0 + 0.5) * s, s * 0.5, def.color, (tw - 0.6) * 1.2);
			}
		}

		this.drawPlotOffers(ctx, g, s, time);

		// pylon auras
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (!m || m.t !== 'pylon') continue;
			const pulse = 0.5 + 0.5 * Math.sin(time * 2.5);
			roundRect(ctx, (this.tileX(i) - 1) * s + 3, (this.tileY(i) - 1) * s + 3, s * 3 - 6, s * 3 - 6, s * 0.3);
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
		const speed = beltSpeed(g);
		const offset = (time * speed) % 1;
		const u = s * 0.15;
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (!m) continue;
			if (m.t === 'belt') drawBelt(ctx, m.d, m.bend ?? -1, this.tileX(i) * s, this.tileY(i) * s, s, offset);
			else if (m.t === 'bridge') drawBridgeEnd(ctx, m.d, !!m.end, this.tileX(i) * s, this.tileY(i) * s, s, offset);
			else if (m.t === 'cross') {
				// across runs below, down passes over it on a deck
				const [h, v] = crossLanes(p, i, this.pi);
				drawBelt(ctx, h, -1, this.tileX(i) * s, this.tileY(i) * s, s, offset);
				for (const it of m.items) if (it.e % 2 === 0) drawMoving(ctx, it, it.e, i, s, u, this.offX, this.offY);
				drawCrossDeck(ctx, v, this.tileX(i) * s, this.tileY(i) * s, s, offset);
				for (const it of m.items) if (it.e % 2 === 1) drawMoving(ctx, it, it.e, i, s, u, this.offX, this.offY);
			}
		}
		// items on belts and coming off bridges
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (m?.t === 'bridge' && m.end) for (const it of m.items) drawMoving(ctx, it, m.d, i, s, u, this.offX, this.offY);
		}
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (!m || m.t !== 'belt') continue;
			for (const it of m.items) drawMoving(ctx, it, m.d, i, s, u, this.offX, this.offY);
		}

		// machines
		this.updateBlocks(g, time);
		const blockOf = new Map<number, Block>();
		for (const b of this.blocks) blockOf.set(b.from, b);
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (!m || m.t === 'belt' || m.t === 'cross' || m.t === 'bridge') continue;
			drawMachine(ctx, { t: m.t, d: m.d, lv: m.lv, glow: m.glow || 0, prog: m.job ? m.prog : 0 }, this.tileX(i) * s, this.tileY(i) * s, s, time);
			if (m.t === 'pad') this.drawPad(ctx, g, i, time, dt);
			const b = blockOf.get(i);
			// blocked: red blink for a dead end, amber for a backup
			if (b) blink(ctx, i, s, b.kind === 'dead' ? RED : AMBER, time, 2, this.offX, this.offY);
			// items waiting inside, as small dots
			if (m.out.length && m.t !== 'pad') drawItem(ctx, m.out[0], this.tileX(i) * s + s * 0.8, this.tileY(i) * s + s * 0.8, s * 0.09);
		}
		// items this machine cannot use, sliding across on top of it
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (m?.thru?.length) for (const it of m.thru) drawMoving(ctx, it, m.d, i, s, u, this.offX, this.offY);
		}

		// bridge decks pass over everything, with their items on top
		for (let i = 0; i < p.cells.length; i++) {
			const m = p.cells[i];
			if (m?.t !== 'bridge' || m.end || m.link === undefined) continue;
			const ax = (this.tileX(i) + 0.5) * s;
			const ay = (this.tileY(i) + 0.5) * s;
			const bx = (this.tileX(m.link) + 0.5) * s;
			const by = (this.tileY(m.link) + 0.5) * s;
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
		for (const b of planetBlocks(g, this.pi)) {
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
				blink(ctx, b.cell, s, AMBER, time, 3, this.offX, this.offY);
				continue;
			}
			// The cell to turn, then an X where it points (or at its edge, if off the map).
			blink(ctx, b.cell, s, RED, time, 3, this.offX, this.offY);
			const a = 0.8 + 0.2 * Math.sin(time * 6);
			let x: number;
			let y: number;
			if (b.target >= 0) {
				x = (this.tileX(b.target) + 0.5) * s;
				y = (this.tileY(b.target) + 0.5) * s;
			} else {
				const d = b.dir;
				x = (this.tileX(b.cell) + 0.5 + DX[d] * 0.5) * s;
				y = (this.tileY(b.cell) + 0.5 + DY[d] * 0.5) * s;
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
		const x = (this.tileX(i) + 0.5) * s;
		const y = (this.tileY(i) + 0.5) * s;
		// stock ring
		const cap = padCap(p);
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
			const load = docked.cargo.length / shipCap(p);
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
			roundRect(ctx, this.tileX(c) * s + 2, this.tileY(c) * s + 2, s - 4, s - 4, s * 0.2);
			ctx.strokeStyle = withAlpha('#ffffff', 0.4 + a * 0.5);
			ctx.lineWidth = 2.5;
			ctx.stroke();
		}
		// selection
		if (this.selected !== null) {
			const c = this.selected;
			roundRect(ctx, this.tileX(c) * s - 2, this.tileY(c) * s - 2, s + 4, s + 4, s * 0.22);
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 2;
			ctx.setLineDash([6, 4]);
			ctx.lineDashOffset = -time * 20;
			ctx.stroke();
			ctx.setLineDash([]);
		}
		const d = this.build.drag;
		// belt path preview
		if (d && d.mode === 'belt' && (d.moved || this.tool === 'belt')) {
			const dirs = this.build.pathDirs(g, d.path);
			const cross = this.build.crossings(g, d.path);
			let cost = 0;
			const price = buildCost(g, this.pi, 'belt');
			const tiles = tilesOf(this.pi, g.blasted[this.pi]);
			for (let k = 0; k < d.path.length; k++) {
				const c = d.path[k];
				const m = p.cells[c];
				if (cross.has(k)) {
					cost += buildCost(g, this.pi, 'cross');
					roundRect(ctx, this.tileX(c) * s + 1, this.tileY(c) * s + 1, s - 2, s - 2, s * 0.15);
					ctx.fillStyle = withAlpha(g.credits >= cost ? '#5ef2ff' : '#ff5d73', 0.16);
					ctx.fill();
					drawCrossDeck(ctx, dirs[k], this.tileX(c) * s, this.tileY(c) * s, s, (time * 1.5) % 1, 0.75);
					continue;
				}
				const bad = tiles[c] === TILE_ROCK;
				if (m && m.t !== 'belt') continue;
				if (m && k === d.path.length - 1 && k > 0) continue;
				if (!m && !bad) cost += price;
				const ok = !bad && g.credits >= cost;
				roundRect(ctx, this.tileX(c) * s + 1, this.tileY(c) * s + 1, s - 2, s - 2, s * 0.15);
				ctx.fillStyle = withAlpha(ok ? '#5ef2ff' : '#ff5d73', 0.16);
				ctx.fill();
				drawBelt(ctx, dirs[k], -1, this.tileX(c) * s, this.tileY(c) * s, s, (time * 1.5) % 1, 0.75);
			}
			this.previewCost = cost;
			this.previewAt = d.path[d.path.length - 1];
		} else this.previewCost = -1;
		// bridge preview
		if (d && d.mode === 'bridge') {
			const a = d.path[0];
			const b = d.path.length === 2 ? d.path[1] : -1;
			const check = b >= 0 ? canBridge(g, this.pi, a, b) : null;
			const col = !check || check.ok ? '#5ef2ff' : '#ff5d73';
			for (const c of b >= 0 ? [a, b] : [a]) {
				roundRect(ctx, this.tileX(c) * s + 1, this.tileY(c) * s + 1, s - 2, s - 2, s * 0.15);
				ctx.fillStyle = withAlpha(col, 0.2);
				ctx.fill();
				ctx.strokeStyle = col;
				ctx.lineWidth = 2;
				ctx.stroke();
			}
			if (b >= 0) {
				const dd = dirTo(a, b);
				const t = (time * 1.5) % 1;
				drawBridgeEnd(ctx, dd, false, this.tileX(a) * s, this.tileY(a) * s, s, t, 0.7);
				drawBridgeEnd(ctx, dd, true, this.tileX(b) * s, this.tileY(b) * s, s, t, 0.7);
				drawBridgeDeck(ctx, (this.tileX(a) + 0.5) * s, (this.tileY(a) + 0.5) * s, (this.tileX(b) + 0.5) * s, (this.tileY(b) + 0.5) * s, s, t, 0.7);
				this.ghost = { cell: b, ok: check!.ok, text: check!.ok ? fmtShort(check!.cost) : check!.why };
			} else this.ghost = { cell: a, ok: true, text: 'Drag to the far end' };
			return;
		}
		if (!d && this.hover !== null && this.tool === 'bridge') {
			const c = this.hover;
			roundRect(ctx, this.tileX(c) * s + 1, this.tileY(c) * s + 1, s - 2, s - 2, s * 0.15);
			ctx.strokeStyle = withAlpha('#5ef2ff', 0.6);
			ctx.lineWidth = 1.5;
			ctx.stroke();
			this.ghost = { cell: c, ok: true, text: `Bridge ${fmtShort(buildCost(g, this.pi, 'bridge'))}` };
			return;
		}
		// machine ghost
		const ghostCell = d && d.mode === 'machine' ? d.path[0] : !d ? this.hover : null;
		if (ghostCell !== null && this.tool && this.tool !== 'remove' && this.tool !== 'belt') {
			const check = canPlace(g, this.pi, this.tileX(ghostCell), this.tileY(ghostCell), this.tool);
			const dir = autoDir(g, this.pi, this.tileX(ghostCell), this.tileY(ghostCell), 0);
			roundRect(ctx, this.tileX(ghostCell) * s + 1, this.tileY(ghostCell) * s + 1, s - 2, s - 2, s * 0.15);
			ctx.fillStyle = withAlpha(check.ok ? '#5ef2ff' : '#ff5d73', 0.22);
			ctx.fill();
			ctx.strokeStyle = check.ok ? '#5ef2ff' : '#ff5d73';
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.globalAlpha = 0.6;
			drawMachine(ctx, { t: this.tool, d: dir, lv: 1, glow: 0, prog: 0 }, this.tileX(ghostCell) * s, this.tileY(ghostCell) * s, s, time);
			ctx.globalAlpha = 1;
			this.ghost = { cell: ghostCell, ok: check.ok, text: check.ok ? fmtShort(check.cost) : check.why };
		} else if (ghostCell !== null && this.tool === 'belt' && !d) {
			roundRect(ctx, this.tileX(ghostCell) * s + 1, this.tileY(ghostCell) * s + 1, s - 2, s - 2, s * 0.15);
			ctx.strokeStyle = withAlpha('#5ef2ff', 0.6);
			ctx.lineWidth = 1.5;
			ctx.stroke();
			this.ghost = null;
		} else if (ghostCell !== null && this.tool === 'remove') {
			const m = p.cells[ghostCell];
			const rock = !m && tilesOf(this.pi, g.blasted[this.pi])[ghostCell] === TILE_ROCK;
			roundRect(ctx, this.tileX(ghostCell) * s + 1, this.tileY(ghostCell) * s + 1, s - 2, s - 2, s * 0.15);
			if (rock) {
				const check = canBlast(g, this.pi, ghostCell);
				ctx.strokeStyle = check.ok ? '#ffb347' : withAlpha('#ff5d73', 0.6);
				ctx.lineWidth = 2;
				ctx.stroke();
				this.ghost = { cell: ghostCell, ok: check.ok, text: check.ok ? `Blast ${fmtShort(check.cost)}` : hasPower(g, 'blastRocks') ? `Blast ${fmtShort(check.cost)}` : 'Needs Blast Charges' };
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

	/** Plots for sale: dashed outline, faint ore hints, price in the middle. */
	private drawPlotOffers(ctx: CanvasRenderingContext2D, g: Game, s: number, time: number) {
		const p = g.planets[this.pi];
		const tiles = tilesOf(this.pi, g.blasted[this.pi]);
		const def = PLANETS[this.pi];
		const cost = nextPlotCost(this.pi, p);
		const afford = g.credits >= cost;
		const pulse = afford ? 0.65 + 0.35 * Math.sin(time * 3) : 0.45;
		for (const plot of buyablePlots(p)) {
			const b = plotBounds(plot);
			const x0 = (b.x0 - this.offX) * s;
			const y0 = (b.y0 - this.offY) * s;
			const w = PLOT * s;
			roundRect(ctx, x0 + 4, y0 + 4, w - 8, w - 8, s * 0.35);
			ctx.fillStyle = withAlpha(def.dark, afford ? 0.22 : 0.12);
			ctx.fill();
			ctx.setLineDash([s * 0.35, s * 0.25]);
			ctx.strokeStyle = withAlpha(afford ? '#ffe58a' : '#8892b8', pulse);
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.setLineDash([]);
			for (const c of plotCells(plot)) {
				if (tiles[c] !== TILE_ORE) continue;
				ctx.fillStyle = withAlpha(def.color, afford ? 0.28 : 0.16);
				ctx.beginPath();
				ctx.arc((cellX(c) - this.offX + 0.5) * s, (cellY(c) - this.offY + 0.5) * s, s * 0.16, 0, Math.PI * 2);
				ctx.fill();
			}
			const size = Math.max(12, Math.floor(s * 0.55));
			ctx.save();
			ctx.translate(x0 + w / 2, y0 + w / 2);
			if (this.rot) ctx.rotate(-Math.PI / 2);
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			label(ctx, 0, 0, fmtShort(cost), afford ? '#ffe58a' : '#ff9aaa', size);
			ctx.restore();
		}
	}

	private renderBoard(s: number, blasted: readonly number[], box: Bounds, owned: number[]): HTMLCanvasElement {
		const def = PLANETS[this.pi];
		const c = document.createElement('canvas');
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const cols = box.x1 - box.x0 + 1;
		const rows = box.y1 - box.y0 + 1;
		c.width = (cols * s + 16) * dpr;
		c.height = (rows * s + 16) * dpr;
		const g = c.getContext('2d')!;
		g.scale(dpr, dpr);
		g.translate(8, 8);
		const ground = mix(def.dark, '#0a0e1a', 0.72);
		for (const plot of owned) {
			const b = plotBounds(plot);
			roundRect(g, (b.x0 - box.x0) * s - 3, (b.y0 - box.y0) * s - 3, PLOT * s + 6, PLOT * s + 6, s * 0.2);
			g.fillStyle = mix(def.dark, '#05070f', 0.85);
			g.fill();
			g.strokeStyle = withAlpha(def.color, 0.3);
			g.lineWidth = 2;
			g.stroke();
		}
		// Walk the first map, so the random detail on other tiles stays the same after a blast.
		const tiles = baseTilesOf(this.pi);
		let seed = def.seed;
		const r = () => {
			seed = (seed * 16807) % 2147483647;
			return seed / 2147483647;
		};
		for (let y = box.y0; y <= box.y1; y++) {
			for (let x = box.x0; x <= box.x1; x++) {
				const i = idx(x, y);
				if (!owned.includes(plotOfCell(i))) continue;
				seed = (def.seed * 977 + i * 7919) % 2147483647 || 1;
				const lx = x - box.x0;
				const ly = y - box.y0;
				const x0 = lx * s;
				const y0 = ly * s;
				roundRect(g, x0 + 1.5, y0 + 1.5, s - 3, s - 3, s * 0.14);
				g.fillStyle = (x + y) % 2 ? ground : mix(ground, '#ffffff', 0.025);
				g.fill();
				if (tiles[i] === TILE_ORE) {
				g.fillStyle = withAlpha(def.color, 0.12);
				g.fill();
				g.strokeStyle = withAlpha(def.color, 0.45);
				g.lineWidth = 1.2;
				g.stroke();
				for (let k = 0; k < 3; k++) {
					const px = x0 + s * (0.25 + r() * 0.5);
					const py = y0 + s * (0.25 + r() * 0.5);
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
				g.ellipse(x0 + s / 2, y0 + s / 2, s * 0.3, s * 0.24, 0, 0, Math.PI * 2);
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
					g.lineTo(x0 + s / 2 + Math.cos(a) * rr, y0 + s / 2 + Math.sin(a) * rr * 0.85);
				}
				g.closePath();
				g.fillStyle = mix(def.dark, '#1c2030', 0.6);
				g.fill();
				g.strokeStyle = withAlpha('#000000', 0.4);
				g.lineWidth = 2;
				g.stroke();
				g.fillStyle = withAlpha(def.light, 0.08);
				g.beginPath();
				g.arc(x0 + s * 0.42, y0 + s * 0.4, s * 0.12, 0, Math.PI * 2);
				g.fill();
			} else if (r() < 0.25) {
				g.fillStyle = withAlpha(def.light, 0.05);
				g.beginPath();
				g.arc(x0 + s * (0.2 + r() * 0.6), y0 + s * (0.2 + r() * 0.6), s * 0.05, 0, Math.PI * 2);
				g.fill();
				}
			}
		}
		return c;
	}
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
function drawMoving(ctx: CanvasRenderingContext2D, it: BeltItem, out: Dir, i: number, s: number, u: number, ox: number, oy: number) {
	const x0 = (cellX(i) - ox + 0.5) * s;
	const y0 = (cellY(i) - oy + 0.5) * s;
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
