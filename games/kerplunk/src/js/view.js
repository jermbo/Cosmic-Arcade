// Layout and drawing of the board, the tray, the dragged piece and effects.

import { buildSprites, roundRect, PALETTE, GOLD, LEAD } from './sprites.js';
import { Fx } from './fx.js';
import { REMIX_STYLES } from './remix-styles.js';

const GRAVITY = 70; // cells per second squared, pulling blocks up to the ceiling
const TRAY_SCALE = 0.62;
const MAX_CELL = 66;
const CLEAR_TIME = 0.2;
const BAR_SPACE = 0.95; // height of the power-up bar, in cells

export const POWER_NAMES = { prism: 'Prism', blast: 'Blast', remix: 'Remix' };

export class View {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.fx = new Fx();
		this.game = null;
		this.blockVisuals = new Map();
		this.dying = [];
		this.holdFalls = false;
		this.drag = null;
		this.returning = null;
		this.keyCursor = null;
		this.hint = false;
		this.power = null; // the power-up being used: { kind, stage, color }
		this.aim = null; // where a blast would land: { x, y }
		this.chipPop = [];
		this.lastBag = 0;
		this.time = 0;
		this.onRemix = null; // (event, value) for sound and haptics
		this.remixStyle = 'scatter'; // a key of REMIX_STYLES
		this.remix = null;
		this.previewCache = { key: '', cells: null, ghost: new Set() };
		this.appear = [];
		this.stars = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.2, p: Math.random() * 6 }));
		this.floaters = Array.from({ length: 16 }, () => this.newFloater(true));
		this.sprites = null;
		this.cell = 40;
	}

	newFloater(anywhere) {
		return {
			x: Math.random(),
			y: anywhere ? Math.random() * 1.2 - 0.1 : 1.1,
			speed: 0.012 + Math.random() * 0.025,
			color: Math.floor(Math.random() * 5),
			kind: Math.random() < 0.08 ? 'flare' : Math.random() < 0.04 ? 'nova' : 'plain',
			rot: Math.random() * 6,
			vr: (Math.random() - 0.5) * 0.6,
			size: 0.6 + Math.random() * 0.7,
		};
	}

	resize() {
		const rect = this.canvas.getBoundingClientRect();
		this.w = Math.max(1, rect.width);
		this.h = Math.max(1, rect.height);
		this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
		this.canvas.width = Math.round(this.w * this.dpr);
		this.canvas.height = Math.round(this.h * this.dpr);
		this.layout();
	}

	layout() {
		const cols = this.game ? this.game.cols : 7;
		const rows = this.game ? this.game.rows : 9;
		const slots = this.game ? this.game.pieces.length : 2;
		const pad = 14;
		const byW = (this.w - pad * 2) / (cols + 0.4);
		const byH = (this.h - pad * 2) / (rows + 0.4 + 0.45 + TRAY_SCALE * 3 + 0.6 + BAR_SPACE);
		const cell = Math.max(12, Math.floor(Math.min(byW, byH, MAX_CELL)));
		this.cell = cell;
		this.boardW = cell * cols;
		this.boardH = cell * rows;
		const trayH = cell * (TRAY_SCALE * 3 + 0.6);
		const gap = cell * 0.45;
		const total = this.boardH + cell * 0.4 + gap + trayH + cell * BAR_SPACE;
		const spare = Math.max(0, this.h - pad * 2 - total);
		this.boardX = Math.round((this.w - this.boardW) / 2);
		this.boardY = Math.round(pad + cell * 0.2 + spare * 0.35);
		// The power-up bar sits between the well and the tray.
		this.bar = { x: this.boardX, y: this.boardY + this.boardH + cell * 0.35, w: this.boardW, h: cell * 0.8 };
		const trayY = this.boardY + this.boardH + cell * 0.2 + gap + cell * BAR_SPACE;
		const trayW = Math.min(this.w - pad * 2, Math.max(this.boardW + cell, cell * 3.6 * slots));
		const trayX = (this.w - trayW) / 2;
		const slotW = trayW / slots;
		// Use spare height for bigger tray pieces: they are easier to grab.
		const roomH = this.h - pad - trayY;
		this.trayCell = Math.max(cell * TRAY_SCALE, Math.min(cell * 0.85, slotW / 3.7, (roomH - cell * 0.6) / 3));
		const trayRealH = Math.min(roomH, this.trayCell * 3 + cell * 0.6);
		this.slots = [];
		for (let i = 0; i < slots; i++) this.slots.push({ x: trayX + i * slotW, y: trayY, w: slotW, h: Math.max(trayH, trayRealH) });

		const px = Math.round(cell * this.dpr);
		if (!this.sprites || this.sprites.px !== px) this.sprites = buildSprites(px);
		this.buildBoardLayer(cols, rows);
	}

	/** Draws the frame and the empty slots once, since they do not change. */
	buildBoardLayer(cols, rows) {
		const { cell, dpr } = this;
		const m = cell * 0.6;
		const c = document.createElement('canvas');
		c.width = Math.round((this.boardW + m * 2) * dpr);
		c.height = Math.round((this.boardH + m * 2) * dpr);
		const ctx = c.getContext('2d');
		ctx.scale(dpr, dpr);
		const fp = cell * 0.2;
		ctx.save();
		ctx.shadowColor = 'rgba(242,200,121,0.35)';
		ctx.shadowBlur = cell * 0.5;
		roundRect(ctx, m - fp, m - fp, this.boardW + fp * 2, this.boardH + fp * 2, cell * 0.32);
		ctx.fillStyle = 'rgba(9,7,22,0.82)';
		ctx.fill();
		ctx.restore();
		const well = ctx.createLinearGradient(0, m, 0, m + this.boardH);
		well.addColorStop(0, 'rgba(70,50,140,0.18)');
		well.addColorStop(1, 'rgba(20,14,50,0.0)');
		ctx.fillStyle = well;
		roundRect(ctx, m - fp, m - fp, this.boardW + fp * 2, this.boardH + fp * 2, cell * 0.32);
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.strokeStyle = GOLD;
		ctx.stroke();
		ctx.lineWidth = 1;
		ctx.strokeStyle = 'rgba(242,200,121,0.3)';
		roundRect(ctx, m - fp + 4, m - fp + 4, this.boardW + fp * 2 - 8, this.boardH + fp * 2 - 8, cell * 0.26);
		ctx.stroke();
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) ctx.drawImage(this.sprites.slot, m + x * cell, m + y * cell, cell, cell);
		}
		this.boardLayer = { canvas: c, m };
	}

	setGame(game) {
		this.game = game;
		this.blockVisuals.clear();
		this.dying = [];
		this.remix = null;
		this.drag = null;
		this.returning = null;
		this.keyCursor = null;
		this.appear = game.pieces.map(() => 0);
		this.fx.clear();
		this.power = null;
		this.aim = null;
		this.chipPop = [];
		this.lastBag = game.bag.length;
		this.layout();
		game.grid.forEach((b, i) => {
			if (!b) return;
			const x = game.columnOf(i);
			const y = game.rowOf(i);
			this.blockVisuals.set(b.id, this.newVis(x, y + game.rows + 1, 0.05 * x + 0.04 * y));
		});
	}

	newVis(x, y, delay = 0) {
		return { x, y, vy: 0, sx: 1, sy: 1, delay, forge: 0 };
	}

	/** Starts the rise of newly placed blocks from where the piece was let go. */
	dropIn(placed, left, top) {
		for (const p of placed) {
			const y = Math.max(top + p.dy, p.y);
			this.blockVisuals.set(p.block.id, { ...this.newVis(left + p.dx, y), vy: 4 });
		}
	}

	pieceSpawned(slot) {
		this.appear[slot] = 0;
		this.previewCache.key = '';
	}

	cellCenter(x, y) {
		return { x: this.boardX + (x + 0.5) * this.cell, y: this.boardY + (y + 0.5) * this.cell };
	}

	/** The tray slot under a point, or null when there is none. */
	hitSlot(px, py) {
		if (!this.slots) return null;
		const index = this.slots.findIndex((s) => px >= s.x && px < s.x + s.w && py >= s.y - this.cell * 0.3 && py < s.y + s.h + this.cell * 0.4);
		return index < 0 ? null : index;
	}

	slotPiecePos(slot, piece) {
		const s = this.slots[slot];
		const c = this.trayCell;
		return { x: s.x + s.w / 2 - (piece.w * c) / 2, y: s.y + s.h / 2 - (piece.h * c) / 2, c };
	}

	/** Where a dragged piece is, and which column it would drop into. */
	dragGeometry(piece, point, touch) {
		const { cell, game } = this;
		const { x: px, y: py } = point;
		const pw = piece.w * cell;
		const ph = piece.h * cell;
		const left = px - pw / 2;
		const top = touch ? py - cell * 1.1 - ph : py - ph / 2;
		const col = Math.max(0, Math.min(game.cols - piece.w, Math.round((left - this.boardX) / cell)));
		const over = px > this.boardX - cell * 1.5 && px < this.boardX + this.boardW + cell * 1.5 && top + ph < this.boardY + this.boardH + cell * 0.6;
		return { left, top, col, over, valid: over && game.fits(piece, col) };
	}

	get settled() {
		if (this.dying.length) return false;
		const g = this.game;
		if (!g) return true;
		for (let i = 0; i < g.grid.length; i++) {
			const b = g.grid[i];
			if (!b) continue;
			const v = this.blockVisuals.get(b.id);
			if (!v) continue;
			if (v.delay > 0 || v.y !== g.rowOf(i) || Math.abs(v.x - g.columnOf(i)) > 0.01) return false;
		}
		return true;
	}

	/** Marks cleared blocks to flash and break apart. */
	killBlocks(cleared) {
		for (const c of cleared) {
			const v = this.blockVisuals.get(c.block.id);
			this.dying.push({ block: c.block, x: c.x, y: v ? v.y : c.y, t: 0, delay: c.delay || 0 });
			this.blockVisuals.delete(c.block.id);
		}
	}

	/**
	 * The Remix show. The engine has already moved the blocks. Here they rattle and glow, then
	 * every block flies on its own curve from its old cell to its new one.
	 * `view.remix` is null again when the show is over.
	 */
	startRemix(moves, styleName = this.remixStyle) {
		const g = this.game;
		const style = REMIX_STYLES[styleName] || REMIX_STYLES.scatter;
		const mid = { x: (g.cols - 1) / 2, y: (g.rows - 1) / 2 };
		const items = [];
		const sorted = moves.slice().sort((a, b) => a.to - b.to);
		for (const m of moves) {
			let v = this.blockVisuals.get(m.block.id);
			if (!v) {
				v = this.newVis(g.columnOf(m.from), g.rowOf(m.from));
				this.blockVisuals.set(m.block.id, v);
			}
			const from = { x: g.columnOf(m.from), y: g.rowOf(m.from) };
			const to = { x: g.columnOf(m.to), y: g.rowOf(m.to) };
			v.x = from.x;
			v.y = from.y;
			v.vy = 0;
			v.delay = 0;
			v.fly = true;
			const plan = style.plan({ from, to, mid, cols: g.cols, rows: g.rows, order: sorted.indexOf(m) });
			items.push({ block: m.block, from, to, ...plan, done: false });
		}
		const events = (style.events || []).map((e) => ({ ...e, fired: false }));
		this.remix = { phase: 'charge', t: 0, items, lands: 0, tickGap: 0, charge: style.charge, rattle: style.rattle, swell: style.swell ?? style.rattle, events };
		this.onRemix?.('charge', style.charge, style.sound);
		if (!style.charge) this.launchRemix();
	}

	updateRemix(dt) {
		const r = this.remix;
		const g = this.game;
		if (!r || !g) return;
		r.t += dt;
		if (r.phase === 'charge') this.updateRemixCharge(r);
		else this.updateRemixFlight(r, dt, g);
	}

	/** The blocks rattle and swell more and more until the launch. */
	updateRemixCharge(r) {
		const k = Math.min(1, r.t / r.charge);
		for (const item of r.items) {
			const v = this.blockVisuals.get(item.block.id);
			if (!v) continue;
			v.jx = (Math.random() - 0.5) * k * 0.16 * r.rattle;
			v.jy = (Math.random() - 0.5) * k * 0.16 * r.rattle;
			v.sx = v.sy = 1 + k * 0.14 * r.swell;
		}
		if (r.t >= r.charge) this.launchRemix();
	}

	/** Flight: every block follows the path its style gave it. */
	updateRemixFlight(r, dt, g) {
		r.tickGap -= dt;
		for (const ev of r.events) {
			if (!ev.fired && r.t >= ev.at) {
				ev.fired = true;
				this.onRemix?.(ev.name, ev.value);
			}
		}
		for (const item of r.items) {
			if (item.done) continue;
			const v = this.blockVisuals.get(item.block.id);
			if (!v) {
				item.done = true;
				continue;
			}
			const u = Math.min(1, Math.max(0, (r.t - item.delay) / item.dur));
			if (u <= 0) {
				v.jx = (Math.random() - 0.5) * 0.1 * r.rattle;
				v.jy = (Math.random() - 0.5) * 0.1 * r.rattle;
				continue;
			}
			const p = item.at(u);
			v.jx = v.jy = 0;
			// Paths stay inside the well.
			v.x = Math.min(g.cols - 1, Math.max(0, p.x));
			v.y = Math.min(g.rows - 1, Math.max(0, p.y));
			v.rot = p.rot;
			v.sx = v.sy = p.s;
			if (u >= 1) this.landRemixBlock(item, v, r);
		}
		if (r.items.every((item) => item.done)) this.remix = null;
	}

	/** A block reaches its new cell: it squashes, and the landing ticks (not more than every 0.05 seconds). */
	landRemixBlock(item, v, r) {
		item.done = true;
		v.fly = false;
		v.x = item.to.x;
		v.y = item.to.y;
		v.rot = 0;
		v.sx = 1.25;
		v.sy = 0.78;
		if (r.tickGap <= 0) {
			r.tickGap = 0.05;
			this.onRemix?.('tick', r.lands++);
		}
	}

	launchRemix() {
		const r = this.remix;
		r.phase = 'fly';
		r.t = 0;
		this.onRemix?.('boom');
	}

	update(dt) {
		this.time += dt;
		this.fx.update(dt);
		this.updateFloaters(dt);
		this.appear = this.appear.map((a) => Math.min(1, a + dt * 4));
		if (this.returning) {
			this.returning.t += dt / 0.18;
			if (this.returning.t >= 1) this.returning = null;
		}

		const g = this.game;
		if (!g) return;
		this.updateBlocks(dt, g);
		this.updateRemix(dt);
		this.updateChips(dt, g);
		if (this.landCount && this.onLand) this.onLand(this.landCount);
		this.updateDying(dt);
	}

	updateFloaters(dt) {
		for (const f of this.floaters) {
			f.y -= f.speed * dt;
			f.rot += f.vr * dt;
			if (f.y < -0.15) Object.assign(f, this.newFloater(false));
		}
	}

	/** Moves every block toward its cell: it rises to the ceiling, squashes when it lands, and settles. */
	updateBlocks(dt, g) {
		const alive = new Set();
		for (let i = 0; i < g.grid.length; i++) {
			const b = g.grid[i];
			if (!b) continue;
			alive.add(b.id);
			const gx = g.columnOf(i);
			const gy = g.rowOf(i);
			let v = this.blockVisuals.get(b.id);
			if (!v) {
				v = this.newVis(gx, gy);
				this.blockVisuals.set(b.id, v);
			}
			if (v.fly) continue; // the Remix show moves this block
			if (v.delay > 0) {
				v.delay -= dt;
				continue;
			}
			v.x += (gx - v.x) * Math.min(1, dt * 20);
			if (Math.abs(gx - v.x) < 0.01) v.x = gx;
			if (!this.holdFalls) this.riseBlock(v, gy, dt);
			v.sx += (1 - v.sx) * Math.min(1, dt * 16);
			v.sy += (1 - v.sy) * Math.min(1, dt * 16);
			v.forge = Math.max(0, v.forge - dt * 1.8);
		}
		for (const id of this.blockVisuals.keys()) if (!alive.has(id)) this.blockVisuals.delete(id);
	}

	/** One block rises toward its row, and squashes when it lands hard. */
	riseBlock(v, row, dt) {
		if (v.y > row) {
			v.vy += GRAVITY * dt;
			v.y -= v.vy * dt;
			if (v.y <= row) {
				v.y = row;
				if (v.vy > 4) {
					v.sy = 0.78;
					v.sx = 1.14;
				}
				v.vy = 0;
			}
		} else if (v.y < row) {
			v.y = row;
		}
	}

	updateChips(dt, g) {
		if (g.bag.length > this.lastBag) this.chipPop[g.bag.length - 1] = 0;
		this.lastBag = g.bag.length;
		this.chipPop = this.chipPop.map((t) => Math.min(1, (t ?? 1) + dt * 3));
	}

	updateDying(dt) {
		for (const d of this.dying) {
			if (d.delay > 0) {
				d.delay -= dt;
				continue;
			}
			d.t += dt;
			if (d.t >= CLEAR_TIME && !d.done) {
				d.done = true;
				const c = this.cellCenter(d.x, d.y);
				this.fx.shatter({ x: c.x, y: c.y, size: this.cell, colorIndex: d.block.color, power: d.block.kind === 'plain' ? 1 : 1.8 });
			}
		}
		this.dying = this.dying.filter((d) => !d.done);
	}

	// ---- drawing ----

	draw() {
		const { ctx, dpr } = this;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, this.w, this.h);
		this.drawStars();
		if (!this.game) {
			this.drawFloaters();
			ctx.save();
			this.fx.draw(ctx, this.sprites);
			ctx.restore();
			return;
		}
		ctx.save();
		ctx.translate(this.fx.shakeX, this.fx.shakeY);
		this.drawBoard();
		this.drawGhost();
		this.drawBlocks();
		this.drawDying();
		this.fx.draw(ctx, this.sprites);
		ctx.restore();
		this.drawAim();
		this.drawBar();
		this.drawTray();
		this.drawDragged();
		this.drawHint();
		this.fx.drawPops(ctx, this.cell);
		if (this.fx.flash > 0) {
			ctx.globalAlpha = Math.min(0.85, this.fx.flash);
			ctx.fillStyle = this.fx.flashColor;
			ctx.fillRect(0, 0, this.w, this.h);
			ctx.globalAlpha = 1;
		}
	}

	drawStars() {
		const { ctx } = this;
		ctx.fillStyle = '#fff6e0';
		for (const s of this.stars) {
			ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(this.time * 1.3 + s.p));
			ctx.beginPath();
			ctx.arc(s.x * this.w, s.y * this.h, s.r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	drawFloaters() {
		const { ctx } = this;
		const unit = Math.min(this.w, this.h) * 0.09;
		for (const f of this.floaters) {
			const img = this.sprites[f.kind][f.color];
			const s = unit * f.size;
			ctx.save();
			ctx.globalAlpha = 0.28 + f.size * 0.2;
			ctx.translate(f.x * this.w, f.y * this.h);
			ctx.rotate(f.rot);
			ctx.drawImage(img, -s / 2, -s / 2, s, s);
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	}

	drawBoard() {
		const { ctx, cell, game } = this;
		const { canvas, m } = this.boardLayer;
		ctx.drawImage(canvas, this.boardX - m, this.boardY - m, canvas.width / this.dpr, canvas.height / this.dpr);
		// Columns close to full glow red at the tray end as a warning.
		const floorY = this.boardY + this.boardH;
		for (let x = 0; x < game.cols; x++) {
			const danger = game.dangerOf(x);
			if (danger === 0) continue;
			const grad = ctx.createLinearGradient(0, floorY, 0, floorY - cell * 2.5);
			const a = 0.12 + danger * 0.08 + 0.05 * Math.sin(this.time * 6);
			grad.addColorStop(0, `rgba(255,80,100,${a})`);
			grad.addColorStop(1, 'rgba(255,80,100,0)');
			ctx.fillStyle = grad;
			ctx.fillRect(this.boardX + x * cell, floorY - cell * 2.5, cell, cell * 2.5);
		}
	}

	blockImage(block, color = block.color) {
		return this.sprites[block.kind][color];
	}

	drawBlock(block, x, y, sx = 1, sy = 1, alpha = 1, color = block.color, rot = 0) {
		const { ctx, cell } = this;
		const cx = this.boardX + (x + 0.5) * cell;
		const top = this.boardY + y * cell;
		const w = cell * sx;
		const h = cell * sy;
		ctx.globalAlpha = alpha;
		if (rot) {
			ctx.save();
			ctx.translate(cx, top + cell / 2);
			ctx.rotate(rot);
			ctx.drawImage(this.blockImage(block, color), -w / 2, -h / 2, w, h);
			ctx.restore();
		} else {
			ctx.drawImage(this.blockImage(block, color), cx - w / 2, top, w, h);
		}
		ctx.globalAlpha = 1;
	}

	drawBlocks() {
		const { game } = this;
		const preview = this.previewCells();
		const flying = [];
		for (let i = 0; i < game.grid.length; i++) {
			const b = game.grid[i];
			if (!b) continue;
			const v = this.blockVisuals.get(b.id);
			if (!v || v.delay > 0) continue;
			if (v.fly) {
				flying.push([b, v]);
				continue;
			}
			this.drawOneBlock(b, v);
			if (preview && preview.has(i)) this.drawMatchMark(v.x, v.y);
		}
		// Blocks in the air draw on top of the ones that landed.
		for (const [b, v] of flying) this.drawOneBlock(b, v);
	}

	drawOneBlock(b, v) {
		const { ctx, cell } = this;
		this.drawBlock(b, v.x + (v.jx || 0), v.y + (v.jy || 0), v.sx, v.sy, 1, b.color, v.rot || 0);
		if (v.forge > 0) {
			const c = this.cellCenter(v.x, v.y);
			const s = cell * (1 + (1 - v.forge) * 1.6);
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = v.forge;
			ctx.drawImage(this.sprites.glowWhite, c.x - s / 2, c.y - s / 2, s, s);
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
		}
	}

	drawMatchMark(x, y) {
		const { ctx, cell } = this;
		const pulse = 0.5 + 0.5 * Math.sin(this.time * 9);
		ctx.strokeStyle = `rgba(255,240,200,${0.55 + pulse * 0.45})`;
		ctx.lineWidth = Math.max(2, cell * 0.06);
		roundRect(ctx, this.boardX + x * cell + 2, this.boardY + y * cell + 2, cell - 4, cell - 4, cell * 0.2);
		ctx.stroke();
	}

	drawDying() {
		const { ctx, cell } = this;
		for (const d of this.dying) {
			const k = Math.min(1, d.t / CLEAR_TIME);
			const s = 1 + k * 0.18;
			const c = this.cellCenter(d.x, d.y);
			ctx.drawImage(this.blockImage(d.block), c.x - (cell * s) / 2, c.y - (cell * s) / 2, cell * s, cell * s);
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = k;
			ctx.drawImage(this.sprites.glowWhite, c.x - cell * s * 0.8, c.y - cell * s * 0.8, cell * s * 1.6, cell * s * 1.6);
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
		}
	}

	/** The active piece and column: from a drag, or from the keyboard cursor. */
	activeTarget() {
		if (this.drag && this.drag.moved && this.drag.geometry && this.drag.geometry.over) {
			return { piece: this.drag.piece, col: this.drag.geometry.col, valid: this.drag.geometry.valid };
		}
		if (this.keyCursor && !this.drag && this.game.pieces[this.keyCursor.slot]) {
			const piece = this.game.pieces[this.keyCursor.slot];
			const col = Math.min(this.keyCursor.col, this.game.cols - piece.w);
			return { piece, col, valid: this.game.fits(piece, col) };
		}
		return null;
	}

	/** Cells that would match right away if the active piece dropped now. */
	previewCells() {
		const t = this.activeTarget();
		if (!t || !t.valid) return null;
		const key = `${t.piece.id}:${t.piece.cells.map((c) => c.dx + '' + c.dy).join('')}:${t.col}:${this.game.turn}`;
		if (this.previewCache.key === key) return this.previewCache.cells;
		const g = this.game.clone();
		const slot = 0;
		g.pieces[slot] = t.piece;
		const placed = g.place(slot, t.col, t.piece);
		const cells = new Set();
		for (const group of g.findGroups()) for (const c of group.cells) cells.add(c);
		// Ghost cells show where the rigid piece rests, so note which of them end up in a match.
		const ghost = new Set();
		for (const p of placed) if (cells.has(g.grid.indexOf(p.block))) ghost.add(`${p.x},${p.y}`);
		this.previewCache = { key, cells, ghost };
		return cells;
	}

	drawGhost() {
		const t = this.activeTarget();
		if (!t) return;
		const { ctx, cell, game } = this;
		// A soft beam shows the columns the piece covers.
		ctx.fillStyle = t.valid ? 'rgba(242,200,121,0.07)' : 'rgba(255,80,100,0.1)';
		ctx.fillRect(this.boardX + t.col * cell, this.boardY, t.piece.w * cell, this.boardH);
		if (!t.valid) {
			ctx.strokeStyle = 'rgba(255,90,110,0.8)';
			ctx.lineWidth = 3;
			const x = this.boardX + t.col * cell;
			ctx.beginPath();
			const floorY = this.boardY + this.boardH;
			ctx.moveTo(x + cell * 0.3, floorY - cell * 0.3);
			ctx.lineTo(x + t.piece.w * cell - cell * 0.3, floorY - cell * 0.7);
			ctx.moveTo(x + t.piece.w * cell - cell * 0.3, floorY - cell * 0.3);
			ctx.lineTo(x + cell * 0.3, floorY - cell * 0.7);
			ctx.stroke();
			return;
		}
		const preview = this.previewCells();
		for (const l of game.landing(t.piece, t.col)) {
			const x = this.boardX + l.x * cell;
			const y = this.boardY + l.y * cell;
			ctx.globalAlpha = 0.4;
			ctx.drawImage(this.sprites.plain[l.cell.color], x, y, cell, cell);
			ctx.globalAlpha = 1;
			ctx.setLineDash([cell * 0.14, cell * 0.1]);
			ctx.lineDashOffset = -this.time * cell * 0.6;
			ctx.strokeStyle = 'rgba(255,246,220,0.85)';
			ctx.lineWidth = 2;
			roundRect(ctx, x + 3, y + 3, cell - 6, cell - 6, cell * 0.18);
			ctx.stroke();
			ctx.setLineDash([]);
			if (preview && this.previewCache.ghost.has(`${l.x},${l.y}`)) this.drawMatchMark(l.x, l.y);
		}
	}

	drawPieceAt(piece, x, y, c, alpha = 1) {
		const { ctx } = this;
		ctx.globalAlpha = alpha;
		for (const cell of piece.cells) ctx.drawImage(this.sprites.plain[cell.color], x + cell.dx * c, y + cell.dy * c, c, c);
		ctx.globalAlpha = 1;
	}

	// ---- power-ups ----

	/** Where the bar's buttons are. What they are depends on the power-up in use. */
	barRects() {
		const { bar, cell, game } = this;
		const gap = cell * 0.2;
		const rects = [];
		const power = this.power;
		const cancel = { type: 'cancel', x: bar.x + bar.w - cell * 0.9, y: bar.y, w: cell * 0.9, h: bar.h };
		if (!power) {
			const n = game.bagSize;
			const w = Math.min(cell * 2.2, (bar.w - gap * (n - 1)) / n);
			const x0 = bar.x + (bar.w - (w * n + gap * (n - 1))) / 2;
			for (let i = 0; i < n; i++) rects.push({ type: 'chip', index: i, x: x0 + i * (w + gap), y: bar.y, w, h: bar.h });
		} else if (power.kind === 'prism' && power.stage === 'color') {
			const d = bar.h * 0.9;
			const n = game.colors;
			const room = bar.w - cancel.w - gap;
			const step = Math.min(d + gap * 1.4, room / n);
			for (let c = 0; c < n; c++) rects.push({ type: 'color', color: c, x: bar.x + c * step, y: bar.y + (bar.h - d) / 2, w: d, h: d });
			rects.push(cancel);
		} else {
			rects.push(cancel);
		}
		return rects;
	}

	hitBar(px, py) {
		if (!this.game || !this.bar) return null;
		const pad = this.cell * 0.12;
		return this.barRects().find((r) => px >= r.x - pad && px < r.x + r.w + pad && py >= r.y - pad && py < r.y + r.h + pad) || null;
	}

	/** The board cell under a point, or null outside the well. */
	cellAt(px, py) {
		const x = Math.floor((px - this.boardX) / this.cell);
		const y = Math.floor((py - this.boardY) / this.cell);
		if (!this.game || x < 0 || y < 0 || x >= this.game.cols || y >= this.game.rows) return null;
		return { x, y };
	}

	drawBar() {
		const { ctx, cell, power, bar } = this;
		ctx.textBaseline = 'middle';
		for (const r of this.barRects()) {
			if (r.type === 'chip') this.drawChip(r);
			else if (r.type === 'color') this.drawColorChoice(r);
			else this.drawCancel(r);
		}
		if (power) {
			const msg =
				power.kind === 'prism' ? (power.stage === 'color' ? '' : 'Tap a piece to paint it') : 'Touch the well to aim, let go to blast';
			if (msg) this.drawBarText(msg, { x: bar.x + cell * 0.1, y: bar.y + bar.h / 2, size: Math.max(11, Math.round(cell * 0.3)) });
		}
	}

	drawBarText(str, { x, y, size }) {
		const { ctx } = this;
		ctx.font = `800 ${size}px ui-rounded, system-ui, sans-serif`;
		ctx.textAlign = 'left';
		ctx.fillStyle = '#fff6dc';
		ctx.fillText(str, x, y);
	}

	/** A slot of the power-up bag: a dashed outline when empty, or the power-up with its name. */
	drawChip(r) {
		const { ctx, cell, game } = this;
		const kind = game.bag[r.index];
		const pop = kind ? this.chipPop[r.index] ?? 1 : 1;
		const k = 1 + Math.sin(pop * Math.PI) * 0.18 + (1 - pop) * 0.2;
		ctx.save();
		ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
		ctx.scale(k, k);
		ctx.translate(-r.w / 2, -r.h / 2);
		if (!kind) {
			ctx.setLineDash([cell * 0.12, cell * 0.1]);
			ctx.strokeStyle = 'rgba(242,200,121,0.22)';
			ctx.lineWidth = 1.5;
			roundRect(ctx, 0, 0, r.w, r.h, cell * 0.22);
			ctx.stroke();
			ctx.setLineDash([]);
		} else {
			const pulse = 0.5 + 0.5 * Math.sin(this.time * 3 + r.index);
			ctx.fillStyle = 'rgba(242,200,121,0.16)';
			roundRect(ctx, 0, 0, r.w, r.h, cell * 0.22);
			ctx.fill();
			ctx.strokeStyle = GOLD;
			ctx.globalAlpha = 0.6 + pulse * 0.4;
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.globalAlpha = 1;
			this.drawPowerIcon(kind, cell * 0.5, r.h / 2, r.h * 0.62);
			this.drawBarText(POWER_NAMES[kind], { x: cell * 0.88, y: r.h / 2 + 1, size: Math.max(10, Math.round(cell * 0.3)) });
		}
		ctx.restore();
	}

	/** A color to pick for the Prism. */
	drawColorChoice(r) {
		const { ctx, cell } = this;
		const sprite = this.sprites.plain[r.color];
		ctx.drawImage(sprite, r.x, r.y, r.w, r.h);
		ctx.strokeStyle = '#fff6dc';
		ctx.lineWidth = 2;
		ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.time * 7 + r.color);
		roundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, cell * 0.2);
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	/** The cross that cancels the power-up in use. */
	drawCancel(r) {
		const { ctx, cell } = this;
		ctx.strokeStyle = '#b3a8d6';
		ctx.lineWidth = 2.5;
		ctx.lineCap = 'round';
		const cx = r.x + r.w / 2;
		const cy = r.y + r.h / 2;
		const d = cell * 0.2;
		ctx.beginPath();
		ctx.moveTo(cx - d, cy - d);
		ctx.lineTo(cx + d, cy + d);
		ctx.moveTo(cx + d, cy - d);
		ctx.lineTo(cx - d, cy + d);
		ctx.stroke();
		ctx.lineCap = 'butt';
	}

	/** Small icon for a power-up, centered at (cx, cy) and about `size` wide. */
	drawPowerIcon(kind, cx, cy, size, ctx = this.ctx) {
		const r = size / 2;
		ctx.save();
		ctx.translate(cx, cy);
		if (kind === 'prism') drawPrismIcon(ctx, r);
		else if (kind === 'blast') drawBlastIcon(ctx, r);
		else drawRemixIcon(ctx, r);
		ctx.restore();
	}

	/** Shows what a blast would clear while the player aims it. */
	drawAim() {
		const power = this.power;
		if (!this.aim || !power || power.kind !== 'blast') return;
		const { ctx, cell, game } = this;
		const { x, y } = this.aim;
		const hit = new Set(game.blastArea(x, y));
		const pulse = 0.5 + 0.5 * Math.sin(this.time * 8);
		ctx.fillStyle = 'rgba(255,217,138,0.12)';
		ctx.fillRect(this.boardX + (x - 1) * cell, this.boardY + (y - 1) * cell, cell * 3, cell * 3);
		ctx.strokeStyle = `rgba(255,217,138,${0.6 + pulse * 0.4})`;
		ctx.lineWidth = 2.5;
		roundRect(ctx, this.boardX + (x - 1) * cell + 1, this.boardY + (y - 1) * cell + 1, cell * 3 - 2, cell * 3 - 2, cell * 0.25);
		ctx.stroke();
		ctx.strokeStyle = `rgba(255,120,120,${0.7 + pulse * 0.3})`;
		for (const i of hit) {
			const bx = game.columnOf(i);
			const by = game.rowOf(i);
			roundRect(ctx, this.boardX + bx * cell + 3, this.boardY + by * cell + 3, cell - 6, cell - 6, cell * 0.2);
			ctx.stroke();
		}
	}

	drawTray() {
		const { ctx, game } = this;
		game.pieces.forEach((piece, i) => {
			const s = this.slots[i];
			const selected = this.keyCursor && this.keyCursor.slot === i && !this.drag;
			const paintable = Boolean(piece) && this.power && this.power.kind === 'prism' && this.power.stage === 'piece';
			ctx.fillStyle = selected || paintable ? 'rgba(242,200,121,0.14)' : 'rgba(255,255,255,0.035)';
			roundRect(ctx, s.x + 6, s.y, s.w - 12, s.h, 14);
			ctx.fill();
			if (selected || paintable) {
				ctx.strokeStyle = GOLD;
				ctx.lineWidth = 2;
				if (paintable) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.time * 7);
				ctx.stroke();
				ctx.globalAlpha = 1;
			}
			if (!piece) return;
			if (this.drag && this.drag.slot === i && this.drag.moved) return;
			if (this.returning && this.returning.slot === i) return;
			const pos = this.slotPiecePos(i, piece);
			const fits = game.canPlace(piece);
			const a = this.appear[i] ?? 1;
			const pop = a < 1 ? 0.5 + 0.5 * (1 - Math.pow(1 - a, 3)) + Math.sin(a * Math.PI) * 0.12 : 1;
			const lifted = this.drag && this.drag.slot === i ? 1.08 : 1;
			const k = pop * lifted;
			const cx = pos.x + (piece.w * pos.c) / 2;
			const cy = pos.y + (piece.h * pos.c) / 2;
			ctx.save();
			ctx.translate(cx, cy);
			ctx.scale(k, k);
			this.drawPieceAt(piece, -(piece.w * pos.c) / 2, -(piece.h * pos.c) / 2, pos.c, fits ? 1 : 0.3);
			ctx.restore();
		});
	}

	drawDragged() {
		const { ctx, cell } = this;
		if (this.drag && this.drag.moved && this.drag.geometry) {
			const { left, top } = this.drag.geometry;
			ctx.fillStyle = 'rgba(0,0,0,0.3)';
			for (const c of this.drag.piece.cells) {
				roundRect(ctx, left + c.dx * cell + 5, top + c.dy * cell + 9, cell - 6, cell - 6, cell * 0.2);
				ctx.fill();
			}
			this.drawPieceAt(this.drag.piece, left, top, cell);
		}
		if (this.returning) {
			const r = this.returning;
			const piece = this.game.pieces[r.slot];
			if (!piece) return;
			const to = this.slotPiecePos(r.slot, piece);
			const e = 1 - Math.pow(1 - r.t, 3);
			const c = cell + (to.c - cell) * e;
			this.drawPieceAt(piece, r.x + (to.x - r.x) * e, r.y + (to.y - r.y) * e, c);
		}
	}

	drawHint() {
		if (!this.hint || this.drag || !this.game.pieces[0]) return;
		const { ctx, cell } = this;
		const from = this.slotPiecePos(0, this.game.pieces[0]);
		const sx = from.x + from.c;
		const sy = from.y + from.c;
		const tx = this.boardX + this.boardW / 2;
		const ty = this.boardY + this.boardH * 0.45;
		const k = (this.time % 2.2) / 2.2;
		const m = k < 0.15 ? 0 : k > 0.75 ? 1 : (k - 0.15) / 0.6;
		const e = m < 0.5 ? 2 * m * m : 1 - Math.pow(-2 * m + 2, 2) / 2;
		const x = sx + (tx - sx) * e;
		const y = sy + (ty - sy) * e;
		ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
		ctx.fillStyle = 'rgba(255,246,220,0.25)';
		ctx.beginPath();
		ctx.arc(x, y, cell * 0.55, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#fff6dc';
		ctx.strokeStyle = LEAD;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(x, y, cell * 0.22, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.globalAlpha = 1;
	}
}

/** A gem cut into four colored facets. */
function drawPrismIcon(ctx, r) {
	const pts = [[0, -r], [r, 0], [0, r], [-r, 0]];
	for (let i = 0; i < 4; i++) {
		ctx.fillStyle = PALETTE[i].base;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(...pts[i]);
		ctx.lineTo(...pts[(i + 1) % 4]);
		ctx.closePath();
		ctx.fill();
	}
	ctx.strokeStyle = '#fff6dc';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.moveTo(...pts[0]);
	pts.slice(1).forEach((p) => ctx.lineTo(...p));
	ctx.closePath();
	ctx.stroke();
}

/** A burst: a bright core with eight rays. */
function drawBlastIcon(ctx, r) {
	ctx.strokeStyle = '#ffd98a';
	ctx.lineWidth = Math.max(1.5, r * 0.28);
	ctx.lineCap = 'round';
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2;
		ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
		ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
	}
	ctx.stroke();
	ctx.fillStyle = '#fff6dc';
	ctx.beginPath();
	ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
	ctx.fill();
}

/** Two arrows chasing each other in a circle. */
function drawRemixIcon(ctx, r) {
	ctx.strokeStyle = '#bfe6ff';
	ctx.fillStyle = '#bfe6ff';
	ctx.lineWidth = Math.max(1.5, r * 0.26);
	ctx.lineCap = 'round';
	for (let i = 0; i < 2; i++) {
		ctx.save();
		ctx.rotate(i * Math.PI);
		ctx.beginPath();
		ctx.arc(0, 0, r * 0.72, -Math.PI * 0.85, -Math.PI * 0.1);
		ctx.stroke();
		const a = -Math.PI * 0.1;
		const ax = Math.cos(a) * r * 0.72;
		const ay = Math.sin(a) * r * 0.72;
		ctx.beginPath();
		ctx.moveTo(ax + r * 0.38, ay - r * 0.05);
		ctx.lineTo(ax - r * 0.12, ay - r * 0.3);
		ctx.lineTo(ax - r * 0.12, ay + r * 0.3);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
}
