export const GAMES_PATH = '/games/';

export function gamePath(slug: string): string {
	return `${GAMES_PATH}${slug}/`;
}

// The build is copied here by scripts/publish-games.js, not made by an Astro page.
export function playPath(slug: string): string {
	return `${gamePath(slug)}play/`;
}
