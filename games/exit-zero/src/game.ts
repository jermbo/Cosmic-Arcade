import * as THREE from 'three';
import { runAction } from './actions.ts';
import { Audio } from './audio.ts';
import { Grid } from './core/grid.ts';
import { GameState, type StateData } from './core/state.ts';
import type { Action, ItemDef, LevelDef, NoteDef, StoryDef } from './core/types.ts';
import itemsData from './data/items.json';
import { FIRST_LEVEL, LEVELS } from './data/levels/index.ts';
import notesData from './data/notes.json';
import storyData from './data/story.json';
import { Input } from './input.ts';
import { Builder } from './render/builder.ts';
import { buildLevel } from './render/levelMesh.ts';
import { Lighting } from './render/lights.ts';
import { Particles } from './render/particles.ts';
import { Post } from './render/post.ts';
import { shared } from './render/psx.ts';
import { clearSave, cleared, loadSave, loadSettings, markCleared, saveSettings, writeSave, type Settings } from './save.ts';
import { LOUD, MOVE } from './tuning.ts';
import { UI } from './ui.ts';
import './world/components/index.ts';
import { Player } from './world/player.ts';
import { spawn } from './world/registry.ts';
import { World, type Host, type Interaction } from './world/world.ts';

const story = storyData as unknown as StoryDef;
const items = itemsData as Record<string, ItemDef>;
const notes = notesData as Record<string, NoteDef>;

type Mode = 'title' | 'play' | 'menu' | 'dying' | 'ending';

const tmpV = new THREE.Vector3();

export class Game {
	readonly post: Post;
	readonly scene = new THREE.Scene();
	readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 80);
	readonly input: Input;
	readonly ui: UI;
	readonly audio = new Audio();
	readonly player = new Player();
	readonly host: Host;
	settings: Settings;
	state = new GameState();
	level!: LevelDef;
	grid!: Grid;
	world!: World;
	lighting!: Lighting;
	private sparks = new Particles(220, true);
	private mist = new Particles(160, false);
	private mode: Mode = 'title';
	private checkpointId = '';
	private snapshot: StateData | null = null;
	private playTime = 0;
	private time = 0;
	private last = performance.now();
	private hold = 0;
	private holdKey = '';
	private holdDone = false;
	private flashOn = false;
	private flash = 0;
	private area = '';
	private dyingT = 0;
	private deathCause = '';
	private endingT = 0;
	private menuAt = 0;
	private fog = new THREE.Color();

	constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
		this.settings = loadSettings();
		this.post = new Post(canvas);
		this.input = new Input(canvas);
		this.host = this.makeHost();
		this.ui = new UI(uiRoot, story, items, notes, {
			newGame: () => this.newGame(),
			continueGame: () => this.continueGame(),
			resume: () => this.resume(),
			quitToTitle: () => this.toTitle(),
			retry: () => this.retry(),
			settingsChanged: (s) => this.applySettings(s),
			sound: (id) => this.audio.play(id),
			keypadWrong: () => {
				this.audio.play('keyErr');
				this.host.say('keypad.wrong');
			},
			readNote: (id) => (id ? this.ui.note(id, 'inventory') : this.ui.inventory(this.state)),
		});
		this.ui.setSettings(this.settings);
		this.scene.background = new THREE.Color(0, 0, 0);
		this.scene.add(this.sparks.points, this.mist.points);
		this.loadLevel(FIRST_LEVEL);
		this.applySettings(this.settings);
		addEventListener('resize', () => this.resize());
		this.resize();
		this.input.onLockChange = (locked) => {
			if (!locked && this.mode === 'play' && this.ui.screen === 'none' && !this.input.padActive) {
				this.pause();
			}
		};
		canvas.addEventListener('click', () => {
			if (this.mode === 'play' && this.ui.screen === 'none') this.input.lock();
		});
		// the first click anywhere starts the sound
		addEventListener('pointerdown', () => this.audio.start(), { once: true });
		addEventListener('keydown', () => this.audio.start(), { once: true });
		this.toTitle();
		requestAnimationFrame((t) => this.frame(t));
	}

	// --- setup ---

	private loadLevel(id: string): void {
		const level = LEVELS[id];
		this.level = level;
		this.grid = new Grid(level);
		const visual = buildLevel(level, this.grid);
		this.lighting = new Lighting(level, visual.lights, visual.zoneIndex);
		const statics = new Builder();
		this.world = new World({
			level,
			grid: this.grid,
			state: this.state,
			host: this.host,
			lighting: this.lighting,
			statics,
			particles: { sparks: this.sparks, mist: this.mist },
			player: this.player,
		});
		for (const [ch, m] of visual.waterMaterials) this.world.waterMaterials.set(ch, m);
		for (const def of level.entities) spawn(def, this.world);
		this.scene.add(visual.group, this.world.root, statics.build().group, this.player.model);
		this.fog.setRGB(...level.fog.color);
		shared.uFogNear.value = level.fog.near;
		shared.uFogFar.value = level.fog.far;
		this.player.onStep = (kind, loud) => this.audio.step(kind, loud);
	}

	private makeHost(): Host {
		const t = (key: string) => story.text[key] ?? key;
		return {
			t,
			say: (key) => this.ui.toast(t(key)),
			sound: (id, at) => this.audio.play(id, at),
			loop: (id, on, at, level) => this.audio.loop(id, on && this.mode !== 'title', at, level),
			run: (actions) => this.run(actions),
			readNote: (id) => this.openMenu(() => this.ui.note(id, 'none')),
			openKeypad: (code, onSolve) =>
				this.openMenu(() =>
					this.ui.keypadScreen(code, () => {
						onSolve();
						this.resume();
					}),
				),
			die: (cause) => this.die(cause),
			ending: () => this.ending(),
			itemName: (id) => items[id]?.name ?? id,
		};
	}

	run(actions: Action[] | undefined): void {
		for (const a of actions ?? []) runAction(a, this);
	}

	private applySettings(s: Settings): void {
		this.settings = s;
		saveSettings(s);
		this.audio.volumes = { master: s.master, music: s.music, sfx: s.sfx };
		this.audio.applyVolumes();
		this.camera.fov = s.fov;
		this.post.lines = s.lines;
		this.post.crt = s.crt;
		this.resize();
	}

	private resize(): void {
		this.post.resize(this.camera);
		shared.uAffine.value = this.settings.wobble ? 1 : 0;
		if (!this.settings.wobble) shared.uSnap.value.set(0, shared.uSnap.value.y);
	}

	// --- flow ---

	private freshState(): void {
		this.state.load({ flags: [...this.level.initialFlags], vars: {}, inventory: [...this.level.startItems], notes: [] });
	}

	private syncWorld(): void {
		this.grid.blocked.clear();
		for (const c of this.world.components) c.sync?.();
		this.lighting.snap(this.state);
		this.sparks.clear();
		this.mist.clear();
		this.audio.stopLoops();
	}

	private spawnAt(id: string): void {
		const spot = this.level.checkpoints[id] ?? this.level.checkpoints[this.level.start];
		const p = this.world.pos(spot.at);
		this.player.place(p.x, p.z, spot.yaw);
		this.area = '';
		this.flashOn = false;
	}

	private toTitle(): void {
		this.mode = 'title';
		this.input.unlock();
		this.ui.showHud(false);
		this.ui.prompt(null);
		this.ui.lookHint(false);
		this.ui.fade(0);
		this.post.fade = 0;
		this.audio.silence(false);
		this.freshState();
		this.syncWorld();
		this.player.alive = false;
		this.player.model.visible = false;
		const save = loadSave();
		const c = cleared();
		this.ui.title(!!save, c ? c.time : null);
		this.audio.setMusic('title');
		this.audio.setAmbience(0.5, 0.5, false);
	}

	private newGame(): void {
		this.audio.start();
		clearSave();
		this.freshState();
		this.syncWorld();
		this.spawnAt(this.level.start);
		this.playTime = 0;
		this.checkpoint(this.level.start, true);
		this.mode = 'menu';
		this.audio.setMusic('none');
		this.audio.setAmbience(0.25, 0.3, false);
		this.ui.intro(story.intro, () => this.resume());
	}

	private continueGame(): void {
		const save = loadSave();
		if (!save) return this.newGame();
		this.audio.start();
		this.state.load(save.state);
		this.syncWorld();
		this.checkpointId = save.checkpoint;
		this.snapshot = save.state;
		this.playTime = save.time;
		this.spawnAt(save.checkpoint);
		this.resume();
	}

	private resume(): void {
		this.ui.close();
		this.ui.showHud(true);
		this.mode = 'play';
		this.player.alive = true;
		this.input.lock();
	}

	private openMenu(show: () => void): void {
		this.ui.lookHint(false);
		this.mode = 'menu';
		this.menuAt = this.time;
		this.input.unlock();
		this.ui.prompt(null);
		show();
	}

	private pause(): void {
		this.openMenu(() => this.ui.pause());
	}

	checkpoint(id: string, quiet = false): void {
		this.checkpointId = id;
		this.snapshot = this.state.toData();
		writeSave({ v: 1, level: this.level.id, checkpoint: id, state: this.snapshot, time: this.playTime });
		if (!quiet) {
			this.ui.saved();
			this.audio.play('save');
		}
	}

	tutorial(id: string): void {
		const def = story.tutorial[id];
		if (!def || this.settings.tips.includes(id)) return;
		this.settings.tips.push(id);
		saveSettings(this.settings);
		this.ui.tip(def);
	}

	private die(cause: string): void {
		if (!this.player.alive || this.mode !== 'play') return;
		this.player.alive = false;
		this.mode = 'dying';
		this.dyingT = 0;
		this.deathCause = cause;
		this.ui.prompt(null);
		this.ui.lookHint(false);
		this.audio.play(cause === 'water' ? 'shock' : 'sting');
		this.audio.play('death');
	}

	private retry(): void {
		if (this.snapshot) this.state.load(this.snapshot);
		else this.freshState();
		this.syncWorld();
		this.spawnAt(this.checkpointId);
		this.post.fade = 0;
		this.post.noise = 0;
		this.ui.fade(0);
		this.resume();
	}

	private ending(): void {
		if (this.mode !== 'play') return;
		this.mode = 'ending';
		this.endingT = 0;
		this.ui.prompt(null);
		this.ui.lookHint(false);
		this.ui.showHud(false);
		this.audio.setMusic('none');
		this.audio.setAmbience(0, 0, false);
		this.audio.stopLoops();
		this.audio.play('ending');
		clearSave();
		markCleared(this.playTime);
	}

	// --- frame ---

	private frame(now: number): void {
		requestAnimationFrame((t) => this.frame(t));
		const dt = Math.min(0.05, (now - this.last) / 1000);
		this.last = now;
		this.time += dt;
		shared.uTime.value = this.time;
		this.input.poll();
		this.ui.device = this.input.device;
		this.handleInput(dt);

		if (this.mode === 'play') {
			this.playTime += dt;
			this.updatePlay(dt);
		} else if (this.mode === 'title') {
			this.updateTitle();
		} else if (this.mode === 'dying') {
			this.updateDying(dt);
		} else if (this.mode === 'ending') {
			this.updateEnding(dt);
		}

		// the world keeps running behind menus, so lights still flicker
		if (this.mode !== 'menu') {
			for (const c of this.world.components) c.update?.(dt, this.time);
		}
		this.world.time = this.time;
		this.sparks.update(dt);
		this.mist.update(dt);
		this.lighting.update(dt, this.time, this.state, this.camera.position);
		this.updateFlashlight(dt);
		this.updateFog(dt);
		this.audio.setListener(this.camera.position, this.camera.getWorldDirection(tmpV));
		this.audio.update(dt);
		this.ui.tick(dt);
		this.post.render(this.scene, this.camera, this.time);
		this.input.endFrame();
	}

	private handleInput(dt: number): void {
		const inp = this.input;
		const ui = this.ui;
		if (this.mode === 'play') {
			if (inp.pressed('pause')) return this.pause();
			if (inp.pressed('inventory')) return this.openMenu(() => ui.inventory(this.state));
			if (inp.pressed('flashlight')) {
				this.flashOn = !this.flashOn;
				this.audio.play('flashlight');
			}
			if (inp.pressed('view')) {
				this.settings.view = this.settings.view === 'first' ? 'third' : 'first';
				saveSettings(this.settings);
				ui.toast(this.settings.view === 'first' ? 'First person' : 'Third person');
			}
			// look
			const sens = this.settings.sensitivity;
			const inv = this.settings.invertY ? -1 : 1;
			this.player.yaw += inp.mx * MOVE.mouse * sens + inp.stick.rx * MOVE.stick * sens * dt;
			this.player.pitch -= (inp.my * MOVE.mouse * sens + inp.stick.ry * MOVE.stick * sens * dt * 0.8) * inv;
			this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch));
			ui.lookHint(!inp.locked && !inp.padActive);
			return;
		}
		if (this.mode !== 'menu' && this.mode !== 'title' && !(this.mode === 'ending' && ui.screen === 'ending')) return;
		if (ui.screen === 'keypad') {
			if (inp.typed.length) {
				(document.activeElement as HTMLElement | null)?.blur();
				ui.typeDigits(inp.typed);
			}
			if (inp.pressed('ok') && inp.device === 'keys') ui.submitKeypad();
		}
		if (ui.screen === 'inventory' && inp.pressed('inventory')) return this.resume();
		if (ui.screen === 'note' && inp.pressed('interact')) {
			ui.goBack();
			return;
		}
		if (inp.pressed('pause') || (inp.device === 'keys' && inp.pressed('back') && ui.screen !== 'keypad')) {
			// ignore the Esc that also released the pointer
			if (this.time - this.menuAt > 0.3) ui.goBack();
			return;
		}
		ui.nav(inp);
	}

	private updatePlay(dt: number): void {
		const p = this.player;
		const inp = this.input;
		p.update(dt, this.world, inp.move(), inp.held('sprint'), this.settings.bob);
		this.updateCamera(dt);
		this.updateTarget(dt);
		this.updateArea();
		this.ui.loud(p.noiseShow > 0 && p.lastNoise >= LOUD);
	}

	private updateCamera(dt: number): void {
		const p = this.player;
		const cam = this.camera;
		cam.rotation.set(p.pitch, -p.yaw, 0, 'YXZ');
		if (this.settings.view === 'first') {
			cam.position.copy(p.eye);
			p.model.visible = false;
			return;
		}
		// third person: behind the shoulder, pulled in by walls and the ceiling
		const pivot = tmpV.set(p.pos.x, p.pos.y + 1.55, p.pos.z);
		const back = new THREE.Vector3(0, 0, 1).applyEuler(cam.rotation);
		const right = new THREE.Vector3(1, 0, 0).applyEuler(cam.rotation);
		const zone = this.grid.zoneAt(p.pos.x, p.pos.z);
		const ceiling = (zone?.height ?? 2.6) - 0.15;
		let dist = MOVE.thirdDistance;
		const test = new THREE.Vector3();
		for (let d = 0.2; d <= MOVE.thirdDistance; d += 0.1) {
			test.copy(pivot).addScaledVector(back, d).addScaledVector(right, 0.35 * (d / MOVE.thirdDistance));
			const [cx, cz] = this.grid.cellOf(test.x, test.z);
			const hitWall = this.grid.solid(cx, cz) || test.y > ceiling || test.y < 0.2;
			if (hitWall) {
				dist = Math.max(0.2, d - 0.25);
				break;
			}
		}
		cam.position.copy(pivot).addScaledVector(back, dist).addScaledVector(right, 0.35 * (dist / MOVE.thirdDistance));
		p.model.visible = dist > 0.7;
		void dt;
	}

	private updateTarget(dt: number): void {
		const eye = this.player.eye;
		const dir = this.camera.getWorldDirection(new THREE.Vector3());
		const third = this.settings.view === 'third';
		let best: Interaction | null = null;
		let bestScore = -Infinity;
		const to = new THREE.Vector3();
		for (const c of this.world.components) {
			const list = c.interactions?.();
			if (!list) continue;
			for (const it of list) {
				to.copy(it.pos).sub(eye);
				const d = to.length();
				if (d > (it.range ?? 2.2) + (third ? 0.4 : 0)) continue;
				const cos = d < 0.01 ? 1 : to.dot(dir) / d;
				if (cos < MOVE.interactCos - (d < 1 ? 0.15 : 0)) continue;
				if (!this.grid.lineClear(eye.x, eye.z, it.pos.x, it.pos.z, false)) continue;
				const score = cos - d * 0.06;
				if (score > bestScore) {
					bestScore = score;
					best = it;
				}
			}
		}
		const key = best ? `${best.label}@${best.pos.x.toFixed(2)},${best.pos.z.toFixed(2)}` : '';
		if (key !== this.holdKey) {
			this.hold = 0;
			this.holdKey = key;
		}
		const held = this.input.held('interact');
		if (!held) this.holdDone = false;
		if (best) {
			best.onHover?.();
			if (best.hold && !best.disabled) {
				if (held && !this.holdDone) {
					this.hold += dt / best.hold;
					if (Math.random() < dt * 8) this.audio.play('click', best.pos);
					if (this.hold >= 1) {
						this.hold = 0;
						this.holdDone = true;
						best.use();
					}
				} else this.hold = Math.max(0, this.hold - dt * 2);
			} else if (this.input.pressed('interact')) best.use();
		}
		this.ui.prompt(this.mode === 'play' && best ? best : null, this.hold);
	}

	private updateArea(): void {
		const zone = this.grid.zoneAt(this.player.pos.x, this.player.pos.z);
		if (!zone || !zone.area) return;
		const lit = !zone.lights?.cond || this.state.check(zone.lights.cond);
		const threat = this.world.threat;
		const hunted = threat && (threat.mode === 'hunt' || threat.mode === 'chase' || threat.mode === 'alert');
		this.audio.setAmbience(zone.hum * (lit ? 1 : 0.3), zone.water ? 3 : zone.step === 'carpet' ? 0.6 : 1.4, zone.step !== 'carpet');
		if (zone.area === this.area) return;
		this.area = zone.area;
		const def = story.areas[zone.area];
		if (!def) return;
		if (!hunted) this.audio.setMusic(def.music);
		const seen = `seen.${zone.area}`;
		if (!this.state.flag(seen)) {
			this.state.setFlag(seen);
			this.ui.banner(def.name, def.blurb);
		}
	}

	private updateFlashlight(dt: number): void {
		const want = this.flashOn && (this.mode === 'play' || this.mode === 'menu' || this.mode === 'dying') ? 1 : 0;
		this.flash += (want - this.flash) * Math.min(1, dt * 18);
		shared.uFlashOn.value = this.flash;
		const dir = this.camera.getWorldDirection(new THREE.Vector3());
		shared.uFlashDir.value.copy(dir);
		const p = this.player;
		if (this.settings.view === 'first') {
			const right = new THREE.Vector3(1, 0, 0).applyEuler(this.camera.rotation);
			shared.uFlashPos.value.copy(p.eye).addScaledVector(right, 0.18).add(new THREE.Vector3(0, -0.15, 0));
		} else {
			shared.uFlashPos.value.set(p.pos.x, p.pos.y + 1.3, p.pos.z).addScaledVector(dir, 0.3);
		}
	}

	private updateFog(dt: number): void {
		const zone = this.grid.zoneAt(this.camera.position.x, this.camera.position.z);
		const want = zone?.fog ?? this.level.fog.color;
		const k = Math.min(1, dt * 1.5);
		this.fog.r += (want[0] - this.fog.r) * k;
		this.fog.g += (want[1] - this.fog.g) * k;
		this.fog.b += (want[2] - this.fog.b) * k;
		shared.uFogColor.value.copy(this.fog);
		(this.scene.background as THREE.Color).copy(this.fog);
	}

	private updateTitle(): void {
		// a slow drift down the long hall, past the gate
		const t = this.time * 0.05;
		const x = 7 + (Math.sin(t) * 0.5 + 0.5) * 22;
		this.camera.position.set(x, 1.55 + Math.sin(this.time * 0.7) * 0.02, 11);
		const yaw = Math.PI / 2 - 0.4 + Math.sin(this.time * 0.09) * 1.1;
		this.camera.rotation.set(-0.04 + Math.sin(this.time * 0.13) * 0.05, -yaw, 0, 'YXZ');
		this.player.pos.set(-100, 0, -100);
	}

	private updateDying(dt: number): void {
		this.dyingT += dt;
		const p = this.player;
		const threat = this.world.threat;
		if (this.deathCause === 'creature' && threat) {
			// turn to face the light
			const to = threat.pos.clone().setY(2.3).sub(p.eye);
			const wantYaw = Math.atan2(to.x, -to.z);
			const wantPitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
			let dy = wantYaw - p.yaw;
			while (dy > Math.PI) dy -= Math.PI * 2;
			while (dy < -Math.PI) dy += Math.PI * 2;
			p.yaw += dy * Math.min(1, dt * 8);
			p.pitch += (wantPitch - p.pitch) * Math.min(1, dt * 8);
		} else {
			p.pitch += Math.sin(this.dyingT * 50) * 0.01;
		}
		p.eye.y = Math.max(0.4, p.eye.y - dt * (this.dyingT > 0.6 ? 1.4 : 0));
		this.camera.position.copy(p.eye);
		this.camera.rotation.set(p.pitch, -p.yaw, this.dyingT * 0.3, 'YXZ');
		this.post.noise = Math.min(0.25, this.dyingT * 0.3);
		this.post.fadeColor.setRGB(this.dyingT < 0.4 ? 1 : 0.25, this.dyingT < 0.4 ? 1 : 0.02, this.dyingT < 0.4 ? 1 : 0.02);
		this.post.fade = this.dyingT < 0.15 ? this.dyingT / 0.15 : this.dyingT < 0.4 ? 1 : Math.min(0.85, 0.3 + (this.dyingT - 0.4) * 0.4);
		if (this.dyingT > 1.8 && this.ui.screen !== 'dead') {
			this.mode = 'menu';
			this.menuAt = this.time;
			this.input.unlock();
			this.audio.stopLoops();
			this.ui.dead(story.death[this.deathCause] ?? '');
		}
	}

	private updateEnding(dt: number): void {
		this.endingT += dt;
		const p = this.player;
		// step forward through the door
		p.pos.addScaledVector(new THREE.Vector3(Math.sin(p.yaw), 0, -Math.cos(p.yaw)), dt * 0.6 * Math.max(0, 1 - this.endingT / 3));
		this.camera.position.set(p.pos.x, p.eye.y, p.pos.z);
		this.post.fadeColor.setRGB(0.86, 1, 0.9);
		this.post.fade = Math.min(1, this.endingT / 2.5);
		if (this.endingT > 2.6 && this.ui.screen !== 'ending') {
			this.post.fade = 1;
			this.input.unlock();
			this.ui.ending({ time: this.playTime, notes: this.state.notes.length, total: Object.keys(notes).length });
		}
	}
}
