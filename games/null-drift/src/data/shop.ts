export type OfferId = 'splice' | 'baffle' | 'vent';

export interface OfferDef {
	id: OfferId;
	name: string;
	price: number;
	text: string;
	pitch: string;
}

export const OFFERS: OfferDef[] = [
	{ id: 'splice', name: 'OLIVINE SPLICE', price: 1150, text: 'Fight payouts x1.18 for the rest of the run.', pitch: 'Skims more off every corpse.' },
	{ id: 'baffle', name: 'SIGNAL BAFFLE', price: 640, text: 'Each card makes 2 less noise (min 0).', pitch: 'Quiet hands live longer.' },
	{ id: 'vent', name: 'DEEP VENT KIT', price: 480, text: 'Trace to 0 now. Vent cards work x1.4.', pitch: 'Flush the logs. One time. Maybe.' },
];

export const VENDOR_LINES = [
	'NO NAMES. NO REFUNDS.',
	'CYCLES FIRST. QUESTIONS NEVER.',
	'YOU SMELL LIKE TRACE, RUNNER.',
	'BUY OR WALK. THE WATCH IS LISTENING.',
	'EVERYTHING HERE FELL OFF A SERVER.',
];
