// Purchases outside the factory: ship upgrades, research, and new planets.

import { PLANETS } from '../content/planets.ts';
import { RESEARCH } from '../content/research.ts';
import type { ResearchId } from '../content/research.ts';
import { SHIP_UPS } from '../content/ships.ts';
import type { ShipUpgrade } from '../content/ships.ts';
import { makeShip } from './state.ts';
import type { Game } from './game.ts';
import { shipUpCost, researchCost } from './prices.ts';
import { grantsPower } from './effects.ts';

export function buyShipUp(g: Game, pi: number, u: ShipUpgrade): boolean {
	const p = g.planets[pi];
	if (p.up[u] >= SHIP_UPS[u].max) return false;
	const cost = shipUpCost(g, pi, u);
	if (g.credits < cost) return false;
	g.credits -= cost;
	p.up[u]++;
	if (u === 'ships') {
		const s = makeShip();
		s.ph = 2;
		p.ships.push(s);
	}
	return true;
}

export function buyResearch(g: Game, r: ResearchId): boolean {
	if (g.research[r] >= RESEARCH[r].max) return false;
	const cost = researchCost(g, r);
	if (g.credits < cost) return false;
	g.credits -= cost;
	g.research[r]++;
	if (grantsPower(RESEARCH[r].effects, 'lightBeacon')) g.beaconLit = true;
	return true;
}

export function unlockPlanet(g: Game, pi: number): boolean {
	const p = g.planets[pi];
	if (p.unlocked || pi === 0 || !g.planets[pi - 1].unlocked) return false;
	const cost = PLANETS[pi].unlock;
	if (g.credits < cost) return false;
	g.credits -= cost;
	p.unlocked = true;
	return true;
}
