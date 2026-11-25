import type { DealOptions, ModeId } from '../core/types.ts';
import { settings, updateSettings } from '../store/settings.ts';
import { choice, picked } from './dialogs.ts';

/** Draw / suits radios on the title screen mode cards. */
export function titleModeOptions(mode: ModeId, opts: DealOptions): string {
	if (mode === 'klondike') {
		return choice(`draw-${mode}`, 'Draw', [[1, 'Draw 1'], [3, 'Draw 3']], opts.draw);
	}
	if (mode === 'spider') {
		return choice(`suits-${mode}`, 'Suits', [[1, '1 suit'], [2, '2 suits'], [4, '4 suits']], opts.suits);
	}
	return '';
}

/** Draw / suits radios in pause, new-deal, and win dialogs (`prefix` like `nd` or `w`). */
export function dialogVariantOptions(mode: ModeId, prefix: string, opts: DealOptions, legend?: string): string {
	if (mode === 'klondike') {
		return choice(`${prefix}-draw`, legend ?? 'Draw', [[1, 'Draw 1'], [3, 'Draw 3']], opts.draw);
	}
	if (mode === 'spider') {
		return choice(`${prefix}-suits`, legend ?? 'Suits', [[1, '1 suit'], [2, '2 suits'], [4, '4 suits']], opts.suits);
	}
	return '';
}

export function defaultDealOptions(): DealOptions {
	return { draw: settings.klondikeDraw, suits: settings.spiderSuits };
}

export function readVariantOptions(root: HTMLElement, namePrefix: string, base: DealOptions): DealOptions {
	const draw = picked(root, `${namePrefix}-draw`);
	const suits = picked(root, `${namePrefix}-suits`);
	const opts = { ...base };
	if (draw) opts.draw = Number(draw) as 1 | 3;
	if (suits) opts.suits = Number(suits) as 1 | 2 | 4;
	updateSettings({ klondikeDraw: opts.draw, spiderSuits: opts.suits });
	return opts;
}