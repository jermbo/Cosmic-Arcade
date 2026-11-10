import * as THREE from 'three';
import { CONFIG } from '../config.ts';
import { THEMES } from '../levels/themes.ts';
import type { Theme } from '../levels/themes.ts';
import type { LevelDef, RoadDef } from '../levels/types.ts';
import { lanePlace } from '../sim/lanes.ts';
import { hashText, makeRng } from '../sim/rng.ts';
import type { Entity, LightColor, Sim } from '../sim/sim.ts';
import { makeModel } from './models.ts';

/** Draws one junction and the bodies of the sim. It holds no rule of the game. */

const DEG = Math.PI / 180;
const LIGHT_COLOURS: Record<LightColor, number> = { green: 0x4dff88, amber: 0xffc93c, red: 0xff3b47 };

interface Body {
	entity: Entity;
	mesh: THREE.Mesh;
	shade: number;
}

export class View {
	readonly renderer: THREE.WebGLRenderer;
	readonly scene = new THREE.Scene();
	readonly camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.5, 700);
	private level = new THREE.Group();
	private bodies: Body[] = [];
	private sun = new THREE.DirectionalLight(0xffffff, 2);
	private ambient = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
	private lightMaterials = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
	private aimArrow = new THREE.Group();
	private aimMaterial = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.85, depthWrite: false });
	private a = new THREE.Quaternion();
	private b = new THREE.Quaternion();

	constructor(canvas: HTMLCanvasElement) {
		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;

		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(2048, 2048);
		const shadow = this.sun.shadow.camera;
		shadow.left = -80;
		shadow.right = 80;
		shadow.top = 80;
		shadow.bottom = -80;
		shadow.near = 1;
		shadow.far = 320;
		this.sun.shadow.bias = -0.0004;
		this.sun.shadow.normalBias = 0.05;
		this.scene.add(this.sun, this.sun.target, this.ambient, this.level, this.aimArrow);

		const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 30).rotateX(-Math.PI / 2).translate(0, 0, 19), this.aimMaterial);
		const head = new THREE.Mesh(new THREE.CircleGeometry(1.7, 3).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2).translate(0, 0, 35), this.aimMaterial);
		this.aimArrow.add(shaft, head);
		this.aimArrow.position.y = 0.12;
		this.aimArrow.visible = false;
	}

	resize(width: number, height: number): void {
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / Math.max(1, height);
		this.camera.updateProjectionMatrix();
	}

	render(): void {
		this.renderer.render(this.scene, this.camera);
	}

	loadLevel(def: LevelDef, sim: Sim): void {
		this.clearLevel();
		const theme = THEMES[def.theme];
		this.scene.fog = new THREE.Fog(theme.skyHorizon, theme.fogNear, theme.fogFar);
		this.scene.background = new THREE.Color(theme.skyHorizon);
		this.sun.color.setHex(theme.sun);
		this.sun.intensity = theme.sunPower;
		this.sun.position.set(...theme.sunFrom).normalize().multiplyScalar(150);
		this.ambient.color.setHex(theme.ambientSky);
		this.ambient.groundColor.setHex(theme.ambientGround);
		this.ambient.intensity = theme.ambientPower;

		this.addSky(theme);
		this.addGround(def, theme);
		this.addBuildings(def, theme);
		this.addTrees(def, theme);
		this.addStopLines(def, sim);

		for (const entity of sim.entities) {
			const mesh = makeModel(entity.kind, entity.paint);
			this.level.add(mesh);
			this.bodies.push({ entity, mesh, shade: 1 });
		}
		this.sync(1);
	}

	/** Moves each mesh to its body. `alpha` blends the last two steps, from 0 to 1. */
	sync(alpha: number): void {
		for (const body of this.bodies) {
			const e = body.entity;
			const mesh = body.mesh;
			if (e.state === 'gone') {
				mesh.visible = false;
				continue;
			}
			mesh.position.set(
				e.prevPos[0] + (e.pos[0] - e.prevPos[0]) * alpha,
				e.prevPos[1] + (e.pos[1] - e.prevPos[1]) * alpha,
				e.prevPos[2] + (e.pos[2] - e.prevPos[2]) * alpha,
			);
			this.a.set(e.prevQuat[0], e.prevQuat[1], e.prevQuat[2], e.prevQuat[3]);
			this.b.set(e.quat[0], e.quat[1], e.quat[2], e.quat[3]);
			mesh.quaternion.slerpQuaternions(this.a, this.b, alpha);

			const target = e.exploded ? 0.28 : e.state === 'wrecked' ? 0.72 : 1;
			if (body.shade !== target) {
				body.shade = target;
				(mesh.material as THREE.MeshLambertMaterial).color.setScalar(target);
			}
		}
	}

	/** The place of an entity as the view shows it now. */
	meshOf(entity: Entity): THREE.Mesh {
		return this.bodies[entity.id].mesh;
	}

	setLights(sim: Sim): void {
		this.lightMaterials[0].color.setHex(LIGHT_COLOURS[sim.lightColor(0)]);
		this.lightMaterials[1].color.setHex(LIGHT_COLOURS[sim.lightColor(1)]);
	}

	setAim(visible: boolean, x: number, z: number, headingDeg: number, pulse: number): void {
		this.aimArrow.visible = visible;
		if (!visible) return;
		this.aimArrow.position.x = x;
		this.aimArrow.position.z = z;
		this.aimArrow.rotation.y = headingDeg * DEG;
		this.aimMaterial.opacity = 0.6 + 0.3 * Math.sin(pulse * 5);
	}

	private clearLevel(): void {
		this.level.traverse((object) => {
			const mesh = object as THREE.Mesh;
			if (!mesh.isMesh) return;
			mesh.geometry.dispose();
			const material = mesh.material as THREE.Material;
			if (!this.lightMaterials.includes(material as THREE.MeshBasicMaterial)) material.dispose();
		});
		this.level.clear();
		this.bodies = [];
	}

	private addSky(theme: Theme): void {
		const geometry = new THREE.SphereGeometry(600, 24, 12);
		const top = new THREE.Color(theme.skyTop);
		const low = new THREE.Color(theme.skyHorizon);
		const mixed = new THREE.Color();
		const position = geometry.getAttribute('position');
		const colours = new Float32Array(position.count * 3);
		for (let i = 0; i < position.count; i++) {
			const t = Math.max(0, Math.min(1, position.getY(i) / 330));
			mixed.copy(low).lerp(top, Math.pow(t, 0.7));
			colours.set([mixed.r, mixed.g, mixed.b], i * 3);
		}
		geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
		const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
		sky.renderOrder = -1;
		this.level.add(sky);
	}

	private addGround(def: LevelDef, theme: Theme): void {
		const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: theme.ground }));
		ground.receiveShadow = true;
		this.level.add(ground);

		const roadMaterial = new THREE.MeshLambertMaterial({ color: theme.road });
		def.roads.forEach((road, index) => {
			const length = Math.hypot(road.b[0] - road.a[0], road.b[1] - road.a[1]);
			const mesh = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth(road), length + 0.2).rotateX(-Math.PI / 2), roadMaterial);
			mesh.position.set((road.a[0] + road.b[0]) / 2, 0.02 + index * 0.002, (road.a[1] + road.b[1]) / 2);
			mesh.rotation.y = Math.atan2(road.b[0] - road.a[0], road.b[1] - road.a[1]);
			mesh.receiveShadow = true;
			this.level.add(mesh);
		});
		for (const ring of def.rings ?? []) {
			const half = (ring.lanes * CONFIG.traffic.laneWidth + 0.8) / 2;
			const mesh = new THREE.Mesh(new THREE.RingGeometry(ring.radius - half, ring.radius + half, 56).rotateX(-Math.PI / 2), roadMaterial);
			mesh.position.set(ring.centre[0], 0.035, ring.centre[1]);
			mesh.receiveShadow = true;
			this.level.add(mesh);
			const island = new THREE.Mesh(new THREE.CircleGeometry(ring.radius - half, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: theme.pavement }));
			island.position.set(ring.centre[0], 0.03, ring.centre[1]);
			island.receiveShadow = true;
			this.level.add(island);
		}

		// Painted lines between lanes. A dash is left out where another road crosses.
		const dashes: number[][] = [];
		def.roads.forEach((road, index) => {
			if (road.lanes < 2) return;
			const length = Math.hypot(road.b[0] - road.a[0], road.b[1] - road.a[1]);
			const dx = (road.b[0] - road.a[0]) / length;
			const dz = (road.b[1] - road.a[1]) / length;
			const yaw = Math.atan2(dx, dz);
			for (let k = 1; k < road.lanes; k++) {
				const side = (k - road.lanes / 2) * CONFIG.traffic.laneWidth;
				const centre = k === road.lanes / 2;
				const stepLength = centre ? 3 : 7;
				for (let d = 2; d < length - 2; d += stepLength) {
					const x = road.a[0] + dx * d + dz * side;
					const z = road.a[1] + dz * d - dx * side;
					if (insideOtherRoad(def, index, x, z, 0.4)) continue;
					dashes.push([x, z, yaw, centre ? 3.05 : 2.6]);
				}
			}
		});
		for (const ring of def.rings ?? []) {
			const count = Math.floor((ring.radius * Math.PI * 2) / 6);
			for (let i = 0; i < count; i++) {
				const angle = (i / count) * Math.PI * 2;
				dashes.push([ring.centre[0] + Math.sin(angle) * ring.radius, ring.centre[1] + Math.cos(angle) * ring.radius, angle + Math.PI / 2, 2.4]);
			}
		}
		if (dashes.length > 0) {
			const lines = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: theme.line }), dashes.length);
			const dummy = new THREE.Object3D();
			dashes.forEach((dash, i) => {
				dummy.position.set(dash[0], 0.06, dash[1]);
				dummy.rotation.set(0, dash[2], 0);
				dummy.scale.set(1, 1, dash[3]);
				dummy.updateMatrix();
				lines.setMatrixAt(i, dummy.matrix);
			});
			this.level.add(lines);
		}
	}

	private addStopLines(def: LevelDef, sim: Sim): void {
		const place = { x: 0, z: 0, dx: 0, dz: 1 };
		for (const lane of sim.lanes) {
			if (lane.def.phase === undefined || lane.def.stopAt === undefined) continue;
			lanePlace(lane, lane.def.stopAt, place);
			const yaw = Math.atan2(place.dx, place.dz);
			const bar = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.traffic.laneWidth - 0.5, 0.55).rotateX(-Math.PI / 2), this.lightMaterials[lane.def.phase]);
			bar.position.set(place.x, 0.07, place.z);
			bar.rotation.y = yaw;
			this.level.add(bar);
			const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), this.lightMaterials[lane.def.phase]);
			post.position.set(place.x, 6.2, place.z);
			this.level.add(post);
		}
		void def;
	}

	private addBuildings(def: LevelDef, theme: Theme): void {
		const pavement = new THREE.MeshLambertMaterial({ color: theme.pavement });
		const windows = theme.windowsLit ? new THREE.MeshBasicMaterial({ color: theme.windows }) : new THREE.MeshLambertMaterial({ color: theme.windows });
		const walls = theme.buildings.map((hex) => new THREE.MeshLambertMaterial({ color: hex }));
		const roofs = theme.buildings.map((hex) => new THREE.MeshLambertMaterial({ color: new THREE.Color(hex).multiplyScalar(0.8) }));
		const rng = makeRng(hashText(def.id + 'town'));

		def.buildings.forEach((b, index) => {
			const [w, h, d] = b.size;
			const group = new THREE.Group();
			group.position.set(b.at[0], 0, b.at[1]);
			group.rotation.y = (b.heading ?? 0) * DEG;
			const tone = (index + Math.floor(rng() * 2)) % walls.length;

			const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), walls[tone]);
			wall.position.y = h / 2;
			wall.castShadow = true;
			wall.receiveShadow = true;
			group.add(wall);

			const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 2.4, 0.16, d + 2.4), pavement);
			slab.position.y = 0.08;
			slab.receiveShadow = true;
			group.add(slab);

			const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.45, d + 0.5), roofs[tone]);
			cap.position.y = h + 0.2;
			cap.castShadow = true;
			group.add(cap);

			if (h > 6 && Math.min(w, d) > 7) {
				const hut = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 1.6, d * 0.3), roofs[tone]);
				hut.position.set((rng() - 0.5) * w * 0.4, h + 1.2, (rng() - 0.5) * d * 0.4);
				hut.castShadow = true;
				group.add(hut);
			}

			if (h >= 5) {
				for (let y = 2.2; y < h - 1; y += 3.1) {
					const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 1.15, d + 0.08), windows);
					band.position.y = y;
					group.add(band);
				}
				const posts = Math.max(2, Math.round(w / 3.4));
				for (let i = 1; i < posts; i++) {
					const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, d + 0.14), walls[tone]);
					post.position.set(-w / 2 + (w / posts) * i, h / 2, 0);
					group.add(post);
				}
				const cross = Math.max(2, Math.round(d / 3.4));
				for (let i = 1; i < cross; i++) {
					const post = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h, 0.5), walls[tone]);
					post.position.set(0, h / 2, -d / 2 + (d / cross) * i);
					group.add(post);
				}
			}
			this.level.add(group);
		});
	}

	private addTrees(def: LevelDef, theme: Theme): void {
		const rng = makeRng(hashText(def.id + 'trees'));
		const places: number[][] = [];
		const launchYaw = def.launch.heading * DEG;
		for (let tries = 0; tries < 900 && places.length < 150; tries++) {
			const x = (rng() - 0.5) * 300;
			const z = (rng() - 0.5) * 300;
			const size = 0.8 + rng() * 0.7;
			if (insideOtherRoad(def, -1, x, z, 3.5)) continue;
			if (def.buildings.some((b) => Math.hypot(x - b.at[0], z - b.at[1]) < Math.hypot(b.size[0], b.size[2]) / 2 + 2.5)) continue;
			if ((def.parked ?? []).some((p) => Math.hypot(x - p.at[0], z - p.at[1]) < 8)) continue;
			if ((def.barrels ?? []).some((p) => Math.hypot(x - p[0], z - p[1]) < 5)) continue;
			// Keep the view from the launch place clear.
			const rx = x - def.launch.at[0];
			const rz = z - def.launch.at[1];
			const along = rx * Math.sin(launchYaw) + rz * Math.cos(launchYaw);
			const across = Math.abs(rx * Math.cos(launchYaw) - rz * Math.sin(launchYaw));
			if (along > -30 && along < 90 && across < 9 + along * 0.28) continue;
			places.push([x, z, size, rng()]);
		}
		const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 5).translate(0, 0.8, 0), new THREE.MeshLambertMaterial({ color: 0x6b4a3a }), places.length);
		const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 4.2, 6).translate(0, 3.5, 0), new THREE.MeshLambertMaterial({ color: theme.tree, flatShading: true }), places.length);
		const dummy = new THREE.Object3D();
		const tint = new THREE.Color();
		places.forEach((p, i) => {
			dummy.position.set(p[0], 0, p[1]);
			dummy.rotation.set(0, p[3] * 6, 0);
			dummy.scale.setScalar(p[2]);
			dummy.updateMatrix();
			trunks.setMatrixAt(i, dummy.matrix);
			crowns.setMatrixAt(i, dummy.matrix);
			crowns.setColorAt(i, tint.setScalar(0.82 + p[3] * 0.36));
		});
		crowns.castShadow = true;
		trunks.castShadow = true;
		this.level.add(trunks, crowns);
	}
}

function roadWidth(road: RoadDef): number {
	return road.lanes * CONFIG.traffic.laneWidth + 0.8;
}

/** True when a point is on a road or a ring, other than the road with the index `skip`. */
function insideOtherRoad(def: LevelDef, skip: number, x: number, z: number, margin: number): boolean {
	for (let i = 0; i < def.roads.length; i++) {
		if (i === skip) continue;
		const road = def.roads[i];
		const length = Math.hypot(road.b[0] - road.a[0], road.b[1] - road.a[1]);
		const dx = (road.b[0] - road.a[0]) / length;
		const dz = (road.b[1] - road.a[1]) / length;
		const along = (x - road.a[0]) * dx + (z - road.a[1]) * dz;
		const across = Math.abs((x - road.a[0]) * dz - (z - road.a[1]) * dx);
		if (along > -margin && along < length + margin && across < roadWidth(road) / 2 + margin) return true;
	}
	for (const ring of def.rings ?? []) {
		const half = (ring.lanes * CONFIG.traffic.laneWidth + 0.8) / 2;
		if (Math.hypot(x - ring.centre[0], z - ring.centre[1]) < ring.radius + half + margin) return true;
	}
	return false;
}
