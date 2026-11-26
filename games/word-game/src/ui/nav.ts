// Layers (screens, panels, modals) tied to browser history, so the phone's
// back button closes the top layer and stays inside the game.
// Also routes physical key presses to the top key handler.

interface Layer {
	close: () => void;
}

const layers: Layer[] = [];

history.replaceState({ depth: 0 }, '');

addEventListener('popstate', (e) => {
	const depth = (e.state as { depth?: number } | null)?.depth ?? 0;
	while (layers.length > depth) layers.pop()!.close();
});

/** Opens a layer. `close` runs when the layer is closed by any means. */
export function pushLayer(close: () => void): number {
	layers.push({ close });
	history.pushState({ depth: layers.length }, '');
	return layers.length;
}

/** Closes layers until only `depth` - 1 are left (closes the layer at `depth`). */
export function closeLayer(depth: number): void {
	const steps = layers.length - depth + 1;
	if (steps > 0) history.go(-steps);
}

export function depth(): number {
	return layers.length;
}

type KeyHandler = (key: string, e: KeyboardEvent) => void;
const keyHandlers: KeyHandler[] = [];

export function pushKeys(fn: KeyHandler): () => void {
	keyHandlers.push(fn);
	return () => {
		const i = keyHandlers.lastIndexOf(fn);
		if (i >= 0) keyHandlers.splice(i, 1);
	};
}

addEventListener('keydown', (e) => {
	if (e.metaKey || e.ctrlKey || e.altKey) return;
	if (e.key === 'Escape' && layers.length) {
		history.back();
		return;
	}
	// An open card (help, results, choices) takes the keys for its own buttons.
	if (document.querySelector('.modal:not(.modal--out):not(.modal--keys)')) return;
	const top = keyHandlers.at(-1);
	if (!top) return;
	if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) return;
	top(e.key, e);
});
