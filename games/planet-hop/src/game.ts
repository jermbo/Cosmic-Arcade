import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GameAudio } from './audio';
import { CameraRig } from './camera';
import { Input } from './input';
import { Particles } from './particles';
import { Player, type PlayerEvents } from './player';
import { loadSave, writeSave, type SaveData, type Settings } from './save';
import { Ui } from './ui';
import { anyPerpendicular, basisQuat, clamp, damp, formatTime, isTouchDevice } from './util';
import { buildPlanets, type Dust, type Planet } from './world/planets';
import { Sky } from './world/sky';
import { light } from './world/toon';

type State = 'title' | 'story' | 'play' | 'paused' | 'launch' | 'flight' | 'ending' | 'results' | 'respawn';
type Tut = 'move' | 'look' | 'jump' | 'dust' | 'done';

const smooth = (a: number, b: number, x: number) => {
	const t = clamp((x - a) / (b - a), 0, 1);
	return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Game {
	private renderer: THREE.WebGLRenderer;
	private scene = new THREE.Scene();
	private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 3000);
	private composer: EffectComposer;
	private bloom: UnrealBloomPass;
	private sky = new Sky();
	private planets: Planet[];
	private player = new Player();
	private rig: CameraRig;
	private glow = new Particles(900, true);
	private puffs = new Particles(400, false);
	private audio = new GameAudio();
	private input: Input;
	private ui: Ui;
	private save: SaveData;
	private touch = isTouchDevice();

	private lanternR = 6.5;

	private state: State = 'title';
	private pausedFrom: State = 'play';
	private planetIdx = 0;
	private clock = 0;
	private runTime = 0;
	private stats = { stomps: 0, hits: 0 };
	private combo = 0;
	private comboT = 0;
	private deniedT = 0;
	private padPromptT = 0;
	private stateT = 0;
	private titleAngle = 0;
	private ambientT = 0;
	private camBlend = 1;
	private camFrom = new THREE.Vector3();
	private camFromQ = new THREE.Quaternion();
	private tut: Tut = 'done';
	private tutAcc = 0;
	private tutJumps = 0;
	private tutDoneT = 0;
	private lockWanted = false;
	private flight = {
		from: 0,
		to: 1,
		p0: new THREE.Vector3(),
		c0: new THREE.Vector3(),
		c1: new THREE.Vector3(),
		p1: new THREE.Vector3(),
		n0: new THREE.Vector3(),
		n1: new THREE.Vector3(),
		heading: new THREE.Vector3(),
		cam: new THREE.Vector3(),
		switched: false,
		arrived: false,
		T: 4.4,
	};
	private ending = { lit: false, angle: 0, from: new THREE.Vector3(), fromQ: new THREE.Quaternion() };

	constructor(canvas: HTMLCanvasElement, uiHost: HTMLElement) {
		this.save = loadSave(this.touch);
		const high = this.save.settings.quality === 'high';
		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
		this.renderer.toneMapping = THREE.NeutralToneMapping;
		this.renderer.toneMappingExposure = 1.0;
		this.scene.background = new THREE.Color('#120f2e');

		this.composer = new EffectComposer(this.renderer);
		this.composer.addPass(new RenderPass(this.scene, this.camera));
		this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 1.0);
		this.composer.addPass(this.bloom);
		this.composer.addPass(new OutputPass());

		this.rig = new CameraRig(this.camera);
		this.scene.add(this.sky.group);

		this.planets = buildPlanets(high ? 'high' : 'low');
		for (const p of this.planets) this.scene.add(p.group, p.dustRoot);
		this.scene.add(this.player.root, this.player.shadow, this.glow.points, this.puffs.points);
		// The title shows the first world awake.
		this.planets[0].lit.fill();

		this.ui = new Ui(uiHost, this.save.settings, {
			play: () => this.onPlay(),
			storyDone: () => this.startRun(),
			resume: () => this.resume(),
			pause: () => this.pause(),
			restart: () => this.startRun(),
			quit: () => this.toTitle(),
			settings: (s) => this.applySettings(s),
			replayTutorial: () => {
				this.save.tutorialDone = false;
				writeSave(this.save);
			},
			click: () => {
				this.audio.unlock();
				this.audio.uiClick();
			},
			move: () => this.audio.uiMove(),
		});
		// After the UI, which fills the overlay first.
		this.input = new Input(canvas, uiHost);
		this.input.onDevice = (d) => {
			this.ui.setDevice(d);
			this.input.showTouch(d === 'touch' && this.isPlaying());
			if (d !== 'touch' && this.isPlaying() && this.state !== 'paused') this.lock();
		};
		this.input.onMenu = (k) => {
			this.audio.unlock();
			this.ui.menu(k);
		};
		if (this.touch) {
			this.input.device = 'touch';
			this.ui.setDevice('touch');
		}

		this.applySettings(this.save.settings);
		this.wireBrowser(canvas);
		this.onResize();
		addEventListener('resize', () => this.onResize());

		this.player.place(this.planets[0], this.planets[0].landingDir);
		this.updateBest();
		this.ui.show('title');
		this.audio.setTheme('title');

		let last = performance.now();
		const frame = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			this.frame(dt);
			requestAnimationFrame(frame);
		};
		requestAnimationFrame(frame);
		if (import.meta.env.DEV) (window as unknown as { __ph: Game }).__ph = this;
	}

	// ---------- Browser wiring ----------

	private wireBrowser(canvas: HTMLCanvasElement): void {
		document.addEventListener('pointerlockchange', () => {
			if (document.pointerLockElement === canvas) return;
			if (this.lockWanted && this.isActive()) this.pause();
		});
		canvas.addEventListener('click', () => {
			this.audio.unlock();
			if (this.isActive() && this.input.device !== 'touch') this.lock();
		});
		document.addEventListener('visibilitychange', () => {
			if (document.hidden && this.isActive()) this.pause();
			this.audio.suspend(document.hidden);
		});
		addEventListener('popstate', () => {
			// The phone back button steps back inside the game.
			if (this.isActive()) {
				this.pause();
				history.pushState({ hop: 1 }, '');
			} else if (this.state === 'paused' || this.ui.current === 'settings' || this.ui.current === 'controls' || this.ui.current === 'story') {
				this.ui.back();
				if (this.state !== 'title' || this.ui.current !== 'title') history.pushState({ hop: 1 }, '');
			}
		});
		const unlock = () => this.audio.unlock();
		addEventListener('pointerdown', unlock);
		addEventListener('keydown', unlock);
		addEventListener('blur', () => {
			if (this.isActive()) this.pause();
		});
	}

	private lock(): void {
		if (this.input.device === 'touch') return;
		const c = this.renderer.domElement;
		if (document.pointerLockElement === c) return;
		this.lockWanted = true;
		try {
			const r = c.requestPointerLock() as unknown as Promise<void> | undefined;
			r?.catch?.(() => undefined);
		} catch {
			// Some browsers refuse right after an unlock. A click on the canvas locks again.
		}
	}

	private unlockPointer(): void {
		this.lockWanted = false;
		if (document.pointerLockElement) document.exitPointerLock();
	}

	private isActive(): boolean {
		return this.state === 'play' || this.state === 'launch' || this.state === 'flight' || this.state === 'respawn';
	}
	private isPlaying(): boolean {
		return this.isActive() || this.state === 'ending';
	}

	private onResize(): void {
		const w = innerWidth;
		const h = innerHeight;
		const high = this.save.settings.quality === 'high';
		const pr = Math.min(devicePixelRatio, high ? 2 : 1.25);
		this.renderer.setPixelRatio(pr);
		this.renderer.setSize(w, h);
		this.composer.setPixelRatio(pr);
		this.composer.setSize(w, h);
		this.bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
		this.camera.aspect = w / h;
		// Narrow screens need more FOV. Phones in landscape are very wide, so a lower FOV keeps Pip big.
		const aspect = w / h;
		this.rig.baseFov = aspect < 1.3 ? 70 : aspect > 1.9 ? 54 : 62;
		this.camera.updateProjectionMatrix();
		const scale = (h * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
		this.glow.setScale(scale / 0.9);
		this.puffs.setScale(scale / 0.9);
		this.sky.setPixelRatio(pr);
	}

	private applySettings(s: Settings): void {
		this.audio.setVolumes(s.master, s.music, s.sfx);
		this.input.sensitivity = s.sensitivity;
		this.input.invertY = s.invertY;
		this.rig.assist = s.cameraAssist;
		this.rig.reduceMotion = s.reduceMotion;
		this.save.settings = s;
		writeSave(this.save);
		this.onResize();
	}

	private updateBest(): void {
		const s = this.save;
		this.ui.setBest(s.bestTime !== null ? `Best time ${formatTime(s.bestTime)} · Best stardust ${s.bestDust}` : '');
	}

	// ---------- Flow ----------

	private onPlay(): void {
		this.audio.unlock();
		if (!this.save.tutorialDone && this.state === 'title') {
			this.state = 'story';
			this.ui.show('story');
			history.pushState({ hop: 1 }, '');
			return;
		}
		this.startRun();
	}

	private startRun(): void {
		this.audio.unlock();
		const fromTitle = this.state === 'title' || this.state === 'story' || this.state === 'results';
		for (const p of this.planets) p.reset();
		this.glow.clear();
		this.puffs.clear();
		this.planetIdx = 0;
		this.runTime = 0;
		this.stats = { stomps: 0, hits: 0 };
		const p = this.planets[0];
		const heading = anyPerpendicular(p.landingDir);
		// Face the first stardust line.
		const firstDust = p.dust[0];
		if (firstDust) heading.copy(firstDust.dir).sub(p.landingDir);
		this.player.place(p, p.landingDir, heading);
		this.player.sparks = 3;
		this.player.invuln = 0;
		this.player.frozen = false;
		this.player.curled = 0;
		this.player.lanternRaise = 0;
		this.player.setLantern(1);
		this.rig.snap(p.landingDir, this.player.facing);
		p.lit.paint(p.toLocalDir(p.landingDir), 3.2 / p.R, 1);
		if (fromTitle) this.startCamBlend();
		const lh = this.planets[2];
		if (lh.lighthouseBeams) lh.lighthouseBeams.visible = false;
		if (lh.lighthouseLamp) lh.lighthouseLamp.color.set('#4a4470');
		this.sky.setBrightness(1);

		this.tut = this.save.tutorialDone ? 'done' : 'move';
		this.tutAcc = 0;
		this.tutJumps = 0;
		this.state = 'play';
		this.stateT = 0;
		this.ui.show(null);
		this.ui.showHud(true);
		this.ui.setSparks(3);
		this.refreshDust();
		this.ui.prompt(this.tut === 'done' ? null : this.tut);
		this.ui.banner(p.style.name, p.style.subtitle, this.tut === 'done' ? p.style.hint : '');
		this.audio.setTheme(p.style.theme);
		this.audio.duck(false);
		this.input.playing = true;
		this.input.clearJump();
		this.input.showTouch(this.input.device === 'touch');
		this.lock();
		if (history.state?.hop !== 1) history.pushState({ hop: 1 }, '');
	}

	private startCamBlend(): void {
		this.camFrom.copy(this.camera.position);
		this.camFromQ.copy(this.camera.quaternion);
		this.camBlend = 0;
	}

	private pause(): void {
		if (!this.isActive()) return;
		this.pausedFrom = this.state;
		this.state = 'paused';
		this.ui.show('pause');
		this.audio.duck(true);
		this.input.playing = false;
		this.input.showTouch(false);
		this.unlockPointer();
	}

	private resume(): void {
		if (this.state !== 'paused') return;
		this.state = this.pausedFrom;
		this.ui.show(null);
		this.audio.duck(false);
		this.input.playing = true;
		this.input.clearJump();
		this.input.showTouch(this.input.device === 'touch');
		this.lock();
	}

	private toTitle(): void {
		this.state = 'title';
		this.unlockPointer();
		this.input.playing = false;
		this.input.showTouch(false);
		this.ui.showHud(false);
		this.ui.prompt(null);
		this.ui.hideBanner();
		this.ui.fade(false);
		for (const p of this.planets) p.reset();
		const p = this.planets[0];
		p.lit.fill();
		this.planetIdx = 0;
		this.player.place(p, p.landingDir);
		this.player.frozen = false;
		this.player.curled = 0;
		this.player.lanternRaise = 0;
		this.player.invuln = 0;
		this.updateBest();
		this.ui.show('title');
		this.audio.setTheme('title');
		this.audio.duck(false);
	}

	private refreshDust(): void {
		const p = this.planets[this.planetIdx];
		this.ui.setDust(p.collected, p.quota, p.charged);
	}

	// ---------- Frame ----------

	private frame(dt: number): void {
		this.input.update(dt);
		const paused = this.state === 'paused';
		if (!paused) this.clock += dt;
		const planet = this.planets[this.planetIdx];

		switch (this.state) {
			case 'title':
			case 'story':
				this.titleUpdate(dt);
				break;
			case 'play':
				this.playUpdate(dt, planet);
				break;
			case 'respawn':
				this.respawnUpdate(dt, planet);
				break;
			case 'launch':
				this.launchUpdate(dt, planet);
				break;
			case 'flight':
				this.flightUpdate(dt);
				break;
			case 'ending':
			case 'results':
				this.endingUpdate(dt, planet);
				break;
			case 'paused':
				break;
		}
		if (!paused) {
			for (const p of this.planets) p.update(this.clock, dt);
			this.geysers(dt, this.planets[this.planetIdx]);
			this.ambientFx(dt);
			this.glow.update(dt);
			this.puffs.update(dt);
		}
		this.applyCamBlend(dt);
		this.sky.update(this.camera.position, this.clock);
		const cur = this.planets[this.planetIdx];
		const neb = cur.style.nebula.map((c) => new THREE.Color(c)) as [THREE.Color, THREE.Color, THREE.Color];
		this.sky.tint(neb[0], neb[1], neb[2], damp(0.8, dt));
		this.updateLights(dt);
		this.ui.update(dt);
		if (this.save.settings.quality === 'high') this.composer.render(dt);
		else this.renderer.render(this.scene, this.camera);
		this.input.endFrame();
	}

	private applyCamBlend(dt: number): void {
		if (this.camBlend >= 1) return;
		this.camBlend = Math.min(1, this.camBlend + dt / 1.4);
		const e = easeInOut(this.camBlend);
		this.camera.position.lerpVectors(this.camFrom, this.camera.position, e);
		this.camera.quaternion.slerpQuaternions(this.camFromQ, this.camera.quaternion, e);
	}

	private updateLights(dt: number): void {
		// A soft sun from above and a little behind the camera, so the hero's side of the world is lit.
		const fwd = this.camera.getWorldDirection(new THREE.Vector3());
		const up = this.camera.up;
		const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
		const dir = up.clone().multiplyScalar(0.8).addScaledVector(right, 0.45).addScaledVector(fwd, -0.4).normalize();
		light.uSunDir.value.lerp(dir, damp(4, dt)).normalize();
		light.uLantern.value.copy(this.player.lanternWorld);
		this.lanternR += (6.5 * this.player.lanternOn - this.lanternR) * damp(3, dt);
		light.uLanternR.value = Math.max(0.01, this.lanternR);
		light.uTime.value = this.clock;
	}

	/** Pip's lantern wakes the ground nearby. It reaches further as stardust gathers. */
	private paintLight(dt: number, planet: Planet): void {
		const pl = this.player;
		if (pl.height > 3) return;
		const reach = 2.3 + planet.collected * 0.12;
		planet.lit.paint(planet.toLocalDir(pl.up), reach / planet.R, dt * 2.5);
	}

	private events(planet: Planet): PlayerEvents {
		return {
			jump: () => {
				this.audio.jump();
				this.puff(this.player.pos, planet, 6, 2.2);
				if (this.tut === 'jump') this.tutJumps++;
			},
			land: (v) => {
				this.audio.land(v, planet.style.surface);
				if (v > 4) this.puff(this.player.pos, planet, Math.min(14, Math.floor(v)), 1.5 + v * 0.15);
				if (v > 17) this.rig.addShake(0.12);
			},
			step: () => {
				this.audio.step(planet.style.surface);
				if (Math.random() < 0.35) this.puff(this.player.pos, planet, 1, 1);
			},
		};
	}

	private puff(at: THREE.Vector3, planet: Planet, n: number, speed: number): void {
		const up = at.clone().sub(planet.center).normalize();
		this.puffs.emit({
			pos: at.clone().addScaledVector(up, 0.1),
			count: n,
			color: planet.style.puff,
			speed,
			size: 0.35,
			life: 0.55,
			dir: up,
			spread: 2.2,
			center: planet.center,
			gravity: 2,
			drag: 4,
			jitter: 0.4,
		});
	}

	private moveVector(): THREE.Vector3 {
		const up = this.player.up;
		const f = this.rig.fwd.clone().addScaledVector(up, -this.rig.fwd.dot(up)).normalize();
		const r = new THREE.Vector3().crossVectors(f, up).normalize();
		const m = f.multiplyScalar(this.input.moveY).addScaledVector(r, this.input.moveX);
		if (m.lengthSq() > 1) m.normalize();
		return m;
	}

	// ---------- Title ----------

	private titleUpdate(dt: number): void {
		const p = this.planets[0];
		this.titleAngle += dt * 0.08;
		const zero = new THREE.Vector3();
		this.player.update(dt, p, zero, false, false, { jump() {}, land() {}, step() {} });
		// Orbit around the first planet, with the planet on the right of the menu.
		const up = p.landingDir;
		const side = anyPerpendicular(up);
		const other = new THREE.Vector3().crossVectors(up, side);
		const around = side.clone().multiplyScalar(Math.cos(this.titleAngle)).addScaledVector(other, Math.sin(this.titleAngle));
		const camPos = p.center.clone().addScaledVector(around, 21).addScaledVector(up, 12);
		const look = p.center.clone().addScaledVector(up, 6);
		this.camera.position.copy(camPos);
		this.camera.up.copy(up);
		this.camera.lookAt(look);
		// Shift the view so the planet sits to the right of the menu.
		const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
		const wide = innerWidth / innerHeight > 1.1;
		this.camera.position.addScaledVector(right, wide ? -7 : 0);
		if (this.camera.fov !== 55) {
			this.camera.fov = 55;
			this.camera.updateProjectionMatrix();
		}
		this.rig.snap(up, around.clone().negate());
	}

	// ---------- Play ----------

	private playUpdate(dt: number, planet: Planet): void {
		const input = this.input;
		if (input.pausePressed) {
			this.pause();
			return;
		}
		this.stateT += dt;
		this.runTime += dt;
		const move = this.moveVector();
		this.player.update(dt, planet, move, input.jumpPressed, input.jumpHeld, this.events(planet));
		this.paintLight(dt, planet);
		this.interact(dt, planet);
		this.tutorial(dt);
		this.rig.fovKick += (0 - this.rig.fovKick) * damp(4, dt);
		this.rig.update(dt, input, this.player, planet);
	}

	private interact(dt: number, planet: Planet): void {
		const pl = this.player;
		const center = pl.pos.clone().addScaledVector(pl.up, 0.6);
		planet.magnet.copy(center);
		this.comboT -= dt;
		if (this.comboT <= 0) this.combo = 0;
		this.deniedT -= dt;

		// Stardust
		for (const d of planet.dust) {
			if (d.taken) continue;
			const dist = d.mesh.position.distanceTo(center);
			if (dist < 1.15) this.collect(planet, d);
			else if (dist < 2.4) d.pull = Math.min(1, d.pull + dt * 2.5);
			else d.pull = Math.max(0, d.pull - dt * 2);
		}

		// Blossoms
		for (const b of planet.blossoms) {
			if (!pl.grounded) continue;
			if (pl.up.angleTo(b.dir) * planet.R < b.r && pl.height < 0.4) {
				pl.launchUp(17.5);
				b.squash = 1;
				this.audio.bounce();
				this.glow.emit({ pos: pl.pos.clone(), count: 14, color: '#ff8fc0', color2: '#ffd23f', speed: 5, size: 0.3, life: 0.8, dir: pl.up, spread: 1.5, center: planet.center, gravity: 6, drag: 2 });
			}
		}

		// Frost mites
		for (const m of planet.mites) {
			if (!m.alive) continue;
			const mc = m.pos.clone().addScaledVector(m.up, 0.45);
			const rel = pl.pos.clone().addScaledVector(pl.up, 0.4).sub(mc);
			if (rel.length() > 1.0) continue;
			const vert = rel.dot(m.up);
			if (pl.vr < 2 && vert > 0.2 && !pl.grounded) {
				m.alive = false;
				m.mesh.visible = false;
				pl.launchUp(12);
				this.stats.stomps++;
				this.audio.stomp();
				this.glow.emit({ pos: mc, count: 22, color: '#8fe6ff', color2: '#ffffff', speed: 6, size: 0.3, life: 0.7, center: planet.center, gravity: 8, drag: 2 });
				planet.dropDust(m.pos.clone().addScaledVector(m.up, 1.2));
			} else this.hurt(planet, mc);
		}

		// Lava pools
		for (const pool of planet.pools) {
			if (pl.height > 0.35) continue;
			if (pl.up.angleTo(pool.dir) * planet.R < pool.r - 0.1) {
				this.hurt(planet, planet.worldPoint(pool.dir, 0), 11);
			}
		}

		// Goal
		const onGoal = pl.grounded && pl.up.angleTo(planet.goalDir) * planet.R < planet.goalRadius;
		if (onGoal) {
			if (planet.charged) {
				if (planet.lighthouse) this.startEnding(planet);
				else this.startLaunch();
			} else if (this.deniedT <= 0) {
				const left = planet.quota - planet.collected;
				this.ui.toast(`Collect ${left} more stardust to ${planet.lighthouse ? 'light the lighthouse' : 'charge the pad'}`, 2.5);
				this.audio.denied();
				this.deniedT = 3;
			}
		}
		if (this.padPromptT > 0) {
			this.padPromptT -= dt;
			if (this.padPromptT <= 0 && this.tut === 'done') this.ui.prompt(null);
		}
	}

	private collect(planet: Planet, d: Dust): void {
		const wasCharged = planet.charged;
		if (!planet.take(d)) return;
		this.combo++;
		this.comboT = 1.6;
		this.audio.collect(this.combo - 1);
		this.glow.emit({ pos: d.mesh.position.clone(), count: 16, color: planet.style.dust, color2: '#ffffff', speed: 4, size: 0.28, life: 0.6, drag: 3 });
		this.refreshDust();
		if (!wasCharged && planet.charged) {
			this.audio.padReady();
			this.audio.bloom();
			planet.lit.startWave(planet.toLocalDir(this.player.up), 3.2);
			this.rig.addShake(0.06);
			const what = planet.lighthouse ? 'The lighthouse rune is ready!' : 'Launch pad charged!';
			this.ui.toast(what, 2.5);
			if (this.tut === 'done' || this.tut === 'dust') {
				this.ui.prompt(planet.lighthouse ? 'rune' : 'pad');
				this.padPromptT = 5;
			}
		}
	}

	private hurt(planet: Planet, from: THREE.Vector3, up = 8): void {
		const pl = this.player;
		if (pl.invuln > 0) return;
		pl.sparks--;
		this.stats.hits++;
		pl.invuln = 1.6;
		this.audio.hurt();
		pl.knock(pl.pos.clone().sub(from), up, 7);
		this.rig.addShake(0.25);
		this.ui.setSparks(Math.max(0, pl.sparks));
		this.glow.emit({ pos: pl.pos.clone().addScaledVector(pl.up, 0.6), count: 14, color: '#ff6b6b', color2: '#ffd23f', speed: 5, size: 0.25, life: 0.5, drag: 3 });
		if (pl.sparks <= 0) {
			this.state = 'respawn';
			this.stateT = 0;
			this.ui.fade(true);
			this.ui.toast('Out of sparks. Back to the landing spot.', 2);
		} else if (pl.sparks === 1) this.ui.toast('One spark left. Careful!', 1.8);
		void planet;
	}

	private respawnUpdate(dt: number, planet: Planet): void {
		this.stateT += dt;
		this.runTime += dt;
		const zero = new THREE.Vector3();
		if (this.stateT < 0.45) {
			this.player.update(dt, planet, zero, false, false, this.events(planet));
			this.rig.update(dt, null, this.player, planet);
			return;
		}
		if (this.stateT < 0.5) {
			const heading = this.rig.fwd.clone();
			this.player.place(planet, planet.landingDir, heading);
			this.player.sparks = 3;
			this.player.invuln = 1.2;
			this.ui.setSparks(3);
			this.rig.snap(planet.landingDir, this.player.facing);
			this.rig.update(dt, null, this.player, planet);
			this.ui.fade(false);
			this.audio.respawn();
			this.state = 'play';
		}
	}

	private tutorial(dt: number): void {
		if (this.tut === 'done') return;
		const i = this.input;
		const next = (t: Tut) => {
			this.tut = t;
			this.tutAcc = 0;
			this.ui.prompt(t === 'done' ? null : t);
			this.audio.padReady();
		};
		if (this.tut === 'move') {
			if (Math.hypot(i.moveX, i.moveY) > 0.3) this.tutAcc += dt;
			if (this.tutAcc > 1.2) next('look');
		} else if (this.tut === 'look') {
			this.tutAcc += Math.abs(i.lookX) + Math.abs(i.lookY);
			if (this.tutAcc > 1.4) next('jump');
		} else if (this.tut === 'jump') {
			if (this.tutJumps >= 2) next('dust');
		} else if (this.tut === 'dust') {
			if (this.planets[0].collected >= 1) {
				this.tutDoneT += dt;
				if (this.tutDoneT > 2.5) {
					this.tut = 'done';
					this.ui.prompt(null);
					this.save.tutorialDone = true;
					writeSave(this.save);
					const p = this.planets[this.planetIdx];
					this.ui.banner(p.style.name, `${p.quota} stardust charges the pad`, p.style.hint, 4.5);
				}
			}
		}
	}

	// ---------- Hazards ----------

	private geysers(dt: number, planet: Planet): void {
		const pl = this.player;
		for (const g of planet.geysers) {
			g.timer -= dt;
			const dist = pl.pos.distanceTo(planet.worldPoint(g.dir, 0));
			const vol = clamp(1 - dist / 16, 0, 1);
			const t = this.clock;
			if (g.state === 'idle') {
				g.glow.color.setRGB(0.6, 0.18, 0.06);
				if (g.timer <= 0) {
					g.state = 'warn';
					g.timer = 1.2;
					if (this.state === 'play') this.audio.rumble(vol);
				}
			} else if (g.state === 'warn') {
				const k = 0.6 + 0.4 * Math.sin(t * 30);
				g.glow.color.setRGB(1.8 * k, 0.7 * k, 0.15 * k);
				if (Math.random() < dt * 20)
					this.puffs.emit({ pos: planet.worldPoint(g.dir, 0.5), count: 1, color: '#6a5a66', speed: 2, size: 0.6, life: 1.2, dir: g.dir, spread: 0.4, drag: 1 });
				if (g.timer <= 0) {
					g.state = 'erupt';
					g.timer = 1.5;
					g.column.visible = true;
					if (this.state === 'play') this.audio.erupt(vol);
				}
			} else {
				const age = 1.5 - g.timer;
				const sh = Math.min(1, age * 6) * (g.timer < 0.3 ? g.timer / 0.3 : 1);
				g.column.scale.set(1 + Math.sin(t * 40) * 0.05, Math.max(0.01, sh * g.height), 1 + Math.cos(t * 37) * 0.05);
				g.glow.color.setRGB(2, 1, 0.3);
				if (Math.random() < dt * 40)
					this.glow.emit({ pos: planet.worldPoint(g.dir, 0.5), count: 2, color: '#ffb04a', color2: '#ff4a1a', speed: 9, size: 0.45, life: 0.7, dir: g.dir, spread: 0.25, drag: 1.2 });
				// Hurt only on the planet the hero stands on
				if (this.state === 'play' && sh > 0.3) {
					const across = pl.up.angleTo(g.dir) * planet.R;
					if (across < g.r && pl.height < sh * g.height) this.hurt(planet, planet.worldPoint(g.dir, 0), 13);
				}
				if (g.timer <= 0) {
					g.state = 'idle';
					g.timer = g.idle + Math.random() * 1.2;
					g.column.visible = false;
				}
			}
		}
	}

	private ambientFx(dt: number): void {
		const planet = this.planets[this.planetIdx];
		const pl = this.player;
		this.ambientT -= dt;
		if (this.state !== 'flight' && this.ambientT <= 0) {
			const t = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
			t.addScaledVector(pl.up, -t.dot(pl.up)).normalize().multiplyScalar(2 + Math.random() * 9);
			const p = pl.pos.clone().add(t).addScaledVector(pl.up, Math.random() * 5);
			const kind = planet.kind;
			if (kind === 'garden') {
				this.ambientT = 0.12;
				this.glow.emit({ pos: p, count: 1, color: '#d8ff7a', color2: '#ffe27a', speed: 0.4, size: 0.18, life: 3, drag: 0.2 });
			} else if (kind === 'ice') {
				this.ambientT = 0.04;
				const sp = p.addScaledVector(pl.up, 3);
				this.puffs.emit({ pos: sp, count: 1, color: '#ffffff', speed: 0.3, size: 0.12, life: 4, center: planet.center, gravity: 0.8, drag: 1.2 });
			} else {
				this.ambientT = 0.07;
				this.glow.emit({ pos: p.addScaledVector(pl.up, -2), count: 1, color: '#ff8a3a', color2: '#ffd06a', speed: 0.5, size: 0.14, life: 2.5, center: planet.center, gravity: -1.2, drag: 0.6 });
			}
		}
		// Lantern sparkles
		if (Math.random() < dt * 6 && this.state !== 'title' && this.state !== 'flight')
			this.glow.emit({ pos: pl.lanternWorld.clone(), count: 1, color: '#ffd27a', speed: 0.4, size: 0.1, life: 0.9, center: planet.center, gravity: -1, drag: 1 });
		// Charged goal sparkles
		if (planet.charged && Math.random() < dt * 12)
			this.glow.emit({ pos: planet.worldPoint(planet.goalDir, 0.3), count: 1, color: '#ffd23f', color2: '#fff6e5', speed: 3, size: 0.22, life: 1.4, dir: planet.goalDir, spread: 0.3, jitter: 1.6, drag: 0.3 });
	}

	// ---------- Launch and flight ----------

	private startLaunch(): void {
		this.state = 'launch';
		this.stateT = 0;
		this.player.frozen = true;
		this.audio.charge();
		this.ui.prompt(null);
	}

	private launchUpdate(dt: number, planet: Planet): void {
		if (this.input.pausePressed) {
			this.pause();
			return;
		}
		this.stateT += dt;
		const pl = this.player;
		pl.vT.multiplyScalar(Math.exp(-dt * 12));
		pl.kick(-dt * 40);
		const pad = planet.worldPoint(planet.goalDir, 0);
		pl.pos.lerp(pad, damp(6, dt));
		pl.update(dt, planet, new THREE.Vector3(), false, false, this.events(planet));
		if (Math.random() < dt * 60)
			this.glow.emit({ pos: pad, count: 1, color: '#ffd23f', color2: '#ffffff', speed: 7, size: 0.25, life: 0.8, dir: planet.goalDir, spread: 0.2, jitter: 2, drag: 0.5 });
		this.rig.update(dt, this.input, pl, planet);
		if (this.stateT > 0.75) this.startFlight();
	}

	private startFlight(): void {
		const f = this.flight;
		const A = this.planets[this.planetIdx];
		const B = this.planets[this.planetIdx + 1];
		f.from = this.planetIdx;
		f.to = this.planetIdx + 1;
		f.p0.copy(this.player.pos);
		f.n0.copy(A.goalDir);
		f.p1.copy(B.center).addScaledVector(B.landingDir, B.R + 0.6);
		f.n1.copy(B.landingDir);
		f.c0.copy(f.p0).addScaledVector(f.n0, 30);
		f.c1.copy(f.p1).addScaledVector(f.n1, 30);
		const travel = f.c1.clone().sub(f.c0);
		f.heading.copy(travel).addScaledVector(f.n1, -travel.dot(f.n1));
		if (f.heading.lengthSq() < 1e-4) anyPerpendicular(f.n1, f.heading);
		f.heading.normalize();
		f.cam.copy(this.camera.position);
		A.beamOff = true;
		f.switched = false;
		f.arrived = false;
		this.state = 'flight';
		this.stateT = 0;
		this.audio.launch();
		this.audio.setTheme('flight');
		this.ui.showHud(false);
		this.glow.emit({ pos: f.p0.clone(), count: 40, color: '#ffd23f', color2: '#ff6b6b', speed: 9, size: 0.4, life: 0.9, dir: f.n0, spread: 1.2, drag: 2 });
		this.rig.addShake(0.15);
	}

	private bezier(t: number, out: THREE.Vector3): THREE.Vector3 {
		const f = this.flight;
		const u = 1 - t;
		return out
			.copy(f.p0)
			.multiplyScalar(u * u * u)
			.addScaledVector(f.c0, 3 * u * u * t)
			.addScaledVector(f.c1, 3 * u * t * t)
			.addScaledVector(f.p1, t * t * t);
	}

	private flightUpdate(dt: number): void {
		if (this.input.pausePressed) {
			this.pause();
			return;
		}
		const f = this.flight;
		this.stateT += dt;
		const s = clamp(this.stateT / f.T, 0, 1);
		const e = easeInOut(s);
		const pos = this.bezier(e, new THREE.Vector3());
		const ahead = this.bezier(Math.min(1, e + 0.02), new THREE.Vector3());
		const tangent = ahead.sub(pos);
		if (tangent.lengthSq() < 1e-8) tangent.copy(f.n1).negate();
		tangent.normalize();
		const w = smooth(0.05, 0.95, s);
		const up = f.n0.clone().lerp(f.n1, w).normalize();
		if (up.lengthSq() < 0.5) up.copy(f.n1);

		// Pip curls into a ball and tumbles gently.
		const pl = this.player;
		pl.curled = s < 0.85 ? Math.min(1, s * 5) : Math.max(0, 1 - (s - 0.85) * 8);
		pl.pos.copy(pos);
		pl.up.copy(up);
		const front = tangent.clone().addScaledVector(up, -tangent.dot(up));
		if (front.lengthSq() < 1e-6) front.copy(f.heading);
		basisQuat(up, front.normalize(), pl.root.quaternion);
		const spin = pl.curled * Math.sin(s * Math.PI) * s * Math.PI * 4;
		pl.root.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), spin));
		pl.root.position.copy(pos);
		pl.root.visible = true;

		// Chase camera, then settle into the normal view before landing.
		const chase = pos.clone().addScaledVector(tangent, -9).addScaledVector(up, 3.2);
		f.cam.lerp(chase, damp(this.rig.reduceMotion ? 3 : 5, dt));
		const B = this.planets[f.to];
		const restTarget = f.p1.clone().addScaledVector(f.n1, 1.15 - 0.6);
		const rest = this.rig.restPose(restTarget, f.n1, f.heading, B.center, B.R);
		const k = smooth(0.7, 1, s);
		const camPos = f.cam.clone().lerp(rest, k);
		const look = pos.clone().addScaledVector(tangent, 3).lerp(restTarget, k);
		this.camera.position.copy(camPos);
		this.camera.up.copy(up.clone().lerp(f.n1, k).normalize());
		this.camera.lookAt(look);
		const fov = this.rig.baseFov + (this.rig.reduceMotion ? 0 : Math.sin(s * Math.PI) * 9);
		this.camera.fov = fov;
		this.camera.updateProjectionMatrix();

		// Trail
		if (Math.random() < dt * 50)
			this.glow.emit({ pos: pos.clone().addScaledVector(tangent, -0.6), count: 2, color: '#ffd23f', color2: '#b48cff', speed: 2, size: 0.16, life: 0.22, jitter: 0.5, drag: 1 });

		if (!f.switched && s > 0.45) {
			f.switched = true;
			this.planetIdx = f.to;
			const p = B.style;
			this.ui.banner(p.name, p.subtitle, p.hint, 5);
			this.audio.setTheme(p.theme);
		}
		if (!f.arrived && s > 0.82) {
			f.arrived = true;
			this.audio.arrive();
		}
		if (s >= 1) {
			pl.curled = 0;
			pl.place(B, f.n1, f.heading);
			B.lit.paint(B.toLocalDir(f.n1), 3.2 / B.R, 1);
			pl.pos.addScaledVector(f.n1, 0.6);
			pl.grounded = false;
			pl.vr = -5;
			pl.frozen = false;
			this.rig.snap(f.n1, f.heading, 0.6);
			this.rig.fovKick = 0;
			this.state = 'play';
			this.stateT = 0;
			this.ui.showHud(true);
			this.refreshDust();
		}
	}

	// ---------- Ending ----------

	private startEnding(planet: Planet): void {
		this.state = 'ending';
		this.stateT = 0;
		this.player.frozen = true;
		this.ending.lit = false;
		planet.beamOff = true;
		this.ending.from.copy(this.camera.position);
		this.ending.fromQ.copy(this.camera.quaternion);
		this.ending.angle = 0;
		this.ui.prompt(null);
		this.ui.showHud(false);
		this.input.showTouch(false);
		this.unlockPointer();
		this.input.playing = false;
		void planet;
	}

	private endingUpdate(dt: number, planet: Planet): void {
		this.stateT += dt;
		const t = this.stateT;
		const pl = this.player;
		const lh = planet.lighthouse!;
		const lamp = new THREE.Vector3();
		lh.getWorldPosition(lamp);
		const towerUp = lamp.clone().sub(planet.center).normalize();
		const lampPos = lamp.clone().addScaledVector(towerUp, 7.8);
		// Turn Pip toward the tower and raise the lantern.
		const toTower = lamp.clone().sub(pl.pos);
		pl.vT.multiplyScalar(Math.exp(-dt * 10));
		if (this.state === 'ending') pl.lanternRaise = Math.min(1, pl.lanternRaise + dt * 1.5);
		const face = toTower.addScaledVector(pl.up, -toTower.dot(pl.up)).normalize();
		pl.facing.lerp(face, damp(6, dt)).normalize();
		pl.update(dt, planet, new THREE.Vector3(), false, false, this.events(planet));

		if (t < 1.6 && Math.random() < dt * 40) {
			const dir = lampPos.clone().sub(pl.lanternWorld);
			const len = dir.length();
			this.glow.emit({ pos: pl.lanternWorld.clone(), count: 1, color: '#ffd27a', color2: '#ffffff', speed: len * 1.6, size: 0.3, life: 0.7, dir: dir.normalize(), spread: 0.08, drag: 0.1 });
		}
		if (!this.ending.lit && t > 1.5) {
			this.ending.lit = true;
			planet.lighthouseLamp!.color.setRGB(3, 2.6, 1.4);
			planet.lighthouseBeams!.visible = true;
			this.audio.lighthouse();
			this.audio.setTheme('end');
			planet.lit.startWave(planet.toLocalDir(towerUp), 4);
			for (const p of this.planets) if (p !== planet && p.lit.lit < 1) p.lit.startWave(p.toLocalDir(p.goalDir), 4);
			this.rig.addShake(0.1);
			this.glow.emit({ pos: lampPos, count: 120, color: '#ffd23f', color2: '#ffffff', speed: 14, size: 0.55, life: 1.6, drag: 1.4 });
		}
		if (this.ending.lit) {
			planet.lighthouseBeams!.rotation.y += dt * 1.1;
			this.sky.setBrightness(Math.min(1.8, 1 + (t - 1.5) * 0.4));
			for (const b of planet.lighthouseBeams!.children) ((b as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uTime.value = this.clock;
		}

		// Camera: ease out to a slow orbit around the lighthouse.
		this.ending.angle += dt * 0.18;
		const side = anyPerpendicular(towerUp);
		const other = new THREE.Vector3().crossVectors(towerUp, side);
		const around = side.multiplyScalar(Math.cos(this.ending.angle)).addScaledVector(other, Math.sin(this.ending.angle));
		const target = lamp.clone().addScaledVector(towerUp, 4);
		const orbit = target.clone().addScaledVector(around, 19).addScaledVector(towerUp, 7);
		const k = easeInOut(clamp(t / 2.5, 0, 1));
		this.camera.position.lerpVectors(this.ending.from, orbit, k);
		this.camera.up.copy(towerUp);
		this.camera.lookAt(target);
		const q = this.camera.quaternion.clone();
		this.camera.quaternion.slerpQuaternions(this.ending.fromQ, q, k);
		if (this.camera.fov !== this.rig.baseFov) {
			this.camera.fov = this.rig.baseFov;
			this.camera.updateProjectionMatrix();
		}

		if (this.state === 'ending' && t > 6.5) this.finish();
	}

	private finish(): void {
		this.state = 'results';
		let dust = 0;
		let total = 0;
		for (const p of this.planets) {
			dust += p.collected;
			total += p.totalDust;
		}
		const s = this.save;
		const newBest = s.bestTime === null || this.runTime < s.bestTime;
		if (newBest) s.bestTime = this.runTime;
		s.bestDust = Math.max(s.bestDust, dust);
		s.clears++;
		writeSave(s);
		this.ui.results({ time: this.runTime, dust, total, stomps: this.stats.stomps, hits: this.stats.hits, best: s.bestTime, newBest });
	}
}
