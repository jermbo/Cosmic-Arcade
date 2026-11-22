// The small buy button of a row in a panel.

import { fmt } from '../../core/format.ts';

export function buyButton(act: string, arg: string, cost: number, can: boolean, maxed: boolean, unit = '') {
	if (maxed) return `<button class="btn btn--small" disabled>Max</button>`;
	return `<button class="btn btn--small" data-act="${act}" data-arg="${arg}" ${can ? '' : 'disabled'}>${unit}${fmt(cost)}</button>`;
}
