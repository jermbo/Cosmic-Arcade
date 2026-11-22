// Find a planet by the id that content uses. The rules and the saves keep a planet by its place in PLANETS.

import { PLANETS } from '../content/planets.ts';
import type { PlanetId } from '../content/planets.ts';

export function planetIndex(id: PlanetId): number {
	return PLANETS.findIndex((p) => p.id === id);
}
