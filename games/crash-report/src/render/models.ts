import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import muscleCarUrl from '../../3d-assets/muscle-car.glb?url';
import { CONFIG } from '../config.ts';
import type { EntityKind } from '../sim/sim.ts';

/**
 * Low-poly models made from boxes and cylinders, with one flat colour for each part.
 * Each model is one mesh. Its centre is the centre of its physics box, and it points to +z.
 * The player car is the exception: a group of parts loaded from `3d-assets/muscle-car.glb`.
 */

const PAINTS = [0xe9c46a, 0x2a9d8f, 0xe76f51, 0xf4f1de, 0x8ecae6, 0xb56576, 0x7a6fa8, 0x9db17c, 0xf7f7f2, 0x4f7cac];
const BUS_PAINTS = [0xf6bd60, 0xe5534b, 0x3fa7a0];
const VAN_PAINTS = [0xf4f1de, 0x8ecae6, 0xd9a35f, 0x9db17c];
const GLASS = 0x26324a;
const TYRE = 0x1f2128;
const LAMP = 0xfff3b0;
const TAIL = 0xe5383b;
const STEEL = 0xcfd6dd;

const colour = new THREE.Color();

function paintGeometry(geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
	const flat = geometry.index ? geometry.toNonIndexed() : geometry;
	const count = flat.getAttribute('position').count;
	const colours = new Float32Array(count * 3);
	colour.setHex(hex);
	for (let i = 0; i < count; i++) colours.set([colour.r, colour.g, colour.b], i * 3);
	flat.setAttribute('color', new THREE.BufferAttribute(colours, 3));
	flat.deleteAttribute('uv');
	return flat;
}

function box(w: number, h: number, l: number, x: number, y: number, z: number, hex: number): THREE.BufferGeometry {
	return paintGeometry(new THREE.BoxGeometry(w, h, l).translate(x, y, z), hex);
}

function wheel(radius: number, x: number, y: number, z: number): THREE.BufferGeometry {
	return paintGeometry(new THREE.CylinderGeometry(radius, radius, 0.32, 8).rotateZ(Math.PI / 2).translate(x, y, z), TYRE);
}

function wheels(w: number, h: number, radius: number, places: number[]): THREE.BufferGeometry[] {
	const parts: THREE.BufferGeometry[] = [];
	const y = -h / 2 + radius - 0.02;
	for (const z of places) {
		parts.push(wheel(radius, w / 2 - 0.1, y, z), wheel(radius, -w / 2 + 0.1, y, z));
	}
	return parts;
}

function lamps(w: number, y: number, l: number): THREE.BufferGeometry[] {
	return [
		box(0.36, 0.2, 0.08, w * 0.3, y, l / 2, LAMP),
		box(0.36, 0.2, 0.08, -w * 0.3, y, l / 2, LAMP),
		box(0.36, 0.18, 0.08, w * 0.3, y, -l / 2, TAIL),
		box(0.36, 0.18, 0.08, -w * 0.3, y, -l / 2, TAIL),
	];
}

function pick(list: number[], paint: number): number {
	return list[Math.min(list.length - 1, Math.floor(paint * list.length))];
}

function carParts(w: number, h: number, l: number, paint: number): THREE.BufferGeometry[] {
	const body = pick(PAINTS, paint);
	const floor = -h / 2 + 0.2;
	const deck = h * 0.46;
	const cabin = h - 0.2 - deck;
	return [
		box(w, deck, l, 0, floor + deck / 2, 0, body),
		box(w * 0.88, cabin - 0.08, l * 0.5, 0, floor + deck + (cabin - 0.08) / 2, -l * 0.06, GLASS),
		box(w * 0.9, 0.09, l * 0.44, 0, h / 2 - 0.045, -l * 0.06, body),
		...lamps(w, floor + deck * 0.6, l + 0.02),
		...wheels(w, h, 0.36, [l * 0.31, -l * 0.31]),
	];
}

function vanParts(w: number, h: number, l: number, paint: number): THREE.BufferGeometry[] {
	const body = pick(VAN_PAINTS, paint);
	const floor = -h / 2 + 0.25;
	const tall = h - 0.25;
	return [
		box(w, tall, l * 0.74, 0, floor + tall / 2, -l * 0.13, body),
		box(w, tall * 0.55, l * 0.26, 0, floor + tall * 0.275, l * 0.37, body),
		box(w * 0.92, tall * 0.4, l * 0.2, 0, floor + tall * 0.72, l * 0.3, GLASS),
		box(w * 0.94, 0.08, l * 0.2, 0, floor + tall * 0.93, l * 0.3, body),
		...lamps(w, floor + tall * 0.28, l + 0.02),
		...wheels(w, h, 0.4, [l * 0.32, -l * 0.3]),
	];
}

function busParts(w: number, h: number, l: number, paint: number): THREE.BufferGeometry[] {
	const body = pick(BUS_PAINTS, paint);
	const floor = -h / 2 + 0.3;
	const tall = h - 0.3;
	return [
		box(w, tall, l, 0, floor + tall / 2, 0, body),
		box(w + 0.04, tall * 0.3, l * 0.9, 0, floor + tall * 0.64, -l * 0.02, GLASS),
		box(w * 0.9, tall * 0.34, 0.1, 0, floor + tall * 0.62, l / 2, GLASS),
		box(w + 0.06, 0.16, l + 0.04, 0, floor + tall * 0.3, 0, 0xf7f3e8),
		...lamps(w, floor + tall * 0.16, l + 0.04),
		...wheels(w, h, 0.48, [l * 0.34, -l * 0.22, -l * 0.34]),
	];
}

function tankerParts(w: number, h: number, l: number, paint: number): THREE.BufferGeometry[] {
	const cab = pick([0xe5534b, 0x3d6fb4, 0x2f9e77], paint);
	const floor = -h / 2 + 0.35;
	const cabLength = l * 0.2;
	const tankLength = l * 0.74;
	const radius = (h - 0.75) / 2;
	const tankZ = -l / 2 + tankLength / 2 + 0.1;
	const tank = new THREE.CylinderGeometry(radius, radius, tankLength, 10).rotateX(Math.PI / 2).translate(0, floor + 0.3 + radius, tankZ);
	const band = new THREE.CylinderGeometry(radius + 0.04, radius + 0.04, 0.5, 10).rotateX(Math.PI / 2);
	return [
		box(w * 0.8, 0.3, l, 0, floor + 0.15, 0, 0x30333d),
		paintGeometry(tank, STEEL),
		paintGeometry(band.clone().translate(0, floor + 0.3 + radius, tankZ + tankLength * 0.3), 0xf2a541),
		paintGeometry(band.translate(0, floor + 0.3 + radius, tankZ - tankLength * 0.3), 0xf2a541),
		box(w, h * 0.72, cabLength, 0, floor + h * 0.36, l / 2 - cabLength / 2, cab),
		box(w * 0.92, h * 0.26, 0.1, 0, floor + h * 0.52, l / 2, GLASS),
		...lamps(w, floor + 0.5, l + 0.04),
		...wheels(w, h, 0.5, [l * 0.38, -l * 0.18, -l * 0.36]),
	];
}

function playerParts(w: number, h: number, l: number): THREE.BufferGeometry[] {
	const body = 0xff5a1f;
	const stripe = 0xfff6e5;
	const floor = -h / 2 + 0.16;
	const deck = h * 0.44;
	return [
		box(w, deck, l, 0, floor + deck / 2, 0, body),
		box(w * 0.84, h * 0.34, l * 0.42, 0, floor + deck + h * 0.17, -l * 0.08, GLASS),
		box(w * 0.86, 0.08, l * 0.36, 0, floor + deck + h * 0.34 + 0.04, -l * 0.08, body),
		box(w * 0.26, 0.03, l + 0.02, 0, floor + deck + 0.015, 0, stripe),
		box(w * 0.26, 0.03, l * 0.36, 0, floor + deck + h * 0.34 + 0.095, -l * 0.08, stripe),
		box(w * 1.02, 0.07, 0.42, 0, floor + deck + 0.4, -l / 2 + 0.25, 0x23252e),
		box(0.1, 0.4, 0.1, w * 0.36, floor + deck + 0.2, -l / 2 + 0.25, 0x23252e),
		box(0.1, 0.4, 0.1, -w * 0.36, floor + deck + 0.2, -l / 2 + 0.25, 0x23252e),
		box(w * 1.04, 0.14, 0.3, 0, floor + 0.07, l / 2, 0x23252e),
		...lamps(w, floor + deck * 0.62, l + 0.02),
		...wheels(w + 0.08, h, 0.4, [l * 0.31, -l * 0.31]),
	];
}

function barrelParts(): THREE.BufferGeometry[] {
	return [
		paintGeometry(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 10), 0xd62828),
		paintGeometry(new THREE.CylinderGeometry(0.44, 0.44, 0.22, 10).translate(0, 0.12, 0), 0xffd23f),
		paintGeometry(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 10).translate(0, 0.61, 0), 0x7a1c1c),
	];
}

let playerTemplate: THREE.Group | null = null;

/**
 * Loads the player car from the .glb file. Call it once before the first level.
 * If the file cannot load, the player gets the old box car.
 */
export async function loadModels(): Promise<void> {
	try {
		const gltf = await new GLTFLoader().loadAsync(muscleCarUrl);
		playerTemplate = fitPlayer(gltf.scene);
	} catch (error) {
		console.warn('The player car model did not load. The box car is used.', error);
	}
}

/** Scales the car to the length of the player box, puts it on the floor of the box, and turns it to +z. */
function fitPlayer(scene: THREE.Group): THREE.Group {
	const [, h, l] = CONFIG.player.size;
	const car = new THREE.Group();
	scene.rotation.y = Math.PI; // Blender's front (+y) becomes -z in glTF.
	car.add(scene);
	const bounds = new THREE.Box3().setFromObject(car);
	const size = bounds.getSize(new THREE.Vector3());
	const scale = l / size.z;
	scene.scale.setScalar(scale);
	bounds.setFromObject(car);
	const centre = bounds.getCenter(new THREE.Vector3());
	scene.position.set(-centre.x, -h / 2 - bounds.min.y, -centre.z);

	scene.traverse((object) => {
		const mesh = object as THREE.Mesh;
		if (!mesh.isMesh) return;
		const source = mesh.material as THREE.MeshStandardMaterial;
		if (source.map) source.map.magFilter = THREE.NearestFilter;
		// Lambert like the rest of the scene. Metal without an environment map would look black.
		mesh.material = new THREE.MeshLambertMaterial({
			name: source.name,
			color: source.color,
			map: source.map,
			emissive: source.emissive,
			emissiveIntensity: source.emissiveIntensity,
		});
		source.dispose();
		mesh.castShadow = true;
		mesh.receiveShadow = true;
	});
	return car;
}

/** A copy of the player car with its own geometry and materials, so a level can dispose of it. */
function clonePlayer(template: THREE.Group): THREE.Group {
	const car = template.clone(true);
	car.traverse((object) => {
		const mesh = object as THREE.Mesh;
		if (!mesh.isMesh) return;
		mesh.geometry = mesh.geometry.clone();
		mesh.material = (mesh.material as THREE.Material).clone();
	});
	return car;
}

/** Makes the model of one entity. Each model has its own materials, so a wreck can turn dark. */
export function makeModel(kind: EntityKind, paint: number): THREE.Object3D {
	if (kind === 'player' && playerTemplate) return clonePlayer(playerTemplate);
	let parts: THREE.BufferGeometry[];
	if (kind === 'barrel') {
		parts = barrelParts();
	} else if (kind === 'player') {
		const [w, h, l] = CONFIG.player.size;
		parts = playerParts(w, h, l);
	} else {
		const [w, h, l] = CONFIG.vehicles[kind].size;
		const builders = { car: carParts, van: vanParts, bus: busParts, tanker: tankerParts };
		parts = builders[kind](w, h, l, paint);
	}
	const geometry = mergeGeometries(parts);
	for (const part of parts) part.dispose();
	const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
	const mesh = new THREE.Mesh(geometry, material);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}
