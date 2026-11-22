import './editor.css';
import { ENEMIES, type EnemyId } from './data/enemies';
import { addCustomMap } from './data/customMaps';
import { encodeMap, decodeMap, stashPlaytest } from './data/mapShare';
import { type MapDef, type Point } from './data/maps';
import { cellKey, dirBetween, expand, isAdjacent, simplifyToWaypoints, type Dir } from './data/pathGeometry';
import { validateMap } from './data/validateMap';

type Tool = 'road' | 'river' | 'eraser' | 'portal' | 'crystal';

const ENEMY_OPTIONS = Object.keys(ENEMIES) as EnemyId[];
const PATH_COLORS = ['#c8a56a', '#e8b86d', '#a8d4a0', '#d4a8e8'];

function freshMap(): MapDef {
	const id = `custom-${Date.now().toString(36).slice(-8)}`;
	return {
		id,
		name: 'New map',
		blurb: 'Made in the editor.',
		theme: 'grass',
		w: 14,
		h: 9,
		paths: [
			[
				[0, 4],
				[4, 4],
				[4, 2],
				[10, 2],
				[10, 5],
				[13, 5],
			],
		],
		rivers: [],
		decorSeed: 11,
		decorDensity: 0.3,
		startGold: 220,
		hpScale: 1,
		hpGrowth: 0.14,
		waves: [[{ type: 'scout', count: 8, gap: 1, delay: 0 }]],
	};
}

interface CellView {
	kind: 'ground' | 'path' | 'spawn' | 'goal' | 'river' | 'bridge';
	pathIndex?: number;
	arrow?: Dir;
	badge?: string;
	dimmed?: boolean;
	activePath?: boolean;
	sharedCrystal?: boolean;
	merged?: boolean;
}

class MapEditor {
	private map: MapDef = freshMap();
	private pathStrokes: Point[][] = [];
	private riverStrokes: Point[][] = [];
	private tool: Tool = 'road';
	private pathIndex = 0;
	private riverIndex = 0;
	private crystal: Point | null = null;
	private painting = false;
	private message = 'Draw a road: click the purple portal, then drag along tiles to the crystal.';
	private messageOk = true;
	private readonly root = document.getElementById('editor-app')!;

	constructor() {
		this.syncStrokesFromMap();
		this.render();
	}

	private syncStrokesFromMap(): void {
		this.pathStrokes = this.map.paths.map((path) => expand(path)).filter((cells) => cells.length > 0);
		this.riverStrokes = this.map.rivers.map((river) => expand(river)).filter((cells) => cells.length > 0);
		if (!this.pathStrokes.length) this.pathStrokes = [[]];
		this.detectCrystal();
	}

	private detectCrystal(): void {
		const ends = this.pathStrokes.filter((stroke) => stroke.length > 0).map((stroke) => stroke[stroke.length - 1]);
		if (!ends.length) {
			this.crystal = null;
			return;
		}
		const [c, r] = ends[0];
		if (ends.every(([ec, er]) => ec === c && er === r)) this.crystal = [c, r];
		else this.crystal = [c, r];
	}

	private samePoint(a: Point, b: Point): boolean {
		return a[0] === b[0] && a[1] === b[1];
	}

	private isCrystalCell(c: number, r: number): boolean {
		return !!this.crystal && this.crystal[0] === c && this.crystal[1] === r;
	}

	private syncMapFromStrokes(): void {
		if (this.crystal) {
			for (const stroke of this.pathStrokes) {
				const hit = stroke.findIndex((p) => this.samePoint(p, this.crystal!));
				if (hit >= 0) stroke.splice(hit + 1);
			}
		}
		this.map.paths = this.pathStrokes
			.filter((cells) => cells.length >= 2)
			.map((cells) => simplifyToWaypoints(cells))
			.filter((path) => path.length >= 2);
		this.map.rivers = this.riverStrokes
			.filter((cells) => cells.length >= 2)
			.map((cells) => simplifyToWaypoints(cells))
			.filter((river) => river.length >= 2);
	}

	private buildCellViews(): Map<string, CellView> {
		const views = new Map<string, CellView>();
		const pathUseCount = new Map<string, number>();
		for (const stroke of this.pathStrokes) {
			for (const [c, r] of stroke) {
				if (c < 0 || r < 0 || c >= this.map.w || r >= this.map.h) continue;
				const key = cellKey(c, r);
				pathUseCount.set(key, (pathUseCount.get(key) ?? 0) + 1);
			}
		}

		for (let ri = 0; ri < this.riverStrokes.length; ri++) {
			for (const [c, r] of this.riverStrokes[ri]) {
				if (c < 0 || r < 0 || c >= this.map.w || r >= this.map.h) continue;
				const key = cellKey(c, r);
				views.set(key, { kind: views.has(key) ? 'bridge' : 'river' });
			}
		}

		for (let pi = 0; pi < this.pathStrokes.length; pi++) {
			const cells = this.pathStrokes[pi];
			const active = pi === this.pathIndex;
			for (let i = 0; i < cells.length; i++) {
				const [c, r] = cells[i];
				if (c < 0 || r < 0 || c >= this.map.w || r >= this.map.h) continue;
				const key = cellKey(c, r);
				const onCrystal = this.isCrystalCell(c, r);
				const wasRiver = views.get(key)?.kind === 'river';
				let arrow: Dir | undefined;
				if (i < cells.length - 1) arrow = dirBetween(cells[i], cells[i + 1]) ?? undefined;
				else if (i > 0) arrow = dirBetween(cells[i - 1], cells[i]) ?? undefined;

				const merged = (pathUseCount.get(key) ?? 0) > 1 && i !== 0 && !onCrystal;
				const prior = views.get(key);
				const keepActive = prior?.activePath || active;
				views.set(key, {
					kind: wasRiver ? 'bridge' : i === 0 ? 'spawn' : onCrystal ? 'goal' : 'path',
					pathIndex: active ? pi : (prior?.pathIndex ?? pi),
					arrow: active ? arrow : (prior?.arrow ?? arrow),
					badge: i === 0 ? `${pi + 1}` : onCrystal ? '★' : merged ? '∩' : prior?.badge,
					dimmed: !keepActive,
					activePath: keepActive,
					sharedCrystal: onCrystal,
					merged: merged || prior?.merged,
				});
			}
		}

		if (this.crystal) {
			const [c, r] = this.crystal;
			if (c >= 0 && r >= 0 && c < this.map.w && r < this.map.h) {
				const key = cellKey(c, r);
				if (!views.has(key)) {
					views.set(key, {
						kind: 'goal',
						badge: '★',
						sharedCrystal: true,
					});
				}
			}
		}

		return views;
	}

	private setMessage(text: string, ok = true): void {
		this.message = text;
		this.messageOk = ok;
		const log = this.root.querySelector('.editor-log');
		if (log) {
			log.textContent = text;
			log.className = `editor-log panel ${ok ? 'ok' : 'bad'}`;
		}
	}

	private activeStroke(): Point[] {
		if (this.tool === 'river') {
			if (!this.riverStrokes[this.riverIndex]) this.riverStrokes[this.riverIndex] = [];
			return this.riverStrokes[this.riverIndex];
		}
		if (!this.pathStrokes[this.pathIndex]) this.pathStrokes[this.pathIndex] = [];
		return this.pathStrokes[this.pathIndex];
	}

	private paintCell(c: number, r: number): boolean {
		if (c < 0 || r < 0 || c >= this.map.w || r >= this.map.h) return false;

		if (this.tool === 'portal') {
			this.movePortal(this.pathIndex, c, r);
			return true;
		}
		if (this.tool === 'crystal') {
			this.setCrystal(c, r);
			return true;
		}

		if (this.tool === 'eraser') {
			this.eraseCell(c, r);
			return true;
		}

		if (this.tool === 'river') {
			this.paintRiverCell(c, r);
			return true;
		}

		this.paintRoadCell(c, r);
		return true;
	}

	private movePortal(pathIndex: number, c: number, r: number): void {
		const stroke = this.pathStrokes[pathIndex];
		if (!stroke) return;
		const pt: Point = [c, r];
		if (!stroke.length) {
			stroke.push(pt);
			this.setMessage(`Path ${pathIndex + 1}: portal placed. Draw the road to the shared crystal (★).`);
			return;
		}
		if (stroke.length === 1) {
			stroke[0] = pt;
			this.setMessage(`Path ${pathIndex + 1} portal moved.`);
			return;
		}
		if (isAdjacent(pt, stroke[1])) {
			stroke[0] = pt;
			this.setMessage(`Path ${pathIndex + 1} portal moved (still connected to the road).`);
			return;
		}
		stroke.length = 0;
		stroke.push(pt);
		this.setMessage(`Path ${pathIndex + 1} portal moved here. Draw road tiles to the shared ★.`);
	}

	private setCrystal(c: number, r: number): void {
		this.crystal = [c, r];
		for (const stroke of this.pathStrokes) {
			const hit = stroke.findIndex((p) => p[0] === c && p[1] === r);
			if (hit >= 0) stroke.splice(hit + 1);
		}
		this.setMessage('Shared crystal set. Every path must end on ★.');
	}

	private startDragPaint(e: PointerEvent, c: number, r: number): void {
		this.painting = true;
		this.paintCell(c, r);
		this.render();
		const move = (ev: PointerEvent): void => {
			if (!this.painting) return;
			const target = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
			const cell = target?.closest<HTMLElement>('[data-cell]');
			if (!cell?.dataset.cell) return;
			const [cc, rr] = cell.dataset.cell.split(',').map(Number);
			this.paintCell(cc, rr);
			this.render();
		};
		const up = (): void => {
			this.painting = false;
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
		(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
	}

	private paintRoadCell(c: number, r: number): void {
		const stroke = this.activeStroke();
		const pt: Point = [c, r];

		const idx = stroke.findIndex((p) => p[0] === c && p[1] === r);
		if (idx >= 0) return;

		if (!stroke.length) {
			for (let pi = 0; pi < this.pathStrokes.length; pi++) {
				if (pi === this.pathIndex) continue;
				const other = this.pathStrokes[pi];
				if (other.length && this.samePoint(other[0], pt)) {
					this.setMessage(`Path ${pi + 1} already starts here. Pick another portal tile.`, false);
					return;
				}
			}
			stroke.push(pt);
			this.setMessage(`Path ${this.pathIndex + 1} portal set (tile ${this.pathIndex + 1}). Draw toward ★ or use Move portal.`);
			return;
		}

		const last = stroke[stroke.length - 1];
		if (!isAdjacent(last, pt)) {
			this.setMessage('Road must grow one tile at a time, up/down/left/right.', false);
			return;
		}

		if (this.crystal && this.samePoint(pt, this.crystal)) {
			stroke.push(pt);
			this.setMessage(`Path ${this.pathIndex + 1} reaches the shared crystal.`);
			return;
		}

		stroke.push(pt);
		const shared = this.pathStrokes.some(
			(s, pi) => pi !== this.pathIndex && s.some((p) => p[0] === c && p[1] === r),
		);
		if (shared) this.setMessage(`Path ${this.pathIndex + 1} joins shared road (∩). Overlap is OK toward ★.`);
		else if (this.crystal) this.setMessage(`Path ${this.pathIndex + 1}: keep drawing until you reach ★.`);
		else this.setMessage('Set the shared crystal (Crystal tool), or keep drawing the first path’s end.');
	}

	private paintRiverCell(c: number, r: number): void {
		if (!this.riverStrokes.length) this.riverStrokes = [[]];
		const stroke = this.activeStroke();
		const pt: Point = [c, r];
		if (stroke.some((p) => p[0] === c && p[1] === r)) return;

		if (!stroke.length) {
			stroke.push(pt);
			this.setMessage('River started. Drag along blue tiles (can cross roads as bridges).');
			return;
		}

		const last = stroke[stroke.length - 1];
		if (!isAdjacent(last, pt)) {
			this.setMessage('River must grow one tile at a time.', false);
			return;
		}
		stroke.push(pt);
	}

	private eraseCell(c: number, r: number): void {
		if (this.isCrystalCell(c, r)) {
			this.setMessage('Use the Crystal tool on another tile to move ★. Trim shortens paths before that tile.', false);
			return;
		}
		let changed = false;
		for (const stroke of this.pathStrokes) {
			const idx = stroke.findIndex((p) => p[0] === c && p[1] === r);
			if (idx >= 0) {
				stroke.splice(idx);
				changed = true;
			}
		}
		for (const stroke of this.riverStrokes) {
			const idx = stroke.findIndex((p) => p[0] === c && p[1] === r);
			if (idx >= 0) {
				stroke.splice(idx);
				changed = true;
			}
		}
		if (changed) this.setMessage('Trimmed road/river after this tile.');
		else this.setMessage('No road or river on this tile.', false);
	}

	private toolHint(): string {
		const n = this.pathIndex + 1;
		switch (this.tool) {
			case 'road':
				return `Editing Path ${n} — draw road. Spawn shows “${n}”. All paths end on shared ★.`;
			case 'portal':
				return `Editing Path ${n} — click a tile to move this path’s portal (spawn).`;
			case 'crystal':
				return 'Click a tile for the shared crystal. Every path must finish on ★.';
			case 'river':
				return this.riverStrokes.length
					? `Drawing River ${this.riverIndex + 1}. Paint water; roads on top become bridges.`
					: 'Add a river, then paint water tiles.';
			case 'eraser':
				return 'Click a tile to chop the active road/river after it.';
		}
	}

	private render(): void {
		const views = this.buildCellViews();
		const cells: string[] = [];
		const cellPx = Math.min(40, Math.max(28, Math.floor(560 / Math.max(this.map.w, this.map.h))));

		for (let r = 0; r < this.map.h; r++) {
			for (let c = 0; c < this.map.w; c++) {
				const view = views.get(cellKey(c, r)) ?? { kind: 'ground' as const };
				const pathTint = view.pathIndex !== undefined ? ` path-${view.pathIndex % 4}` : '';
				const arrow = view.arrow ? ` arr-${view.arrow}` : '';
				const dim = view.dimmed ? ' path-dim' : '';
				const active = view.activePath ? ' path-active' : '';
				const crystal = view.sharedCrystal ? ' shared-crystal' : '';
				const merged = view.merged ? ' path-merged' : '';
				const badge = view.badge ? `<span class="cell-badge">${view.badge}</span>` : '';
				cells.push(
					`<button type="button" class="map-cell ${view.kind}${pathTint}${arrow}${dim}${active}${crystal}${merged}" data-cell="${c},${r}" style="width:${cellPx}px;height:${cellPx}px" title="${c}, ${r}">${badge}</button>`,
				);
			}
		}

		const waves = this.map.waves
			.map((wave, wi) => {
				const groups = wave
					.map(
						(g, gi) => `<div class="group-row" data-wave="${wi}" data-group="${gi}">
					<label>Enemy<select data-g="type">${ENEMY_OPTIONS.map((id) => `<option value="${id}" ${g.type === id ? 'selected' : ''}>${ENEMIES[id].name}</option>`).join('')}</select></label>
					<label>Count<input data-g="count" type="number" min="1" value="${g.count}" /></label>
					<label>Gap<input data-g="gap" type="number" min="0" step="0.05" value="${g.gap}" /></label>
					<label>Delay<input data-g="delay" type="number" min="0" step="0.1" value="${g.delay}" /></label>
					<label>Path<input data-g="path" type="number" min="0" step="1" value="${g.path ?? ''}" placeholder="auto" /></label>
					<label><input data-g="elite" type="checkbox" ${g.elite ? 'checked' : ''} />Elite</label>
					<button class="btn small danger" data-del-group type="button">×</button>
				</div>`,
					)
					.join('');
				return `<article class="wave-card" data-wave-card="${wi}"><h3>Wave ${wi + 1}</h3>${groups}<button class="btn small" data-add-group="${wi}" type="button">Add group</button> <button class="btn small danger" data-del-wave="${wi}" type="button">Remove wave</button></article>`;
			})
			.join('');

		const pathTabs = this.pathStrokes
			.map((stroke, i) => {
				const done = this.crystal && stroke.length && this.samePoint(stroke[stroke.length - 1], this.crystal);
				return `<button class="btn small path-tab ${this.pathIndex === i ? 'active' : ''}" data-path="${i}" type="button" style="--path:${PATH_COLORS[i % PATH_COLORS.length]}">Path ${i + 1}${done ? ' ✓' : ''}</button>`;
			})
			.join('');

		const riverTabs = this.riverStrokes
			.map(
				(_, i) =>
					`<button class="btn small ${this.tool === 'river' && this.riverIndex === i ? 'active' : ''}" data-river="${i}" type="button">River ${i + 1}</button>`,
			)
			.join('');

		this.root.innerHTML = `
			<header class="editor-head">
				<h1>Map editor</h1>
				<div class="editor-tabs tools">
					<button class="btn small ${this.tool === 'road' ? 'active' : ''}" data-tool="road" type="button">Draw road</button>
					<button class="btn small ${this.tool === 'portal' ? 'active' : ''}" data-tool="portal" type="button">Move portal</button>
					<button class="btn small ${this.tool === 'crystal' ? 'active' : ''}" data-tool="crystal" type="button">Shared ★</button>
					<button class="btn small ${this.tool === 'river' ? 'active' : ''}" data-tool="river" type="button">Draw river</button>
					<button class="btn small ${this.tool === 'eraser' ? 'active' : ''}" data-tool="eraser" type="button">Trim</button>
				</div>
				<div class="editing-chip" style="--path:${PATH_COLORS[this.pathIndex % PATH_COLORS.length]}">Editing path ${this.pathIndex + 1}</div>
				<span class="grow"></span>
				<a class="btn ghost" href="./index.html">Back to game</a>
			</header>
			<div class="editor-main">
				<section class="editor-panel routes-panel">
					<h2>Terrain</h2>
					<p class="tool-hint">${this.toolHint()}</p>
					<h3 class="sub">Roads (UFO paths)</h3>
					<div class="legend"><span class="leg spawn"></span> Portal · <span class="leg goal"></span> ★ · <span class="leg merge"></span> ∩ shared road (paths may overlap)</div>
					<div class="editor-tabs">${pathTabs}<button class="btn small" data-add-path type="button">+ path</button></div>
					<h3 class="sub">Rivers</h3>
					<div class="legend"><span class="leg river"></span> Water · bridges where road crosses</div>
					<div class="editor-tabs">${riverTabs || '<span class="muted small">None yet</span>'}<button class="btn small" data-add-river type="button">+ river</button></div>
					<div class="editor-foot compact">
						<button class="btn small" data-undo-tile type="button">Undo last tile</button>
						<button class="btn small danger" data-clear-line type="button">Clear active line</button>
					</div>
				</section>
				<section class="editor-panel map-grid-wrap">
					<div class="map-grid" data-grid style="grid-template-columns: repeat(${this.map.w}, ${cellPx}px)">${cells.join('')}</div>
				</section>
				<section class="editor-panel">
					<details class="meta-fold" open>
						<summary><h2>Map info</h2></summary>
						<div class="field-grid">
							<label>Name<input data-field="name" value="${this.map.name}" /></label>
							<label>Id<input data-field="id" value="${this.map.id}" /></label>
							<label>Theme<select data-field="theme"><option value="grass" ${this.map.theme === 'grass' ? 'selected' : ''}>Grass</option><option value="snow" ${this.map.theme === 'snow' ? 'selected' : ''}>Snow</option></select></label>
							<label>Width<input data-field="w" type="number" min="6" max="32" value="${this.map.w}" /></label>
							<label>Height<input data-field="h" type="number" min="6" max="32" value="${this.map.h}" /></label>
							<label>Start gold<input data-field="startGold" type="number" min="0" step="10" value="${this.map.startGold}" /></label>
						</div>
					</details>
					<h2>Waves</h2>
					<div class="wave-list">${waves}</div>
					<button class="btn small" data-add-wave type="button" style="margin-top: 8px">Add wave</button>
				</section>
			</div>
			<footer class="editor-panel editor-foot">
				<button class="btn" data-validate type="button">Validate</button>
				<button class="btn primary" data-playtest type="button">Playtest</button>
				<button class="btn" data-save-custom type="button">Save to game</button>
				<button class="btn" data-copy-code type="button">Copy share code</button>
				<button class="btn" data-download type="button">Download JSON</button>
				<label class="btn">Load JSON<input data-file type="file" accept="application/json" hidden /></label>
				<button class="btn" data-import-code type="button">Paste share code</button>
				<button class="btn" data-new type="button">New map</button>
			</footer>
			<div class="editor-log panel ${this.messageOk ? 'ok' : 'bad'}">${this.message}</div>
		`;

		this.bind();
	}

	private bind(): void {
		this.root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
			button.addEventListener('click', () => {
				this.tool = button.dataset.tool as Tool;
				this.render();
			});
		});
		this.root.querySelectorAll<HTMLButtonElement>('[data-path]').forEach((button) => {
			button.addEventListener('click', () => {
				this.pathIndex = Number(button.dataset.path);
				if (this.tool === 'river') this.tool = 'road';
				this.setMessage(this.toolHint());
				this.render();
			});
		});
		this.root.querySelectorAll<HTMLButtonElement>('[data-river]').forEach((button) => {
			button.addEventListener('click', () => {
				this.tool = 'river';
				this.riverIndex = Number(button.dataset.river);
				this.render();
			});
		});
		this.root.querySelector('[data-add-path]')?.addEventListener('click', () => {
			this.pathStrokes.push([]);
			this.pathIndex = this.pathStrokes.length - 1;
			this.tool = 'road';
			this.setMessage(`Path ${this.pathIndex + 1}: click the spawn tile.`);
			this.render();
		});
		this.root.querySelector('[data-add-river]')?.addEventListener('click', () => {
			this.riverStrokes.push([]);
			this.riverIndex = this.riverStrokes.length - 1;
			this.tool = 'river';
			this.setMessage(`River ${this.riverIndex + 1}: paint water tiles.`);
			this.render();
		});
		this.root.querySelector('[data-undo-tile]')?.addEventListener('click', () => {
			const stroke = this.tool === 'river' ? this.riverStrokes[this.riverIndex] : this.pathStrokes[this.pathIndex];
			if (stroke?.length) stroke.pop();
			this.render();
		});
		this.root.querySelector('[data-clear-line]')?.addEventListener('click', () => {
			if (this.tool === 'river') this.riverStrokes[this.riverIndex] = [];
			else this.pathStrokes[this.pathIndex] = [];
			this.render();
		});

		this.root.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((button) => {
			const [c, r] = button.dataset.cell!.split(',').map(Number);
			button.addEventListener('pointerdown', (e) => {
				e.preventDefault();
				if (this.tool === 'portal' || this.tool === 'crystal') {
					this.paintCell(c, r);
					this.render();
					return;
				}
				this.startDragPaint(e, c, r);
			});
		});

		this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach((input) => {
			const key = input.dataset.field as keyof MapDef;
			input.addEventListener('change', () => {
				if (key === 'theme') this.map.theme = (input as HTMLSelectElement).value as MapDef['theme'];
				else if (key === 'name') this.map.name = input.value;
				else if (key === 'id') this.map.id = input.value;
				else if (key === 'w') this.map.w = Number(input.value);
				else if (key === 'h') this.map.h = Number(input.value);
				else if (key === 'startGold') this.map.startGold = Number(input.value);
				this.syncMapFromStrokes();
				this.render();
			});
		});

		this.root.querySelector('[data-add-wave]')?.addEventListener('click', () => {
			this.map.waves.push([{ type: 'scout', count: 6, gap: 1, delay: 0 }]);
			this.render();
		});
		this.root.querySelectorAll('[data-add-group]').forEach((button) => {
			button.addEventListener('click', () => {
				const wi = Number((button as HTMLElement).dataset.addGroup);
				this.map.waves[wi].push({ type: 'scout', count: 4, gap: 1, delay: 0 });
				this.render();
			});
		});
		this.root.querySelectorAll('[data-del-wave]').forEach((button) => {
			button.addEventListener('click', () => {
				const wi = Number((button as HTMLElement).dataset.delWave);
				this.map.waves.splice(wi, 1);
				this.render();
			});
		});
		this.root.querySelectorAll('[data-del-group]').forEach((button) => {
			button.addEventListener('click', () => {
				const row = (button as HTMLElement).closest('[data-wave]') as HTMLElement;
				const wi = Number(row.dataset.wave);
				const gi = Number(row.dataset.group);
				this.map.waves[wi].splice(gi, 1);
				if (!this.map.waves[wi].length) this.map.waves.splice(wi, 1);
				this.render();
			});
		});

		this.root.querySelectorAll('.group-row').forEach((row) => {
			const wi = Number((row as HTMLElement).dataset.wave);
			const gi = Number((row as HTMLElement).dataset.group);
			const group = this.map.waves[wi][gi];
			row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-g]').forEach((input) => {
				const field = input.dataset.g!;
				const apply = (): void => {
					if (field === 'type') group.type = (input as HTMLSelectElement).value as EnemyId;
					else if (field === 'elite') group.elite = (input as HTMLInputElement).checked;
					else if (field === 'path') {
						const v = (input as HTMLInputElement).value.trim();
						if (v === '') delete group.path;
						else group.path = Number(v);
					} else if (field === 'count') group.count = Number((input as HTMLInputElement).value);
					else if (field === 'gap') group.gap = Number((input as HTMLInputElement).value);
					else if (field === 'delay') group.delay = Number((input as HTMLInputElement).value);
				};
				input.addEventListener('change', apply);
				input.addEventListener('input', apply);
			});
		});

		this.root.querySelector('[data-validate]')?.addEventListener('click', () => this.runValidate());
		this.root.querySelector('[data-playtest]')?.addEventListener('click', () => this.playtest());
		this.root.querySelector('[data-save-custom]')?.addEventListener('click', () => this.saveCustom());
		this.root.querySelector('[data-copy-code]')?.addEventListener('click', () => this.copyCode());
		this.root.querySelector('[data-download]')?.addEventListener('click', () => this.download());
		this.root.querySelector('[data-file]')?.addEventListener('change', (e) => this.loadFile(e));
		this.root.querySelector('[data-import-code]')?.addEventListener('click', () => this.importCode());
		this.root.querySelector('[data-new]')?.addEventListener('click', () => {
			if (confirm('Start a new map? Unsaved changes will be lost.')) {
				this.map = freshMap();
				this.syncStrokesFromMap();
				this.render();
			}
		});
	}

	private runValidate(): MapDef | null {
		this.syncMapFromStrokes();
		if (this.crystal) {
			for (let i = 0; i < this.pathStrokes.length; i++) {
				const stroke = this.pathStrokes[i];
				if (stroke.length < 2) continue;
				const end = stroke[stroke.length - 1];
				if (!this.samePoint(end, this.crystal)) {
					this.setMessage(`Path ${i + 1} must end on the shared crystal (★).`, false);
					return null;
				}
			}
		}
		const { map, errors, warnings } = validateMap(this.map);
		if (!map) {
			this.setMessage(errors.map((e) => e.message).join(' '), false);
			return null;
		}
		this.map = map;
		this.syncStrokesFromMap();
		const warn = warnings.length ? ` Warnings: ${warnings.map((w) => w.message).join(' ')}` : '';
		this.setMessage(`Map looks good.${warn}`);
		return map;
	}

	private playtest(): void {
		const map = this.runValidate();
		if (!map) return;
		stashPlaytest(map);
		location.href = './index.html?playtest=1';
	}

	private saveCustom(): void {
		const map = this.runValidate();
		if (!map) return;
		addCustomMap(map);
		this.setMessage(`Saved “${map.name}”. It shows up under Custom maps in the game.`);
	}

	private async copyCode(): Promise<void> {
		const map = this.runValidate();
		if (!map) return;
		const code = encodeMap(map);
		try {
			await navigator.clipboard.writeText(code);
			this.setMessage('Share code copied.');
		} catch {
			prompt('Copy this share code:', code);
		}
	}

	private download(): void {
		this.syncMapFromStrokes();
		const map = this.runValidate() ?? this.map;
		const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${map.id}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	private loadFile(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const { map, errors } = validateMap(JSON.parse(String(reader.result)));
				if (!map) throw new Error(errors.map((e) => e.message).join(' '));
				this.map = map;
				this.syncStrokesFromMap();
				this.setMessage(`Loaded ${map.name}. Roads and rivers are editable on the grid.`);
				this.render();
			} catch (error) {
				this.setMessage(error instanceof Error ? error.message : 'Could not read file.', false);
			}
			input.value = '';
		};
		reader.readAsText(file);
	}

	private importCode(): void {
		const code = prompt('Paste a share code:');
		if (!code) return;
		try {
			this.map = decodeMap(code);
			this.syncStrokesFromMap();
			this.setMessage(`Loaded ${this.map.name}.`);
			this.render();
		} catch (error) {
			this.setMessage(error instanceof Error ? error.message : 'Invalid code.', false);
		}
	}
}

new MapEditor();