/** localStorage that never throws (private mode, blocked storage). */
export function load<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return fallback;
		return { ...fallback, ...JSON.parse(raw) };
	} catch {
		return fallback;
	}
}

export function save(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* storage is full or blocked: the game still plays */
	}
}

export function remove(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch {
		/* ignore */
	}
}
