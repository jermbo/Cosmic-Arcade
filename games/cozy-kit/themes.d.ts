// Types for themes.js, for the TypeScript games.

export type Tone = 'light' | 'dark';
export type StyleId = 'soft' | 'bold';

export interface Theme {
	id: string;
	name: string;
	tone: Tone;
	blurb: string;
	bg: string;
	glow: string;
	dot: string;
	surface: string;
	surface2: string;
	well: string;
	board: string;
	ink: string;
	/** Outlines and hard shadows in Bold. Near-black on dark themes. */
	stroke: string;
	muted: string;
	line: string;
	edge: string;
	drop: string;
	accent: string;
	accentInk: string;
	accentSoft: string;
	bad: string;
	good: string;
}

export interface Style {
	id: StyleId;
	name: string;
	blurb: string;
	outline: number;
	radius: { big: number; normal: number; small: number };
	lift: number;
	hard: boolean;
	displayFont: string;
	displayWeight: number;
	uiFont: string;
	page: 'glow' | 'dots';
}

export const PALETTES: Record<Tone, string[]>;
export const COLOR_NAMES: string[];
export const ON_COLOR: Record<Tone, string>;
export const THEMES: Theme[];
export const DEFAULT_THEME: string;
export const FREE_THEMES: string[];
export const STYLES: Record<StyleId, Style>;
export const DEFAULT_STYLE: StyleId;
export function themeById(id: string): Theme;
export function styleById(id: string): Style;
export function paletteOf(theme: Theme): string[];
export function applyLooks(themeId: string, styleId: string): { theme: Theme; style: Style };
