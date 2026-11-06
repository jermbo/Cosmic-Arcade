import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENTRIES_FOLDER = join('src', 'content', 'games');
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;
const BUILD_LINE = /^build:\s*["']?([^"'\n]+?)["']?\s*$/m;

/**
 * Reads the slug and the build link of each game entry that has a build.
 * Astro checks the full schema; this script needs only these two values.
 * @param {string} root The folder of the repo.
 * @returns {{ slug: string, build: string }[]}
 */
export function readLinkedEntries(root) {
	const entriesFolder = join(root, ENTRIES_FOLDER);
	if (!existsSync(entriesFolder)) return [];

	return readdirSync(entriesFolder, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => ({ slug: entry.name, build: readBuild(join(entriesFolder, entry.name, 'index.md')) }))
		.filter((entry) => entry.build !== null);
}

/** @param {string} file */
function readBuild(file) {
	if (!existsSync(file)) return null;

	const frontmatter = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').match(FRONTMATTER);
	const build = frontmatter?.[1].match(BUILD_LINE);
	return build ? build[1] : null;
}
