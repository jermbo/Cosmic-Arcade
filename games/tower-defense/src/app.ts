import * as THREE from 'three';
import { allModelNames, loadModels } from './assets';
import { sound } from './audio';
import { ENEMIES } from './data/enemies';
import { BALANCE, MAPS } from './data/maps';
import { TOWER_ORDER, TOWERS, type Branch, type Targeting, type TowerId, type TowerStats } from './data/towers';
import type { Cell } from './game/board';
import { Game, type GameEvent, type Result } from './game/game';
import type { Tower } from './game/tower';
import { enemyIcon, makeIcons, towerIcon } from './icons';
import { focusables, Input, moveFocus, type Action, type Source } from './input';
import { persist, recordResult, resetProgress, save } from './save';
import { Stage } from './stage';

type Screen = 'loading' | 'title' | 'maps' | 'settings' | 'credits' | 'pause' | 'results' | null;

const TARGET_LABELS: Record<Targeting, string> = { first: 'First', strong: 'Strongest', close: 'Closest' };
const TARGET_ORDER: Targeting[] = ['first', 'strong', 'close'];

const TUTORIAL = [
	'UFOs follow the glowing arrows to your Heart Crystal. {Select} a green tile next to the road.',
	'Pick the Ballista in the tower bar to build it there.',
	'Ready? Press Start wave{wave}. The UFOs come out of the purple portal.',
	'',
	'Wave cleared! {Select} your Ballista, then upgrade it.',
	'Build more towers between waves. Try 2x speed{speed} when you feel safe. Good luck!',
];

function el<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
	return root.querySelector(selector) as T;
}

export class App {
	private readonly stage: Stage;
	private readonly input = new Input();
	private game: Game | null = null;
	private playing = false;
	private mapIndex = 0;
	private screen: Screen = 'loading';
	private settingsBack: Screen = 'title';
	private placing: TowerId | null = null;
	private tutorial = -1;
	private tipTimer = 0;
	private last = performance.now();
	private titleTime = 0;
	private readonly debug = new URLSearchParams(location.search).has('debug');

	private readonly ui = document.getElementById('ui')!;
	private readonly hud: HTMLElement;
	private readonly popup: HTMLElement;
	private readonly buildDock: HTMLElement;
	private readonly buildInfo: HTMLElement;
	/** The tower button the player is looking at: hovered, focused or tapped once. */
	private armed: TowerId | null = null;
	/** The gold shown in the HUD. It counts toward the real gold. */
	private shownGold = 0;
	private turnDrag: { x: number; yaw: number; moved: boolean } | null = null;
	/** The tower the side panel shows. */
	private panelTower: Tower | null = null;
	private readonly screenEl: HTMLElement;
	private readonly tip: HTMLElement;
	private readonly banner: HTMLElement;
	private readonly vignette: HTMLElement;
	private readonly debugEl: HTMLElement;
	private pointerDown: { x: number; y: number; id: number } | null = null;

	constructor() {
		const canvas = document.getElementById('view') as HTMLCanvasElement;
		this.stage = new Stage(canvas);
		this.stage.shakeEnabled = save.settings.shake;
		sound.setVolumes(save.settings.music, save.settings.sfx);

		this.ui.innerHTML = `
			<div class="hud" hidden>
				<div class="hud-top">
					<div class="stat lives" title="Lives"><span class="ico heart"></span><b data-lives>20</b></div>
					<div class="stat gold" title="Gold"><span class="ico coin"></span><b data-gold>0</b></div>
					<div class="stat wave">Wave <b data-wave>0</b><span>/<i data-total>0</i></span></div>
					<div class="grow"></div>
					<div class="turn">
						<button class="btn icon" data-turn="-1" title="Turn the board left (Q)" aria-label="Turn left"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 13a7.5 7.5 0 1 0 2.6-6.2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M4.5 3.5v5h5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
						<button class="btn icon" data-turn="1" title="Turn the board right (E)" aria-label="Turn right"><svg class="flip" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 13a7.5 7.5 0 1 0 2.6-6.2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M4.5 3.5v5h5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
					</div>
					<button class="btn icon" data-speed title="Speed (F)">1x</button>
					<button class="btn icon" data-pause title="Pause (P)"><span class="pause-ico"></span></button>
				</div>
				<div class="build-dock">
					<div class="build-info" hidden></div>
					<div class="build-bar"></div>
				</div>
				<div class="wave-box">
					<div class="preview"></div>
					<button class="btn primary" data-next><span data-next-label>Next wave</span><kbd class="k">Space</kbd><kbd class="p">Select</kbd></button>
				</div>
			</div>
			<div class="popup" hidden></div>
			<div class="tip" hidden><p></p><button class="link" data-skip>Skip tutorial</button></div>
			<div class="banner"></div>
			<div class="vignette"></div>
			<div class="debug" hidden></div>
			<div class="screen"></div>
		`;
		this.hud = el(this.ui, '.hud');
		this.popup = el(this.ui, '.popup');
		this.buildDock = el(this.hud, '.build-dock');
		this.buildInfo = el(this.hud, '.build-info');
		this.screenEl = el(this.ui, '.screen');
		this.tip = el(this.ui, '.tip');
		this.banner = el(this.ui, '.banner');
		this.vignette = el(this.ui, '.vignette');
		this.debugEl = el(this.ui, '.debug');
		this.debugEl.hidden = !this.debug;

		this.showLoading();
		this.bindHud();
		this.bindPointer(canvas);
		this.input.onAction = (action, source) => this.onAction(action, source);
		this.input.onSource = (source) => this.onSource(source);
		document.body.dataset.input = 'mouse';
		window.addEventListener('resize', () => this.layout());
		document.addEventListener('visibilitychange', () => {
			if (document.hidden && this.playing && this.screen === null && !this.debug) this.openPause();
		});
		// The first click or key press unlocks sound.
		const unlock = (): void => sound.unlock();
		window.addEventListener('pointerdown', unlock);
		window.addEventListener('keydown', unlock);
		if (this.debug) Object.assign(window, { __td: this, __data: { MAPS, TOWERS, ENEMIES, BALANCE } });

		void this.boot();
	}

	private async boot(): Promise<void> {
		await loadModels(allModelNames(), (done, total) => {
			const bar = this.screenEl.querySelector<HTMLElement>('.bar i');
			if (bar) bar.style.width = `${(done / total) * 100}%`;
		});
		makeIcons();
		this.buildBar();
		this.startDemo();
		this.showTitle();
		requestAnimationFrame(() => this.frame());
	}

	// ---------- Main loop ----------

	private frame(): void {
		const now = performance.now();
		const dt = Math.min(0.1, (now - this.last) / 1000);
		this.last = now;
		this.input.poll(dt);
		if (this.game) this.game.update(dt);
		if (!this.playing) {
			this.titleTime += dt;
			this.stage.yaw = Math.sin(this.titleTime * 0.12) * 0.35;
		}
		if (this.game && this.playing && this.shownGold !== this.game.gold) this.tickGold(dt);
		// Keep the tower panel on the far side of its tower while the board turns.
		if (this.stage.turning && !this.popup.hidden) this.placePopup();
		if (this.tipTimer > 0) {
			this.tipTimer -= dt;
			if (this.tipTimer <= 0) this.hideTip();
		}
		if (this.debug && this.game) {
			this.debugEl.textContent = `enemies ${this.game.enemies.length} · speed ${this.game.speed} · time ${this.game.time.toFixed(0)}s · fps ${Math.round(1 / Math.max(dt, 0.001))}`;
		}
		this.stage.render(dt);
		requestAnimationFrame(() => this.frame());
	}

	// ---------- Starting and ending games ----------

	private startDemo(): void {
		this.game?.dispose();
		this.playing = false;
		const game = new Game(this.stage, 'meadow', () => {}, true);
		game.gold = 1e9;
		const picks: [TowerId, number, Branch | null][] = [
			['ballista', 2, null],
			['cannon', 3, 'a'],
			['crystal', 2, null],
			['catapult', 3, 'b'],
			['ballista', 3, 'a'],
			['cannon', 1, null],
		];
		const spots: Cell[] = [];
		for (const column of game.board.cells) {
			for (const cell of column) {
				if (!game.board.buildable(cell)) continue;
				const nearRoad = [-1, 0, 1].some((dc) => [-1, 0, 1].some((dr) => game.board.cell(cell.c + dc, cell.r + dr)?.pathMask));
				if (nearRoad && spots.every((s) => Math.abs(s.c - cell.c) + Math.abs(s.r - cell.r) > 3)) spots.push(cell);
			}
		}
		picks.forEach(([id, level, branch], i) => {
			const cell = spots[i * 2 % spots.length];
			if (!cell || !game.board.buildable(cell)) return;
			const tower = game.build(id, cell);
			if (!tower) return;
			if (level >= 2) game.upgrade(tower);
			if (level >= 3 && branch) game.upgrade(tower, branch);
			tower.setSelected(false);
		});
		game.select(null);
		this.game = game;
		this.stage.setQuarter(0);
		this.stage.margins = { top: 0.05, bottom: 0.05, left: 0.02, right: 0.02 };
		this.stage.resize();
		sound.music('menu');
	}

	private startMap(index: number): void {
		this.game?.dispose();
		this.mapIndex = index;
		this.playing = true;
		this.setPlacing(null);
		this.stage.setQuarter(0);
		const map = MAPS[index];
		this.game = new Game(this.stage, map.id, (event) => this.onGameEvent(event));
		if (this.debug) this.game.gold = 99999;
		this.shownGold = this.game.gold;
		this.closeScreen();
		this.hud.hidden = false;
		this.layout();
		el(this.hud, '[data-total]').textContent = String(this.game.totalWaves);
		this.updateHud();
		this.updateSpeed();
		this.hidePopup();
		sound.music('battle');
		this.showBanner(map.name, 'Defend the Heart Crystal');
		this.tutorial = -1;
		this.hideTip();
		if (map.id === 'meadow' && !save.tutorialDone) this.setTutorial(0);
	}

	private endGame(result: Result): void {
		const best = result.won ? recordResult(result.map, this.mapIndex, result.stars, result.score) : false;
		this.hidePopup();
		this.hideTip();
		this.showResults(result, best);
		sound.play(result.won ? 'win' : 'lose');
	}

	private quitToMaps(): void {
		this.hud.hidden = true;
		this.hidePopup();
		this.hideTip();
		this.startDemo();
		this.showMaps();
	}

	// ---------- Game events ----------

	private onGameEvent(event: GameEvent): void {
		switch (event.type) {
			case 'change':
				this.updateHud();
				break;
			case 'select':
				this.renderPopup(event.cell, event.tower);
				if (event.cell && this.tutorial === 0 && this.game?.board.buildable(event.cell)) this.setTutorial(1);
				if (event.tower && this.tutorial === 4) this.tipTimer = 0;
				break;
			case 'built':
				if (this.tutorial <= 1 && this.tutorial >= 0) this.setTutorial(2);
				break;
			case 'upgraded':
				if (this.tutorial === 4) this.setTutorial(5);
				break;
			case 'waveStart':
				this.showBanner(`Wave ${event.wave}`, event.wave === this.game?.totalWaves ? 'Final wave!' : '');
				if (this.tutorial === 2) this.setTutorial(3);
				break;
			case 'waveClear':
				if (this.game && event.wave < this.game.totalWaves) this.showBanner('Wave cleared', `+${event.bonus} gold`, true);
				if (this.tutorial === 3) this.setTutorial(4);
				break;
			case 'leak':
				this.vignette.classList.remove('on');
				void this.vignette.offsetWidth;
				this.vignette.classList.add('on');
				this.hud.querySelector('.lives')?.classList.add('bump');
				setTimeout(() => this.hud.querySelector('.lives')?.classList.remove('bump'), 300);
				break;
			case 'swarm':
				break;
			case 'end':
				this.endGame(event.result);
				break;
		}
	}

	// ---------- HUD ----------

	private bindHud(): void {
		el(this.hud, '[data-speed]').addEventListener('click', () => this.cycleSpeed());
		el(this.hud, '[data-pause]').addEventListener('click', () => this.openPause());
		this.hud.querySelectorAll<HTMLElement>('[data-turn]').forEach((button) => {
			button.addEventListener('click', () => this.turn(Number(button.dataset.turn)));
		});
		el(this.hud, '[data-next]').addEventListener('click', () => this.callWave());
		el(this.tip, '[data-skip]').addEventListener('click', () => {
			save.tutorialDone = true;
			persist();
			this.tutorial = -1;
			this.hideTip();
		});
	}

	private buildBar(): void {
		const bar = el(this.hud, '.build-bar');
		bar.innerHTML = TOWER_ORDER.map((id) => {
			const def = TOWERS[id];
			return `<button class="tower-btn" data-place="${id}" aria-label="${def.name}">
				<img src="${towerIcon(id, 1)}" alt="" />
				<span class="cost"><i class="ico coin"></i>${def.levels[0].cost}</span>
				<kbd class="k">${def.key}</kbd>
			</button>`;
		}).join('');
		bar.querySelectorAll<HTMLButtonElement>('[data-place]').forEach((button) => {
			const id = button.dataset.place as TowerId;
			button.addEventListener('pointerenter', (event) => {
				if (event.pointerType === 'mouse') this.arm(id);
			});
			button.addEventListener('pointerleave', (event) => {
				if (event.pointerType === 'mouse' && this.armed === id) this.arm(this.placing);
			});
			button.addEventListener('focus', () => {
				// A tap also focuses the button. Only keys and the gamepad arm on focus.
				if (this.input.source === 'key' || this.input.source === 'pad') this.arm(id);
			});
			button.addEventListener('blur', () => {
				if (this.armed === id && !this.buildDock.contains(document.activeElement)) this.arm(this.placing);
			});
			button.addEventListener('click', () => this.pickTower(id));
		});
	}

	/** A tower button was clicked or tapped. */
	private pickTower(id: TowerId): void {
		const game = this.game;
		if (!game) return;
		const cell = game.selected;
		if (cell && game.board.buildable(cell)) {
			// A tile is picked: build on it. On touch, the first tap only shows the tower.
			if (this.input.source === 'touch' && this.armed !== id) {
				this.arm(id);
				sound.play('hover');
				return;
			}
			this.buildAt(id, cell);
			return;
		}
		game.select(null);
		this.setPlacing(this.placing === id ? null : id);
		sound.play('click');
	}

	/** Shows what a tower does above the bar, and a see-through copy on the picked tile. */
	private arm(id: TowerId | null): void {
		this.armed = id;
		this.hud.querySelectorAll<HTMLElement>('[data-place]').forEach((button) => button.classList.toggle('armed', button.dataset.place === id));
		const game = this.game;
		if (game && game.board.buildable(game.selected)) game.showGhost(id);
		if (!id) {
			this.buildInfo.hidden = true;
			return;
		}
		const def = TOWERS[id];
		const level = def.levels[0];
		const touchHint = this.input.source === 'touch' && game?.board.buildable(game.selected) ? '<em>Tap again to build</em>' : '';
		const placeHint = this.placing === id ? `<em>${this.input.source === 'touch' ? 'Tap' : 'Click'} a green tile</em>` : '';
		this.buildInfo.innerHTML = `
			<div class="info-head"><b>${def.name}</b><span class="role">${def.role}</span><span class="cost"><i class="ico coin"></i>${level.cost}</span></div>
			<p>${level.blurb}</p>
			${touchHint || placeHint}`;
		this.buildInfo.hidden = false;
	}

	private setPlacing(id: TowerId | null): void {
		this.placing = id;
		this.hud.querySelectorAll<HTMLElement>('[data-place]').forEach((button) => button.classList.toggle('active', button.dataset.place === id));
		document.body.classList.toggle('placing', !!id);
		if (!id) this.game?.showGhost(null);
		this.arm(id);
	}

	/** The bar waits for a tower choice for the picked tile. */
	private setBuildTarget(on: boolean): void {
		this.buildDock.classList.toggle('target', on);
		if (!on && !this.placing) this.arm(null);
	}

	private turn(steps: number): void {
		if (!this.game || !this.playing) return;
		this.stage.turn(steps);
		sound.play('hover');
	}

	private tickGold(dt: number): void {
		const target = this.game!.gold;
		const diff = target - this.shownGold;
		// Count quickly, but always reach the number within about half a second.
		const step = Math.max(1, Math.abs(diff) * Math.min(1, dt * 9));
		this.shownGold = Math.abs(diff) <= step ? target : this.shownGold + Math.sign(diff) * step;
		el(this.hud, '[data-gold]').textContent = String(Math.round(this.shownGold));
	}

	/** Keeps the board clear of the HUD, and puts the tutorial tip in a free spot. */
	private layout(): void {
		if (this.playing && !this.hud.hidden) {
			const view = this.ui.getBoundingClientRect();
			const h = view.height || innerHeight;
			const w = view.width || innerWidth;
			// On short, wide screens the bar stands on the left side, where there is free room anyway.
			const side = this.hud.classList.toggle('side-bar', h < 560 && w / h > 1.6);
			const top = el(this.hud, '.hud-top').getBoundingClientRect();
			const bar = el(this.hud, '.build-bar').getBoundingClientRect();
			const wave = el(this.hud, '.wave-box').getBoundingClientRect();
			const bottom = Math.max(side ? 0 : h - bar.top, h - wave.top);
			this.stage.margins = {
				top: (top.bottom + 4) / h,
				bottom: (bottom + 4) / h,
				left: side ? (bar.right + 6) / w : 0.02,
				right: 0.02,
			};
			this.placeTip();
		}
		this.stage.resize();
		this.placePopup();
	}

	private updateHud(): void {
		const game = this.game;
		if (!game || !this.playing) return;
		el(this.hud, '[data-lives]').textContent = String(game.lives);
		if (game.gold < this.shownGold) {
			// Spending shows at once; income counts up.
			this.shownGold = game.gold;
			el(this.hud, '[data-gold]').textContent = String(game.gold);
		}
		el(this.hud, '[data-wave]').textContent = String(game.wave);
		this.hud.querySelector('.lives')?.classList.toggle('low', game.lives <= 5);
		this.hud.querySelectorAll<HTMLButtonElement>('[data-place]').forEach((button) => {
			const id = button.dataset.place as TowerId;
			button.classList.toggle('poor', game.gold < TOWERS[id].levels[0].cost);
		});

		const next = el<HTMLButtonElement>(this.hud, '[data-next]');
		const box = el(this.hud, '.wave-box');
		const preview = game.nextWavePreview();
		box.hidden = game.wave >= game.totalWaves || game.over;
		next.disabled = !game.canCallWave;
		const early = game.waveRunning && game.canCallWave;
		el(next, '[data-next-label]').textContent = game.wave === 0 ? 'Start wave' : early ? `Call early +${10 + (game.wave + 1) * 2}` : 'Next wave';
		next.classList.toggle('pulse', !game.waveRunning && game.wave < game.totalWaves);
		const html = preview
			.map((p) => `<span class="chip${p.elite ? ' elite' : ''}" title="${ENEMIES[p.type].name}: ${ENEMIES[p.type].blurb}"><img src="${enemyIcon(p.type, p.elite)}" alt="" />${p.count}</span>`)
			.join('');
		const previewEl = el(box, '.preview');
		if (previewEl.dataset.html !== html) {
			previewEl.dataset.html = html;
			previewEl.innerHTML = html;
		}
		// Keep the open panel in step with the gold.
		if (!this.popup.hidden) this.refreshPopupState();
	}

	private callWave(): void {
		if (!this.game || this.game.over) return;
		if (!this.game.callWave()) sound.play('deny');
	}

	private cycleSpeed(): void {
		if (!this.game) return;
		const speeds = this.debug ? [1, 2, 3, 10] : [1, 2, 3];
		this.game.speed = speeds[(speeds.indexOf(this.game.speed) + 1) % speeds.length];
		this.updateSpeed();
		sound.play('click');
	}

	private updateSpeed(): void {
		const button = el(this.hud, '[data-speed]');
		button.textContent = `${this.game?.speed ?? 1}x`;
		button.classList.toggle('fast', (this.game?.speed ?? 1) > 1);
	}

	private showBanner(title: string, sub: string, small = false): void {
		this.banner.innerHTML = `<h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}`;
		this.banner.className = `banner${small ? ' small' : ''}`;
		void this.banner.offsetWidth;
		this.banner.classList.add('show');
	}

	// ---------- Popup: build menu and tower panel ----------

	private renderPopup(cell: Cell | null, tower: Tower | null): void {
		const game = this.game;
		const buildHere = !!cell && !tower && !!game?.board.buildable(cell) && this.playing;
		this.setBuildTarget(buildHere);
		if (buildHere && (this.input.source === 'key' || this.input.source === 'pad')) {
			const first = this.buildDock.querySelector<HTMLElement>('[data-place]:not(.poor)') ?? this.buildDock.querySelector<HTMLElement>('[data-place]');
			first?.focus();
		}
		if (!cell || !game || !this.playing || !tower) {
			this.hidePopup();
			return;
		}
		const wasOpen = !this.popup.hidden;
		this.panelTower = tower;
		this.renderTowerPanel(tower);
		this.popup.hidden = false;
		if (!wasOpen) {
			this.popup.classList.remove('open');
			void this.popup.offsetWidth;
			this.popup.classList.add('open');
		}
		this.placePopup();
		this.refreshPopupState();
		if (this.input.source === 'key' || this.input.source === 'pad') this.focusPopup();
	}

	/** Focuses the first useful choice: an upgrade, or else the first button. */
	private focusPopup(): void {
		const first = this.popup.querySelector<HTMLElement>('[data-upgrade]:not(:disabled)');
		(first ?? focusables(this.popup)[0])?.focus();
	}

	private statLine(stats: TowerStats, id: TowerId): string {
		const parts: string[] = [];
		parts.push(`<span><i>Damage</i>${stats.damage}${stats.shots ? ` ×${stats.shots}` : ''}</span>`);
		parts.push(`<span><i>Range</i>${stats.range}</span>`);
		parts.push(`<span><i>Speed</i>${(1 / stats.rate).toFixed(1)}/s</span>`);
		if (stats.pierce) parts.push(`<span><i>Pierce</i>${stats.pierce > 20 ? 'All' : stats.pierce}</span>`);
		if (stats.splash) parts.push(`<span><i>Blast</i>${stats.splash}</span>`);
		if (stats.slow) parts.push(`<span><i>Slow</i>${Math.round(stats.slow * 100)}%</span>`);
		if (stats.stun) parts.push(`<span><i>Freeze</i>${stats.stun}s</span>`);
		if (stats.shatter) parts.push(`<span><i>Shatter</i>+${Math.round(stats.shatter * 100)}%</span>`);
		if (id === 'catapult') parts.push(`<span class="warn">No flyers</span>`);
		return parts.join('');
	}

	private renderTowerPanel(tower: Tower): void {
		const def = tower.def;
		const level = tower.levelDef;
		let upgrades = '';
		if (tower.level === 1) {
			const next = def.levels[1];
			upgrades = `<button class="upgrade" data-upgrade data-cost="${next.cost}" data-range="${next.stats.range}">
				<img src="${towerIcon(def.id, 2)}" alt="" />
				<span class="name">${next.name}</span>
				<span class="blurb">${next.blurb}</span>
				<span class="cost"><i class="ico coin"></i>${next.cost}</span>
				<kbd class="k">U</kbd><kbd class="p">X</kbd>
			</button>`;
		} else if (tower.level === 2) {
			upgrades = (['a', 'b'] as Branch[])
				.map((branch) => {
					const next = def.branches[branch];
					return `<button class="upgrade branch-${branch}" data-upgrade="${branch}" data-cost="${next.cost}" data-range="${next.stats.range}">
						<img src="${towerIcon(def.id, 3, branch)}" alt="" />
						<span class="name">${next.name}</span>
						<span class="blurb">${next.blurb}</span>
						<span class="cost"><i class="ico coin"></i>${next.cost}</span>
					</button>`;
				})
				.join('');
		} else {
			upgrades = `<p class="maxed">Fully upgraded</p>`;
		}
		this.popup.dataset.kind = 'tower';
		this.popup.innerHTML = `
			<div class="popup-head">
				<img class="head-icon" src="${towerIcon(def.id, tower.level, tower.branch)}" alt="" />
				<div class="head-text"><b>${level.name}</b><span>Level ${tower.level}${tower.branch ? ` · ${tower.branch === 'a' ? 'Branch A' : 'Branch B'}` : ''} · ${tower.kills} kills</span></div>
				<button class="close" data-close aria-label="Close" tabindex="-1">×</button>
			</div>
			<div class="stats">${this.statLine(tower.stats, def.id)}</div>
			${tower.level === 2 ? '<p class="choose">Choose a path. You cannot change it later.</p>' : ''}
			<div class="popup-row upgrades">${upgrades}</div>
			<div class="popup-row small">
				${def.id === 'crystal' ? '' : `<button class="btn small" data-target>Target: ${TARGET_LABELS[tower.targeting]} <kbd class="k">T</kbd></button>`}
				<button class="btn small danger" data-sell>Sell +${tower.sellValue} <kbd class="k">S</kbd><kbd class="p">Y</kbd></button>
			</div>
		`;
		this.popup.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach((button) => {
			const branch = (button.dataset.upgrade || undefined) as Branch | undefined;
			button.addEventListener('click', () => this.game?.upgrade(tower, branch));
			// Show the range the upgrade would give.
			const preview = (): void => this.game?.previewRange(Number(button.dataset.range));
			const clear = (): void => this.game?.previewRange(null);
			button.addEventListener('pointerenter', preview);
			button.addEventListener('focus', preview);
			button.addEventListener('pointerleave', clear);
			button.addEventListener('blur', clear);
		});
		this.popup.querySelector('[data-target]')?.addEventListener('click', () => this.cycleTarget(tower));
		el(this.popup, '[data-sell]').addEventListener('click', () => this.game?.sell(tower));
		el(this.popup, '[data-close]').addEventListener('click', () => this.game?.select(null));
	}

	private refreshPopupState(): void {
		const gold = this.game?.gold ?? 0;
		this.popup.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach((button) => {
			button.disabled = gold < Number(button.dataset.cost);
		});
	}

	/** Docks the tower panel on the side of the screen away from its tower, so the tower and its range stay in view. */
	private placePopup(): void {
		const tower = this.panelTower;
		if (!tower || this.popup.hidden) return;
		const screen = this.stage.toScreen(tower.pos);
		const view = this.ui.getBoundingClientRect();
		const right = screen.x < view.width / 2;
		if (this.popup.classList.contains('right') !== right && this.popup.classList.contains('open')) {
			this.popup.classList.remove('open');
			void this.popup.offsetWidth;
			this.popup.classList.add('open');
		}
		this.popup.classList.toggle('right', right);
		this.popup.classList.toggle('left', !right);
		const top = el(this.hud, '.hud-top').getBoundingClientRect().bottom + 8;
		this.popup.style.top = `${top}px`;
		this.popup.style.maxHeight = `${view.height - top - 8}px`;
	}

	/** Puts the tutorial tip in the free strip between the bottom bars, or at the top if there is no room. */
	private placeTip(): void {
		if (this.tip.hidden || this.hud.hidden) return;
		const view = this.ui.getBoundingClientRect();
		const bar = el(this.hud, '.build-bar').getBoundingClientRect();
		const wave = el(this.hud, '.wave-box').getBoundingClientRect();
		const left = bar.right + 12;
		const right = wave.left - 12;
		const room = right - left;
		const style = this.tip.style;
		if (room >= 280) {
			style.left = `${left + room / 2}px`;
			style.width = `${Math.min(room, 520)}px`;
			style.top = 'auto';
			style.bottom = `${view.height - wave.bottom}px`;
			this.tip.classList.add('low');
		} else {
			style.left = '50%';
			style.width = '';
			style.bottom = 'auto';
			style.top = `${el(this.hud, '.hud-top').getBoundingClientRect().bottom + 8}px`;
			this.tip.classList.remove('low');
		}
	}

	private hidePopup(): void {
		this.popup.hidden = true;
		this.panelTower = null;
		this.popup.innerHTML = '';
		this.game?.previewRange(null);
	}

	private cycleTarget(tower: Tower): void {
		tower.targeting = TARGET_ORDER[(TARGET_ORDER.indexOf(tower.targeting) + 1) % TARGET_ORDER.length];
		sound.play('click');
		this.renderTowerPanel(tower);
		this.refreshPopupState();
		if (this.input.source !== 'mouse') this.popup.querySelector<HTMLElement>('[data-target]')?.focus();
	}

	private buildAt(id: TowerId, cell: Cell | null): void {
		const game = this.game;
		if (!game || !cell) return;
		if (!game.canBuild(id, cell)) {
			sound.play('deny');
			if (game.board.buildable(cell)) this.flashGold();
			return;
		}
		game.build(id, cell);
	}

	private flashGold(): void {
		const gold = this.hud.querySelector('.gold');
		gold?.classList.remove('deny');
		void (gold as HTMLElement | null)?.offsetWidth;
		gold?.classList.add('deny');
	}

	// ---------- Pointer ----------

	private bindPointer(canvas: HTMLCanvasElement): void {
		const cellAt = (event: PointerEvent): Cell | null => {
			const hit = this.stage.pick(event.offsetX, event.offsetY);
			return hit && this.game ? this.game.board.cellAtWorld(hit.x, hit.z) : null;
		};
		canvas.addEventListener('pointermove', (event) => {
			const drag = this.turnDrag;
			if (drag) {
				// Grab the board and drag it around; it snaps to a quarter turn on release.
				const dx = event.clientX - drag.x;
				if (Math.abs(dx) > 6) drag.moved = true;
				if (drag.moved) this.stage.turnTo(drag.yaw - dx * 0.008);
				return;
			}
			if (!this.playing || !this.game || event.pointerType === 'touch') return;
			// Browsers also send a move when the page changes under a still mouse. Ignore those.
			if (event.movementX === 0 && event.movementY === 0) return;
			const cell = cellAt(event);
			this.game.setKeyCursor(null);
			this.game.setHover(cell);
			if (this.placing) {
				if (cell && this.game.board.buildable(cell)) {
					this.game.selected = cell;
					this.game.showGhost(this.placing);
					this.game.selected = null;
				} else this.game.showGhost(null);
			}
		});
		canvas.addEventListener('pointerleave', () => this.game?.setHover(null));
		canvas.addEventListener('pointerdown', (event) => {
			this.pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId };
			if (event.button === 2 && this.playing) {
				this.turnDrag = { x: event.clientX, yaw: this.stage.yaw, moved: false };
				canvas.setPointerCapture(event.pointerId);
			}
		});
		canvas.addEventListener('pointerup', (event) => {
			const down = this.pointerDown;
			this.pointerDown = null;
			const drag = this.turnDrag;
			this.turnDrag = null;
			if (drag?.moved) {
				this.stage.turn(0);
				return;
			}
			if (!down || down.id !== event.pointerId) return;
			if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 10) return;
			if (!this.playing || !this.game || this.screen) return;
			if (event.button === 2) {
				this.cancel();
				return;
			}
			this.clickCell(cellAt(event), event.shiftKey);
		});
		canvas.addEventListener('contextmenu', (event) => event.preventDefault());
	}

	private clickCell(cell: Cell | null, keep = false): void {
		const game = this.game;
		if (!game || game.over) return;
		if (this.placing) {
			if (cell && game.board.buildable(cell)) {
				const id = this.placing;
				if (!keep || game.gold < TOWERS[id].levels[0].cost * 2) this.setPlacing(null);
				this.buildAt(id, cell);
				if (keep && this.placing) game.select(null);
				return;
			}
			this.setPlacing(null);
		}
		if (!cell) {
			game.select(null);
			return;
		}
		if (cell === game.selected) {
			game.select(null);
			return;
		}
		if (game.towerAt(cell) || game.board.buildable(cell)) {
			sound.play('click');
			game.select(cell);
		} else {
			game.select(null);
		}
	}

	private cancel(): void {
		if (this.placing) this.setPlacing(null);
		else this.game?.select(null);
	}

	// ---------- Keys and gamepad ----------

	private onSource(source: Source): void {
		if (!this.game || !this.playing) return;
		if (source === 'mouse' || source === 'touch') this.game.setKeyCursor(null);
		if (this.tutorial >= 0) this.setTutorial(this.tutorial);
	}

	private onAction(action: Action, source: Source): void {
		sound.unlock();
		if (this.screen) {
			this.screenAction(action);
			return;
		}
		const game = this.game;
		if (!game || !this.playing) return;
		const popupFocused = !this.popup.hidden && this.popup.contains(document.activeElement);
		const barFocused = this.buildDock.contains(document.activeElement);
		const selectedTower = game.towerAt(game.selected);

		switch (action) {
			case 'up':
			case 'down':
			case 'left':
			case 'right':
				if (popupFocused) moveFocus(this.popup, action);
				else if (barFocused && (action === 'left' || action === 'right')) moveFocus(this.buildDock, action);
				else {
					if (barFocused) (document.activeElement as HTMLElement).blur();
					this.moveCursor(action);
				}
				break;
			case 'turnLeft':
			case 'turnRight':
				this.turn(action === 'turnLeft' ? -1 : 1);
				break;
			case 'prev':
			case 'next':
				if (!this.popup.hidden) moveFocus(this.popup, action === 'prev' ? 'left' : 'right');
				else if (barFocused) moveFocus(this.buildDock, action === 'prev' ? 'left' : 'right');
				else {
					const i = this.placing ? TOWER_ORDER.indexOf(this.placing) : -1;
					const n = TOWER_ORDER.length;
					this.setPlacing(TOWER_ORDER[(i + (action === 'next' ? 1 : n - 1) + (i < 0 && action === 'prev' ? 1 : 0)) % n]);
					this.previewPlacing();
				}
				break;
			case 'confirm':
				if (popupFocused || barFocused) (document.activeElement as HTMLElement).click();
				else if (!this.popup.hidden && source !== 'mouse') this.focusPopup();
				else this.clickCell(this.cursorCell());
				break;
			case 'back':
				if (barFocused) (document.activeElement as HTMLElement).blur();
				if (this.placing || game.selected) this.cancel();
				else this.openPause();
				break;
			case 'pause':
				this.openPause();
				break;
			case 'wave':
				this.callWave();
				break;
			case 'speed':
				this.cycleSpeed();
				break;
			case 'upgrade':
				if (!selectedTower) break;
				if (selectedTower.level === 1) game.upgrade(selectedTower);
				else if (selectedTower.level === 2) this.popup.querySelector<HTMLElement>('[data-upgrade]')?.focus();
				break;
			case 'sell':
				if (selectedTower) game.sell(selectedTower);
				break;
			case 'target':
				if (selectedTower && selectedTower.def.id !== 'crystal') this.cycleTarget(selectedTower);
				break;
			case 'tower1':
			case 'tower2':
			case 'tower3':
			case 'tower4': {
				const id = TOWER_ORDER[Number(action.slice(-1)) - 1];
				const target = game.board.buildable(game.selected) ? game.selected : this.cursorCell();
				if (target && game.board.buildable(target)) this.buildAt(id, target);
				else {
					game.select(null);
					this.setPlacing(id);
					this.previewPlacing();
				}
				break;
			}
		}
	}

	private cursorCell(): Cell | null {
		return this.game?.keyCell ?? null;
	}

	private previewPlacing(): void {
		const game = this.game;
		const cell = this.cursorCell();
		if (!game || !this.placing || !cell || !game.board.buildable(cell)) return;
		game.selected = cell;
		game.showGhost(this.placing);
		game.selected = null;
	}

	private moveCursor(dir: 'up' | 'down' | 'left' | 'right'): void {
		const game = this.game!;
		const board = game.board;
		let cell = game.keyCell ?? game.selected;
		if (!cell) {
			cell = board.cell(Math.floor(board.width / 2), Math.floor(board.depth / 2));
		} else {
			// Up on the screen is a different way on the board once it is turned.
			const quarter = this.stage.quarter;
			let dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
			let dr = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
			for (let i = 0; i < quarter; i++) [dc, dr] = [dr, -dc];
			cell = board.cell(cell.c + dc, cell.r + dr) ?? cell;
		}
		game.setKeyCursor(cell);
		if (game.selected) game.select(null);
		sound.play('hover');
		if (this.placing) {
			game.showGhost(null);
			this.previewPlacing();
		}
	}

	// ---------- Tutorial ----------

	private setTutorial(step: number): void {
		this.tutorial = step;
		if (step >= TUTORIAL.length) {
			save.tutorialDone = true;
			persist();
			this.tutorial = -1;
			this.hideTip();
			return;
		}
		const source = this.input.source;
		const verb = source === 'touch' ? 'Tap' : source === 'pad' ? 'Move with the stick and press A on' : source === 'key' ? 'Move with the arrows and press Enter on' : 'Click';
		const text = TUTORIAL[step]
			.replace('{Select}', verb)
			.replace('{wave}', source === 'pad' ? ' (Select)' : source === 'key' || source === 'mouse' ? ' (Space)' : '')
			.replace('{speed}', source === 'pad' ? ' (RT)' : source === 'touch' ? '' : ' (F)');
		if (!text) {
			this.hideTip();
			return;
		}
		el(this.tip, 'p').textContent = text;
		this.tip.hidden = false;
		this.placeTip();
		this.tip.classList.remove('show');
		void this.tip.offsetWidth;
		this.tip.classList.add('show');
		if (step === TUTORIAL.length - 1) {
			this.tipTimer = 7;
			save.tutorialDone = true;
			persist();
		}
	}

	private hideTip(): void {
		this.tip.hidden = true;
		this.tipTimer = 0;
	}

	// ---------- Screens ----------

	private openScreen(name: Screen, html: string): void {
		this.screen = name;
		this.screenEl.className = `screen screen-${name}`;
		this.screenEl.innerHTML = html;
		this.screenEl.hidden = false;
		this.screenEl.querySelectorAll<HTMLElement>('button, a').forEach((button) => {
			button.addEventListener('click', () => sound.play('click'));
			button.addEventListener('pointerenter', () => sound.play('hover'));
		});
		if (this.input.source === 'key' || this.input.source === 'pad') focusables(this.screenEl)[0]?.focus();
	}

	private closeScreen(): void {
		this.screen = null;
		this.screenEl.hidden = true;
		this.screenEl.innerHTML = '';
	}

	private screenAction(action: Action): void {
		switch (action) {
			case 'up':
			case 'down':
			case 'left':
			case 'right':
				moveFocus(this.screenEl, action);
				break;
			case 'prev':
				moveFocus(this.screenEl, 'left');
				break;
			case 'next':
				moveFocus(this.screenEl, 'right');
				break;
			case 'confirm': {
				const active = document.activeElement as HTMLElement | null;
				if (active && this.screenEl.contains(active) && !(active instanceof HTMLInputElement && active.type === 'range')) active.click();
				else focusables(this.screenEl)[0]?.focus();
				break;
			}
			case 'back':
				this.screenEl.querySelector<HTMLElement>('[data-back]')?.click();
				break;
			case 'pause':
				if (this.screen === 'pause') this.resume();
				break;
		}
	}

	private on(selector: string, handler: () => void): void {
		this.screenEl.querySelector(selector)?.addEventListener('click', handler);
	}

	private showLoading(): void {
		this.openScreen(
			'loading',
			`<div class="center">
				<div class="logo"><span>Crystal</span><span>Siege</span></div>
				<div class="bar"><i></i></div>
				<p class="muted">Loading the fleet…</p>
			</div>`,
		);
	}

	private showTitle(): void {
		this.hud.hidden = true;
		this.openScreen(
			'title',
			`<div class="center">
				<div class="logo big"><span>Crystal</span><span>Siege</span></div>
				<p class="tagline">The UFO fleet wants your Heart Crystal. Build towers. Hold the road.</p>
				<div class="menu">
					<button class="btn primary big" data-play>Play</button>
					<button class="btn" data-settings>Settings</button>
					<button class="btn" data-credits>Credits</button>
					<a class="btn ghost" href="../">Back to the arcade</a>
				</div>
				<p class="foot">3D models by Kenney (kenney.nl)</p>
			</div>`,
		);
		this.on('[data-play]', () => this.showMaps());
		this.on('[data-settings]', () => this.showSettings('title'));
		this.on('[data-credits]', () => this.showCredits());
	}

	private showMaps(): void {
		const cards = MAPS.map((map, i) => {
			const locked = i + 1 > save.unlocked && !this.debug;
			const stars = save.stars[map.id] ?? 0;
			const best = save.best[map.id];
			return `<button class="map-card ${map.theme}${locked ? ' locked' : ''}" data-map="${i}" ${locked ? 'disabled' : ''}>
				<span class="num">${i + 1}</span>
				<span class="name">${map.name}</span>
				<span class="blurb">${locked ? 'Win the map before to unlock.' : map.blurb}</span>
				<span class="meta">${map.waves.length} waves${map.paths.length > 1 ? ` · ${map.paths.length} roads` : ''}</span>
				<span class="stars">${[1, 2, 3].map((s) => `<i class="${s <= stars ? 'on' : ''}"></i>`).join('')}</span>
				<span class="best">${best ? `Best ${best.toLocaleString('en-US')}` : locked ? 'Locked' : 'Not played yet'}</span>
			</button>`;
		}).join('');
		this.openScreen(
			'maps',
			`<div class="center wide">
				<h1>Choose a map</h1>
				<div class="maps">${cards}</div>
				<div class="menu row"><button class="btn" data-back>Back</button></div>
			</div>`,
		);
		this.screenEl.querySelectorAll<HTMLButtonElement>('[data-map]').forEach((button) => {
			button.addEventListener('click', () => this.startMap(Number(button.dataset.map)));
		});
		this.on('[data-back]', () => this.showTitle());
		if (this.input.source !== 'mouse' && this.input.source !== 'touch') {
			const index = Math.min(save.unlocked, MAPS.length) - 1;
			this.screenEl.querySelector<HTMLElement>(`[data-map="${index}"]`)?.focus();
		}
	}

	private showSettings(back: Screen): void {
		this.settingsBack = back;
		const s = save.settings;
		const canFullscreen = document.fullscreenEnabled;
		this.openScreen(
			'settings',
			`<div class="center panel">
				<h1>Settings</h1>
				<label class="field"><span>Music</span><input type="range" min="0" max="1" step="0.1" value="${s.music}" data-music /></label>
				<label class="field"><span>Sound</span><input type="range" min="0" max="1" step="0.1" value="${s.sfx}" data-sfx /></label>
				<div class="field"><span>Screen shake</span><button class="btn small toggle" data-shake>${s.shake ? 'On' : 'Off'}</button></div>
				${canFullscreen ? `<div class="field"><span>Full screen</span><button class="btn small toggle" data-full>${document.fullscreenElement ? 'On' : 'Off'}</button></div>` : ''}
				<div class="field"><span>Progress</span><button class="btn small danger" data-reset>Reset</button></div>
				<div class="menu row"><button class="btn primary" data-back>Done</button></div>
			</div>`,
		);
		const music = el<HTMLInputElement>(this.screenEl, '[data-music]');
		const sfx = el<HTMLInputElement>(this.screenEl, '[data-sfx]');
		const apply = (): void => {
			s.music = Number(music.value);
			s.sfx = Number(sfx.value);
			sound.setVolumes(s.music, s.sfx);
			persist();
		};
		music.addEventListener('input', apply);
		sfx.addEventListener('input', () => {
			apply();
			sound.play('pop');
		});
		this.on('[data-shake]', () => {
			s.shake = !s.shake;
			this.stage.shakeEnabled = s.shake;
			if (s.shake) this.stage.addShake(0.2);
			el(this.screenEl, '[data-shake]').textContent = s.shake ? 'On' : 'Off';
			persist();
		});
		this.on('[data-full]', () => {
			const button = el(this.screenEl, '[data-full]');
			if (document.fullscreenElement) void document.exitFullscreen().then(() => (button.textContent = 'Off'));
			else void document.documentElement.requestFullscreen().then(() => (button.textContent = 'On')).catch(() => {});
		});
		let armed = false;
		this.on('[data-reset]', () => {
			const button = el(this.screenEl, '[data-reset]');
			if (!armed) {
				armed = true;
				button.textContent = 'Sure? Press again';
				return;
			}
			resetProgress();
			button.textContent = 'Done';
			button.setAttribute('disabled', '');
		});
		this.on('[data-back]', () => {
			if (this.settingsBack === 'pause') this.openPause();
			else this.showTitle();
		});
	}

	private showCredits(): void {
		this.openScreen(
			'credits',
			`<div class="center panel">
				<h1>Credits</h1>
				<p><b>3D models</b><br />Tower Defense Kit by Kenney (kenney.nl), CC0.</p>
				<p><b>Flags, effects, icons, sound and music</b><br />Made in code for this game.</p>
				<p><b>Crystal Siege</b><br />A game in the Cosmic Arcade.</p>
				<div class="menu row"><button class="btn primary" data-back>Back</button></div>
			</div>`,
		);
		this.on('[data-back]', () => this.showTitle());
	}

	private openPause(): void {
		if (!this.game || !this.playing || this.game.over) return;
		this.game.paused = true;
		this.setPlacing(null);
		this.openScreen(
			'pause',
			`<div class="center panel">
				<h1>Paused</h1>
				<p class="muted">${MAPS[this.mapIndex].name} · Wave ${this.game.wave} of ${this.game.totalWaves}</p>
				<div class="menu">
					<button class="btn primary big" data-resume>Resume</button>
					<button class="btn" data-restart>Restart map</button>
					<button class="btn" data-settings>Settings</button>
					<button class="btn" data-maps>Quit to maps</button>
					<a class="btn ghost" href="../">Back to the arcade</a>
				</div>
				<div class="keys">
					<p><kbd>1</kbd>–<kbd>4</kbd> build · <kbd>U</kbd> upgrade · <kbd>S</kbd> sell · <kbd>T</kbd> target · <kbd>Space</kbd> next wave · <kbd>F</kbd> speed · <kbd>Q</kbd> <kbd>E</kbd> turn the board (or drag with the right mouse button) · <kbd>Esc</kbd> back</p>
					<p>Gamepad: <kbd>A</kbd> select · <kbd>B</kbd> back · <kbd>X</kbd> upgrade · <kbd>Y</kbd> sell · <kbd>Select</kbd> next wave · <kbd>RT</kbd> speed · right stick turns the board</p>
				</div>
				<button class="hidden-back" data-back tabindex="-1" aria-hidden="true"></button>
			</div>`,
		);
		this.on('[data-resume]', () => this.resume());
		this.on('[data-back]', () => this.resume());
		this.on('[data-restart]', () => this.startMap(this.mapIndex));
		this.on('[data-settings]', () => this.showSettings('pause'));
		this.on('[data-maps]', () => this.quitToMaps());
	}

	private resume(): void {
		this.closeScreen();
		if (this.game) this.game.paused = false;
	}

	private showResults(result: Result, best: boolean): void {
		this.banner.className = 'banner';
		const next = MAPS[this.mapIndex + 1];
		const map = MAPS[this.mapIndex];
		this.openScreen(
			'results',
			`<div class="center panel ${result.won ? 'won' : 'lost'}">
				<h1>${result.won ? 'Victory!' : 'The crystal fell'}</h1>
				<p class="muted">${map.name} · ${result.won ? `${result.lives} lives left` : `Wave ${result.waves} of ${map.waves.length}`}</p>
				${result.won ? `<div class="big-stars">${[1, 2, 3].map((s) => `<i data-star="${s}" class="${s <= result.stars ? 'earn' : ''}"></i>`).join('')}</div>` : ''}
				<div class="score-row">
					<div><span>Score</span><b>${result.score.toLocaleString('en-US')}</b></div>
					<div><span>Best</span><b>${(save.best[map.id] ?? 0).toLocaleString('en-US')}</b></div>
					<div><span>UFOs down</span><b>${result.kills}</b></div>
				</div>
				${best ? '<p class="new-best">New best score!</p>' : ''}
				<div class="menu row">
					${result.won && next ? '<button class="btn primary" data-next>Next map</button>' : ''}
					<button class="btn ${result.won && next ? '' : 'primary'}" data-retry>${result.won ? 'Play again' : 'Try again'}</button>
					<button class="btn" data-back>Maps</button>
				</div>
			</div>`,
		);
		this.on('[data-next]', () => this.startMap(this.mapIndex + 1));
		this.on('[data-retry]', () => this.startMap(this.mapIndex));
		this.on('[data-back]', () => this.quitToMaps());
		this.screenEl.querySelectorAll<HTMLElement>('.big-stars i.earn').forEach((star, i) => {
			setTimeout(() => {
				star.classList.add('pop');
				sound.play('star');
			}, 400 + i * 350);
		});
	}

	// ---------- Debug helpers, for testing with ?debug ----------

	/** Plays a map at full speed with a simple bot and returns what happened in each wave. */
	async debugBot(index: number, options: object = {}): Promise<string[]> {
		const { runBot } = await import('./bot');
		this.startMap(index);
		const game = this.game!;
		game.gold = game.map.startGold;
		game.paused = false;
		return runBot(game, options);
	}

	debugPoint(c: number, r: number): THREE.Vector2 | null {
		if (!this.game) return null;
		return this.stage.toScreen(this.game.board.world(c, r));
	}
}
