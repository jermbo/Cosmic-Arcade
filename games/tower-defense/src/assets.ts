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
			if (name === 'weapon-ballista') splitBallista(gltf.scene);
			cache.set(name, gltf.scene);
			done += 1;
			onProgress(done, names.length);
		}),
	);
}

/**
 * The ballista's arm is one mesh: the bow, two struts and the loaded bolt. Splits the bolt into its
 * own child named "bolt", so it can leave on a shot while the bow stays. Also keeps a copy of the
 * bolt, centered, as the 'ballista-bolt' model for flying bolts.
 */
function splitBallista(root: THREE.Object3D): void {
	const arm = root.getObjectByName('arrow') as THREE.Mesh | undefined;
	if (!arm?.isMesh) return;
	const geometry = arm.geometry;
	const pos = geometry.getAttribute('position');
	const index = geometry.index;
	if (!index) return;
	// Group triangles into pieces that share corners.
	const key = (i: number): string => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
	const parent = new Map<string, string>();
	const find = (k: string): string => {
		while (parent.get(k) !== k) k = parent.get(k)!;
		return k;
	};
	for (let t = 0; t < index.count; t += 3) {
		const keys = [key(index.getX(t)), key(index.getX(t + 1)), key(index.getX(t + 2))];
		for (const k of keys) if (!parent.has(k)) parent.set(k, k);
		for (const k of keys.slice(1)) parent.set(find(k), find(keys[0]));
	}
	const pieces = new Map<string, { tris: number[]; box: THREE.Box3 }>();
	const corner = new THREE.Vector3();
	for (let t = 0; t < index.count; t += 3) {
		const root = find(key(index.getX(t)));
		const piece = pieces.get(root) ?? { tris: [], box: new THREE.Box3() };
		for (let k = 0; k < 3; k++) {
			piece.tris.push(index.getX(t + k));
			piece.box.expandByPoint(corner.fromBufferAttribute(pos, index.getX(t + k)));
		}
		pieces.set(root, piece);
	}
	// The bolt is the long, thin piece.
	const bolt = [...pieces.values()].find(({ box }) => box.max.z - box.min.z > 0.6 && box.max.x - box.min.x < 0.2);
	if (!bolt) return;
	const rest = [...pieces.values()].filter((piece) => piece !== bolt).flatMap((piece) => piece.tris);
	const bowGeometry = geometry.clone();
	bowGeometry.setIndex(rest);
	const boltGeometry = geometry.clone();
	boltGeometry.setIndex(bolt.tris);
	arm.geometry = bowGeometry;
	arm.name = 'arm';
	const boltMesh = new THREE.Mesh(boltGeometry, arm.material);
	boltMesh.name = 'bolt';
	boltMesh.castShadow = true;
	arm.add(boltMesh);

	const flying = new THREE.Group();
	const centered = new THREE.Mesh(boltGeometry.clone(), arm.material);
	const center = bolt.box.getCenter(new THREE.Vector3());
	centered.geometry.translate(-center.x, -center.y, -center.z);
	centered.castShadow = true;
	flying.add(centered);
	cache.set('ballista-bolt', flying);
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
