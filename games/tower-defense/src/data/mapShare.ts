import { validateMap } from './validateMap';
import type { MapDef } from './maps';

const PREFIX = 'cs1:';

export function encodeMap(map: MapDef): string {
	const json = JSON.stringify(map);
	const bytes = new TextEncoder().encode(json);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return PREFIX + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeMap(code: string): MapDef {
	const trimmed = code.trim();
	const payload = trimmed.startsWith(PREFIX) ? trimmed.slice(PREFIX.length) : trimmed;
	const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
	const pad = padded.length % 4 ? '='.repeat(4 - (padded.length % 4)) : '';
	const binary = atob(padded + pad);
	const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
	const json = new TextDecoder().decode(bytes);
	const { map, errors } = validateMap(JSON.parse(json));
	if (!map) throw new Error(errors.map((e) => e.message).join('\n'));
	return map;
}

export const PLAYTEST_KEY = 'crystal-siege-playtest';

export function stashPlaytest(map: MapDef): void {
	sessionStorage.setItem(PLAYTEST_KEY, JSON.stringify(map));
}

export function takePlaytest(): MapDef | null {
	const raw = sessionStorage.getItem(PLAYTEST_KEY);
	if (!raw) return null;
	sessionStorage.removeItem(PLAYTEST_KEY);
	try {
		const { map, errors } = validateMap(JSON.parse(raw));
		if (!map) throw new Error(errors[0]?.message ?? 'Invalid playtest map.');
		return map;
	} catch {
		return null;
	}
}