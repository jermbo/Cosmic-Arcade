import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readLinkedEntries } from './game-entries.js';
import { readGameProjects } from './game-projects.js';

const root = process.cwd();
const publishFolder = join(root, 'public', 'games');

const projects = new Map(readGameProjects(root).map((project) => [project.id, project]));
const entries = readLinkedEntries(root);

const brokenLinks = entries.filter((entry) => !projects.has(entry.build));
if (brokenLinks.length > 0) {
	for (const entry of brokenLinks) {
		console.error(`The game entry "${entry.slug}" links to "${entry.build}", but no game project has that name.`);
	}
	process.exit(1);
}

rmSync(publishFolder, { recursive: true, force: true });

for (const entry of entries) {
	const project = projects.get(entry.build);
	publish(entry.slug, project);
}

/**
 * @param {string} slug
 * @param {{ id: string, outDir: string, folder: string }} project
 */
function publish(slug, project) {
	console.log(`Building ${project.id} for /games/${slug}/play/`);
	execFileSync('npm', ['run', 'build', '-w', project.id], { cwd: root, stdio: 'inherit' });

	const output = join(root, project.folder, project.outDir);
	if (!existsSync(output)) {
		console.error(`The build of "${project.id}" did not make its outDir "${project.outDir}".`);
		process.exit(1);
	}
	cpSync(output, join(publishFolder, slug, 'play'), { recursive: true });
}
