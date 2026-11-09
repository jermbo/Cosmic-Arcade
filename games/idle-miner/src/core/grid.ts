// Cell indexing and land plots. A planet is a square of 6×6 plots around a center plot;
// players start with the center and buy plots next to ones they own.

import { PLANETS, TILE_ORE } from './data.ts';
import type { PlanetState } from './state.ts';

/** Tiles per plot side. */
export const PLOT = 6;
/** Plots out from the center plot in each direction. */
export const PLOT_RADIUS = 3;
/** Plots per map side. */
export const PLOTS = PLOT_RADIUS * 2 + 1;

export const MAX_COLS = PLOTS * PLOT;
export const MAX_ROWS = PLOTS * PLOT;
export const STRIDE = MAX_COLS;
export const MAX_CELLS = MAX_COLS * MAX_ROWS;

export const COLS = MAX_COLS;
export const ROWS = MAX_ROWS;
export const CELLS = MAX_CELLS;

export const CENTER_PLOT = PLOT_RADIUS * PLOTS + PLOT_RADIUS;

export interface Bounds {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export interface PlotOffer {
	plot: number;
	cost: number;
}

export function cellIdx(x: number, y: number): number {
	return y * STRIDE + x;
}

export function cellX(c: number): number {
	return c % STRIDE;
}

export function cellY(c: number): number {
	return (c / STRIDE) | 0;
}

export function inStride(x: number, y: number): boolean {
	return x >= 0 && y >= 0 && x < MAX_COLS && y < MAX_ROWS;
}

export function plotIdx(px: number, py: number): number {
	return py * PLOTS + px;
}

export function plotX(plot: number): number {
	return plot % PLOTS;
}

export function plotY(plot: number): number {
	return (plot / PLOTS) | 0;
}

/** Chebyshev distance from the center plot, 0..PLOT_RADIUS. */
export function plotRing(plot: number): number {
	return Math.max(Math.abs(plotX(plot) - PLOT_RADIUS), Math.abs(plotY(plot) - PLOT_RADIUS));
}

export function plotOf(x: number, y: number): number {
	return plotIdx((x / PLOT) | 0, (y / PLOT) | 0);
}

export function plotOfCell(c: number): number {
	return plotOf(cellX(c), cellY(c));
}

export function plotCells(plot: number): number[] {
	const x0 = plotX(plot) * PLOT;
	const y0 = plotY(plot) * PLOT;
	const out: number[] = [];
	for (let y = y0; y < y0 + PLOT; y++) for (let x = x0; x < x0 + PLOT; x++) out.push(cellIdx(x, y));
	return out;
}

export function plotBounds(plot: number): Bounds {
	const x0 = plotX(plot) * PLOT;
	const y0 = plotY(plot) * PLOT;
	return { x0, y0, x1: x0 + PLOT - 1, y1: y0 + PLOT - 1 };
}

export function ownedPlots(p: PlanetState): number[] {
	if (!p.plots?.length) p.plots = [CENTER_PLOT];
	return p.plots;
}

export function ownsPlot(p: PlanetState, plot: number): boolean {
	return ownedPlots(p).includes(plot);
}

export function inPlay(x: number, y: number, p: PlanetState, _pi?: number): boolean {
	return inStride(x, y) && ownsPlot(p, plotOf(x, y));
}

export function inPlayCell(c: number, p: PlanetState): boolean {
	return c >= 0 && c < MAX_CELLS && ownsPlot(p, plotOfCell(c));
}

/** Unowned plots that share an edge with an owned plot. */
export function buyablePlots(p: PlanetState): number[] {
	const owned = ownedPlots(p);
	const out: number[] = [];
	for (let plot = 0; plot < PLOTS * PLOTS; plot++) {
		if (owned.includes(plot)) continue;
		const x = plotX(plot);
		const y = plotY(plot);
		const next =
			(x > 0 && owned.includes(plotIdx(x - 1, y))) ||
			(x < PLOTS - 1 && owned.includes(plotIdx(x + 1, y))) ||
			(y > 0 && owned.includes(plotIdx(x, y - 1))) ||
			(y < PLOTS - 1 && owned.includes(plotIdx(x, y + 1)));
		if (next) out.push(plot);
	}
	return out;
}

export function plotCost(pi: number, bought: number): number {
	const def = PLANETS[pi];
	const anchor = Math.max(def.unlock, 400);
	return Math.ceil(anchor * def.value * 0.55 * Math.pow(1.9, bought));
}

/** Price of the next plot on this planet. */
export function nextPlotCost(pi: number, p: PlanetState): number {
	return plotCost(pi, ownedPlots(p).length - 1);
}

export function plotOffers(p: PlanetState, pi: number): PlotOffer[] {
	const cost = nextPlotCost(pi, p);
	return buyablePlots(p).map((plot) => ({ plot, cost }));
}

export function boughtPlots(p: PlanetState): number {
	return ownedPlots(p).length - 1;
}

/** Cell box around the owned plots. */
export function ownedBounds(p: PlanetState): Bounds {
	let x0 = PLOTS;
	let y0 = PLOTS;
	let x1 = 0;
	let y1 = 0;
	for (const plot of ownedPlots(p)) {
		x0 = Math.min(x0, plotX(plot));
		y0 = Math.min(y0, plotY(plot));
		x1 = Math.max(x1, plotX(plot));
		y1 = Math.max(y1, plotY(plot));
	}
	return { x0: x0 * PLOT, y0: y0 * PLOT, x1: (x1 + 1) * PLOT - 1, y1: (y1 + 1) * PLOT - 1 };
}

/** Cell box the view frames: owned plots plus the plots that can be bought. */
export function viewBounds(p: PlanetState): Bounds {
	const b = ownedBounds(p);
	for (const plot of buyablePlots(p)) {
		const pb = plotBounds(plot);
		b.x0 = Math.min(b.x0, pb.x0);
		b.y0 = Math.min(b.y0, pb.y0);
		b.x1 = Math.max(b.x1, pb.x1);
		b.y1 = Math.max(b.y1, pb.y1);
	}
	return b;
}

export function countOreInCells(tiles: Uint8Array, cells: number[], ore = TILE_ORE): number {
	let n = 0;
	for (const c of cells) if (tiles[c] === ore) n++;
	return n;
}
