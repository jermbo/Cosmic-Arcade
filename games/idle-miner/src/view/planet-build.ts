// Building on the planet view with a finger or a mouse: lay belts, place machines and bridges, remove, blast, and buy land.

import { BRIDGE_SPAN, MACHINES } from '../content/machines.ts';
import type { MachineType } from '../content/machines.ts';
import { PLANETS } from '../content/planets.ts';
import { DX, DY } from '../core/direction.ts';
import type { Dir } from '../core/direction.ts';
import { TILE_ROCK } from '../core/tiles.ts';
import { MAX_COLS, MAX_ROWS, cellIdx, cellX, cellY } from '../core/grid.ts';
import { autoDir, blastRock, buyPlot, canBlast, canBridge, canPlace, makeCross, place, placeBridge, removeAt, rotateAt } from '../core/build.ts';
import { straightBelt } from '../core/layout.ts';
import { blastCost } from '../core/prices.ts';
import { tilesOf } from '../core/planet-map.ts';
import { hasPower } from '../core/effects.ts';
import type { Game, Machine } from '../core/game.ts';
import { fmt as fmtShort } from '../core/format.ts';
import { mix } from './draw.ts';
import { burst, popup, ring } from './fx.ts';
import type { PlanetHooks, PlanetView } from './planet.ts';

export interface Drag {
	path: number[];
	moved: boolean;
	mode: 'belt' | 'bridge' | 'machine' | 'remove' | 'none' | 'pan';
	pointer: number;
	startX: number;
	startY: number;
	lastX: number;
	lastY: number;
	/** pan only: plot for sale under the press, bought if it was a tap */
	plot?: number | null;
}

/** Screen pixels a press may move and still count as a tap. */
const TAP_SLOP = 8;

const idx = cellIdx;
const cx = cellX;
const cy = cellY;

export class PlanetBuilder {
	/** The press or drag in progress, if any. */
	drag: Drag | null = null;
	private view: PlanetView;
	private hooks: PlanetHooks;

	constructor(view: PlanetView, hooks: PlanetHooks) {
		this.view = view;
		this.hooks = hooks;
	}

	/** Start a camera drag (mouse right / middle button). */
	startPan(sx: number, sy: number, id: number) {
		this.drag = { path: [], moved: true, mode: 'pan', pointer: id, startX: sx, startY: sy, lastX: sx, lastY: sy, plot: null };
	}

	tryBuyPlot(g: Game, plot: number): boolean {
		const r = buyPlot(g, this.view.pi, plot);
		if (!r.ok) return false;
		const name = PLANETS[this.view.pi].name;
		this.hooks.toast(r.ore > 0 ? `New land on ${name} · ${r.ore} ore tile${r.ore > 1 ? 's' : ''}` : `New land on ${name} — room to build`);
		this.hooks.sound('place');
		this.view.invalidateBoard();
		this.hooks.changed();
		this.hooks.expanded?.();
		return true;
	}

	pointerDown(g: Game, sx: number, sy: number, id: number) {
		const c = this.view.cellAt(sx, sy, g.planets[this.view.pi]);
		if (c === null) {
			// Off your land: drag to pan, tap a plot for sale to buy it.
			this.drag = { path: [], moved: false, mode: 'pan', pointer: id, startX: sx, startY: sy, lastX: sx, lastY: sy, plot: this.view.plotAt(sx, sy, g) };
			return;
		}
		const mode = this.view.tool === 'belt' ? 'belt' : this.view.tool === 'bridge' ? 'bridge' : this.view.tool === 'remove' ? 'remove' : this.view.tool ? 'machine' : 'none';
		this.drag = { path: [c], moved: false, mode, pointer: id, startX: sx, startY: sy, lastX: sx, lastY: sy };
		if (mode === 'remove') this.removeCell(g, c, true);
	}

	pointerMove(g: Game, sx: number, sy: number, id: number) {
		const c = this.view.cellAt(sx, sy, g.planets[this.view.pi]);
		this.view.hover = c;
		const d = this.drag;
		if (!d || d.pointer !== id) return;
		if (d.mode === 'pan') {
			if (!d.moved && Math.hypot(sx - d.startX, sy - d.startY) > TAP_SLOP) d.moved = true;
			if (d.moved) this.view.panBy(sx - d.lastX, sy - d.lastY);
			d.lastX = sx;
			d.lastY = sy;
			return;
		}
		if (!d.moved && Math.hypot(sx - d.startX, sy - d.startY) > this.view.ts * 0.45) {
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
		if (d.mode === 'pan') {
			if (d.moved) return;
			if (d.plot != null) {
				if (!this.tryBuyPlot(g, d.plot)) this.hooks.sound('error');
			} else this.hooks.select(null);
			return;
		}
		const c = this.view.cellAt(sx, sy, g.planets[this.view.pi]);
		if (d.mode === 'belt') {
			if (!d.moved && d.path.length === 1) this.tapBelt(g, d.path[0]);
			else this.commitBelts(g, d.path);
		} else if (d.mode === 'bridge') {
			if (d.path.length === 2) this.placeBridge(g, d.path[0], d.path[1]);
			else {
				this.hooks.toast(`Drag from where items go in to where they come out. Up to ${BRIDGE_SPAN - 1} tiles between.`);
				this.hooks.sound('error');
			}
		} else if (d.mode === 'machine' && this.view.tool && this.view.tool !== 'remove') {
			const target = d.moved ? (c ?? d.path[0]) : d.path[0];
			this.placeMachine(g, target, this.view.tool);
		} else if (d.mode === 'none') {
			const m = g.planets[this.view.pi].cells[d.path[0]];
			this.hooks.select(m ? d.path[0] : null);
			if (!m && !d.moved && tilesOf(this.view.pi, g.blasted[this.view.pi])[d.path[0]] === TILE_ROCK) {
				this.hooks.toast(hasPower(g, 'blastRocks') ? `Rock. Tap it with Remove to blast it for ${fmtShort(blastCost(g, this.view.pi))}.` : 'Rock. Research Blast Charges to clear rocks.');
			}
		}
	}

	pointerCancel() {
		this.drag = null;
	}

	private tapBelt(g: Game, c: number) {
		const p = g.planets[this.view.pi];
		const m = p.cells[c];
		if (m && m.t === 'belt') {
			rotateAt(g, this.view.pi, cx(c), cy(c));
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
	pathDirs(g: Game, path: number[]): Dir[] {
		const dirs: Dir[] = [];
		for (let i = 0; i < path.length; i++) {
			if (i + 1 < path.length) dirs.push(dirTo(path[i], path[i + 1]));
			else if (i > 0) dirs.push(dirTo(path[i - 1], path[i]));
			else dirs.push(autoDir(g, this.view.pi, cx(path[i]), cy(path[i]), 0));
		}
		// The end turns toward a pad or machine next to it, if straight ahead is nothing useful.
		const end = path.length - 1;
		const e = path[end];
		const p = g.planets[this.view.pi];
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
	crossings(g: Game, path: number[]): Set<number> {
		const out = new Set<number>();
		if (!hasPower(g, 'beltCrossings')) return out;
		const cells = g.planets[this.view.pi].cells;
		for (let i = 1; i < path.length - 1; i++) {
			const m = cells[path[i]];
			if (!m || m.t !== 'belt') continue;
			const din = dirTo(path[i - 1], path[i]);
			if (din !== dirTo(path[i], path[i + 1]) || din % 2 === m.d % 2) continue;
			// The line being dragged will feed it from the side; that is the point.
			if (straightBelt(g, this.view.pi, path[i], [path[i - 1], path[i + 1]])) out.add(i);
		}
		return out;
	}

	private commitBelts(g: Game, path: number[]) {
		const p = g.planets[this.view.pi];
		const tiles = tilesOf(this.view.pi, g.blasted[this.view.pi]);
		const dirs = this.pathDirs(g, path);
		const cross = this.crossings(g, path);
		let placed = 0;
		let short = false;
		for (let i = 0; i < path.length; i++) {
			const c = path[i];
			const m = p.cells[c];
			if (tiles[c] === TILE_ROCK) continue;
			if (cross.has(i)) {
				if (makeCross(g, this.view.pi, c, [path[i - 1], path[i + 1]])) {
					placed++;
					const s = this.view.cellCenter(c);
					burst(s.x, s.y, '#9fb4ff', 6, 70, { size: 2, life: 0.35 });
				} else short = true;
				continue;
			}
			if (m) {
				// A drag that ends on a belt joins it, so that belt keeps its way.
				const joins = i === path.length - 1 && path.length > 1;
				if (m.t === 'belt' && !joins) rotateAt(g, this.view.pi, cx(c), cy(c), dirs[i]);
				else if (i === 0 && path.length > 1 && m.t !== 'pad' && m.t !== 'pylon') rotateAt(g, this.view.pi, cx(c), cy(c), dirs[0]);
				continue;
			}
			if (place(g, this.view.pi, cx(c), cy(c), 'belt', dirs[i])) {
				placed++;
				const s = this.view.cellCenter(c);
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
		const check = canBridge(g, this.view.pi, a, b);
		if (!check.ok) {
			this.hooks.toast(check.why);
			this.hooks.sound('error');
			return;
		}
		placeBridge(g, this.view.pi, a, b);
		const col = MACHINES.bridge.color;
		for (const c of [a, b]) {
			const s = this.view.cellCenter(c);
			burst(s.x, s.y, col, 10, 140, { size: 2.5, life: 0.45 });
		}
		const s = this.view.cellCenter(b);
		popup(s.x, s.y - this.view.ts * 0.4, '-' + fmtShort(check.cost), '#ffb3b3', 13);
		this.hooks.sound('place');
		this.hooks.changed();
	}

	placeMachine(g: Game, c: number, t: MachineType) {
		const x = cx(c);
		const y = cy(c);
		const check = canPlace(g, this.view.pi, x, y, t);
		if (!check.ok) {
			const m = g.planets[this.view.pi].cells[c];
			if (m && check.why === 'Space is taken') {
				this.hooks.select(c);
				return;
			}
			this.hooks.toast(check.why);
			this.hooks.sound('error');
			return;
		}
		const d = autoDir(g, this.view.pi, x, y, 0);
		place(g, this.view.pi, x, y, t, d);
		const s = this.view.cellCenter(c);
		burst(s.x, s.y, MACHINES[t].color, 14, 160, { size: 3, life: 0.5 });
		ring(s.x, s.y, MACHINES[t].color, this.view.ts * 0.3, 90, 0.4);
		popup(s.x, s.y - this.view.ts * 0.4, '-' + fmtShort(check.cost), '#ffb3b3', 13);
		this.hooks.sound('place');
		this.hooks.changed();
	}

	private removeCell(g: Game, c: number, tap = false) {
		const m = g.planets[this.view.pi].cells[c];
		if (!m && tap) this.blastCell(g, c);
		if (!m || m.t === 'pad') return;
		const refund = removeAt(g, this.view.pi, cx(c), cy(c));
		const s = this.view.cellCenter(c);
		burst(s.x, s.y, '#ff6b8a', 8, 120, { size: 2.5, life: 0.4 });
		if (refund > 0) popup(s.x, s.y, '+' + fmtShort(refund), '#9dffb0', 12);
		if (this.view.selected === c) this.hooks.select(null);
		this.hooks.sound('remove');
		this.hooks.changed();
	}

	private blastCell(g: Game, c: number) {
		if (tilesOf(this.view.pi, g.blasted[this.view.pi])[c] !== TILE_ROCK) return;
		const check = canBlast(g, this.view.pi, c);
		if (!check.ok) {
			this.hooks.toast(check.why);
			this.hooks.sound('error');
			return;
		}
		blastRock(g, this.view.pi, c);
		const def = PLANETS[this.view.pi];
		const s = this.view.cellCenter(c);
		burst(s.x, s.y, '#ffd9a8', 16, 260, { size: 2.5, life: 0.45 });
		burst(s.x, s.y, mix(def.dark, '#8a8fa6', 0.5), 18, 170, { size: 4, life: 0.8, grav: 260, spark: false });
		ring(s.x, s.y, '#ffb347', this.view.ts * 0.25, 160, 0.5);
		popup(s.x, s.y - this.view.ts * 0.4, '-' + fmtShort(check.cost), '#ffb3b3', 13);
		this.hooks.sound('blast');
		this.hooks.changed();
	}
}

/** The far end of a bridge dragged from a toward c: straight, and at most BRIDGE_SPAN away. */
function straightEnd(a: number, c: number): number {
	const dx = cx(c) - cx(a);
	const dy = cy(c) - cy(a);
	if (Math.abs(dx) >= Math.abs(dy)) return idx(cx(a) + Math.sign(dx) * Math.min(Math.abs(dx), BRIDGE_SPAN), cy(a));
	return idx(cx(a), cy(a) + Math.sign(dy) * Math.min(Math.abs(dy), BRIDGE_SPAN));
}

export function dirTo(a: number, b: number): Dir {
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
	if (x < 0 || y < 0 || x >= MAX_COLS || y >= MAX_ROWS) return null;
	return idx(x, y);
}
