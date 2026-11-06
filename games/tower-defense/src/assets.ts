import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Kenney Tower Defense Kit models live in public/models/. Each loads once, then clones share
// geometry and material.
const cache = new Map<string, THREE.Object3D>();

export async function loadModels(names: string[], onProgress: (done: number, total: number) => void): Promise<void> {
	const loader = new GLTFLoader();
	let done = 0;
	await Promise.all(
		names.map(async (name) => {
			const gltf = await loader.loadAsync(`models/${name}.glb`);
			gltf.scene.traverse((node) => {
				const mesh = node as THREE.Mesh;
				if (!mesh.isMesh) return;
				mesh.castShadow = true;
				mesh.receiveShadow = true;
			});
			cache.set(name, gltf.scene);
			done += 1;
			onProgress(done, names.length);
		}),
	);
}

export function model(name: string): THREE.Object3D {
	const source = cache.get(name);
	if (!source) throw new Error(`Model not loaded: ${name}`);
	return source.clone(true);
}

export function hasModel(name: string): boolean {
	return cache.has(name);
}

/** Gives the clone its own materials, so a flash or tint on it does not touch other clones. */
export function ownMaterials(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
	const materials: THREE.MeshStandardMaterial[] = [];
	root.traverse((node) => {
		const mesh = node as THREE.Mesh;
		if (!mesh.isMesh) return;
		const material = (mesh.material as THREE.MeshStandardMaterial).clone();
		mesh.material = material;
		materials.push(material);
	});
	return materials;
}

export function tint(root: THREE.Object3D, color: number, emissive = 0): void {
	for (const material of ownMaterials(root)) {
		material.color.multiply(new THREE.Color(color));
		if (emissive) {
			material.emissive = new THREE.Color(color);
			material.emissiveIntensity = emissive;
		}
	}
}

export const TILE_MODELS = [
	'tile',
	'tile-straight',
	'tile-corner-square',
	'tile-split',
	'tile-crossing',
	'tile-end',
	'tile-end-round',
	'tile-spawn-end',
	'tile-spawn',
	'tile-tree',
	'tile-tree-double',
	'tile-tree-quad',
	'tile-rock',
	'tile-crystal',
	'tile-hill',
	'tile-bump',
	'tile-river-straight',
	'tile-river-corner',
	'tile-river-bridge',
];

export const DETAIL_MODELS = ['detail-tree', 'detail-tree-large', 'detail-rocks', 'detail-crystal', 'detail-crystal-large'];

export const OTHER_MODELS = [
	'selection-a',
	'selection-b',
	'spawn-round',
	'tower-round-bottom-a',
	'tower-round-bottom-b',
	'tower-round-bottom-c',
	'tower-round-middle-a',
	'tower-round-middle-b',
	'tower-round-middle-c',
	'tower-round-top-a',
	'tower-round-top-b',
	'tower-round-top-c',
	'tower-round-crystals',
	'tower-square-bottom-a',
	'tower-square-bottom-b',
	'tower-square-bottom-c',
	'tower-square-middle-a',
	'tower-square-middle-b',
	'tower-square-middle-c',
	'tower-square-top-a',
	'tower-square-top-b',
	'tower-square-top-c',
	'weapon-ballista',
	'weapon-cannon',
	'weapon-catapult',
	'weapon-ammo-arrow',
	'weapon-ammo-boulder',
	'weapon-ammo-cannonball',
	'enemy-ufo-a',
	'enemy-ufo-b',
	'enemy-ufo-c',
	'enemy-ufo-d',
	'enemy-ufo-a-weapon',
	'enemy-ufo-b-weapon',
	'enemy-ufo-c-weapon',
	'enemy-ufo-d-weapon',
	'enemy-ufo-beam',
];

export function allModelNames(): string[] {
	const snow = [...TILE_MODELS, ...DETAIL_MODELS].map((name) => `snow-${name}`);
	return [...TILE_MODELS, ...DETAIL_MODELS, ...snow, ...OTHER_MODELS];
}
