import { statSync } from 'node:fs';
import { join } from 'node:path';

/** Latest touch on a catalog entry or its build project (for “recent” ordering). */
export function entryUpdatedAt(entryId: string, buildFolder?: string): Date {
	const times: number[] = [];

	const root = process.cwd();
	const entryFile = join(root, 'src/content/games', entryId, 'index.md');
	try {
		times.push(statSync(entryFile).mtimeMs);
	} catch {
		/* missing entry */
	}

	if (buildFolder) {
		const pkg = join(root, buildFolder, 'package.json');
		try {
			times.push(statSync(pkg).mtimeMs);
		} catch {
			/* no build */
		}
	}

	if (times.length === 0) return new Date(0);
	return new Date(Math.max(...times));
}