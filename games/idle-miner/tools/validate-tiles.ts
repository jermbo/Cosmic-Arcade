// Every planet map must pass the ore access and plot rules.
// Run: npm run test:tiles

import { PLANETS } from '../src/content/planets.ts';
import { TILE_ORE, TILE_ROCK } from '../src/core/tiles.ts';
import { PLOTS } from '../src/core/grid.ts';
import { oreClusterSizes, plotIssues, validatePlanetTiles } from '../src/core/tile-access.ts';
import { baseTilesOf, clearPlanetTileCache } from '../src/core/planet-map.ts';

clearPlanetTileCache();
let failed = 0;
for (let pi = 0; pi < PLANETS.length; pi++) {
	const def = PLANETS[pi]!;
	const [px, py] = def.pad;
	const tiles = baseTilesOf(pi);
	const issues: unknown[] = validatePlanetTiles(tiles, px, py);
	for (let plot = 0; plot < PLOTS * PLOTS; plot++) issues.push(...plotIssues(tiles, plot));
	if (issues.length) {
		failed += issues.length;
		for (const i of issues) console.error(def.name, i);
	}
	const sizes = oreClusterSizes(tiles);
	const ore = tiles.reduce((n, t) => n + (t === TILE_ORE ? 1 : 0), 0);
	const rock = tiles.reduce((n, t) => n + (t === TILE_ROCK ? 1 : 0), 0);
	console.log(`${def.name.padEnd(9)} ore ${ore}  rock ${rock}  patches ${sizes.length}  biggest ${Math.max(...sizes)}`);
}
if (failed) {
	console.error(`tiles: ${failed} issue(s)`);
	process.exit(1);
}
console.log(`tiles: ok (${PLANETS.length} planets)`);
