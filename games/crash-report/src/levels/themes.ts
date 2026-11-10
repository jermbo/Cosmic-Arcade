import type { ThemeId } from './types.ts';

/** The light and the colours of a junction. */
export interface Theme {
	skyTop: number;
	skyHorizon: number;
	sun: number;
	sunPower: number;
	/** Where the sun is, as a direction from the junction. */
	sunFrom: [number, number, number];
	ambientSky: number;
	ambientGround: number;
	ambientPower: number;
	ground: number;
	road: number;
	line: number;
	pavement: number;
	buildings: number[];
	windows: number;
	/** True when the windows give light, for the dark themes. */
	windowsLit: boolean;
	tree: number;
	fogNear: number;
	fogFar: number;
}

export const THEMES: Record<ThemeId, Theme> = {
	morning: {
		skyTop: 0x6fb7e8, skyHorizon: 0xfde8c9, sun: 0xfff1d6, sunPower: 2.6, sunFrom: [-60, 70, 40],
		ambientSky: 0xcfe8ff, ambientGround: 0x8a9a6a, ambientPower: 1.5,
		ground: 0x8fbf6a, road: 0x4a4e5a, line: 0xf2efe6, pavement: 0xc9c4b8,
		buildings: [0xf2d6a2, 0xe9a27c, 0xf6efe0, 0xa8c6d9, 0xd98c7a], windows: 0x3b4a66, windowsLit: false,
		tree: 0x4f9a52, fogNear: 110, fogFar: 300,
	},
	noon: {
		skyTop: 0x3f9ce0, skyHorizon: 0xd8efff, sun: 0xffffff, sunPower: 2.9, sunFrom: [30, 90, 35],
		ambientSky: 0xd6ecff, ambientGround: 0x8c8f7a, ambientPower: 1.6,
		ground: 0x7fb56a, road: 0x454955, line: 0xf5f3ea, pavement: 0xcfcac0,
		buildings: [0xf4f0e6, 0x7fb7c9, 0xf2c14e, 0xe07a5f, 0xb9c2cf], windows: 0x2f3e5c, windowsLit: false,
		tree: 0x3f8f4c, fogNear: 120, fogFar: 320,
	},
	sunset: {
		skyTop: 0x41407a, skyHorizon: 0xffa25e, sun: 0xffb36b, sunPower: 3.0, sunFrom: [-80, 34, -30],
		ambientSky: 0xb48fc4, ambientGround: 0x7a5a4a, ambientPower: 1.25,
		ground: 0xb08a5a, road: 0x4b4552, line: 0xffe9c4, pavement: 0xc7a98c,
		buildings: [0xe98a5b, 0xc9614f, 0xf0c27a, 0x8f6a8a, 0xdba06a], windows: 0x3a2f4f, windowsLit: false,
		tree: 0x8a8f3c, fogNear: 100, fogFar: 290,
	},
	dusk: {
		skyTop: 0x1f2552, skyHorizon: 0xd66a7e, sun: 0xff9a8a, sunPower: 2.2, sunFrom: [70, 28, 50],
		ambientSky: 0x8f9be0, ambientGround: 0x5a5478, ambientPower: 1.9,
		ground: 0x55707a, road: 0x3b3d4d, line: 0xe8e2f2, pavement: 0x8f8ca3,
		buildings: [0xb56576, 0x6d597a, 0xe5989b, 0x577590, 0xeaac8b], windows: 0xffd98a, windowsLit: true,
		tree: 0x3f6b62, fogNear: 95, fogFar: 270,
	},
	overcast: {
		skyTop: 0x8e9aa8, skyHorizon: 0xdfe5e8, sun: 0xf2f5ff, sunPower: 1.7, sunFrom: [40, 80, -50],
		ambientSky: 0xe6ecf2, ambientGround: 0x7d8580, ambientPower: 2.0,
		ground: 0x6f9a72, road: 0x4c5158, line: 0xeef0ee, pavement: 0xbfc4c2,
		buildings: [0xd9d2c5, 0x9fb3b8, 0xc98f6b, 0xe8e4da, 0x7d93a6], windows: 0x36424f, windowsLit: false,
		tree: 0x3f7d55, fogNear: 80, fogFar: 240,
	},
	night: {
		skyTop: 0x070a1c, skyHorizon: 0x27305e, sun: 0x9fb4ff, sunPower: 1.5, sunFrom: [-40, 70, -55],
		ambientSky: 0x7386e0, ambientGround: 0x3a3660, ambientPower: 2.3,
		ground: 0x2c3f4a, road: 0x2b2d3b, line: 0xcfd6ff, pavement: 0x55597a,
		buildings: [0x3d4a7a, 0x56467a, 0x2f5a6e, 0x6a4a6a, 0x44506e], windows: 0xffd27a, windowsLit: true,
		tree: 0x25514e, fogNear: 90, fogFar: 260,
	},
};
