import { OFFERS, type OfferDef, type OfferId } from '../data/shop.ts';
import type { Run } from './run.ts';

export type OfferState = 'buy' | 'poor' | 'bought' | 'owned';

/** Splice and baffle are permanent, so a second copy does nothing. */
export function offerState(run: Run, offer: OfferDef): OfferState {
	if (run.shop?.has(offer.id)) return 'bought';
	if (offer.id === 'splice' && run.mods.salvage > 1) return 'owned';
	if (offer.id === 'baffle' && run.mods.damper) return 'owned';
	if (run.cycles < offer.price) return 'poor';
	return 'buy';
}

export function buyOffer(run: Run, id: OfferId): boolean {
	const offer = OFFERS.find((o) => o.id === id);
	if (!offer || !run.shop || offerState(run, offer) !== 'buy') return false;
	run.cycles -= offer.price;
	run.shop.add(id);
	if (id === 'splice') run.mods.salvage = 1.18;
	if (id === 'baffle') run.mods.damper = true;
	if (id === 'vent') {
		run.trace = 0;
		run.mods.ventBonus = true;
	}
	return true;
}
