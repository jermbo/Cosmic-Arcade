export type CardKind = 'ATTACK' | 'SKILL' | 'POWER';

export interface CardDef {
	id: string;
	name: string;
	cost: number;
	kind: CardKind;
	damage?: number;
	mask?: number;
	/** Trace added on play. Negative vents trace. */
	noise: number;
	hitsAll?: boolean;
	cycles?: number;
	draw?: number;
	flavor: string;
}

export const CARDS: Record<string, CardDef> = {
	spike: { id: 'spike', name: 'DATA SPIKE', cost: 1, kind: 'ATTACK', damage: 6, noise: 4, flavor: 'Blunt payload. Loud.' },
	scrape: { id: 'scrape', name: 'SCRAPE', cost: 0, kind: 'ATTACK', damage: 3, noise: 2, flavor: 'Skim the edge. Free.' },
	burst: { id: 'burst', name: 'FOIL BURST', cost: 2, kind: 'ATTACK', damage: 11, noise: 9, hitsAll: true, flavor: 'Wide band. Everyone hears it.' },
	plate: { id: 'plate', name: 'PLATE UP', cost: 1, kind: 'SKILL', mask: 5, noise: 0, flavor: 'Spoof a clean handshake.' },
	firewall: { id: 'firewall', name: 'FIREWALL', cost: 2, kind: 'SKILL', mask: 9, noise: -6, flavor: 'Wall up. Bleed heat.' },
	coolant: { id: 'coolant', name: 'COOLANT PURGE', cost: 0, kind: 'SKILL', noise: -18, flavor: 'Dump the logs. Go cold.' },
	key: { id: 'key', name: 'BREACH KEY', cost: 1, kind: 'SKILL', noise: 3, cycles: 180, flavor: 'Skim a wallet on the way.' },
	over: { id: 'over', name: 'OVERCLOCK', cost: 1, kind: 'POWER', noise: 8, draw: 2, flavor: 'Push the rig past spec.' },
};

export const CARD_IDS = Object.keys(CARDS);

export const STARTER_DECK: string[] = [
	'spike', 'spike', 'spike', 'spike',
	'scrape', 'scrape',
	'plate', 'plate', 'plate',
	'firewall', 'coolant', 'key', 'burst', 'over',
];

/** Short rule lines for the card face. */
export function cardLines(card: CardDef): string[] {
	const lines: string[] = [];
	if (card.damage) lines.push(`Deal ${card.damage}${card.hitsAll ? ' to ALL' : ''}.`);
	if (card.mask) lines.push(`Mask +${card.mask}.`);
	if (card.cycles) lines.push(`+${card.cycles} cycles.`);
	if (card.draw) lines.push(`Draw ${card.draw}.`);
	if (card.noise < 0) lines.push(`Vent ${-card.noise} trace.`);
	return lines;
}
