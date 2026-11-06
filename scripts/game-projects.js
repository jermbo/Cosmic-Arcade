import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const GAMES_FOLDER = 'games';

/**
 * Reads each game project in `games/` that has an `arcade` block in its package.json.
 * @param {string} [root] The folder of the repo.
 * @returns {{ id: string, engine: string, outDir: string, folder: string }[]}
 */
export function readGameProjects(root = process.cwd()) {
	const gamesFolder = join(root, GAMES_FOLDER);
	if (!existsSync(gamesFolder)) return [];

	return readdirSync(gamesFolder, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(GAMES_FOLDER, entry.name))
		.filter((folder) => existsSync(join(root, folder, 'package.json')))
		.map((folder) => readGameProject(root, folder))
		.filter((project) => project !== null);
}

/**
 * @param {string} root
 * @param {string} folder
 */
function readGameProject(root, folder) {
	const manifest = JSON.parse(readFileSync(join(root, folder, 'package.json'), 'utf8'));
	if (!manifest.arcade) return null;

	return {
		id: manifest.name,
		engine: manifest.arcade.engine,
		outDir: manifest.arcade.outDir,
		folder,
	};
}
