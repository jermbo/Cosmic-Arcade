// Step 4 — every planet map must pass ore access rules.
// Run: npm run test:tiles

import { PLANETS } from '../src/core/data.ts';
import { validatePlanetTiles } from '../src/core/tile-access.ts';
import { baseTilesOf, clearPlanetTileCache } from '../src/core/state.ts';

clearPlanetTileCache();
let failed = 0;
for (let pi = 0; pi < PLANETS.length; pi++) {
	const def = PLANETS[pi]!;
	const [px, py] = def.pad;
	const tiles = baseTilesOf(pi);
	const issues = validatePlanetTiles(tiles, px, py);
	if (issues.length) {
		failed += issues.length;
		for (const i of issues) console.error(def.name, i);
	}
}
if (failed) {
	console.error(`tile access: ${failed} issue(s)`);
	process.exit(1);
}
console.log(`tile access: ok (${PLANETS.length} planets)`);
