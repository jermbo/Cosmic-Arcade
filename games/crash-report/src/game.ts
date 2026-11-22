import * as THREE from 'three';
import { Sound } from './audio.ts';
import { CONFIG } from './config.ts';
import { Input } from './input.ts';
import { formatMoney, goalDone, LEVELS } from './levels/index.ts';
import type { RunStats } from './levels/index.ts';
import type { LevelDef } from './levels/types.ts';
import { CameraRig } from './render/camera.ts';
import { Fx } from './render/fx.ts';
import { View } from './render/view.ts';
import { clearSave, levelSave, loadSave, storeSave } from './save.ts';
import type { SaveData } from './save.ts';
import { newReplay, packReplay, quantize, readFrame, record, replayVersion, unpackReplay } from './sim/replay.ts';
import type { Replay } from './sim/replay.ts';
import { Sim } from './sim/sim.ts';
import type { SimEvent, StepInput } from './sim/sim.ts';
import { Ui } from './ui.ts';

/** Joins the parts: it runs the loop, feeds the sim, and turns what happens into pictures and sound. */

type Mode = 'menu' | 'run' | 'replay';

const DEBRIS_TONES = [0xe9c46a, 0x2a9d8f, 0xe76f51, 0xf4f1de, 0x8ecae6, 0x9aa0aa];

export class Game {
	private view: View;
	private fx: Fx;
	private rig: CameraRig;
	private sound = new Sound();
	private input: Input;
	private ui: Ui;
	private save: SaveData;

	private mode: Mode = 'menu';
	private sim!: Sim;
	private levelIndex = 0;
	private level: LevelDef = LEVELS[0];
	private recording: Replay | undefined;
	private playback: Replay | undefined;
	private playbackFrame = 0;

	private paused = false;
	private last = 0;
	private acc = 0;
	private timeScale = 1;
	private hitPause = 0;
	private hitPauseCooldown = 0;
	private impactTimer = 0;
	private blastSlow = 0;
	private endTimer = -1;
	private resultsShown = false;
	private aim = 0;
	private wantLaunch = false;
	private wantBreaker = false;
	private pulse = 0;
	private tickTimer = 0;
	private stepInput: StepInput = { aim: 0, launch: false, steer: 0, nx: 0, nz: 0, breaker: false };
	private smokeTimers: number[] = [];
	private burnLeft: number[] = [];

	private car = new THREE.Vector3();
	private hotspot = new THREE.Vector3();
	private focus = new THREE.Vector3();
	private spread = 0;
	private hits = 0;
	private right = new THREE.Vector3();
	private forward = new THREE.Vector3();
	private scratch = new THREE.Vector3();

	constructor(canvas: HTMLCanvasElement) {
		this.save = loadSave();
		this.view = new View(canvas);
		this.fx = new Fx(this.view.scene);
		this.rig = new CameraRig(this.view.camera);
		this.input = new Input(canvas);
		this.input.onFirstInput = () => this.sound.unlock();
		window.addEventListener('pointerdown', () => this.sound.unlock());

		this.ui = new Ui(
			{
				play: (index) => this.startRun(index),
				watch: (index) => this.startReplay(index),
				continueGame: () => this.startRun(this.nextToPlay()),
				retry: () => this.startRun(this.levelIndex),
				next: () => this.startRun(Math.min(LEVELS.length - 1, this.levelIndex + 1)),
				resume: () => this.setPaused(false),
				pause: () => this.setPaused(true),
				toTitle: () => this.toMenu('title'),
				toSelect: () => this.toMenu('select'),
				launch: () => {
					this.wantLaunch = true;
				},
				breaker: () => {
					this.wantBreaker = true;
				},
				settingsChanged: () => this.applySettings(true),
				eraseSave: () => {
					this.save = clearSave();
					this.ui.setSave(this.save);
					this.applySettings(false);
					this.toMenu('title');
				},
				tutorialClosed: () => {
					if (this.mode !== 'run') return;
					this.save.tutorialDone = true;
					storeSave(this.save);
				},
				sound: (kind) => this.sound.ui(kind),
			},
			this.save,
		);

		this.applySettings(false);
		window.addEventListener('resize', () => this.resize());
		document.addEventListener('visibilitychange', () => {
			if (document.hidden && this.mode !== 'menu' && this.ui.screen === 'none') this.setPaused(true);
		});
		this.resize();
		this.loadLevel(this.nextToPlay());
		this.toMenu('title');
	}

	start(): void {
		this.last = performance.now();
		const loop = (now: number): void => {
			this.frame(now);
			requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
	}

	// --- Moving between the menu, a run and a replay ---

	private unlocked(): number {
		let count = 1;
		for (const level of LEVELS) {
			if (!this.save.levels[level.id]?.goals.some(Boolean)) break;
			count++;
		}
		return Math.min(LEVELS.length, count);
	}

	private nextToPlay(): number {
		return this.unlocked() - 1;
	}

	private loadLevel(index: number): void {
		if (this.sim) this.sim.free();
		this.levelIndex = index;
		this.level = LEVELS[index];
		this.sim = new Sim(this.level);
		this.view.loadLevel(this.level, this.sim);
		this.fx.clear();
		this.rig.cut();
		this.rig.setBuildings(this.level.buildings);
		this.smokeTimers = this.sim.entities.map(() => 0);
		this.burnLeft = this.sim.entities.map(() => 0);
		this.acc = 0;
		this.timeScale = 1;
		this.hitPause = 0;
		this.impactTimer = 0;
		this.blastSlow = 0;
		this.endTimer = -1;
		this.resultsShown = false;
		this.aim = 0;
		this.wantLaunch = false;
		this.wantBreaker = false;
		this.recording = undefined;
		this.playback = undefined;
		this.playbackFrame = 0;
		this.spread = 0;
		this.hits = 0;
		this.hotspot.set(0, 0, 0);
		this.focus.set(0, 0, 0);
		this.paused = false;
	}

	private toMenu(screen: 'title' | 'select'): void {
		if (this.mode !== 'menu') {
			this.loadLevel(this.levelIndex);
			this.mode = 'menu';
		}
		this.paused = false;
		this.rig.setMode('menu');
		this.ui.setHud(false);
		if (screen === 'select') this.ui.buildSelect(this.unlocked());
		this.ui.show(screen);
		this.sound.setMusic('menu');
		this.sound.engine(false, 0);
	}

	private startRun(index: number): void {
		this.loadLevel(index);
		this.mode = 'run';
		this.recording = newReplay(this.level);
		this.rig.setMode('aim');
		this.rig.cut();
		this.ui.setHud(true, this.level, false);
		this.ui.show('none');
		this.sound.setMusic('menu');
		this.sound.engine(false, 0);
		if (!this.save.tutorialDone) {
			this.ui.setDevice(this.input.device);
			this.ui.openTutorial();
		}
	}

	private startReplay(index: number): void {
		const saved = this.save.levels[LEVELS[index].id]?.replay;
		if (!saved || saved.version !== replayVersion(LEVELS[index])) {
			this.startRun(index);
			return;
		}
		this.loadLevel(index);
		this.mode = 'replay';
		this.playback = unpackReplay(saved);
		// Run the aim phase at once, with no picture, so the traffic is where it was.
		const input = this.stepInput;
		input.aim = this.playback.aim / 100;
		input.launch = false;
		input.steer = 0;
		input.nx = 0;
		input.nz = 0;
		input.breaker = false;
		for (let i = 0; i < this.playback.aimSteps; i++) this.sim.step(input);
		this.sim.events.length = 0;
		this.aim = this.playback.aim / 100;
		this.view.sync(1);
		this.rig.setMode('aim');
		this.rig.cut();
		this.ui.setHud(true, this.level, true);
		this.ui.show('none');
		this.sound.setMusic('menu');
	}

	private setPaused(paused: boolean): void {
		if (this.mode === 'menu') return;
		if (paused && (this.ui.screen !== 'none' || this.resultsShown)) return;
		this.paused = paused;
		this.ui.show(paused ? 'pause' : 'none');
		if (paused) this.sound.engine(false, 0);
		this.last = performance.now();
	}

	private applySettings(store: boolean): void {
		const s = this.save.settings;
		this.sound.setVolumes(s.master, s.sfx, s.music);
		this.rig.shakeScale = s.shake;
		if (store) storeSave(this.save);
	}

	private resize(): void {
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.view.resize(width, height);
		const phone = window.matchMedia('(pointer: coarse)').matches && height > width && width < 700;
		const rotate = document.getElementById('rotate');
		if (rotate) rotate.hidden = !phone;
		if (phone) this.setPaused(true);
	}

	// --- One frame ---

	private frame(now: number): void {
		const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
		this.last = now;
		this.pulse += dt;
		this.input.update(dt);
		this.input.menuOpen = this.ui.screen !== 'none';
		this.ui.setDevice(this.input.device);
		this.readMenuInput();

		const frozen = this.paused || this.ui.screen === 'tutorial' || this.ui.screen === 'pause' || (this.ui.screen === 'settings' && this.mode !== 'menu');
		if (!frozen) this.advance(dt);

		this.view.setLights(this.sim);
		this.view.sync(this.acc / CONFIG.physics.step);
		const mesh = this.view.meshOf(this.sim.player);
		this.car.copy(mesh.position);
		// In the aim phase the body does not turn, so the view turns the car to the aim.
		if (this.sim.phase === 'aim' && this.mode !== 'menu') mesh.rotation.set(0, ((this.level.launch.heading + this.aim) * Math.PI) / 180, 0);
		this.updateCamera(dt);
		this.view.setAim(this.mode !== 'menu' && this.sim.phase === 'aim', this.car.x, this.car.z, this.level.launch.heading + this.aim, this.pulse);
		if (this.mode !== 'menu') this.updateHud(dt);
		this.view.render();
		this.input.endFrame();
	}

	private readMenuInput(): void {
		const input = this.input;
		if (this.ui.screen !== 'none') {
			for (const direction of ['up', 'down', 'left', 'right'] as const) {
				if (input.take(direction)) this.ui.move(direction);
			}
			if (input.device === 'gamepad' && input.take('confirm')) this.ui.confirm();
			if (input.take('back')) this.ui.back();
			if (this.ui.screen === 'results' && input.take('retry')) this.startRun(this.levelIndex);
			return;
		}
		if (this.mode === 'menu') return;
		if (input.take('pause')) {
			if (this.mode === 'replay') this.toMenu('select');
			else this.setPaused(true);
			return;
		}
		if (input.take('retry')) {
			this.sound.ui('select');
			this.startRun(this.levelIndex);
			return;
		}
		const action = input.take('action');
		const click = input.take('confirm');
		if (this.mode !== 'run') return;
		if (this.sim.phase === 'aim' && (action || click)) this.wantLaunch = true;
		if (this.sim.phase === 'crash' && action) this.wantBreaker = true;
	}

	private advance(dt: number): void {
		const feel = CONFIG.feel;
		this.hitPauseCooldown -= dt;
		if (this.hitPause > 0) {
			this.hitPause -= dt;
			return;
		}

		let target = 1;
		if (this.impactTimer > 0) {
			this.impactTimer -= dt;
			target = feel.impactTimeScale;
			if (this.impactTimer <= 0 && this.rig.mode === 'impact') this.rig.setMode('crash');
		}
		if (this.blastSlow > 0) {
			this.blastSlow -= dt;
			target = Math.min(target, feel.blastTimeScale);
		}
		if (this.sim.aftertouchActive) target = Math.min(target, CONFIG.aftertouch.timeScale);
		if (this.sim.phase === 'done') target = Math.min(target, 0.55);
		this.timeScale += (target - this.timeScale) * Math.min(1, dt * (target < this.timeScale ? 18 : 6));
		this.sound.setSlow(this.timeScale);

		const step = CONFIG.physics.step;
		this.acc += dt * this.timeScale;
		let steps = 0;
		while (this.acc >= step) {
			if (steps >= CONFIG.physics.maxStepsPerFrame) {
				this.acc = 0;
				break;
			}
			this.stepOnce();
			this.acc -= step;
			steps++;
			if (this.hitPause > 0) break;
		}

		const simDt = dt * this.timeScale;
		this.emitWreckFx(simDt);
		this.fx.update(simDt);

		const player = this.sim.player;
		this.sound.engine(this.sim.phase === 'approach', Math.min(1, player.speedBefore / this.level.launch.speed));

		if (this.sim.settleLeft >= 0 && this.mode === 'run') {
			this.tickTimer -= dt;
			if (this.tickTimer <= 0) {
				this.tickTimer = 0.5;
				this.sound.tick();
			}
		}
		if (this.endTimer >= 0 && !this.resultsShown) {
			this.endTimer -= dt;
			if (this.endTimer < 0) this.finishRun();
		}
	}

	private stepOnce(): void {
		const sim = this.sim;
		const input = this.stepInput;
		const phase = sim.phase;
		input.aim = this.aim;
		input.launch = false;
		input.steer = 0;
		input.nx = 0;
		input.nz = 0;
		input.breaker = false;

		if (this.mode === 'replay' && this.playback) {
			if (phase !== 'done' && !readFrame(this.playback, this.playbackFrame, phase === 'crash', input)) {
				// The saved inputs ran out before the end: drive on with no input.
				input.aim = this.playback.aim / 100;
			}
			if (phase !== 'done') this.playbackFrame++;
		} else if (this.mode === 'run') {
			const step = CONFIG.physics.step;
			if (phase === 'aim') {
				const arc = this.level.launch.arc;
				if (this.input.mouseAim !== undefined) this.aim = -this.input.mouseAim * arc;
				this.aim -= this.input.x * CONFIG.aim.keyRate * step;
				this.aim -= this.input.touchAim;
				this.input.touchAim = 0;
				this.aim = Math.max(-arc, Math.min(arc, this.aim));
				input.aim = this.aim;
				input.launch = this.wantLaunch;
				this.wantLaunch = false;
			} else if (phase === 'approach') {
				input.steer = -(this.input.x !== 0 ? this.input.x : this.input.dragX);
			} else if (phase === 'crash') {
				const px = this.input.x !== 0 || this.input.y !== 0 ? this.input.x : this.input.dragX;
				const py = this.input.x !== 0 || this.input.y !== 0 ? this.input.y : this.input.dragY;
				if (px !== 0 || py !== 0) {
					this.rig.groundAxes(this.right, this.forward);
					input.nx = this.right.x * px + this.forward.x * py;
					input.nz = this.right.z * px + this.forward.z * py;
				}
				input.breaker = this.wantBreaker;
				this.wantBreaker = false;
			}
			quantize(input);
			if (this.recording) record(this.recording, input, phase);
		}

		sim.step(input);
		if (sim.events.length > 0) {
			for (const event of sim.events) this.onEvent(event);
			sim.events.length = 0;
		}
	}

	// --- What the player sees and hears when something happens ---

	private onEvent(event: SimEvent): void {
		if (this.mode === 'menu') return;
		const feel = CONFIG.feel;
		switch (event.type) {
			case 'launch':
				this.sound.launch();
				this.sound.setMusic('run');
				this.rig.setMode('chase');
				break;

			case 'firstHit':
				this.impactTimer = feel.impactCamTime;
				this.rig.setMode('impact');
				this.rig.addShake(0.7);
				this.sound.slowDown();
				this.hotspot.set(event.x, 0, event.z);
				this.pause(feel.bigHitPause);
				break;

			case 'wreck': {
				const tone = DEBRIS_TONES[event.id % DEBRIS_TONES.length];
				this.fx.debris(event.x, event.y, event.z, event.bonus ? 16 : 9, 8, tone);
				this.fx.sparks(event.x, event.y, event.z, 14, 11);
				this.fx.smoke(event.x, event.y + 0.5, event.z, 2, 0.6, 0.6);
				this.sound.impact(event.bonus ? 0.9 : 0.6);
				this.sound.cash(event.mult);
				this.rig.addShake(event.bonus ? 0.5 : 0.3);
				this.popAt(event.x, event.y + 1.5, event.z, `+${formatMoney(event.money)}`, event.bonus ? `${event.label}! ×${event.mult}` : event.mult > 1 ? `×${event.mult}` : '', event.bonus ? 'bonus' : 'hit');
				this.pullHotspot(event.x, event.z);
				if (this.sim.chain > 0 && this.sim.chain % 5 === 0) this.ui.flash(`${this.sim.chain} chain!`);
				break;
			}

			case 'impact': {
				const power = Math.min(1, event.force / 900);
				this.fx.sparks(event.x, event.y, event.z, Math.round(4 + power * 16), 6 + power * 12);
				if (power > 0.3) this.fx.debris(event.x, event.y, event.z, Math.round(power * 10), 5 + power * 7, 0x9aa0aa);
				this.sound.impact(power);
				this.rig.addShake(0.12 + power * 0.4);
				if (event.big) this.pause(feel.hitPause);
				if (event.money > 0) this.popAt(event.x, event.y + 1, event.z, `+${formatMoney(event.money)}`, '', 'hit');
				break;
			}

			case 'blast':
				this.fx.blast(event.x, event.y, event.z, event.radius);
				this.sound.blast(event.radius / 14);
				this.rig.addShake(1);
				this.blastSlow = feel.blastSlowTime;
				this.pause(feel.bigHitPause);
				this.popAt(event.x, event.y + 3, event.z, event.money > 0 ? `+${formatMoney(event.money)}` : 'Boom!', event.label, 'blast');
				this.pullHotspot(event.x, event.z);
				if (event.source === 'breaker') this.ui.flash('Crashbreaker!');
				if (event.source === 'barrel') this.sound.cash(this.sim.multiplier());
				break;

			case 'chainBreak':
				this.sound.chainBreak();
				break;

			case 'end':
				this.endTimer = CONFIG.run.resultsDelay;
				this.sound.engine(false, 0);
				break;
		}
	}

	/** Stops the picture for a moment, so a hit feels heavy. */
	private pause(seconds: number): void {
		if (this.hitPauseCooldown > 0) return;
		this.hitPause = seconds;
		this.hitPauseCooldown = CONFIG.feel.hitPauseCooldown;
	}

	private pullHotspot(x: number, z: number): void {
		this.hits++;
		const distance = Math.hypot(x - this.hotspot.x, z - this.hotspot.z);
		this.spread += (distance - this.spread) * 0.3;
		this.hotspot.x += (x - this.hotspot.x) * 0.3;
		this.hotspot.z += (z - this.hotspot.z) * 0.3;
	}

	private popAt(x: number, y: number, z: number, text: string, detail: string, kind: 'hit' | 'bonus' | 'blast'): void {
		this.scratch.set(x, y, z).project(this.view.camera);
		if (this.scratch.z > 1) return;
		const sx = Math.max(60, Math.min(window.innerWidth - 60, (this.scratch.x * 0.5 + 0.5) * window.innerWidth));
		const sy = Math.max(70, Math.min(window.innerHeight - 60, (-this.scratch.y * 0.5 + 0.5) * window.innerHeight));
		this.ui.pop(sx, sy, text, detail, kind);
	}

	/** Smoke from wrecks, fire from what blew up, sparks from metal that slides on the road. */
	private emitWreckFx(simDt: number): void {
		if (simDt <= 0) return;
		for (const e of this.sim.entities) {
			if (e.state !== 'wrecked' && e !== this.sim.player) continue;
			if (e === this.sim.player && this.sim.phase !== 'crash' && this.sim.phase !== 'done') continue;
			const id = e.id;
			if (e.exploded && this.burnLeft[id] === 0) this.burnLeft[id] = 7;
			if (e === this.sim.player && this.sim.breakerUsed && this.burnLeft[id] === 0) this.burnLeft[id] = 7;
			this.smokeTimers[id] -= simDt;
			if (this.smokeTimers[id] <= 0) {
				const burning = this.burnLeft[id] > 0.01;
				this.smokeTimers[id] = burning ? 0.09 : 0.35 + Math.random() * 0.3;
				const top = e.pos[1] + e.size[1] * 0.4;
				if (burning) {
					this.fx.fire(e.pos[0] + (Math.random() - 0.5) * e.size[0], top, e.pos[2] + (Math.random() - 0.5) * e.size[2] * 0.6, 1, 0.8, 1.5);
					if (Math.random() < 0.5) this.fx.smoke(e.pos[0], top + 1, e.pos[2], 1, 1.3, 0.2);
				} else {
					this.fx.smoke(e.pos[0], top, e.pos[2], 1, 0.75, 0.55);
				}
			}
			if (this.burnLeft[id] > 0.01) this.burnLeft[id] = Math.max(0.01, this.burnLeft[id] - simDt);
			if (e.speedBefore > 7 && e.pos[1] < e.size[1] && Math.random() < simDt * 25) {
				this.fx.sparks(e.pos[0], 0.1, e.pos[2], 2, 4);
			}
		}
	}

	private updateCamera(dt: number): void {
		const sim = this.sim;
		if (this.mode === 'menu') {
			this.focus.set(0, 0, 0);
			this.rig.update(dt, this.car, 0, this.focus, 0);
			return;
		}
		const heading = sim.phase === 'aim' ? this.level.launch.heading + this.aim : sim.heading;
		if (this.hits === 0) this.hotspot.copy(this.car);
		const weight = sim.phase === 'done' ? 0.8 : 0.5;
		this.scratch.set(this.car.x + (this.hotspot.x - this.car.x) * weight, 0.5, this.car.z + (this.hotspot.z - this.car.z) * weight);
		this.focus.lerp(this.scratch, 1 - Math.exp(-4 * dt));
		const reach = this.spread + Math.hypot(this.car.x - this.hotspot.x, this.car.z - this.hotspot.z) * 0.5;
		if (sim.phase === 'crash' && this.rig.mode !== 'impact' && this.rig.mode !== 'crash') this.rig.setMode('crash');
		this.rig.update(dt, this.car, heading, this.focus, reach);
	}

	private updateHud(dt: number): void {
		const sim = this.sim;
		const device = this.input.device;
		const replay = this.mode === 'replay';
		let prompt = '';
		if (replay) {
			prompt = device === 'gamepad' ? 'Start: leave the replay' : device === 'touch' ? 'Tap II to leave the replay' : 'Esc: leave the replay';
		} else if (sim.phase === 'aim') {
			prompt = device === 'gamepad' ? 'Stick: aim · A: launch' : device === 'touch' ? 'Drag to aim, then tap Launch' : '← → or mouse: aim · Space or click: launch';
		} else if (sim.phase === 'approach') {
			prompt = device === 'touch' ? 'Drag to steer' : 'Steer into the traffic';
		} else if (sim.phase === 'crash' && sim.meter > 0) {
			prompt = device === 'gamepad' ? 'Stick: push your wreck' : device === 'touch' ? 'Drag to push your wreck' : 'Arrows: push your wreck';
		}
		this.ui.updateHud(
			{
				money: sim.money,
				multiplier: sim.multiplier(),
				chain: sim.chain,
				chainLeft: sim.chainTimer / CONFIG.score.chainWindow,
				meter: sim.meter / CONFIG.aftertouch.meter,
				meterLive: sim.aftertouchActive,
				timeLeft: this.level.timeLimit - sim.time,
				prompt,
				settle: sim.settleLeft < 0 ? -1 : sim.settleLeft / CONFIG.run.settleWarn,
				showLaunch: !replay && sim.phase === 'aim' && this.ui.screen === 'none',
				showBreaker: !replay && sim.phase === 'crash' && !sim.breakerUsed,
				breakerHint: device === 'gamepad' ? 'Press A' : device === 'touch' ? 'Tap' : 'Press Space',
				stats: this.stats(),
			},
			dt,
		);
	}

	private stats(): RunStats {
		return { money: this.sim.money, bestChain: this.sim.bestChain, wrecks: this.sim.wrecks, bonus: this.sim.bonus };
	}

	private finishRun(): void {
		this.resultsShown = true;
		const stats = this.stats();
		const level = this.level;
		const data = levelSave(this.save, level.id, level.goals.length);
		const wasReplay = this.mode === 'replay';
		const reached = level.goals.map((goal) => goalDone(goal, stats));
		const newGoals = reached.map((done, i) => done && !data.goals[i] && !wasReplay);
		const newBest = !wasReplay && stats.money > data.best;

		if (!wasReplay) {
			if (newBest || !data.replay || data.replay.version !== replayVersion(level)) {
				if (this.recording && stats.money > 0) data.replay = packReplay(this.recording);
			}
			if (newBest) data.best = stats.money;
			data.bestChain = Math.max(data.bestChain, stats.bestChain);
			reached.forEach((done, i) => {
				if (done) data.goals[i] = true;
			});
			storeSave(this.save);
		}

		this.sound.setMusic('menu');
		this.ui.setHud(false);
		if (newBest || newGoals.some(Boolean)) this.sound.fanfare(newGoals.filter(Boolean).length + (newBest ? 1 : 0));
		this.ui.showResults({
			level,
			index: this.levelIndex,
			stats,
			best: data.best,
			newBest: newBest && stats.money > 0,
			newGoals,
			doneGoals: level.goals.map((_, i) => data.goals[i] || reached[i]),
			nextOpen: this.unlocked() > this.levelIndex + 1,
			hasReplay: data.replay !== undefined && data.replay.version === replayVersion(level),
			wasReplay,
		});
	}
}
