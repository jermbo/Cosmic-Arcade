// The last few errors, kept on the device.

const ERROR_KEY = 'idle-orbit-errors';

/** Keeps the last few errors on the device, so a tester can copy them into a bug report. */
export function logError(text: string): string[] {
	let list: string[] = [];
	try {
		const old = JSON.parse(localStorage.getItem(ERROR_KEY) || '[]');
		if (Array.isArray(old)) list = old.filter((s) => typeof s === 'string');
	} catch {
		// A bad log is replaced.
	}
	list.push(`${new Date().toISOString()} ${text}`);
	list = list.slice(-10);
	try {
		localStorage.setItem(ERROR_KEY, JSON.stringify(list));
	} catch {
		// Storage is full or blocked.
	}
	return list;
}
