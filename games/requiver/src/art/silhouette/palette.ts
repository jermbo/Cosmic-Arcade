// One evening per act. Ink-black figures over bold sunset skies, one accent color each.

import type { ActPalette } from '../types.ts';

export const INK = '#0d0a10';
export const PAPER = '#fff3dc';

export const PALETTES: ActPalette[] = [
	{
		// The Ember Fields: gold to blood orange.
		early: ['#3a1747', '#a8304f', '#ef7a45', '#ffcf73'],
		late: ['#170c29', '#5e1838', '#c0403a', '#ff9550'],
		accent: '#ff5a1f',
		onAccent: INK,
		sun: '#fff0bd',
		far: '#8a3550',
		mid: '#4c1932',
		ink: INK,
		paper: PAPER,
	},
	{
		// The Rose Marsh: violet into hot pink.
		early: ['#26124d', '#7d3490', '#ee5f96', '#ffc3a4'],
		late: ['#0f0828', '#421a62', '#b23672', '#ff8a7f'],
		accent: '#ff2e88',
		onAccent: INK,
		sun: '#ffe4ef',
		far: '#7a3378',
		mid: '#3f1748',
		ink: INK,
		paper: PAPER,
	},
	{
		// The Violet Peaks: deep blue night with a cold cyan accent.
		early: ['#0e1440', '#353a9a', '#9558cc', '#ffad86'],
		late: ['#05071d', '#191c58', '#523596', '#de6c86'],
		accent: '#36e0ff',
		onAccent: INK,
		sun: '#fff6f0',
		far: '#4b3a8e',
		mid: '#24204f',
		ink: INK,
		paper: PAPER,
	},
];
