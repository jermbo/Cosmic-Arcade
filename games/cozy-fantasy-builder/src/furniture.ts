/**
 * Things for inside a home: beds, seats, tables, lamps, rugs, plants and small things.
 * One tile of a room is one unit. Each model stands on y = 0 at the centre of its tiles.
 * At facing 0 a thing faces +z, into the room from the back wall.
 */

import * as THREE from 'three';
import { Kit } from './models.ts';
import { pick } from './util.ts';

export type FurnCat = 'beds' | 'seats' | 'tables' | 'storage' | 'kitchen' | 'lights' | 'rugs' | 'plants' | 'decor';

/**
 * Where a thing goes. `floor`: on the floor. `rug`: flat on the floor, things stand on it.
 * `wall`: on a wall, next to the tile. `top`: on a table or on the floor. `ceiling`: hangs down.
 */
export type Place = 'floor' | 'rug' | 'wall' | 'top' | 'ceiling';

export interface FurnDef {
	id: string;
	name: string;
	cat: FurnCat;
	/** Tiles across and deep, at facing 0. */
	w: number;
	d: number;
	place: Place;
	/** Walkers cannot pass it. */
	block: boolean;
	/** Small things can stand on it, at this height. */
	surface?: number;
	/** It gives light: the height of the light and its colour. */
	light?: { y: number; color: number; power: number };
	/** Colour choices. The first is the main colour. */
	colors: number[];
	build: (k: Kit, c: number, rand: () => number) => void;
	/** An elf sleeps here. */
	bed?: boolean;
}

export const CATS: { id: FurnCat; name: string }[] = [
	{ id: 'beds', name: 'Beds' },
	{ id: 'seats', name: 'Seats' },
	{ id: 'tables', name: 'Tables' },
	{ id: 'storage', name: 'Storage' },
	{ id: 'kitchen', name: 'Kitchen' },
	{ id: 'lights', name: 'Lights' },
	{ id: 'rugs', name: 'Rugs' },
	{ id: 'plants', name: 'Plants' },
	{ id: 'decor', name: 'Nice things' },
];

const WOOD = 0xc49a6c;
const WOOD_DARK = 0x9a7450;
const WOOD_DEEP = 0x6e4f3a;
const CREAM = 0xfff4e2;
const GOLD = 0xffe7a3;
const STONE = 0xb9b8c8;
const LEAF = 0x4fae78;
const LEAF2 = 0x6fc487;

const FABRIC = [0xe86f86, 0x5f8fd0, 0x4fae78, 0xd9a441, 0x8a6fc8, 0x4fb0a8, 0xf2a03c, 0xb86fa8];
const WOODS = [WOOD, WOOD_DARK, 0xe0c094, 0x8a6248];
const POTS = [0xc8664a, 0xe8c98a, 0x8fb7c9, 0xb86fa8];

/* Helpers */

function legs(k: Kit, color: number, w: number, d: number, h: number, t = 0.06): void {
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('solid', color, t, h, t, sx * (w / 2 - t), 0, sz * (d / 2 - t));
}

function quilt(k: Kit, c: number, w: number, d: number, y: number, z: number): void {
	k.box('solid', c, w, 0.08, d, 0, y, z);
	// A stripe across the quilt.
	k.box('solid', 0xffffff, w + 0.01, 0.085, 0.08, 0, y, z - d * 0.2);
}

function book(k: Kit, x: number, y: number, z: number, rand: () => number, ry = 0): void {
	k.box('solid', pick(FABRIC, rand()), 0.05 + rand() * 0.03, 0.18 + rand() * 0.06, 0.15, x, y, z, { ry, rz: (rand() - 0.5) * 0.15 });
}

function leaves(k: Kit, x: number, y: number, z: number, r: number, rand: () => number, n = 5): void {
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 + rand();
		k.ball('solid', i % 2 ? LEAF : LEAF2, r * (0.55 + rand() * 0.3), x + Math.cos(a) * r * 0.55, y + rand() * r * 0.6, z + Math.sin(a) * r * 0.55, { sy: 0.8 });
	}
}

/* The catalog */

export const FURNITURE: FurnDef[] = [
	// Beds
	{
		id: 'bed', name: 'Bed', cat: 'beds', w: 1, d: 2, place: 'floor', block: true, bed: true, colors: FABRIC,
		build: (k, c) => {
			k.box('solid', WOOD, 0.9, 0.3, 1.8, 0, 0.08, 0);
			legs(k, WOOD_DARK, 0.9, 1.8, 0.1, 0.08);
			k.box('solid', WOOD_DARK, 0.94, 0.75, 0.08, 0, 0, -0.92);
			k.cyl('solid', WOOD_DARK, 0.47, 0.47, 0.08, 10, 0, 0.75, -0.92, { rx: Math.PI / 2, sy: 1, sz: 1 });
			k.box('solid', 0xffffff, 0.8, 0.08, 1.7, 0, 0.38, 0);
			k.box('solid', CREAM, 0.6, 0.12, 0.3, 0, 0.44, -0.66);
			quilt(k, c, 0.86, 1.1, 0.42, 0.3);
		},
	},
	{
		id: 'bigbed', name: 'Big bed', cat: 'beds', w: 2, d: 2, place: 'floor', block: true, bed: true, colors: FABRIC,
		build: (k, c) => {
			k.box('solid', WOOD, 1.86, 0.3, 1.8, 0, 0.08, 0);
			legs(k, WOOD_DARK, 1.86, 1.8, 0.1, 0.08);
			k.box('solid', WOOD_DARK, 1.92, 0.95, 0.1, 0, 0, -0.92);
			for (const sx of [-1, 1]) k.ball('solid', GOLD, 0.06, sx * 0.9, 1.0, -0.92);
			k.box('solid', 0xffffff, 1.76, 0.08, 1.7, 0, 0.38, 0);
			for (const sx of [-1, 1]) k.box('solid', CREAM, 0.6, 0.13, 0.3, sx * 0.42, 0.44, -0.66);
			quilt(k, c, 1.82, 1.1, 0.42, 0.3);
		},
	},
	{
		id: 'bunk', name: 'Bunk bed', cat: 'beds', w: 1, d: 2, place: 'floor', block: true, bed: true, colors: FABRIC,
		build: (k, c, rand) => {
			for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('solid', WOOD_DARK, 0.08, 1.7, 0.08, sx * 0.43, 0, sz * 0.86);
			for (const y of [0.15, 1.0]) {
				k.box('solid', WOOD, 0.9, 0.12, 1.8, 0, y, 0);
				k.box('solid', 0xffffff, 0.8, 0.08, 1.7, 0, y + 0.12, 0);
				k.box('solid', CREAM, 0.55, 0.1, 0.28, 0, y + 0.18, -0.66);
				quilt(k, y > 0.5 ? pick(FABRIC, rand()) : c, 0.86, 1.1, y + 0.16, 0.3);
			}
			k.box('solid', WOOD_DARK, 0.9, 0.06, 0.06, 0, 1.4, 0.86);
			for (let i = 0; i < 4; i++) k.box('solid', WOOD, 0.3, 0.04, 0.05, 0.25, 0.3 + i * 0.25, 0.92);
		},
	},
	{
		id: 'cradle', name: 'Cradle', cat: 'beds', w: 1, d: 1, place: 'floor', block: true, colors: FABRIC,
		build: (k, c) => {
			k.add('solid', new THREE.TorusGeometry(0.32, 0.03, 4, 12, Math.PI), WOOD_DARK, 0, 0.32, -0.2, { rz: Math.PI });
			k.add('solid', new THREE.TorusGeometry(0.32, 0.03, 4, 12, Math.PI), WOOD_DARK, 0, 0.32, 0.2, { rz: Math.PI });
			k.box('solid', WOOD, 0.62, 0.28, 0.5, 0, 0.12, 0);
			k.box('solid', c, 0.56, 0.06, 0.44, 0, 0.38, 0);
			k.ball('solid', CREAM, 0.08, -0.18, 0.44, 0, { sy: 0.6 });
		},
	},

	// Seats
	{
		id: 'chair', name: 'Chair', cat: 'seats', w: 1, d: 1, place: 'floor', block: true, colors: WOODS,
		build: (k, c, rand) => {
			k.box('solid', c, 0.46, 0.06, 0.46, 0, 0.42, 0);
			legs(k, c, 0.46, 0.46, 0.42, 0.05);
			k.box('solid', c, 0.46, 0.5, 0.05, 0, 0.48, -0.21);
			k.box('solid', pick(FABRIC, rand()), 0.4, 0.05, 0.4, 0, 0.48, 0.02);
		},
	},
	{
		id: 'stool', name: 'Stool', cat: 'seats', w: 1, d: 1, place: 'floor', block: false, colors: WOODS,
		build: (k, c) => {
			k.cyl('solid', c, 0.2, 0.2, 0.06, 9, 0, 0.4, 0);
			for (let i = 0; i < 3; i++) {
				const a = (i / 3) * Math.PI * 2;
				k.box('solid', c, 0.05, 0.42, 0.05, Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13);
			}
		},
	},
	{
		id: 'armchair', name: 'Armchair', cat: 'seats', w: 1, d: 1, place: 'floor', block: true, colors: FABRIC,
		build: (k, c) => {
			k.box('solid', c, 0.76, 0.34, 0.72, 0, 0.06, 0);
			k.box('solid', c, 0.76, 0.66, 0.16, 0, 0.06, -0.28);
			for (const sx of [-1, 1]) k.box('solid', c, 0.14, 0.5, 0.7, sx * 0.31, 0.06, 0);
			k.box('solid', CREAM, 0.48, 0.1, 0.5, 0, 0.4, 0.06);
			legs(k, WOOD_DEEP, 0.7, 0.66, 0.08, 0.06);
		},
	},
	{
		id: 'sofa', name: 'Sofa', cat: 'seats', w: 2, d: 1, place: 'floor', block: true, colors: FABRIC,
		build: (k, c, rand) => {
			k.box('solid', c, 1.8, 0.34, 0.72, 0, 0.06, 0);
			k.box('solid', c, 1.8, 0.66, 0.18, 0, 0.06, -0.27);
			for (const sx of [-1, 1]) k.box('solid', c, 0.16, 0.5, 0.72, sx * 0.82, 0.06, 0);
			for (const sx of [-1, 1]) k.box('solid', CREAM, 0.72, 0.1, 0.5, sx * 0.37, 0.4, 0.06);
			k.box('solid', pick(FABRIC, rand()), 0.3, 0.26, 0.1, -0.5, 0.48, -0.15, { rz: 0.2 });
			legs(k, WOOD_DEEP, 1.74, 0.66, 0.08, 0.06);
		},
	},
	{
		id: 'rocker', name: 'Rocking chair', cat: 'seats', w: 1, d: 1, place: 'floor', block: true, colors: WOODS,
		build: (k, c, rand) => {
			for (const sx of [-1, 1]) k.add('solid', new THREE.TorusGeometry(0.9, 0.025, 3, 12, 0.9), c, sx * 0.22, 0.92, 0, { ry: Math.PI / 2, rz: -Math.PI / 2 - 0.45 });
			k.box('solid', c, 0.48, 0.06, 0.46, 0, 0.4, 0);
			for (const sx of [-1, 1]) k.box('solid', c, 0.05, 0.36, 0.05, sx * 0.21, 0.06, 0);
			k.box('solid', c, 0.48, 0.66, 0.05, 0, 0.44, -0.22, { rx: -0.15 });
			k.box('solid', pick(FABRIC, rand()), 0.42, 0.05, 0.4, 0, 0.46, 0.02);
		},
	},
	{
		id: 'cushion', name: 'Floor cushion', cat: 'seats', w: 1, d: 1, place: 'floor', block: false, colors: FABRIC,
		build: (k, c) => {
			k.cyl('solid', c, 0.34, 0.38, 0.16, 9, 0, 0, 0);
			k.ball('solid', GOLD, 0.04, 0, 0.17, 0);
		},
	},

	// Tables
	{
		id: 'table', name: 'Round table', cat: 'tables', w: 1, d: 1, place: 'floor', block: true, surface: 0.62, colors: WOODS,
		build: (k, c) => {
			k.cyl('solid', c, 0.44, 0.44, 0.06, 12, 0, 0.56, 0);
			k.cyl('solid', c, 0.06, 0.08, 0.56, 6, 0, 0, 0);
			k.cyl('solid', c, 0.24, 0.26, 0.04, 8, 0, 0, 0);
		},
	},
	{
		id: 'longtable', name: 'Long table', cat: 'tables', w: 2, d: 1, place: 'floor', block: true, surface: 0.62, colors: WOODS,
		build: (k, c) => {
			k.box('solid', c, 1.84, 0.06, 0.8, 0, 0.56, 0);
			legs(k, c, 1.74, 0.7, 0.56, 0.08);
			k.box('solid', CREAM, 1.84, 0.065, 0.24, 0, 0.56, 0);
		},
	},
	{
		id: 'desk', name: 'Writing desk', cat: 'tables', w: 1, d: 1, place: 'floor', block: true, surface: 0.66, colors: WOODS,
		build: (k, c, rand) => {
			k.box('solid', c, 0.86, 0.06, 0.56, 0, 0.6, -0.12);
			for (const sx of [-1, 1]) k.box('solid', c, 0.08, 0.6, 0.5, sx * 0.39, 0, -0.12);
			k.box('solid', WOOD_DEEP, 0.3, 0.14, 0.04, 0.2, 0.44, 0.15);
			k.box('solid', CREAM, 0.24, 0.01, 0.18, -0.15, 0.66, 0.0, { ry: 0.3 });
			k.cyl('solid', 0x4a3a56, 0.03, 0.035, 0.07, 6, 0.22, 0.66, -0.25);
			k.box('solid', 0xffffff, 0.01, 0.16, 0.01, 0.24, 0.7, -0.25, { rz: -0.3 });
			book(k, -0.32, 0.66, -0.3, rand, 0.2);
		},
	},
	{
		id: 'sidetable', name: 'Side table', cat: 'tables', w: 1, d: 1, place: 'floor', block: true, surface: 0.48, colors: WOODS,
		build: (k, c) => {
			k.box('solid', c, 0.5, 0.06, 0.5, 0, 0.42, 0);
			legs(k, c, 0.5, 0.5, 0.42, 0.05);
			k.box('solid', c, 0.42, 0.04, 0.42, 0, 0.14, 0);
		},
	},
	{
		id: 'teatable', name: 'Low tea table', cat: 'tables', w: 1, d: 1, place: 'floor', block: false, surface: 0.28, colors: WOODS,
		build: (k, c) => {
			k.box('solid', c, 0.8, 0.06, 0.8, 0, 0.22, 0);
			legs(k, WOOD_DEEP, 0.72, 0.72, 0.22, 0.07);
		},
	},

	// Storage
	{
		id: 'wardrobe', name: 'Wardrobe', cat: 'storage', w: 1, d: 1, place: 'floor', block: true, colors: WOODS,
		build: (k, c) => {
			k.box('solid', c, 0.9, 1.7, 0.56, 0, 0.06, -0.18);
			k.box('solid', WOOD_DEEP, 0.92, 0.08, 0.6, 0, 1.76, -0.18);
			k.box('solid', WOOD_DEEP, 0.02, 1.5, 0.02, 0, 0.16, 0.1);
			for (const sx of [-1, 1]) {
				k.box('solid', 0xffffff, 0.3, 0.6, 0.02, sx * 0.21, 0.9, 0.1, {});
				k.ball('solid', GOLD, 0.03, sx * 0.06, 0.9, 0.12);
			}
			legs(k, WOOD_DEEP, 0.84, 0.5, 0.08, 0.06);
		},
	},
	{
		id: 'bookcase', name: 'Bookcase', cat: 'storage', w: 1, d: 1, place: 'floor', block: true, colors: WOODS,
		build: (k, c, rand) => {
			k.box('solid', c, 0.9, 1.8, 0.06, 0, 0, -0.38);
			for (const sx of [-1, 1]) k.box('solid', c, 0.06, 1.8, 0.36, sx * 0.42, 0, -0.24);
			for (let i = 0; i < 5; i++) k.box('solid', c, 0.86, 0.05, 0.36, 0, i * 0.43, -0.24);
			for (let s = 0; s < 4; s++) {
				let x = -0.36;
				while (x < 0.34) {
					if (rand() < 0.15) {
						x += 0.1;
						continue;
					}
					book(k, x, s * 0.43 + 0.05, -0.24, rand);
					x += 0.07 + rand() * 0.02;
				}
			}
		},
	},
	{
		id: 'chest', name: 'Chest', cat: 'storage', w: 1, d: 1, place: 'floor', block: true, surface: 0.46, colors: WOODS,
		build: (k, c) => {
			k.box('solid', c, 0.76, 0.36, 0.5, 0, 0, 0);
			k.add('solid', new THREE.CylinderGeometry(0.25, 0.25, 0.76, 8, 1, false, 0, Math.PI), c, 0, 0.36, 0, { rz: Math.PI / 2 });
			for (const sx of [-1, 1]) k.box('solid', WOOD_DEEP, 0.05, 0.38, 0.52, sx * 0.24, 0, 0);
			k.box('solid', GOLD, 0.08, 0.1, 0.03, 0, 0.28, 0.26);
		},
	},
	{
		id: 'dresser', name: 'Dresser', cat: 'storage', w: 1, d: 1, place: 'floor', block: true, surface: 0.82, colors: WOODS,
		build: (k, c) => {
			k.box('solid', c, 0.88, 0.76, 0.5, 0, 0.06, -0.2);
			k.box('solid', WOOD_DEEP, 0.92, 0.04, 0.54, 0, 0.78, -0.2);
			for (let i = 0; i < 3; i++) {
				k.box('solid', 0xffffff, 0.8, 0.2, 0.02, 0, 0.12 + i * 0.22, 0.05, {});
				for (const sx of [-1, 1]) k.ball('solid', GOLD, 0.025, sx * 0.2, 0.22 + i * 0.22, 0.07);
			}
			legs(k, WOOD_DEEP, 0.82, 0.44, 0.06, 0.05);
		},
	},
	{
		id: 'shelf', name: 'Wall shelf', cat: 'storage', w: 1, d: 1, place: 'wall', block: false, colors: WOODS,
		build: (k, c, rand) => {
			for (const y of [1.1, 1.5]) {
				k.box('solid', c, 0.84, 0.04, 0.22, 0, y, -0.38);
				for (const sx of [-1, 1]) k.box('solid', WOOD_DEEP, 0.03, 0.1, 0.16, sx * 0.3, y - 0.1, -0.42);
			}
			for (let i = 0; i < 3; i++) k.cyl('solid', pick([0x9fe0ff, 0xffd27a, 0xffa3c4, 0xc9a8ff], rand()), 0.05, 0.06, 0.14, 7, -0.25 + i * 0.22, 1.14, -0.38);
			for (let i = 0; i < 5; i++) book(k, -0.3 + i * 0.07, 1.54, -0.38, rand);
			k.ball('solid', LEAF, 0.08, 0.26, 1.6, -0.38);
		},
	},

	// Kitchen
	{
		id: 'stove', name: 'Wood stove', cat: 'kitchen', w: 1, d: 1, place: 'floor', block: true, light: { y: 0.4, color: 0xff9a4a, power: 0.8 }, colors: [0x4a4458, 0x8a4a3c, 0x3f6f6a],
		build: (k, c) => {
			k.box('solid', c, 0.72, 0.7, 0.62, 0, 0.06, -0.12);
			legs(k, c, 0.66, 0.56, 0.08, 0.06);
			k.box('solid', 0x2a2630, 0.74, 0.04, 0.64, 0, 0.76, -0.12);
			k.box('lamp', 0xff9a4a, 0.34, 0.2, 0.02, 0, 0.26, 0.2);
			k.box('solid', c, 0.4, 0.04, 0.03, 0, 0.48, 0.2);
			k.cyl('solid', c, 0.08, 0.08, 1.5, 7, 0.18, 0.8, -0.32);
			k.cyl('solid', 0xc8d0dc, 0.13, 0.11, 0.14, 8, -0.15, 0.8, -0.08);
			k.cyl('solid', 0x8a4a3c, 0.12, 0.12, 0.03, 8, -0.15, 0.94, -0.08);
		},
	},
	{
		id: 'counter', name: 'Counter', cat: 'kitchen', w: 1, d: 1, place: 'floor', block: true, surface: 0.82, colors: WOODS,
		build: (k, c, rand) => {
			k.box('solid', c, 0.9, 0.76, 0.6, 0, 0, -0.18);
			k.box('solid', STONE, 0.94, 0.06, 0.64, 0, 0.76, -0.18);
			k.box('solid', 0xffffff, 0.38, 0.5, 0.02, -0.2, 0.12, 0.13);
			k.box('solid', 0xffffff, 0.38, 0.5, 0.02, 0.2, 0.12, 0.13);
			k.box('solid', WOOD_DEEP, 0.3, 0.03, 0.2, 0.15, 0.82, -0.2);
			k.ball('solid', pick([0xf2a03c, 0xe86f86, 0x8fd38a], rand()), 0.06, 0.15, 0.89, -0.2);
		},
	},
	{
		id: 'sink', name: 'Wash basin', cat: 'kitchen', w: 1, d: 1, place: 'floor', block: true, colors: [STONE, 0xe8e2d6, 0xc8a6a0],
		build: (k, c) => {
			k.box('solid', WOOD, 0.9, 0.7, 0.6, 0, 0, -0.18);
			k.box('solid', c, 0.94, 0.12, 0.64, 0, 0.7, -0.18);
			k.box('water', 0, 0.6, 0.02, 0.4, 0, 0.78, -0.16);
			k.cyl('solid', 0xc8d0dc, 0.025, 0.025, 0.3, 6, 0, 0.82, -0.42);
			k.cyl('solid', 0xc8d0dc, 0.02, 0.02, 0.18, 6, 0, 1.08, -0.36, { rx: Math.PI / 2 });
		},
	},
	{
		id: 'barrel', name: 'Pantry barrel', cat: 'kitchen', w: 1, d: 1, place: 'floor', block: true, surface: 0.72, colors: WOODS,
		build: (k, c) => {
			k.cyl('solid', c, 0.3, 0.26, 0.36, 10, 0, 0.36, 0);
			k.cyl('solid', c, 0.26, 0.3, 0.36, 10, 0, 0, 0);
			for (const y of [0.12, 0.6]) k.cyl('solid', 0x6a6a7a, 0.305, 0.305, 0.04, 10, 0, y, 0);
			k.cyl('solid', WOOD_DEEP, 0.27, 0.27, 0.02, 10, 0, 0.72, 0);
		},
	},
	{
		id: 'herbs', name: 'Drying herbs', cat: 'kitchen', w: 1, d: 1, place: 'wall', block: false, colors: [LEAF, 0xb86fa8, 0xd9a441],
		build: (k, c, rand) => {
			k.box('solid', WOOD_DEEP, 0.8, 0.04, 0.04, 0, 1.9, -0.42);
			for (let i = 0; i < 5; i++) {
				const x = -0.32 + i * 0.16;
				k.box('solid', 0xd8c08f, 0.01, 0.16, 0.01, x, 1.74, -0.42);
				k.cyl('solid', i % 2 ? c : pick([LEAF, LEAF2, 0xc9a8ff], rand()), 0.07, 0.02, 0.24, 5, x, 1.5, -0.42);
			}
		},
	},

	// Lights
	{
		id: 'floorlamp', name: 'Floor lamp', cat: 'lights', w: 1, d: 1, place: 'floor', block: false, light: { y: 1.3, color: 0xffd58a, power: 1 }, colors: [0xfff1c4, 0xffc1d9, 0xc9e8ff, 0xd9f5d0],
		build: (k, c) => {
			k.cyl('solid', WOOD_DEEP, 0.16, 0.18, 0.04, 8, 0, 0, 0);
			k.cyl('solid', WOOD_DARK, 0.025, 0.025, 1.3, 6, 0, 0.04, 0);
			k.ball('lamp', GOLD, 0.08, 0, 1.3, 0);
			k.cyl('lamp', c, 0.14, 0.24, 0.26, 8, 0, 1.22, 0);
		},
	},
	{
		id: 'candle', name: 'Candles', cat: 'lights', w: 1, d: 1, place: 'top', block: false, light: { y: 0.25, color: 0xffb46a, power: 0.45 }, colors: [CREAM, 0xffc1d9, 0xc9a8ff],
		build: (k, c) => {
			k.cyl('solid', GOLD, 0.1, 0.12, 0.03, 8, 0, 0, 0);
			for (const [x, h] of [[-0.04, 0.16], [0.05, 0.11], [0.0, 0.08]]) {
				k.cyl('solid', c, 0.025, 0.025, h, 6, x, 0.03, h === 0.08 ? 0.05 : 0);
				k.ball('lamp', 0xffd27a, 0.022, x, 0.05 + h, h === 0.08 ? 0.05 : 0, { sy: 1.6 });
			}
		},
	},
	{
		id: 'lantern', name: 'Table lantern', cat: 'lights', w: 1, d: 1, place: 'top', block: false, light: { y: 0.18, color: 0xffd58a, power: 0.6 }, colors: [0x4a4458, GOLD, 0x5f8fd0],
		build: (k, c) => {
			k.box('solid', c, 0.2, 0.03, 0.2, 0, 0, 0);
			for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('solid', c, 0.02, 0.24, 0.02, sx * 0.09, 0, sz * 0.09);
			k.ball('lamp', 0xffe7a3, 0.07, 0, 0.13, 0);
			k.cyl('solid', c, 0.02, 0.14, 0.08, 4, 0, 0.24, 0, { ry: Math.PI / 4 });
			k.add('solid', new THREE.TorusGeometry(0.04, 0.01, 4, 8), c, 0, 0.35, 0);
		},
	},
	{
		id: 'chandelier', name: 'Hanging lamp', cat: 'lights', w: 1, d: 1, place: 'ceiling', block: false, light: { y: 1.8, color: 0xffd58a, power: 1.3 }, colors: [GOLD, WOOD_DARK, 0x8fb7c9],
		build: (k, c) => {
			k.box('solid', 0x6e4f3a, 0.015, 0.5, 0.015, 0, 2.0, 0);
			k.add('solid', new THREE.TorusGeometry(0.3, 0.025, 4, 12), c, 0, 1.95, 0, { rx: Math.PI / 2 });
			for (let i = 0; i < 4; i++) {
				const a = (i / 4) * Math.PI * 2;
				k.box('solid', c, 0.012, 0.3, 0.012, Math.cos(a) * 0.15, 1.95, Math.sin(a) * 0.15, { rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5 });
				k.cyl('solid', CREAM, 0.03, 0.03, 0.1, 6, Math.cos(a) * 0.3, 1.97, Math.sin(a) * 0.3);
				k.ball('lamp', 0xffd27a, 0.03, Math.cos(a) * 0.3, 2.1, Math.sin(a) * 0.3, { sy: 1.5 });
			}
		},
	},
	{
		id: 'sconce', name: 'Wall lamp', cat: 'lights', w: 1, d: 1, place: 'wall', block: false, light: { y: 1.55, color: 0xffd58a, power: 0.7 }, colors: [GOLD, 0x4a4458, WOOD_DARK],
		build: (k, c) => {
			k.box('solid', c, 0.14, 0.24, 0.03, 0, 1.4, -0.47);
			k.box('solid', c, 0.03, 0.03, 0.16, 0, 1.45, -0.4);
			k.cyl('solid', CREAM, 0.035, 0.035, 0.1, 6, 0, 1.47, -0.32);
			k.ball('lamp', 0xffd27a, 0.04, 0, 1.6, -0.32, { sy: 1.5 });
		},
	},
	{
		id: 'fireplace', name: 'Fireplace', cat: 'lights', w: 2, d: 1, place: 'floor', block: true, surface: 1.1, light: { y: 0.4, color: 0xff8a3a, power: 1.4 }, colors: [STONE, 0xc8a6a0, 0xa9a8ba],
		build: (k, c, rand) => {
			k.box('solid', c, 1.7, 1.06, 0.5, 0, 0, -0.25);
			k.box('solid', WOOD_DARK, 1.84, 0.08, 0.6, 0, 1.06, -0.22);
			k.box('solid', 0x2a2630, 0.8, 0.6, 0.06, 0, 0.06, 0.0);
			k.box('solid', c, 1.2, 1.4, 0.4, 0, 1.14, -0.3);
			for (let i = 0; i < 3; i++) k.cyl('solid', 0x8a6248, 0.05, 0.05, 0.5, 5, -0.05 + i * 0.05, 0.1 + (i === 1 ? 0.08 : 0), 0.05, { rz: Math.PI / 2, ry: (rand() - 0.5) * 0.4 });
			k.cyl('lamp', 0xff9a4a, 0.0, 0.16, 0.34, 5, -0.1, 0.12, 0.08);
			k.cyl('lamp', 0xffd27a, 0.0, 0.11, 0.26, 5, 0.12, 0.12, 0.06);
			k.box('solid', 0x8a8a9a, 1.7, 0.06, 0.2, 0, 0, 0.12);
		},
	},

	// Rugs
	{
		id: 'roundrug', name: 'Round rug', cat: 'rugs', w: 2, d: 2, place: 'rug', block: false, colors: FABRIC,
		build: (k, c) => {
			k.cyl('solid', c, 0.95, 0.95, 0.02, 20, 0, 0, 0);
			k.cyl('solid', 0xffffff, 0.7, 0.7, 0.025, 20, 0, 0, 0);
			k.cyl('solid', c, 0.55, 0.55, 0.03, 20, 0, 0, 0);
		},
	},
	{
		id: 'longrug', name: 'Long rug', cat: 'rugs', w: 1, d: 2, place: 'rug', block: false, colors: FABRIC,
		build: (k, c) => {
			k.box('solid', c, 0.9, 0.02, 1.86, 0, 0, 0);
			for (let i = 0; i < 4; i++) k.box('solid', 0xfff4e2, 0.92, 0.025, 0.08, 0, 0, -0.66 + i * 0.44);
			for (const sz of [-1, 1]) for (let i = 0; i < 6; i++) k.box('solid', CREAM, 0.03, 0.01, 0.08, -0.38 + i * 0.15, 0, sz * 0.96);
		},
	},
	{
		id: 'mat', name: 'Woven mat', cat: 'rugs', w: 1, d: 1, place: 'rug', block: false, colors: [0xd8c08f, 0xc8a6a0, 0xa8c8a0],
		build: (k, c) => {
			k.box('solid', c, 0.9, 0.02, 0.9, 0, 0, 0);
			for (let i = 0; i < 5; i++) k.box('solid', 0xb09a6a, 0.9, 0.025, 0.04, 0, 0, -0.36 + i * 0.18);
		},
	},

	// Plants
	{
		id: 'fern', name: 'Potted fern', cat: 'plants', w: 1, d: 1, place: 'floor', block: true, colors: POTS,
		build: (k, c, rand) => {
			k.cyl('solid', c, 0.24, 0.18, 0.36, 8, 0, 0, 0);
			k.cyl('solid', 0x5c4030, 0.22, 0.22, 0.02, 8, 0, 0.34, 0);
			for (let i = 0; i < 7; i++) {
				const a = (i / 7) * Math.PI * 2 + rand();
				k.cyl('solid', i % 2 ? LEAF : LEAF2, 0.0, 0.06, 0.6, 4, Math.cos(a) * 0.1, 0.34, Math.sin(a) * 0.1, { rz: Math.cos(a) * 0.7, rx: -Math.sin(a) * 0.7 });
			}
		},
	},
	{
		id: 'flowerpot', name: 'Flower pot', cat: 'plants', w: 1, d: 1, place: 'top', block: false, colors: POTS,
		build: (k, c, rand) => {
			k.cyl('solid', c, 0.1, 0.08, 0.14, 7, 0, 0, 0);
			for (let i = 0; i < 4; i++) {
				const a = (i / 4) * Math.PI * 2 + rand();
				k.box('solid', LEAF, 0.008, 0.14, 0.008, Math.cos(a) * 0.04, 0.12, Math.sin(a) * 0.04);
				k.ball('solid', pick([0xffa3c4, 0xfff1a8, 0xc9a8ff, 0xffffff, 0xffb98a], rand()), 0.035, Math.cos(a) * 0.05, 0.27, Math.sin(a) * 0.05);
			}
		},
	},
	{
		id: 'hangplant', name: 'Hanging plant', cat: 'plants', w: 1, d: 1, place: 'ceiling', block: false, colors: POTS,
		build: (k, c, rand) => {
			k.box('solid', 0xd8c08f, 0.01, 0.6, 0.01, 0, 1.9, 0);
			k.cyl('solid', c, 0.16, 0.1, 0.16, 8, 0, 1.76, 0);
			leaves(k, 0, 1.92, 0, 0.2, rand, 6);
			for (let i = 0; i < 4; i++) {
				const a = (i / 4) * Math.PI * 2;
				k.cyl('solid', LEAF, 0.02, 0.03, 0.4, 4, Math.cos(a) * 0.14, 1.5, Math.sin(a) * 0.14);
			}
		},
	},
	{
		id: 'bigplant', name: 'Big leaf plant', cat: 'plants', w: 1, d: 1, place: 'floor', block: true, colors: POTS,
		build: (k, c, rand) => {
			k.cyl('solid', c, 0.28, 0.22, 0.42, 8, 0, 0, 0);
			k.cyl('solid', WOOD_DEEP, 0.03, 0.04, 0.8, 5, 0, 0.4, 0);
			for (let i = 0; i < 6; i++) {
				const a = (i / 6) * Math.PI * 2 + rand();
				k.ball('solid', i % 2 ? LEAF : LEAF2, 0.2, Math.cos(a) * 0.22, 0.85 + i * 0.08, Math.sin(a) * 0.22, { sy: 0.25, ry: -a, rz: 0.4 });
			}
		},
	},

	// Nice things
	{
		id: 'painting', name: 'Painting', cat: 'decor', w: 1, d: 1, place: 'wall', block: false, colors: [GOLD, WOOD_DARK, 0xffffff],
		build: (k, c, rand) => {
			k.box('solid', c, 0.7, 0.54, 0.04, 0, 1.15, -0.47);
			k.box('solid', 0x9fd0ff, 0.6, 0.44, 0.045, 0, 1.2, -0.47);
			k.box('solid', pick([0x6fc487, 0x8fd38a], rand()), 0.6, 0.16, 0.05, 0, 1.2, -0.47);
			k.ball('solid', 0xffe08a, 0.06, 0.18, 1.5, -0.45);
			k.cyl('solid', pick([0x8a6fc8, 0x5f8fd0], rand()), 0.0, 0.14, 0.18, 4, -0.12, 1.3, -0.45);
		},
	},
	{
		id: 'mirror', name: 'Mirror', cat: 'decor', w: 1, d: 1, place: 'wall', block: false, colors: [GOLD, WOOD_DARK, 0xb86fa8],
		build: (k, c) => {
			k.cyl('solid', c, 0.3, 0.3, 0.04, 14, 0, 1.35, -0.47, { rx: Math.PI / 2 });
			k.cyl('lamp', 0xd6eef8, 0.25, 0.25, 0.045, 14, 0, 1.35, -0.465, { rx: Math.PI / 2 });
			k.box('lamp', 0xffffff, 0.05, 0.2, 0.05, -0.08, 1.3, -0.44, { rz: 0.6 });
		},
	},
	{
		id: 'clock', name: 'Wall clock', cat: 'decor', w: 1, d: 1, place: 'wall', block: false, colors: [WOOD_DARK, 0x5f8fd0, 0xe86f86],
		build: (k, c) => {
			k.cyl('solid', c, 0.2, 0.2, 0.06, 12, 0, 1.7, -0.46, { rx: Math.PI / 2 });
			k.cyl('solid', CREAM, 0.16, 0.16, 0.065, 12, 0, 1.7, -0.455, { rx: Math.PI / 2 });
			k.box('solid', 0x33443c, 0.015, 0.12, 0.02, 0, 1.75, -0.42);
			k.box('solid', 0x33443c, 0.09, 0.015, 0.02, 0.04, 1.7, -0.42);
			k.box('solid', c, 0.06, 0.3, 0.03, 0, 1.25, -0.47);
			k.ball('solid', GOLD, 0.05, 0, 1.24, -0.45);
		},
	},
	{
		id: 'books', name: 'Stack of books', cat: 'decor', w: 1, d: 1, place: 'top', block: false, colors: FABRIC,
		build: (k, c, rand) => {
			for (let i = 0; i < 4; i++) k.box('solid', i === 0 ? c : pick(FABRIC, rand()), 0.24 - i * 0.02, 0.05, 0.17, 0, i * 0.05, 0, { ry: (rand() - 0.5) * 0.5 });
		},
	},
	{
		id: 'teaset', name: 'Tea set', cat: 'decor', w: 1, d: 1, place: 'top', block: false, colors: [0xffffff, 0x9fd0ff, 0xffc1d9],
		build: (k, c) => {
			k.cyl('solid', WOOD, 0.22, 0.22, 0.02, 10, 0, 0, 0);
			k.ball('solid', c, 0.09, 0, 0.09, 0, { sy: 0.85 });
			k.cyl('solid', c, 0.012, 0.02, 0.1, 5, 0.1, 0.07, 0, { rz: -1 });
			k.ball('solid', GOLD, 0.02, 0, 0.17, 0);
			for (const a of [1.2, 2.6, 4.4]) k.cyl('solid', c, 0.035, 0.028, 0.05, 7, Math.cos(a) * 0.15, 0.02, Math.sin(a) * 0.15);
		},
	},
	{
		id: 'vase', name: 'Vase of flowers', cat: 'decor', w: 1, d: 1, place: 'top', block: false, colors: [0x8fb7c9, 0xe8c98a, 0xb86fa8, 0xffffff],
		build: (k, c, rand) => {
			k.cyl('solid', c, 0.05, 0.09, 0.22, 8, 0, 0, 0);
			for (let i = 0; i < 5; i++) {
				const a = (i / 5) * Math.PI * 2;
				k.box('solid', LEAF, 0.008, 0.18, 0.008, Math.cos(a) * 0.03, 0.2, Math.sin(a) * 0.03, { rz: Math.cos(a) * 0.3, rx: -Math.sin(a) * 0.3 });
				k.ball('solid', pick([0xffa3c4, 0xfff1a8, 0xc9a8ff, 0xffb98a, 0xffffff], rand()), 0.04, Math.cos(a) * 0.08, 0.38, Math.sin(a) * 0.08);
			}
		},
	},
	{
		id: 'basket', name: 'Basket', cat: 'decor', w: 1, d: 1, place: 'floor', block: false, colors: [0xd8c08f, 0xc49a6c],
		build: (k, c, rand) => {
			k.cyl('solid', c, 0.26, 0.2, 0.26, 9, 0, 0, 0);
			k.add('solid', new THREE.TorusGeometry(0.22, 0.02, 4, 10, Math.PI), c, 0, 0.26, 0);
			for (let i = 0; i < 4; i++) k.ball('solid', pick([0xf2a03c, 0xe86f86, 0x8fd38a, 0xffe08a], rand()), 0.07, (rand() - 0.5) * 0.2, 0.28, (rand() - 0.5) * 0.2);
		},
	},
	{
		id: 'globe', name: 'Sky globe', cat: 'decor', w: 1, d: 1, place: 'top', block: false, colors: [0x5f8fd0, 0x4fb0a8, 0x8a6fc8],
		build: (k, c) => {
			k.cyl('solid', WOOD_DARK, 0.08, 0.1, 0.04, 8, 0, 0, 0);
			k.cyl('solid', GOLD, 0.012, 0.012, 0.12, 5, 0, 0.04, 0);
			k.ball('solid', c, 0.12, 0, 0.26, 0);
			k.ball('solid', 0x8fd38a, 0.05, 0.06, 0.3, -0.07);
			k.add('solid', new THREE.TorusGeometry(0.14, 0.01, 4, 14), GOLD, 0, 0.26, 0, { rx: 0.4 });
		},
	},
	{
		id: 'potions', name: 'Potion bottles', cat: 'decor', w: 1, d: 1, place: 'top', block: false, colors: [0xc9a8ff, 0x9fe0ff, 0xffa3c4],
		build: (k, c) => {
			for (const [x, z, h, col] of [[-0.07, 0, 0.16, c], [0.06, -0.04, 0.12, 0xb9ffb0], [0.03, 0.08, 0.1, 0xffd27a]] as const) {
				k.cyl('crystal', col, 0.04, 0.05, h, 7, x, 0, z);
				k.cyl('solid', WOOD_DEEP, 0.015, 0.015, 0.04, 5, x, h, z);
			}
		},
	},
	{
		id: 'harp', name: 'Little harp', cat: 'decor', w: 1, d: 1, place: 'floor', block: true, colors: [GOLD, WOOD, 0xd9d9e8],
		build: (k, c) => {
			k.box('solid', c, 0.06, 1.1, 0.08, -0.22, 0, 0);
			k.box('solid', c, 0.5, 0.08, 0.08, 0.02, 0, 0);
			k.add('solid', new THREE.TorusGeometry(0.4, 0.04, 4, 10, Math.PI / 2), c, -0.22, 0.7, 0, { rz: -Math.PI / 2 + 0.3 });
			for (let i = 0; i < 6; i++) k.box('solid', 0xffffff, 0.008, 0.9 - i * 0.13, 0.008, -0.16 + i * 0.065, 0.08, 0);
		},
	},
];

export const FURN = Object.fromEntries(FURNITURE.map((f) => [f.id, f])) as Record<string, FurnDef>;

/** Tiles across and deep for a facing. */
export function footprint(def: FurnDef, r: number): [number, number] {
	return r % 2 ? [def.d, def.w] : [def.w, def.d];
}

/** Makes the model of a thing. */
export function buildFurniture(id: string, c: number, seed: number): THREE.Group {
	const def = FURN[id];
	const k = new Kit();
	let s = seed * 9301 + 49297;
	const rand = (): number => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
	def.build(k, def.colors[c % def.colors.length], rand);
	return k.build(false);
}

/** Small pictures of every thing, for the decorate toolbar. */
export function furnitureIcons(renderer: THREE.WebGLRenderer): Record<string, string> {
	const out: Record<string, string> = {};
	const scene = new THREE.Scene();
	scene.add(new THREE.HemisphereLight(0xffffff, 0xe6d6f2, 2.2));
	const light = new THREE.DirectionalLight(0xfff2dc, 1.8);
	light.position.set(3, 5, 4);
	scene.add(light);
	const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
	const oldSize = renderer.getSize(new THREE.Vector2());
	const oldRatio = renderer.getPixelRatio();
	renderer.setPixelRatio(1);
	renderer.setSize(96, 96, false);
	renderer.setClearColor(0x000000, 0);
	for (const def of FURNITURE) {
		const model = buildFurniture(def.id, 0, 3);
		const box = new THREE.Box3().setFromObject(model);
		const mid = box.getCenter(new THREE.Vector3());
		const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
		const dist = size * 2.4 + 0.2;
		cam.position.set(mid.x + dist * 0.55, mid.y + dist * 0.45, mid.z + dist * 0.75);
		cam.lookAt(mid);
		scene.add(model);
		renderer.render(scene, cam);
		out[def.id] = renderer.domElement.toDataURL('image/png');
		scene.remove(model);
		model.traverse((o) => {
			if (o instanceof THREE.Mesh) o.geometry.dispose();
		});
	}
	renderer.setPixelRatio(oldRatio);
	renderer.setSize(oldSize.x, oldSize.y, false);
	return out;
}
