export type NodeType = 'combat' | 'elite' | 'cache' | 'unknown' | 'gate' | 'boss' | 'merchant';
export type FightType = Exclude<NodeType, 'merchant'>;
export type RolledType = 'combat' | 'cache' | 'unknown' | 'elite';

export interface NodeInfo {
	label: string;
	glyph: string;
	/** Cycles paid after the fight, before the salvage multiplier. */
	payout: number;
	blurb: string;
}

export const NODE_INFO: Record<NodeType, NodeInfo> = {
	combat: { label: 'FIGHT', glyph: '//', payout: 260, blurb: 'Standard daemon nest.' },
	elite: { label: 'ELITE', glyph: '!!', payout: 470, blurb: 'Hardened ICE. Big payout.' },
	cache: { label: 'CACHE', glyph: '[$]', payout: 900, blurb: 'Light guard on a fat wallet.' },
	unknown: { label: 'UNKNOWN', glyph: '??', payout: 300, blurb: 'Unreadable signatures.' },
	gate: { label: 'GATE', glyph: '|=|', payout: 560, blurb: 'Floor gate. Breach to go deeper. Sheds 35% trace.' },
	boss: { label: 'BOSS', glyph: '{0}', payout: 1200, blurb: 'Layer root. Kill it to clear the layer.' },
	merchant: { label: 'MARKET', glyph: '$$', payout: 0, blurb: 'Black market fence. No fight.' },
};

export const DEFAULT_WEIGHTS: Record<RolledType, number> = { combat: 46, cache: 20, unknown: 18, elite: 12 };

export const DEFAULT_ROSTERS: Record<FightType, string[]> = {
	combat: ['sentry', 'crawler'],
	cache: ['lockjaw'],
	unknown: ['unknown_a', 'unknown_b'],
	elite: ['hunter', 'sentry'],
	gate: ['sentry', 'lockjaw'],
	boss: ['warden'],
};
