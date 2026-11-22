// The crew: a shared pool of managers. Each one works on one planet at a time and boosts one thing there.
// Hired crew and their levels stay through a Nova Reset.

export type CrewRole = 'drill' | 'machine' | 'ship' | 'sell';

export type CrewId = 'pip' | 'bex' | 'tull' | 'fenn' | 'marlo' | 'ione' | 'sora' | 'juno';
export interface CrewDef {
	name: string;
	title: string;
	role: CrewRole;
	/** Boost per level, as a fraction. Ship crew also add a third of this to cargo. */
	per: number;
	/** Credits to hire. Training costs more each level. */
	cost: number;
	color: string;
}
export const CREW: Record<CrewId, CrewDef> = {
	pip: { name: 'Pip', title: 'Drill Hand', role: 'drill', per: 0.2, cost: 500, color: '#ffb347' },
	bex: { name: 'Bex', title: 'Foreman', role: 'machine', per: 0.15, cost: 2000, color: '#6fe3ff' },
	tull: { name: 'Tull', title: 'Dock Hand', role: 'ship', per: 0.15, cost: 5000, color: '#9fb4ff' },
	fenn: { name: 'Fenn', title: 'Trader', role: 'sell', per: 0.08, cost: 50e3, color: '#ffd23f' },
	marlo: { name: 'Marlo', title: 'Deep Prospector', role: 'drill', per: 0.4, cost: 2e6, color: '#ff7a45' },
	ione: { name: 'Ione', title: 'Chief Engineer', role: 'machine', per: 0.3, cost: 20e6, color: '#5dff8f' },
	sora: { name: 'Sora', title: 'Flight Boss', role: 'ship', per: 0.3, cost: 200e6, color: '#b47cff' },
	juno: { name: 'Juno', title: 'Star Broker', role: 'sell', per: 0.15, cost: 2e9, color: '#ff5fae' },
};
export const CREW_ORDER = Object.keys(CREW) as CrewId[];
export const CREW_MAX = 10;
export const CREW_GROWTH = 2.2;
