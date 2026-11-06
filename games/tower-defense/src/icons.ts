import * as THREE from 'three';
import { model } from './assets';
import { ENEMIES, type EnemyId } from './data/enemies';
import { TOWERS, type Branch, type TowerId } from './data/towers';
import { buildTowerLook } from './game/tower';

// Small pictures of towers and enemies for the UI, rendered once from the 3D models.
const icons = new Map<string, string>();

export function makeIcons(): void {
	const size = 128;
	const canvas = document.createElement('canvas');
	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
	renderer.setSize(size, size, false);
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	const scene = new THREE.Scene();
	scene.add(new THREE.HemisphereLight(0xffffff, 0x7a6a8a, 2));
	const sun = new THREE.DirectionalLight(0xffffff, 1.8);
	sun.position.set(-3, 5, 4);
	scene.add(sun);
	const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

	const shoot = (key: string, object: THREE.Object3D): void => {
		scene.add(object);
		const box = new THREE.Box3().setFromObject(object);
		const center = box.getCenter(new THREE.Vector3());
		const size = box.getSize(new THREE.Vector3());
		// Frame the biggest side, so tall towers fill the picture too.
		const span = Math.max(size.y, size.x, size.z) * 1.15;
		const dir = new THREE.Vector3(0.6, 0.55, 1).normalize();
		camera.position.copy(center).addScaledVector(dir, span / 2 / Math.tan(THREE.MathUtils.degToRad(15)));
		camera.lookAt(center);
		renderer.render(scene, camera);
		icons.set(key, canvas.toDataURL());
		scene.remove(object);
	};

	for (const id of Object.keys(TOWERS) as TowerId[]) {
		const def = TOWERS[id];
		const levels = [def.levels[0], def.levels[1], def.branches.a, def.branches.b];
		const keys = ['1', '2', 'a', 'b'];
		levels.forEach((level, i) => {
			const look = buildTowerLook(def, level);
			look.weapon.rotation.y = 0.5;
			shoot(`tower-${id}-${keys[i]}`, look.root);
		});
	}
	for (const id of Object.keys(ENEMIES) as EnemyId[]) {
		const def = ENEMIES[id];
		shoot(`enemy-${id}`, model(def.model));
		shoot(`enemy-${id}-elite`, model(def.eliteModel));
	}
	renderer.dispose();
}

export function towerIcon(id: TowerId, level: number, branch: Branch | null = null): string {
	const key = level === 3 && branch ? branch : String(Math.min(level, 2));
	return icons.get(`tower-${id}-${key}`) ?? '';
}

export function enemyIcon(id: EnemyId, elite = false): string {
	return icons.get(`enemy-${id}${elite ? '-elite' : ''}`) ?? '';
}
