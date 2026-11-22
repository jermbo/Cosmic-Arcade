import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file = path.join(root, 'public/maps/official.json');
const maps = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!Array.isArray(maps)) throw new Error('official.json must be an array.');

const enemies = new Set(['scout', 'tank', 'skimmer', 'splitter', 'shard', 'boss']);

function expand(points) {
	if (!points.length) return [];
	const cells = [points[0]];
	for (let i = 1; i < points.length; i++) {
		const [c0, r0] = points[i - 1];
		const [c1, r1] = points[i];
		const dc = Math.sign(c1 - c0);
		const dr = Math.sign(r1 - r0);
		if (dc !== 0 && dr !== 0) return [];
		let c = c0;
		let r = r0;
		while (c !== c1 || r !== r1) {
			c += dc;
			r += dr;
			cells.push([c, r]);
		}
	}
	return cells;
}

const seen = new Set();
for (const [i, map] of maps.entries()) {
	const where = `Map #${i + 1} (${map.id ?? '?'})`;
	if (!map.id || seen.has(map.id)) throw new Error(`${where}: duplicate or missing id.`);
	seen.add(map.id);
	if (!Array.isArray(map.paths) || !map.paths.length) throw new Error(`${where}: needs paths.`);
	for (const path of map.paths) {
		const cells = expand(path);
		if (cells.length < 2) throw new Error(`${where}: path too short or diagonal.`);
		for (const [c, r] of cells) {
			if (c < 0 || r < 0 || c >= map.w || r >= map.h) throw new Error(`${where}: path leaves the grid.`);
		}
	}
	if (!Array.isArray(map.waves) || !map.waves.length) throw new Error(`${where}: needs waves.`);
	for (const wave of map.waves) {
		if (!Array.isArray(wave) || !wave.length) throw new Error(`${where}: empty wave.`);
		for (const group of wave) {
			if (!enemies.has(group.type)) throw new Error(`${where}: bad enemy ${group.type}.`);
			if (group.count < 1) throw new Error(`${where}: bad count.`);
		}
	}
}

console.log(`OK: ${maps.length} official maps in public/maps/official.json`);