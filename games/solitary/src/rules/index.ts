import type { DealOptions, ModeId } from '../core/types.ts';
import type { Rules } from './base.ts';
import { FreeCell } from './freecell.ts';
import { Klondike } from './klondike.ts';
import { Spider } from './spider.ts';

export { Rules } from './base.ts';

export function makeRules(mode: ModeId, opts: DealOptions, seed: number): Rules {
	if (mode === 'klondike') return new Klondike(opts, seed);
	if (mode === 'spider') return new Spider(opts, seed);
	return new FreeCell(opts, seed);
}

export const MODE_NAMES: Record<ModeId, string> = {
	klondike: 'Klondike',
	spider: 'Spider',
	freecell: 'FreeCell',
};

export function variantName(mode: ModeId, opts: DealOptions): string {
	if (mode === 'klondike') return `Klondike · Draw ${opts.draw}`;
	if (mode === 'spider') return `Spider · ${opts.suits} suit${opts.suits > 1 ? 's' : ''}`;
	return 'FreeCell';
}
